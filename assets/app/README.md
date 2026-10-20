# Application captures

Screenshots of the real Praxis Chess frontend (v1.4.0 and the polish work after
it: the centred nav, Today's rail, the eval graph), taken at 1440×900 at 2×.

## What is real in these, and what is not

**Real:** the application. Every pixel is the actual React frontend rendering
through its own components, its own CSS, its own chart and board code. Nothing
is drawn, retouched, composited, or mocked up in a design tool.

**Not real:** the data behind it. Nobody's real games appear on the site.

- Seven screens run on the application's own end-to-end test data
  (`frontend/e2e/fixtures` and its `ApiMock`): a made-up player with 101 games.
  A few screens get a fuller made-up library than the tests need (a 60-game
  accuracy trend, every hour and day, three weeks of reviews, an answered
  question), so no chart is shown nearly empty.
- The Game Analysis shot uses a game from the app's **sample library**:
  Stockfish playing a made-up player (`sample_sam`) at club strength, analysed
  by the real pipeline. Its moves, curve, mistakes and diagnoses are the
  engine's; the player is invented.

**This is a real trade and it is worth stating plainly:** the numbers on the
website's screenshots are a demo player's, not a real one's. The product shown
performing is real; the performance shown is illustrative.

## What is here

| file | screen | what is on it |
|---|---|---|
| `report.webp` | Game analysis | A loss with nine flagged moves: the board on the costliest one with the played and better moves drawn, the winning-chance curve, the move list, and the verified diagnosis of each mistake. The most important capture on the site. |
| `patterns.webp` | Pattern Report, 3:1 | The costliest habit and the first weakness ranked by winning chances lost, with its positions and board. The band in "The difference". |
| `patterns-tall.webp` | Pattern Report, 3:4 | The same report in a portrait window: the habit, both weaknesses with their boards, and where they happen. The "Your weakness" frame. |
| `insights.webp` | Insights | The takeaway line, conversion, time trouble, move time and resilience, and a 60-game accuracy and Elo trend. |
| `today.webp` | Today | The day's focus with its evidence open and one of the positions behind it, the deck counters, the week, and the rail (rating, last game, next session, top habit). |
| `progress.webp` | Progress | The deck, 7-day recall over three weeks of reviews, phase recall and the practice history. |
| `play.webp` | Play & Improve | The next game (opening, colour, strength and why), practice so far, and the patterns found in it. |
| `drill.webp` | Drills | A position from the player's own mistake, in a training-plan session. |
| `ask.webp` | Ask Prax | A question answered with findings, prose, five evidence rows and the lookups behind it. |

## Framed for the slot

Every slot crops with `object-fit: cover`, so a full 16:10 screen in a 3:1 band
or a 3:4 frame lands on empty margin or slices through text. Each capture is
therefore taken at its slot's own shape, around the part that matters: the
band is the costliest habit and its first weakness, Today is its main column,
the drill is its board and words, Ask Prax is the answer and its evidence,
Play is a 1200×900 window, and the tall frame is a portrait window. On the
desktop layout the slot shows the whole capture; `data-focus` only matters
where a breakpoint changes a slot's shape.

## Re-capturing

The captures are taken by a spec in the application, off in every normal test
run. It needs nothing running: the app's test setup starts its own dev server
and answers every API call itself, so the real backend can stay on `:8086`.

```bash
cd "D:/Tanm/Projects/Praxis-Chess/frontend" && SITE_SHOTS=1 SHOTS_OUT="D:/Tanm/Projects/Personal-Websites/Praxis Chess Website/assets/app" npx playwright test e2e/site --project=chromium
```

```bash
python tools/towebp.py
```

`e2e/site/site-shots.spec.ts` does the clicking a visitor would do before each
screen is worth photographing: it opens the evidence on Today and asks Ask
Prax a real question; Game Analysis opens on its costliest mistake by itself.

`tools/capture.js` and `tools/fixture-api.js` took the previous set against a
stand-in backend on `:8086`. They no longer match the application's API, and
`:8086` is the real backend's port, so they are kept for reference only.

## Format

WebP, quality 88, 1920 wide. PNG is the wrong container for a dark interface
full of text: this set came to **8.7 MB as PNG and 0.7 MB as WebP**, with
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
