# Application captures

Screenshots of the real Praxis Chess frontend, taken by `tools/capture.js`
driving a real Chrome at 1440×900 at 2×.

## What is real in these, and what is not

**Real:** the application. Every pixel is the actual React frontend rendering
through its own components, its own CSS, its own chart and board code. Nothing
is drawn, retouched, composited, or mocked up in a design tool.

**Not real:** the game library behind it. These are captured against
`tools/fixture-api.js`, a stand-in backend serving a demo player's data.

### Why it is not the real library

The first set was taken against the real backend, and most of it came out full
of zeros. Not because anything was broken — because that account has a rich
game library and an untouched drill deck:

| screen | what it actually showed |
|---|---|
| Today | `0` due, `0` learning, `0` review, `0` new |
| Progress | `0` total cards, `0%` recall, an empty chart |
| Insights | `0%` blunders in time trouble, `0/174` under 30s |
| Play & Improve | ten practice games, all losses, all the same date |

Those screens were telling the truth about features that account had not used
yet. A marketing page cannot argue for a feature with a screenshot of it
sitting unused, so the captures are taken against a populated demo library
instead.

**This is a real trade and it is worth stating plainly:** the numbers on the
website's screenshots are a demo player's, not a real one's. The product shown
performing is real; the performance shown is illustrative. If you would rather
the site carry only your own data, run the real stack and re-capture — the
tooling is identical, see below.

## What is here

| file | screen | what is on it |
|---|---|---|
| `report.webp` | Game analysis | Nine mistakes with severity, motif, engine best move and a written explanation each, with the board showing the selected position. The most important capture on the site. |
| `patterns.webp` | Pattern Report | 389 games, 1,247 mistakes, three ranked weaknesses, mistakes by move range and phase, eight tactical motifs ranked. |
| `insights.webp` | Insights | Winning-position conversion, blunders in time trouble, average move time, a 60-game accuracy trend with a 10-game rolling average. |
| `today.webp` | Today | The day's focus with its evidence rows expanded, the deck counters, and the weekly streak. |
| `progress.webp` | Progress | Deck health, 7-day recall, the review-volume chart, phase recall, and the daily history table. |
| `play.webp` | Play & Improve | The opponent profile with its rationale, and the practice game log. |
| `drill.webp` | Drills | A drill position from a flagged mistake. |
| `ask.webp` | Ask Prax | A question answered with findings, prose, five evidence rows and a lookup count. |

## Re-capturing

Something has to answer on `:8086`. Either works, and `capture.js` does not
know the difference.

**Against the demo library** (what the site currently ships):

```bash
node tools/fixture-api.js
```

```bash
cd "D:/Tanm/Projects/Praxis-Chess/frontend" && npm run dev
```

```bash
node tools/capture.js
```

**Against your own games:** start the real stack instead — Postgres in Docker,
the backend from IntelliJ on JDK 26, Ollama on `:11434` if you want Ask Prax to
answer — then run `npm run dev` and `node tools/capture.js` exactly as above.
Point it at a game worth showing:

```bash
GAME_ID=<uuid> node tools/capture.js
```

`curl -s localhost:8086/api/games` lists them with `mistake_count` and
`accuracy`. An easy win makes a dull screenshot.

`capture.js` does the clicking a visitor would do before each screen is worth
photographing: it opens the evidence panel on Today, selects a mistake so the
board and its arrows draw, expands the daily history on Progress, and types a
real question into Ask Prax. It then runs `tools/towebp.py`.

## Format

WebP, quality 88, 1920 wide. PNG is the wrong container for a dark interface
full of text: these eight were **13.1 MB as PNG and 0.8 MB as WebP**, with
nothing visible lost at the size any slot renders. `tools/check.py` warns above
300 KB a file.

## How the slots use them

Each is placed by a `data-shot` attribute in `index.html` and loaded by
`js/shots.js`. If a file is missing, the slot keeps its exact geometry and
shows a placard naming what it wants, so the layout never collapses.
`tools/check.py` fails if a slot asks for a capture this file does not list.

`progress.webp` is captured but not currently placed in a slot. Scene 06's
"Your improvement" frame uses `insights.webp`, whose accuracy trend is the
stronger improvement signal; `progress.webp` is kept as the alternative.
