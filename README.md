# Drims Post-Purchase Offer

Show a one-click **upsell** (and an optional **downsell**) on the Shopify
post-purchase page — the screen that appears *right after* a customer pays, but
*before* the Thank-You page. Customers can add a product to the order they just
placed with a single tap. It's charged to the card they already used, so there's
no re-entering payment details.

---

## Install it on your store

**Installation link:**

```
https://shopify-post-purchase-app.onrender.com/?shop=YOUR-STORE.myshopify.com
```

Replace `YOUR-STORE` with your store's `myshopify.com` subdomain. (You can also
just open <https://shopify-post-purchase-app.onrender.com/> and type your store
domain into the box.)

**Steps:**

1. Open the link above in your browser.
2. You'll land in your Shopify admin with an install prompt — review the
   requested permissions and click **Install**.
3. The app opens to the **Post-purchase offer** settings page. That's it.

> This app is distributed privately (not on the public App Store), so your store
> needs to be one that's been granted access. If the link shows an
> "app not found" or access error, contact the app owner to have your store
> added.

**Requirements**

- Your checkout must support post-purchase offers. This works with
  **Shopify Payments** (and other gateways that allow charging the saved payment
  method). Some payment methods can't be charged again after checkout and will
  simply skip the offer.
- The offer only appears on orders paid through the normal checkout.

---

## Set up your offer

Open the app and go to **Offer settings**. A live preview on the right updates as
you edit.

**Status**
- Toggle **Enable post-purchase offer** on/off. When off, customers go straight
  to the Thank-You page. The badge at the top shows **Offer is Live** (green) or
  **Offer is Off** (gray).

**Main offer**
- **Product** — pick the product to offer after checkout.
- **Price adjustment** — choose one:
  - *Use the product's regular price*
  - *Percentage discount* (e.g. 20% off)
  - *Fixed override price* (e.g. sell it for exactly $9.99)
  - If the product has a **compare-at price**, the offer automatically shows the
    original price struck through and a green **"You save $X"** badge.
- **Countdown timer** (optional) — shows an urgency bar like
  *"Special Offer Ends In: 09:55."* It's a visual nudge only; it resets each time
  the page loads and never actually cancels the offer.
- **Headline / Description** — the wording shown on the offer.
- **Accept / Decline button text** — customize both button labels.

**Downsell (shown if the main offer is declined)**
- Turn on **Enable downsell** and pick a second, usually cheaper, product with
  its own discount and wording. If a customer declines the main offer, they see
  this one next. If the downsell is off, declining goes straight to Thank-You.

Click **Save**. You'll see a "settings saved" confirmation.

---

## What your customer sees

1. Customer completes checkout and pays.
2. **Main offer** appears — image, price (with savings if applicable), optional
   countdown, and your Accept/Decline buttons.
   - **Accept** → the product is added to their order and charged to the same
     card → Thank-You page.
   - **Decline** → if a downsell is set up, they see it next; otherwise they go
     straight to the Thank-You page.
3. **Downsell** (if shown):
   - **Accept** → added to the order → Thank-You page.
   - **Decline** → Thank-You page.

A customer adds at most **one** product this way per order (accepting the main
offer skips the downsell).

---

## Testing before you go live

1. In the app, configure a main offer (and optionally a downsell), then **Save**.
2. Place a test order through your store's checkout. If you use Shopify Payments
   test mode, the test card is `4242 4242 4242 4242` with any future expiry and
   any CVC.
3. After paying, confirm the offer appears and that **Accept** adds the product.
   Check **Orders** in your admin — the added item shows up on that order.
4. Run it again and **Decline** to confirm the downsell (or the Thank-You page)
   behaves as expected.

---

## Good to know

- **Where it appears:** only on the post-purchase page, immediately after
  payment. It does not change your product pages, cart, or main checkout.
- **The charge:** the customer is charged the difference on the payment method
  they already used — they never re-enter card details.
- **Pricing shown:** the app previews prices from your settings; the exact amount
  charged is confirmed by Shopify at the moment of accepting.
- **Turning it off:** flip the enable toggle off and Save — customers immediately
  stop seeing the offer.

---

## Support

Questions or want your store added to the private distribution? Contact the app
owner.
