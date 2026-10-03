"""Normalize the generated aura-free attack variant and render configured playback."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, math

DRY_POSE = 'BUFF-NO-AURA'

def add_attack_variant(pack, outfit, frames, write_webp):
    source = pack / 'sources' / 'buff-no-aura' / f'{outfit}.png'
    image = Image.open(source).convert('RGBA')
    assert image.getchannel('A').getextrema()[0] == 0, f'{outfit}: variant requires alpha'
    box = image.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    crop = image.crop(box)
    # Retain the existing suite's scale and bottom anchor after image-generation
    # changes the canvas resolution. The source variant contains no light effect.
    target = frames['BUFF'].getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    # The old effect extends above the sword; reserve that small halo margin.
    factor = min(440/crop.width, .93*(target[3]-target[1])/crop.height)
    scaled = crop.resize((round(crop.width*factor), round(crop.height*factor)), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (512, 512))
    feet = crop.getchannel('A').crop((0,max(0,crop.height-24),crop.width,crop.height)).point(lambda a:255 if a>32 else 0).getbbox()
    root_x = (feet[0]+feet[2])/2 if feet else crop.width/2
    x = max(8,min(round(256-root_x*factor),504-scaled.width))
    frame.alpha_composite(scaled, (x,480-scaled.height))
    write_webp(frame, pack/'frames'/outfit/f'{DRY_POSE}.webp')
    frames[DRY_POSE] = frame
    return hashlib.sha256(source.read_bytes()).hexdigest()

def render_playback(dest, frames, order, frame_ms, font):
    playback = [frames[p] for p in order]
    playback[0].save(dest/'attack-preview.webp', 'WEBP', save_all=True,
                     append_images=playback[1:], duration=frame_ms, loop=0, lossless=True, method=3)
    display = [('READY', order[0])] + [('READY' if pose == 'STANCE-READY' else f'ATK-{i:02}', pose) for i, pose in enumerate(order[1:], 1)]
    display += [(pose, pose) for pose in frames if pose not in order]
    sheet = Image.new('RGB', (1200, math.ceil(len(display)/4)*340), '#181a1e')
    draw = ImageDraw.Draw(sheet)
    for i, (label, pose) in enumerate(display):
        x, y = i%4*300, i//4*340
        thumb = frames[pose].resize((292,292), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x+4,y+4), thumb)
        draw.text((x+10,y+300), label, font=font, fill='#e8ce96')
        draw.text((x+10,y+320), 'Source: '+pose, font=font, fill='#aaaab5')
    sheet.save(dest/'labeled-sheet.webp', 'WEBP', quality=90, method=3)
    return display
