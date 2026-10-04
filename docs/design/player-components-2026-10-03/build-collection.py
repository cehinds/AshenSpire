"""Build a portable, layered player-art collection. Original PNGs remain untouched."""
from pathlib import Path
from html import escape
import base64, hashlib, json, shutil, xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
BASE = REPO / 'docs/design/player-polish-asset-kit-2026-10-02'
BOARDS = REPO / 'docs/design/player-polish-2026-10-01'
ASSETS = []

def save(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8', newline='\n')

def json_save(path, value):
    save(path, json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def adopt():
    previous = json.loads((ROOT/'manifest.json').read_text(encoding='utf-8')) if (ROOT/'manifest.json').is_file() else {'assets':[]}
    source = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
    for a in source['assets']:
        dest = 'assets/reused/' + a['file']
        (ROOT / dest).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(BASE / a['file'], ROOT / dest)
        ASSETS.append({**a, 'id': 'base:' + a['id'], 'file': dest,
                       'source': 'docs/design/player-polish-asset-kit-2026-10-02/' + a['file'],
                       'origin': 'unchanged-existing-kit-copy', 'sha256': sha(ROOT / dest)})
    for a in source['fonts']:
        dest = 'fonts/' + Path(a['file']).name
        (ROOT / dest).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(BASE / a['file'], ROOT / dest)
    shutil.copyfile(BASE / 'fonts/OFL.txt', ROOT / 'fonts/OFL.txt')
    shutil.copyfile(BASE / 'canonical-map.json', ROOT / 'source-canonical-map.json')
    shutil.copyfile(BASE / 'generation.json', ROOT / 'source-generation.json')
    save('SOURCE-CREDITS.md', (REPO / 'CREDITS.md').read_text(encoding='utf-8').replace('\r\n', '\n'))
    (ROOT / 'references').mkdir(exist_ok=True)
    for p in sorted(BOARDS.glob('*.png')):
        shutil.copyfile(p, ROOT / 'references' / p.name)
    extra = ['assets/equipment/body_reaver_default.webp',
             'assets/equipment/icon_battleaxe.webp', 'assets/equipment/weapon_halberd.webp',
             'assets/equipment/weapon_katana.webp', 'assets/relics/goldFigurine.webp',
             'assets/relics/gravetendersBell.webp', 'assets/relics/ivoryComb.webp',
             'assets/relics/starstoneShard.webp']
    for path in extra:
        p = REPO/path
        dest = 'assets/canonical-extra/'+p.name
        if not p.is_file():
            # Runtime art now lives in the external art repository. Preserve the
            # delivered historical source snapshot rather than silently rebind it.
            record=next((a for a in previous['assets'] if a.get('source')==path and a.get('origin')=='unchanged-canonical-repository-copy'),None)
            if not record or not (ROOT/dest).is_file() or sha(ROOT/dest)!=record['sha256']:
                raise ValueError('Missing canonical source and verified snapshot '+path)
            ASSETS.append(record)
            continue
        (ROOT/dest).parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(p,ROOT/dest)
        with Image.open(p) as im:w,h=im.size
        ASSETS.append({'id':'canonical-extra:'+p.stem,'file':dest,'source':path,
                       'kind':'canonical','width':w,'height':h,'sha256':sha(p),
                       'origin':'unchanged-canonical-repository-copy','transformed':False})

def defs(name):
    return f'''<defs>
      <linearGradient id="{name}-metal" x1="0" y1="0" x2="0.6" y2="1"><stop stop-color="#514535"/><stop offset=".18" stop-color="#dcc18a"/><stop offset=".38" stop-color="#a88c53"/><stop offset=".64" stop-color="#554837"/><stop offset=".82" stop-color="#bd9c59"/><stop offset="1" stop-color="#534536"/></linearGradient>
      <linearGradient id="{name}-soot" x2="0" y2="1"><stop stop-color="#242019"/><stop offset=".45" stop-color="#15130f"/><stop offset="1" stop-color="#0c0c0a"/></linearGradient>
      <radialGradient id="{name}-light"><stop stop-color="#d6b667" stop-opacity=".26"/><stop offset="1" stop-color="#d6b667" stop-opacity="0"/></radialGradient>
    </defs>'''

def corners(w, h, name, inset=8, size=24):
    # All detail sits inside fixed corner caps, safe for nine-slice.
    body = ''
    for x, y, sx, sy in [(inset,inset,1,1),(w-inset,inset,-1,1),
                          (inset,h-inset,1,-1),(w-inset,h-inset,-1,-1)]:
        body += f'''<g transform="translate({x} {y}) scale({sx*size/24} {sy*size/24})" stroke="url(#{name}-metal)" stroke-width=".8" fill="none">
          <path d="M0 24V0h24M5 20V5h15M0 13l7-7 6-6M0 22c9 0 17-6 17-14-5 0-8 2-8 6 0 3 3 5 6 4"/>
          <path d="m0 0 4 1-3 3Z" fill="#e4cc93"/><path d="M0 5h3M5 0v3" stroke="#f1dfb7"/>
        </g>'''
    return body

def frame(w, h, name, backed=False, selected=False, cap=40):
    body = f'<rect x="3" y="3" width="{w-6}" height="{h-6}" rx="4" fill="'+(f'url(#{name}-soot)' if backed else 'none')+f'" stroke="url(#{name}-metal)" stroke-width="1.8"/>'
    body += f'<rect x="7" y="7" width="{w-14}" height="{h-14}" rx="2" stroke="#a58a52" stroke-opacity=".35"/><rect x="10" y="10" width="{w-20}" height="{h-20}" rx="1" stroke="#070807" stroke-width="2"/>'
    body += corners(w, h, name, size=max(4,min(cap-12,24)))
    body += f'<path d="M{cap} 5H{w-cap}M5 {cap}V{h-cap}" stroke="#f1dfb7" stroke-opacity=".18"/>'
    if selected:
        body += f'<rect x="1.5" y="1.5" width="{w-3}" height="{h-3}" rx="5" stroke="#e8c56b" stroke-width="2"/><path d="m{w/2-5} {h-3} 5 -5 5 5-5 5Z" fill="#e8c56b"/>'
    return body

def svg(name, w, h, body, description, *, cap=None, slots=None, opaque=False):
    content = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" role="img" aria-labelledby="{name}-title"><title id="{name}-title">{escape(description)}</title>{defs(name)}{body}</svg>\n'
    ET.fromstring(content)
    path = f'assets/components/{name}.svg'
    save(path, content)
    a = {'id': name, 'file': path, 'kind': 'component', 'width': w, 'height': h,
         'description': description, 'origin': 'original-vector-authoring',
         'transparentExterior': True, 'opaqueCenter': opaque, 'sha256': sha(ROOT/path)}
    if cap: a['nineSliceInsets'] = cap if isinstance(cap,list) else [cap, cap, cap, cap]
    if slots: a['slots'] = slots
    ASSETS.append(a)

def components():
    for name, backed in [('engraved-folio-frame',False),('engraved-folio-backed',True)]:
        svg(name,360,240,frame(360,240,name,backed), 'Layered worn-brass folio rail with fixed engraved corners', cap=40, opaque=backed)
    for name,w,h in [('choice-row',360,88),('quest-row',360,104),('party-row',360,104),('receipt-row',360,80),('comparison-pane',240,320),('party-card',240,300),('service-inspector',360,400)]:
        body=frame(w,h,name,True,cap=32)
        if name in ('quest-row','party-row'):
            body+=f'<path d="M92 18v{h-36}" stroke="#7c6842" stroke-opacity=".6"/>'
        if name in ('party-card','service-inspector'):
            body+=f'<path d="M18 {h-60}h{w-36}" stroke="#7c6842" stroke-opacity=".6"/>'
        insets = [32,32,32,104] if name in ('quest-row','party-row') else [32,32,72,32] if name in ('party-card','service-inspector') else 32
        svg(name,w,h,body,'Empty '+name.replace('-',' ')+' shell; objects and labels remain separate',cap=insets,opaque=True)
    for name,state in [('action-neutral','neutral'),('action-selected','selected'),('action-ready','ready'),('action-danger','danger'),('action-disabled','disabled')]:
        colors={'neutral':('#b49a64','#201b13'),'selected':('#e7c567','#332818'),'ready':('#87ab62','#142713'),'danger':('#b25745','#321611'),'disabled':('#71695a','#1d1b17')}
        edge,bg=colors[state]
        body=f'<rect x="3" y="3" width="314" height="50" rx="4" fill="{bg}" stroke="{edge}" stroke-width="1.5"/><rect x="6" y="6" width="308" height="44" rx="2" stroke="{edge}" stroke-opacity=".4"/><path d="M16 7h288M16 49h288" stroke="#fff0c9" stroke-opacity=".12"/>'
        body+=corners(320,56,name,size=10)
        if state=='selected': body+='<path d="m160 49 5 4-5 3-5-3Z" fill="#e7c567"/>'
        svg(name,320,56,body,'Text-free '+state+' action skin; never imply availability',cap=18,opaque=True)
    svg('focus-ring',320,56,'<rect x=".8" y=".8" width="318.4" height="54.4" rx="5" stroke="#f5e8c9" stroke-width="1.6" stroke-dasharray="5 3"/>','Separate non-color focus state overlay',cap=12)
    svg('selection-ring',96,96,frame(96,96,'selection-ring',False,True,32),'Separate persistent selection overlay',cap=32)
    svg('portrait-mat',160,200,frame(160,200,'portrait-mat',False,cap=32),'Open character/speaker portrait mat',cap=32,slots={'portrait':[12,12,136,176]})
    svg('item-mat',96,96,frame(96,96,'item-mat',True,cap=32),'Opaque item socket backing, independent of item identity',cap=32,slots={'object':[14,14,68,68]},opaque=True)
    n='card-engraved'
    body=frame(240,336,n)+f'<path d="M11 194h218v130H11Z" fill="url(#{n}-soot)" stroke="#745d3d"/><path d="M18 244h204M18 279h204" stroke="#a58a52" stroke-opacity=".4"/>'
    svg(n,240,336,body,'Empty card folio with transparent painting aperture and readable text area',slots={'artwork':[12,12,216,182],'name':[20,200,200,30],'type':[20,248,200,25],'body':[20,284,200,38]},opaque=False)
    svg('card-selection',240,336,frame(240,336,'card-selection',False,True),'Separate chosen-card outline, no baked cost or effect')
    svg('cost-hexagon',48,48,'<path d="m24 2 20 11v22L24 46 4 35V13Z" fill="#182830" stroke="url(#cost-hexagon-metal)" stroke-width="2"/><path d="m24 6 16 9v18L24 42 8 33V15Z" stroke="#dae7e4" stroke-opacity=".45"/>','Empty cost medallion; render actual cost as live text')
    for name,kind in [('chamber-known','known'),('chamber-current','current'),('chamber-unknown','unknown'),('chamber-visited','visited')]:
        body=frame(80,80,name,True,kind=='current',32)
        if kind=='unknown':body+='<path d="M34 30a8 8 0 1 1 13 6c-4 2-7 5-7 9" stroke="#a9a18e" stroke-width="2"/><circle cx="40" cy="52" r="1.5" fill="#a9a18e"/>'
        if kind=='visited':body+='<path d="m29 41 8 8 16-20" stroke="#d6d8bd" stroke-width="2.4" stroke-linecap="round"/>'
        svg(name,80,80,body,'Dungeon chamber '+kind+' shell; live room links are separate')
    for name,kind in [('talent-available','available'),('talent-selected','selected'),('talent-locked','locked'),('talent-learned','learned')]:
        body=f'<circle cx="40" cy="40" r="29" fill="url(#{name}-soot)" stroke="url(#{name}-metal)" stroke-width="2"/><circle cx="40" cy="40" r="26" stroke="#a58a52" stroke-opacity=".55"/>'
        if kind=='selected':body+='<circle cx="40" cy="40" r="34" stroke="#f4ce69"/><path d="m40 1 4 5-4 5-4-5Zm0 68 4 5-4 5-4-5Z" fill="#f4ce69"/>'
        if kind=='locked':body+='<path d="M32 37h16v14H32Zm3 0v-5a5 5 0 0 1 10 0v5" stroke="#8e8978" stroke-width="2"/>'
        if kind=='learned':body+='<path d="m30 40 7 8 14-16" stroke="#d8dfc1" stroke-width="2.5"/>'
        svg(name,80,80,body,'Progression '+kind+' socket; prerequisites from model')
    svg('combat-intent',96,48,frame(96,48,'combat-intent',True,cap=18)+'<path d="m45 43 3 5 3-5Z" fill="#9c493b"/>','Empty threat bubble; live attack icon and value go inside',cap=18,opaque=True)
    for name in ['health-rail','buildup-rail','training-rail']:
        svg(name,240,20,f'<rect x="2" y="2" width="236" height="16" rx="4" fill="#0c0c0a" stroke="url(#{name}-metal)"/><rect x="5" y="5" width="230" height="10" rx="2" stroke="#5e5543" stroke-width=".6"/>','Empty '+name.replace('-',' ')+'; clip independent live fill',cap=8)
    svg('turn-orb',80,80,'<circle cx="40" cy="40" r="36" fill="url(#turn-orb-soot)" stroke="url(#turn-orb-metal)" stroke-width="2"/><circle cx="40" cy="40" r="31" stroke="#e3c068" stroke-opacity=".4"/><path d="M40 1v6M40 73v6M1 40h6M73 40h6" stroke="#dec28b"/>','Unnumbered turn/action orb')
    svg('empty-mount',96,128,'<rect x="8" y="8" width="80" height="112" rx="3" stroke="#8e826a" stroke-dasharray="5 4"/><path d="M40 60h16M48 52v16" stroke="#8e826a"/>','Empty compatible slot, availability supplied by actual model')
    svg('heading-rule',480,20,'<path d="M3 10h217M260 10h217" stroke="url(#heading-rule-metal)"/><path d="m240 1 3 6 14 3-14 3-3 6-3-6-14-3 14-3Z" fill="url(#heading-rule-metal)"/><path d="m3 7 3 3-3 3M477 7l-3 3 3 3" stroke="#d7bb7c"/>','Separate centered heading ornament; preserve aspect ratio')
    for name,w,h in [('hud-rail',480,64),('mobile-action-tray',360,160)]:
        cap=24 if name=='hud-rail' else 32
        svg(name,w,h,frame(w,h,name,True,cap=cap),'Empty '+name.replace('-',' ')+' backing; DOM content and safe area independent',cap=cap,opaque=True)
    for name,axis in [('veil-right','horizontal'),('veil-bottom','vertical'),('veil-uniform','uniform')]:
        vector='x2="1" y2="0"' if axis=='horizontal' else 'x2="0" y2="1"'
        stops='<stop stop-color="#080907" stop-opacity=".72"/><stop offset="1" stop-color="#080907" stop-opacity=".72"/>' if axis=='uniform' else '<stop stop-color="#080907" stop-opacity="0"/><stop offset=".55" stop-color="#080907" stop-opacity=".25"/><stop offset="1" stop-color="#080907" stop-opacity=".92"/>'
        svg(name,360,240,f'<defs><linearGradient id="{name}-veil" {vector}>{stops}</linearGradient></defs><rect width="360" height="240" fill="url(#{name}-veil)"/>','Independent readability '+name.replace('-',' '))
    # Additional menus and boxes requested in the expanded pass.
    for name,w,h in [('menu-window',480,560),('pause-dialog',400,400),
                     ('confirmation-dialog',400,240),('navigation-sidebar',200,600),
                     ('mobile-menu-sheet',360,480),('dropdown-menu',280,240),
                     ('status-tooltip',280,144),('history-receipt',360,320),
                     ('notification-toast',360,88),('settings-section',480,400)]:
        svg(name,w,h,frame(w,h,name,True), 'Empty '+name.replace('-',' ')+' shell; headings, rows and buttons compose separately',cap=40,opaque=True)
    for name,w,h in [('navigation-row',200,56),('navigation-row-selected',200,56),
                     ('accordion-heading',360,56),('search-field',320,48),
                     ('dropdown-option',280,48),('setting-row',360,88),
                     ('filter-tab',128,48),('filter-tab-selected',128,48),
                     ('stat-chip',120,32),('keycap',48,48)]:
        selected=name.endswith('-selected')
        cap=12 if h==32 else 18
        svg(name,w,h,frame(w,h,name,True,selected,cap),'Empty '+name.replace('-',' ')+' surface; semantic HTML supplies its behavior',cap=cap,opaque=True)
    glyphs={
      'motif-endurance':'<path d="m16 2 4 10-1 17-3-4-3 4-1-17Zm-7 9-5 18 6-4 2-11m11-3 5 18-6-4-2-11M16 7v15"/>',
      'motif-agility':'<path d="M16 3 7 14l3 12 6-4 6 4 3-12ZM9 16l7-9 7 9M12 21l4-4 4 4M4 5l5 4M28 5l-5 4"/>',
      'motif-stars':'<circle cx="16" cy="16" r="6"/><path d="M16 1v7M16 24v7M1 16h7M24 16h7M5 5l5 5M22 22l5 5M5 27l5-5M22 10l5-5"/>',
      'motif-oath':'<path d="M16 2v28M6 6v14l5-4M26 6v14l-5-4M12 12l4-5 4 5M9 26l7-5 7 5M4 10l2-5 3 5M23 10l3-5 2 5"/>',
      'zoom-in':'<path d="M16 6v20M6 16h20"/>',
      'zoom-out':'<path d="M6 16h20"/>',
      'event-mark':'<path d="M11 10a6 6 0 1 1 10 4c-3 2-5 4-5 7M16 26v1"/>',
      'favorite-star':'<path d="m16 2 4 9 10 2-7 7 1 11-8-5-8 5 1-11-7-7 10-2Z"/>',
      'host-crown':'<path d="m3 8 7 6 6-11 6 11 7-6-3 17H6ZM7 29h18"/>',
      'timeline-connector':'<path d="M2 16h28M8 13v6M24 13v6"/>'}
    for name,body in glyphs.items():
        svg(name,32,32,'<g stroke="#d6bb7c" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'+body+'</g>',
            'Reference-derived visual motif '+name.replace('-',' ')+'; canonical binding remains explicit')

def generated():
    records=[]
    for p in sorted((ROOT/'generation').glob('*.json')):
        r=json.loads(p.read_text(encoding='utf-8'))
        master=ROOT/r['master']
        if not master.is_file():raise ValueError('Missing generated master '+str(master))
        with Image.open(master) as im:
            width,height=im.size
            alpha=im.getchannel('A').getextrema() if 'A' in im.getbands() else None
            if r['transparent_background'] and (not alpha or alpha[0]!=0 or alpha[1]<250):
                raise ValueError('Cutout missing actual alpha: '+r['id'])
            # Format-only game export. No crop, recolor, resize, alpha editing or new pixels.
            dest='assets/'+r['group']+'/'+r['id']+'.webp'
            (ROOT/dest).parent.mkdir(parents=True,exist_ok=True)
            im.save(ROOT/dest,format='WEBP',quality=92,method=6,lossless=r['transparent_background'])
        ASSETS.append({'id':r['id'],'file':dest,'master':r['master'],'kind':r['group'],
                       'width':width,'height':height,'alphaRange':alpha,'sha256':sha(ROOT/dest),
                       'masterSha256':sha(master),'origin':'built-in-image-generation',
                       'export':{'format':'WebP','quality':92,'lossless':r['transparent_background'],
                                 'resized':False,'cropped':False},'generation':'generation/'+p.name})
        records.append(r)
    json_save('generation.json',{'mode':'built-in image_gen.imagegen','records':records})

def run():
    adopt()
    components()
    generated()
    json_save('manifest.json',{'schema':1,'purpose':'Reusable production art layers decomposed from all twelve concept boards',
                             'runtimeIntegrated':False,'assets':ASSETS,
                             'canonicalSourceSnapshot':'fb82c00fd2cfd6122ddd94bf92a5a6678a34bf56',
                             'fonts':[{'file':'fonts/'+p.name,'sha256':sha(p)} for p in sorted((ROOT/'fonts').glob('*.woff2'))],
                             'recipes':'screen-recipes.json','coverage':'breakdown.json'})
    print('Artwork:',len(ASSETS),'new SVG:',len([a for a in ASSETS if a['kind']=='component']),
          'new PNG:',len([a for a in ASSETS if a['origin']=='built-in-image-generation']))

if __name__=='__main__':run()
