/* A stand-in for the Praxis backend on :8086, for marketing captures only.
 *
 * WHY THIS EXISTS. The screenshots on the website came out full of zeros: the
 * real database has 105 analysed games but an untouched drill deck, so Today,
 * Progress and half of Insights render 0 / 0 / 0 / 0%. Those screens are real,
 * they just have nothing in them yet, and a screenshot of an unused feature
 * argues against the sentence it sits under.
 *
 * WHAT IT DOES NOT DO. It does not touch the real Postgres database, and it
 * does not change one line of the application. The REAL frontend runs against
 * it unmodified, real components, real CSS, real charts, real board rendering
 *, so the captures are photographs of the actual product, with a demo library
 * behind it instead of a half-used personal one.
 *
 * Nothing here ships. It lives in a scratch directory and is run by hand.
 *
 * node fixture-api.js        # serves :8086
 */
'use strict';
const http = require('http');
const { parse } = require('url');

/* ---------------------------------------------------------------- helpers */

/* A seeded PRNG, so every re-run produces the identical library. Captures
   that shift between runs cannot be compared, and a chart that reshuffles
   every time you re-take it is impossible to review. */
let _s = 20260920;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const between = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
const r1 = n => Math.round(n * 10) / 10;

const DAY = 86400000;
const NOW = new Date('2026-09-20T19:40:00+05:30').getTime();
const iso = t => new Date(t).toISOString();
const ymd = t => new Date(t).toISOString().slice(0, 10);

/* ------------------------------------------------------------ the persona

   One player, held consistent across every endpoint, because the screens
   cross-reference each other: Insights says how many games were analysed and
   so does the sync banner, and a visitor who notices them disagreeing has
   found a reason to distrust the whole page.

   1486 rapid, improving slowly, loses on time, misses forks.            */

const GAMES_TOTAL = 412;
const GAMES_ANALYSED = 389;
const NEW_ON_CHESSCOM = 6;
const RATING = 1486;

const OPENINGS = [
  ['B12', 'Caro-Kann Defense: Advance Variation'],
  ['C50', 'Italian Game: Giuoco Pianissimo'],
  ['D02', 'Queen\'s Pawn Game: London System'],
  ['B22', 'Sicilian Defense: Alapin Variation'],
  ['C00', 'French Defense: Advance Variation'],
  ['A45', 'Indian Defense: Trompowsky Attack'],
  ['C41', 'Philidor Defense: Exchange Variation'],
  ['B01', 'Scandinavian Defense: Mieses-Kotroc'],
];

/* ------------------------------------------------------------------ games */

const games = [];
for (let i = 0; i < 60; i++) {
  const [eco, name] = OPENINGS[i % OPENINGS.length];
  const res = rnd() < 0.46 ? 'win' : rnd() < 0.82 ? 'loss' : 'draw';
  games.push({
    id: 'g' + String(1000 + i),
    chess_com_id: String(98230000 + i * 137),
    played_at: iso(NOW - (i * 1.6 + rnd()) * DAY),
    time_class: pick(['blitz', 'rapid', 'rapid', 'blitz']),
    time_control: pick(['600', '300', '900+10', '600']),
    player_color: i % 2 ? 'white' : 'black',
    result: res,
    opening_eco: eco,
    opening_name: name,
    analysis_status: 'ANALYZED',
    player_rating: RATING - Math.round(between(-40, 40)) - Math.round(i * 0.4),
    accuracy: r1(between(63, 91)),
    mistake_count: Math.round(between(2, 11)),
  });
}

/* The game the website's biggest capture is built around. A loss with real
   mistakes in it: an easy win makes a screenshot that proves nothing. */
const HERO_GAME = {
  id: 'g1000',
  chess_com_id: '98230000',
  played_at: iso(NOW - 0.4 * DAY),
  time_class: 'rapid',
  time_control: '600',
  player_color: 'white',
  result: 'loss',
  opening_eco: 'B12',
  opening_name: 'Caro-Kann Defense: Advance Variation',
  analysis_status: 'ANALYZED',
  player_rating: 1486,
  accuracy: 74.7,
  mistake_count: 9,
};
games[0] = HERO_GAME;

/* --------------------------------------------------------- the move errors

   Nine real-shaped mistakes with positions, engine replies, severities and
   written explanations, the screen the marketing page leans on hardest, so
   every row has to carry actual content rather than a placeholder. */

/* move_number is a PLY. The card prints ceil(n / 2), so these land on full
   moves 4, 9, 14, 17, 23, 26, 31, 34, 38 -- an opening slip, five middlegame
   errors with three of them inside the 21-30 band the pattern report calls
   critical, and three in the ending. The phase badges have to agree with the
   move numbers beside them or the screen argues with itself. */
const MOVE_ERRORS = [
  { n: 7,  played: 'Bg5',  best: 'c2c3', fen: 'r1bqkb1r/pp3ppp/2n1pn2/2ppP1B1/3P4/2P2N2/PP3PPP/RN1QKB1R w KQkq - 0 7',
    sev: 'INACCURACY', motif: 'POSITIONAL', phase: 'OPENING', clock: 412,
    why: 'The pin is loose here: after h6 the bishop has no good square and Black gains a tempo to finish development. c3 first holds the centre and keeps the option.' },
  { n: 17, played: 'Nxd5', best: 'f3e5', fen: 'r2q1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 11',
    sev: 'MISTAKE', motif: 'HANGING_PIECE', phase: 'MIDDLEGAME', clock: 288,
    why: 'The recapture loses a piece to the knight fork on e5, which hits the bishop and the queen at once. Ne5 first keeps the material level.' },
  { n: 27, played: 'Qc2',  best: 'd1e2', fen: 'r2q1rk1/pp1bbppp/2n1pn2/8/3P4/2NBPN2/PPQ2PPP/R1B2RK1 b - - 2 15',
    sev: 'INACCURACY', motif: 'POSITIONAL', phase: 'MIDDLEGAME', clock: 231,
    why: 'The queen blocks its own bishop on the c-file and invites Nb4. Qe2 keeps the same idea without walking into the tempo.' },
  { n: 33, played: 'Rxe6', best: 'd3c4', fen: 'r2q1rk1/pp1b1ppp/2n1R3/8/3P4/2NBP3/PPQ2PPP/R1B3K1 b - - 0 19',
    sev: 'BLUNDER', motif: 'DISCOVERED_ATTACK', phase: 'MIDDLEGAME', clock: 74,
    why: 'The exchange sacrifice does not work with the bishop still on d3: after fxe6 the discovered attack on the rook wins back more than it cost. Bc4 first is the same idea a move later, and sound.' },
  { n: 45, played: 'Nd4',  best: 'c3e4', fen: 'r2q1rk1/pp1b1ppp/8/8/3N4/3BP3/PPQ2PPP/R1B3K1 w - - 1 23',
    sev: 'BLUNDER', motif: 'FORK', phase: 'MIDDLEGAME', clock: 46,
    why: 'Nd4 walks into Qxd4 because the knight is the only defender of c2. Ne4 holds both squares and keeps the attack alive.' },
  { n: 51, played: 'Qd3',  best: 'c2b3', fen: 'r2q2k1/pp3ppp/8/8/3N4/3QP3/PP3PPP/R1B3K1 b - - 3 26',
    sev: 'MISTAKE', motif: 'PIN', phase: 'MIDDLEGAME', clock: 31,
    why: 'On d3 the queen is pinned against the rook the moment the bishop comes to f5. Qb3 keeps the diagonal and the same pressure.' },
  { n: 61, played: 'Kg1',  best: 'g1h1', fen: '6k1/pp3ppp/8/8/8/4P3/PP3PPP/R5K1 w - - 0 31',
    sev: 'INACCURACY', motif: 'BACK_RANK', phase: 'ENDGAME', clock: 24,
    why: 'The king wants h1, not g1: on g1 the back rank is still the rook\'s problem and Re1 forces the trade you were avoiding.' },
  { n: 67, played: 'Ra7',  best: 'a1d1', fen: '6k1/Rp3ppp/8/8/8/4P3/PP3PPP/6K1 b - - 2 34',
    sev: 'MISTAKE', motif: 'POSITIONAL', phase: 'ENDGAME', clock: 17,
    why: 'The rook belongs behind the passed pawn, not in front of it. Rd1 is the move that actually wins the ending.' },
  { n: 75, played: 'f4',   best: 'g2g4', fen: '6k1/1p3ppp/8/8/5P2/4P3/PP4PP/6K1 b - - 0 38',
    sev: 'BLUNDER', motif: 'POSITIONAL', phase: 'ENDGAME', clock: 9,
    why: 'f4 fixes your own pawns on the colour of the enemy bishop and gives up e4 forever. g4 keeps the majority mobile.' },
];

const moveErrors = MOVE_ERRORS.map((m, i) => ({
  id: 'me' + i,
  move_number: m.n,
  move_played: m.played,
  better_move: m.best,
  fen_position: m.fen,
  severity: m.sev,
  tactical_motif: m.motif,
  explanation: m.why,
  game_phase: m.phase,
  clock_remaining: m.clock,
  analysis_state: 'EXPLAINED',
}));

/* ------------------------------------------------------------- drill cards */

const DRILLS = [
  { fen: 'r2q1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 11', best: 'f3e5', played: 'Nxd5',
    sev: 'MISTAKE', motif: 'HANGING_PIECE', phase: 'MIDDLEGAME', color: 'white',
    why: 'The recapture loses a piece to the knight fork on e5. Ne5 first keeps material level and the initiative.' },
  { fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 6 8', best: 'c1g5', played: 'a3',
    sev: 'INACCURACY', motif: 'POSITIONAL', phase: 'OPENING', color: 'white',
    why: 'a3 is a move the position does not need yet. Bg5 develops with a threat and takes the pin first.' },
  { fen: 'r2q2k1/pp3ppp/8/8/3N4/3QP3/PP3PPP/R1B3K1 w - - 3 26', best: 'd3b3', played: 'Qd3',
    sev: 'BLUNDER', motif: 'PIN', phase: 'MIDDLEGAME', color: 'white',
    why: 'On d3 the queen is pinned against the rook the moment the bishop reaches f5.' },
];

const drills = DRILLS.map((d, i) => ({
  id: 'dr' + i, fen: d.fen, best_move: d.best, move_played: d.played,
  severity: d.sev, tactical_motif: d.motif, game_phase: d.phase,
  explanation: d.why, player_color: d.color, game_id: games[i + 1].id,
}));

/* ---------------------------------------------------------------- progress

   Thirty days of review history. Deliberately uneven, two missed days and a
   weak Tuesday, because a perfectly full deck with a smooth accuracy curve
   reads as a mockup at a glance, and this is meant to read as a real log. */

const SKIPPED = new Set([25, 24, 17, 9, 3]);
const history = [];
for (let k = 29; k >= 0; k--) {
  if (SKIPPED.has(k)) continue;
  const reviewed = Math.round(between(9, 34));
  // The last week is the one the page averages into "7-day recall", and a
  // deck being worked properly trends up. Older weeks stay noisy.
  const acc = Math.round(k <= 7 ? between(78, 93) : between(58, 92));
  const correct = Math.round(reviewed * acc / 100);
  const oc = Math.round(between(3, 9)), ot = oc + Math.round(between(0, 3));
  const mc = Math.round(between(5, 14)), mt = mc + Math.round(between(1, 5));
  const ec = Math.round(between(2, 6)), et = ec + Math.round(between(0, 3));
  history.push({
    date: ymd(NOW - k * DAY),
    reviewed, correct, again: reviewed - correct, accuracy: acc,
    avg_interval_days: r1(between(1.4, 12.5)),
    phases: {
      opening_correct: oc, opening_total: ot,
      middlegame_correct: mc, middlegame_total: mt,
      endgame_correct: ec, endgame_total: et,
    },
  });
}

const deck_summary = {
  total_cards: 246, new_cards: 34, learning_cards: 22,
  review_cards: 178, suspended_cards: 12,
};

/* Five months of practice days, so the Progress page's month rows have an
   actual arc in them rather than one lonely row. */
const practice_days = [];
for (let k = 150; k >= 0; k--) {
  const d = new Date(NOW - k * DAY);
  const dow = d.getDay();
  // Weekends heavier, a real two-week gap in July, and never every single day.
  const gap = k > 58 && k < 72;
  // The current run is deliberate, not luck: an unbroken recent streak is the
  // claim this screen makes, and leaving it to a coin-flip produced two days.
  const p = k <= 10 ? 1 : gap ? 0.05 : (dow === 0 || dow === 6) ? 0.88 : 0.66;
  if (rnd() < p) practice_days.push(ymd(NOW - k * DAY));
}
if (!practice_days.includes(ymd(NOW))) practice_days.push(ymd(NOW));

function currentStreak() {
  const set = new Set(practice_days);
  let n = 0;
  for (let k = 0; k < 400; k++) { if (!set.has(ymd(NOW - k * DAY))) break; n++; }
  return n;
}
function longestStreak() {
  const s = [...practice_days].sort();
  let best = 0, run = 0, prev = null;
  for (const d of s) {
    const t = new Date(d + 'T00:00:00Z').getTime();
    run = prev !== null && t - prev === DAY ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return best;
}

/* ---------------------------------------------------------------- insights */

const accuracy_trend = (() => {
  const out = []; const win = [];
  for (let k = 59; k >= 0; k--) {
    // A slow real climb with noise on top, not a clean ramp.
    const base = 70 + (59 - k) * 0.13;
    const a = Math.max(48, Math.min(96, base + between(-11, 11)));
    win.push(a); if (win.length > 10) win.shift();
    out.push({
      date: ymd(NOW - k * 1.6 * DAY),
      accuracy: r1(a),
      moving_avg: r1(win.reduce((s, v) => s + v, 0) / win.length),
    });
  }
  return out;
})();

const insights = {
  opponent_strength: [
    { bucket: 'Stronger (+100)', games: 71,  wins: 22, win_pct: 31.0, avg_accuracy: 72.4 },
    { bucket: 'Even (±100)',     games: 214, wins: 104, win_pct: 48.6, avg_accuracy: 78.1 },
    { bucket: 'Weaker (-100)',   games: 104, wins: 79, win_pct: 76.0, avg_accuracy: 82.7 },
  ],
  accuracy_trend,
  time_of_day: [
    { label: 'Morning',   games: 63,  wins: 34, win_pct: 54.0 },
    { label: 'Afternoon', games: 118, wins: 58, win_pct: 49.2 },
    { label: 'Evening',   games: 146, wins: 71, win_pct: 48.6 },
    { label: 'Late night', games: 62, wins: 21, win_pct: 33.9 },
  ],
  day_of_week: [
    { label: 'Mon', games: 47, wins: 21, win_pct: 44.7 },
    { label: 'Tue', games: 52, wins: 26, win_pct: 50.0 },
    { label: 'Wed', games: 58, wins: 28, win_pct: 48.3 },
    { label: 'Thu', games: 49, wins: 22, win_pct: 44.9 },
    { label: 'Fri', games: 61, wins: 31, win_pct: 50.8 },
    { label: 'Sat', games: 68, wins: 36, win_pct: 52.9 },
    { label: 'Sun', games: 54, wins: 20, win_pct: 37.0 },
  ],
  phase_accuracy: { opening: 84.2, middlegame: 71.6, endgame: 69.3 },
  time_management: {
    avg_move_seconds: 11.8,
    total_blunders: 268,
    blunders_in_time_pressure: 71,
    time_trouble_rate: 26.5,
  },
  conversion: {
    winning_games: 168, converted: 121, conversion_pct: 72.0,
    blown_games: [
      { game_id: 'g1003', opening_name: 'Italian Game: Giuoco Pianissimo', max_advantage: 4.1, result: 'loss', played_at: iso(NOW - 6 * DAY) },
      { game_id: 'g1011', opening_name: 'Caro-Kann Defense: Advance Variation', max_advantage: 3.6, result: 'draw', played_at: iso(NOW - 14 * DAY) },
      { game_id: 'g1019', opening_name: 'Sicilian Defense: Alapin Variation', max_advantage: 2.8, result: 'loss', played_at: iso(NOW - 23 * DAY) },
      { game_id: 'g1027', opening_name: "Queen's Pawn Game: London System", max_advantage: 2.4, result: 'loss', played_at: iso(NOW - 31 * DAY) },
    ],
  },
  missed_tactics: [
    { motif: 'FORK', count: 148 },
    { motif: 'POSITIONAL', count: 132 },
    { motif: 'DISCOVERED_ATTACK', count: 61 },
    { motif: 'HANGING_PIECE', count: 44 },
    { motif: 'PIN', count: 29 },
    { motif: 'SKEWER', count: 12 },
    { motif: 'BACK_RANK', count: 9 },
  ],
  tilt: { after_win_games: 164, after_win_win_pct: 52.4, after_loss_games: 181, after_loss_win_pct: 41.4 },
  openings: [
    { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', games: 58, win_pct: 39.7, avg_accuracy: 74.1 },
    { eco: 'C50', name: 'Italian Game: Giuoco Pianissimo', games: 51, win_pct: 56.9, avg_accuracy: 80.3 },
    { eco: 'D02', name: "Queen's Pawn Game: London System", games: 47, win_pct: 53.2, avg_accuracy: 79.6 },
    { eco: 'B22', name: 'Sicilian Defense: Alapin Variation', games: 44, win_pct: 43.2, avg_accuracy: 75.8 },
    { eco: 'C00', name: 'French Defense: Advance Variation', games: 38, win_pct: 47.4, avg_accuracy: 77.2 },
  ],
};

/* ---------------------------------------------------------------- patterns */

const pattern = {
  id: 'p1',
  games_analyzed: GAMES_ANALYSED,
  computed_at: iso(NOW - 0.2 * DAY),
  mistakes_moves1to10: 168,
  mistakes_moves11to20: 344,
  mistakes_moves21to30: 421,
  mistakes_moves31_plus: 314,
  mistakes_opening: 298,
  mistakes_middlegame: 731,
  mistakes_endgame: 218,
  motif_frequency: JSON.stringify({
    FORK: 148, POSITIONAL: 132, DISCOVERED_ATTACK: 61,
    HANGING_PIECE: 44, PIN: 29, SKEWER: 12, BACK_RANK: 9, OTHER: 82,
  }),
  opening_accuracy: JSON.stringify({ B12: 74.1, C50: 80.3, D02: 79.6, B22: 75.8, C00: 77.2 }),
  primary_weakness: 'You recapture without checking for knight forks. 148 of your flagged errors are forks, and 61% of them arrive on moves 21-30, when the position has opened and your clock is under two minutes.',
  secondary_weakness: 'Your accuracy falls 12.6 points between the opening and the middlegame. The opening is prepared; the moment you are out of book the move quality drops and does not recover.',
  tertiary_weakness: 'You convert 72% of winning positions. The 47 games you did not convert were nearly all decided after move 30, in endings you entered a pawn or an exchange ahead.',
  critical_move_range: 'Moves 21-30',
  dominant_motif: 'FORK',
  opening_assessment: 'The Caro-Kann Advance is your most played line and your worst performing: 58 games at 39.7%. The Italian at 56.9% is the one carrying your rating.',
};

/* ------------------------------------------------------------ Ask Prax run

   A real-shaped answer with its evidence rows and tool steps. The local model
   is not running for these captures, so the run is served finished. */

const ASK_ANSWER = {
  answer:
    'Forks, and almost always the same way. Across 389 analysed games Praxis flagged 148 fork mistakes, which is more than the next two motifs put together. They are not spread evenly: 61% land between moves 21 and 30, and 71 of your 268 blunders happen with under thirty seconds on the clock.\n\n' +
    'The shape repeats. You recapture a piece in the centre, and the recapture opens a square for a knight that hits two pieces at once. Nxd5 and Bxc3 account for a third of them. In a slower game you see it. Under time pressure you take back automatically.\n\n' +
    'The fix is narrow enough to drill: before any recapture past move 20, check the two knight squares nearest your king and queen. Your deck already has 34 of these positions in it.',
  findings: [
    '148 fork mistakes across 389 games, more than the next two motifs combined',
    '61% of them occur between moves 21 and 30',
    '71 of 268 blunders come with under 30 seconds remaining',
    'Recaptures account for roughly a third of the fork losses',
  ],
  evidence: [
    { label: 'Fork mistakes', value: '148', sample_size: 389, source: 'move_errors' },
    { label: 'Share on moves 21-30', value: '61%', sample_size: 148, source: 'pattern_report' },
    { label: 'Blunders under 30s', value: '71 / 268', sample_size: 389, source: 'clock_data' },
    { label: 'Middlegame accuracy', value: '71.6%', sample_size: 389, source: 'insights' },
    { label: 'Cards already in deck', value: '34', sample_size: 246, source: 'drill_deck' },
  ],
  steps: [
    { tool: 'count_mistakes_by_motif', sample_size: 389 },
    { tool: 'bucket_by_move_number', sample_size: 148 },
    { tool: 'join_clock_data', sample_size: 268 },
    { tool: 'read_pattern_report', sample_size: 389 },
  ],
  partial: false,
  lane: 'ANALYTICAL',
  grounding: 'Grounded in 389 of your analysed games · 4 lookups',
  artifacts: [],
  conversation_id: 'c1',
};

/* ------------------------------------------------------------ Play&Improve */

const playPatterns = {
  games_considered: 26,
  claimable: true,
  caveat: null,
  opening_caveat: null,
  not_measured: [
    'Endgame technique beyond move 40: too few practice games reach it.',
    'Opening preparation: the opponent is steered into your weak lines on purpose, so the sample is not representative.',
  ],
  patterns: [
    {
      id: 'pp1',
      title: 'You trade into worse endings',
      finding: 'In 11 of 26 practice games you initiated a queen trade while a pawn down or with the worse structure.',
      why: 'Trading queens removes your best practical chance. A worse ending is a longer loss, not a safer one.',
      what_to_do: 'When you are worse, keep the queens on and create a second weakness. Trade only when the ending is holdable.',
      strength: 'ESTABLISHED', games_affected: 11, games_considered: 26,
      drill_motif: null,
      evidence: [
        { game_id: 'pg3', ply: 44, label: 'Qxd8 with the worse structure' },
        { game_id: 'pg7', ply: 38, label: 'Qe7 offering the trade a pawn down' },
        { game_id: 'pg12', ply: 51, label: 'Qxc6 into a lost rook ending' },
      ],
    },
    {
      id: 'pp2',
      title: 'The same fork, against the same opponent profile',
      finding: 'Seven of 26 games ended to a knight fork on a square you had already vacated.',
      why: 'A fork is not a tactic you miss once. It is a square you stopped watching.',
      what_to_do: 'Before every recapture, name the two squares a knight could reach that touch both your king and your queen.',
      strength: 'ESTABLISHED', games_affected: 7, games_considered: 26,
      drill_motif: 'FORK',
      evidence: [
        { game_id: 'pg2', ply: 47, label: 'Ne5 forking c6 and g6' },
        { game_id: 'pg9', ply: 33, label: 'Nd6+ after the exchange on e4' },
      ],
    },
    {
      id: 'pp3',
      title: 'Time spent early, not where it decides',
      finding: 'Your first fifteen moves took 38% of the clock across 26 games, and 19 of those openings were in book.',
      why: 'Thinking in a position you already know buys nothing and costs the move where it mattered.',
      what_to_do: 'Move inside ten seconds while you are still in preparation. Bank it for the first move that is not.',
      strength: 'EMERGING', games_affected: 19, games_considered: 26,
      drill_motif: null,
      evidence: [{ game_id: 'pg5', ply: 12, label: '2m 41s on a book move' }],
    },
  ],
};

const playHistory = Array.from({ length: 12 }, (_, i) => ({
  id: 'pg' + (12 - i),
  game_id: 'g' + (1040 + i),
  started_at: iso(NOW - (i * 2.3 + 0.5) * DAY),
  finished_at: iso(NOW - (i * 2.3 + 0.4) * DAY),
  status: 'FINISHED',
  result: i % 3 === 0 ? 'win' : i % 3 === 1 ? 'loss' : 'draw',
  skill_level: 6 + (i % 3),
  target_opening: OPENINGS[i % OPENINGS.length][1],
  rated: true,
  analysed: true,
}));

const opponentProfile = {
  skill_level: 7,
  target_eco: 'B12',
  target_opening: 'Caro-Kann Defense: Advance Variation',
  target_phase: 'MIDDLEGAME',
  target_motif: 'FORK',
  targeted_weakness: 'Knight forks on moves 21-30',
  personalised: true,
  rationale: [
    'You score 39.7% in the Caro-Kann Advance across 58 games, your weakest opening with enough games to judge.',
    'The opponent will steer toward it and play the middlegame plan you lose to.',
    'Most of your blunders land in the middlegame (731 of 1,247).',
    'Strength is set to 7 of 20, calibrated to your 71.6% middlegame accuracy: a game you can lose, not one you cannot win.',
  ],
};

/* ------------------------------------------------------------------ routes */

const routes = {
  'GET /api/sync/status': () => ({
    state: 'IDLE', games_fetched: GAMES_TOTAL, games_analyzed: GAMES_ANALYSED,
    games_pending: 0, last_synced_at: iso(NOW - 0.08 * DAY),
  }),
  'GET /api/sync/new-count': () => ({ count: NEW_ON_CHESSCOM }),

  'GET /api/games': () => games,
  'GET /api/dashboard/stats': () => ({
    total_games: GAMES_TOTAL, wins: 197, losses: 178, draws: 37,
    games_analyzed: GAMES_ANALYSED, current_rating: RATING, rating_delta: 37,
    avg_accuracy: 78.4, best_accuracy: 94.1, blunder_count: 268,
    opening_stats: insights.openings.map(o => ({
      eco: o.eco, name: o.name, games: o.games,
      wins: Math.round(o.games * o.win_pct / 100), win_pct: o.win_pct,
    })),
    rating_history: Array.from({ length: 40 }, (_, i) => ({
      date: ymd(NOW - (39 - i) * 3 * DAY),
      rating: Math.round(1449 + i * 0.95 + between(-14, 14)),
    })),
    recent_games: games.slice(0, 8).map(g => ({
      id: g.id, played_at: g.played_at, time_class: g.time_class,
      player_color: g.player_color, result: g.result,
      opening_eco: g.opening_eco, opening_name: g.opening_name, accuracy: g.accuracy,
    })),
    white_games: 208, white_win_pct: 50.5, black_games: 204, black_win_pct: 45.1,
    form_streak: 3,
    time_control_stats: [
      { time_class: 'rapid', games: 236, wins: 118, win_pct: 50.0 },
      { time_class: 'blitz', games: 158, wins: 71, win_pct: 44.9 },
      { time_class: 'bullet', games: 18, wins: 8, win_pct: 44.4 },
    ],
  }),

  'GET /api/analysis/progress': () => ({
    running: false, pattern_generating: false, queued: false, stopping: false,
    completed: GAMES_ANALYSED, total: GAMES_ANALYSED, percent_complete: 100, eta_seconds: 0,
  }),

  'GET /api/insights': () => insights,
  'GET /api/patterns': () => pattern,
  'GET /api/progress': () => ({ deck_summary, history }),

  'GET /api/practice/streak': () => ({
    current_streak: currentStreak(), longest_streak: longestStreak(),
    total_days_practiced: practice_days.length,
    last_practice_date: practice_days[practice_days.length - 1],
    practiced_today: true, today: ymd(NOW), practice_days,
  }),

  'GET /api/today': () => ({
    title: 'Stop losing pieces to knight forks after move 20',
    evidence: {
      metric: 'Fork mistakes on moves 21-30',
      value: '90 of 148 (61%)',
      sample_size: GAMES_ANALYSED,
    },
    action: 'Twelve positions from your own games, all of them a recapture that walked into a fork. Play the move you should have found.',
    expected_minutes: 18,
  }),

  'GET /api/training-plan': () => ({
    id: 'tp1', generated_at: iso(NOW - 1.1 * DAY), based_on_games: GAMES_ANALYSED,
    plan_json: JSON.stringify({
      priority_1: { focus: 'Knight forks after a recapture', action: 'Twelve drills a day from your own games, for a week.', reason: '148 flagged forks, 61% of them on moves 21-30.' },
      priority_2: { focus: 'The Caro-Kann Advance middlegame', action: 'Play the practice opponent in this line until you hold 50%.', reason: '58 games at 39.7%, your most played and worst scoring line.' },
      priority_3: { focus: 'Converting a won ending', action: 'Rook-and-pawn technique, twenty minutes twice a week.', reason: '47 winning positions not converted, nearly all after move 30.' },
    }),
    openings_to_drill: JSON.stringify(['B12 Caro-Kann Advance', 'B22 Sicilian Alapin']),
    tactical_patterns: JSON.stringify(['Fork', 'Discovered attack', 'Back rank']),
  }),

  'GET /api/play/status': () => ({ available: true }),
  'GET /api/play/preview': () => opponentProfile,
  'GET /api/play/patterns': () => playPatterns,
  'GET /api/play/history': () => playHistory,

  'GET /api/prax/status': () => ({ available: true, model: 'qwen2.5:7b', ready: true }),
  'GET /api/prax/conversations': () => ([
    { id: 'c1', title: 'What mistake am I repeating most often?', last_message_at: iso(NOW - 0.02 * DAY) },
    { id: 'c2', title: 'Is the Caro-Kann worth keeping?', last_message_at: iso(NOW - 2.1 * DAY) },
    { id: 'c3', title: 'Why do I lose after move 30?', last_message_at: iso(NOW - 5.4 * DAY) },
  ]),
  'GET /api/voice/status': () => ({ available: false }),
};

/* ---------------------------------------------------------------- dispatch */

function resolve(method, path) {
  const key = method + ' ' + path;
  if (routes[key]) return routes[key]();

  let m;
  if ((m = path.match(/^\/api\/games\/([^/]+)\/review$/))) {
    const g = games.find(x => x.id === m[1]) || HERO_GAME;
    return { game_id: g.id, player_color: g.player_color, opening_eco: g.opening_eco,
             opening_name: g.opening_name, result: g.result, accuracy: g.accuracy,
             analysis_status: 'ANALYZED', moves: [] };
  }
  if ((m = path.match(/^\/api\/games\/([^/]+)$/)))
    return games.find(x => x.id === m[1]) || HERO_GAME;
  if ((m = path.match(/^\/api\/analysis\/([^/]+)$/))) return moveErrors;
  if (path.startsWith('/api/drills')) return drills;

  if ((m = path.match(/^\/api\/prax\/run\/([^/]+)$/)))
    return { run_id: m[1], status: 'DONE', steps: ASK_ANSWER.steps,
             artifacts: [], answer: ASK_ANSWER, error: null, elapsed_ms: 4120 };
  if (path === '/api/prax/ask' || path === '/api/prax/ask/stream')
    return { run_id: 'r1', status: 'RUNNING', answer: null, steps: [], artifacts: [] };
  if ((m = path.match(/^\/api\/prax\/conversations\/([^/]+)$/)))
    return { id: m[1], title: 'What mistake am I repeating most often?',
             turns: [{ question: 'What mistake am I repeating most often?', answer: ASK_ANSWER }] };

  if (path === '/api/sessions')
    return { id: 's1', cards_total: 12, cards_completed: 0, budget_minutes: 18,
             completed: false, started_at: iso(NOW), completed_at: null };
  if ((m = path.match(/^\/api\/sessions\/([^/]+)\/next$/)))
    return { id: 'card1', fen_position: DRILLS[0].fen, move_played: DRILLS[0].played,
             better_move: DRILLS[0].best, severity: DRILLS[0].sev,
             tactical_motif: DRILLS[0].motif, game_phase: DRILLS[0].phase,
             player_color: 'white', explanation: DRILLS[0].why, status: 'REVIEW',
             interval_days: 4, due_date: ymd(NOW), review_count: 3, lapse_count: 1,
             game_id: 'g1001' };
  if ((m = path.match(/^\/api\/sessions\/([^/]+)$/)))
    return { id: m[1], cards_total: 12, cards_completed: 4, budget_minutes: 18,
             completed: false, started_at: iso(NOW - 0.004 * DAY), completed_at: null };

  return null;
}

http.createServer((req, res) => {
  const { pathname } = parse(req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  let body;
  try { body = resolve(req.method, pathname); }
  catch (e) { res.writeHead(500); return res.end(String(e)); }

  if (body === null || body === undefined) {
    console.log('  404 ' + req.method + ' ' + pathname);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"error":"no fixture"}');
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}).listen(8086, () => console.log('fixture API on :8086'));
