/* ==========================================================================
   strip.js — the bottom information strip.

   EVERY READOUT ON IT IS REAL. The scene name is the scene you are actually
   in, the percentage is actual travel through the page, the clock is a real
   clock in the project's own timezone. Nothing here is a decorative digit
   rolling for effect.

   That is what buys the tone. The strip is trustworthy, so it reads as an
   instrument rather than as set dressing — and the moment one of its numbers
   is invented, every other number on the page looks invented too.

   It is aria-hidden: it is ambient telemetry, and reading "046%" aloud
   between two sentences of copy helps nobody. The scene it names is already
   announced by the section's own aria-label.
   ========================================================================== */
window.PAGE.register('strip', function (scope) {
  'use strict';

  var host = scope.querySelector('[data-strip]');
  if (!host) return;

  var elScene = host.querySelector('[data-strip-scene]');
  var elPct = host.querySelector('[data-strip-pct]');
  var elClock = host.querySelector('[data-strip-clock]');
  var bar = host.querySelector('[data-strip-bar]');

  /* The rail already names every scene, in order, and it is the same list.
     Reading it here rather than repeating it is what stops the two from
     disagreeing after somebody renames a section in one place. */
  var names = Array.prototype.map.call(
    scope.querySelectorAll('.rail__tick b'),
    function (b) { return b.textContent.trim(); }
  );

  /* ---- the clock -------------------------------------------------------
     Real Asia/Kolkata time via Intl, not an offset applied to the local
     clock — the latter is wrong for half the year in half the world. */
  var fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
      second: '2-digit', hour12: false
    });
  } catch (e) { fmt = null; }

  var clock = setInterval(function () {
    if (elClock) elClock.textContent = fmt ? fmt.format(new Date()) : '--:--:--';
  }, 1000);
  if (elClock && fmt) elClock.textContent = fmt.format(new Date());

  /* ---- the travel readout ----------------------------------------------
     Its own frame loop rather than a callback from js/scroll.js: this reads
     the accumulator, it does not drive it, and keeping the reader out of the
     accumulator is what stops a change here from being able to move the page.

     Writes only when the value it would print has actually changed. The
     percentage changes about a hundred times over the whole page; without
     the guard this would touch the DOM sixty times a second to write the
     same three characters. */
  var raf = 0, lastPct = -1, lastName = '';

  function tick() {
    raf = requestAnimationFrame(tick);
    var S = window.SCROLL;
    if (!S) return;

    var pct = Math.round(S.progress * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      if (elPct) elPct.textContent = (pct < 10 ? '00' : pct < 100 ? '0' : '') + pct;
      if (bar) bar.style.setProperty('--sp', (S.progress).toFixed(4));
    }

    var name = names[S.index] || '';
    if (name !== lastName) {
      lastName = name;
      if (elScene) elScene.textContent = name;
    }
  }
  raf = requestAnimationFrame(tick);

  return function () {
    cancelAnimationFrame(raf);
    clearInterval(clock);
  };
});
