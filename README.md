# PRAXIS CHESS — website

One narrative page for [Praxis Chess](https://github.com/praxis-chess/Praxis-Chess).
Static — no framework, no bundler, no build step, no dependencies.

```bash
python serve.py              # http://localhost:5500, no-store, clean URLs
python tools/check.py        # preflight: run this before every deploy
python tools/make-assets.py  # regenerate the mark, favicons and share card
```

Deploying: **[DEPLOY.md](DEPLOY.md)**. Before you ship: **[CHECKLIST.md](CHECKLIST.md)**.

---

## The shape of it

**One document, nine scenes, sixteen viewports.** `/` is the whole site. The
old `/pipeline` and `/download` addresses still resolve — they are 308
redirects into `/#pipeline` and `/#download` at the edge, with noindex stubs
behind them for hosts that do not read a redirect file.

| # | id | len | what it does |
|---|---|---|---|
| 01 | `hero` | 1.3 | the claim, at full size |
| 02 | `problem` | 2.4 | one move → many games → one pattern |
| 03 | `difference` | 1.8 | engine output against a Praxis statement |
| 04 | `pipeline` | 2.4 | five stages, condensing on screen |
| 05 | `report` | 1.8 | the capture is the composition |
| 06 | `practice` | 2.6 | five app screens, introduced one at a time |
| 07 | `local` | 1.4 | the architecture as a technical artifact |
| 08 | `download` | 1.6 | an installation panel |
| 09 | `end` | 1.2 | the conclusion |

## The scene system

The page does not scroll. `js/scroll.js` owns the wheel, translates one track,
and publishes per scene how far through it you are:

```
scene.style.setProperty('--p', 0 … 1)
```

Everything else is CSS reading `--p`. That keeps the choreography declarative,
on the compositor, and re-timeable without touching JavaScript.

A scene says how long it is, in viewports, and a pinned child is held against
the viewport while it passes:

```html
<section class="scene" id="problem" data-len="2.4">
  <div class="scene__pin"> … held still while you travel … </div>
</section>
```

**Pinning is manual and has to be.** `position:sticky` needs a scrolling
ancestor and there isn't one. The pinned child is pushed back by exactly the
distance the track moved inside its scene — same effect, no scroll container,
one composited transform.

### Staging inside a scene

One utility. An element says *when* in its scene it happens and how fast:

```html
<p class="at at--rise" style="--s0:.35;--inv:4">
```

`--s0` is the progress it starts at; `--inv` is **one over its span** (here a
quarter of the scene, so 4). Two numbers rather than a start and an end
because CSS `calc` can multiply by a variable but not divide by one.
`tools/check.py` fails on an `--s0` past 1 — an element that never appears.

## The application captures

The compositions are built around real screenshots of the product, taken by
`tools/capture.js` driving the running application through every screen. They
are real: a real analysed library of 105 games, real mistakes, a real pattern
report, and an Ask Prax answer the local model actually produced.

**See [assets/app/README.md](assets/app/README.md)** for what each one shows
and how to re-capture.

Each slot is one line:

```html
<figure class="shot shot--tilt" data-shot="report"
        data-focus="50% 30%" data-alt="…"></figure>
```

`js/shots.js` gives it an `<img>` and three states: ready, loading, or
**missing** — where the slot keeps its exact geometry and shows a placard
naming the file it wants, so a capture that fails to ship never collapses the
layout.

**No slot ever draws a fake version of the product.** A mocked-up screenshot
is a claim about what the software does, and this page does not make claims the
software cannot back. WebP at quality 88, 1920 wide: 0.6 MB for all seven,
against 10.7 MB as PNG.

## Two builds, not one responsive layout

| | desktop | phone |
|---|---|---|
| scrolling | virtual (`js/scroll.js` owns the wheel) | native |
| choreography | scrubbed against `--p` | one entrance per element |
| scripts loaded | 11 | 11 |

A phone never downloads the accumulator — the loader decides before the file is
requested. **Crossing the breakpoint reloads the page**, because the phone
build has handed scrolling to the browser and the desktop build needs it back.

`?desktop` forces the full build on a phone.


## The ground

There is no WebGL object on this site. An earlier build carried the
application's Prax organism — the 2,562-point icosphere, ported faithfully
from `frontend/src/prax/` — and at website scale it read as a grey mass of
dots rather than as something thinking. It was removed rather than tuned.

What is there instead is `.bloom`: two very soft orchid radial gradients under
everything, so sixteen viewports of near-black have somewhere to be. If the
organism is ever wanted back, it was `js/prax.js`, `js/praxgeo.js`,
`js/praxglsl.js` and `js/anchor.js`, driven by `data-prax-*` attributes on each
scene — the git history has all four.

**Orchid is a signal, not a colour.** In the app it appears when Prax has
something for you; here it gets the one primary action, one word per heading,
and the marked square. Make it a decorative highlight and the product's most
distinctive idea stops being legible.

## Modules

`js/lifecycle.js` is a registry; `js/boot.js` mounts — everything on desktop, a
named allowlist on the phone.

| file | registers | phone? |
|---|---|---|
| `lifecycle` `isolate` `dormancy` | the registry, `?off=`, the dormancy flags | yes |
| `nav` | header and mobile sheet | yes |
| `board` | FEN to 64 divs | yes |
| `copy` | copy-to-clipboard | yes |
| `shots` | the capture slots | yes |
| `a11y` | focus follows the accumulator | yes |
| `fps` | only with `?fps` | yes |
| `reveal` | scroll-in transitions | **phone only** |
| `strip` | the bottom readouts | no |
| `scroll` | the accumulator | no |

## Invariants — things in two places that must agree

- **The breakpoint.** Written once, in `css/mobile.css`'s 760px query.
  Everything else reads `--build`.
- **The orchid.** `--orchid` in `base.css` and `ORCHID` in `make-assets.py`.
  `check.py` compares them.
- **Scenes and the rail.** Every scene needs a `data-goto` tick or it is
  reachable only by the wheel.
- **Slots and the manifest.** Every `data-shot` must be listed in
  `assets/app/README.md`, so a typo cannot ship as a permanently empty frame.
- **The module registry.** `boot.js`'s allowlist, the three script lists in
  `index.html`, and what each file registers.

## Instruments

| | |
|---|---|
| `?fps` | frame counter with p95, and what is dormant |
| `?off=grain,reveal,board,shots` | kill layers to measure them |
| `?desktop` | force the desktop build on a phone |

## Conventions

- **Vanilla JS, no dependencies.** Scripts ordered, `async=false`, `boot.js`
  last.
- **Tokens over literals.** If you are typing a colour into `site.css`, it
  belongs in `base.css` — and probably already is.
- **Comments explain *why*.** Most of the long ones are a bug's post-mortem,
  or the application's own reasoning carried across with the code.
- **Borders are a last resort.** Hierarchy comes from spacing, scale,
  alignment and cropping. The hairlines that remain are on tabular rows, where
  a rule genuinely separates two records.
- **Height is a breakpoint.** A pinned scene is one viewport, so the same
  composition is fine at 1280×900 and broken at 1280×720. See section 18 of
  `site.css`.
- **The failure mode shows content.** A missing capture gives a placard; a
  board with no JavaScript is still a board; `.at` elements are forced visible
  on mobile, where nothing drives `--p`.

## What is deliberately not here

No bundler, no TypeScript, no test framework, no analytics, no cookie banner
(there are no cookies), and no shared-chrome sync tool — there is one page now,
so there is nothing to keep in step. `tools/check.py` is the whole safety net.
