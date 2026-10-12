// Review-only player. Native source frames stay unchanged; no runtime commands.
const $=id=>document.getElementById(id);
let catalog,selected,index=0,playing=false,timer,request=0;const images=new Map();
const labels=['Start stance','Action1','Action2','Action3','Return stance'];
function stop(){playing=false;clearTimeout(timer);}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(index<4){index++;render();schedule();}else if($('loop').checked){index=0;render();schedule();}else{stop();render();}},catalog.reviewSlotMs/Number($('speed').value));}
function render(){
  const item=selected, family=catalog.families[item.family],frame=images.get(item.frames[index]);
  $('title').textContent=`${item.id} · ${item.name}`;$('step-label').textContent=`${index+1}/5 · ${labels[index]}${index===0||index===4?' · '+family.origin:''} · Next: ${index<4?`${index+2} ${labels[index+1]}`:'End'}`;
  $('frame').src=frame.src;$('frame').alt=`${item.id} ${item.name}, slot${index+1} of5: ${labels[index]}`;$('frame').width=family.size[0];$('frame').height=family.size[1];
  $('caveat').hidden=!item.caveat;$('caveat').textContent=item.caveat||'';
  $('gif').href=`renders/${item.id}.gif`;$('storyboard').href=item.storyboard;$('provenance').href=item.provenance;
  $('play').textContent=playing?'Pause':'Play';$('timeline').innerHTML='';
  labels.forEach((label,i)=>{const button=document.createElement('button');button.type='button';button.className='slot';button.innerHTML=`<strong>${i+1}</strong>${label}`;if(i===index)button.setAttribute('aria-current','step');button.addEventListener('click',()=>seek(i));$('timeline').append(button);});
  document.querySelectorAll('.example').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===item.id)));
  document.querySelectorAll('.family').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.family===item.family)));
}
function seek(i){stop();index=Math.max(0,Math.min(4,i));render();}
async function select(id){
  stop();const token=++request,item=catalog.examples.find(row=>row.id===id);if(!item)throw Error('Unknown example '+id);
  $('title').textContent=`Loading ${id}…`;$('frame').hidden=true;$('copy').disabled=true;document.querySelectorAll('.transport button,.timeline button').forEach(button=>button.disabled=true);
  try{await Promise.all(item.frames.map(async path=>{if(images.has(path))return;const image=new Image();image.src=path;await image.decode();images.set(path,image);}));if(token!==request)return;selected=item;index=0;$('frame').hidden=false;$('copy').disabled=false;render();document.querySelectorAll('.transport button,.timeline button').forEach(button=>button.disabled=false);}
  catch(error){if(token!==request)return;$('title').textContent=`${id} unavailable`;$('step-label').textContent=error.message;$('timeline').innerHTML='';}
}
function showFamily(family){$('examples').innerHTML='';for(const item of catalog.examples.filter(row=>row.family===family)){const button=document.createElement('button');button.type='button';button.className='example';button.dataset.id=item.id;button.innerHTML=`<strong>${item.id}</strong>${item.name}`;button.addEventListener('click',()=>select(item.id));$('examples').append(button);}return select(catalog.examples.find(row=>row.family===family).id);}
async function init(){const response=await fetch('examples.json');if(!response.ok)throw Error('Example index unavailable');catalog=await response.json();if(catalog.status){$('review-status').hidden=false;$('review-status').textContent=catalog.status;}for(const [id,family]of Object.entries(catalog.families)){const button=document.createElement('button');button.type='button';button.className='family';button.dataset.family=id;const count=catalog.examples.filter(row=>row.family===id).length;button.textContent=count?`${family.label} ·${count} examples`:`${family.label} ·pending`;button.disabled=!count;button.addEventListener('click',()=>showFamily(id));$('families').append(button);}
  $('previous').addEventListener('click',()=>seek(index-1));$('next').addEventListener('click',()=>seek(index+1));$('play').addEventListener('click',()=>{if(playing){stop();render();}else{if(index===4)index=0;playing=true;render();schedule();}});$('speed').addEventListener('change',()=>{if(playing)schedule();});$('copy').addEventListener('click',async()=>{const text=`${selected.id} · ${selected.name}`;try{await navigator.clipboard.writeText(text);$('copy-status').textContent='Copied';}catch{$('copy-status').textContent=text;}});const firstFamily=Object.keys(catalog.families).find(id=>catalog.examples.some(row=>row.family===id));if(!firstFamily)throw Error('Revised sources are not ready');await showFamily(firstFamily);window.__smashSweepReview={ready:true,select:async id=>{const item=catalog.examples.find(row=>row.id===id);if(!item)throw Error('Unknown example');if(item.family!==selected.family)await showFamily(item.family);await select(id);},seek,get state(){return{id:selected.id,index,playing,frames:selected.frames};}};
}
init().catch(error=>{$('title').textContent='Review unavailable';$('step-label').textContent=error.message;$('timeline').innerHTML='';});
