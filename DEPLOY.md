# Deploying

The site is static files. Any host that serves a directory will work; the
three below are covered because the repository already contains their config.

**There is no build command and no output directory.** If a host asks, leave
the build command empty and set the output directory to the repository root.
A host that insists on running a build will succeed and produce nothing, which
looks identical to a successful deploy of an empty site.

---

## 1 · Before the first deploy: change the domain

Four things carry `praxischess.app` and all four must agree, or the canonical
points at a domain you do not own while the share preview 404s:

| file | what to change |
|---|---|
| `index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image` |
| `pipeline.html`, `download.html` | the `<link rel="canonical">` in each redirect stub |
| `sitemap.xml` | every `<loc>` |
| `robots.txt` | the `Sitemap:` line |

```bash
# From the repository root. Check the diff before committing.
grep -rl 'praxischess.app' --include='*.html' --include='*.xml' --include='*.txt' .
```

`tools/check.py` warns while the placeholder is still in place, fails if the
pages ever disagree about the domain, and fails if `og:image` stops being an
absolute URL. **Run it after the rename**, not before.

## 2 · Vercel

`vercel.json` is already correct. Import the repository and deploy — no
settings to change.

What that file does:

- **`cleanUrls: true`** — `/download` resolves without the extension.
- **`redirects`** — `/pipeline` and `/download` 308 into `/#pipeline` and
  `/#download`. The site is one document now; these two addresses were linked
  and indexed, so they keep resolving. `_redirects` does the same on
  Cloudflare and Netlify, and `pipeline.html` / `download.html` are the floor
  for any host that reads neither.
- **`trailingSlash: false`** — one canonical address per page.
- Long cache on `/assets/*` (generated, and changes only when the generator
  runs), no cache on `/css/*` and `/js/*` (a cached `site.css` against a fresh
  `base.css` is a bug that reproduces only in somebody else's browser).
- Security headers, including a CSP. See the note below.

## 3 · Cloudflare Pages / Netlify

`_headers` covers both, and each host ignores the other's config file, so
`vercel.json` and `_headers` can live side by side.

**One thing neither reads from a file: clean URLs.**

- **Cloudflare Pages** does this by default — `/download` finds `download.html`.
- **Netlify** also does it by default (`Pretty URLs`), but confirm it is on.

Check it after the first deploy by visiting `/pipeline` directly. A
misconfigured host makes the links work and direct entry 404, which is the
version nobody notices.

## 4 · GitHub Pages

Works, with caveats: Pages has no clean-URL rewriting and no redirect rules,
so `/pipeline` and `/download` fall through to the HTML stubs — which is
exactly what they are for, but the bounce is a round trip rather than a 308.
`_headers`, `_redirects` and `vercel.json` are all ignored, so the security
headers and cache policy are lost as well. Put it behind Cloudflare if any of
that matters.

---

## The CSP, and the one thing that will break it

```
script-src 'self' 'unsafe-inline'
```

`'unsafe-inline'` is deliberate. The pre-paint build switch and the script
loader are inline in `<head>` **by design** — moving them to files reintroduces
the flash of the wrong layout they exist to prevent, which is the entire reason
they run before the first paint.

This is a static site with no forms, no user input and no backend, so there is
no injection path for a CSP to close here; it is defence in depth if the host
is ever compromised. If you later add a third-party script, a font host or an
embed, **it will be blocked silently** — no error, nothing rendered. Add the
origin to both `vercel.json` and `_headers` or it will work on one host and
not the other.

Everything the site currently loads from outside its own origin:

- `https://fonts.googleapis.com` — the stylesheet (`style-src`)
- `https://fonts.gstatic.com` — the font files (`font-src`)

Nothing else, and that is worth keeping: no CDN sits in the critical path of
anything on this page.

**The application captures are same-origin**, served from `/assets/app/`. If
they are ever moved to an image host, `img-src` has to name it in both files
or every screenshot on the page silently disappears.

## HSTS starts at one day

```
Strict-Transport-Security: max-age=86400
```

Not a year. HSTS is cached by the browser and **cannot be withdrawn early**:
ship `max-age=31536000` with a broken certificate and every visitor who loaded
the site once is locked out for a year. Raise it after HTTPS has been correct
for a week.

## After every deploy

1. Visit `/pipeline` and `/download` **by typing the address**. Both should
   redirect into the narrative page, not 404 and not serve a duplicate.
2. Visit `/nope`. You should get the 404 page, with a 404 status.
3. Paste the home page URL into Slack or iMessage and confirm the share card
   renders. A grey box means `og:image` is relative or points at the wrong
   domain.
4. Open the site on an actual phone. The emulator is right about layout and
   wrong about how the type feels.
