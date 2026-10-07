"""Contact sheets use existing painted layers; no creative image editing."""
import sys, importlib.util, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'class-armor-weapons-2026-10-06'
sys.path.insert(0,str(OLD))
spec=importlib.util.spec_from_file_location('review_render',OLD/'render-review.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review);review.ROOT=ROOT
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
ids=list(review.read(ROOT/'registration.json'))
sheet=Image.new('RGB',(1500,1650),(42,46,51));draw=ImageDraw.Draw(sheet)
for i,wid in enumerate(ids):
    im=Image.open(ROOT/'sources'/f'{wid}-rear.png').convert('RGBA')
    im.thumbnail((270,285),Image.Resampling.LANCZOS)
    x=i%5*300+(300-im.width)//2;y=i//5*330
    sheet.paste(im,(x,y),im);draw.text((i%5*300+12,y+295),wid,fill='#ead9b4',font=font)
sheet.save(ROOT/'review'/'all-rear-weapons.jpg',quality=93)
for cid in ['reaver-default','starseer-default','herald-default','rogue-default']:
    project=review.read(ROOT/f'{cid}.rig.json')
    review.sheet(project,['straightSword--kiteShield','warhammer--buckler','ashStaff--lantern','shortbow--empty','boneSceptre--roundShield','twinblade--spikedShield','battleaxe--towerShield','katana--parryDagger'],ROOT/'review'/f'{cid}-rear-loadouts.jpg',4,384)
project=review.read(ROOT/'reaver-default.rig.json')
review.sheet(project,[f'{wid}--empty' for wid in ids],ROOT/'review'/'all-rear-weapons-held.jpg',5,300)
print('Rendered 25 masters, 25 held previews and 32 mixed loadouts')
