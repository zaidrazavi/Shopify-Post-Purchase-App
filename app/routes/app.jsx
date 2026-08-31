import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { AppLayout } from "../components/AppLayout";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Shopify admin's native left-nav menu (App Bridge). The first link must
          have rel="home". This is IN ADDITION to the in-app AppSidebar. */}
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/funnels/pre-purchase">Pre-Purchase</a>
        <a href="/app/funnels/post-purchase">Post-Purchase</a>
        <a href="/app/funnels/thank-you">Thank You</a>
        <a href="/app/analytics">Analytics</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <AppLayout />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
