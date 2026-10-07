from pathlib import Path
import hashlib

PACK=Path(__file__).resolve().parent.parent
excluded={'SHA256SUMS.txt','package-sha256.txt'}
files=sorted(p for p in PACK.rglob('*') if p.is_file() and p.suffix!='.zip' and p.name not in excluded and '__pycache__' not in p.parts)
(PACK/'SHA256SUMS.txt').write_text('\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(PACK).as_posix() for p in files)+'\n',encoding='utf-8',newline='\n')
print(f'Updated source-package manifest: {len(files)} files; previous ZIP and ZIP receipt are unchanged')
