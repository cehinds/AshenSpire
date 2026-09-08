import {SOURCE_JOINTS,REVIEW_SEQUENCE,CHAINS,sourceFrame,sourceAsset} from './source-joints.mjs';
import {sceneFor} from './renderer.mjs';
import {SUPPORTED_TRANSITIONS,TRANSITION_LIMITATIONS} from './transition-joints.mjs';
const $=id=>document.getElementById(id),images={},classes=['reaver','starseer'];
let request=0,playing=false;
// The same source-space camera is used for every pose and for every overlay.
// It includes the entire 640px width, including the cleave's trailing foot.
const camera={scale:1.12,x:18,y:-140};
function skeleton(ctx,frame,colorOverride){
 const {joints,estimated}=frame;
 for(const chain of CHAINS)for(let i=1;i<chain.length;i++){
  const a=chain[i-1],b=chain[i];ctx.strokeStyle=colorOverride||(a.startsWith('far')?'#edaf76':'#75e4df');ctx.lineWidth=1.8;ctx.setLineDash(estimated.includes(a)||estimated.includes(b)?[4,3]:[]);ctx.beginPath();ctx.moveTo(...joints[a]);ctx.lineTo(...joints[b]);ctx.stroke();
 }
 ctx.setLineDash([]);
 for(const [name,p]of Object.entries(joints)){
  if(name==='weaponTip')continue;ctx.strokeStyle=colorOverride||(name.startsWith('far')?'#edaf76':'#75e4df');ctx.fillStyle=estimated.includes(name)?'#211e19':ctx.strokeStyle;ctx.beginPath();ctx.arc(...p,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();
  if($('jointLabels').checked&&!colorOverride){ctx.font='9px Arial';ctx.fillStyle='#fff';ctx.fillText(name,p[0]+6,p[1]-5);}
 }
}
function rigJoints(cls,t,source){
 const s=sceneFor(cls,cls==='reaver'?'greatsword':'focus',cls==='reaver'?'attack':'cast',t);
 const guard=SOURCE_JOINTS[cls].guard.joints;
 const start=sceneFor(cls,cls==='reaver'?'greatsword':'focus',cls==='reaver'?'attack':'cast',0);
 const scale=(guard.nearAnkle[1]-guard.pelvis[1])/(start.nearLeg.wrist[1]-start.pose.root[1]);
 const convert=p=>[source.joints.pelvis[0]+(p[0]-s.pose.root[0])*scale,source.joints.pelvis[1]+(p[1]-s.pose.root[1])*scale];
 const joints={pelvis:source.joints.pelvis};
 for(const [prefix,arm,leg]of [['near',s.right,s.nearLeg],['far',s.left,s.farLeg]]){
  for(const [joint,key]of [['Shoulder','shoulder'],['Elbow','elbow'],['Wrist','wrist']])joints[prefix+joint]=convert(arm[key]);
  for(const [joint,key]of [['Hip','shoulder'],['Knee','elbow'],['Ankle','wrist']])joints[prefix+joint]=convert(leg[key]);
 }
 return {joints,estimated:[]};
}
export function drawSource(canvas,cls,t,{overlay=true,compare=false}={}){
 const f=sourceFrame(cls,t),ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(canvas.width/800,canvas.height/600);ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);ctx.drawImage(images[cls+'/'+f.pose],0,0);
 if(overlay)skeleton(ctx,f);
 let errors=[];
 if(compare){const old=rigJoints(cls,f.t,f);skeleton(ctx,old,'#da8df0');ctx.strokeStyle='#ef6666';ctx.lineWidth=1;for(const name of ['nearShoulder','nearElbow','nearWrist','farShoulder','farElbow','farWrist']){const a=f.joints[name],b=old.joints[name];errors.push({name,px:Math.hypot(a[0]-b[0],a[1]-b[1])});ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}}
 ctx.restore();return {frame:f,errors};
}
function draw(){const t=Number($('sourceTime').value)/100;let f;for(const cls of classes){const result=drawSource($('source'+(cls==='reaver'?'Reaver':'Starseer')),cls,t,{overlay:$('sourceOverlay').checked,compare:$('rigOverlay').checked});f=result.frame;$(cls+'Audit').textContent=result.errors.length?`Earlier rig arm mismatch: ${Math.max(...result.errors.map(e=>e.px)).toFixed(1)} source px maximum · needs revision`:f.kind==='intermediate'?(SUPPORTED_TRANSITIONS[cls].includes(f.pose)?'Guides this class preview · obscured joints remain estimates':'Reference only · '+TRANSITION_LIMITATIONS[cls]):'Original source landmarks · obscured joints remain estimates';} $('sourcePhase').value=(t*100).toFixed(1)+'%';$('readout').textContent=f.label+' · '+f.pose+' · '+(f.kind==='intermediate'?'New painted transition study · '+f.purpose:'Original approved keyframe');for(const b of $('sourceKeys').children)b.setAttribute('aria-pressed',String(Number(b.dataset.t)===f.t));}
function stop(){cancelAnimationFrame(request);playing=false;$('sourcePlay').textContent='Play key poses';}
for(const key of REVIEW_SEQUENCE){const b=document.createElement('button');b.textContent=`${Number((key.t*100).toFixed(1))}% · ${key.label}`;b.dataset.t=key.t;b.onclick=()=>{stop();$('sourceTime').value=key.t*100;draw()};$('sourceKeys').append(b);}
$('sourcePlay').onclick=()=>{if(playing){stop();return}playing=true;$('sourcePlay').textContent='Pause';const start=performance.now(),duration=2200/Number($('speed').value);function tick(now){$('sourceTime').value=Math.min(100,(now-start)/duration*100);draw();if(now-start<duration)request=requestAnimationFrame(tick);else stop()}request=requestAnimationFrame(tick)};
for(const id of ['sourceTime','sourceOverlay','rigOverlay','jointLabels','speed'])$(id).oninput=()=>{stop();draw()};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
try{
 await Promise.all(classes.flatMap(cls=>Object.keys(SOURCE_JOINTS[cls]).map(async pose=>{const image=new Image();image.src=sourceAsset(cls,pose);await image.decode();images[cls+'/'+pose]=image;})));
 for(const cls of classes)for(const key of REVIEW_SEQUENCE.slice(0,-1)){const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=800;canvas.height=600;canvas.setAttribute('aria-label',cls+' '+key.pose+' joint map');caption.textContent=`${Number((key.t*100).toFixed(1))}% · ${key.pose} · ${key.pose.startsWith('between')?'New transition':'Original'}`;drawSource(canvas,cls,key.t);figure.append(canvas,caption);$(cls+'Gallery').append(figure);}
 draw();window.sourceReview={ready:true,drawSource};
}catch(e){$('sourceError').textContent='Reference images failed to load: '+e.message;console.error(e)}
