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

  const saved = await saveOfferConfig(session.shop, {
    enabled: form.get("enabled") === "true",
    productId: form.get("productId"),
    variantId: form.get("variantId"),
    productTitle: form.get("productTitle"),
    productImage: form.get("productImage"),
    productPrice: form.get("productPrice"),
    productCompareAtPrice: form.get("productCompareAtPrice"),
    discountType: form.get("discountType"),
    discountValue: form.get("discountValue"),
    headline: form.get("headline"),
    description: form.get("description"),
    countdownEnabled: form.get("countdownEnabled") === "true",
    countdownMinutes: form.get("countdownMinutes"),
    acceptButtonText: form.get("acceptButtonText"),
    declineButtonText: form.get("declineButtonText"),
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

export default function OfferSettings() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

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
  const [discountType, setDiscountType] = useState(config.discountType || "none");

  const enabledRef = useRef(null);
  const discountTypeRef = useRef(null);
  const discountValueRef = useRef(null);
  const headlineRef = useRef(null);
  const descriptionRef = useRef(null);
  const countdownEnabledRef = useRef(null);
  const countdownMinutesRef = useRef(null);
  const acceptButtonTextRef = useRef(null);
  const declineButtonTextRef = useRef(null);

  const saving = fetcher.state !== "idle";

  // Web components emit native `change` events that React's synthetic `onChange`
  // doesn't reliably capture, so wire the reactive select via addEventListener.
  useEffect(() => {
    const el = discountTypeRef.current;
    if (!el) return undefined;
    const handler = (event) => setDiscountType(event.target.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Offer settings saved");
    }
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
    const enabled = Boolean(enabledRef.current?.checked);

    if (enabled && !product?.variantId) {
      shopify.toast.show("Select a product before enabling the offer", {
        isError: true,
      });
      return;
    }

    fetcher.submit(
      {
        enabled: String(enabled),
        productId: product?.productId ?? "",
        variantId: product?.variantId ?? "",
        productTitle: product?.title ?? "",
        productImage: product?.image ?? "",
        productPrice: product?.price ?? "",
        productCompareAtPrice: product?.compareAtPrice ?? "",
        discountType,
        discountValue: discountValueRef.current?.value ?? "",
        headline: headlineRef.current?.value ?? "",
        description: descriptionRef.current?.value ?? "",
        countdownEnabled: String(Boolean(countdownEnabledRef.current?.checked)),
        countdownMinutes: countdownMinutesRef.current?.value ?? "",
        acceptButtonText: acceptButtonTextRef.current?.value ?? "",
        declineButtonText: declineButtonTextRef.current?.value ?? "",
      },
      { method: "POST" },
    );
  }

  return (
    <s-page heading="Post-purchase offer">
      <s-button
        slot="primary-action"
        onClick={save}
        {...(saving ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Status">
        <s-switch
          ref={enabledRef}
          name="enabled"
          label="Enable post-purchase offer"
          defaultChecked={config.enabled}
          details="When off, buyers go straight to the Thank You page."
        />
      </s-section>

      <s-section heading="Offer product">
        {product ? (
          <s-stack direction="inline" gap="base" alignItems="center">
            {product.image ? (
              <s-thumbnail src={product.image} alt={product.title ?? ""} />
            ) : null}
            <s-stack direction="block" gap="none">
              <s-text>{product.title}</s-text>
              {product.price ? (
                <s-text tone="subdued">Regular price: {product.price}</s-text>
              ) : null}
              {product.compareAtPrice ? (
                <s-text tone="subdued">
                  Compare-at price: {product.compareAtPrice}
                </s-text>
              ) : null}
            </s-stack>
          </s-stack>
        ) : (
          <s-paragraph>
            No product selected yet. Choose the product to offer after checkout.
          </s-paragraph>
        )}
        <s-button onClick={pickProduct}>
          {product ? "Change product" : "Select product"}
        </s-button>
      </s-section>

      <s-section heading="Pricing">
        <s-select
          ref={discountTypeRef}
          name="discountType"
          label="Price adjustment"
          value={discountType}
        >
          <s-option value="none">Use the product&apos;s regular price</s-option>
          <s-option value="percentage">Percentage discount</s-option>
          <s-option value="fixed">Fixed override price</s-option>
        </s-select>

        {discountType !== "none" ? (
          <s-number-field
            ref={discountValueRef}
            name="discountValue"
            label={
              discountType === "percentage"
                ? "Discount percentage"
                : "Override price"
            }
            defaultValue={config.discountValue ?? ""}
            min="0"
            {...(discountType === "percentage"
              ? { suffix: "%", max: "100" }
              : {})}
            details={
              discountType === "percentage"
                ? "Percent off the regular price (0–100)."
                : "The total price the buyer pays for this item."
            }
          />
        ) : null}
      </s-section>

      <s-section heading="Urgency">
        <s-switch
          ref={countdownEnabledRef}
          name="countdownEnabled"
          label="Show countdown timer"
          defaultChecked={config.countdownEnabled}
          details="Displays a counting-down urgency bar above the offer. It's a visual nudge only — it resets each time the page loads and doesn't expire the offer."
        />
        <s-number-field
          ref={countdownMinutesRef}
          name="countdownMinutes"
          label="Countdown length (minutes)"
          defaultValue={config.countdownMinutes ?? 10}
          min="1"
          details="How many minutes the timer starts from."
        />
      </s-section>

      <s-section heading="Offer text">
        <s-text-field
          ref={headlineRef}
          name="headline"
          label="Headline"
          defaultValue={config.headline}
        />
        <s-text-area
          ref={descriptionRef}
          name="description"
          label="Description"
          defaultValue={config.description}
          rows="3"
        />
        <s-text-field
          ref={acceptButtonTextRef}
          name="acceptButtonText"
          label="Accept button text"
          defaultValue={config.acceptButtonText}
        />
        <s-text-field
          ref={declineButtonTextRef}
          name="declineButtonText"
          label="Decline button text"
          defaultValue={config.declineButtonText}
        />
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
