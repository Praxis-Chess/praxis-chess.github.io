/* Dev-only: prove the hero board's chess is real.

     node tools/check-hero.js

   Reads the PATTERN data straight out of js/heroboard.js (strict JSON between
   the PATTERN-JSON markers, so nothing on the site has to run) and checks
   every beat with chess.js:

     - the FEN is a legal position, with the mover to move
     - the knight move is legal and its SAN is exactly what the label shows
     - it gives check, and attacks every forked square, which holds a piece
     - nothing can take back on the fork square
     - every square listed in `show` has a piece on it
     - every beat lands on the pattern's square
     - both caption lines fit a 266px phone board (34 characters)
     - square colours: a1 dark, h1 light

   chess.js is borrowed from the Praxis app's frontend, the way
   tools/capture.js borrows Playwright: the site itself has no dependencies
   and should not gain one for a check. Point CHESSJS at another copy if the
   app lives somewhere else. */
'use strict';
const fs = require('fs');
const path = require('path');

const CHESSJS = process.env.CHESSJS || 'D:/Tanm/Projects/Praxis-Chess/frontend/node_modules/chess.js';
let Chess, validateFen;
try { ({ Chess, validateFen } = require(CHESSJS)); }
catch (e) {
  console.error('chess.js not found at ' + CHESSJS + '\nSet CHESSJS to a chess.js install and run again.');
  process.exit(3);
}

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'heroboard.js'), 'utf8');
const m = src.match(/\/\* PATTERN-JSON \*\/([\s\S]*?)\/\* \/PATTERN-JSON \*\//);
if (!m) { console.error('PATTERN-JSON markers not found in js/heroboard.js'); process.exit(2); }
const P = JSON.parse(m[1]);

const MAX = 34;
const plain = s => s.replace(/[{}]/g, '');
let fails = 0;
const fail = (where, msg) => { fails++; console.log('FAIL  ' + where + ': ' + msg); };

for (const b of P.beats) {
  const where = 'game ' + b.game;
  const v = validateFen(b.fen);
  if (!v.ok) { fail(where, 'illegal FEN: ' + v.error); continue; }
  const c = new Chess(b.fen);
  const mover = c.get(b.from);
  if (!mover) { fail(where, 'no piece on ' + b.from); continue; }
  if (mover.color !== c.turn()) fail(where, b.from + ' piece is not the side to move');
  for (const sq of b.show) if (!c.get(sq)) fail(where, 'show lists ' + sq + ', which is empty');
  const before = {};
  for (const t of P.targets) before[t] = c.get(t);

  let mv = null;
  try { mv = c.move({ from: b.from, to: b.to }); } catch (e) { mv = null; }
  if (!mv) { fail(where, b.from + '-' + b.to + ' is not a legal move'); continue; }
  if (mv.san !== b.san) fail(where, 'SAN is ' + mv.san + ', label says ' + b.san);
  if (!c.inCheck()) fail(where, 'the move does not give check');
  const them = mover.color === 'w' ? 'b' : 'w';
  for (const t of P.targets) {
    if (!before[t]) fail(where, 'forked square ' + t + ' is empty');
    if (!c.attackers(t, mover.color).includes(b.to)) fail(where, 'the knight on ' + b.to + ' does not attack ' + t);
  }
  if (c.attackers(b.to, them).length) fail(where, b.to + ' can be recaptured by ' + c.attackers(b.to, them).join(', '));
  if (b.to !== P.square) fail(where, 'lands on ' + b.to + ', the pattern square is ' + P.square);

  const l1 = plain('Game ' + b.game + ' \u00b7 move ' + b.move + ' \u00b7 \u2026' + b.san);
  if (l1.length > MAX) fail(where, 'caption line 1 is ' + l1.length + ' characters: ' + l1);
  if (!fails) console.log('ok    ' + where + '  ' + b.move + '\u2026' + mv.san + '  (' + b.fen.split(' ')[0] + ')');
}

for (const l of [P.beatNote, P.finding.line1, P.finding.line2]) {
  if (plain(l).length > MAX) fail('caption', plain(l).length + ' characters: ' + plain(l));
}
const c = new Chess();
if (c.squareColor('a1') !== 'dark' || c.squareColor('h1') !== 'light') fail('board', 'square colours are wrong');

console.log(fails ? '\n' + fails + ' problem(s)' : '\nall ' + P.beats.length + ' beats are real chess');
process.exit(fails ? 1 : 0);
