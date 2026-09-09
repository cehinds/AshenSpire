import {SHEETS,POSES,countAnchors} from './anchors.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
let cls=new URLSearchParams(location.search).get('class')||'reaver',index=0,clipId=0;
if(!SHEETS[cls])cls='reaver';
function el(name,attrs={}){const n=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;}
function picture(i,source=false,small=false){
 const s=SHEETS[cls],w=source?1600:s.size[0],h=source?920:s.size[1],cw=w/4,ch=h/2;
 const svg=el('svg',{viewBox:`${i%4*cw} ${Math.floor(i/4)*ch} ${cw} ${ch}`,role:'img','aria-label':`${cls} ${POSES[i]} ${source?'source':'combined reference'}`});
 const id=`cell-${++clipId}`,defs=el('defs'),clip=el('clipPath',{id});clip.append(el('rect',{x:i%4*cw,y:Math.floor(i/4)*ch,width:cw,height:ch}));defs.append(clip);svg.append(defs);
 svg.append(el('image',{href:`art/combined-reference/${source?'source-frames':'masters'}/${cls}.png`,width:w,height:h,'clip-path':`url(#${id})`}));
 if(source)return svg;
 const f=s.frames[i];
 function line(a,b,color,dash){svg.append(el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':1.3,...(dash?{'stroke-dasharray':'5 4'}:{})}));}
 function dot(p,color,label){const c=el('circle',{cx:p[0],cy:p[1],r:small?3:3.5,fill:color,stroke:'#141311','stroke-width':1});const t=el('title');t.textContent=label;c.append(t);svg.append(c);}
 if($('axis').checked)for(const w of f.weapons)line(w.handle,w.tip,'#ffdf62',true);
 if($('anchors').checked){
  f.weapons.forEach((w,j)=>{dot(w.handle,'#ffdf62',`Weapon ${j+1}: handle`);dot(w.tip,'#ffdf62',`Weapon ${j+1}: tip`)});
  for(const[key,hand]of Object.entries(f.hands)){const color=key==='main'?'#37def6':'#ff8f87';line(hand.left,hand.right,color);dot(hand.left,color,`${key} hand: local left`);dot(hand.right,color,`${key} hand: local right`);}
 }
 return svg;
}
function render(){
 $('combined').replaceChildren(picture(index));$('original').replaceChildren(picture(index,true));
 $('heading').textContent=`${cls[0].toUpperCase()+cls.slice(1)} · ${SHEETS[cls].equipment}`;
 const f=SHEETS[cls].frames[index];$('status').textContent=`${POSES[index]} · ${countAnchors(f)} anchors (${f.weapons.length*2} weapon, 4 hand)${f.notes?' · '+f.notes:''}`;
 $('frames').replaceChildren(...POSES.map((pose,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(i===index));b.setAttribute('aria-label',pose);b.append(picture(i,false,true),Object.assign(document.createElement('span'),{textContent:`${i+1}. ${pose}`}));b.onclick=()=>{index=i;$('pose').value=pose;render()};return b}));
 for(const b of $('classes').children)b.setAttribute('aria-pressed',String(b.dataset.class===cls));
 history.replaceState(null,'',`?class=${cls}`);window.combinedReference={cls,index,anchors:countAnchors(f)};
}
for(const c of Object.keys(SHEETS)){const b=document.createElement('button');b.type='button';b.dataset.class=c;b.textContent=c[0].toUpperCase()+c.slice(1);b.onclick=()=>{cls=c;index=0;$('pose').value='guard';render()};$('classes').append(b)}
for(const pose of POSES){const o=document.createElement('option');o.value=o.textContent=pose;$('pose').append(o)}
$('pose').onchange=()=>{index=POSES.indexOf($('pose').value);render()};$('anchors').onchange=$('axis').onchange=render;render();
