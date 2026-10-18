"""Validate coverage, transparent components, references and packaged volumes."""
from pathlib import Path
from collections import Counter
from PIL import Image
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    runtime = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {statuses} from './src/content/statuses.js';console.log(JSON.stringify(statuses.map(s=>s.id)))"
    ], cwd=REPO, text=True))
    assert len(runtime) == 71
    assert set(runtime) == {s['id'] for s in manifest['statuses']}
    components = {c['id']: c for c in manifest['components']}
    assert len(components) == 1710
    assert Counter(c['role'] for c in components.values()) == dict(object=290,effect=710,glow=710)
    assert len(manifest['presets']) == len({p['code'] for p in manifest['presets']}) == 710
    sources = {}
    for component in components.values():
        path = ROOT / component['src']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == component['sha256'], path
        with Image.open(path) as im:
            assert im.size == (400,400) and 'A' in im.getbands(), path
            alpha = im.getchannel('A')
            assert alpha.getextrema()[0] == 0 and alpha.getbbox(), path
            assert all(alpha.getpixel(p)==0 for p in [(0,0),(399,0),(0,399),(399,399)]), path
        ref=component['reference'];source=ROOT/ref['path']
        if source not in sources:
            sources[source]=hashlib.sha256(source.read_bytes()).hexdigest()
        assert sources[source] == ref['sha256'], source
        if 'extractionCrop' in ref:
            c=ref['extractionCrop'];w,h=ref['sourceSize']
            assert c['x']>=0 and c['y']>=0 and c['x']+c['width']<=w and c['y']+c['height']<=h
        t=component['transform']
        assert t['visible'] and t['size']>0 and 0<t['opacity']<=1
        assert component['css']['transform']==f"translate(-50%, -50%) rotate({t['rotation']}deg)"
    for status in manifest['statuses']:
        for role in ('object','effect','glow'):
            ids=status[role+'Ids']
            assert len(ids)==10 and all(i in components for i in ids)
            assert [components[i]['variant'] for i in ids]==list(range(10))
            assert len({components[i]['sha256'] for i in ids})==10
        assert len([p for p in manifest['presets'] if p['statusId']==status['id']])==10
    for preset in manifest['presets']:
        assert all(i in components for i in preset['layers'])
    for volume in (1,2,3):
        archive=ROOT/f'statuses-{volume:02d}-png-json.zip'
        if not archive.exists():
            continue
        assert archive.stat().st_size < 100_000_000, archive
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None, archive
            packed=json.loads(z.read('manifest.json'))
            assert all(s['volume']==volume for s in packed['statuses'])
            assert {c['src'] for c in packed['components']} <= set(z.namelist())
            assert all(n in z.namelist() for n in ['index.html','style.css','viewer.js','data.js','README.md'])
            for c in packed['components']:
                assert hashlib.sha256(z.read(c['src'])).hexdigest()==c['sha256']
    print('PASS: 71 current statuses, 710 presets, 1,710 transparent PNGs, provenance and available ZIPs')


if __name__ == '__main__':
    main()
