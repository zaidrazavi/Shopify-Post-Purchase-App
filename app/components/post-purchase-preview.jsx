// Admin-side WYSIWYG preview of the POST-PURCHASE offer page (OCU-style).
// This is our own React preview, so we control colors here to match the target
// design (blue CTA, orange badge, gray countdown bar). The LIVE storefront page
// inherits the merchant's Shopify checkout colors (remote-ui limitation) — this
// preview shows the intended structure/branding.
//
// It reads two things off the offer:
//   • flat functional fields (price, badgeEnabled, timerEnabled, buttonsPosition,
//     showMoneySummary, videoEnabled, contentBlocks, …) — these drive the live
//     extension too, and
//   • offer.editorSettings — OCU cosmetics (per-section paddings, background
//     colors, badge color/position, text&video layout, hide subtotal/total…).
//     These are preview-authoritative; the theme-locked live page honors the
//     subset it structurally can.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";

export const DEVICES = [
  { id: "desktop", icon: "desktop", label: "Desktop", width: 760 },
  { id: "tablet", icon: "tablet", label: "Tablet", width: 560 },
  { id: "mobile", icon: "mobile", label: "Mobile", width: 375 },
];

function pricing(o) {
  const base = Number.parseFloat(o.price);
  if (!Number.isFinite(base)) return { final: o.price ?? "", compare: null, savings: null };
  const dv = Number.parseFloat(o.discountValue);
  let final = base;
  if (o.discountType === "percentage" && Number.isFinite(dv) && dv > 0) final = base * (1 - dv / 100);
  else if (o.discountType === "fixed" && Number.isFinite(dv) && dv >= 0) final = dv;
  final = Math.max(0, final);
  const cap = Number.parseFloat(o.compareAtPrice);
  let compare = null;
  if (Number.isFinite(cap) && cap > final) compare = cap;
  else if (final < base) compare = base;
  return {
    final: final.toFixed(2),
    compare: compare != null ? compare.toFixed(2) : null,
    savings: compare != null ? (compare - final).toFixed(2) : null,
  };
}
const money = (v) => (v == null || v === "" ? "" : `$${v}`);
// Slider percent (0–100) → a comfortable px value for the preview.
const padPx = (v) => Math.round((Number(v) || 0) * 0.32);
const IMG_WIDTH = { small: "30%", medium: "40%", large: "52%" };

const BLUE = "#1773b0";
const INK = "#1a1a1a";
const SUBTLE = "#6b7177";
const LINE = "#e6e6e6";

export function PostPurchasePreview({ offer, device, storeName }) {
  const o = offer || {};
  const es = o.editorSettings && typeof o.editorSettings === "object" ? o.editorSettings : {};
  const esDisplay = es.displayOffer || {};
  const esHeading = es.heading || {};
  const esCountdown = es.countdown || {};
  const esProduct = es.product || {};
  const esTV = es.textVideo || {};
  const dev = DEVICES.find((d) => d.id === device) || DEVICES[0];
  const targetWidth = dev.width;
  const narrow = device === "mobile";

  const panelRef = useRef(null);
  const [zoom, setZoom] = useState(device === "mobile" ? 0.9 : 0.6);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const measure = () => {
      const avail = panel.clientWidth;
      if (avail > 0) setZoom(Math.min(1, avail / targetWidth));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(panel);
    return () => ro && ro.disconnect();
  }, [targetWidth]);

  // Animated countdown — ticks every second, resets when the duration changes.
  const durationSecs = Math.max(1, Number.parseInt(o.timerDuration, 10) || 10) * 60;
  const [secondsLeft, setSecondsLeft] = useState(durationSecs);
  useEffect(() => {
    setSecondsLeft(durationSecs);
  }, [durationSecs]);
  useEffect(() => {
    if (!o.timerEnabled) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [o.timerEnabled]);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const p = pricing(o);
  const header = o.headline || `Add ${o.productTitle || "a Product Title"} to your order`;
  // Match the live extension: known legacy defaults are treated as "unset" so
  // the new post-purchase defaults show; genuinely custom text is preserved.
  const LEGACY_ACCEPT = new Set([
    "Add This Gift To My Order", "Yes, Add This To My Order",
    "Add to Order", "Add to order", "Add to my order", "Add This To My Order",
  ]);
  const LEGACY_DECLINE = new Set(["I'd rather pay full price", "No thanks", "No, thanks"]);
  const acceptRaw = (o.buttonText || "").trim();
  const ctaBase = acceptRaw && !LEGACY_ACCEPT.has(acceptRaw) ? acceptRaw : "Complete Purchase • {{total}}";
  const acceptText = ctaBase.includes("{{total}}") ? ctaBase.replace(/\{\{\s*total\s*\}\}/g, money(p.final)) : ctaBase;
  const declineRaw = (o.declineText || "").trim();
  const declineText = declineRaw && !LEGACY_DECLINE.has(declineRaw) ? declineRaw : "Decline this offer";
  const productLayout = es.productLayout || "image_left";
  const msg = es.messageBanner || {};
  const promo = es.promoBanner || {};
  const sideBySide = o.buttonsPosition === "side-by-side";
  const uspItems = Array.isArray(o.uspItems) ? o.uspItems : [];
  const trust = Array.isArray(o.trustBadgeImages) ? o.trustBadgeImages : [];
  const blocks = Array.isArray(o.contentBlocks)
    ? [...o.contentBlocks].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    : [];

  const badgeColor = esProduct.badgeColor || "#E8632A";
  const badgePos = esProduct.badgePosition || "above_title";
  const useIcon = esProduct.useIcon !== false;
  const imgWidth = narrow ? "100%" : IMG_WIDTH[o.imageSize] || "40%";
  const imgFit = o.imageFit === "cover" ? "cover" : "contain";
  const allowSub = esDisplay.allowSubscription !== false;
  const stackLayout = narrow || productLayout === "image_top" || productLayout === "banner";
  const imageColWidth = productLayout === "banner" ? "100%" : narrow ? "100%" : stackLayout ? "55%" : imgWidth;

  const badgeEl =
    o.badgeEnabled && badgePos !== "none" ? (
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: `${badgeColor}22`, color: badgeColor, fontSize: 12, fontWeight: 700,
          padding: "3px 9px", borderRadius: 5,
        }}
      >
        {useIcon ? "🏆 " : ""}{o.badgeText || "Bestseller"}
      </div>
    ) : null;

  const acceptBtn = (
    <div
      style={{
        background: BLUE, color: "#fff", textAlign: "center", padding: "13px",
        borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: "default",
      }}
    >
      {acceptText}
    </div>
  );
  const declineBtn = (
    <div style={{ border: `1px solid ${LINE}`, color: BLUE, textAlign: "center", fontSize: 14, padding: "11px", borderRadius: 6 }}>
      {declineText}
    </div>
  );

  const moneySummary = (
    <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, marginBottom: 12 }}>
      {!esProduct.hideSubtotalLine ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: SUBTLE }}>Subtotal</span><span>{money(p.final)}</span>
        </div>
      ) : null}
      {esProduct.shipping === "charge" && !esProduct.hideShippingLine ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: SUBTLE }}>Shipping</span><span>Calculated at checkout</span>
        </div>
      ) : null}
      {!esProduct.hideTotalLine ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            <span style={{ color: SUBTLE, fontSize: 11, fontWeight: 400, marginRight: 4 }}>USD</span>{money(p.final)}
          </span>
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>Including N/A in taxes</div>
    </div>
  );

  const Block = ({ b, i }) => {
    if (!b) return null;
    const t = b.type;
    if (t === "heading") return <div key={i} style={{ fontSize: 18, fontWeight: 700, color: INK }}>{b.text || "Heading"}</div>;
    if (t === "text") return <div key={i} style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>{b.text || "Give a detailed description of a specific feature or benefit of your product."}</div>;
    if (t === "divider") return <div key={i} style={{ borderTop: `1px solid ${LINE}`, margin: "4px 0" }} />;
    if (t === "image") return b.imageUrl ? <img key={i} src={b.imageUrl} alt="" style={{ width: "100%", borderRadius: 8 }} /> : <div key={i} style={{ width: "100%", aspectRatio: "16/9", background: "#f0f0f0", borderRadius: 8 }} />;
    if (t === "video" || t === "text_video")
      return (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", flexDirection: narrow ? "column" : "row" }}>
          {t === "text_video" ? <div style={{ flex: 1, fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>{b.text || "Describe your product…"}</div> : null}
          <div style={{ position: "relative", flex: 1, minWidth: 0, width: "100%" }}>
            {b.thumbnailUrl ? <img src={b.thumbnailUrl} alt="" style={{ width: "100%", borderRadius: 8, display: "block" }} /> : <div style={{ width: "100%", aspectRatio: "16/9", background: "#eef0f2", borderRadius: 8 }} />}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.9)", color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>▶</div>
            </div>
          </div>
        </div>
      );
    if (t === "text_image")
      return (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", flexDirection: narrow ? "column" : "row" }}>
          <div style={{ flex: 1, fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>{b.text || "Describe your product…"}</div>
          {b.imageUrl ? <img src={b.imageUrl} alt="" style={{ flex: 1, width: "100%", borderRadius: 8 }} /> : <div style={{ flex: 1, width: "100%", aspectRatio: "1", background: "#f0f0f0", borderRadius: 8 }} />}
        </div>
      );
    if (t === "countdown")
      return (
        <div key={i} style={{ background: "#f4f4f5", textAlign: "center", padding: "10px", fontSize: 14, borderRadius: 6 }}>
          Exclusive offer expires in: <span style={{ fontWeight: 700 }}>{mm}:{ss}</span>
        </div>
      );
    if (t === "buybox")
      return <div key={i}>{acceptBtn}</div>;
    return null;
  };

  // Trust badges row: real images if provided, else 4 gray placeholder circles.
  const trustRow = o.trustBadgesEnabled ? (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
      {trust.length
        ? trust.map((src, i) => <img key={i} src={src} alt="" style={{ height: 34, objectFit: "contain" }} />)
        : [0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${LINE}`, background: "#f3f4f6" }} />
          ))}
    </div>
  ) : null;

  // Text & Video content section.
  const tvLayout = esTV.layout || "center";
  const showVideo = o.videoEnabled;
  const videoThumb = showVideo ? (
    <div style={{ position: "relative", flex: 1, minWidth: 0, width: "100%" }}>
      {o.videoThumbnailUrl ? (
        <img src={o.videoThumbnailUrl} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "16/9", background: "#eef0f2", borderRadius: 10 }} />
      )}
      {!esTV.hidePlayIcon ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.9)", color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>▶</div>
        </div>
      ) : null}
      {esTV.playButtonLabel ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, textAlign: "center", color: "#fff", fontSize: 12, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>{esTV.playButtonLabel}</div>
      ) : null}
    </div>
  ) : null;

  const tvCopy = (
    <div style={{ flex: 1, minWidth: 0 }}>
      {esTV.headline !== false ? <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Headline</div> : null}
      <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.55 }}>
        Give a detailed description of a specific feature or benefit of your product.
      </div>
    </div>
  );

  const showTextVideo = showVideo || esTV.headline !== false || blocks.length;

  return (
    <div style={{ background: "#f6f6f7", padding: 16, borderRadius: 8, overflow: "hidden" }}>
      <div ref={panelRef} style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: targetWidth, zoom, background: "#fff", color: INK,
            fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
            border: "1px solid #e3e3e3", borderRadius: 10, overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
          }}
        >
          {/* Order-status chrome */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #eee" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{storeName || "Your store"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, color: SUBTLE, fontSize: 13 }}>
              <span style={{
                display: "inline-flex", width: 16, height: 16, borderRadius: "50%",
                border: `1.5px solid ${BLUE}`, color: BLUE, alignItems: "center", justifyContent: "center", fontSize: 10,
              }}>✓</span> You&apos;ve paid for your order.
            </div>
            <div style={{ color: BLUE, fontSize: 13, marginTop: 2 }}>View order confirmation ›</div>
          </div>

          {/* Message banner (Kaching-style) */}
          {msg.enabled ? (
            <div style={{ background: msg.bg || "#22C55E", color: msg.textColor || "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
              {msg.showIcon ? <span>🔥</span> : null}
              <span>{msg.text || ""}</span>
              {msg.showTimer && o.timerEnabled ? <span style={{ fontWeight: 700 }}>{mm}:{ss}</span> : null}
            </div>
          ) : null}

          {/* Heading */}
          {o.headlineEnabled !== false ? (
            <div
              style={{
                textAlign: "center", fontSize: 17, fontWeight: 700,
                background: esHeading.bg || "transparent",
                paddingTop: padPx(esHeading.top ?? 40) + 10, paddingBottom: padPx(esHeading.bottom ?? 20) + 10,
                paddingLeft: 24, paddingRight: 24,
              }}
            >
              {header}
            </div>
          ) : null}

          {/* Countdown bar (animated) */}
          {o.timerEnabled ? (
            <div
              style={{
                background: esCountdown.bg || "#f4f4f5", textAlign: "center", fontSize: 14,
                borderBottom: "1px solid #eee",
                paddingTop: padPx(esCountdown.top ?? 50) + 6, paddingBottom: padPx(esCountdown.bottom ?? 30) + 6,
                paddingLeft: esCountdown.fullWidth ? 0 : 24, paddingRight: esCountdown.fullWidth ? 0 : 24,
              }}
            >
              Exclusive offer expires in: <span style={{ fontWeight: 700 }}>{mm}:{ss}</span>
            </div>
          ) : null}

          {/* Upsell product */}
          <div style={{ paddingTop: padPx(esProduct.top ?? 50) + 12, paddingBottom: padPx(esProduct.bottom ?? 40) + 12, paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ display: "flex", gap: 20, alignItems: stackLayout ? "stretch" : "flex-start", flexDirection: stackLayout ? "column" : "row" }}>
              <div style={{ flex: stackLayout ? "1 1 auto" : `0 0 ${imageColWidth}`, width: imageColWidth, alignSelf: productLayout === "image_top" && !narrow ? "center" : "auto" }}>
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt={o.productTitle || ""} style={{ width: "100%", objectFit: imgFit, borderRadius: 8, border: o.imageBorder ? `1px solid ${LINE}` : "none", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "1", background: "#f0f0f0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>No image</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {badgePos === "above_title" && badgeEl ? <div style={{ marginBottom: 8 }}>{badgeEl}</div> : null}

                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{o.productTitle || "Product Title"}</div>

                {badgePos === "under_title" && badgeEl ? <div style={{ marginBottom: 6 }}>{badgeEl}</div> : null}

                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
                  {o.showCompareAt && p.compare ? <span style={{ textDecoration: "line-through", color: SUBTLE }}>{money(p.compare)}</span> : null}
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{money(p.final)}</span>
                  {badgePos === "next_to_price" && badgeEl ? badgeEl : null}
                </div>

                {o.descriptionEnabled !== false ? (
                  <div style={{ fontSize: 13, color: o.description ? SUBTLE : "#b6bbc0", lineHeight: 1.45, marginBottom: 12 }}>
                    {o.description || "{{ product_description }}"}
                  </div>
                ) : null}

                {/* Variant selector */}
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 10px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: SUBTLE }}>Variant Title</div>
                    <div style={{ fontSize: 13 }}>Product Variant</div>
                  </div>
                  <span style={{ color: SUBTLE }}>▾</span>
                </div>

                {/* Subscription radios */}
                {allowSub ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", border: `4px solid ${BLUE}`, background: "#fff", display: "inline-block" }} /> One-time purchase
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: SUBTLE }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid #c4c8cc`, display: "inline-block" }} /> Subscribe &amp; save 3%
                    </div>
                  </div>
                ) : null}

                {/* USP bullets */}
                {o.uspEnabled && uspItems.length ? (
                  <div style={{ marginBottom: 12 }}>
                    {uspItems.map((it, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, marginBottom: 4 }}>
                        {it?.iconUrl ? <img src={it.iconUrl} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} /> : <span style={{ color: BLUE }}>✓</span>}
                        <span>{it?.text || ""}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Money summary (buy box) */}
                {moneySummary}

                {/* Buttons */}
                <div style={{ display: sideBySide ? "flex" : "block", gap: 10 }}>
                  <div style={{ flex: 1, marginBottom: sideBySide ? 0 : 8 }}>{acceptBtn}</div>
                  <div style={{ flex: sideBySide ? 1 : undefined }}>{declineBtn}</div>
                </div>

                {esProduct.paymentDisclaimer ? (
                  <div style={{ fontSize: 11, color: SUBTLE, textAlign: "center", marginTop: 8 }}>
                    Your payment method will be charged for this additional purchase.
                  </div>
                ) : null}

                {trustRow}
              </div>
            </div>
          </div>

          {/* Text & Video + content blocks */}
          {showTextVideo ? (
            <div
              style={{
                borderTop: "1px solid #eee",
                paddingTop: padPx(esTV.top ?? 50) + 12, paddingBottom: padPx(esTV.bottom ?? 30) + 12,
                paddingLeft: 24, paddingRight: 24,
                display: "flex", flexDirection: "column", gap: 14,
              }}
            >
              {(showVideo || esTV.headline !== false) ? (
                tvLayout === "center" && !narrow ? (
                  <div style={{ textAlign: "center" }}>{tvCopy}{showVideo ? <div style={{ marginTop: 14 }}>{videoThumb}</div> : null}</div>
                ) : (
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexDirection: narrow ? "column" : tvLayout === "left" ? "row-reverse" : "row" }}>
                    {tvCopy}
                    {videoThumb}
                  </div>
                )
              ) : null}
              {blocks.map((b, i) => <Block key={i} b={b} i={i} />)}
            </div>
          ) : null}

          {/* Promotional banner (Kaching-style) */}
          {promo.enabled ? (
            <div style={{ margin: "0 24px 22px", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, display: "flex", gap: 14, alignItems: "center", flexDirection: narrow ? "column" : "row" }}>
              {promo.imageUrl ? <img src={promo.imageUrl} alt="" style={{ width: narrow ? "100%" : 90, height: narrow ? "auto" : 90, objectFit: "contain", borderRadius: 8 }} /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                {promo.title ? <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{promo.title}</div> : null}
                {promo.description ? <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.45 }}>{promo.description}</div> : null}
              </div>
              {promo.buttonText ? (
                <div style={{ border: `1px solid ${BLUE}`, color: BLUE, borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{promo.buttonText}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
