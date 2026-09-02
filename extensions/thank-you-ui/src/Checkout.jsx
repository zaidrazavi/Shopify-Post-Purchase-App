import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { renderWidgets } from './widgets.jsx';

// Hardcoded prod backend (like the other extensions). For `shopify app dev`,
// temporarily swap this for the printed Cloudflare tunnel URL.
const APP_URL = "https://shopify-post-purchase-app.onrender.com";

export default async () => {
  render(<Extension />, document.body);
};

function getShopDomain() {
  // `shopify.shop` is a plain object per the 2026-07 type defs; fall back to
  // `.value` in case the runtime wraps it as a signal.
  const s = shopify?.shop;
  return s?.myshopifyDomain ?? s?.value?.myshopifyDomain ?? null;
}

function Extension() {
  const [data, setData] = useState(null);
  const shopDomain = getShopDomain();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!shopDomain) return;
      try {
        const res = await fetch(`${APP_URL}/api/thank-you?shop=${encodeURIComponent(shopDomain)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Fail-safe: render nothing on any network/parse error.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [shopDomain]);

  if (!data) return null;
  return renderWidgets(data, shopDomain);
}
