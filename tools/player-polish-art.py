"""Export the reviewed kit into the game's existing high/light runtime trees.

Python/Pillow is an authoring dependency only. Builds consume committed bytes.
Use --kit for a standalone delivery before its source kit has merged to dev.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--kit', type=Path, default=ROOT / 'docs/design/player-polish-asset-kit-2026-10-02')
args = parser.parse_args()
if not (args.kit / 'manifest.json').is_file():
    parser.error('Reviewed kit manifest is missing. Supply --kit or merge the source kit.')
records = []
for folder in ['scenes', 'materials']:
    for source in sorted((args.kit / folder).glob('*.png')):
        relative = Path('player-polish') / folder / (source.stem + '.webp')
        target = ROOT / 'assets' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as art:
            art.save(target, format='WEBP', quality=88, method=6)
        records.append({'source': source.relative_to(args.kit).as_posix(), 'runtime': relative.as_posix()})
components = set(re.findall(r"player-polish/ui/components/([^'\"()]+\.svg)", (ROOT / 'styles/player-polish.css').read_text(encoding='utf-8')))
for tier in ['assets', 'assets-mobile']:
    owned = ROOT / tier / 'player-polish/ui/components'
    for prior in owned.glob('*.svg'):
        if prior.name not in components:
            prior.unlink()
for source in sorted((args.kit / 'ui').glob('*/*.svg')):
    if source.parent.name == 'components' and source.name not in components:
        continue
    relative = Path('player-polish/ui') / source.relative_to(args.kit / 'ui')
    target = ROOT / 'assets' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes().replace(b'\r\n', b'\n'))
    records.append({'source': source.relative_to(args.kit).as_posix(), 'runtime': relative.as_posix()})

# Read policy from its authoritative JS implementation, including path-specific
# exceptions. No duplicated scale/quality constants in this authoring adapter.
policy_source = "import {policyFor,twinDimensions} from './tools/mobileart-policy.mjs'; console.log(JSON.stringify(JSON.parse(process.argv[1]).map(a=>({path:a.path,size:twinDimensions(a.size,policyFor(a.path)),policy:policyFor(a.path)}))));"
rasters = []
for record in records:
    if record['runtime'].endswith('.webp'):
        with Image.open(ROOT / 'assets' / record['runtime']) as art:
            rasters.append({'path': record['runtime'], 'size': {'width': art.width, 'height': art.height}})
policies = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', policy_source, json.dumps(rasters)], cwd=ROOT))
by_path = {row['path']: row for row in policies}
fallbacks = ["/* DERIVED by tools/player-polish-art.py. Embedded SVG masks for file play. */"]
for record in records:
    if record['runtime'].startswith('player-polish/ui/icons/'):
        name = Path(record['runtime']).stem
        fallbacks.append(f".engraved-icon[data-engraved-icon='{name}'] {{ --engraving-fallback:url('../assets/{record['runtime']}'); }}")
(ROOT / 'styles/player-polish-icons.css').write_text('\n'.join(fallbacks) + '\n', encoding='utf-8')
for record in records:
    relative = record['runtime']
    source, target = ROOT / 'assets' / relative, ROOT / 'assets-mobile' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if relative.endswith('.svg'):
        shutil.copyfile(source, target)
    else:
        row = by_path[relative]
        with Image.open(source) as art:
            size = (row['size']['width'], row['size']['height'])
            if art.size == size:
                shutil.copyfile(source, target)
            else:
                art.resize(size, Image.Resampling.LANCZOS).save(target, format='WEBP', quality=row['policy']['quality'], method=6)
for record in records:
    record['sourceSha256'] = hashlib.sha256((args.kit / record['source']).read_bytes()).hexdigest()
    record['tiers'] = {}
    for tier in ['assets', 'assets-mobile']:
        payload = (ROOT / tier / record['runtime']).read_bytes()
        record['tiers'][tier] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
provenance = ROOT / 'art/player-polish-runtime/exports.json'
provenance.parent.mkdir(parents=True, exist_ok=True)
provenance.write_text(json.dumps({'schema': 1, 'sourceKit': 'docs/design/player-polish-asset-kit-2026-10-02', 'encoder': f'Pillow {pillow_version} WebP; high quality 88/method 6; light policyFor()/LANCZOS/method 6', 'records': records}, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(records)} player-polish assets to high and light trees. Run art-manifest.mjs --write next.')
