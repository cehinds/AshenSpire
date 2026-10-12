"""Compose supplied source frames with option IDs; no character edits or tweens."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
root=Path(__file__).resolve().parent
catalog=json.loads((root/'examples.json').read_text());out=root/'renders';out.mkdir(exist_ok=True)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
try:font=ImageFont.truetype(font_path,22);large=ImageFont.truetype(font_path,30)
except OSError:font=ImageFont.load_default();large=font
records=[];contacts={'sweep':[],'smash':[]}
for example in catalog['examples']:
    family=catalog['families'][example['family']];width,height=family['size'];frames=[]
    for i,path in enumerate(example['frames']):
        source=Image.open(root/path).convert('RGBA');assert source.size==(width,height)
        frame=Image.new('RGB',(width,height+88),(26,33,37));draw=ImageDraw.Draw(frame)
        for y in range(0,height,32):
            for x in range(0,width,32):draw.rectangle((x,y,x+31,y+31),fill=(36,44,48) if (x//32+y//32)%2 else (32,40,44))
        frame.paste(source,(0,0),source)
        roles=family.get('slotLabels',['Start stance','Action 1','Action 2','Action 3','Return stance']).copy()
        roles[0]+=' '+family['origin'];roles[4]+=' '+family['origin']
        draw.text((18,height+8),f"{example['id']} · {example['name']}",font=large,fill=(220,231,209))
        draw.text((18,height+47),f"{i+1}/5 · {roles[i]} · 350 ms review timing",font=font,fill=(189,202,181));frames.append(frame)
    palette=Image.new('RGB',(width,(height+88)*5))
    for i,frame in enumerate(frames):palette.paste(frame,(0,(height+88)*i))
    palette=palette.quantize(colors=256)
    encoded=[frame.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
    target=out/(example['id']+'.gif');encoded[0].save(target,save_all=True,append_images=encoded[1:],duration=[350]*5,loop=0,optimize=False,disposal=2)
    decoded=Image.open(target);assert decoded.n_frames==5
    for i in range(5):decoded.seek(i);assert decoded.info['duration']==350
    # Separate labels preserve five slots although source bookends match exactly.
    tile_width=384;tile_height=(height+88)//2
    storyboard=Image.new('RGB',(tile_width*5,tile_height),(26,33,37))
    for i,frame in enumerate(frames):storyboard.paste(frame.resize((tile_width,tile_height),Image.Resampling.LANCZOS),(tile_width*i,0))
    storyboard.save(out/(example['id']+'-storyboard.png'))
    contacts[example['family']].append(frames[2].resize((tile_width,tile_height),Image.Resampling.LANCZOS))
    records.append({'id':example['id'],'slots':5,'sourcePaths':example['frames'],'slotLabels':family.get('slotLabels'),'durationsMs':[350]*5,'decodedGifFrames':5,'gif':example['id']+'.gif','storyboard':example['id']+'-storyboard.png'})
for family,tiles in contacts.items():
    if not tiles:continue
    width,height=tiles[0].size;contact=Image.new('RGB',(width*2,height*5),(26,33,37))
    for i,tile in enumerate(tiles):contact.paste(tile,((i%2)*width,(i//2)*height))
    contact.save(out/(family+'-contact.png'))
(out/'manifest.json').write_text(json.dumps({'reviewOnly':True,'examples':records,'totalSlots':5*len(records),'timing':'Uniform 350 ms review exposures, not gameplay timing'},indent=2)+'\n')
print(f'Rendered {len(records)} labeled five-slot GIFs; decoded counts and durations pass.')

# Selected production comparison: use the stage's shared logical canvas and
# exact full-tier dimensions/offsets, never alpha-bound fitting or repainting.
import re,hashlib
repo=root.parents[3]
registered=json.loads(re.search(r'export const alternativeSelectedStances = (.+);',(repo/'src/content/alternativeSelectedStances.js').read_text()).group(1))
profile=registered['weaponProfiles']['reaver-greatsword-pilot']
if profile.get('selectedSmash') and profile.get('selectedSweep'):
    bounds=[f.get('stageBounds',f['bounds']) for f in profile['frames'].values()]
    top=max(0,-min(b[1] for b in bounds));left=max(0,16-min(b[0] for b in bounds));right=max(0,max(b[2] for b in bounds)-(768-16))
    canvas=(768+left+right,544+top);floor=464+16+top
    groups=[('SM03','Selected Smash',['smash','smash-takeoff','smash-airborne','smash-impact','smash'],catalog['families']['smash']['slotLabels']),
            ('SW09','Selected straight-arm Sweep',['sweep','sweep-windup','sweep-contact','sweep-finish','sweep'],catalog['families']['sweep']['slotLabels'])]
    comparison=[];sources=[]
    for slot in range(5):
        display=Image.new('RGB',(canvas[0]*2,canvas[1]+88),(26,33,37))
        for col,(id,title,keys,labels) in enumerate(groups):
            panel=Image.new('RGB',(canvas[0],canvas[1]+88),(26,33,37));draw=ImageDraw.Draw(panel)
            for y in range(0,canvas[1],32):
                for x in range(0,canvas[0],32):draw.rectangle((x,y,x+31,y+31),fill=(36,44,48) if (x//32+y//32)%2 else (32,40,44))
            f=profile['frames'][keys[slot]];source=Image.open(repo/f['path']).convert('RGBA');assert source.size==tuple(f['size'])
            placement=(left+f['drawOffset'][0],16+top+f['drawOffset'][1]);panel.paste(source,placement,source)
            draw.text((18,canvas[1]+8),f'{id} · {title}',font=large,fill=(220,231,209))
            draw.text((18,canvas[1]+47),f'{slot+1}/5 · {labels[slot]} · 350 ms review timing',font=font,fill=(189,202,181))
            display.paste(panel,(col*canvas[0],0))
            sources.append({'id':id,'slot':slot+1,'key':keys[slot],'path':f['path'],'sha256':hashlib.sha256((repo/f['path']).read_bytes()).hexdigest(),'logicalSize':f['size'],'placement':placement})
        comparison.append(display)
    palette=Image.new('RGB',(comparison[0].width,comparison[0].height*5))
    for slot,frame in enumerate(comparison):palette.paste(frame,(0,frame.height*slot))
    palette=palette.quantize(colors=256)
    encoded=[frame.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for frame in comparison]
    target=out/'selected-sm03-sw09.gif';encoded[0].save(target,save_all=True,append_images=encoded[1:],duration=[350]*5,loop=0,optimize=False,disposal=2)
    decoded=Image.open(target);assert decoded.n_frames==5
    for slot in range(5):decoded.seek(slot);assert decoded.info['duration']==350
    (out/'selected-sm03-sw09.json').write_text(json.dumps({'reviewOnly':True,'registeredCanvas':canvas,'padding':{'left':left,'right':right,'top':top},'floorY':floor,'slots':5,'durationsMs':[350]*5,'drawing':'Exact registered source dimensions and offsets; no resizing or alpha-bound fitting','sources':sources},indent=2)+'\n')
    print(f'Selected two-up comparison:5 decoded slots, registered canvas{canvas}, unscaled source images.')
