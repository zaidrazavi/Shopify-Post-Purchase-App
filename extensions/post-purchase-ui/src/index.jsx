/**
 * Extend Shopify Checkout with a custom Post Purchase user experience.
 * This template provides two extension points:
 *
 *  1. ShouldRender - Called first, during the checkout process, when the
 *     payment page loads.
 *  2. Render - If requested by `ShouldRender`, will be rendered after checkout
 *     completes
 */
import React, { useEffect, useState } from "react";

import {
  extend,
  render,
  Banner,
  BlockStack,
  Button,
  Image,
  InlineStack,
  Layout,
  Text,
  TextBlock,
  View,
} from "@shopify/post-purchase-ui-extensions-react";

/**
 * URL of this app's backend. The Accept flow POSTs here to have the changeset
 * signed with the app's API secret (which must never live in the extension
 * bundle).
 *
 * This is the production app URL (Render). It must match `application_url` in
 * shopify.app.toml. When developing locally with `shopify app dev`, temporarily
 * swap this for the printed Cloudflare tunnel URL (found in the dev server
 * output or .shopify/dev-bundle/manifest.json under `app_home.app_url`).
 */
const APP_URL = "https://shopify-post-purchase-app.onrender.com";

/**
 * Fetches the merchant's offer configuration from the app backend. The response
 * shape is defined by `buildOfferPayload` in app/models/offer.server.js and
 * includes the authoritative `changes` array for the changeset.
 */
async function fetchOffer(inputData) {
  const response = await fetch(`${APP_URL}/api/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${inputData.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      referenceId: inputData.initialPurchase.referenceId,
      shop: inputData.shop.domain,
    }),
  });

  if (!response.ok) {
    throw new Error(`/api/offer responded ${response.status}`);
  }

  return response.json();
}

/**
 * Entry point for the `ShouldRender` Extension Point.
 *
 * Reads the merchant's saved configuration and only renders the post-purchase
 * step when the offer is enabled and points at a real product.
 */
extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  try {
    const offer = await fetchOffer(inputData);

    if (!offer.enabled || !offer.variantId || !offer.changes?.length) {
      return { render: false };
    }

    // Saved state is provided to `Render` via `storage.initialData`.
    await storage.update({ offer });
    return { render: true };
  } catch (e) {
    // Fail closed: if we can't load the config, don't interrupt checkout.
    // eslint-disable-next-line no-console
    console.error("post-purchase ShouldRender failed", e);
    return { render: false };
  }
});

/**
 * Entry point for the `Render` Extension Point.
 *
 * Returns markup composed of remote UI components. The Render extension can
 * optionally make use of data stored during `ShouldRender` extension point to
 * expedite time-to-first-meaningful-paint.
 */
// The SDK's `render` INVOKES this second argument as a function (`render(input)`)
// and uses the result as the element to mount. Passing `App` directly would call
// `App(input)` as a plain function — running its hooks outside React's render
// phase, which throws "invalid hook call" (#321) and makes Shopify skip the page.
// Return an <App /> ELEMENT (with the extension input spread as props) so App is
// mounted by the reconciler and its hooks run correctly.
render("Checkout::PostPurchase::Render", (input) => <App {...input} />);

// Discount percentage for the "SAVE X%" badge, derived from the compare-at and
// final price already in the payload — presentation only, no extra data.
function savePercent(offer) {
  const compareAt = Number.parseFloat(offer?.compareAtPrice);
  const price = Number.parseFloat(offer?.price);
  if (!Number.isFinite(compareAt) || !Number.isFinite(price) || compareAt <= price) {
    return null;
  }
  return Math.round((1 - price / compareAt) * 100);
}

// Top-level React component
export function App({ storage, inputData, calculateChangeset, applyChangeset, done }) {
  // `ShouldRender` stored the full payload: main offer fields at the top level,
  // plus an optional nested `downsell`. Both are pre-fetched so switching steps
  // needs no network call.
  const payload = storage.initialData?.offer;
  // Defensive: if the offer didn't survive from ShouldRender for any reason,
  // fall back to an empty object so the hooks below can't throw and crash the
  // render (a crash makes Shopify silently skip the post-purchase page).
  const mainOffer = payload ?? {};
  const downsellOffer = payload?.downsell ?? null;

  // "main" = the upsell shown first; "downsell" = the fallback after a decline.
  const [step, setStep] = useState("main");
  const offer = step === "downsell" && downsellOffer ? downsellOffer : mainOffer;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calculatedPurchase, setCalculatedPurchase] = useState(null);

  // Countdown timer: UI-only urgency on the main step. Starts from the
  // configured minutes and resets on page load — it never expires the offer or
  // touches inventory.
  const [secondsLeft, setSecondsLeft] = useState(
    mainOffer.countdownEnabled
      ? Math.max(0, Math.round((mainOffer.countdownMinutes ?? 10) * 60))
      : 0,
  );

  // If the offer somehow didn't come through, don't render a broken empty page —
  // gracefully end the post-purchase step so the buyer proceeds to Thank-You.
  useEffect(() => {
    if (!payload) done();
  }, [payload, done]);

  useEffect(() => {
    if (!mainOffer.countdownEnabled || step !== "main") return undefined;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [mainOffer.countdownEnabled, step]);

  // Price the currently shown offer against the completed order. Re-runs when
  // the step changes so the downsell gets its own accurate total.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCalculatedPurchase(null);

    async function calculate() {
      if (!offer?.changes?.length) {
        setLoading(false);
        return;
      }
      try {
        const result = await calculateChangeset({ changes: offer.changes });
        if (!cancelled) {
          setCalculatedPurchase(result.calculatedPurchase);
        }
      } catch (e) {
        if (!cancelled) {
          setError("We couldn't load this offer. Please continue.");
          // eslint-disable-next-line no-console
          console.error("calculateChangeset failed", e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    calculate();
    return () => {
      cancelled = true;
    };
  }, [calculateChangeset, offer.changes]);

  // The final (discounted) price the buyer pays for this item. We use the
  // config-derived price so it stays consistent with the savings math; the
  // calculated changeset is still what actually gets charged on accept.
  const finalPrice = offer.price;
  const displayCurrency =
    calculatedPurchase?.totalOutstandingSet?.presentmentMoney?.currencyCode ?? "";

  const hasSavings = Boolean(offer.compareAtPrice && offer.savings);
  const savePct = savePercent(offer);
  const showCountdown = step === "main" && mainOffer.countdownEnabled;

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  async function acceptOffer() {
    setProcessing(true);
    setError(null);

    try {
      // The changeset must be signed by our backend with the app's API secret
      // before it can be applied. `inputData.token` proves this request came
      // from a genuine post-purchase page; `offer` tells the backend which step
      // (main or downsell) to sign so it rebuilds the authoritative changes.
      const response = await fetch(`${APP_URL}/api/sign-changeset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${inputData.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceId: inputData.initialPurchase.referenceId,
          shop: inputData.shop.domain,
          offer: step,
        }),
      });

      if (!response.ok) {
        throw new Error(`sign-changeset responded ${response.status}`);
      }

      const { token } = await response.json();

      // Apply the signed changeset. Shopify charges the customer's existing
      // payment method — no card re-entry required.
      const result = await applyChangeset(token);
      if (result?.errors?.length) {
        throw new Error(result.errors.map((err) => err.message).join(", "));
      }

      done();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to apply offer", e);
      setError("Sorry, we couldn't add the product. Please continue.");
      setProcessing(false);
    }
  }

  function declineOffer() {
    // Declining the main offer moves to the downsell (if configured); declining
    // the downsell (or the main offer when there's no downsell) ends the flow.
    if (step === "main" && downsellOffer) {
      setProcessing(false);
      setStep("downsell");
      return;
    }
    done();
  }

  return (
    <BlockStack spacing="loose">
      {/* Green urgency banner with countdown (RevLift "special discount" style) */}
      {showCountdown ? (
        <Banner status="success">
          <Text emphasized>
            {minutes}:{seconds} — It&apos;s not too late to add this to your
            order.
          </Text>
        </Banner>
      ) : null}

      {/* Headline + sub-headline (centered, above the split) */}
      <BlockStack spacing="tight" alignment="center">
        <Text size="large" emphasized>
          {offer.headline}
        </Text>
        {offer.description ? <Text subdued>{offer.description}</Text> : null}
      </BlockStack>

      {/* Horizontal split: product image (left) + details (right) — RevLift popup */}
      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: "small", sizes: [1, 30, 1] },
          { viewportSize: "medium", sizes: [300, 30, 0.5] },
          { viewportSize: "large", sizes: [400, 30, 0.33] },
        ]}
      >
        <View>
          {offer.image ? (
            <Image
              source={offer.image}
              description={offer.title}
              aspectRatio={1}
              fit="cover"
              bordered
            />
          ) : null}
        </View>
        <View />
        <BlockStack spacing="base">
          <Text emphasized>{offer.title}</Text>

          {loading ? (
            <Text subdued>Calculating price…</Text>
          ) : hasSavings ? (
            <BlockStack spacing="tight">
              <InlineStack spacing="tight">
                <Text size="large" role="deletion" subdued>
                  {offer.compareAtPrice} {displayCurrency}
                </Text>
                <Text size="large" emphasized>
                  {finalPrice} {displayCurrency}
                </Text>
              </InlineStack>
              {savePct != null ? (
                <Text appearance="success" emphasized>
                  SAVE {savePct}%
                </Text>
              ) : null}
            </BlockStack>
          ) : (
            <Text size="large" emphasized>
              {finalPrice} {displayCurrency}
            </Text>
          )}

          {error ? <TextBlock appearance="critical">{error}</TextBlock> : null}

          <Button
            submit
            onPress={acceptOffer}
            loading={processing}
            disabled={loading || processing}
          >
            {offer.acceptButtonText}
          </Button>
          <Button plain onPress={declineOffer} disabled={processing}>
            {offer.declineButtonText}
          </Button>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}
