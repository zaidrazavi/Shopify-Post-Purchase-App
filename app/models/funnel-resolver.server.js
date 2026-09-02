import prisma from "../db.server";
import { getStore } from "./store.server";
import { DEFAULT_THANK_YOU_SETTINGS } from "../lib/default-settings";

/**
 * Bridge between the NEW multi-funnel/multi-offer model (Funnel + Offer) and the
 * three live storefront API routes (/api/offer, /api/sign-changeset,
 * /api/pre-purchase-popup).
 *
 * The routes keep their exact paths and produce BYTE-IDENTICAL payloads. This
 * module only decides WHERE the data comes from: it resolves which funnel/offer
 * to serve, maps a new-model Offer into the SAME shape the legacy config tables
 * had, and hands it to the UNCHANGED old builders (buildOfferPayload /
 * buildPopupPayload / pickOffer / buildOfferChanges in offer.server.js and
 * pre-purchase-popup.server.js). We never rewrite the money/discount logic.
 *
 * Ownership rule: if ANY funnel of a type exists for a shop, the new model owns
 * delivery for that type (see hasNewFunnelOfType) — the routes must NOT fall
 * back to the old tables even when the active offer resolves to null.
 *
 * DEFERRED (need extension changes — intentionally NOT honored here, per the
 * approved plan):
 *   - A/B testing and multi-product traffic split (selection is deterministic;
 *     /api/offer and /api/sign-changeset must pick the same offer).
 *   - Targeted pre-purchase triggers (specific-products / specific-collections /
 *     items-quantity / total-value / customer-tag) — treated as "all-products".
 *   - The multi-step post-purchase tree beyond main + one downsell
 *     (post-purchase-2/3, downsell-2).
 * Funnel-level status, priority ordering, and dateStart/dateEnd windows ARE
 * enforced here (safe, server-side).
 */

/**
 * Extract the numeric tail from a Shopify GID, passing through already-numeric
 * values. The new product picker saves ids as GIDs
 * ("gid://shopify/ProductVariant/123"), but the legacy payloads/changeset use
 * numeric ids via Number(...). Feeding a GID to Number() yields NaN, which
 * breaks both the offer display and the actual charge — so every id the resolver
 * emits for a payload/changeset goes through here first.
 *
 *   gidToNumericId("gid://shopify/ProductVariant/123") -> "123"  (Number(...) === 123)
 *   gidToNumericId("123")   -> "123"
 *   gidToNumericId(456)     -> "456"
 *   gidToNumericId(null)    -> null
 */
export function gidToNumericId(id) {
  if (id == null) return id; // null / undefined pass through untouched
  const s = String(id);
  const match = s.match(/\d+$/); // last run of digits (the GID's numeric id)
  return match ? match[0] : s;
}

// ── Decimal helpers (Prisma Decimal -> the string/number the old code expects) ──
// The legacy config stored prices as strings and discountValue as a Float. Both
// old code paths ultimately parseFloat(...) then toFixed(2), so trailing-zero
// differences ("600" vs "600.00") wash out to an identical final payload.
const decToStr = (d) => (d == null ? null : String(d));
const numFromDec = (d) => (d == null ? null : Number(d));

// Old pre-purchase defaults (mirror DEFAULT_POPUP / the offer editor's
// normalizeOffer) applied in code where a new Offer column is null.
const PRE_DEFAULTS = {
  subheadlineText: "A special one-time offer, just for you.",
  fontColor: "#1A1A2E",
  backgroundColor: "#FFFFFF",
  themeVariant: "classic",
  layout: "media-left",
  cornerRadius: 14,
  timerBackgroundColor: "#F8C9C9",
  imageFit: "cover",
  imageSize: "medium",
  acceptButtonColor: "#EF6E7B",
  declineButtonColor: "#6D7175",
  closeButtonBehavior: "decline",
};

const withinWindow = (funnel, now) => {
  if (funnel.dateStart && now < funnel.dateStart) return false;
  if (funnel.dateEnd && now > funnel.dateEnd) return false;
  return true;
};

// Active funnels of a type, highest priority first then earliest created — the
// same ordering the admin list uses (funnel.server.js getFunnels).
async function activeFunnels(shop, type) {
  return prisma.funnel.findMany({
    where: { shop, type, status: "active" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { offers: true },
  });
}

/**
 * True if ANY funnel of this type exists for the shop (any status). Enforces the
 * ownership rule: once a merchant has created a funnel of a type, the new model
 * serves that type and the routes stop falling back to the old config tables.
 */
export async function hasNewFunnelOfType(shop, type) {
  const count = await prisma.funnel.count({ where: { shop, type } });
  return count > 0;
}

// Pre-purchase section preference, then lowest position. Only offers that point
// at a real variant are eligible (deterministic — same pick every call).
const PRE_SECTION_PREF = ["pre-purchase", "cart-drawer", "product-page"];

function pickPrePurchaseOffer(offers) {
  const ready = offers.filter((o) => o.variantId);
  for (const section of PRE_SECTION_PREF) {
    const inSection = ready
      .filter((o) => o.section === section)
      .sort((a, b) => a.position - b.position);
    if (inSection.length) return inSection[0];
  }
  // Fallback: any ready offer, lowest position (covers unexpected sections).
  const rest = ready.slice().sort((a, b) => a.position - b.position);
  return rest[0] ?? null;
}

// Lowest-position variant-bearing offer in a given section, or null.
function pickBySection(offers, section) {
  return (
    offers
      .filter((o) => o.section === section && o.variantId)
      .sort((a, b) => a.position - b.position)[0] ?? null
  );
}

/**
 * The active pre-purchase offer to serve, or null. Walks funnels in priority
 * order and returns the first one that is inside its date window and has a
 * usable offer. Selection is deterministic (no A/B / traffic split).
 * Returns { offer, funnel } or null.
 */
export async function resolvePrePurchaseOffer(shop) {
  const now = new Date();
  const funnels = await activeFunnels(shop, "pre-purchase");
  for (const funnel of funnels) {
    if (!withinWindow(funnel, now)) continue;
    const offer = pickPrePurchaseOffer(funnel.offers);
    if (offer) return { offer, funnel };
  }
  return null;
}

/**
 * The active post-purchase offer set to serve, or null. main = the first
 * variant-bearing offer in section "post-purchase-1"; downsell = same in section
 * "downsell". Deeper tree steps are deferred (need extension changes).
 * Returns { main, downsell, funnel } or null (null when no funnel yields a main).
 */
export async function resolvePostPurchaseOffer(shop) {
  const now = new Date();
  const funnels = await activeFunnels(shop, "post-purchase");
  for (const funnel of funnels) {
    if (!withinWindow(funnel, now)) continue;
    const main = pickBySection(funnel.offers, "post-purchase-1");
    if (!main) continue;
    const downsell = pickBySection(funnel.offers, "downsell");
    return { main, downsell, funnel };
  }
  return null;
}

// ── Map a new-model Offer -> a single legacy "offer slot" inside an OfferConfig
//    shape (the fields pickOffer/offerView/buildOfferChanges read). ──
function mapMainSlot(o) {
  return {
    enabled: true,
    productId: gidToNumericId(o.productId),
    variantId: gidToNumericId(o.variantId),
    productTitle: o.productTitle ?? null,
    productImage: o.imageUrl ?? null,
    productPrice: decToStr(o.price),
    productCompareAtPrice: decToStr(o.compareAtPrice),
    discountType: o.discountType ?? "none",
    discountValue: numFromDec(o.discountValue),
    headline: o.headline,
    description: o.description,
    acceptButtonText: o.buttonText,
    declineButtonText: o.declineText,
  };
}

/**
 * Build an OfferConfig-shaped object from a resolved post-purchase set, so the
 * UNCHANGED buildOfferPayload / pickOffer / buildOfferChanges (offer.server.js)
 * produce the exact legacy /api/offer payload and changeset. All ids are already
 * numeric (via gidToNumericId) so the old Number(...) calls work.
 */
export function offerConfigShapeFromFunnel({ main, downsell }) {
  const d = downsell ?? null;
  return {
    ...mapMainSlot(main),
    countdownEnabled: Boolean(main.timerEnabled),
    countdownMinutes: main.timerDuration ?? 10,

    downsellEnabled: Boolean(d),
    downsellProductId: d ? gidToNumericId(d.productId) : null,
    downsellVariantId: d ? gidToNumericId(d.variantId) : null,
    downsellProductTitle: d?.productTitle ?? null,
    downsellProductImage: d?.imageUrl ?? null,
    downsellProductPrice: d ? decToStr(d.price) : null,
    downsellProductCompareAtPrice: d ? decToStr(d.compareAtPrice) : null,
    downsellDiscountType: d?.discountType ?? "none",
    downsellDiscountValue: d ? numFromDec(d.discountValue) : null,
    downsellHeadline: d?.headline ?? null,
    downsellDescription: d?.description ?? null,
    downsellAcceptButtonText: d?.buttonText ?? null,
    downsellDeclineButtonText: d?.declineText ?? null,

    // Style is carried through as null (the post-purchase extension ignores it,
    // same as an old config with no banner colors set).
    bannerBackgroundColor: null,
    bannerTextColor: null,
    bannerIconColor: null,
    previewButtonColor: null,
    cardLayout: null,
  };
}

/**
 * Build a PrePurchasePopupConfig-shaped object from a new-model Offer, so the
 * UNCHANGED buildPopupPayload / popupPricing (pre-purchase-popup.server.js)
 * produce the exact legacy /api/pre-purchase-popup payload. variantId is numeric
 * (Number() safe); productId can stay numeric — buildPopupPayload strips a GID
 * tail either way. Old defaults applied where a column is null.
 */
export function popupConfigShapeFromOffer(o) {
  return {
    enabled: true,
    // Buy box (offered product)
    variantId: gidToNumericId(o.variantId),
    productId: gidToNumericId(o.productId),
    productTitle: o.productTitle,
    productImage: o.imageUrl,
    productPrice: decToStr(o.price),
    productCompareAtPrice: decToStr(o.compareAtPrice),
    discountType: o.discountType ?? "none",
    discountValue: numFromDec(o.discountValue),
    showCompareAt: o.showCompareAt ?? true,
    showSavings: o.showSavings ?? true,
    imageFit: o.imageFit ?? PRE_DEFAULTS.imageFit,
    imageSize: o.imageSize ?? PRE_DEFAULTS.imageSize,
    imageBorder: o.imageBorder ?? true,
    autoselectVariant: o.autoselectVariant ?? true,
    hideQuantitySelector: o.hideQuantitySelector ?? true,
    predefinedQuantity: o.predefinedQuantity ?? 1,
    allowSubscription: o.allowSubscription ?? false,

    // General (look & feel)
    fontFamily: o.fontFamily ?? "system",
    inheritStoreFont: o.inheritStoreFont === true,
    fontColor: o.textColor ?? PRE_DEFAULTS.fontColor,
    backgroundColor: o.backgroundColor ?? PRE_DEFAULTS.backgroundColor,
    selectorsColor: o.selectorsColor ?? null,
    elementsColor: o.elementsColor ?? null,
    themeVariant: o.themeVariant ?? PRE_DEFAULTS.themeVariant,
    layout: o.layout ?? PRE_DEFAULTS.layout,
    cornerRadius: o.cornerRadius ?? PRE_DEFAULTS.cornerRadius,

    // Display conditions
    hideIfInCart: o.hideIfInCart ?? true,
    hideIfCartHasSubscription: o.hideIfCartHasSubscription ?? false,

    // Incentive / messaging
    headlineEnabled: o.headlineEnabled ?? true,
    headlineText: o.headline,
    subheadlineEnabled: o.subheadlineEnabled ?? true,
    subheadlineText: o.subheadlineText ?? PRE_DEFAULTS.subheadlineText,
    descriptionEnabled: o.descriptionEnabled ?? true,
    descriptionText: o.description,
    countdownEnabled: Boolean(o.timerEnabled),
    countdownMinutes: o.timerDuration ?? 10,
    timerBackgroundColor: o.timerBackgroundColor ?? PRE_DEFAULTS.timerBackgroundColor,

    // Buttons
    acceptButtonText: o.buttonText,
    acceptButtonColor: o.buttonColor ?? PRE_DEFAULTS.acceptButtonColor,
    acceptButtonHoverColor: o.acceptButtonHoverColor ?? null,
    declineButtonText: o.declineText,
    declineButtonColor: o.declineButtonColor ?? PRE_DEFAULTS.declineButtonColor,
    declineButtonHoverColor: o.declineButtonHoverColor ?? null,
    closeButtonBehavior: o.closeButtonBehavior ?? PRE_DEFAULTS.closeButtonBehavior,
  };
}

// gidToNumericId returns a numeric STRING; the thank-you payload wants Numbers.
const numId = (v) => (v == null ? null : Number(v));

// Merge the shop's saved thankYouSettings over the code defaults (nested widgets
// need a per-widget merge, not a shallow spread).
function mergeThankYouSettings(s) {
  const d = DEFAULT_THANK_YOU_SETTINGS;
  if (!s || typeof s !== "object") return d;
  const w = s.widgets || {};
  return {
    ...d,
    ...s,
    widgets: {
      ...d.widgets,
      ...w,
      product_recommendations: { ...d.widgets.product_recommendations, ...(w.product_recommendations || {}) },
      faq: { ...d.widgets.faq, ...(w.faq || {}) },
      custom_text: { ...d.widgets.custom_text, ...(w.custom_text || {}) },
      custom_image: { ...d.widgets.custom_image, ...(w.custom_image || {}) },
      custom_code: { ...d.widgets.custom_code, ...(w.custom_code || {}) },
    },
  };
}

/**
 * The active thank-you funnel's product recs + widget settings, or null. Walks
 * active thank-you funnels (priority order) and returns the first within its
 * date window. Product recs = offers in section "thank-you-upsell" that have a
 * variantId, ordered by position, capped at the settings' max_products, and
 * pre-mapped to the payload shape (numeric ids via gidToNumericId, prices as
 * strings via decToStr) so the public route needs no private helpers.
 * Returns { funnel, products, settings } or null. DEFERRED: custom_code is never
 * surfaced (can't render in a checkout UI extension).
 */
export async function resolveThankYouOffers(shop) {
  const now = new Date();
  const funnels = await activeFunnels(shop, "thank-you");
  const funnel = funnels.find((f) => withinWindow(f, now));
  if (!funnel) return null;

  let settings = DEFAULT_THANK_YOU_SETTINGS;
  try {
    const store = await getStore(shop);
    settings = mergeThankYouSettings(store?.thankYouSettings);
  } catch {
    settings = DEFAULT_THANK_YOU_SETTINGS;
  }

  const maxProducts = settings.widgets?.product_recommendations?.max_products ?? 3;
  const products = (funnel.offers || [])
    .filter((o) => o.section === "thank-you-upsell" && o.variantId)
    .sort((a, b) => a.position - b.position)
    .slice(0, Math.max(0, maxProducts))
    .map((o) => ({
      productId: numId(gidToNumericId(o.productId)),
      variantId: numId(gidToNumericId(o.variantId)),
      title: o.productTitle ?? o.headline ?? null,
      image: o.imageUrl ?? null,
      price: decToStr(o.price),
      compareAtPrice: decToStr(o.compareAtPrice),
    }));

  return { funnel, products, settings };
}
