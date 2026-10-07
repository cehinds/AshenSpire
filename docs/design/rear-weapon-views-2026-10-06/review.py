"""Contact sheets use existing painted layers; no creative image editing."""
import sys, importlib.util, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'class-armor-weapons-2026-10-06'
sys.path.insert(0,str(OLD))
spec=importlib.util.spec_from_file_location('review_render',OLD/'render-review.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review);review.ROOT=ROOT
from render import render
review.render=render
font=review.load_font(18)
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
shields=['kiteShield','buckler','towerShield','roundShield','spikedShield']
for entry in review.read(ROOT/'manifest.json')['projects']:
    project=review.read(ROOT/entry['projectPath'])
    review.sheet(project,[f'{s}--empty' for s in shields]+[f'straightSword--{s}' for s in shields],ROOT/'review'/f"{entry['id']}-shield-facing.jpg",5,300)
    review.sheet(project,[f'{wid}--empty' for wid in ids],ROOT/'review'/f"{entry['id']}-all-weapons.jpg",5,240)
print('Rendered both shield hands and every distinct weapon on all 31 appearances')
entries=review.read(ROOT/'manifest.json')['projects']
roster=Image.new('RGB',(6*260,math.ceil(len(entries)/6)*295),(28,30,35));draw=ImageDraw.Draw(roster)
for i,entry in enumerate(entries):
    project=review.read(ROOT/entry['projectPath'])
    im=render(project,'straightSword--towerShield').resize((260,260),Image.Resampling.LANCZOS)
    x=i%6*260;y=i//6*295
    roster.paste(im,(x,y),im);draw.text((x+8,y+262),entry['id'],font=font,fill='#dac28e')
roster.save(ROOT/'review'/'all-appearances-sword-tower.jpg',quality=92)
