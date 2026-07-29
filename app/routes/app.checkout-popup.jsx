// The live preview intentionally uses inline styles: it's a WYSIWYG render of
// the merchant's own custom colors/fonts/radius, which Polaris tokens can't
// express. The admin *controls* all use real Polaris web components.
// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPopupConfig, savePopupConfig } from "../models/pre-purchase-popup.server";
import {
  FONT_OPTIONS,
  FONT_STACKS,
  IMAGE_SIZE_PX,
} from "../lib/popup-options";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await getPopupConfig(session.shop);
  return { config };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const get = (k) => form.get(k);

  const saved = await savePopupConfig(session.shop, {
    enabled: get("enabled") === "true",
    fontFamily: get("fontFamily"),
    fontColor: get("fontColor"),
    backgroundColor: get("backgroundColor"),
    themeVariant: get("themeVariant"),
    cornerRadius: get("cornerRadius"),
    hideIfInCart: get("hideIfInCart") === "true",
    headlineEnabled: get("headlineEnabled") === "true",
    headlineText: get("headlineText"),
    subheadlineEnabled: get("subheadlineEnabled") === "true",
    subheadlineText: get("subheadlineText"),
    descriptionEnabled: get("descriptionEnabled") === "true",
    descriptionText: get("descriptionText"),
    countdownEnabled: get("countdownEnabled") === "true",
    countdownMinutes: get("countdownMinutes"),
    timerBackgroundColor: get("timerBackgroundColor"),
    productId: get("productId"),
    variantId: get("variantId"),
    productTitle: get("productTitle"),
    productImage: get("productImage"),
    productPrice: get("productPrice"),
    productCompareAtPrice: get("productCompareAtPrice"),
    imageFit: get("imageFit"),
    imageSize: get("imageSize"),
    showCompareAt: get("showCompareAt") === "true",
    showSavings: get("showSavings") === "true",
    acceptButtonText: get("acceptButtonText"),
    acceptButtonColor: get("acceptButtonColor"),
    declineButtonText: get("declineButtonText"),
    declineButtonColor: get("declineButtonColor"),
    closeButtonBehavior: get("closeButtonBehavior"),
  });

  return { ok: true, config: saved };
};

function toSelectedProduct(picked) {
  const variant = picked.variants?.[0];
  const variantId = String(variant?.id ?? "").split("/").pop() || null;
  const image =
    picked.images?.[0]?.originalSrc ??
    picked.images?.[0]?.url ??
    picked.featuredImage?.url ??
    variant?.image?.originalSrc ??
    variant?.image?.url ??
    null;
  return {
    productId: picked.id ?? null,
    variantId,
    title: picked.title ?? null,
    image,
    price: variant?.price ?? null,
    compareAtPrice: variant?.compareAtPrice ?? null,
  };
}

// Client-side mirror of the server's savings logic, for the preview only.
function previewPricing(product, showCompareAt, showSavings) {
  if (!product?.price) return null;
  const price = Number.parseFloat(product.price);
  const finalPrice = Number.isFinite(price) ? price.toFixed(2) : product.price;
  const compareAt = Number.parseFloat(product.compareAtPrice);
  if (
    !showCompareAt ||
    !Number.isFinite(compareAt) ||
    !Number.isFinite(price) ||
    compareAt <= price
  ) {
    return { finalPrice, compareAtPrice: null, savings: null };
  }
  return {
    finalPrice,
    compareAtPrice: compareAt.toFixed(2),
    savings: showSavings ? (compareAt - price).toFixed(2) : null,
  };
}

const SWITCH_FIELDS = new Set([
  "enabled",
  "hideIfInCart",
  "headlineEnabled",
  "subheadlineEnabled",
  "descriptionEnabled",
  "countdownEnabled",
  "showCompareAt",
  "showSavings",
]);

export default function CheckoutPopupEditor() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [form, setForm] = useState(() => ({
    enabled: Boolean(config.enabled),
    fontFamily: config.fontFamily || "system",
    fontColor: config.fontColor || "#1A1A1A",
    backgroundColor: config.backgroundColor || "#FFFFFF",
    themeVariant: config.themeVariant || "classic",
    cornerRadius: config.cornerRadius ?? 12,
    hideIfInCart: Boolean(config.hideIfInCart),
    headlineEnabled: Boolean(config.headlineEnabled),
    headlineText: config.headlineText ?? "",
    subheadlineEnabled: Boolean(config.subheadlineEnabled),
    subheadlineText: config.subheadlineText ?? "",
    descriptionEnabled: Boolean(config.descriptionEnabled),
    descriptionText: config.descriptionText ?? "",
    countdownEnabled: Boolean(config.countdownEnabled),
    countdownMinutes: config.countdownMinutes ?? 10,
    timerBackgroundColor: config.timerBackgroundColor || "#E4362F",
    imageFit: config.imageFit || "cover",
    imageSize: config.imageSize || "medium",
    showCompareAt: Boolean(config.showCompareAt),
    showSavings: Boolean(config.showSavings),
    acceptButtonText: config.acceptButtonText ?? "",
    acceptButtonColor: config.acceptButtonColor || "#1A1A1A",
    declineButtonText: config.declineButtonText ?? "",
    declineButtonColor: config.declineButtonColor || "#6D7175",
    closeButtonBehavior: config.closeButtonBehavior || "decline",
  }));

  const [product, setProduct] = useState(
    config.variantId
      ? {
          productId: config.productId,
          variantId: config.variantId,
          title: config.productTitle,
          image: config.productImage,
          price: config.productPrice,
          compareAtPrice: config.productCompareAtPrice,
        }
      : null,
  );

  const [device, setDevice] = useState("desktop");
  const pageRef = useRef(null);
  const saving = fetcher.state !== "idle";

  // Delegated listener mirrors web-component change/input events into `form`.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return undefined;
    const handler = (event) => {
      const target = event.target;
      const name = target?.name;
      if (!name || !(name in form)) return;
      const value = SWITCH_FIELDS.has(name)
        ? Boolean(target.checked)
        : target.value;
      setForm((prev) =>
        prev[name] === value ? prev : { ...prev, [name]: value },
      );
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    return () => {
      el.removeEventListener("input", handler);
      el.removeEventListener("change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Popup settings saved");
  }, [fetcher.data, shopify]);

  async function pickProduct() {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (!selection || selection.length === 0) return;
    setProduct(toSelectedProduct(selection[0]));
  }

  function save() {
    if (form.enabled && !product?.variantId) {
      shopify.toast.show("Select a product before enabling the popup", {
        isError: true,
      });
      return;
    }
    fetcher.submit(
      {
        enabled: String(form.enabled),
        fontFamily: form.fontFamily,
        fontColor: form.fontColor,
        backgroundColor: form.backgroundColor,
        themeVariant: form.themeVariant,
        cornerRadius: String(form.cornerRadius ?? ""),
        hideIfInCart: String(form.hideIfInCart),
        headlineEnabled: String(form.headlineEnabled),
        headlineText: form.headlineText,
        subheadlineEnabled: String(form.subheadlineEnabled),
        subheadlineText: form.subheadlineText,
        descriptionEnabled: String(form.descriptionEnabled),
        descriptionText: form.descriptionText,
        countdownEnabled: String(form.countdownEnabled),
        countdownMinutes: String(form.countdownMinutes ?? ""),
        timerBackgroundColor: form.timerBackgroundColor,
        productId: product?.productId ?? "",
        variantId: product?.variantId ?? "",
        productTitle: product?.title ?? "",
        productImage: product?.image ?? "",
        productPrice: product?.price ?? "",
        productCompareAtPrice: product?.compareAtPrice ?? "",
        imageFit: form.imageFit,
        imageSize: form.imageSize,
        showCompareAt: String(form.showCompareAt),
        showSavings: String(form.showSavings),
        acceptButtonText: form.acceptButtonText,
        acceptButtonColor: form.acceptButtonColor,
        declineButtonText: form.declineButtonText,
        declineButtonColor: form.declineButtonColor,
        closeButtonBehavior: form.closeButtonBehavior,
      },
      { method: "POST" },
    );
  }

  const isLive = form.enabled && Boolean(product?.variantId);

  return (
    <s-page ref={pageRef} heading="Checkout popup">
      <s-button
        slot="primary-action"
        onClick={save}
        {...(saving ? { loading: true } : {})}
      >
        Save
      </s-button>

      {/* Status */}
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge
            tone={isLive ? "success" : "neutral"}
            icon={isLive ? "check-circle" : "disabled"}
          >
            {isLive ? "Popup is Live" : "Popup is Off"}
          </s-badge>
          <s-switch
            name="enabled"
            label="Enable pre-purchase popup"
            defaultChecked={config.enabled}
            details="Shows when the buyer clicks Checkout in the cart. When off, nothing is shown."
          />
        </s-stack>
      </s-section>

      {/* General */}
      <s-section heading="General">
        <s-badge tone="info" icon="paint-brush-flat">
          Look &amp; feel
        </s-badge>
        <s-select name="fontFamily" label="Font family" value={form.fontFamily}>
          {FONT_OPTIONS.map((f) => (
            <s-option key={f.value} value={f.value}>
              {f.label}
            </s-option>
          ))}
        </s-select>
        <s-color-field
          name="fontColor"
          label="Font color"
          defaultValue={config.fontColor}
        />
        <s-color-field
          name="backgroundColor"
          label="Background color"
          defaultValue={config.backgroundColor}
        />
        <s-select name="themeVariant" label="Theme style" value={form.themeVariant}>
          <s-option value="classic">Classic (left-aligned)</s-option>
          <s-option value="bold">Bold (centered)</s-option>
        </s-select>
        <s-number-field
          name="cornerRadius"
          label="Corner radius"
          defaultValue={config.cornerRadius ?? 12}
          min="0"
          max="40"
          suffix="px"
        />
      </s-section>

      {/* Display */}
      <s-section heading="Display">
        <s-switch
          name="hideIfInCart"
          label="Hide if the cart already contains the upsell product"
          defaultChecked={config.hideIfInCart}
        />
        <s-text type="small">
          Trigger: shown when the buyer clicks Checkout in the cart. (Product-page
          triggers are out of scope for now.)
        </s-text>
      </s-section>

      {/* Messaging */}
      <s-section heading="Messaging &amp; incentive">
        <s-switch
          name="headlineEnabled"
          label="Show headline"
          defaultChecked={config.headlineEnabled}
        />
        <s-text-field
          name="headlineText"
          label="Headline"
          defaultValue={config.headlineText}
        />
        <s-divider />
        <s-switch
          name="subheadlineEnabled"
          label="Show subheadline"
          defaultChecked={config.subheadlineEnabled}
        />
        <s-text-field
          name="subheadlineText"
          label="Subheadline"
          defaultValue={config.subheadlineText}
        />
        <s-divider />
        <s-switch
          name="descriptionEnabled"
          label="Show description"
          defaultChecked={config.descriptionEnabled}
        />
        <s-text-area
          name="descriptionText"
          label="Description"
          defaultValue={config.descriptionText}
          rows="3"
        />
        <s-divider />
        <s-switch
          name="countdownEnabled"
          label="Show countdown timer"
          defaultChecked={config.countdownEnabled}
        />
        <s-number-field
          name="countdownMinutes"
          label="Countdown length (minutes)"
          defaultValue={config.countdownMinutes ?? 10}
          min="1"
        />
        <s-color-field
          name="timerBackgroundColor"
          label="Timer background color"
          defaultValue={config.timerBackgroundColor}
        />
      </s-section>

      {/* Buy box */}
      <s-section heading="Buy box">
        <ProductPickerRow product={product} onPick={pickProduct} />
        <s-divider />
        <s-select name="imageSize" label="Image size" value={form.imageSize}>
          <s-option value="small">Small</s-option>
          <s-option value="medium">Medium</s-option>
          <s-option value="large">Large</s-option>
        </s-select>
        <s-select name="imageFit" label="Image fit" value={form.imageFit}>
          <s-option value="cover">Cover (fill &amp; crop)</s-option>
          <s-option value="contain">Contain (fit whole image)</s-option>
        </s-select>
        <s-switch
          name="showCompareAt"
          label="Show compare-at (was) price"
          defaultChecked={config.showCompareAt}
        />
        <s-switch
          name="showSavings"
          label="Show savings amount"
          defaultChecked={config.showSavings}
        />
      </s-section>

      {/* Buttons */}
      <s-section heading="Buttons">
        <s-text-field
          name="acceptButtonText"
          label="Accept button text"
          defaultValue={config.acceptButtonText}
        />
        <s-color-field
          name="acceptButtonColor"
          label="Accept button color"
          defaultValue={config.acceptButtonColor}
        />
        <s-divider />
        <s-text-field
          name="declineButtonText"
          label="Decline button text"
          defaultValue={config.declineButtonText}
        />
        <s-color-field
          name="declineButtonColor"
          label="Decline button color"
          defaultValue={config.declineButtonColor}
        />
        <s-divider />
        <s-select
          name="closeButtonBehavior"
          label="Close (X) button behavior"
          value={form.closeButtonBehavior}
        >
          <s-option value="decline">Same as Decline (dismiss offer)</s-option>
          <s-option value="close">Just close the popup</s-option>
        </s-select>
      </s-section>

      {/* Live preview */}
      <s-section slot="aside" heading="Live preview">
        <s-stack direction="block" gap="base">
          <s-button-group>
            {["desktop", "tablet", "mobile"].map((d) => (
              <s-button
                key={d}
                variant={device === d ? "primary" : "secondary"}
                onClick={() => setDevice(d)}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </s-button>
            ))}
          </s-button-group>
          <PopupPreview form={form} product={product} device={device} />
        </s-stack>
      </s-section>
    </s-page>
  );
}

function ProductPickerRow({ product, onPick }) {
  return (
    <s-stack direction="block" gap="base">
      {product ? (
        <s-stack direction="inline" gap="base" alignItems="center">
          {product.image ? (
            <s-thumbnail src={product.image} alt={product.title ?? ""} size="large" />
          ) : null}
          <s-stack direction="block" gap="none">
            <s-text type="strong">{product.title}</s-text>
            <s-stack direction="inline" gap="tight">
              {product.price ? <s-text>{product.price}</s-text> : null}
              {product.compareAtPrice ? (
                <s-text type="small">was {product.compareAtPrice}</s-text>
              ) : null}
            </s-stack>
          </s-stack>
        </s-stack>
      ) : (
        <s-paragraph>
          No product selected yet. Choose the product to offer in the popup.
        </s-paragraph>
      )}
      <s-button onClick={onPick}>
        {product ? "Change product" : "Select product"}
      </s-button>
    </s-stack>
  );
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

function PopupPreview({ form, product, device }) {
  const frameWidth =
    device === "mobile" ? 340 : device === "tablet" ? 480 : 620;
  const popupMaxWidth = device === "mobile" ? 300 : 420;
  const font = FONT_STACKS[form.fontFamily] || FONT_STACKS.system;
  const pricing = previewPricing(product, form.showCompareAt, form.showSavings);
  const imgPx = IMAGE_SIZE_PX[form.imageSize] || 140;
  const centered = form.themeVariant === "bold";
  const mins = String(
    Math.max(1, Number.parseInt(form.countdownMinutes, 10) || 10),
  ).padStart(2, "0");

  return (
    <div
      style={{
        background: "#f6f6f7",
        padding: "16px",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          width: frameWidth,
          maxWidth: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: popupMaxWidth,
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
                flexDirection: device === "mobile" ? "column" : "row",
                textAlign: device === "mobile" ? "center" : "left",
              }}
            >
              {product?.image ? (
                <img
                  src={product.image}
                  alt={product.title || ""}
                  style={{
                    width: imgPx,
                    height: imgPx,
                    objectFit: form.imageFit,
                    borderRadius: 8,
                    flex: "0 0 auto",
                  }}
                />
              ) : (
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
                  }}
                >
                  No image
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {product?.title || "Select a product"}
                </div>
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
                      fontWeight: 600,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    You save {pricing.savings}
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
                  borderRadius: 8,
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

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
