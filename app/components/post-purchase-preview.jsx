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
  { id: "desktop", icon: "desktop", label: "Desktop", width: 820 },
  { id: "tablet", icon: "tablet", label: "Tablet", width: 620 },
  { id: "mobile", icon: "mobile", label: "Mobile", width: 380 },
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

export function PostPurchasePreview({ offer, device, storeName }) {
  const o = offer || {};
  const es = o.editorSettings && typeof o.editorSettings === "object" ? o.editorSettings : {};
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

  const p = pricing(o);
  const mins = String(Math.max(1, Number.parseInt(o.timerDuration, 10) || 10)).padStart(2, "0");
  const header = o.headline || `Add ${o.productTitle || "this product"} to your order`;
  const acceptText = o.buttonText || "Complete Purchase";
  const declineText = o.declineText || "Decline this offer";
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
      {acceptText} • {money(p.final)}
    </div>
  );
  const declineBtn = (
    <div style={{ color: BLUE, textAlign: "center", fontSize: 14, padding: "10px" }}>{declineText}</div>
  );

  const Block = ({ b, i }) => {
    if (!b) return null;
    if (b.type === "heading") return <div key={i} style={{ fontSize: 18, fontWeight: 700, color: INK }}>{b.text || ""}</div>;
    if (b.type === "text") return <div key={i} style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.5 }}>{b.text || ""}</div>;
    if (b.type === "divider") return <div key={i} style={{ borderTop: "1px solid #e6e6e6", margin: "4px 0" }} />;
    if (b.type === "image") return b.imageUrl ? <img key={i} src={b.imageUrl} alt="" style={{ width: "100%", borderRadius: 8 }} /> : null;
    if (b.type === "video")
      return b.thumbnailUrl ? (
        <div key={i} style={{ position: "relative" }}>
          <img src={b.thumbnailUrl} alt="" style={{ width: "100%", borderRadius: 8, display: "block" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>▶</div>
          </div>
        </div>
      ) : null;
    return null;
  };

  // Text & Video content section (headline + copy + optional video thumb).
  const tvLayout = esTV.layout || "center"; // left | center | right (video side)
  const showVideo = o.videoEnabled && o.videoThumbnailUrl;
  const videoThumb = showVideo ? (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <img src={o.videoThumbnailUrl} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} />
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
              <span style={{ color: BLUE }}>✓</span> You&apos;ve paid for your order.
            </div>
            <div style={{ color: BLUE, fontSize: 13, marginTop: 2 }}>View order confirmation ›</div>
          </div>

          {/* Heading */}
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

          {/* Countdown bar */}
          {o.timerEnabled ? (
            <div
              style={{
                background: esCountdown.bg || "#f4f4f5", textAlign: "center", fontSize: 14,
                borderBottom: "1px solid #eee",
                paddingTop: padPx(esCountdown.top ?? 50) + 6, paddingBottom: padPx(esCountdown.bottom ?? 30) + 6,
                marginLeft: esCountdown.fullWidth ? 0 : 0,
              }}
            >
              Exclusive offer expires in: <span style={{ fontWeight: 700 }}>{mins}:00</span>
            </div>
          ) : null}

          {/* Upsell product */}
          <div style={{ paddingTop: padPx(esProduct.top ?? 50) + 12, paddingBottom: padPx(esProduct.bottom ?? 40) + 12, paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexDirection: narrow ? "column" : "row" }}>
              <div style={{ flex: narrow ? "1 1 auto" : `0 0 ${imgWidth}`, width: imgWidth }}>
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt={o.productTitle || ""} style={{ width: "100%", objectFit: imgFit, borderRadius: 8, border: o.imageBorder ? "1px solid #eee" : "none", display: "block" }} />
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

                {o.descriptionEnabled && o.description ? <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.45, marginBottom: 12 }}>{o.description}</div> : null}

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

                {/* Money summary */}
                {o.showMoneySummary ? (
                  <div style={{ borderTop: "1px solid #eee", paddingTop: 10, marginBottom: 12 }}>
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
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                        <span>Total</span><span>USD {money(p.final)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Buttons */}
                <div style={{ display: sideBySide ? "flex" : "block", gap: 10 }}>
                  <div style={{ flex: 1 }}>{acceptBtn}</div>
                  <div style={{ flex: sideBySide ? "0 0 auto" : undefined }}>{declineBtn}</div>
                </div>

                {esProduct.paymentDisclaimer ? (
                  <div style={{ fontSize: 11, color: SUBTLE, textAlign: "center", marginTop: 8 }}>
                    Your payment method will be charged for this additional purchase.
                  </div>
                ) : null}

                {/* Trust badges (USP Image) — only when images set (matches live) */}
                {o.trustBadgesEnabled && trust.length ? (
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                    {trust.map((src, i) => (
                      <img key={i} src={src} alt="" style={{ height: 34, objectFit: "contain" }} />
                    ))}
                  </div>
                ) : null}
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
                <div
                  style={{
                    display: "flex", gap: 18, alignItems: "flex-start",
                    flexDirection: narrow ? "column" : tvLayout === "left" ? "row-reverse" : "row",
                  }}
                >
                  {tvLayout === "center" && !narrow ? (
                    <div style={{ flex: 1, textAlign: "center" }}>{tvCopy}{showVideo ? <div style={{ marginTop: 14 }}>{videoThumb}</div> : null}</div>
                  ) : (
                    <>
                      {tvCopy}
                      {videoThumb}
                    </>
                  )}
                </div>
              ) : null}
              {blocks.map((b, i) => <Block key={i} b={b} i={i} />)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
