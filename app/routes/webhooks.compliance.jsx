import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shopify's mandatory GDPR/privacy compliance webhooks. Required for any app
 * distributed through the App Store (listed or unlisted).
 *
 * `authenticate.webhook` verifies the HMAC signature and throws a 401 for an
 * invalid/missing signature — this is what Shopify's automated compliance check
 * requires (valid HMAC → 200, invalid → 401). Never bypass it.
 *
 * This app stores no customer-level PII — only shop-keyed configuration
 * (OfferConfig, PrePurchasePopupConfig) and offline sessions — so the customer
 * topics have nothing to return or erase. `shop/redact` deletes everything we
 * hold for the shop.
 *
 * Route path: /webhooks/compliance (see `compliance_topics` in shopify.app.toml)
 */
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  // Normalize defensively so we match regardless of casing/delimiter form.
  const normalized = String(topic || "").toUpperCase().replace(/[/-]/g, "_");

  switch (normalized) {
    case "CUSTOMERS_DATA_REQUEST":
      // We hold no customer personal data, so there is nothing to compile or
      // return to the merchant. Acknowledge the request.
      break;

    case "CUSTOMERS_REDACT":
      // No customer-level data is stored, so there is nothing to redact.
      break;

    case "SHOP_REDACT":
      // Erase all data we hold for this shop.
      await db.offerConfig.deleteMany({ where: { shop } });
      await db.prePurchasePopupConfig.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      break;

    default:
      // Unexpected topic on this endpoint — acknowledge without action.
      break;
  }

  return new Response();
};
