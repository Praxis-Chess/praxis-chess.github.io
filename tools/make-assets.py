#!/usr/bin/env python3
"""make-assets.py - generate every image the site ships.

    python tools/make-assets.py

Writes:
    assets/logo.svg          the mark, vector, for the header and footer
    assets/favicon.svg       the mark on its ground, sized for a tab
    assets/favicon-32.png    PNG fallback (Safari, older Android)
    assets/favicon-180.png   apple-touch-icon
    favicon.ico              the root file crawlers request regardless
    assets/og-image.png      1200x630 share card

assets/ IS GENERATED. Do not hand-edit: edit this file and re-run.

THE MARK IS NOT A DESIGN DECISION MADE HERE.
It is the Praxis Chess application's own logo, at
frontend/public/praxis_logo.png - a circle, a bar, and a triangle, in orchid.
That file is 88x79 and was going to be soft at 180px, so the geometry below is
a trace of it rather than a resize: measured off the source pixel rows, to the
half pixel, so the vector and the app's raster are the same object.

  circle    rows  3..40, x 25..62   -> centre (43.5, 21.75), r 19
  bar       rows 41..59, x  3..84   -> rect   (3, 41) 82 x 19
  triangle  rows 60..76             -> apex   (43.5, 59.5), base 30.5..56.5

If the app's logo changes, re-trace it; do not redraw it from memory.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
os.makedirs('assets', exist_ok=True)

# ---- the palette, in two encodings -----------------------------------------
# These must agree with css/base.css, which in turn copies the application's
# frontend/src/index.css. There is no build step that can share a constant
# between CSS and Python, so tools/check.py reads --orchid out of base.css and
# compares it with ORCHID here.
CANVAS = (18, 17, 16)
CANVAS_DEEP = (12, 11, 10)
TEXT_PRIMARY = (242, 237, 234)
TEXT_SECONDARY = (162, 155, 150)
TEXT_TERTIARY = (109, 102, 98)
ORCHID = (231, 166, 214)
MAUVE_DEEP = (176, 103, 159)

hexs = lambda c: '#%02X%02X%02X' % c

# ---- the traced mark, in its own 88x79 coordinate space --------------------
MARK_W, MARK_H = 88.0, 79.0
CIRCLE = (43.5, 21.75, 19.0)          # cx, cy, r
BAR = (3.0, 41.0, 82.0, 19.0)         # x, y, w, h
TRI = ((43.5, 59.5), (30.5, 76.5), (56.5, 76.5))


def mark_paths(colour):
    """The three shapes, as SVG elements in the mark's own coordinates."""
    cx, cy, r = CIRCLE
    bx, by, bw, bh = BAR
    (ax, ay), (lx, ly), (rx, ry) = TRI
    return (
        '<circle cx="%.2f" cy="%.2f" r="%.2f" fill="%s"/>' % (cx, cy, r, colour) +
        '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s"/>'
        % (bx, by, bw, bh, colour) +
        '<path d="M%.2f %.2f L%.2f %.2f L%.2f %.2f Z" fill="%s"/>'
        % (ax, ay, lx, ly, rx, ry, colour)
    )


def write_svgs():
    # The bare mark, transparent, for the header. Sized by CSS.
    with open('assets/logo.svg', 'w', encoding='utf-8') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" '
                'role="img" aria-label="Praxis">%s</svg>\n'
                % (MARK_W, MARK_H, mark_paths(hexs(ORCHID))))

    # The tab icon needs a ground: a transparent mark on a browser's own light
    # tab strip is an orchid shape on white, which is the one place this
    # palette has no contrast at all.
    pad = 14.0
    box = MARK_W + pad * 2
    inner = 'transform="translate(%.2f %.2f)"' % (pad, pad + (MARK_W - MARK_H) / 2)
    with open('assets/favicon.svg', 'w', encoding='utf-8') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g">'
                '<rect width="%g" height="%g" rx="14" fill="%s"/>'
                '<g %s>%s</g></svg>\n'
                % (box, box, box, box, hexs(CANVAS_DEEP), inner,
                   mark_paths(hexs(ORCHID))))
    print('  assets/logo.svg')
    print('  assets/favicon.svg')


# ============================================================================
# RASTER
# ============================================================================
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None


def draw_mark(img, box, colour=ORCHID, supersample=4):
    """The same three shapes, rasterised into `box` = (x, y, w, h).

    Drawn at 4x and reduced: Pillow does not antialias shape edges, and a
    hard-edged circle at 32px next to a crisp SVG in the same tab strip looks
    like a rendering fault.
    """
    x, y, w, h = box
    S = supersample
    big = Image.new('RGBA', (int(w * S), int(h * S)), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    sx, sy = w * S / MARK_W, h * S / MARK_H

    cx, cy, r = CIRCLE
    d.ellipse([(cx - r) * sx, (cy - r) * sy, (cx + r) * sx, (cy + r) * sy],
              fill=colour + (255,))
    bx, by, bw, bh = BAR
    d.rectangle([bx * sx, by * sy, (bx + bw) * sx, (by + bh) * sy],
                fill=colour + (255,))
    d.polygon([(p[0] * sx, p[1] * sy) for p in TRI], fill=colour + (255,))

    img.alpha_composite(big.resize((int(w), int(h)), Image.LANCZOS),
                        (int(x), int(y)))


def icon(px):
    """A square tab icon: the mark, padded, on the deep canvas."""
    img = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = max(2, int(px * 0.16))
    d.rounded_rectangle([0, 0, px - 1, px - 1], radius=radius,
                        fill=CANVAS_DEEP + (255,))
    # The mark keeps its own aspect ratio inside the padded square.
    pad = px * 0.17
    avail = px - pad * 2
    w = avail
    h = avail * (MARK_H / MARK_W)
    draw_mark(img, (pad, (px - h) / 2, w, h))
    return img


def write_favicons():
    for px in (32, 180):
        icon(px).save('assets/favicon-%d.png' % px)
        print('  assets/favicon-%d.png' % px)

    # /favicon.ico AT THE ROOT, AND NOT IN assets/. The pages declare an SVG
    # icon and two PNGs, and a current browser uses those. Plenty of other
    # things do not read the markup at all and simply GET /favicon.ico:
    # crawlers, feed readers, link unfurlers, anything restoring a bookmark.
    # Without the file every one of those is a 404 in the access log, which is
    # noise in the exact place you go looking for real errors.
    icon(48).save('favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    print('  favicon.ico')


# ---- fonts -----------------------------------------------------------------
# The site's real face is a webfont and is not installed anywhere, so the card
# uses the nearest grotesk on the machine and degrades to a plainer card rather
# than failing the build on a missing font.
SANS_BOLD = ['segoeuib.ttf', 'Arialbd.ttf', 'arialbd.ttf', 'Inter-Bold.ttf',
             '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
SANS = ['segoeui.ttf', 'Arial.ttf', 'arial.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
MONO = ['consola.ttf', 'Consolas.ttf', 'cour.ttf',
        '/System/Library/Fonts/Menlo.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf']

WINFONTS = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts')


def load(candidates, size):
    for name in candidates:
        for path in (name, os.path.join(WINFONTS, name)):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return None


def write_og():
    W, H = 1200, 630
    img = Image.new('RGBA', (W, H), CANVAS + (255,))
    d = ImageDraw.Draw(img)

    # ---- the board, cropped ----------------------------------------------
    # This used to be a point-cloud sphere standing in for the Prax organism.
    # The organism has been removed from the site, so the card speaks the same
    # visual language the page does: a board, cropped by the frame, in the
    # application's own square colours, with a single square marked.
    #
    # It fades out toward the type rather than stopping at a hard edge, so the
    # left half stays quiet enough to read.
    board_x, board_y, cell = 612, -46, 96
    light = (52, 47, 45)          # --board-dark, lifted so it reads on canvas
    dark = (30, 27, 26)
    for row in range(-1, (H - board_y) // cell + 2):
        for col in range((W - board_x) // cell + 2):
            x = board_x + col * cell
            y = board_y + row * cell
            if y + cell < 0:
                continue
            # Horizontal falloff: nothing at the left edge, full at the right.
            t = max(0.0, min(1.0, (x - board_x) / float(W - board_x)))
            a = int(235 * (0.10 + 0.90 * t))
            fill = light if (row + col) % 2 else dark
            d.rectangle((x, y, x + cell - 3, y + cell - 3), fill=fill + (a,))

    # The one marked square. Same device as the 404 page and the same meaning
    # as everywhere else on the site: this is the move that mattered.
    mx, my = board_x + cell * 4, board_y + cell * 4
    d.rectangle((mx, my, mx + cell - 3, my + cell - 3), fill=ORCHID + (58,))
    d.rectangle((mx, my, mx + cell - 3, my + cell - 3), outline=ORCHID + (210,),
                width=3)

    # ---- the type --------------------------------------------------------
    f_head = load(SANS_BOLD, 54)
    f_sub = load(SANS, 27)
    f_mono = load(MONO, 20)

    draw_mark(img, (72, 74, 64, 64 * (MARK_H / MARK_W)))

    if f_mono:
        d.text((152, 78), 'PRAXIS CHESS', font=f_mono, fill=TEXT_PRIMARY + (255,))
        d.text((152, 104), 'LOCAL-FIRST GAME ANALYSIS', font=f_mono,
               fill=TEXT_TERTIARY + (255,))

    y = 250
    for line, colour in (('The engine finds', TEXT_PRIMARY),
                         ('the move.', TEXT_PRIMARY),
                         ('Praxis finds the pattern.', ORCHID)):
        if f_head:
            d.text((72, y), line, font=f_head, fill=colour + (255,))
            y += 66
        else:
            d.text((72, y), line, fill=colour + (255,))
            y += 34

    if f_sub:
        d.text((72, y + 18), 'Every game you have played, read back to you.',
               font=f_sub, fill=TEXT_SECONDARY + (255,))

    # The orchid rule, and the domain.
    d.rectangle([72, H - 92, 72 + 88, H - 89], fill=ORCHID + (255,))
    if f_mono:
        d.text((72, H - 68), 'PRAXISCHESS.APP', font=f_mono,
               fill=TEXT_TERTIARY + (255,))

    img.convert('RGB').save('assets/og-image.png', optimize=True)
    print('  assets/og-image.png  (%dx%d)' % (W, H))


def main():
    print('praxis chess / assets')
    write_svgs()
    if Image is None:
        print('\n  Pillow is not installed, so the PNGs were skipped.')
        print('  pip install pillow, then run this again.')
        return 1
    write_favicons()
    write_og()

    # The invented brass-era mark, if it is still lying around.
    for stale in ('assets/mark.svg',):
        if os.path.exists(stale):
            os.remove(stale)
            print('  removed %s (superseded by assets/logo.svg)' % stale)

    print('\ndone.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
