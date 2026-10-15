/* Dev-only: prove the hero reel's chess is real.

     node tools/check-hero.js

   Reads the REEL data straight out of js/heroboard.js (strict JSON between
   the REEL-JSON markers, so nothing on the site has to run) and checks every
   motif with chess.js:

     - the FEN is a legal position; Black moves first (the mistake), White
       answers (the tactic), and the roles say so
     - every move is legal from/to, its SAN is exactly what the caption shows,
       and none is castling, promotion or en passant, which the board's
       player does not draw
     - every focus square, every line, wire, node and cross names a square,
       and focus squares hold a piece
     - the motif's own property, by `proof.kind`:
         fork            after the tactic, the piece on `at` attacks every
                         target, each holds an enemy piece, and nothing can
                         take it
         pin             after the tactic, the pinned piece has no legal move
                         and the attacker hits it
         skewer          the tactic checks, every reply is a king move, and
                         after each one the back piece is attacked
         discovered      the tactic checks from `line`, not from the piece
                         that moved, and that piece attacks `target`
         hanging         the piece is guarded by `guard` at the start; after
                         the mistake nothing guards it and it is attacked;
                         the tactic takes it
         trap            after the tactic, the piece has moves and every one
                         lands on an attacked square
         mate            the last move mates
         removeDefender  the defender guards the square until it is taken,
                         and the last move mates there
     - THE TACTIC ACTUALLY WORKS, the move shown and not just some move:
       from the position after it, over every defence, either an exact
       forced-mate search (`proof.mateIn`, more White moves after the
       tactic) or a material-only alpha-beta search (`proof.depth` plies,
       default 3) that wins at least two points, a pawn's worth more than an
       even trade. Not an engine, and it does not need to be: these are
       short, forcing lines. Runs in about a second.
     - both caption lines fit a 266px phone board (34 characters)

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
const m = src.match(/\/\* REEL-JSON \*\/([\s\S]*?)\/\* \/REEL-JSON \*\//);
if (!m) { console.error('REEL-JSON markers not found in js/heroboard.js'); process.exit(2); }
const REEL = JSON.parse(m[1]);

const MAX = 34;
const SQ = /^[a-h][1-8]$/;
const ROLES = ['mistake', 'tactic', 'reply', 'payoff'];
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
let fails = 0;
const fail = (where, msg) => { fails++; console.log('FAIL  ' + where + ': ' + msg); };

/* The caption's second line, built exactly as heroboard.js builds it. */
function moveText(mo, k) {
  const parts = mo.fen.split(' '), black = parts[1] === 'b', n = Number(parts[5]);
  const white = black ? k % 2 === 1 : k % 2 === 0;
  const num = n + (black ? Math.floor((k + 1) / 2) : Math.floor(k / 2));
  const p = mo.plies[k];
  const pre = white ? num + '.' : (k === 0 ? num + '\u2026' : '');
  const suf = p.role === 'mistake' ? '?' : (p.role === 'tactic' && !/#$/.test(p.san) ? '!' : '');
  return pre + p.san + suf;
}

function material(c, side) {
  let s = 0;
  for (const row of c.board()) for (const x of row) if (x) s += (x.color === side ? 1 : -1) * V[x.type];
  return s;
}
/* Minimax with alpha-beta, scored for `side`; mate is +-1000. */
function search(c, depth, alpha, beta, side) {
  const mine = c.turn() === side;
  if (c.isCheckmate()) return mine ? -1000 : 1000;
  if (c.isDraw()) return 0;
  if (depth === 0) return material(c, side);
  const moves = c.moves({ verbose: true })
    .sort((a, b) => (b.captured ? V[b.captured] : 0) - (a.captured ? V[a.captured] : 0));
  let best = mine ? -Infinity : Infinity;
  for (const mv of moves) {
    c.move(mv);
    const v = search(c, depth - 1, alpha, beta, side);
    c.undo();
    if (mine) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

/* Forced mate, exactly: `mated` is true if the side to move is mated now or
   whatever it does, White mates within n more moves; `mates` is true if
   White, to move, has a move that does that. Checks are tried first, so the
   mating line is usually the first one looked at. */
const checksFirst = (a, b) => (/[+#]/.test(b.san) ? 1 : 0) - (/[+#]/.test(a.san) ? 1 : 0);
function mated(c, n) {
  if (c.isCheckmate()) return true;
  if (n === 0 || c.isDraw()) return false;
  return c.moves({ verbose: true }).every(r => { c.move(r); const ok = mates(c, n); c.undo(); return ok; });
}
function mates(c, n) {
  for (const mv of c.moves({ verbose: true }).sort(checksFirst)) {
    c.move(mv);
    const ok = mated(c, n - 1);
    c.undo();
    if (ok) return true;
  }
  return false;
}

const PROVE = {
  fork(pr, after) {
    const c = after[1], me = c.get(pr.at);
    if (!me) return 'no piece on ' + pr.at;
    const them = me.color === 'w' ? 'b' : 'w';
    for (const t of pr.targets) {
      const v = c.get(t);
      if (!v || v.color !== them) return 'fork target ' + t + ' holds no enemy piece';
      if (!c.attackers(t, me.color).includes(pr.at)) return pr.at + ' does not attack ' + t;
    }
    if (c.attackers(pr.at, them).length) return pr.at + ' can be taken by ' + c.attackers(pr.at, them).join(', ');
    return null;
  },
  pin(pr, after) {
    const c = after[1], n = c.moves({ square: pr.pinned }).length;
    if (n) return 'the pinned piece on ' + pr.pinned + ' still has ' + n + ' legal moves';
    if (!c.attackers(pr.pinned, c.turn() === 'w' ? 'b' : 'w').includes(pr.attacker)) return pr.attacker + ' does not attack ' + pr.pinned;
    return null;
  },
  skewer(pr, after) {
    const c = after[1];
    if (!c.inCheck()) return 'the tactic does not give check';
    const replies = c.moves({ verbose: true });
    if (!replies.every(r => r.from === pr.front)) return 'a reply other than the front piece moving exists';
    const me = c.turn() === 'w' ? 'b' : 'w';
    for (const r of replies) {
      c.move(r);
      const hit = c.attackers(pr.back, me).length > 0;
      c.undo();
      if (!hit) return 'after ' + r.san + ' the piece on ' + pr.back + ' is not attacked';
    }
    return null;
  },
  discovered(pr, after) {
    const c = after[1];
    if (!c.inCheck()) return 'the tactic does not give check';
    const king = c.findPiece({ type: 'k', color: c.turn() })[0];
    const me = c.turn() === 'w' ? 'b' : 'w';
    const checkers = c.attackers(king, me);
    if (!checkers.includes(pr.line)) return 'the check does not come from ' + pr.line;
    if (checkers.includes(pr.mover)) return 'the moved piece gives check itself: not a discovery';
    if (!c.attackers(pr.target, me).includes(pr.mover)) return pr.mover + ' does not attack ' + pr.target;
    return null;
  },
  hanging(pr, after, start) {
    const side = start.get(pr.piece) && start.get(pr.piece).color;
    if (!side) return 'no piece on ' + pr.piece;
    const them = side === 'w' ? 'b' : 'w';
    if (!start.attackers(pr.piece, side).includes(pr.guard)) return pr.guard + ' does not guard ' + pr.piece + ' at the start';
    if (after[0].attackers(pr.piece, side).length) return 'after the mistake ' + pr.piece + ' is still guarded by ' + after[0].attackers(pr.piece, side).join(', ');
    if (!after[0].attackers(pr.piece, them).length) return 'after the mistake nothing attacks ' + pr.piece;
    const taker = after[1].get(pr.piece);
    if (!taker || taker.color !== them) return 'the tactic does not take the piece on ' + pr.piece;
    return null;
  },
  trap(pr, after) {
    const c = after[1];
    const moves = c.moves({ square: pr.piece, verbose: true });
    if (!moves.length) return 'the trapped piece has no moves at all (that is a pin, or it is stuck)';
    const me = c.turn() === 'w' ? 'b' : 'w';
    for (const mv of moves) {
      c.move(mv);
      const hit = c.attackers(mv.to, me).length > 0;
      c.undo();
      if (!hit) return 'the piece escapes with ' + mv.san;
    }
    return null;
  },
  mate(pr, after) {
    return after[after.length - 1].isCheckmate() ? null : 'the last move is not mate';
  },
  removeDefender(pr, after) {
    const side = after[0].turn() === 'w' ? 'b' : 'w';   // the defender's side
    if (!after[0].attackers(pr.guards, side).includes(pr.defender)) return pr.defender + ' does not guard ' + pr.guards;
    const last = after[after.length - 1];
    if (!last.isCheckmate()) return 'the last move is not mate';
    return null;
  }
};

for (const mo of REEL.motifs) {
  const where = mo.id;
  const v = validateFen(mo.fen);
  if (!v.ok) { fail(where, 'illegal FEN: ' + v.error); continue; }
  const c = new Chess(mo.fen);
  if (c.turn() !== 'b') fail(where, 'Black should move first: the mistake is Black\'s');

  const squares = [].concat(mo.focus, ...(mo.guards || []), ...mo.shape.wires, mo.shape.lock,
    mo.shape.nodes || [], mo.shape.cross || [], ...mo.plies.flatMap(p => p.lines || []));
  for (const s of squares) if (!SQ.test(s)) fail(where, '"' + s + '" is not a square');
  for (const s of mo.focus) if (!c.get(s)) fail(where, 'focus lists ' + s + ', which is empty');
  for (const g of mo.guards || []) {
    if (!c.get(g[0])) fail(where, 'guard starts on ' + g[0] + ', which is empty');
  }
  if (mo.guards && !mo.plies.some(p => p.cut)) fail(where, 'guards are drawn but no move cuts them');
  if (mo.plies.length < 2 || mo.plies.length > 4) fail(where, mo.plies.length + ' moves: a clip has 2 to 4');

  const after = [];
  let ok = true;
  mo.plies.forEach((p, k) => {
    if (!ok) return;
    if (ROLES.indexOf(p.role) < 0) fail(where, 'unknown role ' + p.role);
    if (k === 0 && p.role !== 'mistake') fail(where, 'the first move should be the mistake');
    if (k === 1 && p.role !== 'tactic') fail(where, 'the second move should be the tactic');
    let mv = null;
    try { mv = c.move({ from: p.from, to: p.to }); } catch (e) { mv = null; }
    if (!mv) { fail(where, 'move ' + (k + 1) + ', ' + p.from + '-' + p.to + ', is not legal'); ok = false; return; }
    if (mv.san !== p.san) fail(where, 'move ' + (k + 1) + ' is ' + mv.san + ' in SAN, the data says ' + p.san);
    if (/[kqpe]/.test(mv.flags)) fail(where, mv.san + ' is castling, promotion or en passant, which the board does not draw');
    after.push(new Chess(c.fen()));
  });
  if (!ok) continue;

  const kind = mo.proof && mo.proof.kind;
  if (!PROVE[kind]) { fail(where, 'unknown proof kind ' + kind); continue; }
  const why = PROVE[kind](mo.proof, after, new Chess(mo.fen));
  if (why) fail(where, why);

  /* From the moment the SHOWN tactic has been played, over every defence:
     a forced mate within `mateIn` more White moves, or else at least two
     points of material within `depth` more plies (default 3: reply, the
     capture, and the recapture if there is one). */
  const before = material(after[0], 'w');
  const t = new Chess(after[1].fen());
  let gain;
  if (typeof mo.proof.mateIn === 'number') {
    gain = 'mate in ' + (mo.proof.mateIn + 1);
    if (!mated(t, mo.proof.mateIn)) fail(where, 'no forced mate within ' + (mo.proof.mateIn + 1) + ' White moves');
  } else {
    const depth = mo.proof.depth || 3;
    const best = search(t, depth, -Infinity, Infinity, 'w');
    gain = best >= 900 ? 'mate' : (best - before >= 0 ? '+' : '') + (best - before) + ' within ' + depth + ' plies';
    if (!(best >= 900 || best - before >= 2)) fail(where, 'the tactic does not win: best for White is ' + gain);
  }

  const l1 = mo.name + ' \u00b7 ' + mo.idea;
  const l2 = mo.plies.map((p, k) => moveText(mo, k)).join(' ');
  for (const l of [l1, l2]) if (l.length > MAX) fail(where, 'caption is ' + l.length + ' characters: ' + l);

  console.log((why ? 'FAIL  ' : 'ok    ') + where.padEnd(16) + l2.padEnd(30) + ' ' + kind + ', ' + gain);
}

const ids = REEL.motifs.map(x => x.id);
if (new Set(ids).size !== ids.length) fail('reel', 'two motifs share an id');
const c = new Chess();
if (c.squareColor('a1') !== 'dark' || c.squareColor('h1') !== 'light') fail('board', 'square colours are wrong');

console.log(fails ? '\n' + fails + ' problem(s)' : '\nall ' + REEL.motifs.length + ' motifs are real chess, and every tactic works');
process.exit(fails ? 1 : 0);
