import prisma from "../db.server";

/**
 * Offers that belong to the NEW Funnel model (Phase 2 schema). Completely
 * separate from the legacy `offer.server.js` (which drives the old OfferConfig /
 * post-purchase extension and must not be touched).
 *
 * Every function is scoped so the offer's parent funnel belongs to `shop`
 * (tenancy via the `funnel: { shop }` relation filter — no cross-shop access).
 */

/** Create an offer under a funnel the shop owns. Returns null if the funnel
 *  isn't this shop's. Position auto-assigned within the offer's section. */
export async function createOffer(shop, funnelId, data = {}) {
  const funnel = await prisma.funnel.findFirst({ where: { id: funnelId, shop } });
  if (!funnel) return null;

  const section = data.section ?? "product-page";
  const position = await prisma.offer.count({ where: { funnelId, section } });

  return prisma.offer.create({
    data: { ...data, funnelId, section, position },
  });
}

/** Fetch a single offer, only if its funnel belongs to the shop (else null). */
export async function getOffer(shop, offerId) {
  return prisma.offer.findFirst({ where: { id: offerId, funnel: { shop } } });
}

/** Update an offer scoped to the shop. Returns the updated offer or null. */
export async function updateOffer(shop, offerId, data) {
  const { count } = await prisma.offer.updateMany({
    where: { id: offerId, funnel: { shop } },
    data,
  });
  if (count === 0) return null;
  return getOffer(shop, offerId);
}

/** Delete an offer scoped to the shop. Returns true if one was deleted. */
export async function deleteOffer(shop, offerId) {
  const { count } = await prisma.offer.deleteMany({
    where: { id: offerId, funnel: { shop } },
  });
  return count > 0;
}
