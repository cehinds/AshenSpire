// Local review composition only. The game source, saves and rendering code are not edited.
if(location.port==='4187'){const url=new URL(location.href);url.port='4189';location.replace(url.href);}
const $=s=>document.querySelector(s),frame=$('iframe');
const assets=window.COMBAT_ART_CATALOG.entries;
function draw(host,id){const e=assets.find(x=>x.id===id&&x.status==='generated');host.replaceChildren();if(!e)return;const im=new Image();im.src=e.file;im.alt=e.name;const [w,h]=e.validation.size,b=e.validation.visibleBounds;const k=Math.min(host.clientHeight/(b[3]-b[1]),host.clientWidth/(b[2]-b[0]));Object.assign(im.style,{width:w*k+'px',height:h*k+'px',left:host.clientWidth/2-e.validation.anchor[0]*k+'px',bottom:-(h-e.validation.anchor[1])*k+'px'});host.append(im);}
function paint(){draw($('#hero-sprite'),'reaver-default');draw($('#enemy-sprite'),'charredColossus');draw($('#hound-sprite'),'blightHound');}
new ResizeObserver(paint).observe($('#stage'));paint();
function installInterface(){
  const doc=frame.contentDocument;
  if(!doc?.head || doc.getElementById('art-preview-style')) return;
  const style=doc.createElement('style');
  style.id='art-preview-style';
  style.textContent='html{color-scheme:dark!important}html,body,#app,.combat,.field{background:transparent!important}body::before,body::after,.backdrop,.formation-grid,.combatant,.fx-layer{display:none!important}.hand-area{background:transparent!important}';
  doc.head.append(style);
  const ready=()=>Boolean(doc.querySelector('.hand .card'));
  const observer=new MutationObserver(()=>{
    if(ready()){$('#loading').hidden=true;observer.disconnect();}
  });
  observer.observe(doc.body,{subtree:true,childList:true});
  if(ready()){$('#loading').hidden=true;observer.disconnect();}
}
frame.addEventListener('load',installInterface);
if(frame.contentDocument?.readyState==='complete') installInterface();
$('#show-ui').addEventListener('change',()=>frame.hidden=!$('#show-ui').checked);
const reduce=matchMedia('(prefers-reduced-motion:reduce)');$('#motion').checked=!reduce.matches;let pointer={x:0,y:0},raf=0;
function motion(){raf=0;const on=$('#motion').checked&&!reduce.matches;document.querySelectorAll('[data-depth]').forEach(el=>{const d=Number(el.dataset.depth);el.style.transform=on?`translate(${pointer.x*d*12}px,${pointer.y*d*4}px)`:'none'});}
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;pointer={x:e.clientX/innerWidth*2-1,y:e.clientY/innerHeight*2-1};if(!raf)raf=requestAnimationFrame(motion)});$('#motion').addEventListener('change',motion);reduce.addEventListener('change',motion);
