/* eslint-env node */
import { SignJWT } from "jose";

import { authenticate } from "../shopify.server";
import {
  buildOfferChanges,
  getOfferConfig,
  isOfferReady,
  resolveShopDomain,
} from "../models/offer.server";

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

  const { referenceId, shop: bodyShop } = await request.json();
  const shop = resolveShopDomain(sessionToken, bodyShop);

  if (!shop) {
    return cors(Response.json({ error: "unknown_shop" }, { status: 400 }));
  }

  const config = await getOfferConfig(shop);
  if (!isOfferReady(config)) {
    return cors(
      Response.json({ error: "offer_not_available" }, { status: 409 }),
    );
  }

  const changes = buildOfferChanges(config);

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

  return cors(Response.json({ token }));
};
