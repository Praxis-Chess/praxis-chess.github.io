/* Capture the Praxis application for the marketing site.
 *
 *   node tools/capture.js
 *
 * Drives a real Chrome through the real frontend at 1440x900 at 2x, does the
 * clicking a visitor would do to make each screen show something, writes PNGs
 * into assets/app/, then runs tools/towebp.py to downscale and convert.
 *
 * ---------------------------------------------------------------------------
 * WHICH BACKEND IT TALKS TO, AND WHY THAT IS A DECISION
 *
 * The frontend only needs something answering on :8086. Two things can be:
 *
 *   the real backend      Spring Boot + Postgres + Stockfish + Ollama. Your own
 *                         games, your own mistakes. The truest capture there is.
 *
 *   tools/fixture-api.js  A static stand-in serving the same JSON shapes for a
 *                         demo library. No database, no engine, no model.
 *
 * The first pass of these screenshots used the real backend and most of them
 * came out full of zeros — not because anything was broken, but because that
 * database has a rich game library and an untouched drill deck. Today showed
 * 0 / 0 / 0 / 0, Progress showed 0% recall across an empty deck, and Insights
 * reported 0 blunders in time trouble because no clock data had been joined.
 * Those screens were telling the truth about an account that had not used
 * those features yet, and a marketing page cannot argue for a feature with a
 * screenshot of it unused.
 *
 * So the captures on the site are taken against the fixture library. What is
 * real in them is everything that makes them worth showing: the components,
 * the layout, the charts, the board renderer, the type, the colour. What is
 * synthetic is the game data behind it. That trade is stated plainly in
 * assets/app/README.md rather than left for someone to discover.
 *
 * To capture your own data instead, start the real stack and run this the
 * same way — it does not know or care which is answering.
 * ---------------------------------------------------------------------------
 *
 * Playwright is required by absolute path because this file lives outside the
 * application; Node resolves modules next to the FILE, not the CWD. Forward
 * slashes throughout: Windows accepts them and they survive a shell.
 */
const PW = 'D:/Tanm/Projects/Praxis-Chess/frontend/node_modules/playwright';
const { chromium } = require(PW);
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'assets', 'app');
const BASE = process.env.APP_URL || 'http://localhost:5173';

/* The game the biggest capture on the site is built around: a loss with nine
   real mistakes in it. An easy win makes a screenshot that proves nothing. */
const GAME_ID = process.env.GAME_ID || 'g1000';

/* Each shot names the slot it fills on the website. `act` is the clicking a
   visitor would do before the screen is worth photographing — an unopened
   accordion or an unselected board is a screenshot of a menu. */
const SHOTS = [
  {
    name: 'today', url: '/', wait: 2200,
    async act(page) {
      // The evidence behind the day's focus is collapsed by default, and it is
      // the part that shows the claim is derived rather than asserted.
      const b = page.getByRole('button', { name: /Show evidence/i });
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
    },
  },
  {
    name: 'report', url: '/games/' + GAME_ID, wait: 2600,
    async act(page) {
      // Without this the board says "Select a mistake to see the position" and
      // the arrows — the thing that makes the screen legible — never draw.
      const card = page.locator('text=/^\\d+\\./').first();
      if (await card.count()) { await card.click(); await page.waitForTimeout(700); }
    },
  },
  { name: 'patterns', url: '/patterns', wait: 2400 },
  { name: 'insights', url: '/insights', wait: 2600 },
  { name: 'play',     url: '/play',     wait: 2200 },
  { name: 'drill',    url: '/drills',   wait: 2200 },
  {
    name: 'progress', url: '/progress', wait: 2400,
    async act(page) {
      const b = page.getByRole('button', { name: /Show daily history/i });
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
    },
  },
  {
    name: 'ask', url: '/ask', wait: 2000,
    async act(page) {
      // An empty prompt says nothing about what the feature does. A real
      // question goes in and the answer comes back with its evidence rows.
      const box = page.locator('textarea, input[type="text"]').first();
      if (!(await box.count())) return console.log('   (no input on Ask Prax)');
      await box.click();
      await box.fill('What mistake am I repeating most often?');
      await page.keyboard.press('Enter');
      // Long enough for a local model on CPU; returns sooner against fixtures.
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const t = await page.innerText('body');
        if (/Fork mistakes|evidence/i.test(t) && !/Thinking|Working/i.test(t)) break;
      }
      await page.waitForTimeout(800);
    },
  },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  const problems = [];
  page.on('response', r => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url()); });

  for (const s of SHOTS) {
    console.log('-> ' + s.name.padEnd(9) + ' ' + s.url);
    await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded' });
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); }
    catch { /* a polling app never goes idle; the fixed wait covers it */ }
    await page.waitForTimeout(s.wait);
    if (s.act) await s.act(page);

    const text = (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 120);
    console.log('   ' + text);
    await page.screenshot({ path: path.join(OUT, s.name + '.png') });
  }

  await browser.close();
  if (problems.length) {
    console.log('\nHTTP problems seen:');
    [...new Set(problems)].forEach(p => console.log('  ' + p));
  }

  console.log('\nconverting...');
  console.log(execFileSync('python', [path.join(__dirname, 'towebp.py')], { encoding: 'utf-8' }));
})().catch(e => { console.error(e); process.exit(1); });
