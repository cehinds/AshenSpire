const art=window.DAGGER_ART, $=id=>document.getElementById(id);
let group=art.groups.find(g=>g.id==='rogue')||art.groups[0];
let order=[...art.attack.frames], impact=art.attack.impactIndex, index=0, playing=true, elapsed=0, last=0;
const action=$('action'), cards=[];
document.title='Single dagger · all classes and outfits';
document.querySelector('h1').textContent='Single dagger / All classes and outfits';
document.querySelector('header p').textContent='Right hand: dagger · left hand: empty. One shared choreography; class and armor change only. '+art.groups.length+' distinct appearances / '+art.outfits.length+' catalog entries.';
const pickers=document.createElement('div');pickers.className='controls';
pickers.innerHTML='<label>Class <select id="classFilter"><option value="all">All four classes</option><option value="rogue">Rogue</option><option value="reaver">Reaver</option><option value="starseer">Starseer</option><option value="herald">Herald</option></select></label><label>Appearance <select id="outfit"></select></label>';
document.querySelector('header').append(pickers);
const collection=document.createElement('section');collection.innerHTML='<h2>Compare outfits in sync</h2><p>Every visible skin follows the same frame and timing. Select one to inspect its complete pose sheet.</p><div class="gallery" id="outfits"></div>';
document.querySelector('main').after(collection);
for(const g of art.groups){const button=document.createElement('button');button.className='pose';button.dataset.classId=g.classId;button.setAttribute('aria-label','Select '+g.id);const img=new Image();img.alt=g.id;const title=document.createElement('span');title.textContent=g.classId+' / '+g.name;const id=document.createElement('small');id.textContent=g.id;button.append(img,title,id);button.onclick=()=>selectGroup(g.id);$('outfits').append(button);cards.push({button,img,group:g})}
function options(){const filtered=art.groups.filter(g=>$('classFilter').value==='all'||g.classId===$('classFilter').value);$('outfit').replaceChildren();for(const g of filtered)$('outfit').add(new Option(g.classId+' / '+g.name+' ['+g.armourId+']',g.id));if(!filtered.includes(group))group=filtered[0];$('outfit').value=group.id;cards.forEach(c=>c.button.hidden=$('classFilter').value!=='all'&&c.group.classId!==$('classFilter').value);poseGallery();show()}
function selectGroup(id){group=art.groups.find(g=>g.id===id);$('outfit').value=id;poseGallery();show()}
function poseGallery(){const gallery=$('gallery');gallery.replaceChildren();for(const pose of art.poses){const b=document.createElement('button');b.className='pose';b.setAttribute('aria-label','Inspect '+pose);const img=new Image();img.src=group.frames[pose].file;img.alt=pose;const label=document.createElement('span');label.textContent=pose;b.append(img,label);b.onclick=()=>{action.value=pose;setPlaying(false);index=0;show()};gallery.append(b)}$('sheet').src=group.directory+'/labeled-sheet.webp';$('sheet').alt=group.id+' labeled single-dagger pose sheet'}
for(const pose of art.poses)action.add(new Option(pose,pose));
$('duration').value=art.attack.frameMs;
function activeFrames(){return action.value==='attack'?order:[action.value]}
function frameMs(){return Math.max(30,Math.min(2000,Number($('duration').value)||100))}
function config(){return {frames:order,frameMs:frameMs(),impactIndex:impact}}
function show(){const list=activeFrames();index=Math.min(index,list.length-1);const pose=list[index];$('figure').src=group.frames[pose].file;$('figure').alt=group.id+' '+pose+', right-hand dagger, left hand empty';$('status').textContent=group.id+' · '+(action.value==='attack'?'Step '+(index+1)+' / '+list.length+' · ':'')+pose+(action.value==='attack'&&index===impact?' · IMPACT':'');$('scrub').max=list.length-1;$('scrub').value=index;[...$('sequence').children].forEach((el,i)=>el.classList.toggle('current',action.value==='attack'&&i===index));for(const c of cards)if(!c.button.hidden)c.img.src=c.group.frames[pose].file;$('json').value=JSON.stringify(config(),null,2)}
function setPlaying(value){playing=value;elapsed=0;$('play').textContent=playing?'Pause':'Play'}
function edit(){impact=Math.min(impact,order.length-1);index=0;elapsed=0;drawOrder();show()}
function drawOrder(){const host=$('sequence');host.replaceChildren();order.forEach((pose,i)=>{const row=document.createElement('div');row.className='step';const num=document.createElement('span');num.textContent=i+1;const select=document.createElement('select');select.setAttribute('aria-label','Pose for step '+(i+1));art.poses.forEach(p=>select.add(new Option(p,p)));select.value=pose;select.onchange=()=>{order[i]=select.value;edit()};row.append(num,select);for(const [text,delta,label] of [['↑',-1,'Move step up'],['↓',1,'Move step down'],['×',0,'Remove step']]){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',label+' '+(i+1));b.disabled=delta===-1?i===0:delta===1?i===order.length-1:order.length===1;b.onclick=()=>{if(delta){const target=i+delta;[order[i],order[target]]=[order[target],order[i]];if(impact===i)impact=target;else if(impact===target)impact=i}else{order.splice(i,1);if(i<impact)impact--}edit()};row.append(b)}host.append(row)});$('impact').replaceChildren();order.forEach((pose,i)=>$('impact').add(new Option((i+1)+' · '+pose,i)));$('impact').value=impact}
$('classFilter').onchange=options;$('outfit').onchange=()=>selectGroup($('outfit').value);
$('play').onclick=()=>setPlaying(!playing);
function step(delta){setPlaying(false);index=(index+delta+activeFrames().length)%activeFrames().length;show()}
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);
$('scrub').oninput=()=>{setPlaying(false);index=Number($('scrub').value);show()};
action.onchange=()=>{index=0;elapsed=0;show()};
$('duration').onchange=()=>{$('duration').value=frameMs();elapsed=0;show()};$('speed').onchange=()=>elapsed=0;
$('impact').onchange=()=>{impact=Number($('impact').value);show()};
$('guide').onchange=()=>$('stage').classList.toggle('guide',$('guide').checked);
$('backdrop').onchange=()=>{const value=$('backdrop').value;$('stage').style.backgroundImage=value==='checker'?'':'none';$('stage').style.backgroundColor=value==='checker'?'':value};
$('add').onclick=()=>{order.push('STANCE-READY');edit()};$('reset').onclick=()=>{order=[...art.attack.frames];impact=art.attack.impactIndex;edit()};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('json').value);$('copyStatus').textContent=' Copied'}catch{$('json').select();$('copyStatus').textContent=' Select and copy the JSON above'}};
function tick(time){const dt=Math.min(100,time-last);last=time;if(playing&&action.value==='attack'){elapsed+=dt;const duration=frameMs()/Number($('speed').value);if(elapsed>=duration){index=(index+Math.floor(elapsed/duration))%order.length;elapsed%=duration;show()}}requestAnimationFrame(tick)}
drawOrder();options();requestAnimationFrame(tick);
