"""Verify the owned portable delivery and create a fixed-metadata ZIP."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
import hashlib, json, re, subprocess, zipfile, xml.etree.ElementTree as ET
from PIL import Image
ROOT=Path(__file__).resolve().parent

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def safe(relative):
    p=PurePosixPath(relative)
    if p.is_absolute() or '..' in p.parts or '\\' in relative or ':' in relative:raise ValueError('Unsafe path '+relative)
    target=ROOT.joinpath(*p.parts)
    if not target.resolve().is_relative_to(ROOT.resolve()):raise ValueError('Escaping path '+relative)
    if not target.is_file():raise ValueError('Missing '+relative)
    return target

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.scripts=[];self.current=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        self.links += [attrs[k] for k in ['src','href'] if k in attrs]
        if tag=='script':self.current='' if attrs.get('type')!='application/json' else None
    def handle_data(self,data):
        if self.current is not None:self.current+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None:self.scripts.append(self.current);self.current=None

def inventory(m,recipes):
    owned=set()
    root_files=['README.md','CREDITS.md','SOURCE-CREDITS.md','VALIDATION.md','manifest.json',
                'generation.json','screen-recipes.json','breakdown.json','source-canonical-map.json',
                'source-generation.json','index.html','gallery-template.html','components.css',
                'build-collection.py','build-recipes.py','build-gallery.py','render-previews.cjs','verify-collection.py']
    for name in root_files:safe(name);owned.add(name)
    for a in m['assets']:
        owned.add(a['file'])
        for key in ['master','generation']:
            if a.get(key):owned.add(a[key])
    owned.update(a['file'] for a in m['fonts'])
    owned.add('fonts/OFL.txt')
    owned.update('recipes/'+r['id']+'.json' for r in recipes)
    owned.update(r['reference'] for r in recipes)
    owned.update('review/'+name+'.png' for name in ['new-art','enemies','decorations'])
    groups=(len([a for a in m['assets'] if a['kind']=='component'])+23)//24
    owned.update('review/boxes-menus-'+str(i)+'.png' for i in range(1,groups+1))
    for p in owned:safe(p)
    if len({p.casefold() for p in owned})!=len(owned):raise ValueError('Case-fold collision')
    return sorted(owned)

def run():
    m=json.loads(safe('manifest.json').read_text(encoding='utf-8'))
    records=m['assets']; files=set();ids=set()
    for a in records:
        if a['file'] in files or a['id'] in ids:raise ValueError('Duplicate asset '+a['id'])
        files.add(a['file']);ids.add(a['id']);p=safe(a['file'])
        if sha(p)!=a['sha256']:raise ValueError('Hash mismatch '+a['file'])
        if p.suffix=='.svg':
            tree=ET.fromstring(p.read_bytes())
            w,h=map(float,[tree.attrib['width'],tree.attrib['height']])
            if (w,h)!=(a['width'],a['height']):raise ValueError('SVG dimensions '+a['id'])
            for element in tree.iter():
                for k,v in element.attrib.items():
                    if k.endswith('href') and not v.startswith('#'):raise ValueError('External SVG link '+a['id'])
            if 'nineSliceInsets' in a:
                top,right,bottom,left=a['nineSliceInsets']
                if top+bottom>=h or left+right>=w:raise ValueError('Slice caps consume image '+a['id'])
        else:
            with Image.open(p) as im:
                if im.size!=(a['width'],a['height']):raise ValueError('Raster dimensions '+a['id'])
                if a.get('alphaRange'):
                    if list(im.getchannel('A').getextrema())!=a['alphaRange']:raise ValueError('Export alpha changed '+a['id'])
            if a.get('master'):
                original=safe(a['master'])
                if sha(original)!=a['masterSha256']:raise ValueError('Master hash changed '+a['id'])
                if a['export']['resized'] or a['export']['cropped']:raise ValueError('Unexpected raster manipulation')
                with Image.open(original) as im:
                    if im.size!=(a['width'],a['height']):raise ValueError('Master/export size mismatch')
                    if a['export']['lossless']:
                        with Image.open(p) as exported:
                            if im.getchannel('A').tobytes()!=exported.getchannel('A').tobytes():
                                raise ValueError('Cutout alpha pixels changed '+a['id'])
                generation=json.loads(safe(a['generation']).read_text(encoding='utf-8'))
                if generation.get('sourceMasterSha256') and generation['sourceMasterSha256']!=a['masterSha256']:
                    raise ValueError('Generator provenance hash mismatch '+a['id'])
                if generation.get('sourcePromptSha256') and hashlib.sha256(generation['prompt'].encode('utf-8')).hexdigest()!=generation['sourcePromptSha256']:
                    raise ValueError('Exact UTF-8 prompt changed '+a['id'])
                references=generation.get('refs',[])+generation.get('previousVersion',{}).get('refs',[])
                for reference in references:
                    if reference.get('packageReference'):safe(reference['packageReference'])
                if generation.get('reference'):safe(generation['reference'])
                for source in generation.get('sourceLore',[]):
                    if source.get('packageReference'):safe(source['packageReference'])
    for a in m['fonts']:
        if sha(safe(a['file']))!=a['sha256']:raise ValueError('Font changed '+a['file'])
    rs=json.loads(safe('screen-recipes.json').read_text(encoding='utf-8'))['recipes']
    if len(rs)!=24 or len({r['id'] for r in rs})!=24:raise ValueError('Expected 24 unique recipes')
    for r in rs:
        safe(r['reference']);safe('recipes/'+r['id']+'.json')
        if r['unresolvedIconAliases']:raise ValueError('Unresolved icons '+r['id'])
        paths=r['components']+r['icons']+r['sharedAssets']+r['decorations']
        for d in ['desktop','mobile']:paths+=r['artwork'][d]+r['newPerspectiveOptions'][d]
        for p in paths:
            if p not in files:raise ValueError('Recipe not in manifest '+p)
        if len(r['layerOrder'])!=8 or not r['liveFields']:raise ValueError('Incomplete layer recipe')
    links=Links();links.feed(safe('index.html').read_text(encoding='utf-8'))
    count=0
    for url in links.links:
        if url.startswith(('data:','https:','http:','#')):continue
        safe(url.split('#')[0]);count+=1
    for url in re.findall(r'url\(([^)]+)\)',safe('components.css').read_text(encoding='utf-8')):
        safe(url.strip('"\''));count+=1
    for js in links.scripts:
        subprocess.run(['node','--check','-'],input=js,text=True,check=True,capture_output=True)
    subprocess.run(['node','--check',str(safe('render-previews.cjs'))],check=True,capture_output=True)
    owned=inventory(m,rs)
    sums=''.join(sha(safe(p))+'  '+p+'\n' for p in owned)
    (ROOT/'SHA256SUMS.txt').write_text(sums,encoding='utf-8',newline='\n')
    archive=ROOT.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
        for p in sorted(owned+['SHA256SUMS.txt']):
            info=zipfile.ZipInfo(ROOT.name+'/'+p,(2026,10,4,0,0,0))
            info.create_system=3;info.external_attr=0o100644<<16;info.extra=b'';info.comment=b''
            z.writestr(info,safe(p).read_bytes())
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:raise ValueError('Corrupt ZIP')
        if len(z.namelist())!=len(owned)+1:raise ValueError('ZIP inventory mismatch')
    digest=sha(archive)
    archive.with_suffix('.zip.sha256').write_text(digest+'  '+archive.name+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'artwork':len(records),'fonts':len(m['fonts']),'recipes':len(rs),
                      'localLinks':count,'ownedFiles':len(owned),'zipEntries':len(owned)+1,
                      'zipBytes':archive.stat().st_size,'zipSha256':digest},indent=2))

if __name__=='__main__':run()
