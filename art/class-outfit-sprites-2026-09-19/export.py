"""Normalize generated 4x2 atlases with one scale and bottom-center anchor."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
NAMES = ['idle', 'guard', 'windup', 'impact', 'recover', 'cast', 'hit', 'defeated']
ALIASES = {
    'idle': 'idle', 'guard': 'guard', 'attack1': 'windup', 'attack2': 'impact',
    'attack3': 'recover', 'attack4': 'idle', 'hit': 'hit',
    'power1': 'guard', 'power2': 'cast', 'power3': 'cast',
    'shieldGuard1': 'recover', 'shieldGuard2': 'guard', 'shieldGuard3': 'guard',
    'parry1': 'guard', 'parry2': 'impact', 'parry3': 'recover',
    'shieldBash1': 'guard', 'shieldBash2': 'impact', 'shieldBash3': 'recover',
    'prepared': 'guard', 'preparedTransition': 'recover',
    'starstoneCharge': 'cast', 'starstoneChargeTransition': 'guard',
    'bloodRite': 'cast', 'bloodRiteTransition': 'guard',
}

def split_figures(source):
    """Follow alpha components so a sword crossing a grid line is not sliced."""
    alpha = np.asarray(source.getchannel('A'))
    parents, runs, previous = [], [], []
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for y, row in enumerate(alpha):
        edges = np.flatnonzero(np.diff(np.pad((row > 128).astype(np.int8), (1, 1))))
        current = []
        for x0, x1 in zip(edges[::2], edges[1::2]):
            index = len(parents)
            parents.append(index)
            runs.append((y, int(x0), int(x1), index))
            for p0, p1, parent in previous:
                if p1 >= x0 and p0 <= x1:
                    parents[root(parent)] = root(index)
            current.append((x0, x1, index))
        previous = current
    groups = {}
    for y, x0, x1, index in runs:
        groups.setdefault(root(index), []).append((y, x0, x1))
    ranked = sorted(groups.values(), key=lambda rows: sum(b-a for _, a, b in rows), reverse=True)
    bodies = ranked[:8]
    assert len(bodies) == 8
    def center(rows):
        area = sum(b-a for _, a, b in rows)
        return (sum((a+b)/2*(b-a) for _, a, b in rows)/area,
                sum(y*(b-a) for y, a, b in rows)/area)
    bodies.sort(key=lambda rows: (int(center(rows)[1] >= source.height/2), center(rows)[0]))
    centers = [center(rows) for rows in bodies]
    for rows in ranked[8:]:
        x, y = center(rows)
        nearest = min(range(8), key=lambda i: (centers[i][0]-x)**2 + (centers[i][1]-y)**2)
        bodies[nearest].extend(rows)
    crops = []
    for i, rows in enumerate(bodies):
        x, y = center(rows)
        assert int(x * 4 / source.width) == i % 4 and int(y * 2 / source.height) == i // 4, 'Atlas poses overlap or are missing'
        left, right = max(0, min(a for _, a, _ in rows)-3), min(source.width, max(b for _, _, b in rows)+3)
        top, bottom = max(0, min(y for y, _, _ in rows)-3), min(source.height, max(y for y, _, _ in rows)+4)
        mask = np.zeros((bottom-top, right-left), dtype=np.uint8)
        for y, a, b in rows:
            mask[y-top, a-left:b-left] = 255
        frame = source.crop((left, top, right, bottom))
        # Grow the ownership mask to retain the original antialiased edge.
        frame.putalpha(ImageChops.multiply(Image.fromarray(mask).filter(ImageFilter.MaxFilter(7)), frame.getchannel('A')))
        crops.append(frame.crop(frame.getchannel('A').getbbox()))
    return crops

def export():
    jobs = json.loads((HERE / 'prompts.json').read_text(encoding='utf-8'))['jobs']
    manifest = {}
    review = Image.new('RGB', (1600, 1600), '#161918')
    draw = ImageDraw.Draw(review)
    for number, job in enumerate(jobs):
        key = job['id']
        print(f'Exporting {key}', flush=True)
        source = Image.open(HERE / 'sources' / f'{key}.png').convert('RGBA')
        assert source.getchannel('A').getextrema()[0] == 0, f'{key}: missing alpha'
        crops = split_figures(source)
        scale = min(560 / max(im.height for im in crops), 580 / max(im.width for im in crops))
        folder = ROOT / 'assets' / 'painted-outfits' / f'shared-{key}'
        folder.mkdir(parents=True, exist_ok=True)
        frames = {}
        for name, crop in zip(NAMES, crops):
            resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
            frame = Image.new('RGBA', (640, 640))
            frame.alpha_composite(resized, (320 - resized.width // 2, 600 - resized.height))
            frame.save(folder / f'{name}.webp', quality=90, method=4)
            x0, y0, x1, y1 = frame.getchannel('A').getbbox()
            frames[name] = {'file': (folder / f'{name}.webp').relative_to(ROOT).as_posix(),
                            'box': {'x0': x0, 'y0': y0, 'x1': x1 - 1, 'y1': y1 - 1}}
        # Menu and defeat are trimmed, unlike stage frames, which retain their anchor.
        for name, crop in [('menu', crops[0]), ('down', crops[7])]:
            crop.save(folder / f'{name}.webp', quality=92, method=4)
        menu = (folder / 'menu.webp').relative_to(ROOT).as_posix()
        manifest[key] = {
            'classId': job['classId'], 'outfitId': job['outfitId'], 'sharedSet': True,
            'menu': {'stand': menu, 'detail': menu, 'portrait': menu},
            'frames': {alias: frames[name] for alias, name in ALIASES.items()},
            'readiness': {},
            'defeated': {'file': (folder / 'down.webp').relative_to(ROOT).as_posix(),
                         'scale': crops[7].height / crops[0].height},
        }
        thumb = crops[0].copy()
        thumb.thumbnail((345, 340), Image.Resampling.LANCZOS)
        tx, ty = number % 4 * 400, number // 4 * 400
        review.paste(thumb, (tx + (400 - thumb.width) // 2, ty + 350 - thumb.height), thumb)
        draw.text((tx + 12, ty + 365), key, fill='#e5cd9a')
    (HERE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'src/content/sharedOutfitArt.js').write_text(
        '// Generated by art/class-outfit-sprites-2026-09-19/export.py.\n'
        + 'export const SHARED_OUTFIT_ART = Object.freeze(' + json.dumps(manifest, indent=2) + ');\n', encoding='utf-8')
    review.save(HERE / 'preview.jpg', quality=92)
    print(f'Exported {len(manifest)} class/outfit variants, 128 anchored pose frames.')

if __name__ == '__main__':
    export()
