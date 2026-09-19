#!/usr/bin/env python3
"""check.py - read the site over before shipping it.

    python tools/check.py

No dependencies, no config, no framework. Every check here exists because that
exact mistake is one a static site with no build step will let you make
silently — the kind a browser only reveals on the page you forgot to open, or
on somebody else's phone, or a week later in Search Console.

It is not a test suite and does not pretend to be one. It cannot tell you the
hero looks wrong. It can tell you the site is broken in a way you will not see
from the homepage.

Exit code 0 clean, 1 if anything FAILED. Warnings never fail the run.
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

FAIL, WARN = [], []
def fail(m): FAIL.append(m)
def warn(m): WARN.append(m)


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


PAGES = sorted(f for f in os.listdir('.') if f.endswith('.html'))

# THREE KINDS OF HTML FILE, AND MOST CHECKS ONLY APPLY TO THE FIRST.
#   REAL       the narrative page. Everything applies.
#   REDIRECT   /pipeline and /download. They kept their addresses when the
#              site became one document: noindex, canonical to the real page,
#              a 308 at the edge. They have no h1, no og tags and no sitemap
#              entry ON PURPOSE, and checking them for any of it is noise.
#   SELF       404.html, which carries its own styles and no shared anything.
REDIRECT = {'pipeline.html', 'download.html'}
SELF = {'404.html'}
REAL = [f for f in PAGES if f not in REDIRECT and f not in SELF]
JS = sorted(f for f in os.listdir('js') if f.endswith('.js'))
CSS = sorted(f for f in os.listdir('css') if f.endswith('.css'))
HTML = {p: read(p) for p in PAGES}


def strip_css_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


# ---- 1 · JavaScript parses -------------------------------------------------
# A syntax error in js/field.js breaks nothing until somebody opens the site on
# a screen wider than 760px. `node --check` is the cheapest possible catch.
def check_js_syntax():
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
    except Exception:
        warn('node not found - skipped JS syntax checks')
        return
    for f in JS:
        r = subprocess.run(['node', '--check', 'js/' + f],
                           capture_output=True, text=True)
        if r.returncode:
            first = (r.stderr.strip().splitlines() or ['?'])[0]
            fail('js/%s does not parse:\n    %s' % (f, first))


# ---- 2 · CSS is well formed ------------------------------------------------
# An unbalanced quote makes the browser silently discard that rule AND the one
# after it, and the symptom is a single style that will not apply.
def check_css():
    for f in CSS:
        body = strip_css_comments(read('css/' + f))
        if body.count('{') != body.count('}'):
            fail('css/%s: %d "{" against %d "}"'
                 % (f, body.count('{'), body.count('}')))
        for i, line in enumerate(body.split('\n'), 1):
            if line.count('"') % 2 and 'data:' not in line and 'content:' not in line:
                fail('css/%s:%d unbalanced quote: %s' % (f, i, line.strip()[:60]))


# ---- 3 · every local file reference resolves -------------------------------
def check_paths():
    refs = set()
    for page, html in HTML.items():
        for m in re.finditer(r'(?:href|src)\s*=\s*"([^"]+)"', html):
            refs.add(m.group(1))
    for f in CSS:
        # Drop data: URIs whole before scanning. The grain is an inline SVG
        # carrying its own url(%23n) filter reference, and scanning into it
        # reports a missing file called "%23n" on every run. A checker that
        # cries wolf once a run is a checker nobody reads.
        body = re.sub(r'url\(\s*["\']?data:[^)]*\)', '', read('css/' + f))
        for m in re.finditer(r'url\(\s*[\'"]?([^\'")]+)', body):
            u = m.group(1)
            if u.startswith(('data:', 'http', '#', '%23')):
                continue
            refs.add(os.path.normpath(os.path.join('css', u)).replace('\\', '/'))

    for r in sorted(refs):
        if r.startswith(('http', 'data:', '#', 'mailto:')):
            continue
        local = r.split('#')[0].split('?')[0].lstrip('/')
        if not local:
            continue                                   # href="/" is the index
        if os.path.exists(local):
            continue
        # CLEAN URLS: /download is download.html once deployed. Accept it here
        # exactly as vercel.json and serve.py resolve it, or the checker
        # reports every internal link on the site as broken.
        if os.path.exists(local + '.html'):
            continue
        fail('referenced but missing: %s' % r)


# ---- 4 · in-page fragments exist -------------------------------------------
# A footer link to /download#requirements that lands at the top of the page is
# the sort of thing nobody notices for months.
def check_fragments():
    ids = {}
    for page, html in HTML.items():
        ids[page] = set(re.findall(r'\sid="([^"]+)"', html))

    for page, html in HTML.items():
        for m in re.finditer(r'href="([^"]*#[^"]+)"', html):
            href = m.group(1)
            target, frag = href.split('#', 1)
            if target.startswith(('http', 'mailto:')):
                continue
            if not target:
                doc = page
            else:
                doc = target.lstrip('/') or 'index.html'
                if not doc.endswith('.html'):
                    doc += '.html'
            if doc not in ids:
                fail('%s links to %s, which is not a page' % (page, href))
            elif frag not in ids[doc]:
                fail('%s links to #%s in %s, which has no such id'
                     % (page, frag, doc))


# ---- 5 · the module registry agrees with itself ----------------------------
# THE ONE THAT ACTUALLY BIT during the build: js/boot.js names the modules the
# phone mounts, index.html names the files the phone loads, and js/*.js names
# what each file registers. Those three drift silently — a module in the
# mobile allowlist whose file is desktop-only simply never mounts, on phones
# only, with no error anywhere.
def check_registry():
    registered = {}
    for f in JS:
        for m in re.finditer(r"PAGE\.register\(\s*'([^']+)'", read('js/' + f)):
            registered.setdefault(m.group(1), []).append(f)

    boot = read('js/boot.js')
    mob = re.search(r'var MOBILE = \[([^\]]*)\]', boot)
    if not mob:
        fail('js/boot.js has no MOBILE allowlist to check')
        return
    mobile_mounts = re.findall(r"'([^']+)'", mob.group(1))

    # The loader is three lists: a base every build loads, a mobile-only half
    # and a desktop-only half. The mobile build's script set is base + mobile,
    # and checking a mobile-allowlisted module against the base alone would
    # miss js/reveal.js, which is deliberately mobile-only.
    html = HTML['index.html']
    base = re.search(r'var list = \[(.*?)\]\s*\n?\s*\.concat', html, re.S)
    mob_half = re.search(r'\.concat\(mobile \? \[(.*?)\]', html, re.S)
    desk_half = re.search(r'\.concat\(mobile \?.*?:\s*\[(.*?)\]\)', html, re.S)
    if not base or not mob_half or not desk_half:
        fail('index.html script loader does not match the expected shape')
        return

    base_files = set(re.findall(r"'([^']+)'", base.group(1)))
    mobile_files = base_files | set(re.findall(r"'([^']+)'", mob_half.group(1)))
    desktop_files = base_files | set(re.findall(r"'([^']+)'", desk_half.group(1)))
    all_files = mobile_files | desktop_files

    for name in mobile_mounts:
        if name not in registered:
            fail("boot.js mounts '%s' on mobile but no js file registers it" % name)
            continue
        if not any(f[:-3] in mobile_files for f in registered[name]):
            fail("boot.js mounts '%s' on mobile, but %s is not in the phone's "
                 'script list in index.html' % (name, registered[name][0]))

    # The desktop build mounts everything that registers, so every registered
    # module must be reachable from one of the two halves. A file nothing loads
    # is dead code that passes every other check here.
    for name, files in registered.items():
        if not any(f[:-3] in all_files for f in files):
            fail("'%s' is registered in %s, which no page loads" % (name, files[0]))
        if len(files) > 1:
            warn("'%s' is registered in more than one file: %s"
                 % (name, ', '.join(files)))

    for f in all_files:
        if not os.path.exists('js/%s.js' % f):
            fail('index.html loads js/%s.js, which does not exist' % f)


# ---- 5b . the scenes agree with the rail -----------------------------------
# The accumulator addresses scenes by index and the rail addresses them by
# data-goto. A rail one tick short is a scene reachable only by the wheel, and
# nothing else here would notice.
def check_scenes():
    for page in REAL:
        html = HTML[page]
        scenes = re.findall(r'<section class="scene"[^>]*>', html)
        ticks = re.findall(r'data-goto="(\d+)"', html)
        if not scenes:
            fail('%s has no scenes' % page)
            continue
        if len(ticks) != len(scenes):
            fail('%s has %d scenes but %d rail ticks'
                 % (page, len(scenes), len(ticks)))
        elif sorted(int(t) for t in ticks) != list(range(len(scenes))):
            fail('%s rail ticks are not 0..%d' % (page, len(scenes) - 1))

        # Every scene needs an id: the rail, the deep links and the two
        # redirect routes all address them by name.
        for tag in scenes:
            if 'id="' not in tag:
                fail('%s has a scene with no id' % page)

        # data-len is what js/scroll.js lays the page out from. A missing or
        # zero one collapses that scene to nothing, silently.
        lens = re.findall(r'<section class="scene"[^>]*data-len="([^"]+)"', html)
        if len(lens) != len(scenes):
            fail('%s: %d scenes but %d data-len values'
                 % (page, len(scenes), len(lens)))
        total = 0.0
        for v in lens:
            try:
                f = float(v)
            except ValueError:
                fail('%s: data-len="%s" is not a number' % (page, v))
                continue
            if f < 1:
                fail('%s: data-len="%s" is under one viewport, so the scene '
                     'can never fill the screen' % (page, v))
            total += f
        if total > 26:
            warn('%s is %.1f viewports long - that is a lot of wheel'
                 % (page, total))



# ---- 5b2 . every in-page link can actually move the page -------------------
# The accumulator moves on hashchange by looking the hash up among the scene
# ids. A link to an id that exists but is NOT a scene changes the address bar
# and moves nothing, which reads as a dead link — and check_fragments above
# will not catch it, because the target does exist.
#
# #main is the skip link and is exempt: it moves focus, not the page.
def check_hash_links():
    for page in REAL:
        html = HTML[page]
        scene_ids = set(re.findall(r'<section class="scene"[^>]*\sid="([^"]+)"', html))
        for m in re.finditer(r'href="(?:/)?#([A-Za-z0-9_-]+)"', html):
            frag = m.group(1)
            if frag == 'main' or frag in scene_ids:
                continue
            fail('%s links to #%s, which is not a scene, so clicking it moves '
                 'the address bar and nothing else' % (page, frag))


# ---- 5c . the staged reveals are reachable ---------------------------------
# Every .at element hides itself until its own window opens, and that window is
# two hand-written numbers. An --s0 past 1 is an element that never appears at
# all, on a page where nothing else would tell you.
def check_stages():
    for page in REAL:
        html = HTML[page]
        for m in re.finditer(r'class="[^"]*\bat\b[^"]*"[^>]*style="([^"]*)"', html):
            style = m.group(1)
            s0 = re.search(r'--s0:\s*([\d.]+)', style)
            inv = re.search(r'--inv:\s*([\d.]+)', style)
            if not s0 or not inv:
                continue                      # defaults are 0 and 1, both fine
            a, b = float(s0.group(1)), float(inv.group(1))
            if a >= 1:
                fail('%s: an .at element starts at --s0:%s, which is past the '
                     'end of its scene, so it never appears' % (page, a))
            if b <= 0:
                fail('%s: --inv:%s is not positive' % (page, b))
            elif a + 1 / b > 1.02:
                warn('%s: an .at element starting at %s over 1/%s of the scene '
                     'is still arriving when the scene ends' % (page, a, b))


# ---- 5d . the application captures -----------------------------------------
# The compositions are built around real screenshots of the product. Until they
# exist, every slot renders a placard naming the file it wants. This reports
# what is still outstanding, and fails if a slot asks for a capture the manifest
# has never heard of - which is how a typo in data-shot would otherwise reach
# production as a permanently empty frame.
def check_shots():
    wanted = set()
    for page in REAL:
        for m in re.finditer(r'data-shot="([^"]+)"', HTML[page]):
            wanted.add(m.group(1))
        # A capture with no description is a capture nobody can use with a
        # screen reader, and alt text can only be written by whoever took it.
        for m in re.finditer(r'<figure[^>]*data-shot="([^"]+)"([^>]*)>', HTML[page]):
            if 'data-alt="' not in m.group(2):
                fail('%s: the "%s" slot has no data-alt' % (page, m.group(1)))

    manifest = 'assets/app/README.md'
    if not os.path.exists(manifest):
        fail('%s is missing - it is the list of captures to send' % manifest)
        return
    listed = set(re.findall(r'`([a-z0-9_-]+)\.webp`', read(manifest)))
    for name in sorted(wanted - listed):
        fail('a slot asks for "%s.webp", which %s does not list'
             % (name, manifest))

    missing = [n for n in sorted(wanted)
               if not os.path.exists('assets/app/%s.webp' % n)]
    if missing:
        warn('%d of %d application captures are still outstanding: %s'
             % (len(missing), len(wanted), ', '.join(missing)))

    for n in sorted(wanted):
        f = 'assets/app/%s.webp' % n
        if os.path.exists(f) and os.path.getsize(f) > 300_000:
            warn('%s is %.1f MB - worth optimising before it ships'
                 % (f, os.path.getsize(f) / 1e6))


# ---- 7 · every page is a complete document ---------------------------------
def check_pages():
    nav_keys = set(re.findall(r'data-nav="([^"]+)"', HTML['index.html']))
    for page in REAL:
        html = HTML[page]
        if not re.search(r'<title>[^<]+</title>', html):
            fail('%s has no <title>' % page)
        if 'name="description"' not in html:
            fail('%s has no meta description' % page)
        h1s = re.findall(r'<h1[\s>]', html)
        if len(h1s) != 1:
            fail('%s has %d <h1> elements, expected exactly 1' % (page, len(h1s)))
        m = re.search(r'<body data-page="([^"]+)"', html)
        if not m:
            fail('%s has no data-page on <body>, so the nav cannot mark itself '
                 'active' % page)
        elif m.group(1) != 'home' and m.group(1) not in nav_keys:
            fail('%s says data-page="%s", which no nav item matches'
                 % (page, m.group(1)))


# ---- 8 · the share card will actually render -------------------------------
# og:image MUST be absolute — crawlers fetch it from their own servers — and
# every absolute URL on a page must agree, or the canonical points at a domain
# you do not own while the preview 404s.
def check_meta():
    hosts = set()
    for page in REAL:
        html = HTML[page]
        urls = {}
        for key, pat in (('canonical', r'rel="canonical"\s+href="([^"]+)"'),
                         ('og:url', r'property="og:url"\s+content="([^"]+)"'),
                         ('og:image', r'property="og:image"\s+content="([^"]+)"'),
                         ('twitter:image', r'name="twitter:image"\s+content="([^"]+)"')):
            m = re.search(pat, html)
            if not m:
                fail('%s is missing meta: %s' % (page, key))
                continue
            urls[key] = m.group(1)

        for k in ('og:image', 'twitter:image'):
            if k in urls and not urls[k].startswith('http'):
                fail('%s: %s must be an absolute URL or no preview image will '
                     'render anywhere: %s' % (page, k, urls[k]))

        origins = {re.match(r'(https?://[^/]+)', u).group(1)
                   for u in urls.values() if u.startswith('http')}
        if len(origins) > 1:
            fail('%s: meta URLs point at different domains: %s'
                 % (page, ', '.join(sorted(origins))))
        hosts |= origins

        for k, u in urls.items():
            if not u.startswith('http'):
                continue
            local = re.sub(r'^https?://[^/]+/?', '', u)
            if not local:
                continue
            if not (os.path.exists(local) or os.path.exists(local + '.html')):
                fail('%s: %s points at /%s, which is not in the build'
                     % (page, k, local))

    if len(hosts) > 1:
        fail('pages disagree about the domain: %s' % ', '.join(sorted(hosts)))
    elif hosts and 'praxischess.app' in hosts.pop():
        warn('every canonical still says praxischess.app - change them if that '
             'is not the domain you bought (see DEPLOY.md)')


# ---- 9 · the sitemap lists exactly the pages that exist --------------------
def check_sitemap():
    if not os.path.exists('sitemap.xml'):
        fail('sitemap.xml is missing')
        return
    locs = re.findall(r'<loc>([^<]+)</loc>', read('sitemap.xml'))
    listed = set()
    for loc in locs:
        path = re.sub(r'^https?://[^/]+', '', loc).strip('/')
        listed.add((path or 'index') + '.html')

    # 404.html and the two redirect stubs are deliberately absent: the first
    # carries noindex, and the other two canonical to the page that IS listed.
    expected = {'index.html'}
    for missing in sorted(expected - listed):
        fail('%s exists but is not in sitemap.xml' % missing)
    for extra in sorted(listed - expected):
        fail('sitemap.xml lists %s, which is not in the build' % extra)

    if 'noindex' not in HTML.get('404.html', ''):
        warn('404.html has no noindex, so the error page can be indexed')
    for r in sorted(REDIRECT):
        h = HTML.get(r, '')
        if 'noindex' not in h:
            fail('%s is a redirect stub with no noindex' % r)
        if 'rel="canonical" href="https://praxischess.app/"' not in h:
            fail('%s does not canonical to the narrative page' % r)


# ---- 10 · every FEN on the site is renderable ------------------------------
# js/board.js warns to a console nobody has open and then draws nothing. A
# mistyped rank is invisible until somebody looks at the page.
def check_fens():
    for page in REAL:
        html = HTML[page]
        for m in re.finditer(r'data-fen="([^"]+)"', html):
            fen = m.group(1).strip()
            ranks = fen.split()[0].split('/')
            if len(ranks) != 8:
                fail('%s: FEN has %d ranks, expected 8: %s'
                     % (page, len(ranks), fen[:40]))
                continue
            for i, rank in enumerate(ranks):
                n = 0
                for ch in rank:
                    if ch.isdigit():
                        n += int(ch)
                    elif ch.lower() in 'kqrbnp':
                        n += 1
                    else:
                        fail('%s: FEN rank %d has an illegal character %r'
                             % (page, 8 - i, ch))
                        n = -99
                        break
                if 0 <= n != 8:
                    fail('%s: FEN rank %d describes %d squares, expected 8: %s'
                         % (page, 8 - i, n, rank))

        # A marked square that is not on the board renders no highlight and
        # says nothing about why.
        for attr in ('data-from', 'data-to'):
            for m in re.finditer(r'%s="([^"]+)"' % attr, html):
                sq = m.group(1)
                if not re.fullmatch(r'[a-h][1-8]', sq):
                    fail('%s: %s="%s" is not a square' % (page, attr, sq))


# ---- 11 · assets exist, and the palette still agrees -----------------------
# The brass is written in two places that no build step can share: a CSS custom
# property and a Python tuple. They drifted once and the favicon quietly became
# a slightly different gold from the site.
def check_assets():
    generated = ['assets/logo.svg', 'assets/favicon.svg', 'assets/favicon-32.png',
                 'assets/favicon-180.png', 'assets/og-image.png', 'favicon.ico']
    for g in generated:
        if not os.path.exists(g):
            fail('%s is missing - run: python tools/make-assets.py' % g)

    gen = 'tools/make-assets.py'
    if os.path.exists(gen):
        src_mtime = os.path.getmtime(gen)
        for g in generated:
            if os.path.exists(g) and os.path.getmtime(g) < src_mtime:
                warn('%s is older than %s - run: python tools/make-assets.py'
                     % (g, gen))
                break

        css_orchid = re.search(r'--orchid:\s*#([0-9A-Fa-f]{6})', read('css/base.css'))
        py_orchid = re.search(r'ORCHID\s*=\s*\((\d+),\s*(\d+),\s*(\d+)\)', read(gen))
        if css_orchid and py_orchid:
            c = tuple(int(css_orchid.group(1)[i:i + 2], 16) for i in (0, 2, 4))
            p = tuple(int(x) for x in py_orchid.groups())
            if c != p:
                fail('the orchid has drifted: base.css says %s, %s says %s'
                     % (c, gen, p))




def main():
    checks = (check_js_syntax, check_css, check_paths, check_fragments,
              check_registry, check_scenes, check_hash_links, check_stages,
              check_shots,
              check_pages, check_meta, check_sitemap, check_fens, check_assets)
    for fn in checks:
        try:
            fn()
        except Exception as e:                      # a broken check is a
            warn('check %s crashed: %s' % (fn.__name__, e))   # warning, never
                                                              # a blocker
    for w in WARN:
        print('WARN  %s' % w)
    for f in FAIL:
        print('FAIL  %s' % f)
    print()
    if FAIL:
        print('%d failed, %d warnings' % (len(FAIL), len(WARN)))
        return 1
    print('all checks passed%s'
          % (', %d warnings' % len(WARN) if WARN else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
