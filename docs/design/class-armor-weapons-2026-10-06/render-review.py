"""Render the portable layer recipe for deterministic contact-sheet inspection."""
from build import *
from PIL import ImageChops, ImageFont
FONT=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',15)
def render(project,poseid):
    out=Image.new('RGBA',(512,512));pose=project['poses'][poseid]
    for layer in pose['layers']:
        if not layer['visible']:continue
        im=Image.open(ROOT/project['assets'][layer['assetId']]['src']).convert('RGBA')
        if layer['masks']:
            mask=Image.new('L',(512,512));d=ImageDraw.Draw(mask)
            for poly in layer['masks']:d.polygon([tuple(pt) for pt in poly],fill=255)
            im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
        im=affine(im,layer['scale'],layer['rotation'],layer['pivot'],[layer['pivot'][0]+layer['x'],layer['pivot'][1]+layer['y']])
        out.alpha_composite(im)
    return out
def sheet(project,ids,path,cols=7,size=240):
    rows=math.ceil(len(ids)/cols);out=Image.new('RGB',(cols*size,rows*(size+35)),(28,30,35));d=ImageDraw.Draw(out)
    for i,pid in enumerate(ids):
        x=(i%cols)*size;y=(i//cols)*(size+35);im=render(project,pid).resize((size,size),Image.Resampling.LANCZOS)
        out.paste(im,(x,y),im);d.text((x+8,y+size),pid.replace('--',' / '),fill='#dac28e',font=FONT)
    out.save(path)
if __name__=='__main__':
    for p in read(ROOT/'manifest.json')['projects']:
        project=read(ROOT/p['projectPath']);ids=[f'{w}--empty' for w in project['assets'] if w!='body']
        sheet(project,ids,ROOT/'review'/f"{p['id']}-weapons.jpg")
        render(project,'straightSword--kiteShield').save(ROOT/'review'/f"{p['id']}-sword-shield.png")
    project=read(ROOT/'reaver-default.rig.json')
    sheet(project,['straightSword--kiteShield','dagger--parryDagger','greatsword--torch','shortbow--empty','ashStaff--starstoneStaff','warhammer--towerShield','twinblade--battleaxe','empty--empty'],ROOT/'review'/'layer-examples.jpg',4,384)
