// Overview for the post-purchase offer — a RevLift-style funnel-flow tree.
// Read-only: it shows the Upsell/Downsell nodes and links to the full editor
// (app.settings.edit) per step. No data mutation happens here.
/* eslint-disable react/prop-types */
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getOfferConfig } from "../models/offer.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await getOfferConfig(session.shop);
  return { config };
};

export default function OfferOverview() {
  const { config } = useLoaderData();
  const navigate = useNavigate();

  const mainProduct = config.variantId
    ? {
        title: config.productTitle,
        image: config.productImage,
        price: config.productPrice,
      }
    : null;
  const downsellProduct = config.downsellVariantId
    ? {
        title: config.downsellProductTitle,
        image: config.downsellProductImage,
        price: config.downsellProductPrice,
      }
    : null;

  const isLive = Boolean(config.enabled && config.variantId);
  const downsellActive = Boolean(
    config.downsellEnabled && config.downsellVariantId,
  );

  const editUpsell = () => navigate("/app/settings/edit?step=upsell");
  const editDownsell = () => navigate("/app/settings/edit?step=downsell");

  return (
    <s-page heading="Post-purchase offer">
      <s-button slot="primary-action" icon="edit" onClick={editUpsell}>
        Edit offer
      </s-button>

      {/* Status */}
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge
            tone={isLive ? "success" : "neutral"}
            icon={isLive ? "check-circle" : "disabled"}
          >
            {isLive ? "Offer is Live" : "Offer is Off"}
          </s-badge>
          <s-text>
            Shown after checkout completes. Edit a step below to configure it.
          </s-text>
        </s-stack>
      </s-section>

      {/* Funnel flow — Upsell -> accepted / declined -> Downsell */}
      <s-section heading="Funnel flow">
        <s-stack direction="block" gap="base" alignItems="center">
          <FlowNode
            badge="Upsell · Step 1"
            badgeTone="info"
            badgeIcon="cart-sale"
            product={mainProduct}
            emptyText="No upsell product selected yet."
            onEdit={editUpsell}
          />

          <s-grid
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="base"
            alignItems="start"
          >
            <s-grid-item>
              <s-stack direction="block" gap="tight" alignItems="center">
                <FlowBranch label="Accepted" tone="success" />
                <FlowEnd label="Order complete" icon="check-circle" />
              </s-stack>
            </s-grid-item>
            <s-grid-item>
              <s-stack direction="block" gap="tight" alignItems="center">
                <FlowBranch label="Declined" tone="critical" />
                {downsellActive ? (
                  <FlowNode
                    badge="Downsell · Step 2"
                    badgeTone="warning"
                    badgeIcon="cart-down"
                    product={downsellProduct}
                    emptyText="No downsell product selected yet."
                    onEdit={editDownsell}
                  />
                ) : (
                  <FlowEnd label="Thank You page" icon="order-fulfilled" />
                )}
              </s-stack>
            </s-grid-item>
          </s-grid>
        </s-stack>
      </s-section>
    </s-page>
  );
}

// ---- Funnel-flow diagram helpers (node cards + labeled arrows) ----

// Compact placeholder stats inside a flow node (real metrics pending the
// analytics/events task).
function FlowStats() {
  return (
    <s-stack direction="inline" gap="base">
      <s-text type="small">— views</s-text>
      <s-text type="small">— revenue</s-text>
      <s-text type="small">—/visit</s-text>
      <s-text type="small">— conv.</s-text>
    </s-stack>
  );
}

// A product node: label badge + Edit button + product mini-card + stats.
function FlowNode({ badge, badgeTone, badgeIcon, product, emptyText, onEdit }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="tight">
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-badge tone={badgeTone} icon={badgeIcon}>
            {badge}
          </s-badge>
          <s-button variant="tertiary" icon="edit" onClick={onEdit}>
            Edit
          </s-button>
        </s-stack>
        {product ? (
          <s-stack direction="inline" gap="base" alignItems="center">
            {product.image ? (
              <s-thumbnail src={product.image} alt={product.title ?? ""} size="base" />
            ) : null}
            <s-stack direction="block" gap="none">
              <s-text type="strong">{product.title}</s-text>
              {product.price ? <s-text type="small">{product.price}</s-text> : null}
            </s-stack>
          </s-stack>
        ) : (
          <s-text type="small">{emptyText}</s-text>
        )}
        <FlowStats />
      </s-stack>
    </s-box>
  );
}

// A labeled branch arrow — green "Accepted" / red "Declined".
function FlowBranch({ label, tone }) {
  return (
    <s-stack direction="block" gap="none" alignItems="center">
      <s-icon type="arrow-down" tone={tone} />
      <s-badge tone={tone}>{label}</s-badge>
    </s-stack>
  );
}

// A terminal node — order complete / thank-you.
function FlowEnd({ label, icon }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="inline" gap="tight" alignItems="center">
        <s-icon type={icon} tone="neutral" />
        <s-text type="small">{label}</s-text>
      </s-stack>
    </s-box>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
