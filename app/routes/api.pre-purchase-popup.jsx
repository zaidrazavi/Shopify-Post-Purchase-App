import {
  buildPopupPayload,
  getPopupConfig,
  normalizePublicShop,
} from "../models/pre-purchase-popup.server";

/**
 * Public, unauthenticated config feed for the storefront theme's pre-purchase
 * popup script. The theme fetches this cross-origin on page load:
 *
 *   GET /api/pre-purchase-popup?shop=<store>.myshopify.com
 *
 * The response is public display config (styling + which product to show), so
 * it's safe to serve without auth. A simple GET with no custom headers doesn't
 * trigger a CORS preflight; we still return permissive CORS so the storefront
 * can read it. (For a signed/hardened variant, a Shopify App Proxy would be the
 * alternative, at the cost of extra config on both sides.)
 *
 * Route path: /api/pre-purchase-popup
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

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shop = normalizePublicShop(url.searchParams.get("shop"));
  if (!shop) {
    return json({ enabled: false }, 200);
  }

  const config = await getPopupConfig(shop);
  return json(buildPopupPayload(config));
};
