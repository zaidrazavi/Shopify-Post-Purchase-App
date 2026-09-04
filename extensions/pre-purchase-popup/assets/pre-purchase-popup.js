/*
 * Pre-purchase upsell (config-driven) — Theme App Extension asset
 * ---------------------------------------------------------------
 * Intercepts a shopper's click on a "go to checkout" control. Detection is
 * broadened to work across themes (not just our own), while deliberately
 * ignoring accelerated/express checkout buttons (Shop Pay, PayPal, etc.):
 *   - `#checkout`                (Dawn cart page)
 *   - `#CartDrawer-Checkout`     (Dawn cart drawer)
 *   - `button/input[name="checkout"]` (Shopify's standard cart form submitter)
 *   - `[data-checkout-button]`   (common custom hook)
 *   - `a[href$="/checkout"]` / `a[href*="/checkout?"]` (direct checkout links)
 *
 * The offer is configured in the Drims app admin. On load this fetches
 * /api/pre-purchase-popup?shop=... and, if the popup is enabled and points at a
 * product (and that product isn't already in the cart when "hide if in cart" is
 * on), populates the modal and enables interception. Otherwise it never
 * intercepts and checkout proceeds normally.
 *
 *   - "Add to order" -> POST /cart/add.js, then proceed to checkout.
 *   - "No thanks"    -> proceed to checkout without adding.
 *   - Close / overlay / Esc -> dismiss (X follows the configured close behavior).
 */
/* global Shopify */
(function () {
  'use strict';

  // Controls that mean "go to checkout", across themes. Kept broad so the app
  // works on any store, not just our own Dawn theme.
  var CHECKOUT_SELECTORS = [
    '#checkout',
    '#CartDrawer-Checkout',
    'button[name="checkout"]',
    'input[name="checkout"]',
    '[data-checkout-button]',
    'a[href$="/checkout"]',
    'a[href*="/checkout?"]'
  ].join(', ');

  // Accelerated/express checkout buttons live inside these — we must NOT
  // intercept them (they bypass the cart, often render in iframes, and hijacking
  // them would break Shop Pay / PayPal / Google Pay express flows).
  var EXPRESS_ANCESTORS =
    '.shopify-payment-button, .additional-checkout-buttons, [data-shopify="payment-button"]';

  // Return the checkout trigger for a click target, or null if it isn't one
  // (or is an express-checkout button we should leave alone).
  function findCheckoutTrigger(target) {
    if (!target || !target.closest) return null;
    var el = target.closest(CHECKOUT_SELECTORS);
    if (!el) return null;
    if (el.closest(EXPRESS_ANCESTORS)) return null;
    return el;
  }

  // Set only while we're deliberately submitting the checkout form (after the shopper
  // chose "Add" or "No thanks"), so the delegated handler lets that submit through instead
  // of re-opening the modal.
  var proceeding = false;

  function getForm(button) {
    if (!button) return null;
    return button.form || null;
  }

  // Continue to checkout using the control the shopper originally clicked. For a
  // form submitter we include the `name="checkout"` value so Shopify redirects to
  // checkout instead of just refreshing the cart; for a plain link we follow it.
  function proceedToCheckout(button) {
    if (!button) return;
    proceeding = true;
    if (!button.isConnected && button.id) {
      button = document.getElementById(button.id) || button;
    }
    var form = getForm(button);

    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit(button);
      return;
    }
    if (form) {
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = button.getAttribute('name') || 'checkout';
      hidden.value = button.value || '';
      form.appendChild(hidden);
      form.submit();
      return;
    }
    // A link (or button) with no form: follow its href if present, else re-click.
    var href = button.getAttribute && button.getAttribute('href');
    if (href) {
      window.location.href = href;
      return;
    }
    button.click();
  }

  // Navigate straight to checkout. Used after an add-to-cart so a cart-form
  // re-submit can't drop the item we just added; uses the current server-side
  // cart, which already contains it.
  function goToCheckout() {
    proceeding = true;
    var root =
      (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
      '/';
    if (root.charAt(root.length - 1) !== '/') root += '/';
    window.location.href = root + 'checkout';
  }

  function getCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } })
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

  function cartHasProduct(cart, productId) {
    return (cart.items || []).some(function (i) {
      return String(i.product_id) === String(productId);
    });
  }

  // True if any line in the cart is a subscription (has a selling plan).
  function cartHasSubscription(cart) {
    return (cart.items || []).some(function (i) {
      return !!(i.selling_plan_allocation || i.selling_plan);
    });
  }

  // Decide, against the CURRENT cart, whether the popup should be suppressed.
  // Evaluated per checkout click (not once at page load), so it reflects items
  // the shopper added after the page loaded.
  function shouldHideForCart(cfg, cart) {
    var d = (cfg && cfg.display) || {};
    var p = (cfg && cfg.product) || {};
    if (d.hideIfInCart) {
      // Product-level match (any variant of the offered product). Fall back to
      // the variant id only for older payloads that don't carry a productId.
      if (p.productId != null && cartHasProduct(cart, p.productId)) return true;
      if (p.productId == null && p.variantId != null && cartHasVariant(cart, p.variantId)) return true;
    }
    if (d.hideIfCartHasSubscription && cartHasSubscription(cart)) return true;
    return false;
  }

  function formatMoney(value) {
    if (value == null || value === '') return '';
    var n = parseFloat(value);
    if (isNaN(n)) return String(value);
    if (window.Shopify && typeof Shopify.formatMoney === 'function' && Shopify.money_format) {
      try {
        return Shopify.formatMoney(Math.round(n * 100), Shopify.money_format);
      } catch (e) {
        /* fall through */
      }
    }
    // Fallback when Shopify.formatMoney is unavailable: prepend "$".
    // FUTURE: for non-USD stores without formatMoney, thread the shop's
    // currency symbol/format through the config payload.
    return '$' + n.toFixed(2);
  }

  function setTextOrHide(el, text) {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  // Pick black or white text for readability on a given background color.
  function contrastText(hex) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    if (c.length !== 6) return '#ffffff';
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#1A1A2E' : '#ffffff';
  }

  function init() {
    var modal = document.getElementById('PreCheckoutUpsell');

    // 'loading' until the config resolves, then 'armed' (show the popup on a
    // checkout click) or 'off' (no offer — let checkout proceed). A checkout
    // click during 'loading' is HELD until we know which, so fast mobile taps on
    // a not-yet-loaded config don't slip straight through to checkout.
    var configStatus = 'loading';
    var heldButton = null;
    var releaseTimer = null;
    var closeBehavior = 'decline';
    var pendingButton = null;
    var closeTimer = null;
    var countdownInterval = null;
    // The resolved config, kept so the per-click cart re-check can read it.
    var activeCfg = null;
    // Analytics: fire the impression at most once per page load.
    var impressionSent = false;

    // Fire-and-forget event tracking. Never awaited, never throws — the popup
    // behaves identically whether or not this call succeeds. `keepalive` lets a
    // dismiss/decline event still send while we navigate to checkout.
    function track(eventType) {
      try {
        var shop = modal && modal.getAttribute('data-shop');
        var appUrl = modal && modal.getAttribute('data-app-url');
        if (!shop || !appUrl) return;
        var p = (activeCfg && activeCfg.product) || {};
        // Send as text/plain (a CORS-safelisted content type) so this stays a
        // "simple" cross-origin request with NO preflight — an application/json
        // POST from the storefront would trigger an OPTIONS preflight. The server
        // parses the body as JSON regardless of this header.
        fetch(appUrl + '/api/track-event', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          keepalive: true,
          body: JSON.stringify({
            shopDomain: shop,
            eventType: eventType,
            productId: p.productId != null ? String(p.productId) : undefined,
            variantId: p.variantId != null ? String(p.variantId) : undefined
          })
        }).catch(function () {});
      } catch (e) {
        /* silent — tracking must never affect the popup */
      }
    }

    function openModal(button) {
      if (!modal) return;
      pendingButton = button;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      modal.hidden = false;
      void modal.offsetWidth; // reflow so the CSS transition runs
      modal.classList.add('pcu-modal--active');
      document.body.style.overflow = 'hidden';
      if (!impressionSent) {
        impressionSent = true;
        track('pre_purchase_impression');
      }
      startCountdown();
      var focusTarget = modal.querySelector('[data-pcu-add]');
      if (focusTarget) focusTarget.focus();
    }

    function closeModal() {
      if (!modal) return;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      modal.classList.remove('pcu-modal--active');
      document.body.style.overflow = '';
      closeTimer = setTimeout(function () {
        modal.hidden = true;
      }, 250);
    }

    function startCountdown() {
      var bar = modal.querySelector('[data-pcu-timerbar]');
      if (bar && bar.hidden) return; // timer disabled in config
      var el = modal.querySelector('[data-pcu-timer]');
      if (!el) return;
      var remaining = parseInt(modal.getAttribute('data-timer-seconds'), 10) || 600;
      function render() {
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      }
      render();
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          remaining = 0;
          render();
          clearInterval(countdownInterval);
          countdownInterval = null;
          return;
        }
        render();
      }, 1000);
    }

    // ----- Apply admin config to the modal DOM -----
    function applyConfig(cfg) {
      var st = cfg.style || {};
      var dialog = modal.querySelector('.pcu-modal__dialog');
      if (dialog) {
        if (st.backgroundColor) dialog.style.background = st.backgroundColor;
        if (st.fontColor) dialog.style.color = st.fontColor;
        if (st.cornerRadius != null) dialog.style.borderRadius = st.cornerRadius + 'px';
        // Expose the accent colors as CSS vars (selectors accent is reserved for a
        // future variant picker; elements drives dividers/borders).
        if (st.selectorsColor) dialog.style.setProperty('--pcu-selectors', st.selectorsColor);
        if (st.elementsColor) dialog.style.setProperty('--pcu-elements', st.elementsColor);
      }
      // The mobile sticky footer needs an opaque background matching the dialog
      // so scrolling content doesn't show through behind the buttons.
      if (st.backgroundColor) {
        var actions = modal.querySelector('.pcu-modal__actions');
        if (actions) actions.style.background = st.backgroundColor;
      }
      if (st.fontFamily) modal.style.fontFamily = st.fontFamily;
      var info = modal.querySelector('.pcu-modal__info');
      if (info) info.style.textAlign = st.themeVariant === 'bold' ? 'center' : 'left';

      // Layout: image placement relative to the details. text-only hides media.
      // (On mobile the CSS forces a single column, so this only affects desktop.)
      var body = modal.querySelector('.pcu-modal__body');
      if (body && window.matchMedia && window.matchMedia('(min-width: 750px)').matches) {
        var layout = st.layout || 'media-left';
        if (layout === 'media-top') {
          body.style.flexDirection = 'column';
        } else if (layout === 'media-right') {
          body.style.flexDirection = 'row-reverse';
        } else {
          body.style.flexDirection = 'row';
        }
      }

      setTextOrHide(modal.querySelector('[data-pcu-headline]'), cfg.headline);
      setTextOrHide(modal.querySelector('[data-pcu-sub]'), cfg.subheadline);

      var timerbar = modal.querySelector('[data-pcu-timerbar]');
      if (cfg.countdown) {
        if (timerbar) {
          timerbar.hidden = false;
          if (cfg.countdown.backgroundColor) timerbar.style.background = cfg.countdown.backgroundColor;
        }
        modal.setAttribute('data-timer-seconds', String((cfg.countdown.minutes || 10) * 60));
      } else if (timerbar) {
        timerbar.hidden = true;
      }

      var p = cfg.product || {};
      if (p.variantId) modal.setAttribute('data-variant-id', String(p.variantId));

      var media = modal.querySelector('[data-pcu-media]');
      var img = modal.querySelector('[data-pcu-image]');
      var textOnly = (st.layout || 'media-left') === 'text-only';
      if (p.image && img && !textOnly) {
        img.src = p.image;
        img.alt = p.title || '';
        img.style.objectFit = p.imageFit === 'contain' ? 'contain' : 'cover';
        if (p.imageFit === 'cover') img.style.height = '100%';
        if (media) {
          media.hidden = false;
          var basis = p.imageSize === 'small' ? '32%' : p.imageSize === 'large' ? '56%' : '44%';
          media.style.flex = '0 0 ' + basis;
          // Optional border around the image, using the elements accent color.
          if (p.imageBorder) {
            media.style.border = '0.1rem solid ' + (st.elementsColor || '#e1e3e5');
          } else {
            media.style.border = 'none';
          }
        }
      } else if (media) {
        media.hidden = true;
      }

      var titleEl = modal.querySelector('[data-pcu-title]');
      if (titleEl) titleEl.textContent = p.title || '';
      setTextOrHide(modal.querySelector('[data-pcu-desc]'), cfg.description);
      setTextOrHide(
        modal.querySelector('[data-pcu-compare]'),
        p.compareAtPrice ? formatMoney(p.compareAtPrice) : null
      );
      var amountEl = modal.querySelector('[data-pcu-amount]');
      if (amountEl) amountEl.textContent = p.price ? formatMoney(p.price) : '';
      setTextOrHide(
        modal.querySelector('[data-pcu-savings]'),
        p.savings ? formatMoney(p.savings) + ' Savings' : null
      );

      // Quantity added to cart (predefined). Default 1.
      var qty = parseInt(p.quantity, 10);
      modal.setAttribute('data-quantity', String(qty > 0 ? qty : 1));

      var b = cfg.buttons || {};
      // Pill vs. rounded buttons follow the card corner radius.
      var btnRadius = st.cornerRadius != null ? st.cornerRadius + 'px' : null;
      var addLabel = modal.querySelector('[data-pcu-add-label]');
      if (addLabel && b.acceptText) addLabel.textContent = b.acceptText;
      var addBtn = modal.querySelector('[data-pcu-add]');
      if (addBtn) {
        if (b.acceptColor) {
          addBtn.style.background = b.acceptColor;
          addBtn.style.color = contrastText(b.acceptColor);
        }
        if (btnRadius) addBtn.style.borderRadius = btnRadius;
        // Hover color via CSS var (base stylesheet reads --pcu-accept-hover).
        if (b.acceptHoverColor) addBtn.style.setProperty('--pcu-accept-hover', b.acceptHoverColor);
      }
      var declineBtn = modal.querySelector('[data-pcu-decline]');
      if (declineBtn) {
        if (b.declineText) declineBtn.textContent = b.declineText;
        if (b.declineColor) declineBtn.style.color = b.declineColor;
        if (btnRadius) declineBtn.style.borderRadius = btnRadius;
        if (b.declineHoverColor) declineBtn.style.setProperty('--pcu-decline-hover', b.declineHoverColor);
      }
      closeBehavior = b.closeBehavior === 'close' ? 'close' : 'decline';
    }

    // Checkout clicked while armed: re-fetch the CURRENT cart and decide whether
    // to show. The page-load cart snapshot is stale if the shopper added items
    // after load, so the hide-if-in-cart / hide-if-subscription checks must run
    // against a fresh cart here rather than once at load.
    function armedClick(button) {
      getCart().then(function (cart) {
        if (shouldHideForCart(activeCfg, cart)) {
          proceedToCheckout(button); // already in cart (or a sub) — skip the popup
        } else {
          openModal(button);
        }
      });
    }

    // Resolve the loading state once. If a checkout click is being held, act on
    // it now (re-check the cart and open, or let checkout proceed).
    function resolveConfig(armed) {
      if (configStatus !== 'loading') return; // already decided
      configStatus = armed ? 'armed' : 'off';
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      if (heldButton) {
        var b = heldButton;
        heldButton = null;
        if (armed) {
          armedClick(b);
        } else {
          proceedToCheckout(b);
        }
      }
    }

    // Hold a checkout click made while the config is still loading, with a safety
    // timeout so the shopper is never trapped if the backend is slow.
    function holdClick(button) {
      heldButton = button;
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(function () {
        if (heldButton && configStatus === 'loading') {
          var b = heldButton;
          heldButton = null;
          proceedToCheckout(b);
        }
      }, 3500);
    }

    // ----- Load config, decide whether to arm the popup -----
    function loadConfig() {
      var shop = modal && modal.getAttribute('data-shop');
      var appUrl = modal && modal.getAttribute('data-app-url');
      if (!shop || !appUrl) {
        resolveConfig(false);
        return;
      }

      // Fetch the config only. We arm as long as there's an offer; whether to
      // actually SHOW it (hide-if-in-cart / hide-if-subscription) is decided per
      // checkout click against a fresh cart in armedClick(), so a cart that
      // changes after page load is always evaluated correctly.
      fetch(
        appUrl + '/api/pre-purchase-popup?shop=' + encodeURIComponent(shop),
        { method: 'GET' }
      )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (cfg) {
          if (!cfg || !cfg.enabled || !cfg.product || !cfg.product.variantId) {
            resolveConfig(false);
            return;
          }
          activeCfg = cfg;
          applyConfig(cfg);
          resolveConfig(true);
        });
    }

    // Delegate on the document in the CAPTURE phase — survives Section-Rendering re-renders
    // of the drawer/footer, and runs before a theme's own inline click handlers.
    document.addEventListener(
      'click',
      function (event) {
        if (proceeding) return; // submitting to checkout — don't re-open the modal
        if (!modal || configStatus === 'off') return; // no offer — let checkout proceed
        var button = findCheckoutTrigger(event.target);
        if (!button || button.disabled) return;

        // Armed OR still loading: intercept so the click can't slip through to
        // checkout. If still loading (common on mobile / a cold backend), hold
        // the button and act once the config resolves or the timeout fires.
        event.preventDefault();
        event.stopImmediatePropagation();

        if (configStatus === 'armed') {
          armedClick(button); // re-check the live cart, then open or proceed
        } else {
          holdClick(button); // still loading — hold until config resolves
        }
      },
      true
    );

    if (!modal) return;

    var addButton = modal.querySelector('[data-pcu-add]');
    if (addButton) {
      addButton.addEventListener('click', function () {
        if (addButton.classList.contains('loading')) return;
        track('pre_purchase_click');
        var variantId = parseInt(modal.getAttribute('data-variant-id'), 10);
        var quantity = parseInt(modal.getAttribute('data-quantity'), 10) || 1;
        var button = pendingButton;

        if (!variantId) {
          closeModal();
          proceedToCheckout(button);
          return;
        }

        addButton.classList.add('loading');
        var addUrl =
          window.routes && window.routes.cart_add_url
            ? window.routes.cart_add_url + '.js'
            : '/cart/add.js';

        // Add the upsell, THEN go straight to checkout. We must not re-submit the
        // cart form here: on some themes that re-render drops the just-added line
        // before checkout. A direct /checkout navigation uses the current
        // server-side cart, which now includes the item.
        fetch(addUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] })
        })
          .then(function (response) {
            if (!response.ok) {
              return response.text().then(function (body) {
                throw new Error(
                  'add-to-cart failed (' + response.status + '): ' + body
                );
              });
            }
            return response.json();
          })
          .then(function () {
            // Item is now in the cart — proceed to checkout with it.
            addButton.classList.remove('loading');
            closeModal();
            goToCheckout();
          })
          .catch(function (error) {
            // Don't trap the shopper: log the reason and still continue.
            // eslint-disable-next-line no-console
            console.error('[pre-checkout-upsell]', error && error.message ? error.message : error);
            addButton.classList.remove('loading');
            closeModal();
            proceedToCheckout(button);
          });
      });
    }

    modal.querySelectorAll('[data-pcu-decline]').forEach(function (el) {
      el.addEventListener('click', function () {
        var button = pendingButton;
        track('pre_purchase_dismiss');
        closeModal();
        proceedToCheckout(button);
      });
    });

    // Overlay = dismiss and stay on the cart.
    modal.querySelectorAll('[data-pcu-dismiss]').forEach(function (el) {
      el.addEventListener('click', function () {
        track('pre_purchase_dismiss');
        closeModal();
      });
    });

    // The X follows the configured close behavior.
    var closeBtn = modal.querySelector('[data-pcu-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        track('pre_purchase_dismiss');
        if (closeBehavior === 'decline') {
          var button = pendingButton;
          closeModal();
          proceedToCheckout(button);
        } else {
          closeModal();
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) {
        track('pre_purchase_dismiss');
        closeModal();
      }
    });

    loadConfig();
  }

  // Reset the in-progress guard on every page show (critical for bfcache back-button).
  window.addEventListener('pageshow', function () {
    proceeding = false;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
