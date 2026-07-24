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
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  Separator,
  Text,
  TextBlock,
  TextContainer,
  Tiles,
  View,
} from "@shopify/post-purchase-ui-extensions-react";

/**
 * URL of this app's backend. The Accept flow POSTs here to have the changeset
 * signed with the app's API secret (which must never live in the extension
 * bundle).
 *
 * NOTE: this is the current `shopify app dev` Cloudflare tunnel URL. Trycloudflare
 * tunnels are regenerated every time you restart `shopify app dev`, so if the
 * dev tunnel changes, update this value (find it in the dev server output or in
 * .shopify/dev-bundle/manifest.json under `app_home.app_url`). For production,
 * set it to the deployed app URL (`application_url` in shopify.app.toml).
 */
const APP_URL = "https://designated-falling-diploma-prize.trycloudflare.com";

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
render("Checkout::PostPurchase::Render", App);

// Top-level React component
export function App({ storage, inputData, calculateChangeset, applyChangeset, done }) {
  // `ShouldRender` only renders when a valid offer was stored, so this is present.
  const offer = storage.initialData?.offer;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calculatedPurchase, setCalculatedPurchase] = useState(null);

  // Ask Shopify to price the offer against the completed order so we can show
  // an accurate total before the customer accepts.
  useEffect(() => {
    let cancelled = false;

    async function calculate() {
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

  // Prefer the server-calculated total; fall back to the cached price.
  const displayPrice =
    calculatedPurchase?.totalOutstandingSet?.presentmentMoney?.amount ??
    offer.price;
  const displayCurrency =
    calculatedPurchase?.totalOutstandingSet?.presentmentMoney?.currencyCode ?? "";

  async function acceptOffer() {
    setProcessing(true);
    setError(null);

    try {
      // The changeset must be signed by our backend with the app's API secret
      // before it can be applied. `inputData.token` proves this request came
      // from a genuine post-purchase page.
      const response = await fetch(`${APP_URL}/api/sign-changeset`, {
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
    // Skip the offer and proceed to the Thank You page.
    done();
  }

  return (
    <BlockStack spacing="loose">
      <CalloutBanner title={offer.headline}>{offer.description}</CalloutBanner>

      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: "small", sizes: [1, 30, 1] },
          { viewportSize: "medium", sizes: [300, 30, 0.5] },
          { viewportSize: "large", sizes: [400, 30, 0.33] },
        ]}
      >
        <View>
          <Image source={offer.image} description={offer.title} />
        </View>
        <View />
        <BlockStack spacing="xloose">
          <TextContainer>
            <Heading>{offer.title}</Heading>
            <TextBlock>
              <Text size="large" emphasized>
                {loading ? "Calculating price…" : `${displayPrice} ${displayCurrency}`}
              </Text>
            </TextBlock>
          </TextContainer>

          {error ? (
            <TextBlock appearance="critical">{error}</TextBlock>
          ) : null}

          <Separator />

          <Tiles>
            <Button
              submit
              onPress={acceptOffer}
              loading={processing}
              disabled={loading || processing}
            >
              Accept
            </Button>
            <View />
            <Button
              subdued
              onPress={declineOffer}
              disabled={processing}
            >
              Decline
            </Button>
          </Tiles>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}
