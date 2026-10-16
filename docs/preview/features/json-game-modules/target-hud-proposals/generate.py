"""Review-only target HUD state diagrams; no game runtime is loaded or edited."""
from pathlib import Path
from html import escape
D=Path(__file__).resolve().parent
def text(x,y,value,size=18,color='#e7e2d5',anchor='start',font='Arial,sans-serif'):
 return f'<text x="{x}" y="{y}" fill="{color}" font-family="{font}" font-size="{size}" text-anchor="{anchor}">{escape(str(value))}</text>'

def rect(x,y,w,h,fill='#2a3033',stroke='#718087',r=5):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'

def stone(x,y,w,h):
 return f'<path d="M{x+12} {y} H{x+w-12} L{x+w} {y+12} V{y+h-12} L{x+w-12} {y+h} H{x+12} L{x} {y+h-12} V{y+12}Z" fill="#29261e" stroke="#ac9563" stroke-width="2"/>'+f'<path d="M{x+15} {y+5} H{x+w-15} L{x+w-5} {y+15} V{y+h-15} L{x+w-15} {y+h-5} H{x+15} L{x+5} {y+h-15} V{y+15}Z" fill="none" stroke="#675a3d"/>'

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

STATES=[
 dict(id='A',name='Idle · no detailed panel',enemies=[2,1],selected=[],focus=None,note='Two enemies fill back right first, then back left. The middle cell is empty. Overhead intent and HP remain visible.'),
 dict(id='B',name='Left enemy focused',enemies=[2,1],selected=[2],focus=2,note='Enemy 2: panel left; status row below/right aligned. Stance advantage changes the illustrative perceived 12 damage to green 8 both overhead and in the panel; overhead HP is removed.'),
 dict(id='C',name='Middle enemy focused',enemies=[2,3,1],selected=[3],focus=3,note='Enemy 3: panel below. This enemy’s intent is unperceived, so both overhead and panel retain ? and reveal no move or damage.'),
 dict(id='D',name='Right enemy focused',enemies=[2,1],selected=[1],focus=1,note='Enemy 1: panel right, within the viewport. Dodge is centered in a larger icon with its small count in the bottom corner.'),
 dict(id='E',name='Left-column player focused',enemies=[2,1],selected=['p'],focus='p',note='Player panel sits to the right of the left-column player. Overhead HP is removed; intent remains above the sprite.'),
 dict(id='F',name='Offensive card · eligible enemies',enemies=[2,3,1],selected=[2,3,1],focus=3,card=1,note='Sweep preselects all eligible enemies and opens their panels; the middle enemy has stronger focus. Left damage preview is green 8 both overhead and in its panel (illustrative 12 → 8 stance advantage). No automatic play.'),
 dict(id='G',name='Self-target card · player candidate',enemies=[2,1],selected=['p'],focus='p',card=0,note='Defend preselects the player, with its panel on the right. The separate insets show middle/right player panels on the left. No play is committed.'),
]
X={2:555,3:818,1:1081,'p':301}
PANELS={2:(274,94),3:(706,341),1:(1175,150),'p':(435,351)}
NAMES=['Defend','Sweep','Sundering Art','Counter','Strike']
SVG_STYLE='''text{user-select:none}.status{cursor:pointer;outline:none}.status:hover>rect,.status:focus>rect,.status.pinned>rect{stroke:#f1d593;stroke-width:3}.status .tip{display:none;pointer-events:none}.status:hover .tip,.status:focus .tip,.status.pinned .tip{display:block}'''

def header_hud():
 s=rect(0,0,1440,90,'url(#header-fade)','none',0)+text(20,27,'♡  71/71',21)+rect(20,35,622,3,'#934c46','#bfa886',1)
 for x in [32,60]:s+=f'<circle cx="{x}" cy="54" r="12" fill="#413d30" stroke="#ac9563"/>'
 # Both of these are now deliberately inside the header, above scene art.
 s+=rect(594,48,252,31,'#27251e','#ae985f',0)+text(720,70,'‹ ✧ PLAYER TURN ✧ ›',19,'#e7d49e','middle','Georgia,serif')
 s+=text(1310,39,'CINDERS  ⛁ 20',17,'#d9cba6','end')
 for x in [1328,1378]:s+=rect(x,12,44,44,'#17160f','#ac9563',3)
 s+='<path d="M1340 24L1350 19L1360 24V36Q1360 45 1350 50Q1340 45 1340 36Z" fill="#606c72" stroke="#baae8b"/><path d="M1388 25H1412M1388 34H1412M1388 43H1412" stroke="#b29b65" stroke-width="3"/>'
 return s

def cell_polygon(band,lane):
 rh=441*.11;baseline=441*(.52+4*.11);lw=(1440*(.7875-.1125)-.95*(baseline-441*.52))/3
 top=90+441*.52+band*rh
 left=1440*.1125+lane*lw+.95*(baseline-(top-90+rh/2));a=left+.95*rh/2;b=left-.95*rh/2
 return f'{a},{top} {a+lw},{top} {b+lw},{top+rh} {b},{top+rh}'

def intent(cx,cy,kind,damage=True,scale=1,advantage=False):
 s=f'<g transform="translate({cx} {cy}) scale({scale})">'
 if kind=='dodge':
  s+='<path d="M-15 9A18 18 0 1 1 17 3M17 3L17-9M17 3L5 0" fill="none" stroke="#d6e2df" stroke-width="4" stroke-linecap="round"/>'
  s+=rect(9,9,19,19,'#283231','#c7b778',3)+text(18.5,24,'3',14,'#f1dfad','middle')
 elif kind=='unknown':
  s+=text(0,14,'?',43,'#e8d3a0','middle','Georgia,serif')
 elif kind=='guard':
  s+='<path d="M0-21L17-14V2Q17 13 0 22Q-17 13-17 2V-14Z" fill="#586f74" stroke="#d6e2df" stroke-width="2"/>'
  s+=text(0,7,'6',18,'#f1dfad','middle')
 else:
  s+='<path d="M-16 16L13-17L18-19L17-12L-13 19M-11 3L3 16M-18 16L-12 22" fill="none" stroke="#d6e2df" stroke-width="4" stroke-linecap="round"/>'
 if damage and kind=='attack':s+=text(0,40,'8' if advantage else '12',18,'#9dd490' if advantage else '#f18d87','middle')
 return s+'</g>'

def overhead(who,selected=False,advantage=False):
 x=X[who]
 if who=='p':
  s=intent(x,265,'guard',False,.5)
  if not selected:s+=rect(x-101,219,202,10,'#ad7777','#d2a3a3',4)+text(x,247,'71 / 71',18,anchor='middle')
  return s
 kind='attack' if who==2 else 'unknown' if who==3 else 'dodge'
 s=intent(x,121,kind,True,.85,advantage)
 if kind=='unknown':s+=text(x,158,'?',15,'#d9cba6','middle')
 if not selected:
  hp=19 if who==2 else 17 if who==3 else 16
  s+=rect(x-78,162,156,9,'#ad7777','#d2a3a3',4)+rect(x-29,173,58,18,'#292b26','none',2)+text(x,187,f'{hp} / {hp}',14,anchor='middle')
 return s

def actor_body(who,focused=False,candidate=False):
 if who=='p':
  raw=player();raw=raw[:raw.index('<rect x="201" y="219"')]
 else:
  raw=enemy(X[who],16);raw=raw[:raw.index(f'<rect x="{X[who]-78}" y="153"')]
 if focused:
  color='#90cce0' if who=='p' else '#ec8d81'
  raw=f'<g style="filter:drop-shadow(0 0 2.5px {color})" stroke="{color}">{raw}</g>'
  y=507 if who=='p' else 331;rx=106 if who=='p' else 76
  raw+=f'<ellipse cx="{X[who]}" cy="{y}" rx="{rx}" ry="8" fill="none" stroke="{color}" stroke-width="3"/>'
 elif candidate:
  raw=f'<g filter="url(#candidate-glow)">{raw}</g>'
 return raw

STATUS=[('B','Bleeding · 2 stacks'),('P','Precision · 1 stack'),('G','Guard · 6 block')]
def statuses(x,y,width=224):
 s=''
 for i,(glyph,label) in enumerate(STATUS):
  sx=x+width-(len(STATUS)-i)*29
  s+=f'<g class="status" tabindex="0" role="button" aria-label="{label}" onclick="this.classList.toggle(\'pinned\')">'+rect(sx,y,24,24,'#3c4441','#a29268',3)+text(sx+12,y+18,glyph,15,'#efdfb2','middle')
  s+=f'<g class="tip">'+rect(sx-148,y-47,180,36,'#171d1c','#d0b878',4)+text(sx-58,y-24,label,13,'#f0e7cd','middle')+'</g></g>'
 return s

def panel(who,focused=False,at=None):
 x,y=at or PANELS[who];w,h=224,116
 kind='guard' if who=='p' else 'attack' if who==2 else 'unknown' if who==3 else 'dodge'
 title='Player' if who=='p' else f'Hound · Enemy {who}'
 hp='71 / 71' if who=='p' else '19 / 19' if who==2 else '17 / 17' if who==3 else '16 / 16'
 stroke='#90cce0' if who=='p' else '#e0c581' if focused else '#9caa9d'
 s=rect(x,y,w,h,'#252d2b',stroke,5)+text(x+10,y+19,title,15,'#ede3c9')
 s+=rect(x+10,y+27,w-20,15,'#985f59','#c4a092',3)+text(x+w/2,y+39,'HP  '+hp,12,'#fff1df','middle')
 s+=rect(x+10,y+47,w-20,10,'#797e6f','#ada88e',2)+text(x+w/2,y+56,'Poise  6 / 10',10,'#fff1df','middle')
 s+=intent(x+36,y+83,kind,False,.85)
 name={'attack':'Slash','guard':'Guard','unknown':'Intent hidden','dodge':'Dodge'}[kind]
 s+=text(x+75,y+80,name,18,'#e8e0c9')
 if kind=='attack':s+=text(x+75,y+103,'12',20,'#f18d87')+text(x+106,y+103,'→',18,'#c4c9c4')+text(x+132,y+103,'8',20,'#9dd490')
 elif kind=='unknown':s+=text(x+75,y+104,'?',22,'#d7c69d')
 elif kind=='guard':s+=text(x+75,y+103,'Block 6',18,'#a7c6d2')
 else:s+=text(x+75,y+103,'Evade 3',18,'#c7d6ce')
 return '<g class="detail-panel">'+s+statuses(x,y+h+6,w)+'</g>'

DEFS='''<defs><pattern id="paving" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#555852"/><path d="M-8 8L8-8M0 32L32 0M24 40L40 24" stroke="#858b80" stroke-width="1" opacity=".46"/></pattern><linearGradient id="footer-fade" x1="0" x2="0" y1="700" y2="790" gradientUnits="userSpaceOnUse"><stop stop-color="#211d16" stop-opacity="0"/><stop offset="1" stop-color="#211d16"/></linearGradient><linearGradient id="header-fade" x1="0" x2="0" y1="0" y2="90" gradientUnits="userSpaceOnUse"><stop stop-color="#211d16"/><stop offset=".62" stop-color="#211d16" stop-opacity=".9"/><stop offset="1" stop-color="#211d16" stop-opacity="0"/></linearGradient><filter id="focus-glow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#e7ca79" flood-opacity=".8"/></filter><filter id="candidate-glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#d4c395" flood-opacity=".5"/></filter></defs>'''

def render_state(o):
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><title>{o["id"]} — {escape(o["name"])}</title><desc>Proposed target HUD. No game runtime. Damage values are illustrative, gated by perception.</desc><style>{SVG_STYLE}</style>'+DEFS+rect(0,0,1440,900,'#384348','none',0)+floor()
 # No occupiable extra row is added: these are only the four existing visual bands.
 for who in o['selected']:
  lane=0 if who in [2,'p'] else 1 if who==3 else 2;band=3 if who=='p' else 0
  color='#65b6e0' if who=='p' else '#db655c';focused=who==o['focus']
  s+=f'<polygon points="{cell_polygon(band,lane)}" fill="{color}" fill-opacity=".16" stroke="{color}" stroke-opacity="{.95 if focused else .4}" stroke-width="{2.5 if focused else 1}"/>'
 for who in o['enemies']+['p']:s+=actor_body(who,who==o['focus'],who in o['selected'])
 for who in o['enemies']+['p']:s+=overhead(who,who in o['selected'],o['id'] in ['B','F'] and who==2)
 # Panels use the free footprint beside/below each actor, without moving art.
 for who in o['selected']:s+=panel(who,who==o['focus'])
 s+='<rect x="0" y="700" width="1440" height="200" fill="url(#footer-fade)"/>'
 for i in range(5):
  t=(i-2)/2;s+=card(218+i*200,510+t*t*8,NAMES[i],i,t*4)
  if o.get('card')==i:
   cx=218+i*200+102;cy=510+t*t*8+153
   s+=f'<rect x="{218+i*200}" y="{510+t*t*8}" width="204" height="306" rx="7" fill="none" stroke="#e6d08c" stroke-width="4" transform="rotate({t*4} {cx} {cy})"/>'
 # Header is the final painted layer: the turn ribbon cannot fall behind field UI.
 return s+footer()+header_hud()+'</svg>'

def inset_players():
 s='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320"><title>Middle and right player panels sit to their left</title><style>'+SVG_STYLE+'</style>'+rect(0,0,1200,320,'#1c2425','#596864',8)
 for shift,lane,name in [(0,1,'Middle player'),(600,2,'Right player')]:
  s+=text(shift+25,35,name+' → panel on left',22,'#e6d29a')
  for j in range(3):s+=rect(shift+25+j*180,72,174,210,'#343f40','#728584',0)
  px=shift+25+lane*180+87
  s+=f'<ellipse cx="{px}" cy="256" rx="35" ry="6" fill="#111a1a"/><path d="M{px} 118l-25 35l-14 74l28 11l11-64l21 69h17l-13-105Z" fill="#8a7972" stroke="#c6bbb0" stroke-width="2"/><circle cx="{px}" cy="104" r="12" fill="#a8b4b1"/>'
  x=px-278;s+=panel('p',True,(x,116))
  s+=f'<path d="M{x+225} 173H{px-40}" stroke="#a8cbd4" stroke-width="2" stroke-dasharray="5 4"/>'
  s+=text(shift+25,306,'Schematic inset only · no default spawn change',15,'#bac7c4')
 return s+'</svg>'

def timing_svg():
 s='<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="510" viewBox="0 0 1440 510"><title>Proposed 500ms detail presentation timing</title>'+rect(0,0,1440,510,'#1c2425','#596864',8)+text(30,40,'Proposed timing · one 500ms stability threshold, not cumulative pauses',26,'#e8d4a0')
 rows=[('Enter',105,'Hover/focus stays on target','Details fade in'),('Exit',210,'Retain details + pointer corridor','Details fade out'),('Switch',315,'Keep old panel while new candidate settles','Crossfade old → new')]
 for name,y,desc,end in rows:
  s+=text(30,y,name,22,'#eee7d6')+text(175,y,desc,19,'#c1cfca')
  s+=rect(600,y-24,500,34,'#536454','#9db28d',2)+rect(1100,y-24,150,34,'#786b49','#ccb47a',2)
  s+=text(600,y+34,'0ms',15)+text(1100,y+34,'500ms',15,'#e8d4a0','middle')+text(1265,y,end,18,'#e8d4a0')
 s+=text(30,409,'Click: highlight immediately. Gameplay/target clicks never wait for panel presentation.',22,'#dce9dc')
 s+=text(30,450,'Hover/focus inside sprite, connecting corridor, panel or status row keeps the details open.',20,'#c1cfca')
 s+=text(30,483,'Reduced motion: same dwell/grace; instant opacity change. Short fades/crossfades are illustrative (~150ms).',19,'#c1cfca')
 return s+'</svg>'

def closeup_svg():
 # Existing right enemy panel enlarged as a diagram, not a new game arrangement.
 s='<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="610" viewBox="0 0 560 305"><title>Dodge and selectable statuses, detail anatomy</title><style>'+SVG_STYLE+'</style>'+DEFS+rect(0,0,560,305,'#1c2425','#596864',4)
 s+=text(18,24,'Detail anatomy · hover or select a status',15,'#e8d4a0')
 s+='<path d="M73 85l-24 22l-18 44h48l12 25h17l-10-49l21-12Z" fill="#6f7b7c" stroke="#b4c4c5"/>'
 s+=f'<path d="M105 117H167V202H105Z" fill="#7db7be" fill-opacity=".12" stroke="#93c0c7" stroke-dasharray="4 3"/>'+text(136,225,'Pointer corridor',12,'#b9d3d3','middle')
 s+=panel(1,True,(168,74))
 s+=text(413,105,'HP / Poise',13,'#c9d6cb')+text(413,158,'Large Dodge icon',13,'#c9d6cb')+text(413,180,'Small corner count',12,'#c9d6cb')
 s+=text(413,208,'Single status row',13,'#c9d6cb')
 s+=text(18,263,'Perceived attack example:',14,'#c9d6cb')+text(193,263,'12',19,'#f18d87')+text(224,263,'→',18,'#c9d6cb')+text(250,263,'8',19,'#9dd490')
 s+=text(18,286,'Red = perceived damage · green = reduced by stance advantage · unknown = ?',12,'#c9d6cb')
 return s+'</svg>'

CSS='''*{box-sizing:border-box}body{margin:0;background:#151c1e;color:#e7e7da;font:18px Arial,sans-serif}header{padding:24px 30px;max-width:1600px}h1{font-size:31px;margin:0 0 13px}p{line-height:1.45;margin:8px 0}a{color:#e1c990}button{font:17px Arial;color:#f5e7c1;background:#3d4c48;border:1px solid #a7ab91;border-radius:4px;padding:10px 16px;cursor:pointer}nav{display:flex;gap:10px;flex-wrap:wrap;margin:15px 0}.active{outline:3px solid #d9c187;outline-offset:1px}.stage{max-width:1440px;margin:auto;border:1px solid #53635f}.stage object{width:100%;height:auto;aspect-ratio:1440/900;display:block}.caption{max-width:1440px;margin:14px auto 23px;padding:0 18px;color:#c8d5d1}.caption h2{color:#ead7a5}.evidence{max-width:1440px;margin:25px auto;padding:0 18px}.evidence img,.evidence object{display:block;width:100%;height:auto}.evidence object{aspect-ratio:1120/610}.order{font-family:monospace;color:#e8d4a0;white-space:pre-wrap}.all{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:20px}.all article{border:1px solid #53635f;padding:15px;background:#202b2b}.all img{width:100%;display:block}.all h2{margin:0 0 8px;font-size:23px}.all p{font-size:17px}.row{display:flex;gap:18px;flex-wrap:wrap}.notice{color:#d6c18d}@media(max-width:850px){.all{grid-template-columns:1fr}h1{font-size:26px}}'''
for o in STATES:
 stem='state-'+o['id'].lower();svg=render_state(o);(D/(stem+'.svg')).write_text(svg)
 (D/(stem+'.html')).write_text('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>'+o['id']+' — '+o['name']+'</title><style>html,body{margin:0;background:#151c1e}svg{display:block;width:100%;height:auto}</style>'+svg+'</html>')
(D/'player-insets.svg').write_text(inset_players());(D/'timing.svg').write_text(timing_svg());(D/'panel-closeup.svg').write_text(closeup_svg())
(D/'panel-closeup.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Target panel details</title><style>html,body{margin:0;background:#151c1e}svg{display:block;width:100%;height:auto}</style>'+closeup_svg()+'</html>')
import json
metadata=json.dumps(STATES)
script='''const states=STATES;function show(id){const state=states.find(x=>x.id===id)||states[0];document.querySelector('#state-view').data='state-'+state.id.toLowerCase()+'.svg';document.querySelector('#state-title').textContent=state.id+' · '+state.name;document.querySelector('#state-note').textContent=state.note;document.querySelector('#open-view').href='state-'+state.id.toLowerCase()+'.html';document.querySelectorAll('[data-state]').forEach(b=>{b.classList.toggle('active',b.dataset.state===state.id);b.setAttribute('aria-pressed',String(b.dataset.state===state.id));});document.querySelector('#player-insets').hidden=state.id!=='G';history.replaceState(null,'','#'+state.id);}document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.state)));show(location.hash.slice(1)||'A');'''.replace('STATES',metadata)
intro='<header><h1>Target HUD · seven states for approval</h1><p>Shared desktop layout, 1440×900. The current card fan, footer fade and control positions stay fixed.</p><p class="notice">Design only — no runtime changes. Damage, Poise and statuses are illustrative. Intent and damage stay hidden as “?” when unperceived.</p><p class="order">Default enemy order: back [2] [3] [1]   →   front [6] [5] [4]\nTwo enemies: back LEFT + RIGHT, with the middle empty. Player starts bottom LEFT.</p>'
nav='<nav>'+''.join(f'<button data-state="{o["id"]}">{o["id"]} · {o["name"].split(" · ")[0]}</button>' for o in STATES)+'</nav><div class="row"><a href="comparison.html">All seven states</a><a href="panel-closeup.html">Interactive detail close-up</a><a href="#timing">Timing proposal</a></div></header>'
(D/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Target HUD proposals</title><style>'+CSS+'</style>'+intro+nav+'<main><div class="stage"><object id="state-view" type="image/svg+xml" data="state-a.svg" aria-label="Selected target HUD state"></object></div><div class="caption"><h2 id="state-title"></h2><p id="state-note"></p><p><a id="open-view">Open full-size state ↗</a></p><p>Soft cell tint = eligible candidate. Strong outline = focused target. Selected panels retain overhead intent/damage while removing overhead HP.</p></div><section id="player-insets" class="evidence" hidden><h2>Player middle/right placement</h2><img src="player-insets.svg" alt="Middle and right player panels are placed to their left"></section><section class="evidence"><h2>Panel and pointer corridor</h2><p>Status icons support hover, focus or selection. A continuous pointer corridor joins sprite and panel; staying in this region or the status row keeps the panel open.</p><object type="image/svg+xml" data="panel-closeup.svg" aria-label="Interactive Dodge/status close-up"></object></section><section id="timing" class="evidence"><h2>Proposed timing interpretation</h2><img src="timing.svg" alt="One 500ms stable-target threshold for detail panels, immediate targeting gameplay"><p>For approval: hover/focus enters after 500ms stability; leaving retains detail for 500ms; switching waits for the new candidate to stabilize for 500ms, then crossfades. These are not three cumulative pauses. Explicit clicks highlight immediately; targeting and gameplay never wait. Reduced motion uses the same dwell/grace with instant opacity changes.</p></section></main><script>'+script+'</script></html>')
(D/'comparison.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>All target HUD states</title><style>'+CSS+'</style>'+intro+'<p><a href="index.html">Interactive state selector</a></p></header><main class="all">'+''.join(f'<article><h2>{o["id"]} · {o["name"]}</h2><img src="state-{o["id"].lower()}.svg" alt="{o["name"]}"><p>{o["note"]}</p><a href="state-{o["id"].lower()}.html">Full size ↗</a></article>' for o in STATES)+'<article><h2>Fixed presentation rules</h2><p>Enemy panels: left → left; middle → below; right → right. Player: left → right; middle/right → left.</p><p>Overhead intent remains. Selected overhead HP moves into details. Statuses form one horizontal row below the panel, aligned bottom-right.</p><p>500ms governs detail stability only. Clicks, card targeting and gameplay remain immediate.</p><img src="player-insets.svg" alt="Player panel placement insets"><a href="index.html#G">Open self-target state and insets</a></article></main></html>')
(D/'README.md').write_text('''# Target HUD proposals — approval review

Design only. No game runtime, balance, saved positions, targeting or animation code is changed.

[Interactive state gallery](index.html) · [All seven](comparison.html) · [Panel close-up](panel-closeup.html)

## Fixed composition

1440×900. The approved large hand uses 204×306 cards, 200px step, ±4° fan. Footer B stays transparent at y700 and solid #211d16 at y790; floor continues behind cards. Grid, Log, Reaction and all split footer controls keep their current bounds. The current soft header treatment is retained in the wireframe; Player Turn is now inside the header at (594,48), 252×31, painted above the field. Cinders moves beside the top-right shield. These header placements are proposals, not runtime changes.

Four real perspective depth bands and three columns. Default fill order is explicit:

```
Back:   [2] [3] [1]
Front:  [6] [5] [4]
```

Two default enemies occupy back right first (Enemy 1), then back left (Enemy 2), leaving the middle empty. Their feet are inside that same back row at y329, x1081/x555. Middle examples add Enemy 3 at x818. The player stays at the leftmost bottom cell, x301, feet y505. Core’s intermediate band remains a visually reserved row; this proposal does not change occupancy policy.

## States

| State | Example | Detailed panel placement |
|---|---|---|
| A | Idle | None; overhead intent + HP |
| B | Left enemy focused | Left, x274 y94, 224×116; raised clear of player |
| C | Middle enemy focused | Below, x706 y341, 224×116 |
| D | Right enemy focused | Right, x1175 y150, 224×116 |
| E | Left-column player focused | Right, x435 y351, 224×116 |
| F | Offensive card preselects eligible enemies | All three panels; middle focused |
| G | Self-target card preselects player | Player panel right; separate middle/right placement insets |

Selected actors are highlighted and their cells tint red (enemy) or blue (player). Eligible card candidates use softer tint, while focus has a stronger outline. Candidate preselection only previews eligibility; it never auto-plays the card.

Idle actors show overhead intent/icon and HP. A selected actor retains overhead intent and perceived damage, but removes overhead HP. The detailed panel is vertical: HP bar, Poise bar, then intent icon–name–damage. The single status row sits below the panel, bottom-right aligned. The Dodge icon is larger and centered within its icon box; its small count sits at the bottom corner. The close-up supports real hover/focus/click-to-pin status tooltip illustrations.

Damage and all displayed stats/statuses are **illustrative**, not an authored balance change. Red is perceived damage; green shows a reduced stance-advantage preview (12 → 8). The middle enemy demonstrates failed perception: both overhead and detail show ?, with no hidden move or damage exposed.

## Timing interpretation for approval

One 500ms stable-target threshold, not three cumulative delays. Enter: hover/focus stable for 500ms, then a short fade. Exit: retain the current panel for 500ms, then fade. Switch: the new candidate must remain stable for 500ms before old→new crossfade. A ~150ms fade is drawn only as a proposed visual duration.

Clicks highlight immediately. Target clicks, card play and combat never wait for these detail presentation timers. A continuous pointer corridor joins actor and panel; sprite, corridor, panel and status row all retain the panel while hovered/focused. The leave grace permits travelling to statuses. Reduced motion keeps dwell/grace but switches opacity instantly.

![Timing](timing.png)

## Primary examples

![A idle](state-a.png)

![D right enemy selected](state-d.png)

![F offensive card candidates](state-f.png)

![Selected panel, Dodge and status row](panel-closeup.png)

![Player middle/right placement insets](player-insets.png)

## Other states

'''+''.join(f'### {o["id"]} — {o["name"]}\n\n{o["note"]}\n\n[Full-size view](state-{o["id"].lower()}.html)\n\n![{o["name"]}](state-{o["id"].lower()}.png)\n\n' for o in STATES if o['id']not in['A','D','F'])+'Procedural SVG wireframes only; no screenshots or game artwork are edited. All labels outside the viewport are review annotations, not proposed game UI. `generate.py` contains the shared geometry. PNGs are browser renders. Approval is required before runtime implementation.\n')
print('Generated target HUD proposals:',D)

# Supplemental ownership diagram: deliberately not a claimed 1440px HUD fit.
def crowded_schematic():
 s='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1040" viewBox="0 0 1600 1040"><title>H — six-target ownership schematic only</title><style>'+SVG_STYLE+'</style>'+DEFS+rect(0,0,1600,1040,'#182123','#53645f',8)
 s+=text(30,38,'H · Six eligible enemies — exploded ownership diagram',28,'#e8d4a0')
 s+=text(30,73,'Schematic placement/order only. This is not a proven full-viewport HUD arrangement or an implementation.',20,'#d3c4a1')
 # Shared grid footprint, kept separate from full panels so every owner is readable.
 for band,name in enumerate(['BACK  [2] [3] [1]','FRONT  [6] [5] [4]','EXTRA ROW','PLAYER ROW']):
  y=260+band*140
  for lane in range(3):s+=rect(500+lane*200,y,200,140,'#343f40','#71817a',0)
  s+=text(800,y+24,name,17,'#ccd8d0','middle')
 for who,cx,cy in [(2,600,340),(3,800,340),(1,1000,340),(6,600,480),(5,800,480),(4,1000,480)]:
  s+=f'<circle cx="{cx}" cy="{cy}" r="26" fill="#694743" stroke="{ "#ef9c87" if who==3 else "#ab7970"}" stroke-width="{3 if who==3 else 1}"/>'+text(cx,cy+8,str(who),23,'#fff0d1','middle')
 s+=f'<circle cx="600" cy="760" r="26" fill="#405d66" stroke="#9acbda"/>'+text(600,768,'P',22,'#dbedf1','middle')
 connectors=[(2,'M498 152H535V315L574 340'),(6,'M284 428H470V480L574 480'),(3,'M712 216V248H800V314'),(5,'M712 830V824H820V507'),(1,'M1280 218H1170L1026 340'),(4,'M1280 528H1170V500L1026 480')]
 for who,d in connectors:s+=f'<path d="{d}" fill="none" stroke="#c6b57c" stroke-width="2" stroke-dasharray="6 5"/>'
 for who,at in [(2,(274,94)),(6,(60,370)),(3,(600,40+0)),(5,(600,830)),(1,(1280,160)),(4,(1280,470))]:
  # Keep the top middle panel below the explanatory header.
  if who==3:at=(600,100)
  s+=panel(who,who==3,at)
 s+=text(30,1014,'Six full panels are visible, with numbered ownership links and paired back/front examples.',16,'#d8e1d9')
 s+=text(30,1035,'Remaining implementation work: collision-aware compact/staggered panels, preserving preferred sides when possible; never silently hide an eligible panel.',14,'#d3c4a1')
 return s+'</svg>'
(D/'state-h.svg').write_text(crowded_schematic())
(D/'state-h.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>H — six-target ownership schematic</title><style>html,body{margin:0;background:#151c1e}svg{width:100%;height:auto;display:block}</style>'+crowded_schematic()+'</html>')
# Review-only supplement is outside the seven proposed gameplay states.
hsection='<section class="evidence"><h2>H · Six-target ownership supplement</h2><p class="notice">Exploded schematic only: not a proven full-viewport HUD fit or an implementation. All six panels stay visible; numbered links show ownership. Crowded back/front pairs still need collision-aware compact/staggered placement before implementation.</p><img src="state-h.svg" alt="Exploded six-target ownership schematic"><p><a href="state-h.html">Open full-size H diagram</a></p></section>'
p=D/'index.html';p.write_text(p.read_text().replace('<section id="timing"',hsection+'<section id="timing"'))
p=D/'README.md';p.write_text(p.read_text()+'\n## H — six-target ownership supplement\n\n[Open H](state-h.html). Exploded ownership/paired-row schematic only, **not a proven 1440×900 HUD layout or an implementation**. All six panels remain visible. Before implementation, crowded back/front pairs need collision-aware compact/staggered placement that preserves preferred sides when possible. This review does not introduce a dock or silently hide any panel.\n\n![Six-target ownership diagram](state-h.png)\n')
# Selected-overhead detail uses exactly the same rendering function as the states.
intent_diagram='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="210" viewBox="0 0 1200 210"><title>Selected overhead intent remains; only overhead HP is removed</title>'+rect(0,0,1200,210,'#283437','#53645f',5)
for x,kind,title,adv in [(200,'attack','Left: perceived 12 → 8 advantage',True),(600,'unknown','Middle: intent and damage hidden',False),(1000,'dodge','Right: centered Dodge, small count',False)]:
 intent_diagram+=text(x,31,title,19,'#e7d49e','middle')+intent(x,95,kind,True,1.25,adv)
intent_diagram+=text(600,190,'Selected intent stays overhead. Only overhead HP is removed. Values are illustrative.',19,'#c9d6ce','middle')+'</svg>'
(D/'intent-overhead.svg').write_text(intent_diagram)
