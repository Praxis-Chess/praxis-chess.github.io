#!/usr/bin/env python3
"""towebp.py - convert the raw application captures to shippable WebP.

    python tools/towebp.py

Run by tools/capture.js straight after it screenshots, so there is never a
moment where the repository holds the PNGs. It can also be run on its own if
captures were dropped in by hand.

WHY WEBP AND WHY THIS SIZE
The captures come off a 1440x900 viewport at deviceScaleFactor 2, so they
arrive at 2880x1800. The widest slot on the site renders at about 960 CSS
pixels, so 1920 wide is a full 2x for the largest use and a downsample
everywhere else; past that is bytes nobody can see.

PNG is the wrong container for a dark interface full of text. The seven
captures measured 10.7 MB as PNG and 0.6 MB as WebP at quality 88, with no
visible difference at the size any slot renders.
"""
import glob
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required: pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'app')
TARGET_W = 1920
QUALITY = 88

os.chdir(OUT)
before = after = 0
found = sorted(glob.glob('*.png'))
if not found:
    print('  no PNGs to convert')
for f in found:
    before += os.path.getsize(f)
    im = Image.open(f).convert('RGB')
    if im.width > TARGET_W:
        im = im.resize((TARGET_W, round(im.height * TARGET_W / im.width)),
                       Image.LANCZOS)
    dest = f[:-4] + '.webp'
    im.save(dest, 'WEBP', quality=QUALITY, method=6)
    os.remove(f)
    after += os.path.getsize(dest)
    print('  %-16s %6.0f KB' % (dest, os.path.getsize(dest) / 1024))
if found:
    print('  %.1f MB -> %.1f MB' % (before / 1048576, after / 1048576))
