"""Generate self-contained desktop-only review SVGs/HTML; no game files read or edited."""
from pathlib import Path
from html import escape
D=Path(__file__).resolve().parent
OPTIONS=[
 dict(id='A',name='Literal split · recommended',note='Closest to the markup: large centered hand, fixed corner pairs, strong center action.',w=208,bottom=824,step=182,fan=0,inset=16,group=205,endw=320,endh=62),
 dict(id='B',name='More exposed card faces',note='Slightly smaller cards with only 10px overlap; more of every face stays visible.',w=200,bottom=818,step=190,fan=0,inset=24,group=197,endw=300,endh=72),
 dict(id='C',name='Larger flat hand',note='Larger faces and 32px overlap; a wider End Turn keeps the same bottom center.',w=210,bottom=827,step=178,fan=0,inset=16,group=205,endw=340,endh=60),
 dict(id='D',name='Gentle fan',note='A small fan softens the hand; the first card still clears the player’s feet.',w=204,bottom=822,step=184,fan=.7,inset=20,group=201,endw=320,endh=68),
 dict(id='E',name='Wider centered hand',note='The hand spreads a little farther across the center; corner groups remain fixed.',w=208,bottom=826,step=188,fan=0,inset=16,group=205,endw=280,endh=64),
 dict(id='F',name='Compact span · larger action',note='More card overlap gives the largest End Turn a clear center emphasis.',w=210,bottom=827,step=173,fan=0,inset=24,group=197,endw=360,endh=64),
 dict(id='G',name='Largest faces · shallow fan',note='212px faces with a shallow fan; a shorter End Turn keeps room below the hand.',w=212,bottom=830,step=177,fan=.45,inset=16,group=205,endw=340,endh=58),
]
def text(x,y,value,size=18,color='#e7e2d5',anchor='start',font='Arial,sans-serif'):
 return f'<text x="{x}" y="{y}" fill="{color}" font-family="{font}" font-size="{size}" text-anchor="{anchor}">{escape(str(value))}</text>'
def rect(x,y,w,h,fill='#2a3033',stroke='#718087',r=5):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
def stone(x,y,w,h):
 return f'<path d="M{x+12} {y} H{x+w-12} L{x+w} {y+12} V{y+h-12} L{x+w-12} {y+h} H{x+12} L{x} {y+h-12} V{y+12}Z" fill="#29261e" stroke="#ac9563" stroke-width="2"/>'+f'<path d="M{x+15} {y+5} H{x+w-15} L{x+w-5} {y+15} V{y+h-15} L{x+w-15} {y+h-5} H{x+15} L{x+5} {y+h-15} V{y+15}Z" fill="none" stroke="#675a3d"/>'
def header():
 s=rect(0,0,1440,90,'#211e17','#211e17',0)+text(20,31,'♡  71/71',24)+rect(20,40,728,5,'#934c46','#bfa886',1)
 for x in [32,70]:s+=f'<circle cx="{x}" cy="65" r="13" fill="#413d30" stroke="#ac9563"/>'
 s+=rect(1305,12,54,57,'#17160f','#ac9563',3)+rect(1370,12,54,57,'#17160f','#ac9563',3)
 s+='<path d="M1319 25 L1332 19 L1345 25 V39 Q1345 50 1332 59 Q1319 50 1319 39Z" fill="#606c72" stroke="#baae8b" stroke-width="2"/><path d="M1332 20V58" stroke="#b6a576"/><path d="M1382 29H1412M1382 40H1412M1382 51H1412" stroke="#b29b65" stroke-width="4"/>'
 return s
def player():
 x,y=301,505
 s=f'<ellipse cx="{x}" cy="{y+2}" rx="106" ry="8" fill="#080a0b" opacity=".75"/>'
 s+=f'<circle cx="{x+4}" cy="{y-210}" r="15" fill="#b0b5b3" stroke="#e0ddd0"/>'
 s+=f'<path d="M{x-11} {y-191} Q{x-42} {y-188} {x-48} {y-149} L{x-100} {y-30} L{x-70} {y-38} L{x-84} {y-12} Q{x-40} {y+4} {x-8} {y-25} L{x+4} {y-126} L{x+37} {y-76} L{x+43} {y-83} L{x+12} {y-172} Z" fill="#725353" stroke="#b9a3a0" stroke-width="2"/>'
 s+=f'<path d="M{x-10} {y-116} L{x+22} {y-55} L{x+24} {y-8} L{x+46} {y-2} L{x+9} {y} L{x-8} {y-57} L{x-24} {y-7} L{x-48} {y-1} L{x-30} {y-68} Z" fill="#969f9f" stroke="#c3ccca" stroke-width="2"/>'
 s+=f'<path d="M{x+24} {y-121} L{x+103} {y-11}" stroke="#d8d5bf" stroke-width="4"/>'
 s+=rect(201,209,202,10,'#ad7777','#d2a3a3',4)+text(302,240,'71 / 71',18,anchor='middle')+text(302,196,'PLAYER',15,'#ccdadf','middle')
 return s
def enemy(x):
 y=329;w=152;h=158
 s=f'<ellipse cx="{x}" cy="{y+2}" rx="76" ry="8" fill="#080a0b" opacity=".7"/>'
 s+=f'<path d="M{x-54} {y-18} L{x-37} {y-63} L{x-68} {y-62} L{x-49} {y-90} L{x-35} {y-126} L{x-22} {y-111} L{x-6} {y-119} L{x+19} {y-104} Q{x+56} {y-98} {x+63} {y-49} L{x+73} {y-11} L{x+43} {y-9} L{x+30} {y-57} L{x+6} {y-28} L{x+2} {y-4} L{x-23} {y-4} L{x-15} {y-47} L{x-33} {y-12} Z" fill="#717d85" stroke="#b8c5ca" stroke-width="2"/>'
 s+=f'<path d="M{x+30} {y-90} Q{x+85} {y-159} {x+23} {y-158}" fill="none" stroke="#aebbc1" stroke-width="7"/>'
 s+=rect(x-78,151,156,10,'#ad7777','#d2a3a3',4)+text(x,180,'19 / 19',17,anchor='middle')+text(x,137,'ENEMY',15,'#ccdadf','middle')
 return s
def scene():
 s=rect(0,90,1440,441,'#2b3c48','#2b3c48',0)
 s+='<path d="M0 312 L120 214 L240 280 L370 204 L510 288 L670 226 L840 290 L1020 207 L1190 276 L1340 219 L1440 280 L1440 531 L0 531Z" fill="#37444b"/>'
 s+='<path d="M0 340 Q720 263 1440 340 L1440 531 L0 531Z" fill="#3c413d"/>'
 for y in [354,399,451,509]:s+=f'<path d="M0 {y} Q720 {y-39} 1440 {y}" fill="none" stroke="#535b55" stroke-width="1" opacity=".4"/>'
 s+=enemy(555)+enemy(818)+player()
 s+=rect(594,90,252,31,'#27251e','#ae985f',0)+text(720,112,'‹ ✧ PLAYER TURN ✧ ›',19,'#e7d49e','middle','Georgia,serif')
 return s
NAMES=['Defend','Smash','Sundering Art','Counter','Strike']
def card(x,y,w,h,name,i,angle):
 cx=x+w/2;cy=y+h/2
 s=f'<g class="card" data-index="{i}" transform="rotate({angle} {cx} {cy})">'+rect(x,y,w,h,'#303a3e','#b4a478',7)
 s+=rect(x+8,y+8,w-16,h-16,'none','#7b785e',4)+text(x+18,y+34,f'{i+1}  ·  {name}',21)
 s+=rect(x+15,y+53,w-30,h*.48,'#1c252c','#70828d',4)
 s+=f'<path d="M{x+w*.34} {y+h*.48} L{x+w*.68} {y+h*.23} M{x+w*.34} {y+h*.35} L{x+w*.59} {y+h*.5}" stroke="#9db0ba" stroke-width="8"/>'
 s+=rect(x+15,y+h*.70,w-30,h*.18,'#d8d0b7','#bba97b',3)+text(cx,y+h*.77,'Card effect',20,'#2d2b24','middle')+text(cx,y+h*.84,'Readable rules',17,'#464136','middle')+text(cx,y+h-14,name.upper(),17,'#d8c79c','middle')+'</g>'
 return s
def orb(x,y):
 return f'<circle cx="{x}" cy="{y}" r="45" fill="#303a2b" stroke="#b29a61" stroke-width="3"/><circle cx="{x}" cy="{y}" r="35" fill="#38583a" stroke="#9aad73"/>'+text(x,y+1,'3',32,anchor='middle')+text(x,y+24,'SP',15,anchor='middle')
def pile(x,y,label):
 return '<g>'+rect(x+5,y-3,48,58,'#242620','#756d55',2)+rect(x,y,48,58,'#30312a','#b09a6b',2)+f'<path d="M{x+24} {y+13} L{x+35} {y+29} L{x+24} {y+44} L{x+13} {y+29}Z" fill="none" stroke="#a89a72"/>'+text(x+24,889,label,18,'#e0d5b7','middle')+'</g>'
def render(o):
 w=o['w'];h=w*1.5;span=w+4*o['step'];left=(1440-span)/2;top=o['bottom']-h
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><title>Option {o["id"]}: {escape(o["name"])}</title><desc>Desktop-only wireframe. Original header and approved actor positions remain. Cards are {w} by {h} with split original footer controls.</desc>'
 s+=rect(0,0,1440,900,'#211e17','#211e17',0)+scene()+header()+rect(0,531,1440,369,'#211e17','#211e17',0)
 for i in range(5):s+=card(left+i*o['step'],top,w,h,NAMES[i],i,(i-2)*o['fan']/2)
 # Original corner groups, split from one centered footer: no new panels.
 inset=o['inset'];right=1440-inset-o['group']
 s+=text(inset,773,'Combat log',20)+orb(inset+48,838)+pile(inset+127,800,'5 Draw')
 s+=pile(right+20,800,'Discard 0')
 for j,c in enumerate(['#965d55','#5a7f9d','#9b824e']):
  x=right+118+j*28;s+=f'<path d="M{x-5} 803 H{x+5} V814 L{x+10} 824 V852 Q{x} 861 {x-10} 852 V824 L{x-5} 814Z" fill="{c}" stroke="#c5b78d" stroke-width="2"/>'
 s+=text(right+146,889,'Potions',18,'#e0d5b7','middle')
 s+=text(right,773,'Reaction',20)+rect(right+94,751,110,28,'#456944','#bda84e',14)+text(right+104,771,'enabled',15)+f'<circle cx="{right+189}" cy="765" r="11" fill="#c5ad43" stroke="#2f351d"/>'
 ex=(1440-o['endw'])/2;ey=894-o['endh'];s+=stone(ex,ey,o['endw'],o['endh'])+text(720,ey+o['endh']*.46,'End Turn',28,'#eadbb4','middle','Georgia,serif')+text(720,ey+o['endh']*.80,'H O L D',13,'#c8b759','middle')
 return s+'</svg>'
for o in OPTIONS:
 stem='option-'+o['id'].lower();(D/(stem+'.svg')).write_text(render(o));(D/(stem+'.html')).write_text(f'<!doctype html><meta charset="utf-8"><title>{escape(o["name"])}</title><style>html,body{{margin:0;background:#211e17;overflow:hidden}}img{{display:block;width:100vw;height:100vh;object-fit:contain}}</style><img src="{stem}.svg" alt="{escape(o["name"])}">')
(D/'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Desktop footer wireframes A–G</title><style>body{margin:0;background:#10191e;color:#e5edf0;font:18px Arial}header{padding:24px 28px}h1{margin:0 0 12px;font-size:32px}p{line-height:1.4;margin:6px 0}main{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:0 20px 20px}article{background:#1b2a32;border:1px solid #506570;border-radius:8px;overflow:hidden}h2{font-size:25px;margin:16px 18px 7px}article p{font-size:18px;margin:0 18px 12px;color:#c0d0d8}img{display:block;width:100%;height:auto}a{color:#e8d098;text-decoration:none}button{font-size:16px;background:#304b58;color:white;border:1px solid #8aa6b3;border-radius:5px;padding:9px 17px;cursor:pointer}article.chosen{outline:4px solid #dfc47c}.notes{padding:18px 22px;font-size:21px}.notes li{margin:18px 0;line-height:1.4}</style><header><h1>Desktop footer / choose A–G</h1><p>Seven close variations of the requested split footer. A is the closest literal match. All views: 1440×900.</p><p>Original header and approved battlefield stay fixed. Cards are approximately 40–50% larger; all keep the original 2:3 shape.</p><p>Open a picture for full-size review. Select highlights a preference locally; these wireframes do not run the game.</p></header><main>'''+''.join(f'<article><h2>{o["id"]} · {escape(o["name"])}</h2><p>{escape(o["note"])}</p><p>{o["w"]}×{o["w"]*1.5:g} cards · {o["step"]}px step · {o["endw"]}×{o["endh"]} End Turn</p><a href="option-{o["id"].lower()}.html"><img src="option-{o["id"].lower()}.svg" alt="Option {o["id"]}: {escape(o["name"])}"></a><p><button onclick="document.querySelectorAll(\'article\').forEach(x=>x.classList.remove(\'chosen\'));this.closest(\'article\').classList.add(\'chosen\')">Select {o["id"]}</button></p></article>' for o in OPTIONS)+'''<article class="notes"><h2>Fixed in every option</h2><ul><li>Original header, scene bounds and actor sizes/anchors.</li><li>Stamina + Draw at bottom left; Discard + Potions at bottom right.</li><li>Combat log directly above the left group; Reaction directly above the right group.</li><li>Much larger End Turn at bottom center.</li><li>Larger centered hand; 2:3 card proportions.</li><li>Continuous lower HUD background; no added panels.</li></ul><p>Desktop review only. No mobile/tablet redesign, runtime changes, game rules or implementation.</p><p>Cards paint over the empty lower scene margin. The player stays at its approved size and position, with feet ending at y505 and first-card corners below that line.</p></article></main>''')
rows='\n'.join(f'| {o["id"]} | {o["w"]}×{o["w"]*1.5:g} | {o["bottom"]-o["w"]*1.5:g}–{o["bottom"]} | {o["step"]} / {o["w"]-o["step"]} | ±{o["fan"]}° | {o["inset"]} / {o["group"]} | {o["endw"]}×{o["endh"]}, y{894-o["endh"]}–894 |' for o in OPTIONS)
(D/'README.md').write_text('''# Desktop split-footer wireframes — A–G

Docs-only selection review. **A is recommended as the closest literal match to the markup.** No runtime, mobile or tablet changes are included.

[Open the interactive gallery](index.html). Each SVG/HTML is self-contained apart from its neighboring image; all PNGs are full 1440×900 viewport captures. Labels and comparison notes outside the viewport are review annotations, not proposed game UI.

![All seven desktop options](overview.png)

## Shared layout

The original header and approved battlefield retain their bounds and actor sizes/anchors. Stamina + Draw are anchored bottom left; Discard + Potions bottom right; End Turn is much larger at bottom center. Combat log sits directly above the left group and Reaction directly above the right group. No new dock, column or panel is introduced.

The baseline cards are approximately 142×210. Proposed cards are 200–212×300–318 (approximately 40–50% larger) with exact 2:3 proportions. The enlarged hand overlaps the otherwise empty lower field margin. It does not move or shrink actors: the player’s feet end at y505, and every first-card corner remains below that line. The card layer sits in front of the empty scenery margin; no actor is hidden. The lowest few pixels of the floor shadow can continue behind the hand. Fan rotations are deliberately small. Five cards are shown as the common comparison fixture, not a new hand-capacity rule.

Corner groups end near y890. Combat log/Reaction occupy the fixed y750–779 line above them. Each End Turn group includes its existing HOLD hint and ends at y894. These controls retain their familiar components and order within each group.

| Option | Card W×H | Card top–bottom | Step / overlap | Outer fan angle | Corner inset / width | End Turn W×H and vertical bounds |
|---|---|---|---|---|---|---|
'''+rows+'\n\n'+''.join(f'## {o["id"]} — {o["name"]}\n\n{o["note"]}\n\n![Option {o["id"]}: {o["name"]}](option-{o["id"].lower()}.png)\n\n' for o in OPTIONS)+'''## Approval boundary

These seven close variants are for selecting the desktop composition. Choosing one is not a claim that the game has changed. Responsive behavior, variable hand counts, input targets and runtime validation belong to implementation after selection. The SVG generation source is `generate.py`; no existing screenshot or game artwork was edited.
''')
print('Generated seven desktop options in',D)
