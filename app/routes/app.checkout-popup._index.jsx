// Overview screen for the pre-purchase checkout popup — mirrors the One Click
// Upsell pattern: a Trigger summary, an offer card (product + placeholder stats),
// and the enable/disable toggle. The full editor lives at ./edit.
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPopupConfig, savePopupConfig } from "../models/pre-purchase-popup.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await getPopupConfig(session.shop);
  return { config };
};

// Only toggles `enabled` here — every other field is edited on the ./edit page.
// We re-save the full current config (round-tripped through savePopupConfig's
// normalizer) so the upsert doesn't reset the other columns to defaults.
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const enabled = form.get("enabled") === "true";

  const current = await getPopupConfig(session.shop);
  if (enabled && !current.variantId) {
    return {
      ok: false,
      error: "Select a product in the editor before enabling the popup.",
    };
  }

  const saved = await savePopupConfig(session.shop, { ...current, enabled });
  return { ok: true, config: saved };
};

// Placeholder metrics — analytics tracking isn't wired yet, so each shows an em
// dash. Matches the "Coming soon" pattern on the post-purchase Offer settings page.
const STAT_TILES = [
  { label: "Views", icon: "view" },
  { label: "Conversion", icon: "chart-line" },
  { label: "Revenue", icon: "cash-dollar" },
  { label: "Rev./Visit", icon: "chart-vertical" },
];

export default function CheckoutPopupOverview() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const hasProduct = Boolean(config.variantId);
  const [enabled, setEnabled] = useState(Boolean(config.enabled));
  const isLive = enabled && hasProduct;

  const pageRef = useRef(null);
  const switchRef = useRef(null);
  // Last value we acted on — updated synchronously so the paired input+change
  // events fired by one physical toggle don't double-submit.
  const lastSent = useRef(Boolean(config.enabled));

  // The delegated listener reads the latest state/props via a ref, so the
  // handler attached once (empty deps) never goes stale.
  const latest = useRef();
  latest.current = { hasProduct, fetcher, shopify };

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return undefined;
    const handler = (event) => {
      if (event.target?.name !== "enabled") return;
      const next = Boolean(event.target.checked);
      if (next === lastSent.current) return; // dedupe the input/change pair
      lastSent.current = next;
      const s = latest.current;
      if (next && !s.hasProduct) {
        s.shopify.toast.show(
          "Select a product in the editor before enabling the popup",
          { isError: true },
        );
        // The switch is uncontrolled, so resetting the DOM element sticks.
        event.target.checked = false;
        lastSent.current = false;
        setEnabled(false);
        return;
      }
      setEnabled(next);
      s.fetcher.submit({ enabled: String(next) }, { method: "POST" });
    };
    // Polaris s-switch surfaces the toggle via both `input` and `change`; bind
    // both (as the editor does) so the flip is always captured.
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    return () => {
      el.removeEventListener("input", handler);
      el.removeEventListener("change", handler);
    };
  }, []);

  useEffect(() => {
    if (fetcher.data?.ok) {
      // Reconcile with the persisted value the server returned (source of truth).
      const savedEnabled = Boolean(fetcher.data.config.enabled);
      lastSent.current = savedEnabled;
      setEnabled(savedEnabled);
      if (switchRef.current) switchRef.current.checked = savedEnabled;
      shopify.toast.show(savedEnabled ? "Popup enabled" : "Popup disabled");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
      lastSent.current = false;
      setEnabled(false);
      if (switchRef.current) switchRef.current.checked = false;
    }
  }, [fetcher.data, shopify]);

  const goEdit = () => navigate("/app/checkout-popup/edit");

  return (
    <s-page ref={pageRef} heading="Checkout popup">
      <s-button slot="primary-action" icon="edit" onClick={goEdit}>
        Edit popup
      </s-button>

      {/* Status + enable toggle */}
      <s-section>
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge
              tone={isLive ? "success" : "neutral"}
              icon={isLive ? "check-circle" : "disabled"}
            >
              {isLive ? "Popup is Live" : "Popup is Off"}
            </s-badge>
            <s-switch
              ref={switchRef}
              name="enabled"
              label="Enable pre-purchase popup"
              defaultChecked={config.enabled}
              details="Shows when the buyer clicks Checkout in the cart. When off, nothing is shown."
            />
          </s-stack>
        </s-stack>
      </s-section>

      {/* Trigger */}
      <s-section heading="Trigger">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-icon type="cart" tone="neutral" />
          <s-text>
            Shows when the <s-text type="strong">Checkout</s-text> button is
            clicked in the cart.
          </s-text>
        </s-stack>
      </s-section>

      {/* Offer summary card */}
      <s-section heading="Pre-purchase offer">
        <s-stack direction="block" gap="base">
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="space-between"
          >
            {hasProduct ? (
              <s-stack direction="inline" gap="base" alignItems="center">
                {config.productImage ? (
                  <s-thumbnail
                    src={config.productImage}
                    alt={config.productTitle ?? ""}
                    size="large"
                  />
                ) : null}
                <s-stack direction="block" gap="none">
                  <s-text type="strong">
                    {config.productTitle || "Selected product"}
                  </s-text>
                  {config.productPrice ? (
                    <s-text>{config.productPrice}</s-text>
                  ) : null}
                </s-stack>
              </s-stack>
            ) : (
              <s-stack direction="block" gap="none">
                <s-text type="strong">No product selected yet</s-text>
                <s-text>
                  Open the editor to choose the product to offer in the popup.
                </s-text>
              </s-stack>
            )}
            <s-button
              variant="tertiary"
              icon="edit"
              accessibilityLabel="Edit popup"
              onClick={goEdit}
            >
              Edit
            </s-button>
          </s-stack>

          <s-divider />

          <StatRow />
        </s-stack>
      </s-section>
    </s-page>
  );
}

function StatRow() {
  return (
    <s-stack direction="block" gap="tight">
      <s-grid
        gridTemplateColumns="repeat(4, minmax(0, 1fr))"
        gap="base"
      >
        {STAT_TILES.map((stat) => (
          <StatTile key={stat.label} label={stat.label} icon={stat.icon} />
        ))}
      </s-grid>
      <s-stack direction="inline" gap="tight" alignItems="center">
        <s-badge tone="info" icon="clock">
          Coming soon
        </s-badge>
        <s-text>Live stats will appear here once tracking is added.</s-text>
      </s-stack>
    </s-stack>
  );
}

function StatTile({ label, icon }) {
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
          <s-text>{label}</s-text>
        </s-stack>
        <s-text type="strong">—</s-text>
      </s-stack>
    </s-box>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
