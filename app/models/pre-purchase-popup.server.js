import prisma from "../db.server";
import {
  CLOSE_BEHAVIORS,
  FONT_STACKS,
  IMAGE_FITS,
  IMAGE_SIZES,
  THEME_VARIANTS,
} from "../lib/popup-options";

/**
 * Read/write + shaping logic for the pre-purchase (cart/checkout-click) upsell
 * popup config. Completely separate from the post-purchase OfferConfig.
 *
 * Used by the admin editor (app.checkout-popup.jsx) and the public API route
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
  };
}

/** compare-at + savings, honoring the show toggles. */
export function popupSavings(config) {
  if (!config.showCompareAt) return { compareAtPrice: null, savings: null };

  const compareAt = Number.parseFloat(config.productCompareAtPrice);
  const price = Number.parseFloat(config.productPrice);
  if (!Number.isFinite(compareAt) || !Number.isFinite(price) || compareAt <= price) {
    return { compareAtPrice: null, savings: null };
  }

  return {
    compareAtPrice: compareAt.toFixed(2),
    savings: config.showSavings ? (compareAt - price).toFixed(2) : null,
  };
}

/**
 * The public payload the storefront theme fetches. Includes the resolved font
 * stack and computed savings so the theme script doesn't need any of this logic.
 */
export function buildPopupPayload(config) {
  const { compareAtPrice, savings } = popupSavings(config);
  const ready = Boolean(config.enabled && config.variantId);

  return {
    enabled: ready,
    style: {
      fontFamily: FONT_STACKS[config.fontFamily] ?? FONT_STACKS.system,
      fontColor: config.fontColor,
      backgroundColor: config.backgroundColor,
      themeVariant: config.themeVariant,
      cornerRadius: config.cornerRadius,
    },
    display: {
      hideIfInCart: Boolean(config.hideIfInCart),
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
      price: config.productPrice,
      compareAtPrice,
      savings,
      imageFit: config.imageFit,
      imageSize: config.imageSize,
    },
    buttons: {
      acceptText: config.acceptButtonText,
      acceptColor: config.acceptButtonColor,
      declineText: config.declineButtonText,
      declineColor: config.declineButtonColor,
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
