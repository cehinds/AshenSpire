"""Create a deterministic checksum inventory for this source package."""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parent
files = sorted(p for p in root.rglob('*') if p.is_file()
               and '__pycache__' not in p.parts and p.name != 'SHA256SUMS.txt')
lines = [f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root).as_posix()}' for p in files]
(root / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Inventoried {len(files)} files')
