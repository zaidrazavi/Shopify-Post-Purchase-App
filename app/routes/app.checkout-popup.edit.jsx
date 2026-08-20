// The live preview intentionally uses inline styles: it's a WYSIWYG render of
// the merchant's own custom colors/fonts/radius, which Polaris tokens can't
// express. The admin *controls* all use real Polaris web components.
// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPopupConfig, savePopupConfig } from "../models/pre-purchase-popup.server";
import { FONT_OPTIONS } from "../lib/popup-options";
import { DEVICES, PopupPreview } from "../components/popup-preview";

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
    // OCU-parity additions
    selectorsColor: get("selectorsColor"),
    elementsColor: get("elementsColor"),
    inheritStoreFont: get("inheritStoreFont") === "true",
    layout: get("layout"),
    allowSubscription: get("allowSubscription") === "true",
    hideIfCartHasSubscription: get("hideIfCartHasSubscription") === "true",
    imageBorder: get("imageBorder") === "true",
    autoselectVariant: get("autoselectVariant") === "true",
    hideQuantitySelector: get("hideQuantitySelector") === "true",
    predefinedQuantity: get("predefinedQuantity"),
    discountType: get("discountType"),
    discountValue: get("discountValue"),
    acceptButtonHoverColor: get("acceptButtonHoverColor"),
    declineButtonHoverColor: get("declineButtonHoverColor"),
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


const SWITCH_FIELDS = new Set([
  "enabled",
  "hideIfInCart",
  "headlineEnabled",
  "subheadlineEnabled",
  "descriptionEnabled",
  "countdownEnabled",
  "showCompareAt",
  "showSavings",
  "inheritStoreFont",
  "allowSubscription",
  "hideIfCartHasSubscription",
  "imageBorder",
  "autoselectVariant",
  "hideQuantitySelector",
]);

// Preview device modes. `width` is the real storefront pixel width the card is
// rendered at before being zoomed to fit the (narrower) preview panel — so
// proportions match the live popup rather than being squeezed.
export default function CheckoutPopupEditor() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

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
    // OCU-parity additions
    selectorsColor: config.selectorsColor || "#1A1A1A",
    elementsColor: config.elementsColor || "#E1E1E1",
    inheritStoreFont: Boolean(config.inheritStoreFont),
    layout: config.layout || "media-left",
    allowSubscription: Boolean(config.allowSubscription),
    hideIfCartHasSubscription: Boolean(config.hideIfCartHasSubscription),
    imageBorder: config.imageBorder !== false,
    autoselectVariant: config.autoselectVariant !== false,
    hideQuantitySelector: config.hideQuantitySelector !== false,
    predefinedQuantity: config.predefinedQuantity ?? 1,
    discountType: config.discountType || "none",
    discountValue: config.discountValue ?? "",
    acceptButtonHoverColor: config.acceptButtonHoverColor || "#C85A66",
    declineButtonHoverColor: config.declineButtonHoverColor || "#55585B",
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

  // Which accordion sections are expanded. General starts open (like OCU);
  // collapsing hides the body via `s-box display="none"` — it does NOT unmount,
  // so the uncontrolled `defaultValue` inputs keep any unsaved edits.
  const [open, setOpen] = useState({
    headline: true,
    subheadline: false,
    timer: false,
    product: false,
    details: false,
    pricing: false,
    buttons: false,
    display: false,
    settings: false,
  });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

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
        selectorsColor: form.selectorsColor,
        elementsColor: form.elementsColor,
        inheritStoreFont: String(form.inheritStoreFont),
        layout: form.layout,
        allowSubscription: String(form.allowSubscription),
        hideIfCartHasSubscription: String(form.hideIfCartHasSubscription),
        imageBorder: String(form.imageBorder),
        autoselectVariant: String(form.autoselectVariant),
        hideQuantitySelector: String(form.hideQuantitySelector),
        predefinedQuantity: String(form.predefinedQuantity ?? ""),
        discountType: form.discountType,
        discountValue: String(form.discountValue ?? ""),
        acceptButtonHoverColor: form.acceptButtonHoverColor,
        declineButtonHoverColor: form.declineButtonHoverColor,
      },
      { method: "POST" },
    );
  }

  return (
    <s-page ref={pageRef} inlineSize="large" heading="Edit checkout popup">
      <s-button
        slot="breadcrumb-actions"
        variant="tertiary"
        icon="arrow-left"
        onClick={() => navigate("/app/checkout-popup")}
      >
        Overview
      </s-button>
      <s-button
        slot="primary-action"
        onClick={save}
        {...(saving ? { loading: true } : {})}
      >
        Save
      </s-button>

      {/* OCU-style two-pane editor: collapsible controls (left) + preview (right) */}
      <s-grid
        gridTemplateColumns="minmax(0, 340px) minmax(0, 1fr)"
        gap="base"
        alignItems="start"
      >
        {/* Left: collapsible control sections */}
        <s-grid-item>
          <s-stack direction="block" gap="base">
            <CollapsibleCard
              icon="text-title"
              title="Headline"
              open={open.headline}
              onToggle={() => toggle("headline")}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="text-block"
              title="Sub-headline"
              open={open.subheadline}
              onToggle={() => toggle("subheadline")}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="clock"
              title="Timer Bar"
              open={open.timer}
              onToggle={() => toggle("timer")}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="product"
              title="Product & Image"
              open={open.product}
              onToggle={() => toggle("product")}
            >
              <ProductPickerRow product={product} onPick={pickProduct} />
              <s-divider />
              <s-select
                name="imageSize"
                label="Image size"
                value={form.imageSize}
              >
                <s-option value="small">Small</s-option>
                <s-option value="medium">Medium</s-option>
                <s-option value="large">Large</s-option>
              </s-select>
              <s-select name="imageFit" label="Image resizing" value={form.imageFit}>
                <s-option value="cover">Fill (cover &amp; crop)</s-option>
                <s-option value="contain">Fit (whole image)</s-option>
              </s-select>
              <s-switch
                name="imageBorder"
                label="Image border"
                defaultChecked={config.imageBorder !== false}
              />
              <s-switch
                name="autoselectVariant"
                label="Autoselect variant"
                defaultChecked={config.autoselectVariant !== false}
              />
              <s-divider />
              <s-switch
                name="hideQuantitySelector"
                label="Hide quantity selector"
                defaultChecked={config.hideQuantitySelector !== false}
              />
              <s-number-field
                name="predefinedQuantity"
                label="Predefined quantity"
                defaultValue={config.predefinedQuantity ?? 1}
                min="1"
              />
            </CollapsibleCard>

            <CollapsibleCard
              icon="product-list"
              title="Product Details"
              open={open.details}
              onToggle={() => toggle("details")}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="cash-dollar"
              title="Pricing"
              open={open.pricing}
              onToggle={() => toggle("pricing")}
            >
              <s-select
                name="discountType"
                label="Discount"
                value={form.discountType}
              >
                <s-option value="none">No discount (use product price)</s-option>
                <s-option value="percentage">Percentage off</s-option>
                <s-option value="fixed">Fixed override price</s-option>
              </s-select>
              {form.discountType !== "none" ? (
                <s-number-field
                  name="discountValue"
                  label={
                    form.discountType === "percentage"
                      ? "Discount percentage"
                      : "Override price"
                  }
                  defaultValue={config.discountValue ?? ""}
                  min="0"
                  {...(form.discountType === "percentage"
                    ? { suffix: "%", max: "100" }
                    : {})}
                />
              ) : null}
              <s-text type="small">
                The discounted price is shown in the popup. The item is still
                added at its real price at checkout unless a matching Shopify
                discount is configured.
              </s-text>
              <s-divider />
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="button"
              title="Buttons"
              open={open.buttons}
              onToggle={() => toggle("buttons")}
            >
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
              <s-color-field
                name="acceptButtonHoverColor"
                label="Accept button hover state"
                defaultValue={config.acceptButtonHoverColor || "#C85A66"}
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
              <s-color-field
                name="declineButtonHoverColor"
                label="Decline button hover state"
                defaultValue={config.declineButtonHoverColor || "#55585B"}
              />
              <s-divider />
              <s-select
                name="closeButtonBehavior"
                label="Close (X) button behavior"
                value={form.closeButtonBehavior}
              >
                <s-option value="decline">
                  Same as Decline (dismiss offer)
                </s-option>
                <s-option value="close">Just close the popup</s-option>
              </s-select>
            </CollapsibleCard>

            <CollapsibleCard
              icon="view"
              title="Display Offer"
              open={open.display}
              onToggle={() => toggle("display")}
            >
              <s-switch
                name="hideIfInCart"
                label="Hide offer if the cart already contains the upsell product"
                defaultChecked={config.hideIfInCart}
              />
              <s-switch
                name="allowSubscription"
                label="Allow subscription option"
                defaultChecked={config.allowSubscription === true}
                details="Stored for a future subscription purchase flow."
              />
              <s-switch
                name="hideIfCartHasSubscription"
                label="Hide offer if the cart has subscription products"
                defaultChecked={config.hideIfCartHasSubscription === true}
              />
              <s-text type="strong">Trigger</s-text>
              <s-paragraph>
                Shown when the buyer clicks Checkout in the cart. (Product-page
                triggers are out of scope for now.)
              </s-paragraph>
            </CollapsibleCard>

            <CollapsibleCard
              icon="paint-brush-flat"
              title="General"
              open={open.settings}
              onToggle={() => toggle("settings")}
            >
              <s-switch
                name="inheritStoreFont"
                label="Inherit store font"
                defaultChecked={config.inheritStoreFont === true}
                details="Use the theme's font instead of the one below."
              />
              <s-select
                name="fontFamily"
                label="Font family"
                value={form.fontFamily}
              >
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
              <s-color-field
                name="selectorsColor"
                label="Selectors color"
                defaultValue={config.selectorsColor || "#1A1A1A"}
              />
              <s-color-field
                name="elementsColor"
                label="Elements color"
                defaultValue={config.elementsColor || "#E1E1E1"}
              />
              <s-select
                name="themeVariant"
                label="Theme"
                value={form.themeVariant}
              >
                <s-option value="classic">Classic (left-aligned)</s-option>
                <s-option value="bold">Modern (centered)</s-option>
              </s-select>
              <s-select name="layout" label="Layout" value={form.layout}>
                <s-option value="media-left">Image left</s-option>
                <s-option value="media-right">Image right</s-option>
                <s-option value="media-top">Image on top</s-option>
                <s-option value="text-only">Text only (no image)</s-option>
              </s-select>
              <s-number-field
                name="cornerRadius"
                label="Corner radius"
                defaultValue={config.cornerRadius ?? 12}
                min="0"
                max="40"
                suffix="px"
              />
            </CollapsibleCard>
          </s-stack>
        </s-grid-item>

        {/* Right: live preview with device top-bar */}
        <s-grid-item>
          <div style={{ position: "sticky", top: 0 }}>
            <s-section heading="Live preview">
              <s-stack direction="block" gap="base">
                <s-stack
                  direction="inline"
                  gap="tight"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <s-text type="strong">
                    {DEVICES.find((d) => d.id === device)?.label} preview
                  </s-text>
                  <s-stack direction="inline" gap="tight" alignItems="center">
                    {DEVICES.map((d) => (
                      <s-button
                        key={d.id}
                        icon={d.icon}
                        accessibilityLabel={`${d.label} preview`}
                        variant={device === d.id ? "primary" : "tertiary"}
                        onClick={() => setDevice(d.id)}
                      />
                    ))}
                  </s-stack>
                </s-stack>
                <PopupPreview form={form} product={product} device={device} />
              </s-stack>
            </s-section>
          </div>
        </s-grid-item>
      </s-grid>
    </s-page>
  );
}

// Accordion card: an s-section whose body is toggled with `s-box display`.
// Uses a full-width s-clickable header (icon + title + chevron). The body is
// hidden, not unmounted, so uncontrolled inputs keep their edited values.
function CollapsibleCard({ icon, title, open, onToggle, children }) {
  return (
    <s-section padding="none">
      <s-clickable
        onClick={onToggle}
        padding="base"
        accessibilityLabel={`${open ? "Collapse" : "Expand"} ${title}`}
        style={{ display: "block", width: "100%" }}
      >
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-icon type={icon} tone="neutral" />
            <s-text type="strong">{title}</s-text>
          </s-stack>
          <s-icon type={open ? "chevron-up" : "chevron-down"} tone="neutral" />
        </s-stack>
      </s-clickable>
      <s-box
        display={open ? "auto" : "none"}
        paddingInline="base"
        paddingBlockEnd="base"
      >
        <s-stack direction="block" gap="base">
          <s-divider />
          {children}
        </s-stack>
      </s-box>
    </s-section>
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
                <s-text type="redundant">was {product.compareAtPrice}</s-text>
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

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
