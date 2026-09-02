import { normalizePublicShop } from "../models/pre-purchase-popup.server";
import {
  hasNewFunnelOfType,
  resolveThankYouOffers,
} from "../models/funnel-resolver.server";

/**
 * Public, unauthenticated config feed for the storefront thank-you /
 * order-status Checkout UI extension. Fetched cross-origin on render:
 *
 *   GET /api/thank-you?shop=<store>.myshopify.com
 *
 * Returns the active thank-you funnel's renderable widgets (product
 * recommendations + FAQ / text / image from Store.thankYouSettings). New-model
 * only — no legacy fallback. Mirrors api.pre-purchase-popup.jsx (CORS, shop
 * resolution, {enabled:false} fallback). customCode is intentionally NOT served
 * (arbitrary code can't render in a UI extension).
 *
 * Route path: /api/thank-you
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=30",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function buildThankYouPayload({ products, settings }) {
  const w = settings.widgets || {};
  const pr = w.product_recommendations || {};
  const faq = w.faq || {};
  const text = w.custom_text || {};
  const image = w.custom_image || {};

  return {
    enabled: true,
    widgets: {
      productRecommendations: {
        // Only "on" when the widget is enabled AND there's at least one product.
        enabled: Boolean(pr.enabled) && products.length > 0,
        heading: pr.heading ?? "You might also like",
        maxProducts: pr.max_products ?? 3,
        products,
      },
      faq: {
        enabled: Boolean(faq.enabled),
        heading: faq.heading ?? "Frequently Asked Questions",
        items: Array.isArray(faq.items)
          ? faq.items.map((it) => ({ q: it.q ?? it.question ?? "", a: it.a ?? it.answer ?? "" }))
          : [],
      },
      text: { enabled: Boolean(text.enabled), content: text.content ?? "" },
      image: { enabled: Boolean(image.enabled), imageUrl: image.image_url ?? null },
    },
  };
}

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shop = normalizePublicShop(url.searchParams.get("shop"));
  if (!shop) {
    return json({ enabled: false }, 200);
  }

  try {
    // New-model only: nothing to serve unless the shop has a thank-you funnel.
    if (!(await hasNewFunnelOfType(shop, "thank-you"))) {
      return json({ enabled: false });
    }
    const resolved = await resolveThankYouOffers(shop);
    if (!resolved) return json({ enabled: false });
    return json(buildThankYouPayload(resolved));
  } catch {
    // Any DB/resolve failure → render nothing (fail safe).
    return json({ enabled: false });
  }
};
