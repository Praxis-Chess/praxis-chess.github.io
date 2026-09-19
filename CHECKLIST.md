# Before you ship

```bash
python tools/check.py
```

Exit code 0 and you have cleared everything a script can check. The rest needs
eyes, and on this site most of it needs a real browser rather than an emulator.

---

## What `check.py` covers

1. Every `js/*.js` parses, every `css/*.css` is balanced.
2. Every local `href`, `src` and `url()` resolves, including extensionless
   links, resolved the way the host resolves them.
3. Every `#fragment` points at an `id` that exists.
4. The module registry agrees with itself — `boot.js`'s allowlist, all three
   script lists in `index.html`, and what each file registers, including that
   nothing is registered by a file no page loads.
5. **Scenes agree with the rail**: tick count, `data-goto` numbering, every
   scene has an id, every `data-len` is a number ≥ 1.
6. **Every in-page link can move the page**: a hash that exists but is not a
   scene would change the address bar and nothing else.
7. **Staged reveals are reachable**: no `--s0` past the end of its scene,
   no non-positive `--inv`, and a warning for anything still arriving as its
   scene ends.
8. **Capture slots agree with the manifest**: every `data-shot` is listed in
   `assets/app/README.md`, every slot has `data-alt`, and outstanding captures
   are reported.
9. One `<h1>`, a title, a description and a `data-page` on the real page.
10. `og:image` absolute, every absolute URL agreeing on a domain.
11. The redirect stubs carry noindex and canonical to `/`.
12. `sitemap.xml` lists exactly the real page.
13. Every FEN is eight ranks of eight; every marked square is real.
14. **The orchid matches in both encodings** — `base.css`, `make-assets.py`.

## What it cannot check

### The narrative
- [ ] Scroll `#problem` slowly, start to finish. One move should be alone,
      then multiply into a field, then collapse into a single sentence, while
      the counters climb 1 → 11 → 42 → 97. **If that sequence does not read,
      the site has lost its argument** — it is the one place where the motion
      is the point rather than the decoration.
- [ ] `#pipeline`: the left column should visibly *thin* as you travel, leaving
      only the four rows marked `.keeps`.
- [ ] `#practice`: five captures should arrive one at a time and overlap. If
      they all appear together it is a collage, not a story.


### The scroll
- [ ] One wheel notch moves a fraction of a scene and keeps easing after you
      stop. If it snaps, `EASE` in `js/scroll.js` is wrong.
- [ ] A hard trackpad flick must not throw you through a whole scene.
- [ ] Arrow keys, Page Up/Down, Home, End. Every rail tick.
- [ ] **Tab through without the mouse.** Focus must never land on a scene you
      cannot see.
- [ ] `/#download` typed directly should land on the download scene, instantly,
      not ease through eight others.
- [ ] **Click Process and Download in the masthead**, then use the back button.
      Each should ease to its scene and leave the address bar correct.

      This is where a nasty one lives. `.stage` must be `overflow:clip`, never
      `overflow:hidden` — hidden still makes it a scrollport, and the browser
      scrolls a scrollport to reach a fragment. It scrolled the stage 4,950px
      while the accumulator stayed at zero, which showed an empty region of a
      page whose scenes were all `content-visibility:hidden`. A blank screen,
      no console error. If the page ever goes blank after clicking an in-page
      link, check that property first.

### Responsive
- [ ] 1907×907, 1440×900, **1280×720**, 1366×640. Height is a real breakpoint:
      a pinned scene is one viewport, so a composition that is comfortable at
      907 tall can run past the strip at 640 — and no width query can see it.

      The system scales against height in four tiers (`site.css` §18): ≤820
      tightens the spacing ladder, ≤780 lowers the display ceilings and crops
      the captures harder, ≤700 drops the pipeline glosses, ≤560 lets a scene
      scroll inside itself. Measured slack at the sizes above is 105 / 111 /
      20 / 63 px. **If you add anything to a scene, re-measure** — 20px is not
      much.
- [ ] **760px** — the build switch. Drag a real window across it: the page
      reloads once and comes back in the other build. A devtools device
      override will *not* trigger this.
- [ ] The masthead must never be overlapped. `align-items:safe center` on the
      pin guarantees overflow can only go downward, but a scene that overflows
      at all is a scene to shorten.
- [ ] On a phone: native scroll, no rail, no strip, and **every section
      visible**. If the page is blank, the `--a:1` override in
      `mobile.css` has been lost and nothing drives `--p` there.

### Motion and accessibility
- [ ] `prefers-reduced-motion` on, reload. Everything visible and nothing
      moving.
- [ ] Disable JavaScript. Navigation, copy and links all work; only the
      scrubbing should be missing.

### Performance
- [ ] `?fps` on the slowest machine you own. Watch p95, not the average.
- [ ] Switch tabs and back: `drawn/offered` must stop climbing while hidden.
- [ ] Network panel on a cold load: only the captures in the first scene or
      two should be fetched. Off-screen scenes are `content-visibility:hidden`
      and their lazy images must not load.

### After deploying
- [ ] `/pipeline` and `/download` typed directly — both should 308 into the
      narrative page.
- [ ] `/nope` gives the 404 page with a 404 status.
- [ ] The share card renders in Slack or iMessage.

---

## When the application captures arrive

Drop them in `assets/app/` with the exact filenames from its README, then:

```bash
python tools/check.py
```

The outstanding-captures warning should disappear. Then look at every slot:
the crops were chosen against assumed aspect ratios, and a capture whose real
shape differs may need its `data-focus` adjusted so the important part of the
screen is the part that survives the crop.

## If you changed the palette

```bash
python tools/make-assets.py && python tools/check.py
```

The orchid lives in two files and no build step can share it.

## If the application's design changed

This site copies `frontend/src/index.css`. Port the change; do not reinterpret
it.
