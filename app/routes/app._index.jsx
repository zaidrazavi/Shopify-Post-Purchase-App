// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getDashboardMetrics } from "../models/metrics.server";
import { getStore } from "../models/store.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, BarChart3 } from "lucide-react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // getDashboardMetrics self-guards (returns zeros if the Phase 2 tables don't
  // exist yet). Currency comes from the Store row when available.
  const metrics = await getDashboardMetrics(shop, 30);
  let currency = "USD";
  try {
    const store = await getStore(shop);
    if (store?.currency) currency = store.currency;
  } catch {
    // Store table may not exist yet (pre Phase 2 migration) — default USD.
  }

  return { metrics, currency };
};

function MetricCard({ label, value, sub, icon: Icon }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { metrics, currency } = useLoaderData();

  const fmt = (n) =>
    Number(n).toLocaleString("en-US", { style: "currency", currency: currency || "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to DRIMS Upsell Pro</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={fmt(metrics.totalRevenue)}
          sub="Last 30 days"
          icon={DollarSign}
        />
        <MetricCard
          label="Total Orders"
          value={String(metrics.totalOrders)}
          sub="Conversions, last 30 days"
          icon={ShoppingCart}
        />
        <MetricCard
          label="Conversion Rate"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          sub="Impressions → orders"
          icon={TrendingUp}
        />
        <MetricCard
          label="AOV"
          value={fmt(metrics.aov)}
          sub="Per accepted offer"
          icon={BarChart3}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Revenue — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.dailyRevenue.every((d) => d.revenue === 0) ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm text-muted-foreground">
                No revenue data yet. Create a funnel and start selling!
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={metrics.dailyRevenue}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: 13,
                  }}
                  formatter={(value) => [fmt(value), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
