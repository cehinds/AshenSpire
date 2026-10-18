"""Build standalone volume downloads without duplicating source atlases in ZIPs."""
from pathlib import Path
import json
import zipfile

ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'manifest.json').read_text())
for volume in (1,2,3):
    statuses=[s for s in manifest['statuses'] if s['volume']==volume]
    ids={i for s in statuses for role in ('object','effect','glow') for i in s[role+'Ids']}
    selected=dict(manifest,packageVolume=volume,statuses=statuses,
                  components=[c for c in manifest['components'] if c['id'] in ids],
                  presets=[p for p in manifest['presets'] if p['statusId'] in {s['id'] for s in statuses}])
    archive=ROOT/f'statuses-{volume:02d}-png-json.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name in ('index.html','style.css','viewer.js','README.md','inventory.json','generation-sources.json','preview.png','overview.png'):
            z.write(ROOT/name,name)
        z.writestr('manifest.json',json.dumps(selected,indent=2)+'\n')
        z.writestr('data.js','window.STATUS_ART = '+json.dumps(selected,separators=(',',':'))+';\n')
        for component in selected['components']:
            z.write(ROOT/component['src'],component['src'])
    print(f'{archive.name}: {len(statuses)} statuses, {len(selected["components"])} PNGs, {archive.stat().st_size/1_000_000:.1f} MB')
