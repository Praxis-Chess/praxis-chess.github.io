/* ==========================================================================
   boot.js — mount everything, once. Last script on every page.

   Kept separate from js/lifecycle.js so the registry stays a registry: the
   registry knows HOW to mount, this file knows WHICH modules, on WHICH
   build. Those change for different reasons.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- the phone allowlist ----------------------------------------------
     THE TWO BUILDS ARE DIFFERENT RUNTIMES, not one runtime with a responsive
     stylesheet. Below 760px the document scrolls natively, so there is no
     accumulator, no scene track and no per-frame loop at all.

     'reveal' is the mirror image: it exists ONLY on the phone. On the desktop
     build the scenes are choreographed against the accumulator, which is a
     better version of the same idea and would fight an IntersectionObserver
     doing it too.

     'strip' is desktop-only for the opposite reason: every readout on it
     reads the accumulator, and on a phone there is no accumulator to read.
     'shots' is on both — the captures are the product, and a phone should
     see them.

     An ALLOWLIST rather than a skip-list, deliberately: a module added later
     is off on mobile until somebody has decided it belongs there.
     tools/check.py fails the build if a name here is not registered by any
     file, or is registered by a file the pages do not load. */
  var MOBILE = ['nav', 'reveal', 'board', 'copy', 'shots', 'a11y', 'fps'];

  function go() {
    /* ?off=grain acts on the DOM rather than on a renderer, so it is applied
       once here instead of being checked anywhere per frame. */
    if (window.OFF.has('grain')) {
      var g = document.querySelector('.grain');
      if (g) g.remove();
    }

    var root = document.documentElement;
    var isMobile = root.classList.contains('is-mobile');
    window.PAGE.mount(document, isMobile ? MOBILE : null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }

  /* ---- crossing the breakpoint -------------------------------------------
     A RELOAD, AND IT HAS TO BE.

     The previous version of this file swapped modules in place, because the
     two builds then differed by one canvas. They no longer do. The desktop
     build has taken the wheel gesture away from the browser, set
     overflow:hidden, and translated a track that the phone build lays out as
     a normal document; the phone build has already let the document scroll
     natively and has a scroll position the desktop build cannot represent.
     Unwinding either into the other means restoring state neither of them
     tracks — the reference project reached the same conclusion for the same
     reason, and its note is worth repeating: a reload is one line, always
     correct, and only ever happens on a deliberate resize.

     Reads the SAME --build token css/mobile.css sets rather than a second
     copy of the 760 literal. Debounced because resize fires continuously
     during a window drag and getComputedStyle forces a style recalculation.

     NOTE FOR TESTING: a devtools device-metrics override re-lays the page out
     without dispatching resize or firing a ResizeObserver, so this will not
     run there. Resize a real window, or reload. */
  var root = document.documentElement;
  var wasMobile = root.classList.contains('is-mobile');
  var t = 0;

  function onCross() {
    clearTimeout(t);
    t = setTimeout(function () {
      var nowMobile =
        getComputedStyle(root).getPropertyValue('--build').trim() === 'mobile' &&
        !/[?&]desktop(&|=|$)/.test(location.search);
      if (nowMobile !== wasMobile) location.reload();
    }, 200);
  }
  window.addEventListener('resize', onCross);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(onCross).observe(root);
  }
})();
