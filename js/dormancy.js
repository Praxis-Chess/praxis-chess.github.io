/* ==========================================================================
   dormancy.js — stop drawing what nobody can see.

   The hero canvas is the only continuously animating thing on this site, and
   it is also the only thing on it that can cost a laptop its battery. Three
   switches decide whether it is allowed to run:

     hidden    document.hidden. Browsers already throttle requestAnimationFrame
               in a background tab, but "throttled" is not "stopped", and the
               page is frequently left open in a tab nobody is looking at.
               Cancelling the loop outright is one line and removes the
               ambiguity.

     scrolled  the hero has left the viewport. Below the fold the canvas is
               painting a field that is not on screen — on a five-section page
               that is most of the time somebody spends here. js/field.js sets
               this from its own IntersectionObserver, so the flag costs
               nothing between crossings.

     reduced   prefers-reduced-motion. Handled here rather than in each module
               so there is exactly one answer to "is continuous motion
               allowed", and so js/a11y.js can flip it at runtime when the
               visitor changes the setting without reloading.

   WHY A SHARED FLAG OBJECT AND NOT AN EVENT
   Every consumer is already inside a requestAnimationFrame callback, so it
   can read a boolean for free. An event would mean subscription bookkeeping
   and teardown in three modules, to deliver information they are about to
   look at anyway.
   ========================================================================== */
window.DORMANT = (function () {
  'use strict';

  var mq = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  var state = {
    hidden:   document.hidden === true,
    scrolled: false,
    reduced:  mq ? mq.matches : false,
    /* Counts frames actually drawn against frames offered, so js/fps.js can
       show what the switches above are really saving rather than asserting
       it. A dial nobody can read is a dial nobody trusts. */
    offered: 0,
    drawn:   0
  };

  document.addEventListener('visibilitychange', function () {
    state.hidden = document.hidden === true;
  });

  if (mq) {
    var onMQ = function () { state.reduced = mq.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq.addListener) mq.addListener(onMQ);        // Safari < 14
  }

  /* The single question every renderer asks. A method rather than a getter
     so it reads as a decision at the call site. */
  state.asleep = function () {
    return state.hidden || state.scrolled || state.reduced;
  };

  return state;
})();
