"""Package the current standalone viewer, PNGs and JSON without source atlases."""
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / 'cutout-manifest.json').read_text())
out = root / f"card-art-cutouts-v{data['revision']}.zip"
files = ['cutouts.html', 'cutout-compositor.js', 'cutouts-data.js', 'cutout-manifest.json',
         'objects-overview.html', 'art-selection-v3.json', 'art-catalog.json',
         'art-proposals-v2.json', 'CUTOUTS.md', 'object-generation-notes.json',
         'expansion-v4.json', '70-objects.png', '50-new-objects.png', 'counter-pairs.png']
if data['revision'] >= 5:
    files += ['source-breakdown.html', 'reuse-v5.json', 'reuse-overview.png']
    files += [str(path.relative_to(root)) for path in (root/'source-art-v5').glob('*.webp')]
if data['revision'] >= 6:
    files += ['layer-math.js', 'expansion-v6.html', 'expansion-v6.json', 'magic-preview.png', '80-new-objects.png']
    files += [str(path.relative_to(root)) for path in (root/'source-art-v6').glob('*.png')]
if data['revision'] >= 7:
    files += ['revision-v7.json']
if data['revision'] >= 8:
    files += ['revision-v8.json', 'silhouette-reference.png', 'sword-scepter-preview.png']
if data['revision'] >= 9:
    files += ['revision-v9.json', 'scythe-scepter-preview.png']
if data['revision'] >= 10:
    files += ['revision-v10.json']
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
    for path in sorted((root / 'cutouts').rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(root))
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    assert all(a['src'] in archive.namelist() for a in data['assets'].values())
print(f'Packaged and checked {out.name}: {out.stat().st_size / 1024 / 1024:.1f} MiB')
