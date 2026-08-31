import prisma from "../db.server";
import { ensureStore } from "./store.server";

/**
 * Funnel data access. Adapted from RevLift's useFunnels shape to Prisma. Every
 * function is scoped by `shop` so one shop can never read/modify another's
 * funnels (tenancy is enforced here, not via RLS).
 */

/**
 * Aggregate Event rows (the single source of truth) grouped by a key column, for
 * a set of ids. Returns a Map<id, { impressions, conversions, revenue }>.
 * Best-effort: any failure yields an empty map so callers fall back to zeros
 * rather than breaking the page.
 */
export async function statsByKey(shop, key, ids, { since } = {}) {
  const map = new Map();
  if (!ids.length) return map;
  const dateFilter = since ? { createdAt: { gte: since } } : {};
  try {
    const [imp, conv] = await Promise.all([
      prisma.event.groupBy({
        by: [key],
        where: { shop, type: "impression", [key]: { in: ids }, ...dateFilter },
        _count: { _all: true },
      }),
      prisma.event.groupBy({
        by: [key],
        where: { shop, type: "conversion", [key]: { in: ids }, ...dateFilter },
        _count: { _all: true },
        _sum: { revenue: true },
      }),
    ]);
    for (const r of imp) {
      map.set(r[key], { impressions: r._count._all, conversions: 0, revenue: 0 });
    }
    for (const r of conv) {
      const cur = map.get(r[key]) || { impressions: 0, conversions: 0, revenue: 0 };
      cur.conversions = r._count._all;
      cur.revenue = Number(r._sum.revenue ?? 0);
      map.set(r[key], cur);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[funnel] event stats aggregation failed:", e?.message || e);
  }
  return map;
}

/** List a shop's funnels of a given type (or all), highest priority first.
 *  Views/conversions/revenue are derived from the Event table (single source of
 *  truth), not from stored counters. */
export async function getFunnels(shop, type) {
  const funnels = await prisma.funnel.findMany({
    where: { shop, ...(type ? { type } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { offers: true } } },
  });
  const base = funnels.map(({ _count, ...f }) => ({
    ...f,
    offerCount: _count.offers,
    impressions: 0,
    conversions: 0,
    revenue: 0,
  }));
  const stats = await statsByKey(shop, "funnelId", base.map((f) => f.id));
  for (const f of base) {
    const s = stats.get(f.id);
    if (s) {
      f.impressions = s.impressions;
      f.conversions = s.conversions;
      f.revenue = s.revenue;
    }
  }
  return base;
}

/** A single funnel WITH its offers, only if it belongs to this shop (else null).
 *  Each offer's impressions/conversions/revenue are derived from the Event table
 *  (overwriting the stored counters — Events are the single source of truth). */
export async function getFunnel(shop, id) {
  const funnel = await prisma.funnel.findFirst({
    where: { id, shop },
    include: { offers: { orderBy: { position: "asc" } } },
  });
  if (!funnel) return null;
  const stats = await statsByKey(shop, "offerId", funnel.offers.map((o) => o.id));
  for (const o of funnel.offers) {
    const s = stats.get(o.id) || { impressions: 0, conversions: 0, revenue: 0 };
    o.impressions = s.impressions;
    o.conversions = s.conversions;
    o.revenue = s.revenue;
  }
  return funnel;
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
