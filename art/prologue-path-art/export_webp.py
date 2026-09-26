"""Export the regional journey plates without resizing or cropping."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parent
repo = root.parent.parent
assets = []
for region in ('weald', 'marches', 'reach', 'crownfall'):
    for layout in ('desktop', 'mobile'):
        name = f'step-{region}-{layout}'
        master = root / 'masters' / f'{name}.png'
        output = repo / 'assets' / 'prologue' / f'{name}.webp'
        with Image.open(master) as image:
            image.convert('RGB').save(output, 'WEBP', quality=84, method=6)
            dimensions = list(image.size)
        with Image.open(output) as encoded:
            encoded.load()
            assert list(encoded.size) == dimensions
        assets.append({
            'name': name,
            'master': str(master.relative_to(repo)).replace('\\', '/'),
            'deliverable': str(output.relative_to(repo)).replace('\\', '/'),
            'dimensions': dimensions,
            'masterBytes': master.stat().st_size,
            'webpBytes': output.stat().st_size,
            'masterSha256': hashlib.sha256(master.read_bytes()).hexdigest(),
            'webpSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        })
(root / 'manifest.json').write_text(json.dumps({
    'tool': 'built-in image_gen.imagegen',
    'webp': {'quality': 84, 'method': 6, 'resize': False, 'crop': False},
    'assets': assets,
}, indent=2) + '\n', encoding='utf-8')
print(json.dumps(assets, indent=2))
