import prisma from "../db.server";

/**
 * Store-level tenant record (keyed by the myshopify `shop` domain). Funnel /
 * Event / Billing all FK to Store.shop, so a Store row must exist before any of
 * those are created.
 */

/**
 * Ensure a Store row exists for this shop and return it. Idempotent — safe to
 * call on every request/action before creating funnels.
 */
export async function ensureStore(shop) {
  return prisma.store.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

/** Return the Store row for a shop, or null if it doesn't exist yet. */
export async function getStore(shop) {
  return prisma.store.findUnique({ where: { shop } });
}

/** Ensure the Store exists, then patch the given fields (e.g. the settings
 *  JSON blobs or plan/currency). Returns the updated row. */
export async function updateStore(shop, data) {
  await ensureStore(shop);
  return prisma.store.update({ where: { shop }, data });
}
