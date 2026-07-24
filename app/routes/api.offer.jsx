/* eslint-env node */
import { authenticate } from "../shopify.server";
import {
  buildOfferPayload,
  getOfferConfig,
  resolveShopDomain,
} from "../models/offer.server";

/**
 * Returns the current offer configuration for the shop, so the post-purchase
 * extension's `ShouldRender`/`Render` can decide whether and what to show.
 *
 * Route path: /api/offer
 */

// Shopify sends a CORS preflight before the POST; answer it with the cors helper.
export const loader = async ({ request }) => {
  const { cors } = await authenticate.public.checkout(request);
  return cors(new Response(null, { status: 204 }));
};

export const action = async ({ request }) => {
  const { cors, sessionToken } = await authenticate.public.checkout(request);

  const body = await request.json().catch(() => ({}));
  const shop = resolveShopDomain(sessionToken, body.shop);
  if (!shop) {
    // Can't tell which shop this is, so there's no offer to show.
    return cors(Response.json({ enabled: false }));
  }

  const config = await getOfferConfig(shop);
  return cors(Response.json(buildOfferPayload(config)));
};
