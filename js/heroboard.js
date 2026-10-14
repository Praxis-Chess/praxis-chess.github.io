/* ==========================================================================
   heroboard.js: the hero's board. Four games, one fork, one pattern.

       <div class="pboard" data-pboard role="img" aria-label="..."></div>
       <p class="pboard__read">
         <span data-pboard-l1>...</span> <span data-pboard-l2>...</span>
       </p>

   WHAT IT SAYS. "Stockfish flags single mistakes, game by game. Praxis
   overlays them and finds the recurring shape." So the loop is that sentence:

     1. GAMES    four short beats. A sparse position from a game, the
                 opponent's knight lands on c2 with check, c2 pulses, and two
                 thin lines show what it forks: the king on e1, the rook on a1.
     2. PILE UP  every beat leaves faint marks on the squares it touched, and
                 a square touched again gets brighter. Frequency is intensity.
     3. REVEAL   the pieces are gone, c2 locks in, and lines join the marks
                 into the shape: the fork, and the knight's ways into it.
     4. HOLD, fade, loop. About ten seconds.

   WHY KNIGHT FORKS ON C2. Forks are the example the whole page already uses
   (the Gap's quote, the Pattern Report, Today's focus), and one fork square
   coming back game after game is the headline's promise made literal: a
   move is a square, a habit is a shape. The family fork on c2 (king e1,
   rook a1, before castling) is the commonest version an amateur meets.

   EVERY POSITION IS REAL CHESS, AND PROVABLY SO. The beats are stored as
   full FENs, not as pictures. tools/check-hero.js loads chess.js and checks
   each one: a legal position, Black to move, the knight move legal and
   matching its SAN, check on e1, the rook on a1 attacked, and nothing able to
   take back on c2. The board only DRAWS a few pieces (the knight, the two
   it forks, and a handful of dim context pieces listed in `show`), but what
   it draws is always read out of a position that passed those checks.

   THE DATA IS THE ONLY THING TO EDIT for a different pattern. It is strict
   JSON between the PATTERN-JSON markers so the check can read it without
   running this file. Labels use {braces} for chess tokens (SAN, squares),
   which are set in their real case inside the otherwise uppercase caption:
   "NC2+" is not a move, "Nc2+" is.

   ETIQUETTE. Paused when the board is off screen or the tab is hidden, and
   on resume the interrupted beat starts again from the top with the marks of
   the finished beats restored. Reduced motion gets the finished reveal as a
   still. Pieces are absolutely positioned inside their squares and the
   caption has two reserved lines, so nothing on the page moves while this
   runs. No canvas, no WebGL: 64 squares, a few glyphs, one small SVG.
   ========================================================================== */
window.PAGE.register('heroboard', function (scope) {
  'use strict';

  var el = scope.querySelector('[data-pboard]');
  if (!el || window.OFF.has('heroboard')) return;
  var cap = scope.querySelector('.pboard__read');
  var cap1 = scope.querySelector('[data-pboard-l1]');
  var cap2 = scope.querySelector('[data-pboard-l2]');

  /**
   * @typedef {Object} Beat
   * @property {string}   game  game number, as shown
   * @property {number}   move  move number of the knight move
   * @property {string}   san   the knight move in SAN, checked against chess.js
   * @property {string}   fen   the full position before the move
   * @property {string}   from  the knight's square
   * @property {string}   to    where it lands: the fork square
   * @property {string[]} show  context squares to draw, dimmed
   *
   * @typedef {Object} Pattern
   * @property {string}   square    the fork square every beat lands on
   * @property {string[]} targets   the squares it forks
   * @property {string}   beatNote  caption line 2 during the beats
   * @property {{line1:string, line2:string}} finding  caption at the reveal
   * @property {Beat[]}   beats
   */

  /** @type {Pattern} */
  var PATTERN = /* PATTERN-JSON */ {
    "square": "c2",
    "targets": ["e1", "a1"],
    "beatNote": "Forks king and rook",
    "finding": { "line1": "Pattern · knight forks on {c2}", "line2": "Example · 9 of 31 games" },
    "beats": [
      { "game": "04", "move": 11, "san": "Nc2+",  "fen": "6k1/5ppp/8/8/1n6/8/PP3PPP/R3K3 b Q - 0 11",
        "from": "b4", "to": "c2", "show": ["a2", "b2", "g8"] },
      { "game": "09", "move": 14, "san": "Nxc2+", "fen": "6k1/ppp2ppp/3p4/4p3/3nP1Q1/8/PPP2PPP/R3K2R b KQ - 0 14",
        "from": "d4", "to": "c2", "show": ["c2", "e4", "g4", "g8"] },
      { "game": "17", "move": 12, "san": "Nc2+",  "fen": "r3k2r/ppp2ppp/8/8/8/2P1n3/PP3PPP/R3KB1R b KQkq - 0 12",
        "from": "e3", "to": "c2", "show": ["c3", "f2", "f1", "e8"] },
      { "game": "23", "move": 16, "san": "Nxc2+", "fen": "6k1/5ppp/8/8/1n5Q/8/PPP2PPP/R3K2R b KQ - 0 16",
        "from": "b4", "to": "c2", "show": ["c2", "h4", "g8"] }
    ]
  } /* /PATTERN-JSON */;

  var FILES = 'abcdefgh';
  /* The filled set for both colours, as in js/board.js: the outline set draws
     as hairlines in most system fonts and vanishes at this size. */
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  /* Frequency to intensity: orchid alpha by how many beats touched a square.
     The first three steps are the old trail's, so the board keeps its tone. */
  var HEAT = [0, 0.08, 0.18, 0.34, 0.5];
  var BEAT_MS = 1600, REVEAL_MS = 3400, FADE_MS = 600;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var beats = PATTERN.beats;

  function idx(sq) { return (8 - Number(sq[1])) * 8 + FILES.indexOf(sq[0]); }

  /* ---- the board -------------------------------------------------------
     Index 0 is a8, top left as drawn. a8 is light, so a1 comes out dark. */
  var squares = [];
  var frag = document.createDocumentFragment();
  for (var i = 0; i < 64; i++) {
    var d = document.createElement('i');
    d.className = 'pboard__sq' + (((i >> 3) + (i & 7)) % 2 === 0 ? ' is-light' : '');
    squares.push(d);
    frag.appendChild(d);
  }
  var fx = document.createElementNS(SVGNS, 'svg');
  fx.setAttribute('class', 'pboard__fx');
  fx.setAttribute('aria-hidden', 'true');
  fx.setAttribute('focusable', 'false');
  el.textContent = '';
  el.appendChild(frag);
  el.appendChild(fx);

  function sq(name) { return squares[idx(name)]; }

  /* Piece placement of a FEN, as square -> piece letter. */
  function placement(fen) {
    var out = {}, ranks = fen.split(' ')[0].split('/');
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var k = 0; k < ranks[r].length; k++) {
        var ch = ranks[r][k];
        if (ch >= '1' && ch <= '8') f += Number(ch);
        else { out[FILES[f] + (8 - r)] = ch; f++; }
      }
    }
    return out;
  }

  /* ---- timers, so a pause can cancel everything at once ---------------- */
  var timers = [];
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ---- pieces ------------------------------------------------------------ */
  var live = [];
  function piece(ch, name, ctx) {
    var s = document.createElement('span');
    s.className = 'pboard__pc' + (ctx ? ' is-ctx' : '');
    s.setAttribute('data-c', ch === ch.toLowerCase() ? 'b' : 'w');
    s.textContent = GLYPH[ch.toLowerCase()];
    sq(name).appendChild(s);
    live.push(s);
    return s;
  }

  /* ---- the overlay -------------------------------------------------------
     The SVG's viewBox is the board's own pixel size, refreshed whenever
     something is drawn, so every coordinate below is a plain board pixel and
     a CSS translate on a dot moves it by exactly that many. If the board is
     resized while a frame is up the drawing scales with it, and strokes stay
     crisp because they are non-scaling (site.css). */
  function fitFx() {
    fx.setAttribute('viewBox', '0 0 ' + (el.clientWidth || 1) + ' ' + (el.clientHeight || 1));
  }
  function centre(name) {
    var s = sq(name);
    return [s.offsetLeft + s.offsetWidth / 2, s.offsetTop + s.offsetHeight / 2];
  }
  function svg(tag, attrs, cls) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (cls) n.setAttribute('class', cls);
    fx.appendChild(n);
    return n;
  }
  function line(a, b, cls) {
    fitFx();
    var p = centre(a), q = centre(b);
    return svg('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], pathLength: 1 }, cls);
  }
  function drawLine(l, delay) {
    at(delay, function () { l.getBoundingClientRect(); l.classList.add('is-drawn'); });
  }
  function dot(c, r, cls) { return svg('circle', { cx: c[0], cy: c[1], r: r }, cls); }
  function show(n) { n.classList.add('is-in'); }

  /* Running animations (the reveal's pulses and ripple), so a pause or a
     clear can stop them along with the timers. */
  var anims = [];
  function cancelAnims() {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    anims = [];
  }

  /* ---- marks ------------------------------------------------------------- */
  var counts = {};
  function setHeat(name) {
    var n = Math.min(counts[name] || 0, HEAT.length - 1);
    sq(name).style.setProperty('--heat', String(HEAT[n]));
  }
  function mark(b) {
    [b.to, b.from].concat(PATTERN.targets).forEach(function (name) {
      counts[name] = (counts[name] || 0) + 1;
      setHeat(name);
    });
  }
  function resetHeat() {
    counts = {};
    squares.forEach(function (s) { s.style.removeProperty('--heat'); });
  }
  function clearBoard() {
    cancelAnims();
    live.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
    live = [];
    while (fx.firstChild) fx.removeChild(fx.firstChild);
    squares.forEach(function (s) { s.classList.remove('is-hit', 'is-on'); });
  }

  /* ---- caption ------------------------------------------------------------ */
  function fill(node, text) {
    if (!node) return;
    node.textContent = '';
    text.split(/(\{[^}]*\})/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '{') {
        var s = document.createElement('span');
        s.className = 'pboard__san';
        s.textContent = part.slice(1, -1);
        node.appendChild(s);
      } else {
        node.appendChild(document.createTextNode(part));
      }
    });
  }
  function setLabel(l1, l2, instant) {
    if (instant || !cap) { fill(cap1, l1); fill(cap2, l2); return; }
    cap.classList.add('is-swap');
    at(150, function () { fill(cap1, l1); fill(cap2, l2); cap.classList.remove('is-swap'); });
  }
  function beatLabel(b) {
    /* "…Nc2+": the ellipsis is how a Black move is written on its own. */
    return 'Game ' + b.game + ' · move ' + b.move + ' · {…' + b.san + '}';
  }

  /* ---- one game ----------------------------------------------------------- */
  function playBeat(b) {
    var pos = placement(b.fen);
    setLabel(beatLabel(b), PATTERN.beatNote);

    var actors = [b.from].concat(PATTERN.targets);
    var captured = null;
    b.show.forEach(function (name) {
      if (!pos[name] || actors.indexOf(name) >= 0) return;
      var p = piece(pos[name], name, true);
      if (name === b.to) captured = p;
    });
    PATTERN.targets.forEach(function (name) { if (pos[name]) piece(pos[name], name, false); });
    var knight = piece(pos[b.from], b.from, false);

    el.getBoundingClientRect();
    live.forEach(function (p) { p.classList.add('is-in'); });

    /* The slide is a FLIP: the knight is moved into its landing square at
       once, offset back to where it came from, then released. Exact at any
       board size. It stays visible over the squares it crosses because
       pieces have their own z-index (site.css); grid order alone is not
       enough, since a path like e3 to c2 crosses d2, which comes after c2. */
    at(150, function () {
      var a = sq(b.from), z = sq(b.to);
      var dx = a.offsetLeft - z.offsetLeft, dy = a.offsetTop - z.offsetTop;
      z.appendChild(knight);
      knight.style.transition = 'none';
      knight.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      knight.getBoundingClientRect();
      knight.style.transition = '';
      knight.style.transform = '';
    });

    at(550, function () {
      if (captured) captured.classList.remove('is-in');
      sq(b.to).classList.add('is-hit');
      PATTERN.targets.forEach(function (t) { drawLine(line(b.to, t, 'is-fork'), 0); });
    });

    at(850, function () {
      sq(b.to).classList.remove('is-hit');
      mark(b);
    });

    at(1300, function () {
      live.forEach(function (p) { p.classList.remove('is-in'); });
      Array.prototype.forEach.call(fx.childNodes, function (l) { l.classList.add('is-gone'); });
    });
  }

  /* ---- the finding ----------------------------------------------------------- */
  function origins() {
    var seen = {}, out = [];
    beats.forEach(function (b) { if (!seen[b.from]) { seen[b.from] = 1; out.push(b.from); } });
    return out;
  }
  /* THE REVEAL READS AS A LOCK, NOT A DIAGRAM. Every line is a wire: a node
     with a halo where it starts or ends away from c2, beads along it that
     light as the line draws through them, and once all of it is down a pulse
     that keeps running along it. The pulses run into c2 from the squares the
     knight came from, and out of c2 to the king and rook it forks: the habit
     arriving, and what it costs. Four corner brackets close on c2, the same
     registration mark the page's own frame uses, with one ripple as they
     land. One colour throughout: it is all the orchid at different weights. */
  var DRAW_MS = 450;                 // the line's dashoffset transition
  var BEADS = [0.25, 0.5, 0.75];
  var PULSE_AT = 1500;               // pulses start once every line is down

  function lock(name, instant) {
    var s = sq(name), x0 = s.offsetLeft, y0 = s.offsetTop;
    var x1 = x0 + s.offsetWidth, y1 = y0 + s.offsetHeight;
    var o = s.offsetWidth * 0.14, L = s.offsetWidth * 0.26, c = centre(name);
    var corners = [
      [[x0 - o, y0 - o + L], [x0 - o, y0 - o], [x0 - o + L, y0 - o]],
      [[x1 + o - L, y0 - o], [x1 + o, y0 - o], [x1 + o, y0 - o + L]],
      [[x1 + o, y1 + o - L], [x1 + o, y1 + o], [x1 + o - L, y1 + o]],
      [[x0 - o + L, y1 + o], [x0 - o, y1 + o], [x0 - o, y1 + o - L]]
    ];
    corners.forEach(function (pts) {
      var t = svg('polyline', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') }, 'fx-tick');
      /* Scaled about c2's centre, so the four brackets converge on it. */
      t.style.transformOrigin = c[0] + 'px ' + c[1] + 'px';
      if (instant) show(t); else at(120, function () { show(t); });
    });
  }

  function ripple(name) {
    var c = centre(name), r = sq(name).offsetWidth * 1.3;
    var n = dot(c, r, 'fx-ripple');
    if (!n.animate) return;
    anims.push(n.animate([
      { transform: 'scale(.38)', opacity: 0.6 },
      { transform: 'scale(1)', opacity: 0 }
    ], { duration: 950, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
  }

  function pulse(A, Z, r, delay) {
    var p = dot(A, r, 'fx-pulse');
    if (!p.animate) return;
    var dx = Z[0] - A[0], dy = Z[1] - A[1];
    anims.push(p.animate([
      { transform: 'translate(0px,0px)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.8 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px)', opacity: 0 }
    ], { duration: 1300, delay: delay, iterations: Infinity, easing: 'cubic-bezier(.45,0,.25,1)' }));
  }

  function playReveal(instant) {
    setLabel(PATTERN.finding.line1, PATTERN.finding.line2, instant);
    var home = PATTERN.square;
    sq(home).classList.add('is-on');
    fitFx();
    var s = sq(home).offsetWidth;

    /* Fork prongs draw outward from c2; the knight's ways in draw inward. */
    var wires = PATTERN.targets.map(function (t, k) {
      return { from: home, to: t, outer: t, cls: 'is-fork', delay: 200 + k * 140 };
    }).concat(origins().map(function (o, k) {
      return { from: o, to: home, outer: o, cls: 'is-spoke', delay: 620 + k * 140 };
    }));

    if (!instant) ripple(home);

    wires.forEach(function (w, k) {
      var A = centre(w.from), Z = centre(w.to), N = centre(w.outer);
      var l = line(w.from, w.to, w.cls);
      var node = [dot(N, s * 0.17, 'fx-ring'), dot(N, Math.max(2, s * 0.07), 'fx-node')];
      var beads = BEADS.map(function (f) {
        return { f: f, n: dot([A[0] + (Z[0] - A[0]) * f, A[1] + (Z[1] - A[1]) * f], Math.max(1.2, s * 0.035), 'fx-bead') };
      });
      if (instant) {
        l.classList.add('is-drawn');
        node.forEach(show);
        beads.forEach(function (b) { show(b.n); });
        return;
      }
      drawLine(l, w.delay);
      /* The node lights where the wire touches it: at the start of an
         inward spoke, at the end of an outward prong. */
      at(w.outer === w.from ? w.delay : w.delay + DRAW_MS, function () { node.forEach(show); });
      beads.forEach(function (b) { at(w.delay + b.f * DRAW_MS, function () { show(b.n); }); });
      pulse(A, Z, Math.max(2.2, s * 0.06), PULSE_AT + k * 170);
    });

    lock(home, instant);
  }
  function fadeOut() {
    sq(PATTERN.square).classList.remove('is-on');
    resetHeat();
    cancelAnims();
    Array.prototype.forEach.call(fx.childNodes, function (n) { n.classList.add('is-gone'); });
  }

  /* ---- the loop ----------------------------------------------------------- */
  var seg = 0;
  function next() {
    clearBoard();
    if (seg < beats.length) {
      playBeat(beats[seg]);
      at(BEAT_MS, function () { seg += 1; next(); });
    } else {
      playReveal(false);
      at(REVEAL_MS, fadeOut);
      at(REVEAL_MS + FADE_MS, function () { seg = 0; next(); });
    }
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    beats.forEach(mark);
    playReveal(true);
    return;
  }

  /* A phone visitor often scrolls past within a beat or two, and an empty
     board says nothing; so the phone starts at the second game with the
     first one's marks already down. Desktop starts at the first, after a
     short beat for the headline to land. */
  var phone = document.documentElement.classList.contains('is-mobile');
  if (phone) seg = 1;
  var first = true, running = false;

  function start() {
    if (running) return;
    running = true;
    clearBoard();
    resetHeat();
    for (var k = 0; k < Math.min(seg, beats.length); k++) mark(beats[k]);
    if (first && !phone) { first = false; at(600, next); }
    else { first = false; next(); }
  }
  function stop() {
    if (!running) return;
    running = false;
    clearTimers();
    cancelAnims();
  }

  var visible = true;
  function sync() {
    if (visible && !document.hidden) start(); else stop();
  }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      /* The LAST entry: a scroll away and back can arrive as one batch, and
         the first entry in it is the stale one. */
      visible = entries[entries.length - 1].isIntersecting;
      sync();
    });
    io.observe(el);
  }
  document.addEventListener('visibilitychange', sync);
  sync();

  return function () {
    clearTimers();
    cancelAnims();
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
});
