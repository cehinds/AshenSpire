"""Apply authored playback orders without relabeling or changing pose artwork."""
from pathlib import Path
from PIL import Image
import json

root=Path(__file__).resolve().parent
manifest=json.loads((root/'manifest.json').read_text())
sequences=json.loads((root/'sequences.json').read_text())
for group in manifest['groups']:
    if group['id'] not in sequences:
        continue
    order=sequences[group['id']]
    by_id={f['id']:f for f in group['frames']}
    frames=[Image.open(root/by_id[pose]['file']).convert('RGBA') for pose in order]
    group['attackSequence']=order
    frames[0].save(root/group['preview'],'WEBP',save_all=True,append_images=frames[1:],duration=100,loop=0,lossless=True,method=3)
    decoded=Image.open(root/group['preview'])
    assert decoded.n_frames==len(order)
    for i,expected in enumerate(frames):
        decoded.seek(i)
        actual=decoded.convert('RGBA')
        # Compare visible pixels after compositing; invisible RGB may be normalized by WebP.
        for background in ['black','white']:
            a=Image.new('RGBA',actual.size,background);a.alpha_composite(actual)
            b=Image.new('RGBA',expected.size,background);b.alpha_composite(expected)
            assert a.tobytes()==b.tobytes(),(group['id'],i,order[i])
    print(group['id']+': '+' -> '.join(order))
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
coverage=json.loads((root/'coverage.json').read_text())
(root/'data.js').write_text('window.ART_DATA='+json.dumps({'manifest':manifest,'coverage':coverage})+';\n')
