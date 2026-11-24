"""Stage approved recipient strips for AshenSpire art intake; never publish.

python tools/recipient-effects-export.py --source-root scratch/recipient-effects \
    --output-root scratch/recipient-effects/integration-art
Repeat with --check for a read-only byte/hash/dimension/provenance check.
Requires Pillow. Original source PNGs and prompt JSONs are preserved unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
CONFIG = REPO / 'content/config/ui/presentation/recipientEffects.json'
VERSION = 'recipient-effects/v5'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def export(source_root, output_root, check=False):
    source_root, output_root = source_root.resolve(), output_root.resolve()
    if source_root == output_root or '.art-cache' in output_root.parts:
        raise ValueError('Output must be a separate explicit authoring/staging directory, never the immutable .art-cache.')
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    atlas = config['behavior']['atlas']
    frame_count, tile = config['behavior']['frameCount'], config['sizing']['tilePx']
    expected, entries = {}, {}
    expected['recipient-effects-catalog.schema.json'] = REPO / 'tools/recipient-effects-catalog.schema.json'
    roots = [source_root / 'overlay-v6', source_root / 'composed-v5/additions', source_root / 'front-on-v4']
    # Validate every input before writing any output. Export is an explicit action.
    for shape, entry in atlas.items():
        if entry['columns'] != frame_count or entry['rows'] != 1 or entry['row'] != 0:
            raise ValueError(f'{shape}: only a three-column, one-row registered strip is supported')
        candidates = [root / 'strips' / f'{shape}.png' for root in roots]
        source = next((path for path in candidates if path.is_file()), None)
        if source is None:
            raise ValueError(f'{shape}: missing approved strip; searched {candidates}')
        with Image.open(source) as image:
            if image.mode != 'RGBA' or image.size != (tile * frame_count, tile):
                raise ValueError(f'{shape}: expected RGBA {tile * frame_count}x{tile}; got {image.mode} {image.size}')
            if image.getchannel('A').getextrema()[0] != 0:
                raise ValueError(f'{shape}: expected transparent background')
        asset = entry['asset']
        if asset != f'assets/{VERSION}/{shape}.png':
            raise ValueError(f'{shape}: unexpected versioned runtime id {asset}')
        tiers = {tier: f'{tier}/{asset}' for tier in ('hd', 'light')}
        for relative in tiers.values(): expected[relative] = source
        entries[shape] = {
            'asset': asset, 'columns': frame_count, 'rows': 1, 'row': 0,
            'frameSize': [tile, tile], 'size': [tile * frame_count, tile],
            'sha256': digest(source), 'source': source.relative_to(source_root).as_posix(),
            'tiers': tiers,
        }
    # Keep original generated PNGs (including superseded drafts), prompts and
    # extraction records. Provenance is not a new license or publication claim.
    provenance = {}
    for relative in ('front-on-v4', 'composed-v5', 'overlay-v6'):
        root = source_root / relative
        sources = list((root / 'raw').glob('*.png')) + list(root.glob('*prompt*.json'))
        if relative == 'overlay-v6': sources += list(root.glob('*raw.png'))
        sources += [path for path in (root / 'manifest.json', root / 'additions/manifest.json') if path.is_file()]
        for source in sources:
            source_path = source.relative_to(source_root).as_posix()
            target = f'provenance/{VERSION}/{source_path}'
            expected[target] = source
            provenance[source_path] = {'path': target, 'sha256': digest(source)}
    manifest = {
        'schemaVersion': 1, 'catalog': VERSION, 'frameCount': frame_count,
        'purpose': 'Local AshenSpire art intake staging; not published or release-pinned',
        'authorship': 'Original OpenAI image generation; no third-party artwork or license claimed',
        'tierPolicy': 'Identical approved pixel PNG bytes in hd and light; no resampling or recoloring',
        'excludedRuntimeSources': ['evade-afterimage demonstration: use actual actor masks'],
        'entries': entries, 'provenance': provenance,
    }
    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    manifest_path = output_root / 'recipient-effects-catalog.json'
    problems = []
    for relative, source in expected.items():
        target = output_root / relative
        if check:
            if not target.is_file() or digest(target) != digest(source): problems.append(relative)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.is_file() or digest(target) != digest(source): shutil.copyfile(source, target)
    if check:
        if not manifest_path.is_file() or manifest_path.read_bytes() != manifest_bytes: problems.append(manifest_path.name)
        if problems: raise ValueError('Missing/stale exported files: ' + ', '.join(problems))
    else:
        output_root.mkdir(parents=True, exist_ok=True)
        manifest_path.write_bytes(manifest_bytes)
    print(f'{"Checked" if check else "Staged"} {len(entries)} strips in hd/light; {len(provenance)} preserved provenance files: {output_root}')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try: export(args.source_root, args.output_root, args.check)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'recipient-effects-export: {error}\n')

if __name__ == '__main__': main()
