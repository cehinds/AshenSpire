from pathlib import Path
import hashlib,zipfile
root=Path(__file__).resolve().parent
files=sorted(p for p in root.rglob('*') if p.is_file() and p.suffix!='.zip' and p.name not in ('SHA256SUMS.txt','package-sha256.txt') and '__pycache__' not in p.parts)
(root/'SHA256SUMS.txt').write_text('\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(root).as_posix() for p in files)+'\n',encoding='utf-8',newline='\n')
files.append(root/'SHA256SUMS.txt')
dest=root/'ashenspire-combat-art.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:
        info=zipfile.ZipInfo(p.relative_to(root).as_posix(),date_time=(2026,10,5,12,0,0));info.compress_type=zipfile.ZIP_STORED if p.suffix in ('.png','.jpg','.webp') else zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
        z.writestr(info,p.read_bytes())
digest=hashlib.sha256(dest.read_bytes()).hexdigest()
(root/'package-sha256.txt').write_text(digest+'  '+dest.name+'\n',encoding='utf-8',newline='\n')
print(f'{len(files)} files | {dest.stat().st_size:,} bytes | sha256 {digest}')
