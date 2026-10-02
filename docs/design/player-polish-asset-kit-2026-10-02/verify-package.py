from pathlib import Path, PurePosixPath
from PIL import Image
from html.parser import HTMLParser
import os,json,re,hashlib,subprocess,xml.etree.ElementTree as ET,zipfile
ROOT=Path(__file__).resolve().parent
REPO=Path(os.environ.get('ASHENSPIRE_REPO', ROOT.parents[2])).resolve()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def package_inventory(root):
 records=[];seen=set()
 for line in (root/'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
  match=re.fullmatch(r'([0-9a-f]{64})  (.+)',line)
  assert match, f'Invalid checksum inventory record: {line!r}'
  name=match.group(2);relative=PurePosixPath(name)
  assert name and '\\' not in name and ':' not in name and not relative.is_absolute(),name
  assert relative.as_posix()==name and all(part not in ('.','..') for part in relative.parts),name
  assert name!='SHA256SUMS.txt' and name.casefold() not in seen,f'Duplicate inventory path: {name}'
  target=root/name
  assert target.is_file() and target.resolve().is_relative_to(root.resolve()),name
  seen.add(name.casefold());records.append(name)
 assert records,'Empty package inventory'
 return sorted(records)
def write_archive(root,names,archive):
 # Never inherit checkout mtime, mode or host OS metadata. Fixed ZIP bytes are
 # reproducible for the same file bytes and Python/zlib versions.
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for name in sorted(names):
   entry=zipfile.ZipInfo(root.name+'/'+name,date_time=(1980,1,1,0,0,0))
   entry.create_system=3
   entry.external_attr=0o100644 << 16
   entry.compress_type=zipfile.ZIP_DEFLATED
   entry.extra=b'';entry.comment=b''
   z.writestr(entry,(root/name).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
owned=package_inventory(ROOT)
owned_set=set(owned)
manifest=json.loads((ROOT/'manifest.json').read_text())
assert len(manifest['assets'])==194
assert len({a['id'] for a in manifest['assets']})==194
for a in manifest['assets']:
 assert a['file'] in owned_set,a['file']
 p=ROOT/a['file'];assert p.is_file(),p
 assert p.stat().st_size==a['bytes'] and sha(p)==a['sha256'],p
 if p.suffix=='.svg':
  tree=ET.parse(p);r=tree.getroot();assert int(r.attrib['width'])==a['width'] and int(r.attrib['height'])==a['height'],p
  assert not any(e.tag.split('}')[-1] in ['text','script','image','foreignObject'] for e in r.iter()),p
 else:
  im=Image.open(p);assert im.size==(a['width'],a['height']),p
for f in json.loads((ROOT/'feature-map.json').read_text())['features']:
 for p in f['desktopArtwork']+f['mobileArtwork']+f['sharedAssets']:assert p in owned_set and (ROOT/p).is_file(),p
 for p in f['sourceModules']:assert (REPO/p).is_file(),p
for a in manifest['fonts']: assert a['file'] in owned_set and sha(ROOT/a['file'])==a['sha256']
links=[]
class Parser(HTMLParser):
 def handle_starttag(self,t,attrs):
  links.extend(v for k,v in attrs if k in ['src','href'] and not v.startswith(('http:','https:','#','data:')))
for p in [ROOT/'index.html',ROOT/'ui/index.html']:
 links.clear();Parser().feed(p.read_text(encoding='utf-8'))
 for u in links: assert (p.parent/u.split('#')[0]).is_file(),(p,u)
 for u in re.findall(r'url\([\"\']?([^\)\"\']+)',p.read_text(encoding='utf-8')):assert (p.parent/u).is_file(),(p,u)
 js=re.findall(r'<script>(.*?)</script>',p.read_text(encoding='utf-8'),re.S)
 if js:
  subprocess.run(['node','--check','-'],input='\n'.join(js),text=True,check=True)
source=(ROOT/'ui/generate-ui-kit.py').read_text(encoding='utf-8');start=source.index("css='''")+7;stop=source.index("'''",start)
assert source[start:stop]==(ROOT/'ui/theme.css').read_text(encoding='utf-8')
for a in manifest['assets']:
 if a['origin'] not in ('new-ai-generated-illustration','canonical-repository-copy'): continue
 source=Path(a['source']) if a['origin']=='new-ai-generated-illustration' else REPO/a['source']
 if source.is_file(): assert sha(source)==a['sha256'],source
 else: print(f'Original source unavailable: {source}; delivered manifest hash already verified.')
assert all(p in owned_set for p in ['manifest.json','feature-map.json','index.html','ui/index.html','ui/theme.css','ui/generate-ui-kit.py'])
(ROOT/'SHA256SUMS.txt').write_text(''.join(sha(ROOT/name)+'  '+name+'\n' for name in owned),encoding='utf-8',newline='\n')
names=sorted(owned+['SHA256SUMS.txt'])
archive=ROOT.with_suffix('.zip')
write_archive(ROOT,names,archive)
with zipfile.ZipFile(archive) as z:
 assert len(z.infolist())==len(names)
 for name,entry in zip(names,z.infolist()):
  assert entry.filename==ROOT.name+'/'+name
  assert not entry.filename.startswith(('/','\\')) and '..' not in Path(entry.filename).parts
  assert entry.date_time==(1980,1,1,0,0,0) and entry.create_system==3 and entry.external_attr==0o100644 << 16
  assert hashlib.sha256(z.read(entry)).hexdigest()==sha(ROOT/name)
checksum=sha(archive)
archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'files':len(names),'checksumRecords':len(owned),'archiveBytes':archive.stat().st_size,'archiveSha256':checksum,'archive':str(archive),'counts':manifest['counts']}))
