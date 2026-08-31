import prisma from "../db.server";
import { ensureStore } from "./store.server";

/**
 * Funnel data access. Adapted from RevLift's useFunnels shape to Prisma. Every
 * function is scoped by `shop` so one shop can never read/modify another's
 * funnels (tenancy is enforced here, not via RLS).
 */

/** List a shop's funnels of a given type (or all), highest priority first. */
export async function getFunnels(shop, type) {
  const funnels = await prisma.funnel.findMany({
    where: { shop, ...(type ? { type } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { offers: true } } },
  });
  return funnels.map(({ _count, ...f }) => ({ ...f, offerCount: _count.offers }));
}

/** A single funnel WITH its offers, only if it belongs to this shop (else null). */
export async function getFunnel(shop, id) {
  return prisma.funnel.findFirst({
    where: { id, shop },
    include: { offers: { orderBy: { position: "asc" } } },
  });
}

/** Create a funnel for the shop (ensures the Store row exists first). */
export async function createFunnel(shop, { type, name } = {}) {
  await ensureStore(shop);
  return prisma.funnel.create({
    data: {
      shop,
      ...(type ? { type } : {}),
      ...(name ? { name } : {}),
    },
  });
}

/** Update a funnel, scoped to the shop. Returns the updated funnel, or null if
 *  it doesn't exist / isn't this shop's. */
export async function updateFunnel(shop, id, data) {
  const { count } = await prisma.funnel.updateMany({ where: { id, shop }, data });
  if (count === 0) return null;
  return getFunnel(shop, id);
}

/** Delete a funnel (cascades to its offers). Returns true if one was deleted. */
export async function deleteFunnel(shop, id) {
  const { count } = await prisma.funnel.deleteMany({ where: { id, shop } });
  return count > 0;
}

/** Flip a funnel between "active" and "paused" (scoped). Returns the new row or null. */
export async function toggleFunnelStatus(shop, id) {
  const funnel = await prisma.funnel.findFirst({ where: { id, shop } });
  if (!funnel) return null;
  const status = funnel.status === "active" ? "paused" : "active";
  return updateFunnel(shop, id, { status });
}

/** Deep-clone a funnel and all its offers (scoped). Returns the new funnel with
 *  offers, or null if the source isn't this shop's. */
export async function duplicateFunnel(shop, id) {
  const source = await getFunnel(shop, id);
  if (!source) return null;

  // Strip identity/relation/stat fields we don't want to copy verbatim.
  const {
    id: _id,
    shop: _shop,
    createdAt: _c,
    updatedAt: _u,
    offers,
    ...funnelData
  } = source;

  return prisma.funnel.create({
    data: {
      ...funnelData,
      shop,
      name: `${source.name} (Copy)`,
      status: "draft",
      offers: {
        create: offers.map((o) => {
          const {
            id: _oid,
            funnelId: _fid,
            createdAt: _oc,
            updatedAt: _ou,
            // Reset analytics counters on the copy.
            impressions: _imp,
            conversions: _conv,
            revenue: _rev,
            variantBImpressions: _vimp,
            variantBConversions: _vconv,
            variantBRevenue: _vrev,
            ...offerData
          } = o;
          return offerData;
        }),
      },
    },
    include: { offers: { orderBy: { position: "asc" } } },
  });
}
