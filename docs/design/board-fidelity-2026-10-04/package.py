"""Verify a standalone correction kit and make a deterministic, owned-file ZIP."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
import argparse, hashlib, json, re, zipfile
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parent
HELPERS={'build-package.cjs','build-vectors.cjs','render-vector-review.cjs','render-filled-comparisons.cjs','render-menu-comparison.cjs','svg-utils.cjs','package.py','index.html','manifest.json','vector-manifest.json','vector-recipes.json','vector-theme.css','README.md','VECTOR-README.md','COVERAGE.md','CREDITS.md'}
REVIEWS={'abilities-source-comparison.png','portraits-and-objects-source-comparison.png','board-icon-library.png','card-family-comparison.png','control-skins.png','filled-five-family-comparison.png','mobile-draft-filled.png','panels-and-five-families.png','parchment-treatment-comparison.png','vector-validation.json','menu-comparison.png'}
SPECIAL={'SHA256SUMS.txt','package-inventory.json'}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def owned():
    manifest=read(ROOT/'manifest.json');vectors=read(ROOT/manifest['vectorManifest'])
    files=set(HELPERS)|{'review/'+f for f in REVIEWS}
    files.update('fonts/'+f for f in ['OFL.txt','cinzel-400-normal.woff2','cormorant-garamond-500-normal.woff2','inter-400-normal.woff2'])
    files.add('assets/materials/weathered-parchment.webp')
    files.add('provenance/deck-tool-attempts.json')
    for a in manifest['assets']:
        files.update(a[k] for k in ['file','mobileFile','master','provenance'])
        files.add(a['source']['board'])
        receipt=read(local_file(a['provenance']))
        if receipt.get('previousVersionRecord'):files.add(receipt['previousVersionRecord'])
    for a in vectors['assets']:
        files.add(a['file']);files.add(a['sourceBoard'])
        for layer in a.get('textureLayers',[]):
            if isinstance(layer,str):files.add(layer)
            elif isinstance(layer,dict) and (layer.get('file') or layer.get('source')):files.add(layer.get('file') or layer['source'])
    for name in files:local_file(name)
    return sorted(files)
def local_file(name):
    path=PurePosixPath(name)
    assert not path.is_absolute() and '..' not in path.parts and ':' not in name and '\\' not in name,name
    result=ROOT.joinpath(*path.parts)
    assert result.is_file(),f'Missing portable file: {name}'
    assert result.resolve().is_relative_to(ROOT.resolve()),name
    return result
class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ('href','src') and value and not value.startswith(('#','data:')):
                local_file(value.split('#')[0])
def validate():
    manifest=read(ROOT/'manifest.json');vm=read(ROOT/manifest['vectorManifest']);vectors=vm['assets']
    def rectangle(coords):
        assert len(coords)==4 and all(isinstance(n,(int,float)) for n in coords),coords
        x,y,w,h=coords
        assert x>=0 and y>=0 and w>0 and h>0 and x+w<=1448 and y+h<=1086,coords
    for name,digest in vm.get('sourceBoardHashes',{}).items():
        choices={a['sourceBoard'] for a in vectors if Path(a['sourceBoard']).name.startswith(name+'-')}
        assert len(choices)==1,name
        local=choices.pop()
        assert sha(local_file(local))==digest,name
    ids=[]
    for a in manifest['assets']:
        ids.append(a['id'])
        assert sha(local_file(a['master']))==a['masterSha256'],a['id']
        assert sha(local_file(a['file']))==a['sha256'],a['id']
        assert sha(local_file(a['mobileFile']))==a['mobileSha256'],a['id']
        r=read(local_file(a['provenance']))
        assert r['sha256']==a['masterSha256'] and r['savedUnchanged'],a['id']
        local_file(a['source']['board'])
        rectangle(a['source']['pixels'])
        png=local_file(a['master']).read_bytes()
        assert png[:8]==b'\x89PNG\r\n\x1a\n' and png[12:16]==b'IHDR',a['id']
        assert int.from_bytes(png[16:20],'big')==a['width'] and int.from_bytes(png[20:24],'big')==a['height'],a['id']
        if a['kind'] in ('objects','portraits'):
            assert a['hasAlpha'] and r['alphaExtrema'][0]==0 and r['alphaExtrema'][1]>0,a['id']
            assert a['alphaVerification']['fullSize']=='pixel-identical alpha plane',a['id']
            assert a['alphaVerification']['mobileRange'][0]==0 and a['alphaVerification']['mobileRange'][1]>0,a['id']
        assert max(a['mobileDimensions'])<=640 and min(a['mobileDimensions'])>0,a['id']
    for a in vectors:
        ids.append(a['id']);p=local_file(a['file']);local_file(a['sourceBoard'])
        data=p.read_text(encoding='utf-8');tree=ET.fromstring(data)
        assert sha(p)==a['sha256'],a['id']
        assert float(tree.attrib['width'])==a['width'] and float(tree.attrib['height'])==a['height'],a['id']
        rectangle(a['sourceRegion']['pixels'])
        assert not re.search(r'<(?:script|text)\b|\son\w+=',data,re.I),a['id']
        declared=[e.attrib['id'] for e in tree.iter() if 'id' in e.attrib]
        assert len(declared)==len(set(declared)),a['id']
        for e in tree.iter():
            for key,value in e.attrib.items():
                if key.endswith('href') and not value.startswith(('#','data:')):local_file(value)
    assert len(ids)==len(set(ids)),'Duplicate IDs'
    assert len([a for a in manifest['assets'] if a['kind']=='abilities'])==26,'Expected all26 ability versions'
    assert len([a for a in manifest['assets'] if a['kind']=='portraits'])==4,'Expected four class portraits'
    assert len([a for a in manifest['assets'] if a['kind']=='objects'])==6,'Expected six weapon cutouts'
    for p in ROOT.glob('*.html'):
        Links().feed(p.read_text(encoding='utf-8'))
    for f in ('fonts/OFL.txt','review/abilities-source-comparison.png','review/portraits-and-objects-source-comparison.png','review/filled-five-family-comparison.png'):local_file(f)
    print(f'Validated {len(manifest["assets"])} raster assets and {len(vectors)} vectors; portable links and original master hashes pass.')
def inventory():
    files=owned();allfiles=sorted(files+list(SPECIAL))
    (ROOT/'package-inventory.json').write_text(json.dumps({'schemaVersion':1,'files':allfiles,'count':len(allfiles)},indent=2)+'\n',encoding='utf-8',newline='\n')
    checks=files+['package-inventory.json']
    (ROOT/'SHA256SUMS.txt').write_text(''.join(sha(ROOT/f)+'  '+f+'\n' for f in sorted(checks)),encoding='utf-8',newline='\n')
    return allfiles
def verify_inventory():
    inv=read(ROOT/'package-inventory.json')['files']
    assert inv==sorted(owned()+list(SPECIAL)),'Inventory differs from owned files'
    seen=[]
    for line in (ROOT/'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
        digest,name=line.split('  ',1);assert sha(local_file(name))==digest,name;seen.append(name)
    assert sorted(seen)==sorted(n for n in inv if n!='SHA256SUMS.txt'),'Hash inventory incomplete'
    print(f'Owned inventory verified: {len(inv)} files.')
def archive(files):
    target=ROOT.with_suffix('.zip')
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name in files:
            info=zipfile.ZipInfo(ROOT.name+'/'+name,date_time=(2026,10,4,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
            z.writestr(info,(ROOT/name).read_bytes())
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert sorted(z.namelist())==sorted(ROOT.name+'/'+n for n in files)
        for name in files:assert hashlib.sha256(z.read(ROOT.name+'/'+name)).hexdigest()==sha(ROOT/name),name
    digest=sha(target)
    target.with_suffix('.zip.sha256').write_text(digest+'  '+target.name+'\n',encoding='ascii')
    print(f'ZIP verified: {target.name}; {len(files)} entries; {target.stat().st_size} bytes; SHA256 {digest}')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--verify',action='store_true');p.add_argument('--zip',action='store_true');args=p.parse_args()
    validate()
    if args.zip:archive(inventory())
    elif args.verify:verify_inventory()
    else:inventory()
