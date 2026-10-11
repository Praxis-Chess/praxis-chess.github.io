/* ==========================================================================
   heroboard.js — the hero's board: one orchid square, walking a knight's tour.

       <div class="pboard" data-pboard></div>
       <span data-pboard-sq></span>          optional readout of the square

   WHY A BOARD AND NOT A CAPTURE. The hero used to carry a screenshot of the
   game-analysis page, which is the product's evidence but not its idea, and
   at hero size it read as a cramped window. The og-image already said the
   idea in one picture: a board, one marked square. This is that picture,
   built from 64 divs like js/board.js, so it is sharp at any density and
   themed from the same tokens.

   WHY A KNIGHT'S TOUR. The square has to move, and a random walk says
   nothing. A knight's path is the most recognisable pattern a board has:
   every jump is an L, and the three fading squares behind it make the shape
   visible. One square, again and again, becoming a shape is what Praxis
   does with mistakes. The tour is computed once with Warnsdorff's rule from
   e5 and replayed in a loop; it touches every square once per lap.

   STILL WHEN IT SHOULD BE. Reduced motion gets the og-image exactly: e5
   marked, nothing moving. The timer stops while the tab is hidden or the
   board is off screen, so the page costs nothing it is not showing.
   ========================================================================== */
window.PAGE.register('heroboard', function (scope) {
  'use strict';

  var el = scope.querySelector('[data-pboard]');
  if (!el || window.OFF.has('heroboard')) return;
  var readout = scope.querySelector('[data-pboard-sq]');

  var FILES = 'abcdefgh';
  var STEP_MS = 2400;
  var TRAIL = ['is-t1', 'is-t2', 'is-t3'];

  /* Index 0 is a8, the top-left square as drawn; a8 is a light square. */
  var squares = [];
  var frag = document.createDocumentFragment();
  for (var i = 0; i < 64; i++) {
    var d = document.createElement('i');
    d.className = 'pboard__sq' + (((i >> 3) + (i & 7)) % 2 === 0 ? ' is-light' : '');
    squares.push(d);
    frag.appendChild(d);
  }
  el.textContent = '';
  el.appendChild(frag);

  function name(i) { return FILES[i & 7] + (8 - (i >> 3)); }

  var JUMPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  function jumps(i, seen) {
    var r = i >> 3, c = i & 7, out = [];
    for (var k = 0; k < JUMPS.length; k++) {
      var rr = r + JUMPS[k][0], cc = c + JUMPS[k][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !seen[rr * 8 + cc]) out.push(rr * 8 + cc);
    }
    return out;
  }

  /* Warnsdorff: always jump to the square with the fewest onward jumps.
     Ties go to the first in JUMPS order, so the tour is the same on every
     load. If it ever dead-ends early, the loop simply restarts from e5. */
  function tour(start) {
    var seen = {}, path = [start], cur = start;
    seen[start] = true;
    while (path.length < 64) {
      var next = jumps(cur, seen);
      if (!next.length) break;
      var best = next[0], fewest = 9;
      for (var k = 0; k < next.length; k++) {
        var n = jumps(next[k], seen).length;
        if (n < fewest) { fewest = n; best = next[k]; }
      }
      seen[best] = true;
      path.push(best);
      cur = best;
    }
    return path;
  }

  var E5 = 3 * 8 + 4;
  var path = tour(E5);
  /* THE PHONE STARTS THREE JUMPS IN. A visitor on a phone often scrolls
     past before the second step lands, and a board with one pink square says
     nothing; with the trail already behind it the first frame is an L, which
     is the point. Desktop keeps its single-square opening. */
  var at = document.documentElement.classList.contains('is-mobile') ? 3 : 0;

  function paint() {
    for (var i = 0; i < squares.length; i++) {
      squares[i].classList.remove('is-on', TRAIL[0], TRAIL[1], TRAIL[2]);
    }
    squares[path[at]].classList.add('is-on');
    for (var t = 0; t < TRAIL.length; t++) {
      var back = at - 1 - t;
      if (back >= 0) squares[path[back]].classList.add(TRAIL[t]);
    }
    if (readout) {
      readout.textContent = at === 0 ? name(path[0])
        : name(path[at - 1]) + ' → ' + name(path[at]);
    }
  }

  paint();

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var timer = null, visible = true;
  function step() { at = (at + 1) % path.length; paint(); }
  function sync() {
    var run = visible && !document.hidden;
    if (run && !timer) timer = setInterval(step, STEP_MS);
    if (!run && timer) { clearInterval(timer); timer = null; }
  }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    });
    io.observe(el);
  }
  document.addEventListener('visibilitychange', sync);
  sync();

  return function () {
    if (timer) clearInterval(timer);
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
});
