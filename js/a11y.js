/* ==========================================================================
   a11y.js — the parts a virtual scroll takes away from the browser.

   THE PROBLEM A VIRTUAL SCROLL CREATES
   The document never scrolls and a transform moves the track, so the browser
   has no idea where anything is. Two of its automatic behaviours stop working:

     1. Tabbing to an off-screen control normally scrolls it into view. Here
        there is nothing to scroll, so focus lands on a link the visitor
        cannot see — the single worst keyboard failure a page can have.
     2. A fragment link normally jumps. Here the browser's idea of "jump" is
        to scroll the nearest scrollport, which is .stage, and that desyncs
        the page from its own accumulator.

   The first is fixed here: watch for focus, work out which scene the focused
   element belongs to, and drive window.GOTO — the one door into the
   accumulator — so the scene eases on screen as it would under a wheel
   gesture.

   The second is NOT fixed here, deliberately. js/scroll.js pins the stage at
   the origin and listens for hashchange, so the address bar stays honest and
   /#download remains a real, copyable link. All this file does for a fragment
   click is move FOCUS to the target, which the browser would otherwise skip.

   ON THE PHONE BUILD none of it applies: the document scrolls natively and
   the browser does all of this correctly. GOTO does not exist there, and
   every branch below checks rather than assuming.
   ========================================================================== */
window.PAGE.register('a11y', function (scope) {
  'use strict';

  var root = document.documentElement;
  var scenes = Array.prototype.slice.call(scope.querySelectorAll('.scene'));

  /* ---- reduced motion --------------------------------------------------- */
  function syncReduced() {
    root.classList.toggle('is-reduced', window.DORMANT.reduced === true);
  }
  syncReduced();
  var mq = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', syncReduced);

  /* ---- focus follows the scroll ----------------------------------------
     Every scene below the first is content-visibility:hidden while off
     screen, which already takes its contents out of the tab order — so this
     mostly catches the scene either side of the one you are on. It is still
     the difference between tabbing into a half-visible scene and tabbing into
     nothing. */
  function onFocusIn(e) {
    if (typeof window.GOTO !== 'function') return;        // phone build
    var el = e.target;
    if (!el || !el.closest) return;
    var scene = el.closest('.scene');
    if (!scene) return;
    var i = scenes.indexOf(scene);
    if (i >= 0) window.GOTO(i);
  }
  document.addEventListener('focusin', onFocusIn);

  /* ---- fragment links move focus ---------------------------------------
     Matches a bare "#id" AND a same-document "/#id", which is what the
     masthead actually uses. Anything pointing at another document is left
     alone.

     NOT prevented. Letting the click through is what updates the address bar,
     and js/scroll.js is listening for the hashchange that follows. Preventing
     it here would move the page and leave the URL saying something else. */
  function onClick(e) {
    var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
    if (!a) return;
    /* Resolve against the real document rather than parsing the attribute:
       "#x", "/#x" and a full absolute URL to this page are all the same link,
       and only the resolved form can tell you that. */
    if (a.pathname !== location.pathname || a.host !== location.host) return;
    var id = (a.hash || '').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;

    /* Anything can be a scroll destination; only some things can hold focus.
       A temporary tabindex is the standard fix, removed on blur so it stays
       out of the tab order afterwards. preventScroll because the accumulator
       is doing the travelling and focus() would otherwise try to scroll a
       container that must not move. */
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', function onBlur() {
        target.removeAttribute('tabindex');
        target.removeEventListener('blur', onBlur);
      });
    }
    try { target.focus({ preventScroll: true }); }
    catch (err) { /* older engines: skip rather than scroll the wrong thing */ }
  }
  scope.addEventListener('click', onClick);

  return function () {
    document.removeEventListener('focusin', onFocusIn);
    scope.removeEventListener('click', onClick);
    if (mq && mq.removeEventListener) mq.removeEventListener('change', syncReduced);
  };
});
