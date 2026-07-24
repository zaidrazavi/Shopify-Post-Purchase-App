import prisma from "../db.server";

/**
 * Shared read/write + shaping logic for the merchant-configured post-purchase
 * offer. Used by the admin settings page and by the checkout-facing API routes
 * (`/api/offer`, `/api/sign-changeset`) so the offer is defined in exactly one
 * place.
 */

export const DISCOUNT_TYPES = ["none", "percentage", "fixed"];

const DEFAULT_CONFIG = {
  enabled: false,
  productId: null,
  variantId: null,
  productTitle: null,
  productImage: null,
  productPrice: null,
  discountType: "none",
  discountValue: null,
  headline: "Wait — one more thing!",
  description: "Add this to your order before you go.",
};

/** Returns the shop's saved config, or sensible defaults if none exists yet. */
export async function getOfferConfig(shop) {
  const config = await prisma.offerConfig.findUnique({ where: { shop } });
  return config ?? { shop, ...DEFAULT_CONFIG };
}

/** Coerces raw form input into a clean record and upserts it for the shop. */
export async function saveOfferConfig(shop, input) {
  const data = normalizeInput(input);
  return prisma.offerConfig.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

function normalizeInput(input) {
  const discountType = DISCOUNT_TYPES.includes(input.discountType)
    ? input.discountType
    : "none";

  let discountValue = null;
  if (discountType !== "none") {
    const parsed = Number.parseFloat(input.discountValue);
    discountValue = Number.isFinite(parsed) ? parsed : null;
  }

  const str = (v) => {
    if (v === undefined || v === null) return null;
    const trimmed = String(v).trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    enabled: Boolean(input.enabled),
    productId: str(input.productId),
    variantId: str(input.variantId),
    productTitle: str(input.productTitle),
    productImage: str(input.productImage),
    productPrice: str(input.productPrice),
    discountType,
    discountValue,
    headline: str(input.headline) ?? DEFAULT_CONFIG.headline,
    description: str(input.description) ?? DEFAULT_CONFIG.description,
  };
}

/** True when the offer is switched on and points at a real variant. */
export function isOfferReady(config) {
  return Boolean(config.enabled && config.variantId);
}

/**
 * Builds the post-purchase changeset `changes` array from the config. This is
 * the authoritative source for what gets added/discounted — the checkout API
 * routes derive it here rather than trusting anything from the extension.
 */
export function buildOfferChanges(config) {
  if (!config.variantId) return [];

  const change = {
    type: "add_variant",
    variantId: Number(config.variantId),
    quantity: 1,
  };

  const discount = buildDiscount(config);
  if (discount) change.discount = discount;

  return [change];
}

function buildDiscount(config) {
  const value = config.discountValue;
  if (value == null) return null;

  if (config.discountType === "percentage" && value > 0) {
    return {
      value,
      valueType: "percentage",
      title: `${value}% off`,
    };
  }

  if (config.discountType === "fixed") {
    // A fixed *override price* is expressed to the changeset as a fixed amount
    // off the real variant price.
    const price = Number.parseFloat(config.productPrice);
    if (Number.isFinite(price)) {
      const amountOff = Math.max(0, price - value);
      if (amountOff > 0) {
        return {
          value: Number(amountOff.toFixed(2)),
          valueType: "fixed_amount",
          title: "Special offer price",
        };
      }
    }
  }

  return null;
}

/** The price to show as a fallback before `calculateChangeset` resolves. */
export function offerDisplayPrice(config) {
  const price = Number.parseFloat(config.productPrice);
  if (!Number.isFinite(price)) return config.productPrice;

  if (config.discountType === "percentage" && config.discountValue > 0) {
    return (price * (1 - config.discountValue / 100)).toFixed(2);
  }
  if (config.discountType === "fixed" && config.discountValue != null) {
    return Number(config.discountValue).toFixed(2);
  }
  return price.toFixed(2);
}

/**
 * The payload sent to the extension (`/api/offer`). Includes everything the
 * offer page needs to render plus the authoritative `changes` for
 * `calculateChangeset`.
 */
export function buildOfferPayload(config) {
  return {
    enabled: isOfferReady(config),
    variantId: config.variantId ? Number(config.variantId) : null,
    quantity: 1,
    title: config.productTitle,
    image: config.productImage,
    price: offerDisplayPrice(config),
    headline: config.headline,
    description: config.description,
    changes: buildOfferChanges(config),
  };
}

function normalizeShopDomain(value) {
  if (!value) return null;
  let host = String(value).trim();
  try {
    // Handles values like "https://shop.myshopify.com/admin".
    host = new URL(host).host;
  } catch {
    host = host.replace(/^https?:\/\//, "").split("/")[0];
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(host) ? host : null;
}

/**
 * Resolves the shop domain for a checkout-authenticated request.
 *
 * The request's session token is validated by `authenticate.public.checkout`
 * (so we know it's a genuine Shopify post-purchase call for this app), but the
 * Shopify-issued post-purchase token only guarantees `sub`/`iat` — it may not
 * carry the shop. So we prefer the token's `dest`/`iss` when present and fall
 * back to the shop domain the extension sends from `inputData.shop.domain`.
 */
export function resolveShopDomain(sessionToken, fallbackShop) {
  return (
    normalizeShopDomain(sessionToken?.dest) ??
    normalizeShopDomain(sessionToken?.iss) ??
    normalizeShopDomain(fallbackShop)
  );
}
