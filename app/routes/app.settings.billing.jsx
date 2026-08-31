// Plan & Billing — DISPLAY ONLY. Ported from RevLift's BillingSettings tier
// cards, adapted to shadcn + the Store model. The real Shopify Billing API
// integration (creating subscriptions / charges) is a SEPARATE later step; the
// "upgrade" buttons here are non-functional placeholders (see handleUpgrade).
/* eslint-disable react/prop-types */
import { useLoaderData } from "react-router";
import { toast } from "sonner";
import { authenticate } from "../shopify.server";
import { getStore } from "../models/store.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";

// Plan tiers mirror RevLift's (name / monthly price / monthly-revenue cap).
const TIERS = [
  { name: "FREE", price: 0, maxRev: "$500", features: ["1 funnel", "Post-purchase upsells", "Basic analytics"] },
  { name: "STARTER", price: 8, maxRev: "$2,000", features: ["3 funnels", "A/B testing (soon)", "Email support"] },
  { name: "GROWTH", price: 25, maxRev: "$5,000", features: ["10 funnels", "Advanced analytics", "Priority support"] },
  { name: "SCALE", price: 59, maxRev: "$10,000", features: ["Unlimited funnels", "All offer types", "Priority support"] },
  { name: "PRO", price: 99, maxRev: "$20,000", features: ["Everything in Scale", "Custom branding", "Dedicated support"] },
  { name: "ENTERPRISE", price: 300, maxRev: "Unlimited", features: ["Everything in Pro", "SLA", "Account manager"] },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let store = null;
  try {
    store = await getStore(shop);
  } catch {
    // Store table may not exist yet — render FREE defaults.
  }

  return {
    currentPlan: store?.currentPlan ?? "FREE",
    isInternal: Boolean(store?.isInternal),
    monthlyRevenue: Number(store?.monthlyRevenue ?? 0),
    currency: store?.currency ?? "USD",
  };
};

export default function BillingSettings() {
  const { currentPlan, isInternal, monthlyRevenue, currency } = useLoaderData();

  const fmt = (n) =>
    Number(n).toLocaleString("en-US", { style: "currency", currency: currency || "USD" });

  // PLACEHOLDER: real upgrades require the Shopify Billing API (appSubscriptionCreate
  // + a return/confirmation flow). That's a separate approved step — for now this
  // just informs the merchant. Do NOT wire a real charge here.
  const handleUpgrade = (tierName) => {
    toast.info(`Upgrades are coming soon — ${tierName} isn't available to purchase yet.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plan &amp; Billing</h1>
        <p className="text-muted-foreground">Manage your subscription</p>
      </div>

      {isInternal ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Internal — Free forever</h3>
            </div>
            <p className="text-muted-foreground">
              Internal store detected. All features included at no charge.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current plan summary */}
          <Card>
            <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-xl font-bold text-foreground">{currentPlan}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Revenue this month</p>
                <p className="text-xl font-bold text-foreground">{fmt(monthlyRevenue)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tier cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Available Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {TIERS.map((tier) => {
                  const isCurrent = currentPlan === tier.name;
                  return (
                    <div
                      key={tier.name}
                      className={`rounded-xl border p-5 flex flex-col ${
                        isCurrent ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{tier.name}</p>
                        {isCurrent && <Badge>Current</Badge>}
                      </div>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        ${tier.price}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Up to {tier.maxRev} monthly revenue</p>
                      <ul className="mt-4 space-y-1.5 flex-1">
                        {tier.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={isCurrent ? "outline" : "default"}
                        className="mt-4 w-full"
                        disabled={isCurrent}
                        onClick={() => handleUpgrade(tier.name)}
                      >
                        {isCurrent ? "Current plan" : "Upgrade"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Plan changes aren&rsquo;t available yet — billing is display-only in this version.
                Paid subscriptions via Shopify Billing are coming soon.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
