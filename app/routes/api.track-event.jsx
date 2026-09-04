import prisma from "../db.server";
import {
  resolvePrePurchaseOffer,
  resolvePostPurchaseOffer,
} from "../models/funnel-resolver.server";

/**
 * Public, fire-and-forget analytics ingest for the storefront/extensions.
 *
 *   POST /api/track-event
 *   { shopDomain, eventType, funnelId?, offerId?, productId?, variantId?,
 *     orderId?, metadata? }
 *
 * Writes one row to the existing `Event` model. It is intentionally lenient and
 * NEVER throws to the caller — the popup / post-purchase offer must keep working
 * whether or not this succeeds. There is no `productId` column on `Event`, so it
 * is folded into `metadata`. `funnelId`/`offerId` are foreign keys, so we only
 * persist ones that actually belong to the shop; when absent we best-effort
 * resolve the shop's active offer to link the event.
 *
 * A cross-origin POST with a JSON content-type triggers a CORS preflight, so we
 * answer OPTIONS in the loader and keep permissive CORS on every response.
 */

const EVENT_TYPES = new Set([
  "pre_purchase_impression",
  "pre_purchase_click",
  "pre_purchase_dismiss",
  "post_purchase_impression",
  "post_purchase_accept",
  "post_purchase_decline",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function normalizeShop(v) {
  if (!v || typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return s || null;
}

// CORS preflight (and a harmless answer for stray GETs).
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return json({ success: false, error: "POST only" }, 405);
};

export const action = async ({ request }) => {
  // Answer the CORS preflight here too — depending on the router, OPTIONS may be
  // dispatched to the action rather than the loader. (The storefront now sends a
  // text/plain "simple" request that skips the preflight, but keep this robust.)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // Everything here is best-effort: any failure returns success:false, never 500s
  // in a way that could surface to the shopper as a broken offer.
  try {
    if (request.method !== "POST") return json({ success: false, error: "POST only" }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "invalid JSON" }, 400);
    }

    const shop = normalizeShop(body.shopDomain);
    const eventType = typeof body.eventType === "string" ? body.eventType : null;
    if (!shop) return json({ success: false, error: "shopDomain required" }, 400);
    if (!eventType || !EVENT_TYPES.has(eventType)) {
      return json({ success: false, error: "invalid eventType" }, 400);
    }

    // The shop must be installed (Event.shop is a FK to Store).
    const store = await prisma.store.findUnique({ where: { shop }, select: { shop: true } });
    if (!store) return json({ success: false, error: "shop not installed" }, 200);

    // Resolve/validate the funnel + offer FKs so a stale or missing id can never
    // fail the insert.
    let offerId = typeof body.offerId === "string" && body.offerId ? body.offerId : null;
    let funnelId = typeof body.funnelId === "string" && body.funnelId ? body.funnelId : null;

    if (offerId) {
      const o = await prisma.offer.findFirst({ where: { id: offerId, shop }, select: { id: true, funnelId: true } });
      if (o) {
        offerId = o.id;
        if (!funnelId) funnelId = o.funnelId;
      } else {
        offerId = null;
      }
    }
    if (funnelId) {
      const f = await prisma.funnel.findFirst({ where: { id: funnelId, shop }, select: { id: true } });
      if (!f) funnelId = null;
    }

    // Best-effort enrichment when the caller couldn't supply ids (the storefront
    // config feed doesn't carry them). Never fatal.
    if (!offerId) {
      try {
        if (eventType.startsWith("pre_purchase")) {
          const r = await resolvePrePurchaseOffer(shop);
          if (r?.offer) {
            offerId = r.offer.id;
            funnelId = funnelId || r.funnel?.id || r.offer.funnelId || null;
          }
        } else if (eventType.startsWith("post_purchase")) {
          const r = await resolvePostPurchaseOffer(shop);
          if (r?.main) {
            offerId = r.main.id;
            funnelId = funnelId || r.funnel?.id || r.main.funnelId || null;
          }
        }
      } catch {
        // ignore — the event is still recorded without the offer link
      }
    }

    // `productId` has no column → fold into metadata.
    const metadata = { ...(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}) };
    if (body.productId != null && body.productId !== "") metadata.productId = String(body.productId);

    await prisma.event.create({
      data: {
        shop,
        type: eventType,
        funnelId,
        offerId,
        variantId: body.variantId != null && body.variantId !== "" ? String(body.variantId) : null,
        orderId: body.orderId != null && body.orderId !== "" ? String(body.orderId) : null,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      },
    });

    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error?.message || "track failed" }, 200);
  }
};
