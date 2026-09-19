/* ==========================================================================
   board.js — a chess position, from a FEN string, in DOM.

   WHY NOT A PNG. The analysis card is the single most persuasive thing on
   this site, and shipping it as an image costs 180 KB, goes soft on a
   retina screen, cannot be read by a screen reader, and has to be
   re-exported every time the palette moves. As 64 divs it is two kilobytes,
   sharp at any density, themed from the same tokens as everything else, and
   the markup that produces it is one attribute:

       <div class="board" data-fen="8/8/..." data-from="e5" data-to="d4"></div>

   WHY THE FILLED GLYPHS FOR BOTH COLOURS. Unicode gives two sets: outline
   (U+2654..2659) for white and filled (U+265A..265F) for black. Almost every
   system font draws the outline set as hairlines, and on this ground, at a
   32px square, a hairline king is invisible — not faint, GONE. So both sides
   use the filled set and the colour comes from CSS. The alternative is
   shipping a piece font, which is 40 KB and a licence question for a
   decoration.

   WHAT THIS DELIBERATELY IS NOT: a chess library. It does not know the
   rules, cannot validate a position and will happily render nonsense. It
   reads the piece-placement field of a FEN and stops, because that is the
   entire job — every position on this site is a fixed piece of content that
   was correct when it was written down.
   ========================================================================== */
window.PAGE.register('board', function (scope) {
  'use strict';

  var boards = Array.prototype.slice.call(scope.querySelectorAll('[data-fen]'));
  if (!boards.length || window.OFF.has('board')) return;

  /* Filled set only. See the header. */
  var GLYPH = {
    k: '♚', q: '♛', r: '♜',
    b: '♝', n: '♞', p: '♟'
  };
  var FILES = 'abcdefgh';

  /* Algebraic square to [row, col] in RENDER space, where row 0 is the top
     of the board as drawn. Flipping swaps both axes, not just one: a board
     seen from Black has h1 in the top-left, not a1. */
  function toRC(sq, flip) {
    if (!sq || sq.length < 2) return null;
    var col = FILES.indexOf(sq[0].toLowerCase());
    var rank = parseInt(sq[1], 10);
    if (col < 0 || !rank || rank < 1 || rank > 8) return null;
    var row = 8 - rank;
    return flip ? [7 - row, 7 - col] : [row, col];
  }

  function render(el) {
    var fen = (el.getAttribute('data-fen') || '').trim();
    if (!fen) return;
    var flip = el.getAttribute('data-flip') === 'true';
    var placement = fen.split(/\s+/)[0];
    var ranks = placement.split('/');
    if (ranks.length !== 8) {
      /* A malformed FEN is an authoring mistake, and it should be loud in
         the console and silent on the page: an empty board looks like a
         styling bug and gets chased for an hour. */
      console.warn('[board] FEN has ' + ranks.length + ' ranks, expected 8:', fen);
      return;
    }

    /* Expand to a flat 64-cell array first, then place. Doing the expansion
       and the DOM writing in one pass made the digit-run handling ("4" means
       four empty squares) hard to follow, and it is the only part of this
       file that is genuinely fiddly. */
    var cells = [];
    for (var r = 0; r < 8; r++) {
      var row = ranks[r], out = [];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '1' && ch <= '8') {
          for (var e = 0; e < +ch; e++) out.push(null);
        } else {
          out.push(ch);
        }
      }
      while (out.length < 8) out.push(null);
      cells.push(out.slice(0, 8));
    }
    if (flip) {
      cells.reverse();
      cells.forEach(function (row) { row.reverse(); });
    }

    var from = toRC(el.getAttribute('data-from'), flip);
    var to   = toRC(el.getAttribute('data-to'), flip);
    var coords = el.getAttribute('data-coords') !== 'false';

    var frag = document.createDocumentFragment();
    for (var rr = 0; rr < 8; rr++) {
      for (var cc = 0; cc < 8; cc++) {
        var sq = document.createElement('div');
        sq.className = 'board__sq';
        /* a8 is a light square, and after a flip h1 is in that corner and is
           ALSO light — the parity of the drawn grid is what matters, not the
           parity of the named square, so this stays correct either way. */
        if ((rr + cc) % 2 === 0) sq.className += ' is-light';
        if (from && from[0] === rr && from[1] === cc) sq.className += ' is-from';
        if (to && to[0] === rr && to[1] === cc) sq.className += ' is-to';

        var p = cells[rr][cc];
        if (p) {
          var lower = p.toLowerCase();
          if (GLYPH[lower]) {
            sq.textContent = GLYPH[lower];
            sq.setAttribute('data-c', p === lower ? 'b' : 'w');
          }
        }

        if (coords) {
          /* Coordinates on the two outer edges only, the way a real board
             is printed. Absolutely positioned inside the square so they
             cost no layout and never push a glyph off centre. */
          if (rr === 7) {
            var f = document.createElement('i');
            f.className = 'board__file';
            f.textContent = flip ? FILES[7 - cc] : FILES[cc];
            sq.appendChild(f);
          }
          if (cc === 0) {
            var k = document.createElement('i');
            k.className = 'board__rank';
            k.textContent = flip ? (rr + 1) : (8 - rr);
            sq.appendChild(k);
          }
        }
        frag.appendChild(sq);
      }
    }

    el.textContent = '';
    el.appendChild(frag);

    /* The board is a picture of a position. Without a role and a label a
       screen reader walks 64 empty divs and then reads a row of chess
       glyphs it has no context for. The label comes from the markup,
       because only the author knows which position this is. */
    if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
    if (!el.hasAttribute('aria-label')) {
      el.setAttribute('aria-label',
        el.getAttribute('data-alt') || 'Chess position');
    }
    el.setAttribute('data-rendered', 'true');
  }

  boards.forEach(function (el) {
    try { render(el); }
    catch (err) { console.error('[board] failed on', el, err); }
  });
});
