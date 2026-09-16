// Original vector sprite recipes; each of the six frames changes geometry.
export const EXTRA_EFFECTS={edgeSweep:'Edge glint sweep',airWake:'Cloth and air wake',heelScuff:'Heel scuff',shieldScrape:'Shield scrape',pommelContact:'Pommel contact',bluntCompression:'Blunt compression',piercingEntry:'Piercing entry',armorDeflection:'Armor deflection',palmGather:'Palm gather',channelFilament:'Weapon channel',homingTurn:'Homing turn',projectileDissipate:'Projectile dissipate',wardCatch:'Directional ward catch',barrierCrack:'Barrier crack',barrierMend:'Barrier mend',spellAbsorb:'Spell absorption',bleedTick:'Bleed tick',frostShed:'Frost shedding',poisonSeep:'Poison seep',staggerRecover:'Stagger recovery',sigilTrace:'Ground sigil trace',tetherStrand:'Tether strand',chainJunction:'Chain junction',teleportResidue:'Teleport residue'};
export function effectSVG(id,frame){
 const t=(frame+1)/6,r=20+t*65,a=Math.sin(t*Math.PI)*.75+.15;
 const line=(d,color='#d6d2b8',w=3)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
 const ring=(x,y,rx,ry,color='#8edbea')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="2"/>`;
 const dot=(x,y,s,color)=>`<circle cx="${x}" cy="${y}" r="${s}" fill="${color}"/>`;
 const rays=(count,color,offset=0)=>Array.from({length:count},(_,i)=>{const q=i*6.283/count+offset;return line(`M ${128+Math.cos(q)*r*.45} ${128+Math.sin(q)*r*.45} L ${128+Math.cos(q)*r} ${128+Math.sin(q)*r}`,color,2);}).join('');
 let shape='';
 switch(id){
 case 'edgeSweep':shape=line(`M ${40+t*30} ${190-t*50} Q 120 ${30+t*10} ${210-t*25} ${65+t*40}`,'#fff5cf',2)+dot(70+t*110,105-t*12,3,'#fff');break;
 case 'airWake':shape=[0,1,2].map(i=>line(`M ${40+t*20} ${85+i*26} Q 150 ${115+i*18} ${210-t*30} ${50+i*40}`,'#b4c5c3',1.5)).join('');break;
 case 'heelScuff':shape=Array.from({length:10},(_,i)=>dot(110+Math.cos(i*2)*r,185-Math.abs(Math.sin(i))*r*.4,2+(i%3),'#bba185')).join('');break;
 case 'shieldScrape':shape=Array.from({length:8},(_,i)=>line(`M 95 105 L ${115+r+i*3} ${120+i*10+t*20}`,'#e1c38a',1.7)).join('');break;
 case 'pommelContact':shape=ring(128,128,r*.5,r*.38,'#debd8c')+rays(5,'#e4d8c6',.4);break;
 case 'bluntCompression':shape=ring(128,155,r,r*.3,'#c5afa0')+ring(128,128,r*.7,r*.6,'#e8ccb0');break;
 case 'piercingEntry':shape=line(`M ${30+t*90} 128 L ${190+t*30} 128`,'#fff1c8',4)+line(`M 165 ${110-t*20} L 195 128 L 165 ${146+t*20}`,'#e5d3aa',2);break;
 case 'armorDeflection':shape=line(`M 65 190 L 125 125 L ${140+t*70} ${100-t*40}`,'#e8e4d8',4)+rays(7,'#d6bc89',1);break;
 case 'palmGather':shape=Array.from({length:9},(_,i)=>{const q=i*.7+t*2;return dot(128+Math.cos(q)*(95-r*.8),128+Math.sin(q)*(95-r*.8),2+i%3,'#92c9ff');}).join('')+ring(128,128,12+t*7,12+t*7);break;
 case 'channelFilament':shape=[-1,1].map(k=>line(`M 40 185 Q ${80+t*40} ${45+k*20} 128 128 T 215 55`,'#99cfff',2)).join('')+dot(50+t*150,178-t*115,4,'#e9f5ff');break;
 case 'homingTurn':shape=line(`M 40 185 Q 60 45 ${125+t*80} ${100-t*50}`,'#a4d8fd',4)+dot(125+t*80,100-t*50,6,'#e9fbff');break;
 case 'projectileDissipate':shape=Array.from({length:12},(_,i)=>dot(128+Math.cos(i*1.7)*r,128+Math.sin(i*1.7)*r,5*(1-t)+1,'#96d7fc')).join('');break;
 case 'wardCatch':shape=line(`M ${120+r*.3} 35 Q ${190+r*.3} 128 ${120+r*.3} 221`,'#b6eaff',5)+line(`M 45 128 L ${100+t*40} 128`,'#eafaff',2);break;
 case 'barrierCrack':shape=ring(128,128,80,90)+line(`M 128 40 L ${112+t*14} 90 L 150 120 L ${120-t*20} 160 L 138 215`,'#edf8ff',3);break;
 case 'barrierMend':shape=ring(128,128,85-r*.25,95-r*.25,'#b6eac7')+Array.from({length:5},(_,i)=>line(`M ${65+i*30} ${190-t*110} l 0 13 m -6 -6 l 12 0`,'#dafbe3',2)).join('');break;
 case 'spellAbsorb':shape=[0,1,2].map(i=>ring(128,128,Math.max(4,90-t*65-i*14),Math.max(4,85-t*60-i*12),'#8cbded')).join('')+dot(128,128,4+t*6,'#d4f2ff');break;
 case 'bleedTick':shape=`<path d="M 128 ${62+t*55} q -22 28 -12 40 q 12 15 24 0 q 10 -12 -12 -40" fill="#b64f55"/>`+ring(128,195,r*.3,4,'#99494e');break;
 case 'frostShed':shape=Array.from({length:7},(_,i)=>line(`M ${60+i*23} ${65+(i%3)*20+t*60} l 7 7 l -7 7 l -7 -7 Z`,'#b9e5ee',2)).join('');break;
 case 'poisonSeep':shape=ring(128,188,r,r*.28,'#9ec58a')+Array.from({length:5},(_,i)=>dot(80+i*23,160-t*60+(i%2)*20,3+i%3,'#a1be67')).join('');break;
 case 'staggerRecover':shape=[0,1,2].map(i=>line(`M ${65+i*55} ${190-t*65} l 0 -32 l -6 8 m 6 -8 l 6 8`,'#dfd0a4',2)).join('');break;
 case 'sigilTrace':shape=ring(128,174,r,r*.36,'#c9bba3')+line(`M 128 ${160-r*.3} L ${128+r*.7} 190 L ${128-r*.7} 190 Z`,'#c0cbd6',2);break;
 case 'tetherStrand':shape=line(`M 20 128 Q 90 ${80+t*80} 128 128 T 236 128`,'#b49fce',3)+dot(20,128,5,'#decdee')+dot(236,128,5,'#decdee');break;
 case 'chainJunction':shape=[0,1,2].map(i=>{const q=i*2.094+t*.25;return line(`M 128 128 Q ${128+Math.cos(q)*r*.5} ${128+Math.sin(q)*r*.3} ${128+Math.cos(q)*r} ${128+Math.sin(q)*r}`,'#aecddd',4);}).join('')+ring(128,128,12,12);break;
 case 'teleportResidue':shape=[0,1,2,3].map(i=>ring(128,70+i*32,r*.55*(1-i*.1),10+i*3,'#b6acd6')).join('')+rays(6,'#d0c6e8',t);break;
 default:throw Error('Unknown extra effect');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g opacity="${a}">${shape}</g></svg>`;
}
