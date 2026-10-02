from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from html import escape
import os,json, hashlib, math, shutil, re, zipfile, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
REPO=Path(os.environ.get('ASHENSPIRE_REPO', ROOT.parents[2])).resolve()
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8',newline='\n')
def save(p,obj): write(p,json.dumps(obj,indent=2)+'\n')
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
generation=json.loads((ROOT/'generation.json').read_text())
canon=json.loads((ROOT/'canonical-map.json').read_text())['assets']
ui=json.loads((ROOT/'ui/manifest.json').read_text())['assets']
art=[]
for a in generation['assets']:
    p=ROOT/a['folder']/(a['id']+'.png')
    im=Image.open(p)
    alpha=im.getchannel('A').getextrema() if im.mode=='RGBA' else None
    art.append({'id':a['id'],'file':p.relative_to(ROOT).as_posix(),'kind':a['folder'],'origin':'new-ai-generated-illustration','width':im.width,'height':im.height,'bytes':p.stat().st_size,'sha256':digest(p),'alphaRange':alpha,'hasTransparency':bool(alpha and alpha[0]<255),'source':generation['sourceDirectory']+'/'+a['source'],'sourceReference':generation['referenceDirectory']+'/'+a['reference'] if a.get('reference') else None,'promptRecord':'generation.json#'+a['id'],'fit':'contain' if a.get('transparentBackground') else 'cover','desktopPosition':'50% 50%','mobilePosition':'50% 50%'})
    original=Path(art[-1]['source'])
    if original.is_file(): assert digest(p)==digest(original),p
    else: print(f'Original generator archive unavailable: {original}; delivered file hash retained.')
    if a.get('transparentBackground'): assert alpha and alpha[0]==0 and alpha[1]==255,p
for a in art:
    if a['id']=='grave-dialogue-master': a.update(desktopPosition='46% 63%',mobilePosition='46% 62%',mobileUsage='Story header at 4:3 or square; keep grave and bowl visible, live copy below.')
    if a['id']=='chapel-rest-master': a.update(desktopPosition='50% 67%',mobilePosition='50% 64%',mobileUsage='Square upper scene with separate lower choices; retain fire, arch and seating.')
    if a['id']=='armoury-still-life-master': a.update(desktopPosition='50% 70%',mobilePosition='25% 65%',mobileUsage='Dim background only. Canonical selected equipment/figure remains separate and uses contain.')
    if a['id']=='soot-leather-material': a.update(repeat=False,usage='Non-repeating material cover under a soot overlay and transparent vector frame; not tested as seamless.')
vectors=[dict(a,id='ui/'+a['id'],file='ui/'+a['file'],origin='new-original-vector',bytes=(ROOT/'ui'/a['file']).stat().st_size,sha256=digest(ROOT/'ui'/a['file'])) for a in ui]
canonical=[dict(a,id='canonical/'+a['id'],kind='canonical',bytes=(ROOT/a['file']).stat().st_size) for a in canon]
fonts=[]
for n in ['cinzel-400-normal.woff2','cormorant-garamond-500-normal.woff2','inter-400-normal.woff2']:
    out=ROOT/'fonts'/n;out.parent.mkdir(exist_ok=True);shutil.copy2(REPO/'assets/fonts'/n,out)
    fonts.append({'file':'fonts/'+n,'source':'assets/fonts/'+n,'sha256':digest(out),'bytes':out.stat().st_size,'origin':'canonical-font-copy'})
shutil.copy2(REPO/'asset-data/fonts/OFL.txt',ROOT/'fonts/OFL.txt')

def c(p): return 'canonical/'+p
def comps(*names): return ['ui/components/'+n+'.svg' for n in names]
shared=comps('panel-frame','panel-backed','button-neutral','button-primary-ready','button-disabled','focus-outline','divider-plain')+['materials/soot-leather-material.png']
features=[]
def f(id,name,screen,desktop,mobile,objects,parts,note):
    features.append({'id':id,'name':name,'sourceModules':['src/ui/screens/'+s+'.js' for s in screen.split(',')],'desktopArtwork':[desktop]+objects,'mobileArtwork':[mobile]+objects,'sharedAssets':shared+comps(*parts),'mobileComposition':note})
vista='scenes/spire-vista-desktop.png';phone='scenes/spire-vista-mobile.png';study='scenes/armoury-still-life-master.png';rest='scenes/chapel-rest-master.png'
reaver=c('assets/painted-outfits/reaver/menu.webp')
portraits=[c('assets/painted-outfits/'+cl+'/portrait.webp') for cl in ['reaver','rogue','starseer','herald']]
weapon=c('assets/equipment/weapon_straightSword.webp'); shield=c('assets/equipment/weapon_roundShield.webp');lantern=c('assets/relics/crackedLantern.webp')
cards=['illustrations/card-'+x+'-illustration.png' for x in ['attack','guard','ember']]
f('01a','Title, save slots and resume','title',vista,phone,[],['heading-spark','button-selected'],'Spire stays above the menu; stacked save receipt and large bottom action.')
f('01b','Character creation','customize',vista,phone,portraits+[reaver,weapon],['item-slot','tab-marker','meter-track'],'Class picker is a row; figure uses contain; optional creation choices fold below it.')
f('02a','Opening sequence','prologue',c('assets/prologue/road-desktop.webp'),c('assets/prologue/road-mobile.webp'),[],['charge-empty','charge-filled'],'Use the existing authored mobile narrative artwork and DOM captions.')
f('02b','Events and dialogue','event,dialogue','scenes/grave-dialogue-master.png','scenes/grave-dialogue-master.png',['illustrations/roadkeeper-portrait.png'],['tooltip','button-selected'],'Square/4:3 story header; compact dialogue portrait; consequences and choices below art.')
f('03a','World Journey','worldAtlas',c('assets/environments/the-fractured-realm-world.webp'),c('assets/environments/fractured-realm-square.webp'),[],['map-node-selected','map-node-current','hud-strip'],'Keep authored map coordinates/zoom; selected destination in one bottom tray.')
f('03b','Classic Climb map','map',c('assets/environments/cinder-reach-map.webp'),c('assets/environments/cinder-reach-map.webp'),[],['map-node-reachable','map-node-visited','map-node-unknown','map-node-locked'],'Routes and labels remain live layers over canonical art; pan rather than squish graph.')
f('04a','Crownfall services and quests','worldAtlas,questBoard',c('assets/environments/crownfall-local.webp'),c('assets/environments/crownfall-local.webp'),[c('assets/environments/crownfall-landmark.webp')],['map-node-current','item-slot','tab-marker'],'Landmark map upper area and one selected service/quest tray below.')
f('04b','Legacy dungeon exploration','legacyDungeon',c('assets/environments/legacy/MAP-03-furnace-chapel.webp'),c('assets/environments/legacy/MAP-03-furnace-chapel.webp'),[],['map-node-current','map-node-unknown','map-node-visited'],'Preserve canonical room graph and unknown states; details become one lower tray.')
combat=c('assets/environments/cinder-reach-combat.webp');dungeon=c('assets/environments/legacy/FC-ENV-01-background.webp')
enemies=[c('assets/enemy-poses/'+e+'_idle.webp') for e in ['wanderingSoldier','blightHound']]
f('05a','Tactical combat','combat',combat,combat,[reaver]+enemies+cards,['hud-strip','card-folio','cost-medallion','target-brackets','meter-track'],'Canonical combat image is an atlas: use scene boxes/floorStart from existing resolver, not entire atlas. Keep fighters clear above focused hand.')
f('05b','Boss and status inspection','combat',dungeon,dungeon,[c('assets/environments/legacy/FC-ENV-01-floor.webp'),c('assets/enemy-poses/charredColossus_idle.webp')]+cards,['hud-strip','tooltip','meter-fill-health','meter-fill-poise','card-folio-selected'],'Selected status inspection is a fold; keep boss silhouette and action intent readable.')
f('06a','Character and equipment','equipment',vista,phone,[reaver,weapon,shield],['item-slot','item-slot-selected','meter-track'],'One figure, equipment rows, and Equipment/Stats tabs. Use actual outfit/pose lookup.')
f('06b','Inventory and comparison','equipment',study,study,[weapon,shield,c('assets/equipment/weapon_warhammer.webp')],['item-slot','item-slot-selected','tab-marker'],'Two-column grid and one receipt; never crop full weapon silhouette.')
f('07a','Deck and card inspection','deckEditor',study,study,cards,['card-folio','card-folio-selected','cost-medallion','card-parchment-label'],'Two-column grid or selected-card inspector; costs/names/effects remain DOM from canonical card model.')
f('07b','Relics and flasks','equipment',study,study,[lantern,c('assets/relics/forsakenMedallion.webp'),c('assets/ui/flasks/flask-crimson.webp'),c('assets/ui/flasks/flask-azure.webp')],['item-slot','charge-empty','charge-filled'],'One selected relic and flask rows; charges come from actual flask state.')
f('08a','Merchant','shop','scenes/merchant-desktop.png','scenes/merchant-mobile.png',['illustrations/merchant-portrait.png',lantern],['item-slot','button-disabled'],'Portrait upper hero and one product tray; affordability and stock stay live.')
f('08b','Smith services','blacksmith,smithServices','scenes/forge-desktop.png','scenes/forge-mobile.png',['illustrations/smith-portrait.png',weapon]+cards,['card-folio','item-slot','button-disabled'],'Portrait upper scene; one selected operation with actual compatibility/preview receipt.')
f('09a','Rest site','rest',rest,rest,[reaver]+cards,['card-folio-selected','meter-track'],'Square scene stays above recovery/choice rows; actual recovery values from location rules.')
f('09b','Post-combat rewards','reward',vista,phone,cards+[lantern],['card-folio','selection-tick','charge-filled'],'One card carousel plus folded reward rows and live claimed-state markers.')
f('10a','Class progression','equipment,rest',study,study,[reaver],['map-node-locked','map-node-selected','meter-track'],'One branch/training family at a time and prerequisite details; retain actual progression model.')
f('10b','Compendium','compendium',study,study,[weapon,shield,c('assets/equipment/weapon_greatsword.webp')],['item-slot-selected','card-parchment-label'],'Stable two-column gallery; create undiscovered silhouettes via CSS mask and hide unknown details.')
f('11a','Forsaken Together co-op','lobby,coop',rest,rest,portraits,['item-slot','selection-tick','charge-empty'],'Party rows with DOM connection/readiness labels; route vote remains a distinct in-run flow.')
f('11b','Run results and history','gameover,history',vista,phone,[reaver],['item-slot-selected','map-node-visited','divider-plain'],'Atmospheric upper illustration and concise expandable run receipt below.')
f('12a','Settings, controls and profile','settings,controls,profileArchive',vista,phone,[],['toggle-on','toggle-off','slider-track','slider-thumb','tab-marker'],'Readable searchable categories; one section open and touch targets independent of icon size.')
f('12b','Custom run and draft','customRun,draft',vista,phone,cards,['card-folio-selected','cost-medallion'],'Configuration folds around current draft pick; one enlarged card plus compact alternatives.')
save('feature-map.json',{'schema':1,'features':features,'sharedLayerOrder':['world illustration','optional canonical figure/object','soot veil','leather surface material','transparent vector frame','live DOM text/values','focus/selection overlays'],'scope':'All 24 board feature views, each mapped for desktop and mobile. Shared components are reusable; assets do not implement game behavior.'})
manifest={'schema':1,'title':'AshenSpire player polish asset kit','created':'2026-10-02','counts':{'newRaster':len(art),'newSVG':len(vectors),'canonicalArtCopies':len(canonical),'fontCopies':len(fonts),'featureViews':len(features)},'assets':art+vectors+canonical,'fonts':fonts,'coverage':'feature-map.json','generation':'generation.json','vectorManifest':'ui/manifest.json','canonicalManifest':'canonical-map.json','runtimeIntegrated':False,'mobilePolicy':'Use separate portrait title/market/forge art; share vectors; square scenes retain landmarks in upper illustration regions with independent DOM trays.'}
save('manifest.json',manifest)

# Review compositions only: source art is never modified or overwritten.
def font(size): return ImageFont.load_default(size=size)
def sheet(rows,name,cols=4,cell=(340,290)):
    cw,ch=cell;sheet=Image.new('RGB',(cw*cols,ch*math.ceil(len(rows)/cols)),(13,11,8));draw=ImageDraw.Draw(sheet)
    for i,a in enumerate(rows):
        x=(i%cols)*cw;y=(i//cols)*ch
        im=Image.open(ROOT/a['file']).convert('RGBA');im.thumbnail((cw-24,ch-58),Image.Resampling.LANCZOS)
        bg=Image.new('RGBA',(cw-24,ch-58),(36,29,21,255));bg.alpha_composite(im,((bg.width-im.width)//2,(bg.height-im.height)//2));sheet.paste(bg.convert('RGB'),(x+12,y+12))
        draw.text((x+12,y+ch-40),a['id'].replace('canonical/assets/','')[:36],font=font(15),fill='#e8dcc0')
        draw.text((x+12,y+ch-20),f"{a['width']} x {a['height']}  |  {a.get('origin','canonical')}",font=font(11),fill='#a58a52')
    sheet.save(ROOT/name)
sheet(art,'art-contact-sheet.png')
sheet(canonical,'canonical-contact-sheet.png',5,(280,240))

assetcards=[]
for a in art+canonical:
    assetcards.append(f'<article class="asset" data-name="{escape(a["id"])}" data-kind="{a["kind"]}"><a href="{a["file"]}" target="_blank"><img loading="lazy" src="{a["file"]}" alt="{escape(a["id"])}"></a><h3>{escape(a["id"].replace("canonical/assets/",""))}</h3><p>{a["width"]} × {a["height"]} · {escape(a["origin"])}</p><a href="{a["file"]}" target="_blank">Open original / zoom</a></article>')
pairs=[('Spire / menu','scenes/spire-vista-desktop.png','scenes/spire-vista-mobile.png'),('Merchant','scenes/merchant-desktop.png','scenes/merchant-mobile.png'),('Forge','scenes/forge-desktop.png','scenes/forge-mobile.png')]
pairhtml=''.join(f'<article class="pair"><h3>{title}</h3><div class="pair-grid"><a href="{d}" target="_blank"><img class="desktop" src="{d}" alt="{title} desktop composition"><span>Desktop 16:9 · original</span></a><a href="{m}" target="_blank"><img class="mobile" src="{m}" alt="{title} portrait composition"><span>Mobile 9:16 · original</span></a></div></article>' for title,d,m in pairs)
rows=''.join(f'<tr><td>{escape(f["name"])}</td><td>{escape(f["mobileComposition"])}</td><td><a href="{f["desktopArtwork"][0]}">Desktop art</a> · <a href="{f["mobileArtwork"][0]}">Mobile art</a></td></tr>' for f in features)
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ashen Spire · Player polish asset kit</title><link rel="stylesheet" href="ui/theme.css"><style>
@font-face{font-family:AshenHead;src:url(fonts/cinzel-400-normal.woff2)}@font-face{font-family:AshenBody;src:url(fonts/inter-400-normal.woff2)}
*{box-sizing:border-box}body{margin:0;background:#0d0b08;color:#e8dcc0;font:16px/1.6 AshenBody,Arial,sans-serif}main{max-width:1400px;padding:32px 24px;margin:auto}h1,h2,h3{font-family:AshenHead,Georgia,serif;font-weight:400;color:#d3b65f}h1{font-size:clamp(28px,4vw,52px);line-height:1.2}h2{margin-top:48px}p{max-width:950px;color:#c0b7a5}a{color:#e4c874;overflow-wrap:anywhere}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #e8dcc0;outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:8px}nav a{border:1px solid #7a6b54;padding:10px 16px;min-height:44px;text-decoration:none}.pair-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,23%);gap:16px;align-items:start}.pair img{display:block;width:100%;border:1px solid #7a6b54;object-fit:contain}.desktop{aspect-ratio:16/9}.mobile{aspect-ratio:9/16}.pair span{display:block;margin:8px 0 20px}.controls{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}input,select,button{min-height:44px;font:inherit;padding:10px 14px;background:#171310;color:#e8dcc0;border:1px solid #7a6b54}input{flex:1;min-width:180px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:18px}.asset{min-width:0;border:1px solid #4a4034;background:#171310;padding:12px}.asset[hidden]{display:none}.asset img{width:100%;height:220px;object-fit:contain;background:#241d15}.asset h3{font:16px/1.4 AshenBody,sans-serif;overflow-wrap:anywhere;margin:8px 0}.asset p{font-size:13px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:620px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #4a4034;padding:12px}th{color:#d3b65f}.sample{min-height:360px;position:relative;background:url(scenes/merchant-desktop.png) center/cover;padding:32px;display:flex;align-items:center;justify-content:flex-end}.sample-panel{width:min(480px,100%);background:linear-gradient(#0d0b08bb,#0d0b08bb),url(materials/soot-leather-material.png) center/cover;border:24px solid transparent;border-image:url(ui/components/panel-frame.svg) 24 fill stretch;padding:8px}.sample-panel h3{margin:0}.sample-item{display:grid;grid-template-columns:72px 1fr;gap:16px;align-items:center;margin:18px 0}.sample-item img{width:72px;height:72px;object-fit:contain}.sample-panel button{width:100%;margin-top:8px}.sheet{width:100%;height:auto}.muted{color:#a69c89;font-size:14px}footer{margin-top:48px;border-top:1px solid #4a4034;padding-top:16px}
@media(max-width:640px){main{padding:22px 16px}.pair-grid{grid-template-columns:1fr 42%;gap:10px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.asset{padding:8px}.asset img{height:160px}.asset h3{font-size:14px}.sample{background-image:url(scenes/merchant-mobile.png);min-height:610px;padding:220px 12px 12px;align-items:flex-end}.sample-panel{border-width:16px;border-image-slice:24;padding:8px}.sample-panel h3{font-size:18px}.sample-item{grid-template-columns:48px 1fr;gap:10px}.sample-item img{width:48px;height:48px}nav a{flex:1;text-align:center}.pair h3{font-size:18px}select{width:100%}}
</style></head><body><main><h1>Ashen Spire<br>Player polish asset kit</h1><p>Reusable art for desktop and mobile: 16 newly painted raster assets, 129 original SVG pieces, and 49 unchanged canonical art copies. All 24 feature views have an integration map. The kit is authored and reviewable; runtime wiring is separate.</p><nav><a href="#compositions">Desktop / mobile</a><a href="#assets">Individual art</a><a href="ui/index.html">Vector kit</a><a href="#coverage">Feature coverage</a><a href="README.md">Integration guide</a><a href="manifest.json">Manifest</a></nav>
<h2 id="compositions">Composed for each screen</h2><p>Title, merchant and forge use independently generated portrait artwork. Open an original to inspect or zoom without shrinking it into a contact sheet. Square masters use focal positioning in the feature map rather than destructive source crops.</p>'''+pairhtml+'''
<h2>Layers in use</h2><p>This illustrative service tray combines world art, a leather material, a transparent engraved frame, unchanged item art and selectable DOM text. Labels here explain the layer recipe and are not game rules.</p><div class="sample"><section class="sample-panel"><h3>Field case</h3><div class="sample-item"><img src="canonical/assets/relics/crackedLantern.webp" alt="Canonical cracked lantern illustration"><div><strong>Selected canonical object</strong><br><span class="muted">Live name and description belong in DOM.</span></div></div><button class="as-action" data-role="primary" data-ready="true" type="button">Ready action sample</button><button class="as-action" data-role="exit" aria-disabled="true" type="button">Unavailable exit sample</button><p class="muted">Preview skins only. The game decides legality, values and consequences.</p></section></div>
<h2 id="assets">Individual art assets</h2><div class="controls"><input id="search" type="search" aria-label="Search artwork" placeholder="Search spire, portrait, shield…"><select id="kind" aria-label="Artwork family"><option value="">All raster artwork</option><option value="scenes">New scene art</option><option value="illustrations">New cutouts and card art</option><option value="materials">New material</option><option value="canonical">Canonical copies</option></select><span id="count" aria-live="polite">65 raster files</span></div><div class="grid">'''+''.join(assetcards)+'''</div>
<h2 id="coverage">Every player feature</h2><p>Shared framing, icons, material and live state layers serve both device sizes. Detailed file paths and existing screen seams are in <a href="feature-map.json">feature-map.json</a>.</p><div class="table-wrap"><table><thead><tr><th>Feature</th><th>Mobile composition / canonical guardrail</th><th>Artwork</th></tr></thead><tbody>'''+rows+'''</tbody></table></div>
<h2>Static review sheets</h2><p><a href="art-contact-sheet.png" target="_blank">New art originals contact sheet</a> · <a href="canonical-contact-sheet.png" target="_blank">Canonical reuse sheet</a> · <a href="ui/icons-contact-sheet.png" target="_blank">Icons at native sizes</a> · <a href="ui/components-contact-sheet.png" target="_blank">Vector pieces</a></p><a href="art-contact-sheet.png" target="_blank"><img class="sheet" loading="lazy" src="art-contact-sheet.png" alt="Sixteen new raster assets with provenance labels"></a>
<footer><p><a href="generation.json">Generation prompts and provenance</a> · <a href="canonical-map.json">Unchanged source copies</a> · <a href="CANONICAL-CREDITS.md">Source credits</a> · <a href="VALIDATION.md">Validation</a></p><p class="muted">Supplemental portraits and card paintings are illustrative role/action art. They do not assign canonical NPC identities, new card rules or item mappings. Original PNG alpha is preserved. Interactive browser verification was unavailable under the app URL policy; source/link/schema checks and static visual review are recorded.</p></footer></main>
<script>const rows=[...document.querySelectorAll('.asset')],search=document.querySelector('#search'),kind=document.querySelector('#kind');function filter(){let n=0;for(const row of rows){row.hidden=!(row.dataset.name.toLowerCase().includes(search.value.trim().toLowerCase())&&(!kind.value||row.dataset.kind===kind.value));if(!row.hidden)n++}document.querySelector('#count').textContent=n+' raster files'}search.addEventListener('input',filter);kind.addEventListener('change',filter);</script></body></html>'''
write('index.html',page)
composition=Image.new('RGB',(1400,1790),(13,11,8));draw=ImageDraw.Draw(composition)
for i,n in enumerate(['spire-vista','merchant','forge']):
    y=20+i*590
    draw.text((24,y),n+' | desktop and portrait source compositions',font=font(24),fill='#e8dcc0')
    for x,s,box in [(24,'desktop',(940,480)),(1000,'mobile',(270,480))]:
        im=Image.open(ROOT/'scenes'/(n+'-'+s+'.png')).convert('RGB');im.thumbnail(box,Image.Resampling.LANCZOS)
        composition.paste(im,(x,y+50))
        draw.text((x,y+50+im.height+8),s+' | open original to zoom',font=font(18),fill='#a58a52')
composition.save(ROOT/'desktop-mobile-compositions.png')
print(json.dumps(manifest['counts']))
