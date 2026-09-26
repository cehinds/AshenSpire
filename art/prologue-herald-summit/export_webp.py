"""Encode the unchanged PNG masters as WebP; no crop, resize, or retouch."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parent
assets = []
for variant in ('desktop', 'mobile'):
    source = root / 'masters' / f'carry-herald-{variant}.png'
    target = root / 'deliverables' / f'carry-herald-{variant}.webp'
    with Image.open(source) as master:
        master.convert('RGB').save(target, 'WEBP', quality=90, method=6)
        dimensions = list(master.size)
    with Image.open(target) as exported:
        exported.load()
        assert list(exported.size) == dimensions
    assets.append({
        'variant': variant, 'dimensions': dimensions,
        'master': str(source.relative_to(root)).replace('\\', '/'),
        'deliverable': str(target.relative_to(root)).replace('\\', '/'),
        'integration_destination': f'assets/prologue/{target.name}',
        'master_bytes': source.stat().st_size,
        'webp_bytes': target.stat().st_size,
        'reduction_percent': round(100 * (1 - target.stat().st_size / source.stat().st_size), 1),
        'master_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'webp_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    })
manifest = {'tool': 'built-in image_gen.imagegen', 'encoding': {'format': 'WebP', 'quality': 90, 'method': 6, 'resize': False, 'crop': False}, 'assets': assets}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))
