import prisma from "../db.server";
import {
  CLOSE_BEHAVIORS,
  DISCOUNT_TYPES,
  FONT_STACKS,
  IMAGE_FITS,
  IMAGE_SIZES,
  POPUP_LAYOUTS,
  THEME_VARIANTS,
} from "../lib/popup-options";

/**
 * Read/write + shaping logic for the pre-purchase (cart/checkout-click) upsell
 * popup config. Completely separate from the post-purchase OfferConfig.
 *
 * Used by the admin overview/editor (app.checkout-popup.*.jsx) and the public API route
 * (api.pre-purchase-popup.jsx) that the storefront theme script fetches.
 */

export const DEFAULT_POPUP = {
  enabled: false,
  fontFamily: "system",
  fontColor: "#1A1A2E",
  backgroundColor: "#FFFFFF",
  themeVariant: "classic",
  cornerRadius: 14,
  hideIfInCart: true,
  headlineEnabled: true,
  headlineText: "Wait! Add this to your order",
  subheadlineEnabled: true,
  subheadlineText: "A special one-time offer, just for you.",
  descriptionEnabled: true,
  descriptionText:
    "This limited-time add-on is the perfect finishing touch for your order — grab it now before you check out.",
  countdownEnabled: true,
  countdownMinutes: 10,
  timerBackgroundColor: "#F8C9C9",
  productId: null,
  variantId: null,
  productTitle: null,
  productImage: null,
  productPrice: null,
  productCompareAtPrice: null,
  imageFit: "cover",
  imageSize: "medium",
  showCompareAt: true,
  showSavings: true,
  acceptButtonText: "Add to my order",
  acceptButtonColor: "#EF6E7B",
  declineButtonText: "No thanks",
  declineButtonColor: "#6D7175",
  closeButtonBehavior: "decline",
  // OCU-parity additions (null = use a sensible built-in default)
  selectorsColor: null,
  elementsColor: null,
  inheritStoreFont: false,
  layout: "media-left",
  allowSubscription: false,
  hideIfCartHasSubscription: false,
  imageBorder: true,
  autoselectVariant: true,
  hideQuantitySelector: true,
  predefinedQuantity: 1,
  discountType: "none",
  discountValue: null,
  acceptButtonHoverColor: null,
  declineButtonHoverColor: null,
};

/** Returns the shop's saved popup config, or defaults if none exists yet. */
export async function getPopupConfig(shop) {
  const config = await prisma.prePurchasePopupConfig.findUnique({
    where: { shop },
  });
  return config ?? { shop, ...DEFAULT_POPUP };
}

/** Coerces raw form input and upserts it for the shop. */
export async function savePopupConfig(shop, input) {
  const data = normalizeInput(input);
  return prisma.prePurchasePopupConfig.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

const str = (v, fallback = null) => {
  if (v === undefined || v === null) return fallback;
  const trimmed = String(v).trim();
  return trimmed === "" ? fallback : trimmed;
};

// Accepts #RGB / #RRGGBB; anything else falls back to the provided default.
function normColor(v, fallback) {
  const s = str(v);
  if (s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s.toUpperCase();
  return fallback;
}

// Like normColor but returns null (not a fallback) for unset/invalid — for the
// optional OCU color fields where null means "use a built-in default".
function normColorOrNull(v) {
  return normColor(v, null);
}

function normDiscountValue(discountType, raw) {
  if (discountType === "none") return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneOf(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeInput(input) {
  return {
    enabled: Boolean(input.enabled),
    fontFamily: FONT_STACKS[input.fontFamily] ? input.fontFamily : "system",
    fontColor: normColor(input.fontColor, DEFAULT_POPUP.fontColor),
    backgroundColor: normColor(
      input.backgroundColor,
      DEFAULT_POPUP.backgroundColor,
    ),
    themeVariant: oneOf(input.themeVariant, THEME_VARIANTS, "classic"),
    cornerRadius: clampInt(input.cornerRadius, 0, 40, DEFAULT_POPUP.cornerRadius),
    hideIfInCart: Boolean(input.hideIfInCart),
    headlineEnabled: Boolean(input.headlineEnabled),
    headlineText: str(input.headlineText, DEFAULT_POPUP.headlineText),
    subheadlineEnabled: Boolean(input.subheadlineEnabled),
    subheadlineText: str(input.subheadlineText, DEFAULT_POPUP.subheadlineText),
    descriptionEnabled: Boolean(input.descriptionEnabled),
    descriptionText: str(input.descriptionText, DEFAULT_POPUP.descriptionText),
    countdownEnabled: Boolean(input.countdownEnabled),
    countdownMinutes: clampInt(input.countdownMinutes, 1, 1440, 10),
    timerBackgroundColor: normColor(
      input.timerBackgroundColor,
      DEFAULT_POPUP.timerBackgroundColor,
    ),
    productId: str(input.productId),
    variantId: str(input.variantId),
    productTitle: str(input.productTitle),
    productImage: str(input.productImage),
    productPrice: str(input.productPrice),
    productCompareAtPrice: str(input.productCompareAtPrice),
    imageFit: oneOf(input.imageFit, IMAGE_FITS, "cover"),
    imageSize: oneOf(input.imageSize, IMAGE_SIZES, "medium"),
    showCompareAt: Boolean(input.showCompareAt),
    showSavings: Boolean(input.showSavings),
    acceptButtonText: str(input.acceptButtonText, DEFAULT_POPUP.acceptButtonText),
    acceptButtonColor: normColor(
      input.acceptButtonColor,
      DEFAULT_POPUP.acceptButtonColor,
    ),
    declineButtonText: str(
      input.declineButtonText,
      DEFAULT_POPUP.declineButtonText,
    ),
    declineButtonColor: normColor(
      input.declineButtonColor,
      DEFAULT_POPUP.declineButtonColor,
    ),
    closeButtonBehavior: oneOf(
      input.closeButtonBehavior,
      CLOSE_BEHAVIORS,
      "decline",
    ),
    // OCU-parity additions
    selectorsColor: normColorOrNull(input.selectorsColor),
    elementsColor: normColorOrNull(input.elementsColor),
    inheritStoreFont: Boolean(input.inheritStoreFont),
    layout: oneOf(input.layout, POPUP_LAYOUTS, "media-left"),
    allowSubscription: Boolean(input.allowSubscription),
    hideIfCartHasSubscription: Boolean(input.hideIfCartHasSubscription),
    imageBorder: Boolean(input.imageBorder),
    autoselectVariant: Boolean(input.autoselectVariant),
    hideQuantitySelector: Boolean(input.hideQuantitySelector),
    predefinedQuantity: clampInt(input.predefinedQuantity, 1, 999, 1),
    discountType: oneOf(input.discountType, DISCOUNT_TYPES, "none"),
    discountValue: normDiscountValue(
      oneOf(input.discountType, DISCOUNT_TYPES, "none"),
      input.discountValue,
    ),
    acceptButtonHoverColor: normColorOrNull(input.acceptButtonHoverColor),
    declineButtonHoverColor: normColorOrNull(input.declineButtonHoverColor),
  };
}

/**
 * Final display price + compare-at + savings, honoring the discount and the show
 * toggles.
 *
 * NOTE: the discounted price is DISPLAY-ONLY. The storefront still adds the
 * product to the cart at its real Shopify price, so charging a discount requires
 * a matching Shopify automatic discount / discount code (a separate integration).
 */
export function popupPricing(config) {
  const basePrice = Number.parseFloat(config.productPrice);
  if (!Number.isFinite(basePrice)) {
    return {
      finalPrice: config.productPrice ?? null,
      compareAtPrice: null,
      savings: null,
    };
  }

  const dv = Number.parseFloat(config.discountValue);
  let finalPrice = basePrice;
  if (config.discountType === "percentage" && Number.isFinite(dv) && dv > 0) {
    finalPrice = basePrice * (1 - dv / 100);
  } else if (config.discountType === "fixed" && Number.isFinite(dv) && dv >= 0) {
    finalPrice = dv;
  }
  finalPrice = Math.max(0, finalPrice);

  // The "was" price to strike through: the product's compare-at when higher than
  // the final price, otherwise the base price when a discount lowered it.
  const productCompareAt = Number.parseFloat(config.productCompareAtPrice);
  let original = null;
  if (Number.isFinite(productCompareAt) && productCompareAt > finalPrice) {
    original = productCompareAt;
  } else if (finalPrice < basePrice) {
    original = basePrice;
  }

  const showCompare = Boolean(config.showCompareAt) && original != null;
  return {
    finalPrice: finalPrice.toFixed(2),
    compareAtPrice: showCompare ? original.toFixed(2) : null,
    savings:
      showCompare && Boolean(config.showSavings)
        ? (original - finalPrice).toFixed(2)
        : null,
  };
}

/**
 * The public payload the storefront theme fetches. Includes the resolved font
 * stack and computed pricing so the theme script doesn't need any of this logic.
 */
export function buildPopupPayload(config) {
  const { finalPrice, compareAtPrice, savings } = popupPricing(config);
  const ready = Boolean(config.enabled && config.variantId);

  return {
    enabled: ready,
    style: {
      // inheritStoreFont wins: send null so the theme keeps its own font.
      fontFamily: config.inheritStoreFont
        ? null
        : (FONT_STACKS[config.fontFamily] ?? FONT_STACKS.system),
      fontColor: config.fontColor,
      backgroundColor: config.backgroundColor,
      selectorsColor: config.selectorsColor ?? null,
      elementsColor: config.elementsColor ?? null,
      themeVariant: config.themeVariant,
      layout: config.layout ?? "media-left",
      cornerRadius: config.cornerRadius,
    },
    display: {
      hideIfInCart: Boolean(config.hideIfInCart),
      hideIfCartHasSubscription: Boolean(config.hideIfCartHasSubscription),
    },
    headline: config.headlineEnabled ? config.headlineText : null,
    subheadline: config.subheadlineEnabled ? config.subheadlineText : null,
    description: config.descriptionEnabled ? config.descriptionText : null,
    countdown: config.countdownEnabled
      ? {
          minutes: config.countdownMinutes ?? 10,
          backgroundColor: config.timerBackgroundColor,
        }
      : null,
    product: {
      variantId: config.variantId ? Number(config.variantId) : null,
      title: config.productTitle,
      image: config.productImage,
      price: finalPrice,
      compareAtPrice,
      savings,
      imageFit: config.imageFit,
      imageSize: config.imageSize,
      imageBorder: config.imageBorder !== false,
      autoselectVariant: config.autoselectVariant !== false,
      hideQuantitySelector: config.hideQuantitySelector !== false,
      quantity: config.predefinedQuantity ?? 1,
      // subscribe flow deferred; flag carried through for the future.
      allowSubscription: Boolean(config.allowSubscription),
    },
    buttons: {
      acceptText: config.acceptButtonText,
      acceptColor: config.acceptButtonColor,
      acceptHoverColor: config.acceptButtonHoverColor ?? null,
      declineText: config.declineButtonText,
      declineColor: config.declineButtonColor,
      declineHoverColor: config.declineButtonHoverColor ?? null,
      closeBehavior: config.closeButtonBehavior,
    },
  };
}

/** Validates and normalizes a `?shop=` value to a myshopify domain, or null. */
export function normalizePublicShop(value) {
  if (!value) return null;
  let host = String(value).trim();
  try {
    host = new URL(host).host;
  } catch {
    host = host.replace(/^https?:\/\//, "").split("/")[0];
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(host) ? host : null;
}
