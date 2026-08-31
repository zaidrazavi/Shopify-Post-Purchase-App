import prisma from "../db.server";

/**
 * Fire-and-forget event writer for analytics (Event table is the single source
 * of truth for impressions/conversions/revenue).
 *
 * CONTRACT: these functions must NEVER throw and must NEVER block the caller's
 * critical path (offer delivery / changeset signing). Every write is wrapped in
 * try/catch and logged on failure. Callers invoke them WITHOUT awaiting (e.g.
 * `void recordEventDeduped(...)`), so a slow or failing insert can't delay the
 * response. Render runs a persistent Node process, so the promise still settles.
 */

/** Insert one Event row. Swallows all errors. */
export async function recordEvent({
  shop,
  type,
  funnelId = null,
  offerId = null,
  variantId = null,
  orderId = null,
  revenue = null,
  metadata = null,
}) {
  try {
    if (!shop || !type) return;
    const data = { shop, type };
    if (funnelId) data.funnelId = funnelId;
    if (offerId) data.offerId = offerId;
    if (variantId != null) data.variantId = String(variantId);
    if (orderId != null) data.orderId = String(orderId);
    if (revenue != null && Number.isFinite(Number(revenue))) data.revenue = Number(revenue);
    if (metadata != null) data.metadata = metadata;
    await prisma.event.create({ data });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[event] recordEvent failed:", e?.message || e);
  }
}

/**
 * Like recordEvent, but idempotent per (shop, offerId, orderId, type) — so a
 * repeated ShouldRender fetch or an accept retry can't double-count. When there
 * is no orderId (referenceId unavailable at ShouldRender time) we can't key a
 * duplicate reliably, so we just insert (looser dedupe — acceptable for
 * impressions). Swallows all errors.
 */
export async function recordEventDeduped(evt) {
  try {
    if (!evt?.shop || !evt?.type) return;
    const { shop, type, offerId = null, orderId = null } = evt;
    if (orderId != null) {
      const existing = await prisma.event.findFirst({
        where: { shop, type, offerId, orderId: String(orderId) },
        select: { id: true },
      });
      if (existing) return; // already counted this order/offer/type
    }
    await recordEvent(evt);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[event] recordEventDeduped failed:", e?.message || e);
  }
}
