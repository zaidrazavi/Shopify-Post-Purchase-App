import prisma from "../db.server";

/**
 * Shared read/write + shaping logic for the merchant-configured post-purchase
 * offer. Used by the admin settings page and by the checkout-facing API routes
 * (`/api/offer`, `/api/sign-changeset`) so the offer is defined in exactly one
 * place.
 */

export const DISCOUNT_TYPES = ["none", "percentage", "fixed"];

/** Valid post-purchase steps the extension can request a changeset for. */
export const OFFER_KINDS = ["main", "downsell"];

const DEFAULT_ACCEPT_TEXT = "Add This Gift To My Order";
const DEFAULT_DECLINE_TEXT = "I'd rather pay full price";
const DEFAULT_HEADLINE = "Wait — one more thing!";
const DEFAULT_DESCRIPTION = "Add this to your order before you go.";
const DEFAULT_DOWNSELL_ACCEPT_TEXT = "Yes, Add This To My Order";
const DEFAULT_DOWNSELL_DECLINE_TEXT = "No thanks";
const DEFAULT_DOWNSELL_HEADLINE = "Hold on — how about this instead?";
const DEFAULT_DOWNSELL_DESCRIPTION = "A smaller add-on at a special price.";

const DEFAULT_CONFIG = {
  enabled: false,
  productId: null,
  variantId: null,
  productTitle: null,
  productImage: null,
  productPrice: null,
  productCompareAtPrice: null,
  discountType: "none",
  discountValue: null,
  headline: DEFAULT_HEADLINE,
  description: DEFAULT_DESCRIPTION,
  countdownEnabled: false,
  countdownMinutes: 10,
  acceptButtonText: DEFAULT_ACCEPT_TEXT,
  declineButtonText: DEFAULT_DECLINE_TEXT,
  downsellEnabled: false,
  downsellProductId: null,
  downsellVariantId: null,
  downsellProductTitle: null,
  downsellProductImage: null,
  downsellProductPrice: null,
  downsellProductCompareAtPrice: null,
  downsellDiscountType: "none",
  downsellDiscountValue: null,
  downsellHeadline: DEFAULT_DOWNSELL_HEADLINE,
  downsellDescription: DEFAULT_DOWNSELL_DESCRIPTION,
  downsellAcceptButtonText: DEFAULT_DOWNSELL_ACCEPT_TEXT,
  downsellDeclineButtonText: DEFAULT_DOWNSELL_DECLINE_TEXT,
  // Style / branding (admin preview only for now). Nullable — null = use defaults.
  bannerBackgroundColor: null,
  bannerTextColor: null,
  bannerIconColor: null,
  previewButtonColor: null,
  cardLayout: null,
};

export const CARD_LAYOUTS = ["horizontal", "vertical"];

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

const str = (v) => {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  return trimmed === "" ? null : trimmed;
};

function normDiscountType(v) {
  return DISCOUNT_TYPES.includes(v) ? v : "none";
}

function normDiscountValue(discountType, raw) {
  if (discountType === "none") return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// Accepts #RGB / #RRGGBB; anything else (including empty) becomes null.
function normColorOrNull(v) {
  const s = str(v);
  if (s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s.toUpperCase();
  return null;
}

function normalizeInput(input) {
  const discountType = normDiscountType(input.discountType);
  const downsellDiscountType = normDiscountType(input.downsellDiscountType);

  // Countdown minutes: whole number, at least 1, default 10.
  let countdownMinutes = Number.parseInt(input.countdownMinutes, 10);
  if (!Number.isFinite(countdownMinutes) || countdownMinutes < 1) {
    countdownMinutes = DEFAULT_CONFIG.countdownMinutes;
  }

  return {
    // Main offer
    enabled: Boolean(input.enabled),
    productId: str(input.productId),
    variantId: str(input.variantId),
    productTitle: str(input.productTitle),
    productImage: str(input.productImage),
    productPrice: str(input.productPrice),
    productCompareAtPrice: str(input.productCompareAtPrice),
    discountType,
    discountValue: normDiscountValue(discountType, input.discountValue),
    headline: str(input.headline) ?? DEFAULT_HEADLINE,
    description: str(input.description) ?? DEFAULT_DESCRIPTION,
    countdownEnabled: Boolean(input.countdownEnabled),
    countdownMinutes,
    acceptButtonText: str(input.acceptButtonText) ?? DEFAULT_ACCEPT_TEXT,
    declineButtonText: str(input.declineButtonText) ?? DEFAULT_DECLINE_TEXT,
    // Downsell offer
    downsellEnabled: Boolean(input.downsellEnabled),
    downsellProductId: str(input.downsellProductId),
    downsellVariantId: str(input.downsellVariantId),
    downsellProductTitle: str(input.downsellProductTitle),
    downsellProductImage: str(input.downsellProductImage),
    downsellProductPrice: str(input.downsellProductPrice),
    downsellProductCompareAtPrice: str(input.downsellProductCompareAtPrice),
    downsellDiscountType,
    downsellDiscountValue: normDiscountValue(
      downsellDiscountType,
      input.downsellDiscountValue,
    ),
    downsellHeadline: str(input.downsellHeadline) ?? DEFAULT_DOWNSELL_HEADLINE,
    downsellDescription:
      str(input.downsellDescription) ?? DEFAULT_DOWNSELL_DESCRIPTION,
    downsellAcceptButtonText:
      str(input.downsellAcceptButtonText) ?? DEFAULT_DOWNSELL_ACCEPT_TEXT,
    downsellDeclineButtonText:
      str(input.downsellDeclineButtonText) ?? DEFAULT_DOWNSELL_DECLINE_TEXT,
    // Style / branding (nullable)
    bannerBackgroundColor: normColorOrNull(input.bannerBackgroundColor),
    bannerTextColor: normColorOrNull(input.bannerTextColor),
    bannerIconColor: normColorOrNull(input.bannerIconColor),
    previewButtonColor: normColorOrNull(input.previewButtonColor),
    cardLayout: CARD_LAYOUTS.includes(input.cardLayout)
      ? input.cardLayout
      : null,
  };
}

/**
 * Extracts a single offer (main or downsell) from a stored config into one
 * normalized shape, so the shaping helpers below work the same for both.
 */
export function pickOffer(config, kind) {
  if (kind === "downsell") {
    return {
      kind: "downsell",
      enabled: Boolean(config.downsellEnabled),
      productId: config.downsellProductId ?? null,
      variantId: config.downsellVariantId ?? null,
      productTitle: config.downsellProductTitle ?? null,
      productImage: config.downsellProductImage ?? null,
      productPrice: config.downsellProductPrice ?? null,
      productCompareAtPrice: config.downsellProductCompareAtPrice ?? null,
      discountType: config.downsellDiscountType ?? "none",
      discountValue: config.downsellDiscountValue ?? null,
      headline: config.downsellHeadline ?? DEFAULT_DOWNSELL_HEADLINE,
      description: config.downsellDescription ?? DEFAULT_DOWNSELL_DESCRIPTION,
      acceptButtonText:
        config.downsellAcceptButtonText ?? DEFAULT_DOWNSELL_ACCEPT_TEXT,
      declineButtonText:
        config.downsellDeclineButtonText ?? DEFAULT_DOWNSELL_DECLINE_TEXT,
    };
  }

  return {
    kind: "main",
    enabled: Boolean(config.enabled),
    productId: config.productId ?? null,
    variantId: config.variantId ?? null,
    productTitle: config.productTitle ?? null,
    productImage: config.productImage ?? null,
    productPrice: config.productPrice ?? null,
    productCompareAtPrice: config.productCompareAtPrice ?? null,
    discountType: config.discountType ?? "none",
    discountValue: config.discountValue ?? null,
    headline: config.headline ?? DEFAULT_HEADLINE,
    description: config.description ?? DEFAULT_DESCRIPTION,
    acceptButtonText: config.acceptButtonText ?? DEFAULT_ACCEPT_TEXT,
    declineButtonText: config.declineButtonText ?? DEFAULT_DECLINE_TEXT,
  };
}

/** True when an offer is switched on and points at a real variant. */
export function isOfferReady(offer) {
  return Boolean(offer.enabled && offer.variantId);
}

/**
 * Builds the post-purchase changeset `changes` array for a normalized offer.
 * This is the authoritative source for what gets added/discounted — the
 * checkout API routes derive it here rather than trusting anything from the
 * extension.
 */
export function buildOfferChanges(offer) {
  if (!offer.variantId) return [];

  const change = {
    type: "add_variant",
    variantId: Number(offer.variantId),
    quantity: 1,
  };

  const discount = buildDiscount(offer);
  if (discount) change.discount = discount;

  return [change];
}

function buildDiscount(offer) {
  const value = offer.discountValue;
  if (value == null) return null;

  if (offer.discountType === "percentage" && value > 0) {
    return {
      value,
      valueType: "percentage",
      title: `${value}% off`,
    };
  }

  if (offer.discountType === "fixed") {
    // A fixed *override price* is expressed to the changeset as a fixed amount
    // off the real variant price.
    const price = Number.parseFloat(offer.productPrice);
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
export function offerDisplayPrice(offer) {
  const price = Number.parseFloat(offer.productPrice);
  if (!Number.isFinite(price)) return offer.productPrice;

  if (offer.discountType === "percentage" && offer.discountValue > 0) {
    return (price * (1 - offer.discountValue / 100)).toFixed(2);
  }
  if (offer.discountType === "fixed" && offer.discountValue != null) {
    return Number(offer.discountValue).toFixed(2);
  }
  return price.toFixed(2);
}

/**
 * Compare-at ("was") price and the savings vs the final offer price.
 *
 * Returns `{ compareAtPrice, savings }` as formatted strings when the offer has
 * a compare-at price that is higher than what the buyer will pay; otherwise both
 * are null and the extension falls back to showing just the final price.
 */
export function offerSavings(offer) {
  const compareAt = Number.parseFloat(offer.productCompareAtPrice);
  const finalPrice = Number.parseFloat(offerDisplayPrice(offer));

  if (!Number.isFinite(compareAt) || !Number.isFinite(finalPrice)) {
    return { compareAtPrice: null, savings: null };
  }

  const savings = compareAt - finalPrice;
  if (savings <= 0) {
    return { compareAtPrice: null, savings: null };
  }

  return {
    compareAtPrice: compareAt.toFixed(2),
    savings: savings.toFixed(2),
  };
}

/** Everything the extension needs to render one offer step. */
function offerView(offer) {
  const { compareAtPrice, savings } = offerSavings(offer);

  return {
    enabled: isOfferReady(offer),
    variantId: offer.variantId ? Number(offer.variantId) : null,
    quantity: 1,
    title: offer.productTitle,
    image: offer.productImage,
    price: offerDisplayPrice(offer),
    compareAtPrice,
    savings,
    headline: offer.headline,
    description: offer.description,
    acceptButtonText: offer.acceptButtonText,
    declineButtonText: offer.declineButtonText,
    changes: buildOfferChanges(offer),
  };
}

/**
 * The payload sent to the extension (`/api/offer`). The main offer's fields sit
 * at the top level (so `ShouldRender` can gate on `enabled`), and the optional
 * downsell is nested under `downsell` (null when it isn't ready). Both are
 * pre-fetched together so the extension never needs a network call to move from
 * the main step to the downsell step.
 */
export function buildOfferPayload(config) {
  const main = pickOffer(config, "main");
  const downsell = pickOffer(config, "downsell");
  const downsellView = isOfferReady(downsell) ? offerView(downsell) : null;

  return {
    ...offerView(main),
    countdownEnabled: Boolean(config.countdownEnabled),
    countdownMinutes: config.countdownMinutes ?? 10,
    downsell: downsellView,
    // Style values are carried through for future storefront use. The current
    // extension ignores them (remote-ui can't apply custom colors yet).
    style: {
      bannerBackgroundColor: config.bannerBackgroundColor ?? null,
      bannerTextColor: config.bannerTextColor ?? null,
      bannerIconColor: config.bannerIconColor ?? null,
      previewButtonColor: config.previewButtonColor ?? null,
      cardLayout: config.cardLayout ?? null,
    },
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
