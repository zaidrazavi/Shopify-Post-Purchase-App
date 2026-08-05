import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Drims Post Purchase">
      <s-section heading="Increase average order value">
        <s-paragraph>
          Drims Post Purchase adds two upsell moments to your store. Configure
          each one below.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/settings">Post-purchase offer</s-link> — shown
            after checkout completes, with an optional downsell if the buyer
            declines.
          </s-list-item>
          <s-list-item>
            <s-link href="/app/checkout-popup">Checkout popup</s-link> — shown
            when the buyer clicks Checkout in the cart.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Getting started">
        <s-paragraph>
          Pick a product for each offer, customize the copy and styling, then
          enable it. Changes save instantly and go live on your storefront.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
