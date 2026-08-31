/* eslint-env node */
import { SignJWT } from "jose";

import { authenticate } from "../shopify.server";
import {
  buildOfferChanges,
  getOfferConfig,
  isOfferReady,
  offerDisplayPrice,
  pickOffer,
  resolveShopDomain,
} from "../models/offer.server";
import {
  hasNewFunnelOfType,
  offerConfigShapeFromFunnel,
  resolvePostPurchaseOffer,
} from "../models/funnel-resolver.server";
import { recordEventDeduped } from "../models/event.server";

/**
 * Signs a post-purchase changeset so the extension can apply it.
 *
 * The extension can preview a changeset with `calculateChangeset` on its own,
 * but applying one requires a JWT signed with the app's API secret. That secret
 * must never ship inside the extension bundle, so the extension POSTs here and
 * we sign on the server.
 *
 * The `changes` are rebuilt from the shop's saved config here — never trusted
 * from the request — so a tampered client can't inject a different variant or a
 * bigger discount.
 *
 * Route path: /api/sign-changeset
 */

// Shopify sends a CORS preflight before the POST; answer it with the cors helper.
export const loader = async ({ request }) => {
  const { cors } = await authenticate.public.checkout(request);
  return cors(new Response(null, { status: 204 }));
};

export const action = async ({ request }) => {
  // Verifies the request carries a valid post-purchase token from Shopify and
  // gives us a `cors` helper for the response.
  const { cors, sessionToken } = await authenticate.public.checkout(request);

  const { referenceId, shop: bodyShop, offer: offerKind } = await request.json();
  const shop = resolveShopDomain(sessionToken, bodyShop);

  if (!shop) {
    return cors(Response.json({ error: "unknown_shop" }, { status: 400 }));
  }

  // Which step the buyer accepted — defaults to the main offer.
  const kind = offerKind === "downsell" ? "downsell" : "main";

  // Resolve the offer the SAME way /api/offer did (same resolver, same
  // deterministic pick, same config shape) so the signed changeset always
  // matches what the buyer was shown. The numeric variantId comes from
  // gidToNumericId inside the shape builder; changes are rebuilt here, never
  // trusted from the client.
  let offer;
  let resolved = null;
  let newModel = false;
  if (await hasNewFunnelOfType(shop, "post-purchase")) {
    newModel = true;
    resolved = await resolvePostPurchaseOffer(shop);
    offer = resolved ? pickOffer(offerConfigShapeFromFunnel(resolved), kind) : null;
  } else {
    const config = await getOfferConfig(shop);
    offer = pickOffer(config, kind);
  }

  if (!offer || !isOfferReady(offer)) {
    return cors(
      Response.json({ error: "offer_not_available" }, { status: 409 }),
    );
  }

  const changes = buildOfferChanges(offer);

  const payload = {
    iss: process.env.SHOPIFY_API_KEY, // client id of the app
    jti: crypto.randomUUID(),
    iat: Date.now(),
    sub: referenceId, // ties the changeset to this specific order
    changes,
  };

  const secret = new TextEncoder().encode(process.env.SHOPIFY_API_SECRET);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret);

  // Record a post-purchase conversion + revenue — ONLY on the new-model path.
  // Fire-and-forget AFTER signing, so it can never delay or block the token.
  // Revenue uses the SAME price/discount math the changeset was built from
  // (offerDisplayPrice). Deduped by referenceId so accept retries don't double
  // count. offer ids come from the resolved funnel/offer (the shape drops ids).
  if (newModel && resolved) {
    const offerRow = kind === "downsell" ? resolved.downsell : resolved.main;
    if (offerRow) {
      const rev = Number(offerDisplayPrice(offer));
      void recordEventDeduped({
        shop,
        type: "conversion",
        funnelId: resolved.funnel.id,
        offerId: offerRow.id,
        variantId: offer.variantId ?? null,
        orderId: referenceId ?? null,
        revenue: Number.isFinite(rev) ? rev : null,
        metadata: { kind, source: "sign-changeset" },
      });
    }
  }

  return cors(Response.json({ token }));
};
