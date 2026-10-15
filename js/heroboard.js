/* ==========================================================================
   heroboard.js: the hero's board. A reel of seven tactics, one after another.

       <div class="pboard" data-pboard role="img" aria-label="..."></div>
       <p class="pboard__read">
         <span class="pboard__ticks" data-pboard-ticks></span>
         <span data-pboard-l1>...</span> <span data-pboard-l2>...</span>
       </p>

   WHAT IT SAYS. The mistakes Praxis catches have names, and each one is a
   shape on the board. So every clip is the same three steps, with a
   different motif, piece and part of the board each time:

     1. THE MISTAKE   Black makes a natural looking move ("…Qc8?").
     2. THE TACTIC    White punishes it ("Ne7+!"), and thin lines show what
                      the move does: the fork's two prongs, the pin's line.
     3. THE PAYOFF    the reply and the win, then the motif's shape locks in:
                      brackets close on the key square, wires with nodes and
                      beads join the squares that matter, pulses run along
                      them, and escape squares that are gone get a cross.

   Fork, hanging piece, skewer, pin, back-rank mate, discovered check and
   removing the defender, about five seconds each, then round again. The fork
   leads because it is the example the rest of the page uses.

   EVERY CLIP IS REAL CHESS, AND PROVABLY SO. Each motif is a full FEN and
   its moves, stored as from/to squares (this page has no chess library) with
   the SAN beside them. tools/check-hero.js loads chess.js and checks every
   one: a legal position, every move legal and matching its SAN, no castling,
   promotion or en passant (the player below does not draw them), the motif's
   own property (the fork attacks both targets, the pinned knight has no
   legal move, the hanging knight has nobody left to guard it, and so on), and a small
   search over every defence showing the tactic wins material or mates.

   THE DATA IS THE ONLY THING TO EDIT. It is strict JSON between the REEL-JSON
   markers so the check can read it without running this file. Each motif
   carries `appMotif`, its name in the app's TacticalMotif enum (null where
   the app has no such category), so the same records can drive a reel of a
   player's own most-missed motif inside the app later. This page cannot do
   that itself: it is static, and Praxis keeps every game on the player's
   machine.

   ETIQUETTE. Paused when the board is off screen or the tab is hidden; on
   resume the interrupted clip starts again from the top. Reduced motion gets
   the fork's finished frame as a still. Pieces are absolutely positioned
   inside their squares, the caption has two reserved lines and the progress
   ticks sit in the gap above it, so nothing on the page moves while this
   runs. No canvas, no WebGL: 64 squares, a few glyphs, one small SVG.
   ========================================================================== */
window.PAGE.register('heroboard', function (scope) {
  'use strict';

  var el = scope.querySelector('[data-pboard]');
  if (!el || window.OFF.has('heroboard')) return;
  var cap = scope.querySelector('.pboard__read');
  var cap1 = scope.querySelector('[data-pboard-l1]');
  var cap2 = scope.querySelector('[data-pboard-l2]');
  var tickBox = scope.querySelector('[data-pboard-ticks]');

  /**
   * One move of a clip. Black's first move is the mistake; White's next is
   * the tactic; anything after is the reply and the payoff.
   * @typedef {Object} Ply
   * @property {string} from
   * @property {string} to
   * @property {string} san    checked against chess.js; shown in the caption
   * @property {'mistake'|'tactic'|'reply'|'payoff'} role
   * @property {string[][]} [lines]  [a, b] pairs drawn as this move lands
   * @property {boolean} [cut]       this move removes the motif's guards
   *
   * The motif's picture, drawn once the last move has landed.
   * @typedef {Object} Shape
   * @property {string}     lock     the key square: the brackets close on it
   * @property {string[][]} wires    [a, b] pairs; pulses run from a to b
   * @property {string[]}   [nodes]  extra squares marked with a node
   * @property {string[]}   [cross]  squares crossed out: escapes that are gone
   *
   * @typedef {Object} Motif
   * @property {string}      id
   * @property {string|null} appMotif  the app's TacticalMotif, if it has one
   * @property {string}      name      caption line 1, before the dot
   * @property {string}      idea      caption line 1, after it
   * @property {string}      fen       the position before the mistake
   * @property {string[]}    focus     pieces drawn bright; the rest are dim
   * @property {string[][]}  [guards]  dashed lines shown from the start
   * @property {Ply[]}       plies
   * @property {Shape}       shape
   * @property {Object}      proof     what tools/check-hero.js proves
   */

  /** @type {{motifs: Motif[]}} */
  var REEL = /* REEL-JSON */ {
    "motifs": [
      { "id": "fork", "appMotif": "FORK",
        "name": "Fork", "idea": "one move, two targets",
        "fen": "3q1rk1/5ppp/8/3N4/8/8/4QPPP/6K1 b - - 0 21",
        "focus": ["d8", "g8", "d5"],
        "plies": [
          { "from": "d8", "to": "c8", "san": "Qc8", "role": "mistake" },
          { "from": "d5", "to": "e7", "san": "Ne7+", "role": "tactic", "lines": [["e7", "g8"], ["e7", "c8"]] },
          { "from": "g8", "to": "h8", "san": "Kh8", "role": "reply" },
          { "from": "e7", "to": "c8", "san": "Nxc8", "role": "payoff" }
        ],
        "shape": { "lock": "e7", "wires": [["e7", "g8"], ["e7", "c8"], ["d5", "e7"]] },
        "proof": { "kind": "fork", "at": "e7", "targets": ["g8", "c8"] } },

      { "id": "hanging", "appMotif": "HANGING_PIECE",
        "name": "Hanging piece", "idea": "nobody guards it",
        "fen": "1r4k1/5ppp/8/8/1n6/7P/3Q1PP1/6K1 b - - 0 26",
        "focus": ["b8", "b4", "d2"],
        "guards": [["b8", "b4"]],
        "plies": [
          { "from": "b8", "to": "d8", "san": "Rd8", "role": "mistake", "cut": true, "lines": [["d8", "d2"]] },
          { "from": "d2", "to": "b4", "san": "Qxb4", "role": "tactic" }
        ],
        "shape": { "lock": "b4", "wires": [["d2", "b4"]], "cross": ["b8"] },
        "proof": { "kind": "hanging", "piece": "b4", "guard": "b8" } },

      { "id": "skewer", "appMotif": "SKEWER",
        "name": "Skewer", "idea": "the king steps aside",
        "fen": "3q4/3p1ppp/4k3/8/8/8/5PPP/R5K1 b - - 0 30",
        "focus": ["d8", "e6", "a1"],
        "plies": [
          { "from": "d8", "to": "e8", "san": "Qe8", "role": "mistake" },
          { "from": "a1", "to": "e1", "san": "Re1+", "role": "tactic", "lines": [["e1", "e8"]] },
          { "from": "e6", "to": "d6", "san": "Kd6", "role": "reply" },
          { "from": "e1", "to": "e8", "san": "Rxe8", "role": "payoff" }
        ],
        "shape": { "lock": "e8", "wires": [["e1", "e8"]], "nodes": ["e6"] },
        "proof": { "kind": "skewer", "front": "e6", "back": "e8" } },

      { "id": "pin", "appMotif": "PIN",
        "name": "Pin", "idea": "the knight is frozen",
        "fen": "1n2k3/1p3ppp/8/1B6/3P4/8/5PPP/6K1 b - - 0 15",
        "focus": ["b8", "e8", "b5", "d4"],
        "plies": [
          { "from": "b8", "to": "c6", "san": "Nc6", "role": "mistake", "lines": [["b5", "e8"]] },
          { "from": "d4", "to": "d5", "san": "d5", "role": "tactic", "lines": [["d5", "c6"]] },
          { "from": "e8", "to": "e7", "san": "Ke7", "role": "reply" },
          { "from": "d5", "to": "c6", "san": "dxc6", "role": "payoff" }
        ],
        "shape": { "lock": "c6", "wires": [["b5", "e8"], ["d5", "c6"]] },
        "proof": { "kind": "pin", "pinned": "c6", "attacker": "d5" } },

      { "id": "back-rank", "appMotif": "BACK_RANK",
        "name": "Back rank", "idea": "no air for the king",
        "fen": "2r3k1/1b3ppp/8/8/8/8/5PPP/3Q2K1 b - - 0 27",
        "focus": ["c8", "g8", "d1", "f7", "g7", "h7"],
        "plies": [
          { "from": "c8", "to": "c2", "san": "Rc2", "role": "mistake" },
          { "from": "d1", "to": "d8", "san": "Qd8#", "role": "tactic", "lines": [["d8", "g8"]] }
        ],
        "shape": { "lock": "g8", "wires": [["d1", "d8"], ["d8", "g8"]], "nodes": ["f7", "g7", "h7"], "cross": ["f8", "h8"] },
        "proof": { "kind": "mate", "mateIn": 0 } },

      { "id": "discovered", "appMotif": "DISCOVERED_ATTACK",
        "name": "Discovered check", "idea": "two threats",
        "fen": "7k/q4ppp/8/8/3N4/8/1B3PPP/6K1 b - - 0 24",
        "focus": ["a7", "h8", "g7", "d4", "b2"],
        "plies": [
          { "from": "g7", "to": "g6", "san": "g6", "role": "mistake" },
          { "from": "d4", "to": "c6", "san": "Nc6+", "role": "tactic", "lines": [["b2", "h8"], ["c6", "a7"]] },
          { "from": "h8", "to": "g8", "san": "Kg8", "role": "reply" },
          { "from": "c6", "to": "a7", "san": "Nxa7", "role": "payoff" }
        ],
        "shape": { "lock": "d4", "wires": [["b2", "h8"], ["d4", "c6"], ["c6", "a7"]] },
        "proof": { "kind": "discovered", "line": "b2", "mover": "c6", "target": "a7" } },

      { "id": "remove-defender", "appMotif": null,
        "name": "Remove the defender", "idea": "then mate",
        "fen": "r6k/p4ppp/5n2/6B1/8/3Q4/2B2PPP/6K1 b - - 0 19",
        "focus": ["f6", "h7", "h8", "g5", "d3", "c2"],
        "guards": [["f6", "h7"]],
        "plies": [
          { "from": "a7", "to": "a6", "san": "a6", "role": "mistake" },
          { "from": "g5", "to": "f6", "san": "Bxf6", "role": "tactic", "cut": true, "lines": [["c2", "h7"]] },
          { "from": "g7", "to": "f6", "san": "gxf6", "role": "reply" },
          { "from": "d3", "to": "h7", "san": "Qxh7#", "role": "payoff" }
        ],
        "shape": { "lock": "h7", "wires": [["c2", "h7"], ["g5", "f6"]] },
        "proof": { "kind": "removeDefender", "defender": "f6", "guards": "h7", "mateIn": 2 } }
    ]
  } /* /REEL-JSON */;

  var motifs = REEL.motifs;
  var FILES = 'abcdefgh';
  /* The filled set for both colours, as in js/board.js: the outline set draws
     as hairlines in most system fonts and vanishes at this size. */
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* THE CLIP'S CLOCK, in ms from its start. Moves land at PLY_AT (a two-move
     clip just holds its payoff longer), the shape starts HUD_GAP after the
     last one, and every clip is CLIP_MS plus the FADE_MS dip into the next,
     whatever its length, so the reel keeps an even beat. Seven clips: 37s. */
  var PLY_AT = [500, 1300, 2150, 2850];
  var HUD_GAP = 400, CLIP_MS = 4800, FADE_MS = 500;
  var DRAW_MS = 450;                 // the line's dashoffset transition
  var LAND_MS = 350;                 // about when a sliding piece arrives
  var PULSE_AT = 900;                // after the shape starts: wires are down
  var BEADS = [0.25, 0.5, 0.75];

  function idx(name) { return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]); }

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

  /* ---- timers and animations, so a pause can cancel everything at once -- */
  var timers = [];
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  var anims = [];
  function cancelAnims() {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    anims = [];
  }

  /* ---- pieces ------------------------------------------------------------
     `board` is the position as drawn: square -> the glyph standing on it. */
  var live = [], board = {};
  function piece(ch, name, ctx) {
    var s = document.createElement('span');
    s.className = 'pboard__pc' + (ctx ? ' is-ctx' : '');
    s.setAttribute('data-c', ch === ch.toLowerCase() ? 'b' : 'w');
    s.textContent = GLYPH[ch.toLowerCase()];
    sq(name).appendChild(s);
    live.push(s);
    board[name] = s;
    return s;
  }
  function setUp(m) {
    var pos = placement(m.fen);
    Object.keys(pos).forEach(function (name) { piece(pos[name], name, m.focus.indexOf(name) < 0); });
  }

  /* A move. The slide is a FLIP: the piece is moved into its landing square
     at once, offset back to where it came from, then released. Exact at any
     board size. It stays visible over the squares it crosses because pieces
     have their own z-index (site.css); grid order alone is not enough, since
     a path like e3 to c2 crosses d2, which comes after c2. A piece taken
     fades as the mover arrives. A dim piece that moves joins the story. */
  function move(p, instant) {
    var mover = board[p.from], victim = board[p.to];
    delete board[p.from];
    board[p.to] = mover;
    if (victim) {
      if (instant) victim.parentNode.removeChild(victim);
      else at(LAND_MS - 150, function () { victim.classList.remove('is-in'); });
    }
    var a = sq(p.from), z = sq(p.to);
    var dx = a.offsetLeft - z.offsetLeft, dy = a.offsetTop - z.offsetTop;
    z.appendChild(mover);
    mover.classList.remove('is-ctx');
    if (instant) return;
    mover.style.transition = 'none';
    mover.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    mover.getBoundingClientRect();
    mover.style.transition = '';
    mover.style.transform = '';
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
  function size() { return squares[0].offsetWidth; }
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
  function fxAll(sel) { return Array.prototype.slice.call(fx.querySelectorAll(sel)); }

  /* ---- square marks --------------------------------------------------------
     --heat is an inset wash of the orchid, --ring a 1px orchid outline (the
     mistake's squares). Both are alphas, so a mark reads the same on a light
     and a dark square and never becomes a second colour. */
  function heat(name, a) { sq(name).style.setProperty('--heat', String(a)); }
  function ring(name, a) { sq(name).style.setProperty('--ring', String(a)); }
  function clearMarks() {
    squares.forEach(function (s) { s.style.removeProperty('--heat'); s.style.removeProperty('--ring'); });
  }
  function clearBoard() {
    cancelAnims();
    live.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
    live = [];
    board = {};
    while (fx.firstChild) fx.removeChild(fx.firstChild);
    clearMarks();
  }

  /* ---- caption ------------------------------------------------------------ */
  function fill(node, text) {
    if (!node) return;
    /* An empty line still holds its height (a clip starts with no moves
       yet), or the caption, and the vertically centred hero with it, would
       jump a few pixels at every clip. */
    if (!text) { node.textContent = ' '; return; }
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
  function title(m) { return m.name + ' · ' + m.idea; }
  /* A move as a scoresheet writes it: "21…Qc8?" for Black's first move,
     "22.Ne7+!" for White's, "Kh8" for a Black reply. The mistake gets "?",
     the tactic "!" (but a mate speaks for itself). tools/check-hero.js
     builds the same string to keep it inside a phone's caption. */
  function moveText(m, k) {
    var parts = m.fen.split(' '), black = parts[1] === 'b', n = Number(parts[5]);
    var white = black ? k % 2 === 1 : k % 2 === 0;
    var num = n + (black ? Math.floor((k + 1) / 2) : Math.floor(k / 2));
    var p = m.plies[k];
    var pre = white ? num + '.' : (k === 0 ? num + '…' : '');
    var suf = p.role === 'mistake' ? '?' : (p.role === 'tactic' && !/#$/.test(p.san) ? '!' : '');
    return pre + p.san + suf;
  }
  function score(m, upto) {
    var out = [];
    for (var k = 0; k <= upto; k++) out.push(moveText(m, k));
    return '{' + out.join(' ') + '}';
  }

  /* ---- progress ticks: one per motif, the current one lit ---------------- */
  var ticks = [];
  if (tickBox) {
    tickBox.textContent = '';
    motifs.forEach(function () {
      var t = document.createElement('i');
      tickBox.appendChild(t);
      ticks.push(t);
    });
  }
  function setTick(n) {
    ticks.forEach(function (t, k) { t.classList.toggle('is-on', k === n); });
  }

  /* ---- one move of a clip -------------------------------------------------- */
  function playPly(m, k) {
    var p = m.plies[k];
    move(p, false);
    fill(cap2, score(m, k));
    if (p.role === 'mistake') { ring(p.from, 0.35); ring(p.to, 0.6); }
    if (p.role === 'tactic') {
      at(LAND_MS, function () { heat(p.to, 0.5); });
      at(LAND_MS + 450, function () { heat(p.to, 0.18); });
    }
    if (p.cut) at(LAND_MS - 100, function () { fxAll('.is-guard').forEach(function (g) { g.classList.add('is-gone'); }); });
    (p.lines || []).forEach(function (pair, j) {
      var l = line(pair[0], pair[1], 'is-threat');
      drawLine(l, LAND_MS + j * 120);
    });
  }

  /* ---- the payoff: the motif's shape ------------------------------------------
     IT READS AS A LOCK, NOT A DIAGRAM. Every wire has a node with a halo at
     each end away from the key square, beads along it that light as the line
     draws through them, and once all of it is down a pulse that keeps running
     along it. Four corner brackets close on the key square, the same
     registration mark the page's own frame uses, with one ripple as they
     land. Crosses mark the escape squares that are gone. The move's own
     threat lines fade as the wires replace them. One colour throughout: it is
     all the orchid at different weights. */
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
      /* Scaled about the square's centre, so the four brackets converge on it. */
      t.style.transformOrigin = c[0] + 'px ' + c[1] + 'px';
      if (instant) show(t); else at(120, function () { show(t); });
    });
  }
  function ripple(name) {
    var c = centre(name), r = size() * 1.3;
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
  function cross(name, delay, instant) {
    var c = centre(name), r = size() * 0.16;
    var x = svg('path', { d: 'M' + (c[0] - r) + ' ' + (c[1] - r) + 'L' + (c[0] + r) + ' ' + (c[1] + r) +
                             'M' + (c[0] + r) + ' ' + (c[1] - r) + 'L' + (c[0] - r) + ' ' + (c[1] + r) }, 'fx-x');
    if (instant) show(x); else at(delay, function () { show(x); });
  }

  function playShape(m, instant) {
    var sh = m.shape, s = size();
    fitFx();
    fxAll('.is-threat').forEach(function (l) { l.classList.add('is-gone'); });
    heat(sh.lock, 0.34);
    if (!instant) ripple(sh.lock);

    /* Nodes: each wire end away from the key square, once, lit when its wire
       touches it, plus any the motif adds (the king behind a skewer, the
       pawns that box a king in). */
    var lit = {};
    function node(name, delay) {
      if (lit[name] || name === sh.lock) return;
      lit[name] = 1;
      var parts = [dot(centre(name), s * 0.17, 'fx-ring'), dot(centre(name), Math.max(2, s * 0.07), 'fx-node')];
      if (instant) parts.forEach(show);
      else at(delay, function () { parts.forEach(show); });
    }

    sh.wires.forEach(function (w, k) {
      var A = centre(w[0]), Z = centre(w[1]), delay = 200 + k * 140;
      var l = line(w[0], w[1], 'is-wire');
      var beads = BEADS.map(function (f) {
        return { f: f, n: dot([A[0] + (Z[0] - A[0]) * f, A[1] + (Z[1] - A[1]) * f], Math.max(1.2, s * 0.035), 'fx-bead') };
      });
      node(w[0], delay);
      node(w[1], delay + DRAW_MS);
      if (instant) {
        l.classList.add('is-drawn');
        beads.forEach(function (b) { show(b.n); });
        return;
      }
      drawLine(l, delay);
      beads.forEach(function (b) { at(delay + b.f * DRAW_MS, function () { show(b.n); }); });
      pulse(A, Z, Math.max(2.2, s * 0.06), PULSE_AT + k * 170);
    });
    (sh.nodes || []).forEach(function (name, k) { node(name, 500 + k * 90); });
    (sh.cross || []).forEach(function (name, k) { cross(name, 650 + k * 120, instant); });
    lock(sh.lock, instant);
  }

  function fadeOut() {
    cancelAnims();
    clearMarks();
    live.forEach(function (p) { p.classList.remove('is-in'); });
    Array.prototype.forEach.call(fx.childNodes, function (n) { n.classList.add('is-gone'); });
  }

  /* ---- one clip, and the reel ------------------------------------------------ */
  function guards(m, instant) {
    (m.guards || []).forEach(function (g) {
      var l = line(g[0], g[1], 'is-guard');
      if (instant) return;
      l.getBoundingClientRect();
      show(l);
    });
  }
  function playClip(m) {
    setLabel(title(m), '');
    setUp(m);
    el.getBoundingClientRect();
    live.forEach(function (p) { p.classList.add('is-in'); });
    guards(m, false);
    m.plies.forEach(function (p, k) { at(PLY_AT[k], function () { playPly(m, k); }); });
    at(PLY_AT[m.plies.length - 1] + HUD_GAP, function () { playShape(m, false); });
    at(CLIP_MS, fadeOut);
  }

  var seg = 0;
  function next() {
    clearBoard();
    setTick(seg);
    playClip(motifs[seg]);
    at(CLIP_MS + FADE_MS, function () { seg = (seg + 1) % motifs.length; next(); });
  }

  /* Reduced motion: the fork's last frame, still. One motif, not a slower
     reel: a change every few seconds beside the headline is motion too. */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    var m0 = motifs[0];
    setUp(m0);
    m0.plies.forEach(function (p) { move(p, true); });
    live.forEach(function (p) { p.classList.add('is-in'); });
    playShape(m0, true);
    setLabel(title(m0), score(m0, m0.plies.length - 1), true);
    if (tickBox) tickBox.classList.add('is-still');
    return;
  }

  var running = false;
  function start() {
    if (running) return;
    running = true;
    if (cap) cap.classList.remove('is-swap');
    next();
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
