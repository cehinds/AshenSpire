"""Export the review atlas using one body scale and a shared boot anchor.

Adapted from the approved greatsword pipeline; never binds runtime settings.
Run with Pillow. PNG masters remain untouched, WebP alpha is lossless.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import sys
from atlas_components import extract_figures

PACK = Path(__file__).resolve().parent
IDS = ['STANCE-READY'] + [f'ATK-{i:02}' for i in range(1, 8)] + [
    'DEFEND', 'HURT', 'CAST', 'BUFF', 'STANCE-AGGRESSIVE',
    'STANCE-DEFENSIVE', 'PORTRAIT', 'CONVERSATION']
LABELS = ['Ready', 'ATK01 · Gather', 'ATK02 · Open channel', 'ATK03 · Channel peak',
          'ATK04 · Extend', 'ATK05 · Release', 'ATK06 · Follow through', 'ATK07 · Recover',
          'Defend · Open-palm guard', 'Hurt', 'Cast · Ritual', 'Buff · Self-directed',
          'Aggressive stance', 'Defensive stance', 'Portrait', 'Conversation']
ORDER = [IDS[0], *IDS[1:8], IDS[0]]
def export(row):
    outfit = row['classId'] + ('' if row['id'] == 'default' else '-' + row['id'])
    source = PACK / 'sources' / f'{outfit}.png'
    atlas = Image.open(source).convert('RGBA')
    assert atlas.getchannel('A').getextrema() == (0, 255), 'Source must have genuine alpha'
    dest = PACK / 'frames' / outfit
    dest.mkdir(parents=True, exist_ok=True)
    crops, extraction = extract_figures(atlas, count=16)
    crops = [c.crop(c.getchannel('A').getbbox()) for c in crops]
    boxes = [{'sourceBounds': b} for b in extraction['bounds']]
    body = [crop for i, crop in enumerate(crops) if IDS[i] != 'PORTRAIT']
    scale = min(440 / max(c.width for c in body), 440 / max(c.height for c in body))
    frames, metadata = {}, {}
    for i, (pose, crop) in enumerate(zip(IDS, crops)):
        factor = min(440 / crop.width, 440 / crop.height) if pose == 'PORTRAIT' else scale
        alpha = crop.getchannel('A')
        solid = alpha.point(lambda v: 255 if v > 32 else 0).getbbox()
        foot = alpha.crop((0, max(0, solid[3] - 12), crop.width, solid[3])).point(lambda v: 255 if v > 32 else 0).getbbox()
        root_x = (foot[0] + foot[2]) / 2 if pose != 'PORTRAIT' else crop.width / 2
        root_y = solid[3] if pose != 'PORTRAIT' else crop.height
        size = (round(crop.width * factor), round(crop.height * factor))
        offset = (round(256 - root_x * factor), round(480 - root_y * factor))
        assert offset[0] >= 0 and offset[1] >= 0 and offset[0] + size[0] <= 512 and offset[1] + size[1] <= 512, pose
        frame = Image.new('RGBA', (512, 512))
        frame.alpha_composite(crop.resize(size, Image.Resampling.LANCZOS), offset)
        file = dest / f'{pose}.webp'
        frame.save(file, 'WEBP', quality=94, method=4, exact=True)
        decoded = Image.open(file).convert('RGBA')
        assert decoded.getchannel('A').tobytes() == frame.getchannel('A').tobytes(), pose
        assert decoded.getpixel((0, 0))[3] == 0 and decoded.getpixel((511, 511))[3] == 0
        frames[pose] = frame
        metadata[pose] = {**boxes[i], 'file': f'frames/{outfit}/{pose}.webp',
                          'scale': factor, 'sourceAnchor': [root_x, root_y],
                          'anchor': [256, 480], 'offset': offset, 'box': frame.getbbox(),
                          'alphaVerified': True, 'label': LABELS[i]}
    font_path = Path('C:/Windows/Fonts/segoeui.ttf')
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    sheet = Image.new('RGB', (1280, 1456), '#191b24')
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 15), f'{outfit.upper()} · EMPTY-HAND MAGIC', font=font, fill='#f1d4a3')
    for i, pose in enumerate(IDS):
        x, y = i % 4 * 320, 48 + i // 4 * 352
        draw.rectangle((x + 4, y + 4, x + 315, y + 347), fill='#252835')
        thumb = frames[pose].resize((304, 304), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x + 8, y + 6), thumb)
        draw.text((x + 12, y + 315), LABELS[i], font=font, fill='#f1d4a3')
    sheet.save(dest / 'labeled-sheet.webp', 'WEBP', quality=94, method=4)
    playback = [frames[p] for p in ORDER]
    playback[0].save(dest / 'attack-preview.webp', 'WEBP', save_all=True,
                     append_images=playback[1:], duration=160, loop=0, lossless=True, method=3)
    manifest = {
        'id': outfit, 'classId': row['classId'], 'armourId': row['id'], 'name': row['name'], 'directory': f'frames/{outfit}', 'extraction': extraction,
        'weaponGroup': 'unarmed', 'rightGroup': 'empty', 'leftGroup': 'empty',
        'presentationIntent': 'magic', 'grip': 'one', 'frameSize': [512, 512],
        'bodyScale': scale, 'anchor': [256, 480], 'frameMs': 160, 'impactPose': 'ATK-05',
        'sequence': ORDER, 'poses': IDS, 'frames': metadata,
        'source': f'sources/{outfit}.png', 'sourceSize': list(atlas.size),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'generator': 'OpenAI built-in image_gen', 'effectsBaked': False,
        'references': {'idle': 'STANCE-READY', 'attack': ORDER, 'defend': 'DEFEND',
            'hurt': 'HURT', 'cast': 'CAST', 'buff': 'BUFF', 'aggressiveStance': 'STANCE-AGGRESSIVE',
            'defensiveStance': 'STANCE-DEFENSIVE', 'portrait': 'PORTRAIT', 'conversation': 'CONVERSATION'},
        'defaultRuntimeRoles': ['cast', 'buff']}
    print(f'Exported {outfit}: 16 frames; alpha verified; shared foot anchor.', flush=True)
    return manifest
