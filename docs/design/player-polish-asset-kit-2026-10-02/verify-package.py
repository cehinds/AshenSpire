from pathlib import Path
from PIL import Image
from html.parser import HTMLParser
import os,json,re,hashlib,subprocess,xml.etree.ElementTree as ET,zipfile
ROOT=Path(__file__).resolve().parent
REPO=Path(os.environ.get('ASHENSPIRE_REPO', ROOT.parents[2])).resolve()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((ROOT/'manifest.json').read_text())
assert len(manifest['assets'])==194
assert len({a['id'] for a in manifest['assets']})==194
for a in manifest['assets']:
 p=ROOT/a['file'];assert p.is_file(),p
 assert p.stat().st_size==a['bytes'] and sha(p)==a['sha256'],p
 if p.suffix=='.svg':
  tree=ET.parse(p);r=tree.getroot();assert int(r.attrib['width'])==a['width'] and int(r.attrib['height'])==a['height'],p
  assert not any(e.tag.split('}')[-1] in ['text','script','image','foreignObject'] for e in r.iter()),p
 else:
  im=Image.open(p);assert im.size==(a['width'],a['height']),p
for f in json.loads((ROOT/'feature-map.json').read_text())['features']:
 for p in f['desktopArtwork']+f['mobileArtwork']+f['sharedAssets']:assert (ROOT/p).is_file(),p
 for p in f['sourceModules']:assert (REPO/p).is_file(),p
for a in manifest['fonts']: assert sha(ROOT/a['file'])==a['sha256']
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
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
(ROOT/'SHA256SUMS.txt').write_text(''.join(sha(p)+'  '+p.relative_to(ROOT).as_posix()+'\n' for p in files),encoding='utf-8',newline='\n')
files=sorted(p for p in ROOT.rglob('*') if p.is_file())
archive=ROOT.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,ROOT.name+'/'+p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(archive) as z:
 assert len(z.infolist())==len(files)
 for p,entry in zip(files,z.infolist()):
  assert not entry.filename.startswith(('/','\\')) and '..' not in Path(entry.filename).parts
  assert hashlib.sha256(z.read(entry)).hexdigest()==sha(p)
checksum=sha(archive)
archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='utf-8')
print(json.dumps({'files':len(files),'checksumRecords':len(files)-1,'archiveBytes':archive.stat().st_size,'archiveSha256':checksum,'archive':str(archive),'counts':manifest['counts']}))
