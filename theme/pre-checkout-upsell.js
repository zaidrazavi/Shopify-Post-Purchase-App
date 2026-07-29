/*
 * Pre-checkout upsell (config-driven)
 * -----------------------------------
 * Intercepts EVERY click on either checkout button:
 *   - `#checkout`            (cart page, in `main-cart-footer.liquid`)
 *   - `#CartDrawer-Checkout` (cart drawer, in `cart-drawer.liquid`)
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

  var CHECKOUT_BUTTON_IDS = ['checkout', 'CartDrawer-Checkout'];

  // Set only while we're deliberately submitting the checkout form (after the shopper
  // chose "Add" or "No thanks"), so the delegated handler lets that submit through instead
  // of re-opening the modal.
  var proceeding = false;

  function getForm(button) {
    if (!button) return null;
    return button.form || null;
  }

  // Continue to checkout using the button the shopper originally clicked, making
  // sure the `name="checkout"` submitter value is included so Shopify redirects
  // to the checkout instead of just refreshing the cart.
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
    button.click();
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
    return n.toFixed(2);
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

    var offerReady = false; // becomes true only once a valid, enabled offer is loaded
    var closeBehavior = 'decline';
    var pendingButton = null;
    var closeTimer = null;
    var countdownInterval = null;

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
      }
      if (st.fontFamily) modal.style.fontFamily = st.fontFamily;
      var info = modal.querySelector('.pcu-modal__info');
      if (info) info.style.textAlign = st.themeVariant === 'bold' ? 'center' : 'left';

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
      if (p.image && img) {
        img.src = p.image;
        img.alt = p.title || '';
        img.style.objectFit = p.imageFit === 'contain' ? 'contain' : 'cover';
        if (p.imageFit === 'cover') img.style.height = '100%';
        if (media) {
          media.hidden = false;
          var basis = p.imageSize === 'small' ? '32%' : p.imageSize === 'large' ? '56%' : '44%';
          media.style.flex = '0 0 ' + basis;
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

      var b = cfg.buttons || {};
      var addLabel = modal.querySelector('[data-pcu-add-label]');
      if (addLabel && b.acceptText) addLabel.textContent = b.acceptText;
      var addBtn = modal.querySelector('[data-pcu-add]');
      if (addBtn && b.acceptColor) {
        addBtn.style.background = b.acceptColor;
        addBtn.style.color = contrastText(b.acceptColor);
      }
      var declineBtn = modal.querySelector('[data-pcu-decline]');
      if (declineBtn) {
        if (b.declineText) declineBtn.textContent = b.declineText;
        if (b.declineColor) declineBtn.style.color = b.declineColor;
      }
      closeBehavior = b.closeBehavior === 'close' ? 'close' : 'decline';
    }

    // ----- Load config, decide whether to arm the popup -----
    function loadConfig() {
      var shop = modal && modal.getAttribute('data-shop');
      var appUrl = modal && modal.getAttribute('data-app-url');
      if (!shop || !appUrl) return;

      fetch(appUrl + '/api/pre-purchase-popup?shop=' + encodeURIComponent(shop), {
        method: 'GET'
      })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (cfg) {
          if (!cfg || !cfg.enabled || !cfg.product || !cfg.product.variantId) {
            offerReady = false; // nothing to show — checkout proceeds normally
            return;
          }
          if (cfg.display && cfg.display.hideIfInCart) {
            getCart().then(function (cart) {
              if (cartHasVariant(cart, cfg.product.variantId)) {
                offerReady = false;
              } else {
                applyConfig(cfg);
                offerReady = true;
              }
            });
            return;
          }
          applyConfig(cfg);
          offerReady = true;
        });
    }

    var checkoutSelector = '#' + CHECKOUT_BUTTON_IDS.join(', #');

    // Delegate on the document in the CAPTURE phase — survives Section-Rendering re-renders
    // of the drawer/footer, and runs before the drawer button's inline onclick.
    document.addEventListener(
      'click',
      function (event) {
        if (proceeding) return; // submitting to checkout — don't re-open the modal
        if (!modal || !offerReady) return; // no armed offer — let checkout proceed
        var button = event.target.closest && event.target.closest(checkoutSelector);
        if (!button || button.disabled) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        openModal(button);
      },
      true
    );

    if (!modal) return;

    var addButton = modal.querySelector('[data-pcu-add]');
    if (addButton) {
      addButton.addEventListener('click', function () {
        if (addButton.classList.contains('loading')) return;
        var variantId = parseInt(modal.getAttribute('data-variant-id'), 10);
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

        fetch(addUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
        })
          .then(function (response) {
            return response.json();
          })
          .catch(function (error) {
            console.error('[pre-checkout-upsell] add to cart failed', error);
          })
          .then(function () {
            addButton.classList.remove('loading');
            closeModal();
            proceedToCheckout(button);
          });
      });
    }

    modal.querySelectorAll('[data-pcu-decline]').forEach(function (el) {
      el.addEventListener('click', function () {
        var button = pendingButton;
        closeModal();
        proceedToCheckout(button);
      });
    });

    // Overlay = dismiss and stay on the cart.
    modal.querySelectorAll('[data-pcu-dismiss]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    // The X follows the configured close behavior.
    var closeBtn = modal.querySelector('[data-pcu-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
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
      if (event.key === 'Escape' && !modal.hidden) closeModal();
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
