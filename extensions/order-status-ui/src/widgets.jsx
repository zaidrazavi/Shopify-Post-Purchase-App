// Shared presentational renderer for the thank-you / order-status widgets.
// Uses Shopify's <s-*> web components (registered by the entry's
// `import '@shopify/ui-extensions/preact'`). Returns a Preact element tree, or
// null when there's nothing to show. Kept compact (64KB gzip budget/extension).

function money(v) {
  if (v == null || v === "") return "";
  return "$" + v;
}

export function renderWidgets(data, shopDomain) {
  if (!data || !data.enabled) return null;
  const w = data.widgets || {};
  const blocks = [];

  const pr = w.productRecommendations;
  if (pr && pr.enabled && Array.isArray(pr.products) && pr.products.length) {
    blocks.push(
      <s-stack gap="base" key="recs">
        <s-heading>{pr.heading || "You might also like"}</s-heading>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          {pr.products.map((p) => (
            <s-stack gap="tight" key={String(p.variantId)}>
              {p.image ? (
                <s-image src={p.image} alt={p.title || ""} aspectRatio="1" borderRadius="base" />
              ) : null}
              <s-text>{p.title || ""}</s-text>
              <s-stack direction="inline" gap="tight">
                {p.compareAtPrice ? <s-text tone="subdued">{money(p.compareAtPrice)}</s-text> : null}
                <s-text type="strong">{money(p.price)}</s-text>
              </s-stack>
              {p.variantId != null ? (
                <s-button
                  href={`https://${shopDomain}/cart/${p.variantId}:1`}
                  target="_blank"
                  variant="primary"
                >
                  Buy now
                </s-button>
              ) : null}
            </s-stack>
          ))}
        </s-grid>
      </s-stack>
    );
  }

  const faq = w.faq;
  if (faq && faq.enabled && Array.isArray(faq.items) && faq.items.length) {
    blocks.push(
      <s-stack gap="base" key="faq">
        <s-heading>{faq.heading || "FAQ"}</s-heading>
        {faq.items.map((it, i) => (
          <s-stack gap="tight" key={"faq" + i}>
            <s-text type="strong">{it.q || ""}</s-text>
            <s-text>{it.a || ""}</s-text>
          </s-stack>
        ))}
      </s-stack>
    );
  }

  const text = w.text;
  if (text && text.enabled && text.content) {
    blocks.push(
      <s-stack gap="base" key="text">
        <s-text>{text.content}</s-text>
      </s-stack>
    );
  }

  const image = w.image;
  if (image && image.enabled && image.imageUrl) {
    blocks.push(
      <s-stack gap="base" key="image">
        <s-image src={image.imageUrl} alt="" borderRadius="base" />
      </s-stack>
    );
  }

  if (!blocks.length) return null;
  return <s-stack gap="loose">{blocks}</s-stack>;
}
