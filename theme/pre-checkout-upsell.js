/**
 * Pre-purchase upsell popup — storefront script (assets/pre-checkout-upsell.js).
 *
 * UPDATED: instead of hardcoded values, this fetches the merchant's config from
 * the app (/api/pre-purchase-popup?shop=...) on load and renders the popup from
 * it. When the buyer clicks Checkout in the cart, if the popup is enabled (and
 * not suppressed by "hide if already in cart"), it's shown; Accept adds the
 * variant and proceeds to checkout, Decline/close proceeds without it.
 *
 * Reconcile the CHECKOUT_SELECTORS list with your theme's actual checkout
 * button(s) if needed.
 */
(function () {
  "use strict";

  var CHECKOUT_SELECTORS = [
    '[name="checkout"]',
    'button[name="checkout"]',
    '.cart__checkout',
    '#checkout',
    'a[href="/checkout"]',
    'a[href^="/checkout"]',
  ];
  var IMAGE_SIZE_PX = { small: 96, medium: 140, large: 200 };

  var bootstrapEl = document.getElementById("pre-checkout-upsell-bootstrap");
  var root = document.getElementById("pre-checkout-upsell");
  if (!bootstrapEl || !root) return;

  var boot;
  try {
    boot = JSON.parse(bootstrapEl.textContent);
  } catch (e) {
    return;
  }
  if (!boot || !boot.shop || !boot.appUrl) return;

  var config = null; // populated by fetchConfig()
  var proceeding = false; // guards our own checkout redirect
  var countdownTimer = null;

  var $ = function (sel) {
    return root.querySelector(sel);
  };

  function fetchConfig() {
    var url =
      boot.appUrl +
      "/api/pre-purchase-popup?shop=" +
      encodeURIComponent(boot.shop);
    return fetch(url, { method: "GET" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  function getCart() {
    return fetch("/cart.js", { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.ok ? r.json() : { items: [] };
      })
      .catch(function () {
        return { items: [] };
      });
  }

  function cartHasVariant(cart, variantId) {
    return (cart.items || []).some(function (i) {
      return String(i.variant_id) === String(variantId);
    });
  }

  // ----- Rendering -----

  function applyConfig(cfg) {
    var modal = $("[data-pcu-modal]");
    var s = cfg.style || {};
    modal.style.background = s.backgroundColor || "#fff";
    modal.style.color = s.fontColor || "#1a1a1a";
    modal.style.fontFamily = s.fontFamily || "sans-serif";
    modal.style.borderRadius = (s.cornerRadius || 12) + "px";
    modal.setAttribute("data-variant", s.themeVariant || "classic");

    // Timer
    var timerEl = $("[data-pcu-timer]");
    if (cfg.countdown) {
      timerEl.style.background = cfg.countdown.backgroundColor || "#e4362f";
      timerEl.hidden = false;
      startCountdown(cfg.countdown.minutes || 10, timerEl);
    } else {
      timerEl.hidden = true;
    }

    // Text
    toggleText($("[data-pcu-headline]"), cfg.headline);
    toggleText($("[data-pcu-subheadline]"), cfg.subheadline);

    // Product
    var p = cfg.product || {};
    var img = $("[data-pcu-image]");
    if (p.image) {
      var px = IMAGE_SIZE_PX[p.imageSize] || 140;
      img.src = p.image;
      img.alt = p.title || "";
      img.style.width = px + "px";
      img.style.height = px + "px";
      img.style.objectFit = p.imageFit === "contain" ? "contain" : "cover";
      img.hidden = false;
    } else {
      img.hidden = true;
    }
    $("[data-pcu-title]").textContent = p.title || "";
    $("[data-pcu-price]").textContent = p.price ? formatMoney(p.price) : "";
    toggleText(
      $("[data-pcu-compare]"),
      p.compareAtPrice ? formatMoney(p.compareAtPrice) : null,
    );
    toggleText(
      $("[data-pcu-savings]"),
      p.savings ? "You save " + formatMoney(p.savings) : null,
    );

    // Buttons
    var b = cfg.buttons || {};
    var accept = $("[data-pcu-accept]");
    var decline = $("[data-pcu-decline]");
    accept.textContent = b.acceptText || "Add to my order";
    accept.style.background = b.acceptColor || "#1a1a1a";
    accept.style.color = "#fff";
    decline.textContent = b.declineText || "No thanks";
    decline.style.color = b.declineColor || "#6d7175";
  }

  function toggleText(el, text) {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function formatMoney(amount) {
    // The config stores plain decimal strings (e.g. "600.00"). If your theme
    // has a money formatter, swap it in here.
    var n = parseFloat(amount);
    return isNaN(n) ? String(amount) : n.toFixed(2);
  }

  function startCountdown(minutes, el) {
    if (countdownTimer) clearInterval(countdownTimer);
    var remaining = Math.max(1, parseInt(minutes, 10) || 10) * 60;
    var tick = function () {
      var m = String(Math.floor(remaining / 60)).padStart(2, "0");
      var sec = String(remaining % 60).padStart(2, "0");
      el.textContent = "Offer ends in " + m + ":" + sec;
      if (remaining > 0) remaining -= 1;
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ----- Open / close -----

  function openPopup() {
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closePopup() {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (countdownTimer) clearInterval(countdownTimer);
  }

  function proceedToCheckout() {
    proceeding = true;
    window.location.href = "/checkout";
  }

  function acceptOffer() {
    var variantId = config && config.product && config.product.variantId;
    if (!variantId) {
      proceedToCheckout();
      return;
    }
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
    })
      .then(function () {
        proceedToCheckout();
      })
      .catch(function () {
        proceedToCheckout();
      });
  }

  // ----- Wiring -----

  function onCheckoutClick(event) {
    if (proceeding || !config || !config.enabled) return; // let it through
    var target = event.target.closest(CHECKOUT_SELECTORS.join(","));
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    var showAfterCartCheck = function (cart) {
      var variantId = config.product && config.product.variantId;
      if (
        config.display &&
        config.display.hideIfInCart &&
        variantId &&
        cartHasVariant(cart, variantId)
      ) {
        proceedToCheckout();
        return;
      }
      applyConfig(config);
      openPopup();
    };

    getCart().then(showAfterCartCheck);
  }

  function bindModalEvents() {
    $("[data-pcu-accept]").addEventListener("click", acceptOffer);
    $("[data-pcu-decline]").addEventListener("click", proceedToCheckout);
    $("[data-pcu-close]").addEventListener("click", function () {
      var behavior = config && config.buttons && config.buttons.closeBehavior;
      if (behavior === "close") {
        closePopup();
      } else {
        proceedToCheckout();
      }
    });
    root.addEventListener("click", function (e) {
      if (e.target === root) proceedToCheckout(); // click on overlay backdrop
    });
  }

  function init() {
    bindModalEvents();
    // Capture-phase so we intercept before the theme's own checkout handler.
    document.addEventListener("click", onCheckoutClick, true);
    fetchConfig().then(function (cfg) {
      config = cfg;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
