// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// KPI cards mirror RevLift's dashboard (revlift.mp4). Values are placeholders
// until analytics tracking is added (a separate, deferred task).
const KPIS = [
  { label: "Revenue", icon: "cash-dollar" },
  { label: "Conversions", icon: "chart-line" },
  { label: "Avg Upsell Value", icon: "receipt-dollar" },
  { label: "Active Funnels", icon: "chart-funnel" },
];

// Read-only overview of our two live surfaces (we don't have RevLift's
// multi-funnel model, so this is a static 2-row table, not a dynamic list).
const SURFACES = [
  { name: "Post-purchase offer", href: "/app/settings" },
  { name: "Checkout popup", href: "/app/checkout-popup" },
];

export default function Index() {
  return (
    <s-page heading="Dashboard">
      {/* KPI summary cards */}
      <s-section>
        <s-stack direction="block" gap="base">
          <s-grid gridTemplateColumns="repeat(4, minmax(0, 1fr))" gap="base">
            {KPIS.map((k) => (
              <KpiCard key={k.label} label={k.label} icon={k.icon} />
            ))}
          </s-grid>
          <s-stack direction="inline" gap="tight" alignItems="center">
            <s-badge tone="info" icon="clock">
              Coming soon
            </s-badge>
            <s-text type="small">
              Live metrics appear here once analytics tracking is added.
            </s-text>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Revenue overview — placeholder (no analytics data yet) */}
      <s-section heading="Revenue overview">
        <s-box
          padding="large"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="tight" alignItems="center">
            <s-icon type="chart-line" tone="neutral" size="large" />
            <s-text type="strong">Analytics coming soon</s-text>
            <s-text type="small">
              Revenue over time will chart here once tracking is added.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      {/* Surfaces overview — read-only table echoing RevLift's funnels list */}
      <s-section heading="Your surfaces">
        <s-table>
          <s-table-header-row>
            <s-table-header>Name</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header>Views</s-table-header>
            <s-table-header>Conversion</s-table-header>
            <s-table-header>Revenue</s-table-header>
            <s-table-header>Rev/Visit</s-table-header>
            <s-table-header>Actions</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {SURFACES.map((surface) => (
              <s-table-row key={surface.name}>
                <s-table-cell>
                  <s-text type="strong">{surface.name}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-badge tone="neutral">Configure →</s-badge>
                </s-table-cell>
                <s-table-cell>—</s-table-cell>
                <s-table-cell>—</s-table-cell>
                <s-table-cell>—</s-table-cell>
                <s-table-cell>—</s-table-cell>
                <s-table-cell>
                  <s-link href={surface.href}>Edit</s-link>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      {/* Getting started (aside) */}
      <s-section slot="aside" heading="Getting started">
        <s-paragraph>
          Configure your{" "}
          <s-link href="/app/settings">post-purchase offer</s-link> and{" "}
          <s-link href="/app/checkout-popup">checkout popup</s-link>: pick a
          product, customize the copy and styling, then enable it.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

// Placeholder KPI card — icon + label + em-dash value (real numbers pending
// the analytics/events task).
function KpiCard({ label, icon }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="none">
        <s-stack direction="inline" gap="tight" alignItems="center">
          <s-icon type={icon} tone="neutral" />
          <s-text type="small">{label}</s-text>
        </s-stack>
        <s-text type="strong">—</s-text>
      </s-stack>
    </s-box>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
