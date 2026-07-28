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
  const ref = body?.referenceId ?? "?";

  if (!shop) {
    // Can't tell which shop this is, so there's no offer to show.
    console.log(`[post-purchase] /api/offer HIT shop=UNRESOLVED ref=${ref}`);
    return cors(Response.json({ enabled: false }));
  }

  const config = await getOfferConfig(shop);
  const payload = buildOfferPayload(config);

  // Presence of this line in the Render logs proves Shopify actually called the
  // extension's ShouldRender network fetch. `enabled=true` means we returned a
  // valid offer — so anything not showing after that is platform-side gating
  // (payment not vaulted, app not selected as the post-purchase provider, etc.).
  console.log(
    `[post-purchase] /api/offer HIT shop=${shop} enabled=${payload.enabled} ` +
      `variantId=${payload.variantId ?? "none"} downsell=${payload.downsell ? "yes" : "no"} ref=${ref}`,
  );

  return cors(Response.json(payload));
};
