const C=window.ART_CONTINUATION;
const $=id=>document.getElementById(id);
const layers=new Map(C.layers.map(x=>[x.id,x])),actors=new Map(C.actors.map(x=>[x.id,x]));
let hidden=new Set(),moving=[],frame=0;
for(const s of C.scenes){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('scene').append(o)}
for(const a of C.actors.filter(x=>x.family!=='enemy')){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('actor').append(o)}
for(const a of C.actors.filter(x=>['speaker','companion'].includes(x.family))){const link=document.createElement('a');link.className='sprite';link.href=a.file;link.download='';const img=document.createElement('img');img.src=a.file;img.alt=a.name;img.loading='lazy';const title=document.createElement('span');title.textContent=a.name;link.append(img,title);$('sprites').append(link)}
const pct=(n,total)=>`${n/total*100}%`;
function draw(){
 const s=C.scenes.find(x=>x.id===$('scene').value);if(!s){$('stage').textContent='Scene production in progress';return}
 const device=$('device').value,d=s.devices[device];$('stage').className=device;$('stage').replaceChildren();$('layers').replaceChildren();moving=[];
 $('scene-name').textContent=s.name;$('scene-id').textContent=`${s.id} · ${d.width} × ${d.height}`;
 d.layers.forEach((t,i)=>{
  const a=layers.get(t.id),img=document.createElement('img');img.src=a.file;img.alt=a.kind;img.className='art-layer';img.dataset.layer=a.kind;img.style.cssText=`left:${pct(t.x,d.width)};top:${pct(t.y,d.height)};width:${pct(t.width,d.width)};height:${pct(t.height,d.height)};z-index:${a.kind==='foreground'?5:i};visibility:${hidden.has(a.kind)?'hidden':'visible'}`;$('stage').append(img);moving.push({img,depth:t.depth});
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!hidden.has(a.kind);check.addEventListener('change',()=>{check.checked?hidden.delete(a.kind):hidden.add(a.kind);img.style.visibility=check.checked?'visible':'hidden'});label.append(check,document.createTextNode(a.kind));$('layers').append(label);
 });
 if($('actors').checked)d.actors.forEach((p,i)=>{
  const a=actors.get(i===0?$('actor').value:p.id),b=a.visibleBounds;let scale=p.height*d.height/(b[3]-b[1]);scale=Math.min(scale,d.width*(device==='phone'?.43:.35)/(b[2]-b[0]));
  const img=document.createElement('img');img.src=a.file;img.alt=a.name;img.className='actor';img.style.cssText=`left:${pct(p.x*d.width-a.footAnchor[0]*scale,d.width)};top:${pct(p.footY*d.height-a.footAnchor[1]*scale,d.height)};width:${pct(a.size[0]*scale,d.width)};height:${pct(a.size[1]*scale,d.height)}`;$('stage').append(img);
 });
 window.previewState={scene:s.id,device,layers:d.layers.length,actors:$('actors').checked};pan(Number($('pan').value));
}
function pan(v){moving.forEach(({img,depth})=>img.style.transform=`translateX(${v*depth*8}px)`)}
function tick(t){if($('motion').checked)pan(Math.sin(t/2200));frame=requestAnimationFrame(tick)}
for(const id of ['scene','device','actor','actors'])$(id).addEventListener('change',draw);
$('pan').addEventListener('input',()=>{ $('motion').checked=false;pan(Number($('pan').value)) });
$('motion').addEventListener('change',()=>{if(!$('motion').checked)pan(Number($('pan').value))});
const params=new URLSearchParams(location.search);if(params.has('scene'))$('scene').value=params.get('scene');if(params.has('device'))$('device').value=params.get('device');
draw();frame=requestAnimationFrame(tick);
