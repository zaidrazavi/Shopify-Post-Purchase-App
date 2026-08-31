import { authenticate } from "../shopify.server";
import { searchProducts, getCollections } from "../models/shopify-products.server";

/**
 * Authenticated (embedded-app) resource route that feeds the product picker.
 *
 *   GET /api/products?query=<search>          -> { products: [...] }
 *   GET /api/products?mode=collection         -> { collections: [...] }
 *
 * IMPORTANT: unlike the PUBLIC storefront feeds (api.offer, api.pre-purchase-popup),
 * this route requires a valid Shopify admin session — it calls
 * authenticate.admin(request) and uses the returned `admin` GraphQL client. The
 * embedded app's fetch carries the App Bridge session token, so a fetcher.load
 * from the picker authenticates automatically.
 */
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "product";
  const query = url.searchParams.get("query") || "";

  try {
    if (mode === "collection") {
      const collections = await getCollections(admin, 50);
      return Response.json({ collections });
    }
    const products = await searchProducts(admin, query, 50);
    return Response.json({ products });
  } catch (error) {
    // Surface a soft error so the picker can show an error/empty state instead
    // of throwing (e.g. GraphQL hiccup or a store with no products).
    return Response.json(
      { error: error?.message || "Failed to load products", products: [], collections: [] },
      { status: 200 },
    );
  }
};
