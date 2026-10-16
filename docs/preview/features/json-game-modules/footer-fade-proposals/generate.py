"""Design-only footer fade proposals. All artwork is procedural SVG line art."""
from pathlib import Path
from html import escape
D=Path(__file__).resolve().parent
OPTIONS=[
 dict(id='A',name='Short fade',start=742,solid=790,opacity=1,note='Most open floor above the controls; a short 48px transition.'),
 dict(id='B',name='Balanced fade · suggested',start=700,solid=790,opacity=1,note='90px transition into a solid footer, leaving the upper cards over the floor.'),
 dict(id='C',name='Long soft fade',start=650,solid=790,opacity=1,note='A gentler 140px transition; the darkening starts higher behind the card bottoms.'),
 dict(id='D',name='Lower solid base',start=730,solid=820,opacity=1,note='90px transition with the solid footer beginning lower, at y820.'),
 dict(id='E',name='Long fade · lower base',start=680,solid=820,opacity=1,note='140px transition into the lower y820 base; more gradual across the controls.'),
 dict(id='F',name='Floor shows through',start=700,solid=790,opacity=.85,note='Same 90px fade as B, with an 85% dark base so floor texture remains visible.'),
 dict(id='G',name='Soft-start curve',start=700,solid=790,opacity=1,curve=True,note='90px non-linear fade: 0 → 12 → 45 → 100%, with a softer upper edge.'),
]
def text(x,y,value,size=18,color='#e7e2d5',anchor='start',font='Arial,sans-serif'):
 return f'<text x="{x}" y="{y}" fill="{color}" font-family="{font}" font-size="{size}" text-anchor="{anchor}">{escape(str(value))}</text>'
def rect(x,y,w,h,fill='#2a3033',stroke='#718087',r=5):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
def stone(x,y,w,h):
 return f'<path d="M{x+12} {y} H{x+w-12} L{x+w} {y+12} V{y+h-12} L{x+w-12} {y+h} H{x+12} L{x} {y+h-12} V{y+12}Z" fill="#29261e" stroke="#ac9563" stroke-width="2"/>'+f'<path d="M{x+15} {y+5} H{x+w-15} L{x+w-5} {y+15} V{y+h-15} L{x+w-15} {y+h-5} H{x+15} L{x+5} {y+h-15} V{y+15}Z" fill="none" stroke="#675a3d"/>'
def header():
 s=rect(0,0,1440,90,'#211e17','#211e17',0)+text(20,27,'♡  71/71',21)+rect(20,35,622,3,'#934c46','#bfa886',1)
 for x in [32,60]:s+=f'<circle cx="{x}" cy="54" r="12" fill="#413d30" stroke="#ac9563"/>'
 s+=text(720,60,'CINDERS  ⛁ 20',17,'#d9cba6','middle')
 for x in [1328,1378]:s+=rect(x,12,44,44,'#17160f','#ac9563',3)
 s+='<path d="M1340 24L1350 19L1360 24V36Q1360 45 1350 50Q1340 45 1340 36Z" fill="#606c72" stroke="#baae8b"/><path d="M1388 25H1412M1388 34H1412M1388 43H1412" stroke="#b29b65" stroke-width="3"/>'
 return s

def player():
 x,y=301,505
 s=f'<ellipse cx="{x}" cy="{y+2}" rx="106" ry="8" fill="#151719" opacity=".8"/>'
 s+=f'<circle cx="{x+4}" cy="{y-210}" r="15" fill="#b0b5b3" stroke="#e0ddd0"/>'
 s+=f'<path d="M{x-11} {y-191} Q{x-42} {y-188} {x-48} {y-149} L{x-100} {y-30} L{x-70} {y-38} L{x-84} {y-12} Q{x-40} {y+4} {x-8} {y-25} L{x+4} {y-126} L{x+37} {y-76} L{x+43} {y-83} L{x+12} {y-172}Z" fill="#725b58" stroke="#b9a3a0" stroke-width="2"/>'
 s+=f'<path d="M{x-10} {y-116} L{x+22} {y-55} L{x+24} {y-8} L{x+46} {y-2} L{x+9} {y} L{x-8} {y-57} L{x-24} {y-7} L{x-48} {y-1} L{x-30} {y-68}Z" fill="#969f9f" stroke="#c3ccca" stroke-width="2"/>'
 s+=f'<path d="M{x+24} {y-121} L{x+103} {y-11}" stroke="#d8d5bf" stroke-width="4"/>'
 return s+rect(201,219,202,10,'#ad7777','#d2a3a3',4)+text(302,250,'71 / 71',18,anchor='middle')+text(302,207,'PLAYER',14,'#d0d3ce','middle')
def enemy(x,hp):
 y=329
 s=f'<ellipse cx="{x}" cy="{y+2}" rx="76" ry="8" fill="#151719" opacity=".8"/>'
 s+=f'<path d="M{x-54} {y-18} L{x-37} {y-63} L{x-68} {y-62} L{x-49} {y-90} L{x-35} {y-126} L{x-22} {y-111} L{x-6} {y-119} L{x+19} {y-104} Q{x+56} {y-98} {x+63} {y-49} L{x+73} {y-11} L{x+43} {y-9} L{x+30} {y-57} L{x+6} {y-28} L{x+2} {y-4} L{x-23} {y-4} L{x-15} {y-47} L{x-33} {y-12}Z" fill="#717b7e" stroke="#b8c5ca" stroke-width="2"/>'
 s+=f'<path d="M{x+30} {y-90} Q{x+85} {y-159} {x+23} {y-158}" fill="none" stroke="#aebbc1" stroke-width="7"/>'
 return s+rect(x-78,153,156,10,'#ad7777','#d2a3a3',4)+text(x,181,f'{hp} / {hp}',17,anchor='middle')+text(x,137,'ENEMY',14,'#d0d3ce','middle')
def floor():
 s=rect(0,90,1440,810,'#555852','#555852',0)
 s+=rect(0,90,1440,125,'#384348','#384348',0)
 s+='<path d="M0 291L100 195L215 250L359 186L510 268L665 211L840 277L1020 180L1190 250L1340 200L1440 260V355H0Z" fill="#434b4c" stroke="#6a7270"/>'
 s+='<path d="M0 350Q720 275 1440 350V900H0Z" fill="url(#paving)"/>'
 # Receding ground marks continue to the viewport bottom, never end at the hand.
 for y in [337,370,410,459,518,590,678,785,899]:
  s+=f'<path d="M0 {y}Q720 {y-42} 1440 {y}" fill="none" stroke="#8b9086" stroke-width="1.3" opacity=".48"/>'
 for x in [-850,-450,-50,350,750,1150,1550,1950,2350]:
  s+=f'<path d="M720 285L{x} 900" fill="none" stroke="#8b9086" stroke-width="1.1" opacity=".26"/>'
 # Four unchanged perspective formation bands, behind every actor.
 rh=441*.11;baseline=441*(.52+4*.11);lw=(1440*(.7875-.1125)-.95*(baseline-441*.52))/3
 for band in range(4):
  top=90+441*.52+band*rh
  for lane in range(3):
   left=1440*.1125+lane*lw+.95*(baseline-(top-90+rh/2));a=left+.95*rh/2;b=left-.95*rh/2
   d=f'M{b} {top+rh}L{a} {top}H{a+lw}'
   if lane==2:d+=f'L{b+lw} {top+rh}'
   if band==3:d+=f'M{b+lw} {top+rh}H{b}'
   s+=f'<path d="{d}" fill="none" stroke="#e7e2d5" stroke-opacity=".32" stroke-width="1"/>'
 return s
NAMES=['Defend','Smash','Sundering Art','Counter','Strike']
def card(x,y,name,i,angle):
 w,h=204,306;cx=x+w/2;cy=y+h/2
 s=f'<g class="card" transform="rotate({angle} {cx} {cy})">'+rect(x,y,w,h,'#303636','#b4a478',7)
 s+=rect(x+8,y+8,w-16,h-16,'none','#7b785e',4)+text(cx,y+34,name,21,anchor='middle')
 s+=rect(x+15,y+53,w-30,147,'#252e31','#70828d',4)
 s+=f'<path d="M{x+66} {y+160}L{x+137} {y+84}M{x+67} {y+110}L{x+123} {y+166}" stroke="#9da8a9" stroke-width="8"/>'
 s+=rect(x+15,y+214,w-30,57,'#d8d0b7','#bba97b',3)+text(cx,y+238,'Card effect',20,'#2d2b24','middle')+text(cx,y+260,'Readable rules',17,'#464136','middle')+text(cx,y+h-13,name.upper(),17,'#d8c79c','middle')
 s+=rect(x+92,y-11,22,24,'#25241f','#a38f60',2)+text(cx,y+7,str(i+1),14,'#d9c79c','middle')+'</g>'
 return s

def footer():
 s=rect(20,723,18,18,'#c4b27d','#d4c9ab',2)+text(29,738,'✓',16,'#252b24','middle')+text(44,738,'Grid',17)
 s+=text(20,775,'Combat log',20)+text(1274,775,'Reaction',20)
 s+=rect(1340,758,80,24,'#46513c','#baa86a',12)+text(1349,775,'enabled',14)+f'<circle cx="1407" cy="770" r="9" fill="#b6a26a"/>'
 # Uniformly scaled existing stone control groups at their current bounds.
 s+=f'<circle cx="70.5" cy="841" r="47" fill="#3d4738" stroke="#b29a61" stroke-width="3"/><circle cx="70.5" cy="841" r="37" fill="#4a5944" stroke="#9da47c"/>'+text(70.5,842,'3',32,anchor='middle')+text(70.5,869,'SP',15,anchor='middle')
 for x,y,w,h,label in [(145,786,64.1584,108,'5 Draw'),(1219,793,80.398,101,'Discard 0')]:
  s+=rect(x+7,y+9,w-14,h-42,'#33342e','#b09a6b',2)+rect(x+11,y+5,w-14,h-42,'#30312a','#b09a6b',2)
  s+=f'<path d="M{x+w/2} {y+21}l12 18l-12 18l-12 -18Z" fill="none" stroke="#a89a72"/>'+text(x+w/2,889,label,17,'#e0d5b7','middle')
 for j,c in enumerate(['#876a64','#667e8a','#958665']):
  x=1334+j*31;s+=f'<path d="M{x-5} 815H{x+5}V827L{x+10} 836V858Q{x} 869 {x-10} 858V836L{x-5} 827Z" fill="{c}" stroke="#c5b78d" stroke-width="2"/>'
 s+=text(1370,889,'Potions',17,'#e0d5b7','middle')
 s+=stone(600,819.4286,240,74.5714)+text(720,857,'End Turn',29,'#eadbb4','middle','Georgia,serif')+text(720,889,'H O L D',13,'#c8b759','middle')
 return s

def render(o):
 stops=[(0,0),(.35,.12),(.7,.45),(1,1)] if o.get('curve') else [(0,0),(1,o['opacity'])]
 defs='<defs><pattern id="paving" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#555852"/><path d="M-8 8L8-8M0 32L32 0M24 40L40 24" stroke="#858b80" stroke-width="1" opacity=".46"/></pattern>'
 defs+=f'<linearGradient id="footer-fade" x1="0" x2="0" y1="{o["start"]}" y2="{o["solid"]}" gradientUnits="userSpaceOnUse">'+''.join(f'<stop offset="{t*100}%" stop-color="#211d16" stop-opacity="{v}"/>' for t,v in stops)+'</linearGradient></defs>'
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><title>Option {o["id"]} — {escape(o["name"])}</title><desc>Design-only. Existing desktop layout remains fixed. Footer fade {o["start"]} to {o["solid"]}; lower base {o["opacity"]*100:g} percent opacity.</desc>'+defs
 s+=floor()+header()+enemy(555,16)+enemy(818,19)+player()
 s+=rect(594,90,252,31,'#27251e','#ae985f',0)+text(720,112,'‹ ✧ PLAYER TURN ✧ ›',19,'#e7d49e','middle','Georgia,serif')
 # The ONLY varying layer. It paints over scenery and behind cards/controls.
 s+=f'<rect class="footer-backing" x="0" y="{o["start"]}" width="1440" height="{900-o["start"]}" fill="url(#footer-fade)"/>'
 for i in range(5):
  t=(i-2)/2;s+=card(218+i*200,510+t*t*8,NAMES[i],i,t*4)
 return s+footer()+'</svg>'

def option_card(o,crop=False):
 stem='option-'+o['id'].lower();pic=stem+('-footer' if crop else '')+'.svg'
 detail=f'{o["solid"]-o["start"]}px fade · y{o["start"]}→{o["solid"]} · base {o["opacity"]*100:g}%'
 return f'<article data-option="{o["id"]}"><h2>{o["id"]} · {escape(o["name"])}</h2><p class="metrics">{detail}</p><img src="{pic}" alt="Option {o["id"]} footer fade"><p class="note">{escape(o["note"])}</p><div class="actions"><button data-select="{o["id"]}">Select {o["id"]}</button><button data-preview="{stem}.svg">Full-size preview</button><a href="{stem}.html">Open view ↗</a></div></article>'
CSS='''*{box-sizing:border-box}body{margin:0;background:#151a1b;color:#e8e6db;font:18px Arial,sans-serif}header{padding:25px 30px 19px;max-width:1600px}h1{font-size:32px;margin:0 0 12px}p{line-height:1.45;margin:6px 0}header p{color:#c6cfcb}.nav{display:flex;gap:22px;margin-top:14px}a{color:#e1ca8e}main{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:0 22px 22px}article{background:#232a2b;border:1px solid #5c6460;border-radius:8px;overflow:hidden}h2{font-size:24px;margin:17px 18px 6px}.metrics{color:#e7ce8c;font-size:19px;margin:0 18px 13px}img{width:100%;height:auto;display:block;background:#211d16}article .note{font-size:17px;margin:12px 18px;color:#c8d0ca;min-height:48px}.actions{display:flex;align-items:center;gap:12px;padding:0 18px 18px;flex-wrap:wrap}button{font:17px Arial;padding:10px 15px;border:1px solid #b2a374;border-radius:4px;background:#3d443e;color:#fff1c7;cursor:pointer}button:hover{background:#515c50}article.chosen{outline:4px solid #cfb577;outline-offset:-4px}button[aria-pressed=true]{background:#8c7847;color:#fff}#choice{color:#ead59c}.fixed{padding:18px 22px}.fixed li{margin:12px 0;line-height:1.4}dialog{padding:12px;border:1px solid #ac9563;background:#151a1b;color:#e8e6db;max-width:98vw;max-height:98vh;width:1480px}dialog::backdrop{background:#000d}dialog img{width:100%;max-height:84vh;object-fit:contain}dialog .close{float:right;margin-bottom:8px}.zoom main article .note{min-height:0}.zoom h1{font-size:30px}@media(max-width:850px){main{grid-template-columns:1fr}h1{font-size:27px}.actions{gap:8px}}'''
SCRIPT='''document.querySelectorAll('[data-select]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.select;document.querySelectorAll('article').forEach(a=>a.classList.toggle('chosen',a.dataset.option===key));document.querySelectorAll('[data-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.select===key)));document.getElementById('choice').textContent='Selected '+key+' for review — the game is unchanged.';}));const modal=document.querySelector('dialog');document.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>{modal.querySelector('img').src=b.dataset.preview;modal.showModal();}));modal.querySelector('button').addEventListener('click',()=>modal.close());'''
def gallery(crop=False):
 title='Footer fade close-ups · A–G' if crop else 'Footer background fade · A–G'
 body=''.join(option_card(o,crop) for o in OPTIONS)
 body+='<article class="fixed"><h2>Same layout in every option</h2><ul><li>204×306 cards · 200px step · ±4° fan.</li><li>Original header, actors, turn ribbon and all four grid rows.</li><li>Grid checkbox above Log. Reaction stays at the right.</li><li>SP + Draw left; Discard + Potions right; End Turn low center.</li><li>Only the background layer changes. The floor extends behind every card and footer group.</li></ul><p>Desktop-only design review. No runtime changes. Choose one for approval before implementation.</p></article>'
 return '<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+CSS+'</style><body'+(' class="zoom"' if crop else '')+'><header><h1>'+title+'</h1><p>Only the dark background changes: its height, fade and opacity. All card and control positions stay fixed.</p><p><b>B is suggested.</b> The floor continues to the bottom behind the cards; the fade brings contrast back for the footer.</p><p id="choice">Select a preference below. Selection is local to this review.</p><div class="nav"><a href="index.html">Full-scene comparison</a><a href="footer-comparison.html">Footer close-ups</a><a href="option-b.html">Full-size B</a></div></header><main>'+body+'</main><dialog><button class="close">Close preview</button><img alt="Full-size option preview"></dialog><script>'+SCRIPT+'</script></body></html>'
for o in OPTIONS:
 stem='option-'+o['id'].lower();svg=render(o);(D/(stem+'.svg')).write_text(svg)
 (D/(stem+'-footer.svg')).write_text(svg.replace('width="1440" height="900" viewBox="0 0 1440 900"','width="1440" height="300" viewBox="0 600 1440 300"',1))
 (D/(stem+'.html')).write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>{o["id"]} — {escape(o["name"])}</title><style>html,body{{margin:0;background:#151a1b;width:100%;height:100%;overflow:hidden}}img{{width:100vw;height:100vh;object-fit:contain;display:block}}</style><img src="{stem}.svg" alt="Option {o["id"]}: {escape(o["name"])}"></html>')
(D/'index.html').write_text(gallery())
(D/'footer-comparison.html').write_text(gallery(True))
rows='\n'.join(f'| {o["id"]} | {o["name"]} | {o["solid"]-o["start"]} px | {o["start"]} → {o["solid"]} | {o["opacity"]*100:g}% |' for o in OPTIONS)
(D/'README.md').write_text('''# Footer fade proposals — approval review

Design only. The game has not changed. Desktop reference: **1440×900**.

[Interactive gallery](index.html) · [Footer close-ups](footer-comparison.html) · [Full-size B](option-b.html)

**B is suggested:** a 90px fade from y700 to y790, then an opaque footer. The scenery floor continues behind the upper cards. Every option uses the existing #211d16 footer color.

![Footer comparison](footer-overview.png)

![Full-size suggested B](option-b.png)

| Option | Name | Fade height | Fade start → solid/base start | Lower opacity |
|---|---|---|---|---|
'''+rows+'''

G uses opacity stops at 0%, 35%, 70%, 100% of the 90px fade, with alpha 0%, 12%, 45%, 100%. Other fades are linear. F retains 15% of the floor texture under its lower base.

Only the backing layer varies. All seven retain the same 204×306 cards, 200px card step, ±4° fan, actor positions/sizes, header, turn ribbon, four fixed grid bands, Grid checkbox, Combat Log/Reaction, and split original footer groups. SP + Draw stay bottom left; Discard + Potions bottom right; End Turn stays low center with its proportional 240×74.57 visible stone plate.

The card fan has unrotated y510–816, with outer cards displaced down 8px before ±4° rotation. Grid checkbox y718–746; Log/Reaction y750–786. The corner art begins about y786–803 and ends y894. No control or actor is moved to accommodate a fade. Review labels are outside the viewport and are not proposed game UI.

The hatched floor and line-art characters/cards are procedural wireframe placeholders. No existing screenshot or image was edited. `generate.py` writes the self-contained SVGs and HTML; PNGs are actual browser renders. The footer-only SVGs use viewBox 0 600 1440 300 to compare fades at a readable size. The selection buttons only mark a preference in this review page; controls inside the wireframes are illustrative.

## Complete comparison

![All seven full scenes](overview.png)

'''+''.join(f'### {o["id"]} — {o["name"]}\n\n{o["note"]}\n\n[Full-size view](option-{o["id"].lower()}.html)\n\n![Option {o["id"]}](option-{o["id"].lower()}.png)\n\n' for o in OPTIONS))
print('Wrote proposals to',D)
