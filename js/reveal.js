/* ==========================================================================
   reveal.js — the scroll-in transitions.

   ONE OBSERVER FOR THE WHOLE PAGE, and elements are UNOBSERVED once they
   have arrived. A reveal is a one-way door: an element that has been seen is
   not going to be hidden again, so keeping it under observation buys nothing
   and costs a callback on every crossing for the rest of the session. On the
   pipeline page that is 60-odd elements the browser stops tracking.

   THE FAILURE MODE IS THE IMPORTANT PART.
   The hidden state is applied by CSS under `html.has-reveal`, and that class
   is set by the pre-paint script in the page head — early, because setting
   it from here would paint the content and then hide it, which is a flash
   that looks exactly like a bug. The cost of setting it that early is that a
   failure in THIS file would leave the whole page at opacity:0 forever.

   So js/boot.js removes the class when this module did not mount, and the
   observer below is also skipped entirely when the browser has no
   IntersectionObserver — in which case everything is marked as arrived at
   once. The rule: a broken reveal must show everything, never nothing.
   ========================================================================== */
window.PAGE.register('reveal', function (scope) {
  'use strict';

  var root = document.documentElement;

  /* WHAT ARRIVES, chosen here rather than in the markup, because the markup
     is shared with the desktop build and this file only ever runs on the
     phone. One entrance per block. The stagger is given out when blocks
     ARRIVE (see the observer below), not by their place in the section: a
     block that scrolls in on its own should not wait out a delay meant for
     a row of siblings. The hero is left alone: it is on screen at load, and a first screen that
     assembles itself is the opposite of "less, but deliberate". */
  var GROUPS = [
    '.scene__in > .rule', '.scene__in .local > div > .rule', '.scene__in .dlg > div > .rule',
    '.scene__in h2', '.prob__said', '.prob__one .mvf', '.prob__line > div',
    '.prob__count .met', '.diff__praxis > .t-big', '.pipe__stage',
    '.pipe .prob__counters .met', '.rep__shot', '.rep__frag', '.rep__say',
    '.arch__row', '.prac__cell', '#research .met', '.dl__row', '.dl__send',
    '.end h2', '.end__row'
  ].join(',');
  Array.prototype.forEach.call(scope.querySelectorAll(GROUPS), function (el) {
    if (el.closest('#hero') || el.offsetParent === null) return;
    el.classList.add('rvl');
  });

  var els = Array.prototype.slice.call(scope.querySelectorAll('.rvl'));
  if (!els.length) return;

  function showAll() {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Two reasons to skip straight to the finished state: the visitor asked
     for no motion, or this run is a measurement with the layer switched
     off. Both want the same thing — the page, fully visible, now. */
  if (window.DORMANT.reduced || window.OFF.has('reveal') ||
      typeof IntersectionObserver === 'undefined') {
    showAll();
    return;
  }

  /* rootMargin pulls the trigger line 12% up from the bottom edge, so an
     element starts moving just before it would otherwise appear rather than
     the moment its first pixel lands. threshold 0 keeps tall elements —
     a full-height analysis card — from waiting until they are fully in. */
  var io = new IntersectionObserver(function (entries) {
    var k = 0;                          // blocks arriving together, in order
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.style.setProperty('--i', Math.min(k++, 5));
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });

  els.forEach(function (el) {
    /* ALREADY ON SCREEN AT LOAD = ALREADY ARRIVED. Without this the hero
       animates on every single load, including a reload halfway down the
       page, where the visitor watches content they were already reading
       fade back in. IntersectionObserver would fire for these anyway, but
       one frame later — which is long enough to see. */
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) { el.classList.add('is-in'); return; }
    io.observe(el);
  });

  root.classList.add('is-revealing');

  return function () { io.disconnect(); };
});
