"""Encode discrete labeled existing-art frames; never generate in-between poses."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent/'renders'
manifest=json.loads((root/'manifest.json').read_text())
for output in manifest['outputs']:
    images=[Image.open(root/name).convert('RGB') for name in output['frames']]
    # Each numbered slot remains its own GIF frame even when the pose repeats.
    width,height=images[0].size
    palette=Image.new('RGB',(width,height*len(images)))
    for i,image in enumerate(images): palette.paste(image,(0,height*i))
    palette=palette.quantize(colors=256)
    encoded=[image.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for image in images]
    encoded[0].save(root/output['gif'],save_all=True,append_images=encoded[1:],duration=output['durations'],loop=0,optimize=False,disposal=2)
    gif=Image.open(root/output['gif'])
    assert gif.n_frames==len(images),(output['key'],gif.n_frames,len(images))
    durations=[]
    for i in range(gif.n_frames):gif.seek(i);durations.append(gif.info['duration'])
    assert durations==output['durations'],durations
    if output['storyboard']:
        columns=6 if len(images)>=6 else len(images);rows=(len(images)+columns-1)//columns
        tile_width=384;tile_height=352
        board=Image.new('RGB',(columns*tile_width,rows*tile_height),(25,32,37))
        for i,image in enumerate(images):board.paste(image.resize((tile_width,tile_height),Image.Resampling.LANCZOS),((i%columns)*tile_width,(i//columns)*tile_height))
        board.save(root/output['storyboard'])
    output['decodedFrameCount']=gif.n_frames;output['decodedDurationsMs']=durations
    # Intermediate full-size labeled slots are derivable; keep only portable outputs.
    for name in output['frames']:(root/name).unlink()
    del output['frames']
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified GIF frame counts and exact durations for every output.')
