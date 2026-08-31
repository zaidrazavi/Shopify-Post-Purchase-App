import prisma from "../db.server";

/**
 * Dashboard metrics. Aggregation logic adapted from RevLift's
 * useDashboardMetrics.ts, but as Prisma queries against the Event table
 * (scoped by shop) instead of the Supabase client.
 *
 * RevLift derives everything from `events`:
 *   - impressions  = events of type "impression"
 *   - conversions  = events of type "conversion" (their revenue is the upsell $)
 *   - revenue      = sum of conversion revenue
 * We mirror that. Money is returned as plain Numbers (Prisma Decimal isn't
 * directly serializable across the RR loader boundary).
 */

// "Aug 01" style label — matches RevLift's date-fns format("MMM dd") without
// pulling in date-fns.
function fmtDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// A zeroed metrics object with a full N-point flat chart. Used as the empty
// state and the try/catch fallback.
function emptyMetrics(days) {
  const dailyRevenue = [];
  for (let i = days - 1; i >= 0; i--) {
    dailyRevenue.push({ date: fmtDay(new Date(Date.now() - i * 86400000)), revenue: 0 });
  }
  return {
    totalRevenue: 0,
    totalOrders: 0,
    totalImpressions: 0,
    conversionRate: 0,
    aov: 0,
    dailyRevenue,
  };
}

/**
 * Live KPIs + 30-day revenue series for a shop.
 *
 * NOTE (temporary): the Phase 2 migration (Store/Funnel/Offer/Event/Billing) is
 * authored but not yet applied to the dev DB, so these tables may not exist.
 * The whole query is wrapped in try/catch: if it fails (e.g. Prisma P2021
 * "table does not exist"), we return all-zero metrics so the dashboard still
 * renders. Once the migration is deployed this fallback simply never triggers.
 */
export async function getDashboardMetrics(shop, days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  try {
    const [conv, impressions, convEvents] = await Promise.all([
      // Conversions: count + revenue sum, in window.
      prisma.event.aggregate({
        where: { shop, type: "conversion", createdAt: { gte: since } },
        _sum: { revenue: true },
        _count: true,
      }),
      // Impressions: count, in window.
      prisma.event.count({
        where: { shop, type: "impression", createdAt: { gte: since } },
      }),
      // Per-conversion rows for the daily buckets.
      prisma.event.findMany({
        where: { shop, type: "conversion", createdAt: { gte: since } },
        select: { createdAt: true, revenue: true },
      }),
    ]);

    const totalRevenue = Number(conv._sum.revenue ?? 0);
    const totalOrders = conv._count;
    const totalImpressions = impressions;
    const conversionRate = totalImpressions > 0 ? (totalOrders / totalImpressions) * 100 : 0;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Daily revenue buckets — pre-seed all N days at 0 so the chart is complete.
    const buckets = {};
    const order = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = fmtDay(new Date(Date.now() - i * 86400000));
      buckets[key] = 0;
      order.push(key);
    }
    for (const e of convEvents) {
      const key = fmtDay(new Date(e.createdAt));
      if (key in buckets) buckets[key] += Number(e.revenue ?? 0);
    }
    const dailyRevenue = order.map((date) => ({ date, revenue: buckets[date] }));

    return { totalRevenue, totalOrders, totalImpressions, conversionRate, aov, dailyRevenue };
  } catch (error) {
    // Tables not present yet (pre-migration) or any query failure — degrade to
    // zeros rather than crashing the dashboard. See NOTE above.
    // eslint-disable-next-line no-console
    console.warn("[metrics] falling back to zeros:", error?.message || error);
    return emptyMetrics(days);
  }
}
