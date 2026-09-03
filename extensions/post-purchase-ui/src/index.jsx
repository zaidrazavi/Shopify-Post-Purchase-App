/**
 * Extend Shopify Checkout with a custom Post Purchase user experience.
 *
 *  1. ShouldRender - Called first, during the checkout process, when the
 *     payment page loads.
 *  2. Render - If requested by `ShouldRender`, will be rendered after checkout
 *     completes
 *
 * RENDER NOTE: The purchase flow (fetch /api/offer, ShouldRender gate,
 * /api/sign-changeset signing, applyChangeset, accept/decline, downsell) is
 * UNCHANGED. Only the visual tree changed. When the offer carries no OCU
 * presentational keys (badge/usp/trustBadges/showMoneySummary/video/
 * contentBlocks/buttonsPosition) — e.g. an existing offer — we return the exact
 * previous layout, so live behavior is identical until those fields are set.
 * Colors/fonts are Shopify-checkout-theme-locked (remote-ui limitation).
 */
import React, { useEffect, useState } from "react";

import {
  extend,
  render,
  Banner,
  BlockStack,
  Bookend,
  Button,
  ButtonGroup,
  CalloutBanner,
  Heading,
  Image,
  InlineStack,
  Layout,
  Separator,
  Text,
  TextBlock,
  Tiles,
  View,
} from "@shopify/post-purchase-ui-extensions-react";

const APP_URL = "https://shopify-post-purchase-app.onrender.com";

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

extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  try {
    const offer = await fetchOffer(inputData);

    if (!offer.enabled || !offer.variantId || !offer.changes?.length) {
      return { render: false };
    }

    await storage.update({ offer });
    return { render: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("post-purchase ShouldRender failed", e);
    return { render: false };
  }
});

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

// One content block from payload.contentBlocks → a remote-ui element.
function renderBlock(b, i) {
  if (!b || typeof b !== "object") return null;
  switch (b.type) {
    case "heading":
      return <Heading key={i}>{b.text || ""}</Heading>;
    case "text":
      return <TextBlock key={i}>{b.text || ""}</TextBlock>;
    case "divider":
      return <Separator key={i} />;
    case "image":
      return b.imageUrl ? (
        <Image key={i} source={b.imageUrl} description="" aspectRatio={1.6} fit="cover" />
      ) : null;
    case "video":
      return b.thumbnailUrl ? (
        <BlockStack key={i} alignment="center" spacing="tight">
          <Image source={b.thumbnailUrl} description="" aspectRatio={1.6} fit="cover" />
          {b.linkUrl ? (
            <Button plain to={b.linkUrl}>
              Watch video
            </Button>
          ) : null}
        </BlockStack>
      ) : null;
    default:
      return null;
  }
}

// Top-level React component
export function App({ storage, inputData, calculateChangeset, applyChangeset, done }) {
  const payload = storage.initialData?.offer;
  const mainOffer = payload ?? {};
  const downsellOffer = payload?.downsell ?? null;

  const [step, setStep] = useState("main");
  const offer = step === "downsell" && downsellOffer ? downsellOffer : mainOffer;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [calculatedPurchase, setCalculatedPurchase] = useState(null);

  const [secondsLeft, setSecondsLeft] = useState(
    mainOffer.countdownEnabled
      ? Math.max(0, Math.round((mainOffer.countdownMinutes ?? 10) * 60))
      : 0,
  );

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
    if (step === "main" && downsellOffer) {
      setProcessing(false);
      setStep("downsell");
      return;
    }
    done();
  }

  // ── Shared presentational nodes (identical output in both layouts) ──
  const priceNode = loading ? (
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
  );

  const acceptBtn = (
    <Button submit onPress={acceptOffer} loading={processing} disabled={loading || processing}>
      {offer.acceptButtonText}
    </Button>
  );
  const declineBtn = (
    <Button plain onPress={declineOffer} disabled={processing}>
      {offer.declineButtonText}
    </Button>
  );

  // Enhanced OCU layout only when the CURRENT offer carries new OCU keys.
  // Extras are emitted for the MAIN offer only, so the downsell always uses the
  // original layout — and an offer with none set renders exactly as before.
  const rich = Boolean(
    offer.badge ||
      offer.usp ||
      offer.trustBadges ||
      offer.showMoneySummary != null ||
      offer.video ||
      (Array.isArray(offer.contentBlocks) && offer.contentBlocks.length) ||
      offer.buttonsPosition,
  );

  // ── Fallback: original layout, byte-for-byte as before ──
  if (!rich) {
    return (
      <BlockStack spacing="loose">
        {showCountdown ? (
          <Banner status="success">
            <Text emphasized>
              {minutes}:{seconds} — It&apos;s not too late to add this to your order.
            </Text>
          </Banner>
        ) : null}

        <BlockStack spacing="tight" alignment="center">
          <Text size="large" emphasized>
            {offer.headline}
          </Text>
          {offer.description ? <Text subdued>{offer.description}</Text> : null}
        </BlockStack>

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
              <Image source={offer.image} description={offer.title} aspectRatio={1} fit="cover" bordered />
            ) : null}
          </View>
          <View />
          <BlockStack spacing="base">
            <Text emphasized>{offer.title}</Text>
            {priceNode}
            {error ? <TextBlock appearance="critical">{error}</TextBlock> : null}
            {acceptBtn}
            {declineBtn}
          </BlockStack>
        </Layout>
      </BlockStack>
    );
  }

  // ── Enhanced OCU-style layout (structure only; colors/fonts theme-locked) ──
  const sortedBlocks = Array.isArray(offer.contentBlocks)
    ? [...offer.contentBlocks].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    : [];

  // Badge: honor position + icon from the editor (text/emphasis only; the
  // checkout theme controls color).
  const badgePos = offer.badge?.position || "above_title";
  const badgeNode =
    offer.badge?.enabled && badgePos !== "none" ? (
      <Text emphasized>{(offer.badge.useIcon ? "🏆 " : "") + (offer.badge.text || "")}</Text>
    ) : null;

  // Image size → Layout media sizes (fixed image column width per breakpoint).
  const IMG_SIZES = {
    small: { medium: 160, large: 190 },
    medium: { medium: 220, large: 260 },
    large: { medium: 300, large: 360 },
  };
  const imgSz = IMG_SIZES[offer.imageSize] || IMG_SIZES.medium;
  const imgFit = offer.imageFit === "cover" ? "cover" : "contain";

  const buttonsNode =
    offer.buttonsPosition === "side-by-side" ? (
      <ButtonGroup>
        {acceptBtn}
        {declineBtn}
      </ButtonGroup>
    ) : (
      <BlockStack spacing="tight">
        {acceptBtn}
        {declineBtn}
      </BlockStack>
    );

  return (
    <BlockStack spacing="loose">
      {showCountdown ? (
        <CalloutBanner border="block" background="secondary" spacing="tight" alignment="center">
          <Text emphasized>
            Exclusive offer expires in: {minutes}:{seconds}
          </Text>
        </CalloutBanner>
      ) : null}

      {offer.headline ? (
        <BlockStack spacing="tight" alignment="center">
          <Text size="large" emphasized>{offer.headline}</Text>
        </BlockStack>
      ) : null}

      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: "small", sizes: [1, 20, 1] },
          { viewportSize: "medium", sizes: [imgSz.medium, 24, "fill"] },
          { viewportSize: "large", sizes: [imgSz.large, 30, "fill"] },
        ]}
      >
        <View>
          {offer.image ? (
            <Image source={offer.image} description={offer.title} fit={imgFit} bordered />
          ) : null}
        </View>
        <View />
        <BlockStack spacing="base">
          {badgePos === "above_title" ? badgeNode : null}

          <Heading level={3}>{offer.title}</Heading>
          {badgePos === "under_title" ? badgeNode : null}
          {offer.description ? <TextBlock subdued>{offer.description}</TextBlock> : null}

          {badgePos === "next_to_price" ? (
            <InlineStack spacing="tight">
              {priceNode}
              {badgeNode}
            </InlineStack>
          ) : (
            priceNode
          )}

          {offer.usp?.enabled && Array.isArray(offer.usp.items) && offer.usp.items.length ? (
            <BlockStack spacing="xtight">
              {offer.usp.items.map((it, i) => (
                <Text key={i}>• {it?.text || ""}</Text>
              ))}
            </BlockStack>
          ) : null}

          {error ? <TextBlock appearance="critical">{error}</TextBlock> : null}

          {offer.showMoneySummary ? (
            <BlockStack spacing="tight">
              <Separator />
              {!offer.hideSubtotalLine ? (
                <Bookend trailing>
                  <Text subdued>Subtotal</Text>
                  <Text>{finalPrice} {displayCurrency}</Text>
                </Bookend>
              ) : null}
              {!offer.hideTotalLine ? (
                <Bookend trailing>
                  <Text emphasized>Total</Text>
                  <Text emphasized>{finalPrice} {displayCurrency}</Text>
                </Bookend>
              ) : null}
            </BlockStack>
          ) : null}

          {buttonsNode}
        </BlockStack>
      </Layout>

      {offer.trustBadges?.enabled &&
      Array.isArray(offer.trustBadges.images) &&
      offer.trustBadges.images.length ? (
        <Tiles maxPerLine={4} spacing="tight" alignment="center">
          {offer.trustBadges.images.map((src, i) => (
            <Image key={i} source={src} description="" aspectRatio={1} fit="contain" />
          ))}
        </Tiles>
      ) : null}

      {offer.video?.enabled && offer.video.thumbnailUrl
        ? renderBlock({ type: "video", thumbnailUrl: offer.video.thumbnailUrl, linkUrl: offer.video.linkUrl }, "video")
        : null}

      {sortedBlocks.length ? <BlockStack spacing="base">{sortedBlocks.map(renderBlock)}</BlockStack> : null}
    </BlockStack>
  );
}
