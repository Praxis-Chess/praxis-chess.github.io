/* Dev-only: prove the page's demo game is real chess, and that the page
   shows it correctly.

     node tools/check-demo.js

   Scenes 02 (the gap), 03 (standard engine analysis) and 04 (how it works)
   all quote one game: tools/demo-game.json. The reader is Black. Its numbers
   are Stockfish's (see the file's `engine` and `depth`), Black's point of
   view, in pawns. This replays it with chess.js and checks:

     THE GAME
     - every move is legal, from the start position, and the result follows
     - each Black move recorded in `black` is that move of the game
     - each grade is Praxis's own rule (MistakeCandidateFilter): a win% drop
       of 5 / 10 / 20 is an inaccuracy / mistake / blunder, with
       win% = 100 / (1 + e^(-0.00368208 * cp)); and the stored drop agrees
       with the shown evals to within rounding
     - the gap's example: Black RECAPTURES on the square White just took on,
       White's reply attacks two or more of Black's pieces worth 3 or more
       (or the king), Black goes on to lose the piece named, and the clock is
       under the thirty seconds the payoff sentence names

     THE PAGE (index.html)
     - the feed in scene 04: every row is that Black move with its real eval;
       the rows that stay (.keeps) are exactly the flagged moves, each
       labelled with its grade; the last row is the result
     - the engine list in scene 03: exactly the flagged moves, with their
       evals, red for a mistake or blunder
     - the gap: game number, time control, move number, the move, the eval
       before and after, the grade, the clock, the piece lost, and the
       game's row in the grid (what it cost: after minus before)

   chess.js is borrowed from the Praxis app's frontend, as in
   tools/check-hero.js. Point CHESSJS at another copy if the app lives
   somewhere else. */
'use strict';
const fs = require('fs');
const path = require('path');

const CHESSJS = process.env.CHESSJS || 'D:/Tanm/Projects/Praxis-Chess/frontend/node_modules/chess.js';
let Chess;
try { ({ Chess } = require(CHESSJS)); }
catch (e) {
  console.error('chess.js not found at ' + CHESSJS + '\nSet CHESSJS to a chess.js install and run again.');
  process.exit(3);
}

const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-game.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let fails = 0;
const fail = (where, msg) => { fails++; console.log('FAIL  ' + where + ': ' + msg); };
const ok = (where, msg) => console.log('ok    ' + where + '  ' + msg);

const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
const wp = cp => 100 / (1 + Math.exp(-0.00368208 * cp));
/* Black's eval in pawns -> the drop in Black's winning chances. */
const drop = (before, after) => wp(-after * 100) - wp(-before * 100);
const grade = d => d >= 20 ? 'BLUNDER' : d >= 10 ? 'MISTAKE' : d >= 5 ? 'INACCURACY' : null;
/* As the page prints it: a real minus sign, a plus on gains, 0.0 for level. */
const ev = x => Math.abs(x) < 0.05 ? '0.0' : (x > 0 ? '+' : '\u2212') + Math.abs(x).toFixed(1);

/* ---- the game ------------------------------------------------------------ */
const c = new Chess();
const moves = [];             // verbose moves, in order
for (const [i, san] of D.san.entries()) {
  let m = null;
  try { m = c.move(san); } catch (e) { m = null; }
  if (!m) { fail('game', 'ply ' + (i + 1) + ', ' + san + ', is not legal'); break; }
  if (m.san !== san) fail('game', 'ply ' + (i + 1) + ' is ' + m.san + ' in SAN, the file says ' + san);
  moves.push(m);
}
/* Everything below reads positions from this game: stop at an illegal one. */
if (moves.length !== D.san.length) { console.log('\n' + fails + ' problem(s)'); process.exit(1); }
ok('game', D.san.length + ' plies, all legal; ' + D.timeControl + ', ' + D.result + ' (' + D.termination + ')');
if (D.player !== 'black') fail('game', 'the checks below assume the reader is Black');
if (D.result === '1-0' && c.turn() !== 'w' && !/resign/i.test(D.termination)) fail('game', 'the result does not follow');

const blackPly = n => 2 * n - 1;                 // index into moves of Black's move n
const byMove = {};
for (const b of D.black) {
  byMove[b.move] = b;
  const m = moves[blackPly(b.move)];
  if (!m || m.color !== 'b' || m.san !== b.san) { fail('game', b.move + '\u2026' + b.san + ' is not Black\'s move ' + b.move); continue; }
  if (grade(b.drop) !== b.severity) fail('grade', b.move + '\u2026' + b.san + ' dropped ' + b.drop + ' win%, which is ' + grade(b.drop) + ', not ' + b.severity);
  const shown = drop(b.evalBefore, b.eval);
  if (Math.abs(shown - b.drop) > 1.0) fail('grade', b.move + '\u2026' + b.san + ': the evals give a ' + shown.toFixed(1) + ' drop, the file says ' + b.drop);
}
const flagged = D.black.filter(b => b.severity);
ok('grades', flagged.map(b => b.move + '\u2026' + b.san + ' ' + b.severity.toLowerCase()).join(', '));

/* ---- the gap's example ------------------------------------------------------ */
const X = D.example, xb = byMove[X.move];
{
  const i = blackPly(X.move), m = moves[i], prev = moves[i - 1], reply = moves[i + 1];
  if (!prev.captured || m.to !== prev.to || !m.captured) fail('example', m.san + ' is not a recapture on ' + prev.to);
  /* The position after White's reply: what does the reply's piece attack? */
  const t = new Chess();
  for (let k = 0; k <= i + 1; k++) t.move(moves[k].san);
  /* chess.js has no "squares this piece attacks", so walk Black's pieces. */
  const targets = [];
  for (const row of t.board()) for (const sq of row) {
    if (!sq || sq.color !== 'b' || (sq.type !== 'k' && V[sq.type] < 3)) continue;
    if (t.attackers(sq.square, 'w').includes(reply.to)) targets.push(sq.type.toUpperCase() + sq.square);
  }
  if (targets.length < 2) fail('example', reply.san + ' attacks ' + (targets.join(', ') || 'nothing') + ': not a fork');
  /* The piece named is gone by the end and was there after the recapture. */
  const count = (board, type) => board.board().flat().filter(s => s && s.color === 'b' && s.type === type).length;
  const lost = Object.keys(NAMES).find(k => NAMES[k] === X.materialLost);
  const after = new Chess(); for (let k = 0; k <= i; k++) after.move(moves[k].san);
  if (!lost || count(c, lost) >= count(after, lost)) fail('example', 'Black does not go on to lose a ' + X.materialLost);
  if (!(X.clockSeconds > 0 && X.clockSeconds < 30)) fail('example', X.clockSeconds + 's is not under thirty seconds');
  if (xb.evalBefore !== D.black.find(b => b.move === X.move).evalBefore || X.evalBefore !== xb.evalBefore) fail('example', 'evalBefore disagrees with the move record');
  if (!fails) ok('example', X.move + '\u2026' + m.san + ' recaptures on ' + m.to + '; ' + reply.san + ' forks ' + targets.join(' and ') + '; ' + X.materialLost + ' lost; ' + X.clockSeconds + 's left');
}

/* ---- the page ---------------------------------------------------------------- */
const between = (start, end) => {
  const i = html.indexOf(start);
  if (i < 0) { fail('page', 'cannot find ' + start); return ''; }
  return html.slice(i, html.indexOf(end, i));
};
const ROW = /<p class="mvf([^"]*)"[^>]*><i>([^<]*)<\/i><b>([^<]*)<\/b><(i|s)( class="[^"]*")?>([^<]*)<\/(?:i|s)><\/p>/g;
const rowsOf = block => [...block.matchAll(ROW)].map(r => ({ cls: r[1], num: r[2], san: r[3], tag: r[4], vcls: r[5] || '', val: r[6] }));
const moveNo = num => { const m = /^(\d+)\u2026$/.exec(num); return m ? Number(m[1]) : null; };

/* scene 04, the feed */
{
  const rows = rowsOf(between('<div class="pipe__rows">', '</div>'));
  const kept = [];
  rows.forEach((r, k) => {
    if (r.san === 'Resigned') {
      if (k !== rows.length - 1) fail('feed', 'the result is not the last row');
      if (r.num !== D.result.replace('-', '\u2013')) fail('feed', 'the result row says ' + r.num + ', the game is ' + D.result);
      return;
    }
    const n = moveNo(r.num), b = byMove[n];
    if (!b || b.san !== r.san) { fail('feed', r.num + r.san + ' is not Black\'s move ' + n); return; }
    if (/keeps/.test(r.cls)) {
      kept.push(n);
      if (r.val !== (b.severity || '').toLowerCase()) fail('feed', n + '\u2026' + r.san + ' stays labelled "' + r.val + '" but it is ' + (b.severity || 'not flagged'));
      if ((b.severity === 'INACCURACY') !== /mild/.test(r.vcls)) fail('feed', n + '\u2026' + r.san + ': only inaccuracies are grey');
    } else if (r.val !== ev(b.eval)) fail('feed', n + '\u2026' + r.san + ' shows ' + r.val + ', Stockfish says ' + ev(b.eval));
  });
  const want = flagged.map(b => b.move).join(',');
  if (kept.join(',') !== want) fail('feed', 'rows that stay are ' + kept.join(',') + ', the flagged moves are ' + want);
  if (!fails) ok('feed', rows.length + ' rows; stays: ' + kept.map(n => n + '\u2026' + byMove[n].san).join(' '));
}

/* scene 03, standard engine analysis */
{
  const rows = rowsOf(between('<div class="diff__list">', '</div>'));
  const shown = rows.map(r => moveNo(r.num));
  if (shown.join(',') !== flagged.map(b => b.move).join(',')) fail('engine list', 'shows moves ' + shown.join(',') + ', the flagged moves are ' + flagged.map(b => b.move).join(','));
  for (const r of rows) {
    const b = byMove[moveNo(r.num)];
    if (!b || b.san !== r.san) { fail('engine list', r.num + r.san + ' is not in the game'); continue; }
    if (r.val !== ev(b.eval)) fail('engine list', r.num + r.san + ' shows ' + r.val + ', Stockfish says ' + ev(b.eval));
    if ((r.tag === 's') !== (b.severity === 'MISTAKE' || b.severity === 'BLUNDER')) fail('engine list', r.num + r.san + ': red is for mistakes and blunders only');
  }
  ok('engine list', rows.map(r => r.num + r.san + ' ' + r.val).join(', '));
}

/* scene 02, the gap */
{
  const label = 'game ' + D.game + ' <span class="dim2">//</span> rapid ' + D.timeControl + ' <span class="dim2">//</span> move ' + X.move + '</p>';
  if (!html.includes(label)) fail('gap', 'the label does not read game ' + D.game + ', rapid ' + D.timeControl + ', move ' + X.move);
  const clock = Math.floor(X.clockSeconds / 60) + ':' + String(X.clockSeconds % 60).padStart(2, '0') + ' left';
  const line = '<b>' + X.move + '\u2026' + xb.san + '</b><i>eval</i><b>' + ev(X.evalBefore) + ' \u2192 ' + ev(xb.eval) + '</b><s>' + xb.severity.toLowerCase() + '</s><i>' + clock + '</i>';
  if (!html.includes(line)) fail('gap', 'the readout should be ' + line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  if (!html.includes('You just lost a ' + X.materialLost + '.')) fail('gap', 'the headline should say "You just lost a ' + X.materialLost + '."');
  const grid = '<i>g' + D.game + '</i><b>' + xb.san + '</b><s>' + ev(xb.eval - X.evalBefore) + '</s>';
  if (!html.includes(grid)) fail('gap', 'the grid row for game ' + D.game + ' should read ' + xb.san + ' ' + ev(xb.eval - X.evalBefore));
  if (!/under <span class="pink">thirty seconds<\/span>/.test(html)) fail('gap', 'the payoff no longer names thirty seconds; check the example still fits it');
  ok('gap', 'game ' + D.game + ', move ' + X.move + ', ' + xb.san + ' ' + ev(X.evalBefore) + ' \u2192 ' + ev(xb.eval) + ', ' + clock);
}

console.log(fails ? '\n' + fails + ' problem(s)' : '\nthe demo game is legal, its grades are Praxis\'s own, and the page shows it as it is');
process.exit(fails ? 1 : 0);
