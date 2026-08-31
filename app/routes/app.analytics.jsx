// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { getAnalytics } from "../models/analytics.server";
import { getStore } from "../models/store.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, BarChart3, Eye, Info } from "lucide-react";

const ALLOWED_DAYS = [7, 30, 90];
const FUNNEL_TYPES = ["pre-purchase", "post-purchase", "thank-you"];
const TYPE_LABEL = {
  "pre-purchase": "Pre-Purchase",
  "post-purchase": "Post-Purchase",
  "thank-you": "Thank You",
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const daysRaw = parseInt(url.searchParams.get("days"), 10);
  const days = ALLOWED_DAYS.includes(daysRaw) ? daysRaw : 30;
  const typeRaw = url.searchParams.get("type");
  const funnelType = FUNNEL_TYPES.includes(typeRaw) ? typeRaw : null;

  const analytics = await getAnalytics(shop, { days, funnelType });

  let currency = "USD";
  try {
    const store = await getStore(shop);
    if (store?.currency) currency = store.currency;
  } catch {
    // Store table may not exist yet — default USD.
  }

  return { analytics, currency, days, funnelType };
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

export default function Analytics() {
  const { analytics, currency, days, funnelType } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fmt = (n) =>
    Number(n).toLocaleString("en-US", { style: "currency", currency: currency || "USD" });
  const pct = (r) => (r == null ? "—" : `${r.toFixed(1)}%`);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value == null) next.delete(key);
    else next.set(key, String(value));
    navigate(`?${next.toString()}`);
  };

  const { totals, series, funnels, offers, hasData } = analytics;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Track your upsell performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={funnelType ?? "all"}
            onValueChange={(v) => setParam("type", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All funnel types</SelectItem>
              {FUNNEL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border p-0.5">
            {ALLOWED_DAYS.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "secondary" : "ghost"}
                className="h-8 px-3 text-xs"
                onClick={() => setParam("days", d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Honest labeling: pre-purchase not tracked yet */}
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Currently only <strong>post-purchase</strong> offers are tracked.
          &ldquo;Eligible impressions&rdquo; count each time an offer was served to a buyer.
          Pre-purchase analytics are coming soon — a pre-purchase funnel showing zero here isn&rsquo;t
          inactive, it just isn&rsquo;t measured yet.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Eligible Impressions"
          value={totals.impressions.toLocaleString()}
          sub={`Offers served, last ${days} days`}
          icon={Eye}
        />
        <MetricCard
          label="Conversions"
          value={totals.conversions.toLocaleString()}
          sub={`Accepted, last ${days} days`}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Conversion Rate"
          value={`${totals.conversionRate.toFixed(1)}%`}
          sub="Impressions → accepted"
          icon={TrendingUp}
        />
        <MetricCard
          label="Revenue"
          value={fmt(totals.revenue)}
          sub={`Last ${days} days`}
          icon={DollarSign}
        />
        <MetricCard
          label="AOV"
          value={fmt(totals.aov)}
          sub="Per accepted offer"
          icon={BarChart3}
        />
      </div>

      {!hasData ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="rounded-full bg-muted p-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No data yet</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Analytics will populate as your offers get impressions and conversions.
              Activate a post-purchase funnel and start selling to see performance here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Time series */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Revenue &amp; Conversions — Last {days} Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={series}>
                  <defs>
                    <linearGradient id="aRev" x1="0" y1="0" x2="0" y2="1">
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
                    yAxisId="rev"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    yAxisId="conv"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 13,
                    }}
                    formatter={(value, name) =>
                      name === "Revenue" ? [fmt(value), name] : [value, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#aRev)"
                  />
                  <Line
                    yAxisId="conv"
                    type="monotone"
                    dataKey="conversions"
                    name="Conversions"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-funnel breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Funnel Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funnel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Impressions</TableHead>
                    <TableHead className="text-center">Conversions</TableHead>
                    <TableHead className="text-center">Conv. Rate</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No funnels in this view.
                      </TableCell>
                    </TableRow>
                  ) : (
                    funnels.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-foreground">{f.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {TYPE_LABEL[f.type] ?? f.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {f.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {f.conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {pct(f.conversionRate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(f.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top offers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Top Offers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead>Funnel</TableHead>
                    <TableHead className="text-center">Impressions</TableHead>
                    <TableHead className="text-center">Conversions</TableHead>
                    <TableHead className="text-center">Conv. Rate</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No offers with activity yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    offers.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium text-foreground max-w-[220px] truncate">
                          {o.headline || "Untitled offer"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{o.funnelName}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {o.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {o.conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {pct(o.conversionRate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(o.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
