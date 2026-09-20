"""Export the review atlas; never write shared runtime configuration.

Uses the shipped component extractor rather than slicing through sword tips.
One scale and one foot anchor apply to every full-body pose.
"""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image, ImageDraw, ImageFont

PACK = Path(__file__).resolve().parent
from atlas_components import extract_figures

IDS = ['STANCE-READY'] + [f'ATK-{i:02}' for i in range(1, 8)] + [
    'DEFEND', 'HURT', 'CAST', 'STANCE-AGGRESSIVE', 'STANCE-DEFENSIVE',
    'BUFF', 'PORTRAIT', 'CONVERSATION']
NOTES = ['Balanced guard', 'Anticipation', 'High windup', 'Right cut',
         'First impact', 'Left cut', 'Followthrough', 'Recovery',
         'Two-blade guard', 'Recoil, both retained', 'Ritual, no effects',
         'Forward pressure', 'Lowered guard', 'Focus, no effects',
         'Identity reference', 'Relaxed, both retained']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_webp(image, path):
    image.save(path, 'WEBP', quality=90, method=3, exact=True)
    with Image.open(path) as decoded:
        assert decoded.size == image.size
        assert decoded.convert('RGBA').getchannel('A').tobytes() == image.getchannel('A').tobytes()

def prepare(entry):
    source = PACK / 'sources' / (entry['id'] + '.png')
    atlas = Image.open(source).convert('RGBA')
    assert atlas.getchannel('A').getextrema() == (0, 255)
    crops, extraction = extract_figures(atlas, count=16)
    anchors = []
    for crop in crops:
        opaque = crop.getchannel('A').point(lambda a: 255 if a > 32 else 0)
        box = opaque.getbbox()
        foot = opaque.crop((0, max(0, box[3] - 12), crop.width, box[3])).getbbox()
        anchors.append(((foot[0] + foot[2]) / 2, box[3]))
    bodies = [i for i, pose in enumerate(IDS) if pose != 'PORTRAIT']
    scale = min(240 / max(anchors[i][0] for i in bodies),
                240 / max(crops[i].width - anchors[i][0] for i in bodies),
                440 / max(anchors[i][1] for i in bodies))
    return entry, source, atlas, crops, extraction, anchors, scale

def export_group(prepared, unit_scale):
    entry, source, atlas, crops, extraction, anchors, safe_scale = prepared
    scale = unit_scale / atlas.width
    frames = {}
    metadata = {}
    dest = PACK / 'frames' / entry['id']
    png = PACK / 'sources/normalized' / entry['id']
    dest.mkdir(parents=True, exist_ok=True)
    png.mkdir(parents=True, exist_ok=True)
    for i, (pose, crop) in enumerate(zip(IDS, crops)):
        portrait = pose == 'PORTRAIT'
        factor = min(464 / crop.width, 464 / crop.height) if portrait else scale
        resized = crop.resize((round(crop.width * factor), round(crop.height * factor)), Image.Resampling.LANCZOS)
        x = round((512 - resized.width) / 2) if portrait else round(256 - anchors[i][0] * factor)
        y = 480 - resized.height if portrait else 480 - round(anchors[i][1] * factor)
        assert x >= 0 and y >= 0 and x + resized.width <= 512 and y + resized.height <= 512, (pose, 'clipping')
        frame = Image.new('RGBA', (512, 512))
        frame.alpha_composite(resized, (x, y))
        frame.save(png / f'{pose}.png')
        write_webp(frame, dest / f'{pose}.webp')
        box = frame.getchannel('A').getbbox()
        assert box and min(box[:2]) > 0 and max(box[2:]) < 512
        frames[pose] = frame
        metadata[pose] = {'file': f"frames/{entry['id']}/{pose}.webp", 'png': f"sources/normalized/{entry['id']}/{pose}.png",
                          'sha256': digest(dest / f'{pose}.webp'), 'bounds': box, 'scale': factor,
                          'sourceFootAnchor': anchors[i] if not portrait else None,
                          'outputFootAnchor': [x + anchors[i][0] * factor, y + anchors[i][1] * factor] if not portrait else None}
    sequence = json.loads((PACK / 'attack-sequence.json').read_text())
    assert all(p in frames and p != 'PORTRAIT' for p in sequence['frames'])
    assert 0 <= sequence['impactIndex'] < len(sequence['frames'])
    frames[sequence['frames'][0]].save(dest / 'attack-preview.webp', 'WEBP', save_all=True,
        append_images=[frames[p] for p in sequence['frames'][1:]], duration=sequence['frameMs'], loop=0, quality=90, method=3)
    fontpath = next((p for p in [Path('C:/Windows/Fonts/segoeui.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()), None)
    font = ImageFont.truetype(str(fontpath), 20) if fontpath else ImageFont.load_default()
    small = ImageFont.truetype(str(fontpath), 16) if fontpath else font
    sheet = Image.new('RGB', (1408, 1628), '#171b21')
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), entry['id'].upper() + '  |  TWIN SWORDS', fill='#ead7af', font=font)
    draw.text((24, 49), 'Right: straight sword  /  Left: katana  /  Effects separate  /  Source pose IDs remain stable', fill='#b5bbc7', font=small)
    for i, pose in enumerate(IDS):
        x, y = (i % 4) * 352, 84 + (i // 4) * 386
        thumb = frames[pose].resize((340, 340), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x + 6, y), thumb)
        draw.text((x + 16, y + 335), pose, fill='#f1dec0', font=font)
        draw.text((x + 16, y + 360), NOTES[i], fill='#b5bbc7', font=small)
    if entry['id'] == 'reaver': sheet.save(PACK / 'labeled-sheet.png')
    sheet.save(dest / 'labeled-sheet.webp', 'WEBP', quality=90, method=3)
    manifest = {**entry, 'status': 'generated-and-normalized',
                'motionProfile': 'twinSword', 'selector': {'rightGroup': 'sword', 'leftGroup': 'sword', 'grip': 'dual'},
                'authoredEquipment': {'rightGroup': 'sword', 'leftGroup': 'sword', 'rightShape': 'straight', 'leftShape': 'curved'},
                'handSwapStatus': 'Reverse ordered item pair requires approved policy or separately authored hand swap; no mirroring.',
                'generator': 'OpenAI built-in image_gen', 'source': source.relative_to(PACK).as_posix(), 'sourceSize': atlas.size,
                'sourceSha256': digest(source), 'frameSize': [512, 512], 'footAnchor': [256, 480], 'bodyScale': scale,
                'poses': IDS, 'notes': dict(zip(IDS, NOTES)), 'frames': metadata, 'attack': sequence, 'extraction': extraction,
                'effectsBakedIn': False, 'references': {'portrait': 'PORTRAIT', 'conversation': 'CONVERSATION', 'menu': 'STANCE-READY'}}
    print(f"Exported {entry['id']}: 16 transparent WebPs + PNGs; scale {scale:.6f}", flush=True)
    return manifest

def main():
    plan = json.loads((PACK / 'generation-plan.json').read_text())
    available = [entry for entry in plan if (PACK / 'sources' / (entry['id'] + '.png')).exists()]
    prepared = []
    for entry in available:
        print('Extracting ' + entry['id'], flush=True)
        prepared.append(prepare(entry))
    unit_scale = min(item[-1] * item[2].width for item in prepared)
    groups = [export_group(item, unit_scale) for item in prepared]
    outfits = json.loads((PACK / 'outfits.json').read_text())
    manifest = {'motionProfile': 'twinSword', 'groups': groups, 'outfits': outfits,
                'poses': IDS, 'notes': dict(zip(IDS, NOTES)),
                'attack': json.loads((PACK / 'attack-sequence.json').read_text()),
                'unitScale': unit_scale, 'footAnchor': [256, 480],
                'coverage': {'expectedAppearances': len(plan), 'generatedAppearances': len(groups),
                             'catalogEntries': len(outfits), 'missingAppearances': [e['id'] for e in plan if e['id'] not in {g['id'] for g in groups}],
                             'authoredOrder': {'right': 'straightSword', 'left': 'katana'},
                             'fallbackOrder': {'right': 'katana', 'left': 'straightSword'}},
                'generator': 'OpenAI built-in image_gen'}
    (PACK / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    (PACK / 'data.js').write_text('window.TWIN_SWORD_ART = ' + json.dumps(manifest) + ';\n', encoding='utf-8', newline='\n')
    print(f'Coverage: {len(groups)}/{len(plan)} appearances, {len(outfits)} catalog entries.', flush=True)
    if '--bind' in sys.argv:
        from bind import bind
        bind(manifest)

if __name__ == '__main__':
    main()
