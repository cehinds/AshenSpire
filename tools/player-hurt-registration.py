#!/usr/bin/env python3
"""Register each class's HURT outfit art onto its ready card figure.

DERIVED: writes src/content/playerHurtFrames.js. Never hand-edit that module;
rerun this script after the HURT art or a ready card frame changes.

Usage (from the repository root):
    python3 -I tools/player-hurt-registration.py [--cache .art-cache/hd-assets-v19]

For each class it reads the high-tier HURT image (512x512) and the class's
`ready` card frame (256x256, taken from src/content/alternativeCardAnimations.js),
finds the alpha bounding box of each (alpha >= 128), and solves for a draw
placement inside the stage's 512x512 body box so that:
  - the HURT figure's height equals the ready figure's height, and
  - the HURT figure's feet (bottom-centre of its alpha box) land on the ready
    figure's feet.
The emitted fields are drawn as
  ctx.drawImage(hurt, bodyLeft + dx, bodyTop + dy, 512 * scale, 512 * scale)
with bodyLeft/bodyTop the stage's body box origin (128, 16 in canvas units).
Light-tier HURT files share the same normalised geometry, so one placement
serves both tiers.
"""
import json
import os
import re
import sys
from PIL import Image

BODY = 512.0
ALPHA_THRESHOLD = 128
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'src', 'content', 'playerHurtFrames.js')
CATALOG = os.path.join(ROOT, 'src', 'content', 'alternativeCardAnimations.js')

# First candidate that exists in BOTH tiers wins (checked, not assumed).
HURT_CANDIDATES = {
    'reaver': ['animations/greatsword-outfits/reaver/HURT.webp'],
    'rogue': ['animations/twin-sword-outfits/rogue/HURT.webp',
              'animations/dagger-outfits/rogue/HURT.webp'],
    'herald': ['animations/unarmed/herald/HURT.webp'],
    'starseer': ['animations/unarmed-magic/starseer/HURT.webp',
                 'animations/unarmed/starseer/HURT.webp',
                 'animations/greatsword-outfits/starseer/HURT.webp'],
}


def alpha_box(path):
    """Alpha bounding box (left, top, right, bottom; right/bottom exclusive) and size."""
    image = Image.open(path).convert('RGBA')
    alpha = image.split()[-1].point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit('no opaque pixels in ' + path)
    return box, image.size


def placement(ready_box, ready_size, hurt_box, hurt_size):
    """Scale and offset that register the HURT figure onto the ready figure."""
    # Work in body-box units (the 512 box) so both tiers share one geometry.
    rx = BODY / ready_size[0]
    hx = BODY / hurt_size[0]
    ready = [v * rx for v in ready_box]
    hurt = [v * hx for v in hurt_box]
    ready_h = ready[3] - ready[1]
    hurt_h = hurt[3] - hurt[1]
    scale = ready_h / hurt_h
    ready_feet = ((ready[0] + ready[2]) / 2, ready[3])
    hurt_feet = ((hurt[0] + hurt[2]) / 2, hurt[3])
    dx = ready_feet[0] - scale * hurt_feet[0]
    dy = ready_feet[1] - scale * hurt_feet[1]
    return {'scale': scale, 'dx': dx, 'dy': dy,
            'ready': {'box': ready, 'height': ready_h, 'feet': ready_feet},
            'hurt': {'box': hurt, 'height': hurt_h, 'feet': hurt_feet}}


def ready_paths():
    text = open(CATALOG, encoding='utf-8').read()
    catalog = json.loads(re.sub(r'^[^{]*', '', text, count=1).rstrip().rstrip(';'))
    return {cls: data['frames']['ready']['path'] for cls, data in catalog['classes'].items()}


def main(argv):
    cache = os.path.join(ROOT, '.art-cache', 'hd-assets-v19')
    if '--cache' in argv:
        cache = os.path.abspath(argv[argv.index('--cache') + 1])
    ready = ready_paths()
    entries = []
    for cls in HURT_CANDIDATES:
        file = next((rel for rel in HURT_CANDIDATES[cls]
                     if all(os.path.exists(os.path.join(cache, tier, sub, rel))
                            for tier, sub in (('high', 'assets'), ('light', 'assets-mobile'))
                            )), None)
        if file is None:
            raise SystemExit('no HURT art for ' + cls + ' in both tiers')
        hurt_file = os.path.join(cache, 'high', 'assets', file)
        hurt_box, hurt_size = alpha_box(hurt_file)
        ready_file = os.path.join(ROOT, ready[cls])
        ready_box, ready_size = alpha_box(ready_file)
        p = placement(ready_box, ready_size, hurt_box, hurt_size)
        print(f"{cls}: file=assets/{file} scale={p['scale']:.4f} dx={p['dx']:.2f} dy={p['dy']:.2f} "
              f"ready_h={p['ready']['height']:.1f} hurt_h={p['hurt']['height']:.1f} "
              f"feet ready={p['ready']['feet']} hurt={p['hurt']['feet']}", file=sys.stderr)
        entries.append((cls, 'assets/' + file, p))
    lines = [
        '// DERIVED by tools/player-hurt-registration.py from the HURT outfit art and the',
        '// ready card frames. Do not edit by hand; rerun the script after either changes.',
        '// Draw: ctx.drawImage(hurt, 128 + dx, 16 + dy, 512 * scale, 512 * scale) in canvas units.',
        'export const playerHurtFrames = {',
    ]
    for cls, file, p in entries:
        lines.append(f'  {json.dumps(cls)}: {{ file: {json.dumps(file)}, scale: {p["scale"]:.4f}, '
                     f'dx: {p["dx"]:.2f}, dy: {p["dy"]:.2f} }},')
    lines += ['};', '']
    with open(OUT, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines))
    print('wrote', os.path.relpath(OUT, ROOT), file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1:])
