#!/usr/bin/env python3
"""Export approved whole-strip class Smash art with one shared world registration.

Source provenance must declare registration.groundAnchor and bodyHeight in the
normalized 1024-square source canvas. Airborne frames never get foot-aligned.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CLASSES = ('rogue', 'starseer', 'herald')
NAMES = ('01-held', '02-takeoff', '03-airborne', '04-impact', '05-held')
KEYS = ('held', 'takeoff', 'airborne', 'impact')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_catalog(path, name):
    text = path.read_text()
    return json.loads(text.split('export const '+name+' = ', 1)[1].rstrip().removesuffix(';'))


def prepare_class(actor, root=ROOT):
    """Validate first, then return a deterministic export plan without writing."""
    folder = root / 'pose-studio/stances/class-smash' / actor
    source_provenance = folder / 'provenance.json'
    provenance = json.loads(source_provenance.read_text())
    if provenance.get('directorApproved') is not True:
        raise ValueError(actor+': source requires directorApproved: true before export')
    registration = provenance['registration']
    anchor = registration['groundAnchor']
    # Anatomical hood/head-to-ground boot height of the held seed, excluding
    # raised hands/weapons, cape tails and effects; not the alpha bounding box.
    body_height = registration['bodyHeight']
    if len(anchor) != 2 or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and 0 <= v <= 1024 for v in anchor):
        raise ValueError(actor+': groundAnchor must be a source pixel coordinate')
    if isinstance(body_height, bool) or not isinstance(body_height, (int, float)) or not math.isfinite(body_height) or not 0 < body_height <= 1024:
        raise ValueError(actor+': invalid shared bodyHeight')
    images = [Image.open(folder / (name+'.png')).convert('RGBA') for name in NAMES]
    for image in images:
        if image.size != (1024, 1024) or image.getchannel('A').getextrema()[0] != 0 or not image.getbbox():
            raise ValueError(actor+': all five sources must be nonempty transparent 1024-square frames')
        bounds = image.getbbox()
        if bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= 1024 or bounds[3] >= 1024:
            raise ValueError(actor+': source alpha touches a canvas edge; preserve full weapon/effect reach')
    if images[0].tobytes() != images[-1].tobytes():
        raise ValueError(actor+': held bookends must have identical decoded RGBA pixels')
    base = load_catalog(root / 'src/content/alternativeCardAnimations.js', 'alternativeCardAnimations')['classes'][actor]
    scale = (464-base['frames']['ready']['bounds'][1]) / body_height
    draw_size = [1024*scale, 1024*scale]
    offset = [384-anchor[0]*scale, 464-anchor[1]*scale]
    frames, outputs = {}, {}
    for key, name, image in zip(KEYS, NAMES, images):
        bounds = list(image.getbbox())
        tier_data = {}
        for tier, side, suffix in [('full',1024,''), ('lite',512,'-mobile')]:
            path = 'assets-display/alternative/class-smash-'+actor+'-'+key+suffix+'.webp'
            raster = image if side == 1024 else image.resize((side,side), Image.Resampling.LANCZOS)
            import io
            buffer = io.BytesIO()
            raster.save(buffer,format='WEBP',lossless=True,method=6)
            data=buffer.getvalue();outputs[path]=data
            tier_data[tier]={'path':path,'sha256':sha(data),'dimensions':[side,side]}
        source_path = str((folder / (name+'.png')).relative_to(root))
        frames[key]={'path':tier_data['full']['path'],'lite':tier_data['lite']['path'],
            'sha256':tier_data['full']['sha256'],'liteSha256':tier_data['lite']['sha256'],
            'size':draw_size,'drawOffset':offset,'bounds':bounds,
            'stageBounds':[bounds[0]*scale+offset[0],bounds[1]*scale+offset[1],bounds[2]*scale+offset[0],bounds[3]*scale+offset[1]],
            'stageAnchor':[384,464],'rasterSize':[1024,1024],'mobileRasterSize':[512,512],
            'source':{'path':source_path,'sha256':sha((root/source_path).read_bytes()),'width':1024,'height':1024},
            'provenance':str(source_provenance.relative_to(root))}
    production={'schemaVersion':1,'classId':actor,'sourceProvenance':str(source_provenance.relative_to(root)),
        'sourceProvenanceSha256':sha(source_provenance.read_bytes()),'sharedLogicalScale':scale,
        'groundAnchor':anchor,'bodyHeight':body_height,'logicalStageAnchor':[384,464],
        'sourceBookends':{'first':sha((folder/'01-held.png').read_bytes()),'last':sha((folder/'05-held.png').read_bytes()),'decodedRGBA':sha(images[0].tobytes())},
        'frames':frames}
    outputs[str((folder/'production.json').relative_to(root))]=(json.dumps(production,indent=2)+'\n').encode()
    return {'frames':frames,'provenance':str((folder/'production.json').relative_to(root))}, outputs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--class',dest='actors',action='append',choices=CLASSES)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    catalog=load_catalog(ROOT/'src/content/classSmashAnimations.js','classSmashAnimations')
    outputs={}
    for actor in args.actors or CLASSES:
        entry, files=prepare_class(actor);catalog['classes'][actor]=entry;outputs.update(files)
    outputs['src/content/classSmashAnimations.js']=('// Generated by tools/class-smash-export.py after director approval of the source strips.\nexport const classSmashAnimations = '+json.dumps(catalog,separators=(',',':'))+';\n').encode()
    for name,data in outputs.items():
        path=ROOT/name
        if args.check:
            if not path.exists() or path.read_bytes()!=data:raise ValueError('Production export drift: '+name)
        else:
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print('Class Smash production '+('verified' if args.check else 'exported')+': '+', '.join(args.actors or CLASSES))


if __name__ == '__main__':
    main()
