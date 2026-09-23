"""Export the reviewed grid non-destructively: shared body scale, foot anchors, exact alpha."""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image, ImageDraw, ImageFont

PACK = Path(__file__).resolve().parent
sys.path.insert(0, str(PACK.parent/'sword-shield-outfits-2026-09-19'))
from atlas_components import extract_figures
IDS = ['STANCE-READY'] + [f'ATK-{i:02}' for i in range(1, 8)] + [
    'DEFEND', 'HURT', 'CAST', 'BUFF', 'STANCE-AGGRESSIVE', 'STANCE-DEFENSIVE', 'PORTRAIT', 'CONVERSATION']
SEQUENCE = ['STANCE-READY'] + [f'ATK-{i:02}' for i in range(1, 8)] + ['STANCE-READY']
outfit = sys.argv[1] if len(sys.argv) > 1 else 'reaver'
assert outfit.replace('-', '').isalnum(), 'Invalid appearance ID'
DEST = PACK / 'frames' / outfit
DEST.mkdir(parents=True, exist_ok=True)
source = PACK / 'sources' / f'{outfit}.png'
atlas = Image.open(source)
assert atlas.mode == 'RGBA' and atlas.getchannel('A').getextrema() == (0, 255)
crops, extraction_report = extract_figures(atlas, count=16)
cells = [{'content': bounds, 'core': core} for bounds, core in zip(extraction_report['bounds'], extraction_report['coreBounds'])]
body = [crop for pose, crop in zip(IDS, crops) if pose != 'PORTRAIT']
def foot_anchor(crop):
    solid = crop.getchannel('A').point(lambda a: 255 if a > 32 else 0)
    box = solid.getbbox()
    # Both boots must contribute even when the forward toe sits slightly higher.
    band = max(20, round((box[3]-box[1])*.08))
    feet = solid.crop((0, max(0, box[3]-band), crop.width, box[3])).getbbox()
    return (feet[0]+feet[2])/2, box[3]
anchors = [foot_anchor(crop) for crop in body]
scale = min(420 / max(c.width for c in body), 420 / max(c.height for c in body),
            248/max(a[0] for a in anchors), 248/max(c.width-a[0] for c,a in zip(body,anchors)))
frames, records = {}, {}
for pose, crop, extraction in zip(IDS, crops, cells):
    factor = min(464 / crop.width, 464 / crop.height) if pose == 'PORTRAIT' else scale
    solid = crop.getchannel('A').point(lambda a: 255 if a > 32 else 0)
    box = solid.getbbox()
    root_x = crop.width / 2 if pose == 'PORTRAIT' else foot_anchor(crop)[0]
    resized = crop.resize((round(crop.width*factor), round(crop.height*factor)), Image.Resampling.LANCZOS)
    offset = [round(256-root_x*factor), 480-round(box[3]*factor)]
    assert offset[0] >= 0 and offset[1] >= 0 and offset[0]+resized.width <= 512 and offset[1]+resized.height <= 512, pose
    frame = Image.new('RGBA', (512, 512))
    frame.alpha_composite(resized, offset)
    target = DEST / f'{pose}.webp'
    frame.save(target, 'WEBP', quality=92, method=4, exact=True)
    decoded = Image.open(target)
    assert decoded.size == (512, 512) and decoded.mode == 'RGBA'
    assert decoded.getchannel('A').tobytes() == frame.getchannel('A').tobytes(), pose
    assert decoded.getchannel('A').getextrema() == (0, 255)
    frames[pose] = frame
    records[pose] = {**extraction, 'scale': factor, 'sourceFootAnchor': [root_x, box[3]],
                     'offset': offset, 'anchor': [256, 480], 'bounds': frame.getchannel('A').getbbox(),
                     'file': f'frames/{outfit}/{pose}.webp', 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 19)
small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
sheet = Image.new('RGB', (1280, 1430), '#171b20')
draw = ImageDraw.Draw(sheet)
draw.text((24, 14), outfit.upper()+'  —  UNARMED / BOTH HANDS EMPTY', font=font, fill='#e4c58b')
draw.text((24, 44), 'Pose-order review • no baked effects • labels are preview only • common foot anchor (256, 480)', font=small, fill='#cad0d6')
for i, pose in enumerate(IDS):
    x, y = (i % 4)*320, 80+(i // 4)*335
    draw.rectangle((x+5, y+4, x+314, y+330), fill='#252b33')
    thumb = frames[pose].resize((300, 300), Image.Resampling.LANCZOS)
    sheet.paste(thumb, (x+10, y+3), thumb)
    draw.text((x+14, y+305), pose, font=font, fill='#eee1c8')
sheet.save(DEST / 'labeled-sheet.webp', quality=93)
anim = [frames[p] for p in SEQUENCE]
anim[0].save(DEST/'attack-preview.webp', save_all=True, append_images=anim[1:], duration=140, loop=0, quality=90)

manifest = {'exportVersion':2,'status': 'generated-and-exported', 'generator': 'built-in image_gen', 'motionProfile': 'unarmed',
    'authoredEquipment': {'rightGroup': 'empty', 'leftGroup': 'empty'}, 'id': outfit, 'classId': outfit.split('-')[0], 'armourId': outfit.split('-',1)[1] if '-' in outfit else 'default',
    'effectsBaked': False, 'source': f'sources/{outfit}.png', 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sourceSize': atlas.size, 'frameSize': [512,512], 'bodyScale': scale, 'anchor': [256,480],
    'poses': IDS, 'sequence': SEQUENCE, 'frameMs': 140, 'impactIndices': [3,5], 'frames': records,
    'references': {'menu': 'STANCE-READY', 'conversation': 'CONVERSATION', 'portrait': 'PORTRAIT', 'detail': 'PORTRAIT'}}
(DEST/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
(DEST/'validation.json').write_text(json.dumps({'frames': len(records), 'rgba': True, 'decodedAlphaExact': True,
    'bodyScaleShared': True, 'bodyClipping': False, 'anchor': [256,480],
    'visualInspection': 'complete; shared choreography uses painted pose approximations'}, indent=2)+'\n', encoding='utf-8')
print(f'{outfit}: exported {len(frames)} frames; shared body scale {scale:.6f}.')
