import prisma from "../db.server";
import { statsByKey } from "./funnel.server";

/**
 * Analytics aggregation from the Event table (single source of truth), scoped by
 * shop and an optional funnel type. Everything is windowed to the last N days.
 *
 * Reuses statsByKey from funnel.server.js for the per-funnel / per-offer
 * breakdowns (shared, not duplicated) — passing a `since` date for the window.
 *
 * NOTE: only post-purchase offers are instrumented in this cut (impressions via
 * /api/offer, conversions via /api/sign-changeset). Pre-purchase isn't tracked
 * yet, so its numbers will read as zero — the page labels this honestly.
 *
 * The whole thing is wrapped in try/catch → returns a zeroed structure so the
 * page renders even when tables are empty or a shop has no events.
 */

function fmtDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function seedSeries(days) {
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    series.push({ date: fmtDay(new Date(Date.now() - i * 86400000)), revenue: 0, conversions: 0 });
  }
  return series;
}

function emptyAnalytics(days) {
  return {
    totals: { impressions: 0, conversions: 0, conversionRate: 0, revenue: 0, aov: 0 },
    series: seedSeries(days),
    funnels: [],
    offers: [],
    hasData: false,
    days,
  };
}

// Conversion rate as a percentage, or null when there are no impressions (so the
// UI can render "—" instead of a divide-by-zero / infinite rate — e.g. downsell
// offers, which get conversions but no server-side impressions).
function rate(conversions, impressions) {
  if (!impressions) return null;
  return Number(((conversions / impressions) * 100).toFixed(2));
}

export async function getAnalytics(shop, { days = 30, funnelType = null } = {}) {
  const since = new Date(Date.now() - days * 86400000);

  try {
    // Scope: which funnels count. When a type filter is set, restrict events to
    // that type's funnels (Event has funnelId but not type).
    const funnels = await prisma.funnel.findMany({
      where: { shop, ...(funnelType ? { type: funnelType } : {}) },
      select: { id: true, name: true, type: true, status: true },
    });
    const funnelIds = funnels.map((f) => f.id);

    // If a type filter is active but the shop has no such funnels, nothing to show.
    if (funnelType && funnelIds.length === 0) return emptyAnalytics(days);

    const eventScope = {
      shop,
      createdAt: { gte: since },
      ...(funnelType ? { funnelId: { in: funnelIds } } : {}),
    };

    const [impressions, convAgg, convRows] = await Promise.all([
      prisma.event.count({ where: { ...eventScope, type: "impression" } }),
      prisma.event.aggregate({
        where: { ...eventScope, type: "conversion" },
        _count: true,
        _sum: { revenue: true },
      }),
      prisma.event.findMany({
        where: { ...eventScope, type: "conversion" },
        select: { createdAt: true, revenue: true },
      }),
    ]);

    const conversions = convAgg._count;
    const revenue = Number(convAgg._sum.revenue ?? 0);
    const totals = {
      impressions,
      conversions,
      conversionRate: rate(conversions, impressions) ?? 0,
      revenue,
      aov: conversions > 0 ? revenue / conversions : 0,
    };

    // Time series: revenue + conversions per day, zero-filled.
    const buckets = {};
    const series = seedSeries(days);
    for (const p of series) buckets[p.date] = p;
    for (const e of convRows) {
      const key = fmtDay(new Date(e.createdAt));
      if (buckets[key]) {
        buckets[key].revenue += Number(e.revenue ?? 0);
        buckets[key].conversions += 1;
      }
    }

    // Per-funnel breakdown (windowed), sorted by revenue then impressions.
    const funnelStats = await statsByKey(shop, "funnelId", funnelIds, { since });
    const funnelRows = funnels
      .map((f) => {
        const s = funnelStats.get(f.id) || { impressions: 0, conversions: 0, revenue: 0 };
        return {
          id: f.id,
          name: f.name,
          type: f.type,
          status: f.status,
          impressions: s.impressions,
          conversions: s.conversions,
          revenue: Number(s.revenue ?? 0),
          conversionRate: rate(s.conversions, s.impressions),
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.impressions - a.impressions);

    // Top offers (windowed): only those with activity, top 10 by revenue then conv.
    const offers = await prisma.offer.findMany({
      where: { funnelId: { in: funnelIds } },
      select: { id: true, headline: true, section: true, funnel: { select: { name: true, type: true } } },
    });
    const offerStats = await statsByKey(shop, "offerId", offers.map((o) => o.id), { since });
    const offerRows = offers
      .map((o) => {
        const s = offerStats.get(o.id) || { impressions: 0, conversions: 0, revenue: 0 };
        return {
          id: o.id,
          headline: o.headline,
          section: o.section,
          funnelName: o.funnel?.name ?? "",
          funnelType: o.funnel?.type ?? "",
          impressions: s.impressions,
          conversions: s.conversions,
          revenue: Number(s.revenue ?? 0),
          conversionRate: rate(s.conversions, s.impressions),
        };
      })
      .filter((o) => o.impressions > 0 || o.conversions > 0)
      .sort((a, b) => b.revenue - a.revenue || b.conversions - a.conversions)
      .slice(0, 10);

    return {
      totals,
      series,
      funnels: funnelRows,
      offers: offerRows,
      hasData: impressions > 0 || conversions > 0,
      days,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] falling back to zeros:", error?.message || error);
    return emptyAnalytics(days);
  }
}
