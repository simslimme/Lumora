/*
 * Lumora Voices — GA4 event tracking
 * Loads AFTER the gtag snippet on every page. Delegated listeners only,
 * capture phase, never blocks navigation, never throws.
 * Toggle window.LUMORA_DEBUG = true (before this script, or in console) to log events.
 */
(function () {
  'use strict';

  if (typeof window.LUMORA_DEBUG === 'undefined') window.LUMORA_DEBUG = false;

  function trackEvent(name, params) {
    try {
      if (window.LUMORA_DEBUG) console.log('[Lumora Analytics]', name, params);
      if (typeof window.gtag !== 'function') return;
      window.gtag('event', name, params);
    } catch (err) {
      if (window.LUMORA_DEBUG) console.error('[Lumora Analytics] trackEvent error', err);
    }
  }

  // Maps DOM structure -> placement, so new sections/articles need no code changes
  // as long as they reuse these conventions (or set data-placement explicitly).
  var PLACEMENT_MATCHERS = [
    ['.sticky-cta', 'sticky_cta'],
    ['nav', 'nav'],
    ['.hero', 'hero'],
    ['#demo, .booth', 'demo'],
    ['#compare', 'comparison'],
    ['#pricing', 'pricing'],
    ['#stories', 'social_proof'],
    ['#faq', 'faq'],
    ['.final', 'final_cta'],
    ['#platform', 'ecosystem'],
    ['#cloning, #dubbing, #agents, #sfx, #music', 'review'],
    ['.cta-block', 'article_cta'],
    ['article', 'article'],
    ['footer', 'footer']
  ];

  function getPlacement(el) {
    try {
      if (!el || typeof el.closest !== 'function') return 'other';
      var override = el.closest('[data-placement]');
      if (override) return override.getAttribute('data-placement');
      for (var i = 0; i < PLACEMENT_MATCHERS.length; i++) {
        if (el.closest(PLACEMENT_MATCHERS[i][0])) return PLACEMENT_MATCHERS[i][1];
      }
      return 'other';
    } catch (err) {
      return 'other';
    }
  }

  function resolveUrl(href) {
    try {
      return new URL(href, window.location.href);
    } catch (err) {
      return null;
    }
  }

  function isAffiliateHref(href) {
    if (!href) return false;
    var url = resolveUrl(href);
    return !!url && url.hostname === 'try.elevenlabs.io';
  }

  function isElevenlabsHref(href) {
    if (!href) return false;
    var url = resolveUrl(href);
    return !!url && /(^|\.)elevenlabs\.io$/.test(url.hostname);
  }

  var IS_REVIEW_PAGE = /^\/(index\.html)?$/.test(window.location.pathname);

  // --- Click tracking: single delegated, capture-phase listener ---
  document.addEventListener('click', function (e) {
    try {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;

      var anchor = target.closest('a[href]');
      var ctaEl = target.closest('.btn, button, [data-cta]');
      var placement = getPlacement(ctaEl || anchor || target);

      if (anchor) {
        var href = anchor.href;
        var linkText = (anchor.textContent || '').trim().slice(0, 100);

        if (isAffiliateHref(href)) {
          trackEvent('affiliate_click', {
            link_url: href,
            link_text: linkText,
            page_path: window.location.pathname,
            page_title: document.title,
            placement: placement,
            affiliate_partner: 'elevenlabs'
          });
        } else if (isElevenlabsHref(href)) {
          trackEvent('elevenlabs_outbound_click', {
            link_url: href,
            link_text: linkText,
            page_path: window.location.pathname,
            placement: placement
          });
        }
      }

      if (ctaEl) {
        var destination = ctaEl.tagName === 'A' ? ctaEl.href : null;
        trackEvent('cta_click', {
          cta_text: (ctaEl.textContent || '').trim().slice(0, 100),
          destination: destination,
          page_path: window.location.pathname,
          placement: placement,
          is_affiliate: isAffiliateHref(destination)
        });

        if (ctaEl.id === 'demo-btn') {
          trackEvent('demo_generate', { placement: placement });
        }
      }
    } catch (err) {
      if (window.LUMORA_DEBUG) console.error('[Lumora Analytics] click handler error', err);
    }
  }, true);

  // --- Lead form submit tracking (form ships later; convention: data-lead-form) ---
  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      if (!form || !(form instanceof HTMLFormElement)) return;
      if (!form.matches('[data-lead-form], #newsletter-form, .newsletter-form')) return;

      trackEvent('email_signup', {
        form_location: getPlacement(form),
        page_path: window.location.pathname,
        lead_magnet: form.getAttribute('data-lead-magnet') || null
      });
    } catch (err) {
      if (window.LUMORA_DEBUG) console.error('[Lumora Analytics] submit handler error', err);
    }
  }, true);

  // --- Scroll depth tracking (once per threshold per page load) ---
  (function () {
    var fired50 = false;
    var fired90 = false;

    function onScroll() {
      try {
        var doc = document.documentElement;
        var scrollTop = window.scrollY || doc.scrollTop || 0;
        var height = doc.scrollHeight - doc.clientHeight;
        if (height <= 0) return;
        var pct = (scrollTop / height) * 100;

        if (!fired50 && pct >= 50) {
          fired50 = true;
          trackEvent('scroll_50', { percent_scrolled: 50, page_path: window.location.pathname });
          if (IS_REVIEW_PAGE) trackEvent('review_scroll_50', { percent_scrolled: 50 });
        }
        if (!fired90 && pct >= 90) {
          fired90 = true;
          trackEvent('scroll_90', { percent_scrolled: 90, page_path: window.location.pathname });
          if (IS_REVIEW_PAGE) trackEvent('review_scroll_90', { percent_scrolled: 90 });
          window.removeEventListener('scroll', onScroll);
        }
      } catch (err) {
        if (window.LUMORA_DEBUG) console.error('[Lumora Analytics] scroll handler error', err);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  // --- Review page view (homepage only, once on load) ---
  if (IS_REVIEW_PAGE) {
    trackEvent('review_page_view', { content_group: 'review' });
  }

  // Expose for debugging in console.
  window.LumoraAnalytics = { trackEvent: trackEvent, getPlacement: getPlacement };
})();
