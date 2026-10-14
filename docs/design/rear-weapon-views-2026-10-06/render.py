"""Mechanical preview of Workshop layer transforms, including pivot reflections."""
import math
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
ROOT = Path(__file__).resolve().parent

@lru_cache(maxsize=96)
def asset(src):
    return Image.open(ROOT / src).convert('RGBA')

def transformed(im, layer):
    angle = math.radians(layer['rotation'])
    c, s = math.cos(angle), math.sin(angle)
    sx = layer['scale'] * (-1 if layer.get('flipX', False) else 1)
    sy = layer.get('scaleY', layer['scale'])
    px, py = layer['pivot']; tx, ty = px + layer['x'], py + layer['y']
    return im.transform((512, 512), Image.Transform.AFFINE,
        (c/sx, s/sx, px-(c*tx+s*ty)/sx,
         -s/sy, c/sy, py-(-s*tx+c*ty)/sy), Image.Resampling.BICUBIC)

def render(project, poseid):
    out = Image.new('RGBA', (512, 512))
    for layer in project['poses'][poseid]['layers']:
        if not layer['visible']: continue
        im = asset(project['assets'][layer['assetId']]['src']).copy()
        if layer['masks']:
            mask = Image.new('L', (512, 512)); draw = ImageDraw.Draw(mask)
            for poly in layer['masks']: draw.polygon([tuple(p) for p in poly], fill=255)
            im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
        out.alpha_composite(transformed(im, layer))
    return out
