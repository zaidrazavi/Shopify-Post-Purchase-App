// Live WYSIWYG preview of the pre-purchase popup for the admin editor.
//
// Intentionally uses inline styles: it renders the merchant's own custom
// colors/fonts/radius/layout, which Polaris tokens can't express. Kept in its
// own client-only module (no server imports) so it can be rendered standalone
// — the admin route and any preview harness share the exact same component.
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

// Client-side mirror of the server's popupPricing (discount-aware), preview only.
export function previewPricing(product, discountType, discountValue, showCompareAt, showSavings) {
  if (!product?.price) return null;
  const base = Number.parseFloat(product.price);
  if (!Number.isFinite(base)) {
    return { finalPrice: product.price, compareAtPrice: null, savings: null };
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

export function PopupPreview({ form, product, device }) {
  const dev = DEVICES.find((d) => d.id === device) || DEVICES[0];
  const isMobile = device === "mobile";
  // Render the card at its real storefront pixel width, then zoom it down to fit
  // the (narrow) preview panel — so proportions/layout match live, not squeezed.
  const targetWidth = dev.width;
  // inheritStoreFont wins: fall back to the panel's own font so the preview shows
  // "theme font" behavior rather than a specific stack.
  const font = form.inheritStoreFont
    ? "inherit"
    : FONT_STACKS[form.fontFamily] || FONT_STACKS.system;
  const pricing = previewPricing(
    product,
    form.discountType,
    form.discountValue,
    form.showCompareAt,
    form.showSavings,
  );
  const imgPx = IMAGE_SIZE_PX[form.imageSize] || 140;
  const centered = form.themeVariant === "bold";
  // Layout drives image placement; text-only drops the image entirely.
  const layout = form.layout || "media-left";
  const showImage = layout !== "text-only";
  const mediaDir =
    layout === "media-top"
      ? "column"
      : layout === "media-right"
        ? "row-reverse"
        : "row";
  const selectorsColor = form.selectorsColor || "#8C9196";
  const elementsColor = form.elementsColor || "#E1E3E5";
  // Pill vs. rounded-rect buttons: a large corner radius reads as a pill.
  const btnRadius = Math.max(6, Number.parseInt(form.cornerRadius, 10) || 8);
  const mins = String(
    Math.max(1, Number.parseInt(form.countdownMinutes, 10) || 10),
  ).padStart(2, "0");

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
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(panel);
    return () => {
      if (ro) ro.disconnect();
    };
  }, [targetWidth]);

  return (
    <div
      style={{
        background: "#f6f6f7",
        padding: "16px",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div ref={panelRef} style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: targetWidth,
            zoom,
            background: form.backgroundColor,
            color: form.fontColor,
            fontFamily: font,
            borderRadius: `${form.cornerRadius}px`,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            position: "relative",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              right: 12,
              fontSize: 20,
              opacity: 0.6,
            }}
          >
            ×
          </div>

          {form.countdownEnabled ? (
            <div
              style={{
                background: form.timerBackgroundColor,
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
            {form.headlineEnabled && form.headlineText ? (
              <div
                style={{
                  fontSize: centered ? 22 : 18,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {form.headlineText}
              </div>
            ) : null}
            {form.subheadlineEnabled && form.subheadlineText ? (
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
                {form.subheadlineText}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexDirection:
                  device === "mobile" ? "column" : mediaDir,
                textAlign:
                  device === "mobile" || layout === "media-top"
                    ? "center"
                    : "left",
              }}
            >
              {showImage && product?.image ? (
                <img
                  src={product.image}
                  alt={product.title || ""}
                  style={{
                    width: imgPx,
                    height: imgPx,
                    objectFit: form.imageFit,
                    borderRadius: 8,
                    flex: "0 0 auto",
                    border: form.imageBorder
                      ? `1px solid ${elementsColor}`
                      : "none",
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
                    border: form.imageBorder
                      ? `1px solid ${elementsColor}`
                      : "none",
                  }}
                >
                  No image
                </div>
              ) : null}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {product?.title || "Select a product"}
                </div>
                {!form.hideQuantitySelector || !form.autoselectVariant ? (
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
                    {!form.autoselectVariant ? (
                      <span style={{ color: selectorsColor, fontWeight: 600 }}>
                        Variant ▾
                      </span>
                    ) : null}
                    {!form.hideQuantitySelector ? (
                      <span style={{ color: selectorsColor }}>
                        Qty {form.predefinedQuantity || 1}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {form.descriptionEnabled && form.descriptionText ? (
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      opacity: 0.75,
                      marginBottom: 10,
                      // Mirror the theme's .pcu-modal__desc: fixed-height scroll box,
                      // not an expanding block.
                      maxHeight: 72,
                      overflowY: "auto",
                      paddingRight: 6,
                    }}
                  >
                    {form.descriptionText}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    justifyContent:
                      device === "mobile" ? "center" : "flex-start",
                  }}
                >
                  {pricing?.compareAtPrice ? (
                    <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                      {pricing.compareAtPrice}
                    </span>
                  ) : null}
                  {product?.price ? (
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {pricing ? pricing.finalPrice : product.price}
                    </span>
                  ) : null}
                </div>
                {pricing?.savings ? (
                  <div
                    style={{
                      color: "#1a7f45",
                      fontWeight: 700,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {pricing.savings} Savings
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  background: form.acceptButtonColor,
                  color: contrastText(form.acceptButtonColor),
                  padding: "12px",
                  borderRadius: btnRadius,
                  fontWeight: 600,
                  fontSize: 15,
                  textAlign: "center",
                }}
              >
                {form.acceptButtonText || "Add to my order"}
              </div>
              <div
                style={{
                  color: form.declineButtonColor,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "underline",
                }}
              >
                {form.declineButtonText || "No thanks"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
