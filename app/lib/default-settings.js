/**
 * Default store-level settings blobs. Transcribed verbatim from RevLift's
 * Supabase migrations (2 & 3) where they were `jsonb NOT NULL DEFAULT '{...}'`.
 * Here the DB columns are nullable (Store.prePurchaseSettings etc.) and these
 * objects are applied in app code instead.
 */

export const DEFAULT_PRE_PURCHASE_SETTINGS = {
  enabled: false,
  popup: {
    position: "center",
    animation: "fade",
    overlay_color: "#000000",
    overlay_opacity: 0.5,
    bg_color: "#FFFFFF",
    text_color: "#000000",
    border_radius: 12,
    max_width: 480,
  },
  triggers: {
    on_add_to_cart: true,
    on_cart_page: false,
    on_exit_intent: false,
    delay_seconds: 0,
    frequency_cap: 1,
    frequency_window_hours: 24,
  },
  timer: {
    enabled: false,
    duration_minutes: 10,
    message: "Offer expires in:",
  },
  cart_widget: {
    enabled: false,
    placement: "below-cart",
    heading: "You might also like",
    max_products: 3,
    button_text: "Add to Cart",
    button_color: "#EF4444",
    button_text_color: "#FFFFFF",
    auto_add: false,
  },
};

export const DEFAULT_POST_PURCHASE_SETTINGS = {
  enabled: false,
  design: {
    font_family: "System Default",
    primary_color: "#7C3AED",
    background_color: "#FFFFFF",
    text_color: "#000000",
    theme: "light",
    corner_radius: 8,
  },
  checkout_extension: {
    installed: false,
  },
  timer: {
    enabled: false,
    duration_minutes: 10,
    message: "This offer expires in:",
  },
};

export const DEFAULT_THANK_YOU_SETTINGS = {
  enabled: false,
  design: {
    font_family: "System Default",
    primary_color: "#7C3AED",
    background_color: "#FFFFFF",
    text_color: "#000000",
    theme: "light",
  },
  widgets: {
    product_recommendations: { enabled: true, heading: "You might also like", max_products: 3 },
    faq: { enabled: false, heading: "Frequently Asked Questions", items: [] },
    custom_text: { enabled: false, content: "" },
    custom_image: { enabled: false, image_url: "" },
    custom_code: { enabled: false, code: "" },
  },
  shopify_block: {
    installed: false,
  },
};
