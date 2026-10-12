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
