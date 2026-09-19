/* ==========================================================================
   isolate.js — turn one layer off and see what it was costing.

   `?off=<name>` — several allowed, comma separated:

     field    the hero canvas (the breathing board behind the headline)
     grain    the film-grain overlay
     reveal   the scroll-in transitions, forced to their finished state
     board    the FEN renderer, leaving the empty container

   WHY THIS EXISTS RATHER THAN COMMENTING THINGS OUT
   Every performance number produced from a guess is worthless. Before any
   layer is optimised its cost has to be MEASURED, on the machine that is
   actually slow, and the cheapest way to do that is to switch layers off one
   at a time and read js/fps.js. Commenting code out to do the same thing is
   slower, unshippable, and eventually gets committed by accident.

   OFF UNLESS ASKED FOR. With no ?off= in the URL this costs one string
   comparison at load and nothing at all per frame.
   ========================================================================== */
window.OFF = (function () {
  'use strict';
  var m = /[?&]off=([^&]*)/.exec(location.search);
  var set = {};
  if (m) {
    decodeURIComponent(m[1]).split(',').forEach(function (n) {
      n = n.trim().toLowerCase();
      if (n) set[n] = true;
    });
  }
  var names = Object.keys(set);
  if (names.length) console.info('[isolate] layers off: ' + names.join(', '));
  return {
    list: names,
    has: function (n) { return set[n] === true; }
  };
})();
