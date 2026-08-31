// Live WYSIWYG preview of a funnel Offer — a faithful port of the old
// popup-preview.jsx (which stays untouched), mapped to the Offer schema fields.
// Old defaults are applied in code where a column is null.
//
// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { FONT_STACKS, IMAGE_SIZE_PX } from "../lib/popup-options";

export const DEVICES = [
  { id: "desktop", icon: "desktop", label: "Desktop", width: 600 },
  { id: "tablet", icon: "tablet", label: "Tablet", width: 512 },
  { id: "mobile", icon: "mobile", label: "Mobile", width: 360 },
];

// Discount-aware price preview (mirrors the old previewPricing).
function previewPricing(product, discountType, discountValue, showCompareAt, showSavings) {
  if (product.price == null || product.price === "") return null;
  const base = Number.parseFloat(product.price);
  if (!Number.isFinite(base)) {
    return { finalPrice: String(product.price), compareAtPrice: null, savings: null };
  }
  const dv = Number.parseFloat(discountValue);
  let final = base;
  if (discountType === "percentage" && Number.isFinite(dv) && dv > 0) {
    final = base * (1 - dv / 100);
  } else if (discountType === "fixed" && Number.isFinite(dv) && dv >= 0) {
    final = dv;
  }
  final = Math.max(0, final);

  const productCompareAt = Number.parseFloat(product.compareAtPrice);
  let original = null;
  if (Number.isFinite(productCompareAt) && productCompareAt > final) {
    original = productCompareAt;
  } else if (final < base) {
    original = base;
  }
  const showCompare = showCompareAt && original != null;
  return {
    finalPrice: final.toFixed(2),
    compareAtPrice: showCompare ? original.toFixed(2) : null,
    savings: showCompare && showSavings ? (original - final).toFixed(2) : null,
  };
}

function money(v) {
  if (v == null || v === "") return "";
  return `$${v}`;
}

// Pick black or white text for readability on a given background color.
function contrastText(hex) {
  const c = String(hex || "").replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (full.length !== 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1A1A2E" : "#ffffff";
}

export function OfferPreview({ offer, device }) {
  // ── Map Offer fields → old popup semantics, applying old defaults ──
  const headlineEnabled = offer.headlineEnabled ?? true;
  const headlineText = offer.headline;
  const subheadlineEnabled = offer.subheadlineEnabled ?? true;
  const subheadlineText = offer.subheadlineText;
  const descriptionEnabled = offer.descriptionEnabled ?? true;
  const descriptionText = offer.description;
  const countdownEnabled = offer.timerEnabled ?? false;
  const countdownMinutes = offer.timerDuration ?? 10;
  const timerBackgroundColor = offer.timerBackgroundColor ?? "#F8C9C9";
  const backgroundColor = offer.backgroundColor ?? "#FFFFFF";
  const fontColor = offer.textColor ?? "#1A1A2E";
  const cornerRadius = offer.cornerRadius ?? 14;
  const fontFamily = offer.fontFamily ?? "system";
  const inheritStoreFont = offer.inheritStoreFont === true;
  const themeVariant = offer.themeVariant ?? "classic";
  const imageFit = offer.imageFit ?? "cover";
  const imageSize = offer.imageSize ?? "medium";
  const imageBorder = offer.imageBorder !== false;
  const autoselectVariant = offer.autoselectVariant !== false;
  const hideQuantitySelector = offer.hideQuantitySelector !== false;
  const predefinedQuantity = offer.predefinedQuantity ?? 1;
  const showCompareAt = offer.showCompareAt ?? true;
  const showSavings = offer.showSavings ?? true;
  const acceptButtonText = offer.buttonText;
  const acceptButtonColor = offer.buttonColor ?? "#EF6E7B";
  const declineButtonText = offer.declineText;
  const declineButtonColor = offer.declineButtonColor ?? "#6D7175";
  const product = {
    image: offer.imageUrl,
    title: offer.productTitle,
    price: offer.price,
    compareAtPrice: offer.compareAtPrice,
  };

  const dev = DEVICES.find((d) => d.id === device) || DEVICES[0];
  const isMobile = device === "mobile";
  const targetWidth = dev.width;
  const font = inheritStoreFont ? "inherit" : FONT_STACKS[fontFamily] || FONT_STACKS.system;
  const pricing = previewPricing(product, offer.discountType, offer.discountValue, showCompareAt, showSavings);
  const imgPx = IMAGE_SIZE_PX[imageSize] || 140;
  const centered = themeVariant === "bold";
  const layout = offer.layout || "media-left";
  const showImage = layout !== "text-only";
  const mediaDir = layout === "media-top" ? "column" : layout === "media-right" ? "row-reverse" : "row";
  const selectorsColor = offer.selectorsColor || "#8C9196";
  const elementsColor = offer.elementsColor || "#E1E3E5";
  const btnRadius = Math.max(6, Number.parseInt(cornerRadius, 10) || 8);
  const mins = String(Math.max(1, Number.parseInt(countdownMinutes, 10) || 10)).padStart(2, "0");

  const panelRef = useRef(null);
  const [zoom, setZoom] = useState(isMobile ? 0.8 : 0.5);

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
    return () => {
      if (ro) ro.disconnect();
    };
  }, [targetWidth]);

  return (
    <div style={{ background: "#f6f6f7", padding: "16px", borderRadius: "8px", overflow: "hidden" }}>
      <div ref={panelRef} style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: targetWidth,
            zoom,
            background: backgroundColor,
            color: fontColor,
            fontFamily: font,
            borderRadius: `${cornerRadius}px`,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            position: "relative",
          }}
        >
          <div aria-hidden style={{ position: "absolute", top: 8, right: 12, fontSize: 20, opacity: 0.6 }}>
            ×
          </div>

          {countdownEnabled ? (
            <div
              style={{
                background: timerBackgroundColor,
                color: "#1A1A2E",
                textAlign: "center",
                padding: "8px",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Special Offer Ends In:{" "}
              <span style={{ color: "#E14E2A", fontWeight: 700 }}>{mins}:00</span>
            </div>
          ) : null}

          <div style={{ padding: "22px", textAlign: centered ? "center" : "left" }}>
            {headlineEnabled && headlineText ? (
              <div style={{ fontSize: centered ? 22 : 18, fontWeight: 700, marginBottom: 6 }}>
                {headlineText}
              </div>
            ) : null}
            {subheadlineEnabled && subheadlineText ? (
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>{subheadlineText}</div>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexDirection: device === "mobile" ? "column" : mediaDir,
                textAlign: device === "mobile" || layout === "media-top" ? "center" : "left",
              }}
            >
              {showImage && product.image ? (
                <img
                  src={product.image}
                  alt={product.title || ""}
                  style={{
                    width: imgPx,
                    height: imgPx,
                    objectFit: imageFit,
                    borderRadius: 8,
                    flex: "0 0 auto",
                    border: imageBorder ? `1px solid ${elementsColor}` : "none",
                  }}
                />
              ) : showImage ? (
                <div
                  style={{
                    width: imgPx,
                    height: imgPx,
                    background: "#e9e9eb",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#9a9a9a",
                    flex: "0 0 auto",
                    border: imageBorder ? `1px solid ${elementsColor}` : "none",
                  }}
                >
                  No image
                </div>
              ) : null}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {product.title || "Select a product"}
                </div>
                {!hideQuantitySelector || !autoselectVariant ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                      padding: "6px 10px",
                      border: `1px solid ${selectorsColor}`,
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    {!autoselectVariant ? (
                      <span style={{ color: selectorsColor, fontWeight: 600 }}>Variant ▾</span>
                    ) : null}
                    {!hideQuantitySelector ? (
                      <span style={{ color: selectorsColor }}>Qty {predefinedQuantity || 1}</span>
                    ) : null}
                  </div>
                ) : null}
                {descriptionEnabled && descriptionText ? (
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      opacity: 0.75,
                      marginBottom: 10,
                      maxHeight: 72,
                      overflowY: "auto",
                      paddingRight: 6,
                    }}
                  >
                    {descriptionText}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    justifyContent: device === "mobile" ? "center" : "flex-start",
                  }}
                >
                  {pricing?.compareAtPrice ? (
                    <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                      {money(pricing.compareAtPrice)}
                    </span>
                  ) : null}
                  {product.price != null && product.price !== "" ? (
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {pricing ? money(pricing.finalPrice) : money(product.price)}
                    </span>
                  ) : null}
                </div>
                {pricing?.savings ? (
                  <div style={{ color: "#1a7f45", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                    {money(pricing.savings)} Savings
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  background: acceptButtonColor,
                  color: contrastText(acceptButtonColor),
                  padding: "12px",
                  borderRadius: btnRadius,
                  fontWeight: 600,
                  fontSize: 15,
                  textAlign: "center",
                }}
              >
                {acceptButtonText || "Add to my order"}
              </div>
              <div
                style={{
                  color: declineButtonColor,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "underline",
                }}
              >
                {declineButtonText || "No thanks"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
