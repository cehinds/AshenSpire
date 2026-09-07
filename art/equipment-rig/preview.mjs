import {SETUPS} from './catalog.mjs';
import {loadTextures,render} from './renderer.mjs';
const $=id=>document.getElementById(id),select=$('setup');
for(const [id,s]of Object.entries(SETUPS)){const o=new Option(s.name,id);select.add(o)}
let textures,request=0,playing=false;
function draw(){if(!textures)return;let max=0;for(const id of ['reaver','starseer']){const s=render($(id),textures,id,select.value,$('action').value,Number($('time').value)/100,{debug:$('debug').checked,effects:$('effects').checked});max=Math.max(max,s.right.error,s.left.error)}$('phase').value=$('time').value+'%';$('status').textContent=`${SETUPS[select.value].name} · Shared ${$('action').value} movement · Hand target error: ${max.toFixed(1)} px`;}
function stop(){cancelAnimationFrame(request);playing=false;$('play').textContent='Play animation';}
select.onchange=()=>{stop();$('action').value=SETUPS[select.value].action;$('time').value=0;draw()};
for(const id of ['action','time','debug','effects'])$(id).addEventListener('input',()=>{stop();draw()});
$('play').onclick=()=>{if(playing){stop();return}playing=true;$('play').textContent='Pause';const start=performance.now(),duration=1800;const tick=now=>{$('time').value=Math.min(100,(now-start)/duration*100);draw();if(now-start<duration)request=requestAnimationFrame(tick);else stop()};request=requestAnimationFrame(tick)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
try{textures=await loadTextures();draw();window.rigPreview={render:(id,setup,action,t,opts)=>render($(id),textures,id,setup,action,t,opts),ready:true}}catch(e){$('error').textContent='The prototype assets could not load: '+e.message;console.error(e)}
