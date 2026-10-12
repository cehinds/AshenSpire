const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
let config, assets, images = {}, variant = 'P', mode = 'guard', index = 0, playing = false, timer;
const titleCase = text => text.charAt(0).toUpperCase() + text.slice(1);
function steps(options = {}) {
  const order = config.variants.find(item => item.id === variant).order;
  const stance = code => ({code, assetId:code, name:config.labels[code], duration:config.defenseSlotMs,timing:'Review timing'});
  const defense = order.map(stance);
  const origin = options.origin ?? $('origin').value;
  const context = options.context ?? $('context').checked;
  const attack = assets.attack.frameIds.map((assetId, i) => ({code: `AT${i + 1}`, assetId, name: titleCase(assets.frames[assetId].label), duration: config.defenseSlotMs, timing: 'Review timing'}));
  if (mode === 'guard') return context ? [stance(origin), ...defense, stance(origin)] : defense;
  if (mode === 'evade') return [stance(origin), ...assets.evade.frameIds.map((assetId,i)=>({code:`EV${i+1}`,assetId,name:assets.frames[assetId].label,duration:config.defenseSlotMs,timing:'Review timing'})), stance(origin)];
  if (mode === 'attack' || mode === 'smash') return [stance(origin), ...attack, stance(origin)];
  const response = [...defense, stance('S'), ...attack, stance(origin)];
  return context ? [stance(origin), ...response] : response;
}
function numberedOrder() { return `${variant} · ${config.modes[mode]}: ${steps().map((step, i) => `${i + 1} ${step.code} (${step.name})`).join(' → ')}`; }
function render() {
  const list = steps(), step = list[index], next = list[index + 1];
  ctx.fillStyle = '#192025'; ctx.fillRect(0,0,768,704);
  ctx.fillStyle = '#afc99a'; ctx.font = '600 17px system-ui'; ctx.fillText(`${variant} · ${config.modes[mode]} · ${index + 1} / ${list.length} · Origin ${$('origin').value}`,24,32);
  ctx.fillStyle = '#f0f3e9'; ctx.font = '700 36px system-ui'; ctx.fillText(`${step.code}  ${step.name}`,24,78);
  ctx.fillStyle = '#b7c0c1'; ctx.font = '16px system-ui'; ctx.fillText(`${step.duration} ms at 1× · ${step.timing}`,24,107);
  for(let y=128;y<640;y+=32) for(let x=0;x<768;x+=32) {ctx.fillStyle=((x/32+(y-128)/32)%2 ? '#242b2f':'#20272b');ctx.fillRect(x,y,32,32);}
  ctx.strokeStyle='#53604f'; ctx.beginPath();ctx.moveTo(16,592);ctx.lineTo(752,592);ctx.stroke();
  const frame = assets.frames[step.assetId];
  ctx.drawImage(images[step.assetId], frame.drawOffset[0], 128 + frame.drawOffset[1], ...frame.size);
  ctx.fillStyle='#d9e2cd';ctx.font='600 19px system-ui';ctx.fillText(`Next: ${next ? `${next.code} · ${next.name}` : 'End / return pose'}`,24,669);
  $('current').textContent = `${index + 1}/${list.length} · ${step.code} — ${step.name} · Next: ${next?.code ?? 'End'}`;
  $('timeline').innerHTML = '';
  list.forEach((item,i) => {const button=document.createElement('button');button.className='slot';button.type='button';button.setAttribute('aria-label',`Slot ${i+1}: ${item.code}, ${item.name}`);if(i===index)button.setAttribute('aria-current','step');button.innerHTML=`${i+1}<strong>${item.code}</strong>${item.duration} ms`;button.addEventListener('click',()=>seek(i));$('timeline').append(button);});
  document.querySelectorAll('.variant').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.id===variant));button.disabled=['attack','smash','evade'].includes(mode);});
  $('play').textContent=playing?'Pause':'Play';
  canvas.setAttribute('aria-label',`${numberedOrder()}. Current slot ${index+1}: ${step.name}`);
}
function pause(){playing=false;clearTimeout(timer);if(config&&assets)render();}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{const list=steps();if(index+1<list.length){index++;render();schedule();}else if($('loop').checked){index=0;render();schedule();}else{pause();}},steps()[index].duration / Number($('speed').value));}
function seek(value){playing=false;clearTimeout(timer);index=Math.max(0,Math.min(steps().length-1,value));render();}
function select(nextVariant,nextMode,origin){playing=false;clearTimeout(timer);if(nextMode!==mode&&!origin){$('context').checked=nextMode==='counter';$('origin').value=({guard:'D',counter:'C',attack:'T',smash:'S',evade:'E'})[nextMode];}if(origin){$('origin').value=origin;$('context').checked=true;}variant=nextVariant;mode=nextMode;$('mode').value=mode;index=0;render();}
async function init(){
  document.querySelectorAll('button,select,input').forEach(item=>item.disabled=true);
  [config,assets]=await Promise.all(['sequences.json','preview-assets.json'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error(`${path}: ${response.status}`);return response.json();}));
  await Promise.all(Object.entries(assets.frames).map(async([id,frame])=>{const image=new Image();image.src=frame.imagePath;await image.decode();images[id]=image;}));
  config.variants.forEach(item=>{const button=document.createElement('button');button.className='variant';button.dataset.id=item.id;button.type='button';button.innerHTML=`<strong>${item.id} · ${item.name}</strong><span class="order">${item.order.join(' → ')}</span><span>${item.status}</span>`;button.addEventListener('click',()=>select(item.id,mode));$('variants').append(button);});
  Object.entries(config.labels).forEach(([code,name])=>{const div=document.createElement('div');const dt=document.createElement('dt');dt.textContent=`${code} · ${name}`;const dd=document.createElement('dd');dd.textContent=config.sourceChoices[code];div.append(dt,dd);$('legend').append(div);});
  $('timing').textContent=config.timingNote;
  $('mode').addEventListener('change',()=>select(variant,$('mode').value));
  $('origin').value='D';
  $('origin').addEventListener('change',()=>{ $('context').checked=true;select(variant,mode);});
  $('context').addEventListener('change',()=>seek(0));
  $('previous').addEventListener('click',()=>seek(index-1));$('next').addEventListener('click',()=>seek(index+1));
  $('play').addEventListener('click',()=>{if(playing){pause();return;}if(index===steps().length-1)index=0;playing=true;render();schedule();});
  $('speed').addEventListener('change',()=>{if(playing)schedule();});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(numberedOrder());$('copy-status').textContent='Numbered order copied';}catch{$('copy-status').textContent=numberedOrder();}});
  document.querySelectorAll('button,select,input').forEach(item=>item.disabled=false);
  const completeAttack = assets.attack.frameIds.length === 6;
  for (const option of $('mode').options) option.disabled = option.value === 'evade' ? !assets.evade?.frameIds?.length : option.value !== 'guard' && !completeAttack;
  for (const option of $('origin').options) option.disabled = !assets.frames[option.value];
  window.__sequenceReview={ready:true,select,seek,pause,steps,numberedOrder,get state(){return{variant,mode,index,playing};},canvas};render();
}
init().catch(error=>{$('current').textContent=`Preview unavailable: ${error.message}`;console.error(error);});
