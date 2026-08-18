// Local presentational helpers below take plain props; this project doesn't use
// the prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getOfferConfig, saveOfferConfig } from "../models/offer.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await getOfferConfig(session.shop);
  return { config };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const get = (k) => form.get(k);

  const saved = await saveOfferConfig(session.shop, {
    // Main offer
    enabled: get("enabled") === "true",
    productId: get("productId"),
    variantId: get("variantId"),
    productTitle: get("productTitle"),
    productImage: get("productImage"),
    productPrice: get("productPrice"),
    productCompareAtPrice: get("productCompareAtPrice"),
    discountType: get("discountType"),
    discountValue: get("discountValue"),
    headline: get("headline"),
    description: get("description"),
    countdownEnabled: get("countdownEnabled") === "true",
    countdownMinutes: get("countdownMinutes"),
    acceptButtonText: get("acceptButtonText"),
    declineButtonText: get("declineButtonText"),
    // Downsell offer
    downsellEnabled: get("downsellEnabled") === "true",
    downsellProductId: get("downsellProductId"),
    downsellVariantId: get("downsellVariantId"),
    downsellProductTitle: get("downsellProductTitle"),
    downsellProductImage: get("downsellProductImage"),
    downsellProductPrice: get("downsellProductPrice"),
    downsellProductCompareAtPrice: get("downsellProductCompareAtPrice"),
    downsellDiscountType: get("downsellDiscountType"),
    downsellDiscountValue: get("downsellDiscountValue"),
    downsellHeadline: get("downsellHeadline"),
    downsellDescription: get("downsellDescription"),
    downsellAcceptButtonText: get("downsellAcceptButtonText"),
    downsellDeclineButtonText: get("downsellDeclineButtonText"),
  });

  return { ok: true, config: saved };
};

// Normalizes the various shapes App Bridge's resource picker can return.
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

/**
 * Display-only price calculation for the live preview. The server
 * (`offer.server.js`) is the authoritative source; this mirrors its rules just
 * so the preview updates as the merchant edits.
 */
function previewPricing(product, discountType, discountValueRaw) {
  if (!product?.price) return null;
  const price = Number.parseFloat(product.price);
  if (!Number.isFinite(price)) return null;

  const dv = Number.parseFloat(discountValueRaw);
  let finalPrice = price;
  if (discountType === "percentage" && Number.isFinite(dv) && dv > 0) {
    finalPrice = price * (1 - dv / 100);
  } else if (discountType === "fixed" && Number.isFinite(dv)) {
    finalPrice = dv;
  }
  finalPrice = Number.parseFloat(finalPrice.toFixed(2));

  const compareAt = Number.parseFloat(product.compareAtPrice);
  let compareAtPrice = null;
  let savings = null;
  if (Number.isFinite(compareAt) && compareAt > finalPrice) {
    compareAtPrice = compareAt.toFixed(2);
    savings = (compareAt - finalPrice).toFixed(2);
  }

  return { finalPrice: finalPrice.toFixed(2), compareAtPrice, savings };
}

const SWITCH_FIELDS = new Set([
  "enabled",
  "countdownEnabled",
  "downsellEnabled",
]);

export default function OfferSettings() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // Reactive mirror of every text/select/number/switch field, so the live
  // preview and status badge update as the merchant edits. Fields themselves
  // stay uncontrolled (defaultValue/defaultChecked) to avoid cursor jumps; this
  // state is kept in sync by a delegated change/input listener on the page.
  const [form, setForm] = useState(() => ({
    enabled: Boolean(config.enabled),
    discountType: config.discountType || "none",
    discountValue: config.discountValue ?? "",
    headline: config.headline ?? "",
    description: config.description ?? "",
    countdownEnabled: Boolean(config.countdownEnabled),
    countdownMinutes: config.countdownMinutes ?? 10,
    acceptButtonText: config.acceptButtonText ?? "",
    declineButtonText: config.declineButtonText ?? "",
    downsellEnabled: Boolean(config.downsellEnabled),
    downsellDiscountType: config.downsellDiscountType || "none",
    downsellDiscountValue: config.downsellDiscountValue ?? "",
    downsellHeadline: config.downsellHeadline ?? "",
    downsellDescription: config.downsellDescription ?? "",
    downsellAcceptButtonText: config.downsellAcceptButtonText ?? "",
    downsellDeclineButtonText: config.downsellDeclineButtonText ?? "",
  }));

  const [mainProduct, setMainProduct] = useState(
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
  const [downsellProduct, setDownsellProduct] = useState(
    config.downsellVariantId
      ? {
          productId: config.downsellProductId,
          variantId: config.downsellVariantId,
          title: config.downsellProductTitle,
          image: config.downsellProductImage,
          price: config.downsellProductPrice,
          compareAtPrice: config.downsellProductCompareAtPrice,
        }
      : null,
  );

  // Which collapsible sections are expanded. Collapsing hides via s-box display
  // (not unmount), so the uncontrolled inputs keep any unsaved edits.
  const [open, setOpen] = useState({
    product: true,
    pricing: false,
    timer: false,
    content: false,
    downsell: false,
    performance: false,
  });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const pageRef = useRef(null);
  const saving = fetcher.state !== "idle";

  // Delegated listener: web components bubble native change/input events that
  // React's synthetic onChange doesn't reliably catch, so we mirror them here.
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
      setForm((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    return () => {
      el.removeEventListener("input", handler);
      el.removeEventListener("change", handler);
    };
    // form keys are stable; we only need to attach once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Offer settings saved");
    }
  }, [fetcher.data, shopify]);

  async function pickProduct(which) {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (!selection || selection.length === 0) return;
    const product = toSelectedProduct(selection[0]);
    if (which === "downsell") setDownsellProduct(product);
    else setMainProduct(product);
  }

  function save() {
    if (form.enabled && !mainProduct?.variantId) {
      shopify.toast.show("Select a main offer product before enabling", {
        isError: true,
      });
      return;
    }
    if (form.downsellEnabled && !downsellProduct?.variantId) {
      shopify.toast.show("Select a downsell product before enabling it", {
        isError: true,
      });
      return;
    }

    fetcher.submit(
      {
        enabled: String(form.enabled),
        productId: mainProduct?.productId ?? "",
        variantId: mainProduct?.variantId ?? "",
        productTitle: mainProduct?.title ?? "",
        productImage: mainProduct?.image ?? "",
        productPrice: mainProduct?.price ?? "",
        productCompareAtPrice: mainProduct?.compareAtPrice ?? "",
        discountType: form.discountType,
        discountValue: String(form.discountValue ?? ""),
        headline: form.headline,
        description: form.description,
        countdownEnabled: String(form.countdownEnabled),
        countdownMinutes: String(form.countdownMinutes ?? ""),
        acceptButtonText: form.acceptButtonText,
        declineButtonText: form.declineButtonText,
        downsellEnabled: String(form.downsellEnabled),
        downsellProductId: downsellProduct?.productId ?? "",
        downsellVariantId: downsellProduct?.variantId ?? "",
        downsellProductTitle: downsellProduct?.title ?? "",
        downsellProductImage: downsellProduct?.image ?? "",
        downsellProductPrice: downsellProduct?.price ?? "",
        downsellProductCompareAtPrice: downsellProduct?.compareAtPrice ?? "",
        downsellDiscountType: form.downsellDiscountType,
        downsellDiscountValue: String(form.downsellDiscountValue ?? ""),
        downsellHeadline: form.downsellHeadline,
        downsellDescription: form.downsellDescription,
        downsellAcceptButtonText: form.downsellAcceptButtonText,
        downsellDeclineButtonText: form.downsellDeclineButtonText,
      },
      { method: "POST" },
    );
  }

  const isLive = form.enabled && Boolean(mainProduct?.variantId);
  const preview = previewPricing(
    mainProduct,
    form.discountType,
    form.discountValue,
  );

  return (
    <s-page ref={pageRef} inlineSize="large" heading="Post-purchase offer">
      <s-button
        slot="primary-action"
        onClick={save}
        {...(saving ? { loading: true } : {})}
      >
        Save
      </s-button>

      {/* Status — full width above the two-pane editor */}
      <s-section>
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge
              tone={isLive ? "success" : "neutral"}
              icon={isLive ? "check-circle" : "disabled"}
            >
              {isLive ? "Offer is Live" : "Offer is Off"}
            </s-badge>
            <s-switch
              name="enabled"
              label="Enable post-purchase offer"
              defaultChecked={config.enabled}
              details="When off, buyers go straight to the Thank You page."
            />
          </s-stack>
        </s-stack>
      </s-section>

      {/* Split-panel editor: collapsible controls (left) + live preview (right) */}
      <s-grid
        gridTemplateColumns="minmax(0, 360px) minmax(0, 1fr)"
        gap="base"
        alignItems="start"
      >
        {/* Left: collapsible control sections */}
        <s-grid-item>
          <s-stack direction="block" gap="base">
            <CollapsibleCard
              icon="product"
              title="Product & image"
              open={open.product}
              onToggle={() => toggle("product")}
            >
              <s-badge tone="info" icon="cart-sale">
                Step 1 · Shown first
              </s-badge>
              <ProductPickerRow
                product={mainProduct}
                onPick={() => pickProduct("main")}
                emptyText="Choose the product offered right after checkout."
              />
            </CollapsibleCard>

            <CollapsibleCard
              icon="discount"
              title="Pricing"
              open={open.pricing}
              onToggle={() => toggle("pricing")}
            >
              <s-select
                name="discountType"
                label="Price adjustment"
                value={form.discountType}
              >
                <s-option value="none">
                  Use the product&apos;s regular price
                </s-option>
                <s-option value="percentage">Percentage discount</s-option>
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
            </CollapsibleCard>

            <CollapsibleCard
              icon="clock"
              title="Timer"
              open={open.timer}
              onToggle={() => toggle("timer")}
            >
              <s-switch
                name="countdownEnabled"
                label="Show countdown timer"
                defaultChecked={config.countdownEnabled}
                details="A visual urgency bar above the offer. Resets each page load; never expires the offer."
              />
              <s-number-field
                name="countdownMinutes"
                label="Countdown length (minutes)"
                defaultValue={config.countdownMinutes ?? 10}
                min="1"
              />
            </CollapsibleCard>

            <CollapsibleCard
              icon="text"
              title="Content & buttons"
              open={open.content}
              onToggle={() => toggle("content")}
            >
              <s-text-field
                name="headline"
                label="Headline"
                defaultValue={config.headline}
              />
              <s-text-area
                name="description"
                label="Description"
                defaultValue={config.description}
                rows="2"
              />
              <s-text-field
                name="acceptButtonText"
                label="Accept button text"
                defaultValue={config.acceptButtonText}
              />
              <s-text-field
                name="declineButtonText"
                label="Decline button text"
                defaultValue={config.declineButtonText}
              />
            </CollapsibleCard>

            <CollapsibleCard
              icon="cart-down"
              title="Downsell (if declined)"
              open={open.downsell}
              onToggle={() => toggle("downsell")}
            >
              <s-badge tone="warning" icon="cart-down">
                Step 2 · If declined
              </s-badge>
              <s-switch
                name="downsellEnabled"
                label="Enable downsell"
                defaultChecked={config.downsellEnabled}
                details="When off, declining the main offer goes straight to the Thank You page."
              />
              <ProductPickerRow
                product={downsellProduct}
                onPick={() => pickProduct("downsell")}
                emptyText="Choose the fallback product shown after a decline."
              />
              <s-divider />
              <s-select
                name="downsellDiscountType"
                label="Price adjustment"
                value={form.downsellDiscountType}
              >
                <s-option value="none">
                  Use the product&apos;s regular price
                </s-option>
                <s-option value="percentage">Percentage discount</s-option>
                <s-option value="fixed">Fixed override price</s-option>
              </s-select>
              {form.downsellDiscountType !== "none" ? (
                <s-number-field
                  name="downsellDiscountValue"
                  label={
                    form.downsellDiscountType === "percentage"
                      ? "Discount percentage"
                      : "Override price"
                  }
                  defaultValue={config.downsellDiscountValue ?? ""}
                  min="0"
                  {...(form.downsellDiscountType === "percentage"
                    ? { suffix: "%", max: "100" }
                    : {})}
                />
              ) : null}
              <s-divider />
              <s-text-field
                name="downsellHeadline"
                label="Headline"
                defaultValue={config.downsellHeadline}
              />
              <s-text-area
                name="downsellDescription"
                label="Description"
                defaultValue={config.downsellDescription}
                rows="2"
              />
              <s-text-field
                name="downsellAcceptButtonText"
                label="Accept button text"
                defaultValue={config.downsellAcceptButtonText}
              />
              <s-text-field
                name="downsellDeclineButtonText"
                label="Decline button text"
                defaultValue={config.downsellDeclineButtonText}
              />
            </CollapsibleCard>

            <CollapsibleCard
              icon="chart-vertical"
              title="Performance"
              open={open.performance}
              onToggle={() => toggle("performance")}
            >
              <StatRow accentTone="info" />
            </CollapsibleCard>
          </s-stack>
        </s-grid-item>

        {/* Right: live preview (sticky) */}
        <s-grid-item>
          <div style={{ position: "sticky", top: 0 }}>
            <s-section heading="Live preview">
              <OfferPreview
                product={mainProduct}
                pricing={preview}
                headline={form.headline}
                description={form.description}
                acceptText={form.acceptButtonText}
                declineText={form.declineButtonText}
                countdownEnabled={form.countdownEnabled}
                countdownMinutes={form.countdownMinutes}
              />
              {form.downsellEnabled && downsellProduct ? (
                <s-stack direction="block" gap="tight">
                  <s-divider />
                  <s-stack direction="inline" gap="tight" alignItems="center">
                    <s-icon type="arrow-down" tone="warning" />
                    <s-badge tone="warning" icon="cart-down">
                      Step 2 · Downsell
                    </s-badge>
                  </s-stack>
                  <s-text type="small">
                    If the main offer is declined, “{downsellProduct.title}” is
                    shown next.
                  </s-text>
                </s-stack>
              ) : null}
            </s-section>
          </div>
        </s-grid-item>
      </s-grid>
    </s-page>
  );
}

// Accordion card: an s-section whose body is toggled with `s-box display`. The
// body is hidden (not unmounted) so uncontrolled inputs keep their edited values.
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

// Stat labels mirror RevLift's funnels metrics shown in revlift.mp4
// (Views, Conversion, Revenue, Rev/Visit). Values are placeholders until
// analytics tracking is added.
const STAT_TILES = [
  { label: "Views", icon: "view" },
  { label: "Conversion", icon: "chart-line" },
  { label: "Revenue", icon: "cash-dollar" },
  { label: "Rev/Visit", icon: "chart-vertical" },
];

// Placeholder dashboard metrics — real analytics tracking isn't wired yet, so
// each shows an em dash. The "Coming soon" caption makes clear these aren't
// broken values.
function StatRow({ accentTone }) {
  return (
    <s-stack direction="block" gap="tight">
      <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
        {STAT_TILES.map((stat) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            icon={stat.icon}
            tone={accentTone}
          />
        ))}
      </s-grid>
      <s-stack direction="inline" gap="tight" alignItems="center">
        <s-badge tone="info" icon="clock">
          Coming soon
        </s-badge>
        <s-text type="small">
          Live stats will appear here once tracking is added.
        </s-text>
      </s-stack>
    </s-stack>
  );
}

function StatTile({ label, icon, tone }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="none">
        <s-stack direction="inline" gap="tight" alignItems="center">
          <s-icon type={icon} tone={tone} />
          <s-text type="small">{label}</s-text>
        </s-stack>
        <s-text type="strong">—</s-text>
      </s-stack>
    </s-box>
  );
}

function ProductPickerRow({ product, onPick, emptyText }) {
  return (
    <s-stack direction="block" gap="base">
      {product ? (
        <s-stack direction="inline" gap="base" alignItems="center">
          {product.image ? (
            <s-thumbnail
              src={product.image}
              alt={product.title ?? ""}
              size="large"
            />
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
        <s-paragraph>{emptyText}</s-paragraph>
      )}
      <s-button onClick={onPick}>
        {product ? "Change product" : "Select product"}
      </s-button>
    </s-stack>
  );
}

function OfferPreview({
  product,
  pricing,
  headline,
  description,
  acceptText,
  declineText,
  countdownEnabled,
  countdownMinutes,
}) {
  if (!product) {
    return (
      <s-paragraph>Select a main offer product to preview it here.</s-paragraph>
    );
  }

  const mins = String(Math.max(1, Number.parseInt(countdownMinutes, 10) || 10))
    .toString()
    .padStart(2, "0");

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="base">
        {countdownEnabled ? (
          <s-banner tone="critical">
            <s-text type="strong">Special Offer Ends In: {mins}:00</s-text>
          </s-banner>
        ) : null}

        {headline ? <s-heading>{headline}</s-heading> : null}
        {description ? <s-paragraph>{description}</s-paragraph> : null}

        {product.image ? (
          <s-thumbnail
            src={product.image}
            alt={product.title ?? ""}
            size="large-500"
          />
        ) : null}

        <s-text type="strong">{product.title}</s-text>

        {pricing ? (
          <s-stack direction="block" gap="none">
            <s-stack direction="inline" gap="tight" alignItems="center">
              {pricing.compareAtPrice ? (
                <s-text type="redundant">{pricing.compareAtPrice}</s-text>
              ) : null}
              <s-text type="strong">{pricing.finalPrice}</s-text>
            </s-stack>
            {pricing.savings ? (
              <s-badge tone="success">You save {pricing.savings}</s-badge>
            ) : null}
          </s-stack>
        ) : null}

        <s-stack direction="block" gap="tight">
          <s-button variant="primary">{acceptText || "Accept"}</s-button>
          <s-button variant="tertiary">{declineText || "Decline"}</s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
