/* eslint-env node */
import { authenticate } from "../shopify.server";
import {
  buildOfferPayload,
  getOfferConfig,
  resolveShopDomain,
} from "../models/offer.server";
import {
  hasNewFunnelOfType,
  offerConfigShapeFromFunnel,
  resolvePostPurchaseOffer,
} from "../models/funnel-resolver.server";
import { recordEventDeduped } from "../models/event.server";

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

  // Ownership rule: if this shop has ANY post-purchase funnel, the new model
  // serves it (even if the active offer resolves to null → disabled payload).
  // Otherwise fall back to the legacy OfferConfig, byte-for-byte unchanged.
  let payload;
  let resolved = null;
  let newModel = false;
  if (await hasNewFunnelOfType(shop, "post-purchase")) {
    newModel = true;
    resolved = await resolvePostPurchaseOffer(shop);
    payload = resolved
      ? buildOfferPayload(offerConfigShapeFromFunnel(resolved))
      : { enabled: false };
  } else {
    const config = await getOfferConfig(shop);
    payload = buildOfferPayload(config);
  }

  // Presence of this line in the Render logs proves Shopify actually called the
  // extension's ShouldRender network fetch. `enabled=true` means we returned a
  // valid offer — so anything not showing after that is platform-side gating
  // (payment not vaulted, app not selected as the post-purchase provider, etc.).
  console.log(
    `[post-purchase] /api/offer HIT shop=${shop} enabled=${payload.enabled} ` +
      `variantId=${payload.variantId ?? "none"} downsell=${payload.downsell ? "yes" : "no"} ref=${ref}`,
  );

  // Record a post-purchase "served" impression — ONLY on the new-model path
  // (legacy fallback has no offer to attribute to). Fire-and-forget: not awaited,
  // never blocks the response; the offer payload returns exactly as fast as
  // before. Deduped by referenceId (the order ref) so ShouldRender retries don't
  // double-count; if referenceId is absent it inserts anyway (looser).
  if (newModel && resolved?.main && payload.enabled) {
    void recordEventDeduped({
      shop,
      type: "impression",
      funnelId: resolved.funnel.id,
      offerId: resolved.main.id,
      variantId: payload.variantId ?? null,
      orderId: body?.referenceId ?? null,
      metadata: { section: resolved.main.section, source: "api.offer" },
    });
  }

  return cors(Response.json(payload));
};
