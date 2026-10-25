"""Re-encode only reviewed desktop scene layers; phone exports stay byte-identical."""
import argparse
import copy
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from art_authoring import authoring_root, art_path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def phone_snapshot(root, catalog):
    paths = {path for name, path in catalog['filePaths'].items() if name.endswith('-mobile.webp')}
    paths.update(path.relative_to(authoring_root(root) / 'common').as_posix() for folder in ['alternative', 'shared']
                 for path in art_path(root, 'assets-display/' + folder).rglob('*-mobile.webp'))
    return {path: digest(art_path(root, path)) for path in sorted(paths)}


def main(root):
    from PIL import Image
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--desktop-scenes-only', action='store_true', required=True)
    parser.add_argument('--source-root', type=Path, default=authoring_root(root) / 'docs/design/combat-depth-2026-10-05')
    args = parser.parse_args()
    source_root = args.source_root.resolve()
    catalog_path = root / 'src/ui/alternativeArtCatalog.js'
    text = catalog_path.read_text(encoding='utf-8')
    match = re.search(r'^export const alternativeArtCatalog = (.+);$', text, re.M)
    if not match:
        raise ValueError('Missing runtime alternative art catalog')
    catalog = json.loads(match[1])
    reviewed = json.loads((source_root / 'continuation/scene-catalog.json').read_text(encoding='utf-8'))
    entries = reviewed['layers']
    if {entry['id'] for entry in entries} != set(catalog['sceneLayers']):
        raise ValueError('Reviewed scene IDs differ from existing runtime scene IDs')
    original_sources = copy.deepcopy(catalog['sources'])
    phones = phone_snapshot(root, catalog)
    jobs, requests = [], []
    for entry in entries:
        id = entry['id']
        art = catalog['sceneLayers'][id]
        provenance = catalog['sources']['scene-' + id]
        source = (source_root / 'continuation' / entry['file']).resolve()
        if not source.is_relative_to(source_root):
            raise ValueError(f'Scene source escapes reviewed masters: {source}')
        if digest(source) != entry['sha256'] or entry['sha256'] != provenance['sha256']:
            raise ValueError(f'Unreviewed source bytes: {id}')
        with Image.open(source) as image:
            size = list(image.size)
        if size != provenance['size']:
            raise ValueError(f'Source dimensions changed: {id}')
        target = art_path(root, art['path'])
        if target.resolve().parent != art_path(root, 'assets-display/alternative').resolve() or not target.is_file():
            raise ValueError(f'Desktop scene output is not an existing display ID: {id}')
        if digest(target) != catalog['hashes'][target.name]:
            raise ValueError(f'Desktop export changed outside its catalog: {id}')
        with Image.open(art_path(root, art['mobilePath'])) as phone:
            mobile_size = list(phone.size)
        if mobile_size != art.get('mobileSize', art['size']):
            raise ValueError(f'Phone dimensions differ from catalog: {id}')
        if digest(art_path(root, art['mobilePath'])) != catalog['hashes'][Path(art['mobilePath']).name]:
            raise ValueError(f'Phone export changed outside its catalog: {id}')
        jobs.append((id, source, target, mobile_size))
        requests.append({'path': 'environments/scene-' + id + '.webp', 'width': size[0], 'height': size[1]})
    plans = json.loads(subprocess.run(['node', str(root / 'tools/art-export-plan.mjs'), '--desktop-scenes'],
        input=json.dumps(requests), text=True, capture_output=True, check=True, cwd=root).stdout)
    records = []
    with tempfile.TemporaryDirectory(prefix='ashen-desktop-scenes-') as directory:
        for (id, source, target, mobile_size), plan in zip(jobs, plans, strict=True):
            staged = Path(directory) / target.name
            with Image.open(source) as original:
                image = original.convert('RGBA' if 'A' in original.getbands() else 'RGB')
                if list(image.size) != [plan['width'], plan['height']]:
                    image = image.resize((plan['width'], plan['height']), Image.Resampling.LANCZOS)
                image.save(staged, format='WEBP', quality=plan['quality'], alpha_quality=plan['alphaQuality'], method=6)
            records.append({'id': id, 'path': target.relative_to(authoring_root(root) / 'common').as_posix(), 'sourceSha256': digest(source),
                'beforeBytes': target.stat().st_size, 'afterBytes': staged.stat().st_size,
                'size': [plan['width'], plan['height']], 'mobileSize': mobile_size, 'sha256': digest(staged)})
        added = sum(row['afterBytes'] - row['beforeBytes'] for row in records)
        if added > 20_000_000:
            raise ValueError(f'Desktop scenery would add {added:,} raw bytes; review its download cost before adopting')
        if phone_snapshot(root, catalog) != phones:
            raise ValueError('Phone exports changed during desktop staging')
        for row in records:
            shutil.copyfile(Path(directory) / Path(row['path']).name, art_path(root, row['path']))
            art = catalog['sceneLayers'][row['id']]
            art['size'], art['mobileSize'] = row['size'], row['mobileSize']
            catalog['hashes'][Path(row['path']).name] = row['sha256']
        if catalog['sources'] != original_sources or phone_snapshot(root, catalog) != phones:
            raise ValueError('Desktop scene export changed source provenance or phone bytes')
        result = text[:match.start(1)] + json.dumps(catalog, separators=(',', ':')) + text[match.end(1):]
        catalog_path.write_text(result, encoding='utf-8', newline='\n')
    print(json.dumps({'desktopScenes': len(records), 'beforeBytes': sum(row['beforeBytes'] for row in records),
        'afterBytes': sum(row['afterBytes'] for row in records), 'phoneFilesPreserved': len(phones), 'exports': records}, indent=2))
