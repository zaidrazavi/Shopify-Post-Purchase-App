// Admin-side WYSIWYG preview of the POST-PURCHASE offer page (OCU-style).
// This is our own React preview, so we control colors here to match the target
// design (blue CTA, orange badge, gray countdown bar). The LIVE storefront page
// inherits the merchant's Shopify checkout colors (remote-ui limitation) — this
// preview shows the intended structure/branding.
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

const BLUE = "#1773b0";
const ORANGE = "#E8632A";
const INK = "#1a1a1a";
const SUBTLE = "#6b7177";

export function PostPurchasePreview({ offer, device }) {
  const o = offer || {};
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
            <div style={{ fontSize: 18, fontWeight: 600 }}>{o.productTitle ? "Your store" : "Your store"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, color: SUBTLE, fontSize: 13 }}>
              <span style={{ color: BLUE }}>✓</span> You&apos;ve paid for your order.
            </div>
            <div style={{ color: BLUE, fontSize: 13, marginTop: 2 }}>View order confirmation ›</div>
          </div>

          {/* Countdown bar */}
          {o.timerEnabled ? (
            <div style={{ background: "#f4f4f5", textAlign: "center", padding: "10px", fontSize: 14, borderBottom: "1px solid #eee" }}>
              Exclusive offer expires in: <span style={{ fontWeight: 700 }}>{mins}:00</span>
            </div>
          ) : null}

          <div style={{ padding: "22px 24px" }}>
            {/* Centered header */}
            <div style={{ textAlign: "center", fontSize: 17, fontWeight: 700, marginBottom: 18 }}>{header}</div>

            {/* Product row: image left / buy box right */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexDirection: narrow ? "column" : "row" }}>
              <div style={{ flex: narrow ? "1 1 auto" : "0 0 40%", width: narrow ? "100%" : "40%" }}>
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt={o.productTitle || ""} style={{ width: "100%", objectFit: "contain", borderRadius: 8, border: "1px solid #eee", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "1", background: "#f0f0f0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>No image</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {o.badgeEnabled ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fdece4", color: ORANGE, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 5, marginBottom: 8 }}>
                    🏆 {o.badgeText || "Bestseller"}
                  </div>
                ) : null}

                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{o.productTitle || "Product Title"}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
                  {p.compare ? <span style={{ textDecoration: "line-through", color: SUBTLE }}>{money(p.compare)}</span> : null}
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{money(p.final)}</span>
                </div>

                {o.description ? <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.45, marginBottom: 12 }}>{o.description}</div> : null}

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
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: SUBTLE }}>Subtotal</span><span>{money(p.final)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                      <span>Total</span><span>USD {money(p.final)}</span>
                    </div>
                  </div>
                ) : null}

                {/* Buttons */}
                <div style={{ display: sideBySide ? "flex" : "block", gap: 10 }}>
                  <div style={{ flex: 1 }}>{acceptBtn}</div>
                  <div style={{ flex: sideBySide ? "0 0 auto" : undefined }}>{declineBtn}</div>
                </div>

                {/* Trust badges — only when images are actually set (matches live) */}
                {o.trustBadgesEnabled && trust.length ? (
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                    {trust.map((src, i) => (
                      <img key={i} src={src} alt="" style={{ height: 34, objectFit: "contain" }} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Video block + content blocks below */}
            {(o.videoEnabled && o.videoThumbnailUrl) || blocks.length ? (
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #eee", display: "flex", flexDirection: "column", gap: 14 }}>
                {o.videoEnabled && o.videoThumbnailUrl ? <Block b={{ type: "video", thumbnailUrl: o.videoThumbnailUrl, linkUrl: o.videoLinkUrl }} i="v" /> : null}
                {blocks.map((b, i) => <Block key={i} b={b} i={i} />)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
