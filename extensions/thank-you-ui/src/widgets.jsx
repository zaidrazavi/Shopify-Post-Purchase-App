// Shared presentational renderer for the thank-you / order-status widgets.
// Uses Shopify's <s-*> web components (registered by the entry's
// `import '@shopify/ui-extensions/preact'`). Returns a Preact element tree, or
// null when there's nothing to show. Kept compact (64KB gzip budget/extension).
//
// Layout is ours to control (sections, grid, spacing, image sizing, button
// variant). Colors + fonts are controlled by the merchant's checkout branding
// (Shopify-locked) — we don't set those.

function money(v) {
  if (v == null || v === "") return "";
  return "$" + v;
}

function ProductCard({ product, shopDomain }) {
  const p = product;
  return (
    <s-stack border="base" borderRadius="base" padding="base" gap="base">
      <s-grid gridTemplateColumns="72px 1fr" gap="base" alignItems="center">
        {p.image ? (
          <s-image
            src={p.image}
            alt={p.title || ""}
            aspectRatio="1"
            objectFit="cover"
            borderRadius="base"
          />
        ) : (
          <s-stack />
        )}
        <s-stack gap="tight">
          <s-text type="strong">{p.title || ""}</s-text>
          <s-stack direction="inline" gap="tight" alignItems="center">
            {p.compareAtPrice ? <s-text type="small">{money(p.compareAtPrice)}</s-text> : null}
            <s-text type="strong">{money(p.price)}</s-text>
          </s-stack>
          {p.variantId != null ? (
            <s-button
              href={`https://${shopDomain}/cart/${p.variantId}:1`}
              target="_blank"
              variant="primary"
              inlineSize="auto"
            >
              Buy now
            </s-button>
          ) : null}
        </s-stack>
      </s-grid>
    </s-stack>
  );
}

export function renderWidgets(data, shopDomain) {
  if (!data || !data.enabled) return null;
  const w = data.widgets || {};
  const blocks = [];

  const pr = w.productRecommendations;
  if (pr && pr.enabled && Array.isArray(pr.products) && pr.products.length) {
    blocks.push(
      <s-section heading={pr.heading || "You might also like"} key="recs">
        <s-stack gap="base">
          {pr.products.map((p) => (
            <ProductCard key={String(p.variantId)} product={p} shopDomain={shopDomain} />
          ))}
        </s-stack>
      </s-section>
    );
  }

  const faq = w.faq;
  if (faq && faq.enabled && Array.isArray(faq.items) && faq.items.length) {
    blocks.push(
      <s-section heading={faq.heading || "FAQ"} key="faq">
        <s-stack gap="base">
          {faq.items.map((it, i) => (
            <s-stack gap="tight" key={"faq" + i}>
              <s-text type="strong">{it.q || ""}</s-text>
              <s-text>{it.a || ""}</s-text>
            </s-stack>
          ))}
        </s-stack>
      </s-section>
    );
  }

  const text = w.text;
  if (text && text.enabled && text.content) {
    blocks.push(
      <s-section key="text">
        <s-text>{text.content}</s-text>
      </s-section>
    );
  }

  const image = w.image;
  if (image && image.enabled && image.imageUrl) {
    blocks.push(
      <s-section key="image">
        <s-image src={image.imageUrl} alt="" objectFit="cover" borderRadius="base" />
      </s-section>
    );
  }

  if (!blocks.length) return null;
  return <s-stack gap="loose">{blocks}</s-stack>;
}
