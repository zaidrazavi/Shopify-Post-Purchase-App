/**
 * Read-only Shopify Admin GraphQL product/collection fetching for the product
 * picker. Uses the `admin` object from `authenticate.admin(request)` — i.e.
 * `admin.graphql(query, { variables })` → Response → `.json()` → { data, errors }.
 * Only the `read_products` scope is required (no writes, no inventory scope).
 *
 * Everything is mapped into the SAME shape the ported ShopifyProductPicker used
 * for its dummy data, so the UI needs minimal changes:
 *   product    = { id, title, image, price, compareAtPrice, variants[], vendor, type, status }
 *   variant    = { id, title, price, compareAtPrice, availableForSale, image }
 *   collection = { id, title, productCount, image }
 */

const money = (v) => (v == null || v === "" ? null : Number(v));

function mapProduct(node) {
  const variants = (node.variants?.nodes ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    price: money(v.price) ?? 0,
    compareAtPrice: money(v.compareAtPrice),
    availableForSale: !!v.availableForSale,
    image: v.image?.url ?? null,
  }));
  const prices = variants.map((v) => v.price).filter((n) => Number.isFinite(n));
  const price = prices.length ? Math.min(...prices) : 0;
  // Use the first variant's compare-at when it's actually higher than the price.
  const compareAtPrice =
    variants.find((v) => v.compareAtPrice != null && v.compareAtPrice > price)?.compareAtPrice ?? null;
  return {
    id: node.id,
    title: node.title,
    image: node.featuredImage?.url ?? null,
    price,
    compareAtPrice,
    variants,
    vendor: node.vendor ?? "",
    type: node.productType ?? "",
    status: (node.status ?? "active").toLowerCase(),
  };
}

async function run(admin, query, variables) {
  const resp = await admin.graphql(query, { variables });
  const json = await resp.json();
  if (json.errors) {
    const msg = Array.isArray(json.errors)
      ? json.errors.map((e) => e.message).join("; ")
      : json.errors.message || "GraphQL error";
    throw new Error(msg);
  }
  return json.data;
}

const PRODUCT_FIELDS = `
  id
  title
  vendor
  productType
  status
  featuredImage { url altText }
  variants(first: 100) {
    nodes { id title price compareAtPrice availableForSale image { url } }
  }
`;

/** Search products by query string (empty = most recent). */
export async function searchProducts(admin, query = "", limit = 50) {
  const gql = `#graphql
    query PickerProducts($first: Int!, $query: String) {
      products(first: $first, query: $query, sortKey: RELEVANCE) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }`;
  const data = await run(admin, gql, {
    first: limit,
    query: query && query.trim() ? query.trim() : null,
  });
  return (data.products?.nodes ?? []).map(mapProduct);
}

/** Fetch collections for the collection-based trigger picker. */
export async function getCollections(admin, limit = 50) {
  const gql = `#graphql
    query PickerCollections($first: Int!) {
      collections(first: $first, sortKey: TITLE) {
        nodes { id title image { url } productsCount { count } }
      }
    }`;
  const data = await run(admin, gql, { first: limit });
  return (data.collections?.nodes ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    productCount: c.productsCount?.count ?? 0,
    image: c.image?.url ?? null,
  }));
}

/** Fetch specific products by their GIDs (to show details of already-saved offers). */
export async function getProductsByIds(admin, ids = []) {
  const list = (ids || []).filter(Boolean);
  if (list.length === 0) return [];
  const gql = `#graphql
    query PickerProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { ${PRODUCT_FIELDS} }
      }
    }`;
  const data = await run(admin, gql, { ids: list });
  return (data.nodes ?? []).filter(Boolean).map(mapProduct);
}
