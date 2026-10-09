export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const round=v=>Math.round(v*100)/100;
export const effectDefault=()=>({enabled:true,color:'#f3cb75',color2:'#d96325',gradient:true,opacity:.8,width:2,blur:8,angle:90,triggers:{skill:false,power:false,attack:false,targeted:true}});
export function tightBox(entry,box){const b=entry.validation.visibleBounds,k=Math.min(box.w/(b[2]-b[0]),box.h/(b[3]-b[1])),w=(b[2]-b[0])*k,h=(b[3]-b[1])*k;return{x:box.x+(box.w-w)/2,y:box.y+box.h-h,w,h};}
export function components(name,phone=false){const s=phone?.65:1;return Object.fromEntries([
 ['intent',{x:0,y:-36*s,w:70*s,h:27*s,anchor:'head',text:'Attack 12'}],
 ['nameplate',{x:0,y:8*s,w:170*s,h:25*s,anchor:'feet',text:name}],
 ['info',{x:0,y:35*s,w:170*s,h:27*s,anchor:'feet',text:'HP 67 / 67 · Poise 18'}]
].map(([id,o])=>[id,{...o,hidden:false,color:'#e9d8b0',background:'#17130ed9',fontSize:13*s,opacity:1,z:1}]));}
export function createProfile(device,entries){
 const phone=device==='phone',width=phone?390:1600,height=phone?844:1000;
 const p={width,height,objects:[],ui:{},frameMode:'tight',frameWidth:phone?130:300,frameHeight:phone?240:440};
 const layer=(id,label,x,y,w,h,z,depth)=>({id,label,type:'background',libraryId:'layer:'+id,x,y,w,h,z,depth,opacity:1,locked:true,hidden:false,rotation:0});
 p.objects=[layer('far','Sky & distant castle',-.03*width,-.03*height,1.06*width,1.06*height,0,.15),layer('ruins','Ruins & arch',-.03*width,-.03*height,1.06*width,1.06*height,1,.4),layer('ground','Ground plane',-.03*width,-.18*height,1.06*width,1.24*height,3,.7),layer('foreground','Near trees & lantern',-.03*width,-.03*height,1.06*width,1.06*height,7,1.1)];
 const actor=(id,label,assetId,b,z)=>{const e=entries.find(e=>e.id===assetId);return{id,label,type:'combatant',assetId,...tightBox(e,b),z,depth:.7,opacity:1,rotation:0,locked:false,hidden:false,effect:null,components:components(label,phone)};};
 p.objects.push(actor('hero','Reaver','reaver-default',phone?{x:0,y:178,w:180,h:265}:{x:112,y:200,w:512,h:420},5),actor('enemy','Charred Colossus','charredColossus',phone?{x:165,y:192,w:198,h:205}:{x:720,y:70,w:544,h:480},4),actor('hound','Blight Hound','blightHound',phone?{x:273,y:340,w:107,h:75}:{x:1168,y:380,w:336,h:180},6));
 p.objects.find(o=>o.id==='hero').components.intent.text='0 Block';p.objects.find(o=>o.id==='hero').components.info.text='HP 70 / 70';p.objects.find(o=>o.id==='hound').components.intent.text='Attack 7';p.objects.find(o=>o.id==='hound').components.info.text='HP 23 / 23 · Poise 18';
 p.objects.push({id:'card-fade',label:'Card section fade',type:'fade',x:0,y:height*.54,w:width,h:height*.46,z:20,depth:0,rotation:0,opacity:1,locked:true,hidden:false,color:'#100e0c',fadeStop:50,texture:true});
 p.objects.push({id:'ui',label:'Entire game UI',type:'ui',x:0,y:0,w:width,h:height,z:100,depth:0,rotation:0,opacity:1,locked:false,hidden:false});return p;
}
export function createDocument(entries){return{schema:'ashenspire-combat-studio',version:2,activeDevice:'desktop',settings:{snap:true,grid:10,showGrid:false},effectDefaults:effectDefault(),profiles:{desktop:createProfile('desktop',entries),phone:createProfile('phone',entries)}};}
export function scaleObjects(objects,factor){for(const o of objects){if(o.locked)continue;const f=clamp(factor,12/Math.min(o.w,o.h),8000/Math.max(o.w,o.h)),w=o.w*f,h=o.h*f;o.x=round(o.x+(o.w-w)/2);o.y=round(o.y+o.h-h);o.w=round(w);o.h=round(h);}}
export function cornerResize(b,corner,dx,dy,aspect=true){
 const west=corner.includes('w'),north=corner.includes('n');let w=Math.max(12,b.w+(west?-dx:dx)),h=Math.max(12,b.h+(north?-dy:dy));
 if(aspect){const f=clamp(Math.abs(dx/b.w)>Math.abs(dy/b.h)?w/b.w:h/b.h,12/Math.min(b.w,b.h),8000/Math.max(b.w,b.h));w=b.w*f;h=b.h*f;}
 return{x:round(west?b.x+b.w-w:b.x),y:round(north?b.y+b.h-h:b.y),w:round(w),h:round(h)};
}
export function snapMove(box,others,grid,threshold=7){
 const result={x:box.x,y:box.y,guides:[]};
 for(const axis of ['x','y']){const size=axis==='x'?'w':'h';let best=Math.round(box[axis]/grid)*grid,dist=Math.abs(best-box[axis]),guide=null;
  if(dist>threshold){best=box[axis];dist=threshold;}
  for(const other of others)for(const target of [other[axis],other[axis]+other[size]/2,other[axis]+other[size]])for(const offset of [0,box[size]/2,box[size]]){const candidate=target-offset,d=Math.abs(candidate-box[axis]);if(d<dist){best=candidate;dist=d;guide=target;}}
  result[axis]=round(best);if(guide!=null)result.guides.push({axis,value:guide});
 }return result;
}
export function migrateLegacy(old,entries){const doc=createDocument(entries);if(!old?.canvas||!Array.isArray(old.objects))throw Error('Unrecognized layout file.');const device=old.canvas.device==='phone'?'phone':'desktop',p=doc.profiles[device];p.width=old.canvas.width;p.height=old.canvas.height;for(const src of old.objects){const target=p.objects.find(o=>o.id===src.id);if(!target)continue;Object.assign(target,...['x','y','w','h','z','depth','rotation','hidden','locked'].map(k=>src[k]===undefined?{}:{[k]:src[k]}));if(src.assetId&&entries.some(e=>e.id===src.assetId)){target.assetId=src.assetId;Object.assign(target,tightBox(entries.find(e=>e.id===src.assetId),target));}}doc.activeDevice=device;return doc;}
export function validateDocument(value,entries,library,uiIds){
 if(value?.schema==='ashen-spire-battlefield-wireframe')return validateDocument(migrateLegacy(value,entries),entries,library,uiIds);
 if(value?.schema!=='ashenspire-combat-studio'||value.version!==2)throw Error('Choose a Combat Studio v2 or Battlefield v1 JSON file.');
 const d=clone(value),fail=m=>{throw Error(m);},num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 if(!['desktop','phone'].includes(d.activeDevice))fail('Invalid device.');
 if(!d.settings||!num(d.settings.grid,1,100))fail('Invalid snap grid.');
 const effect=e=>{if(!e||!/^#[a-f\d]{6}$/i.test(e.color)||!/^#[a-f\d]{6}$/i.test(e.color2)||!num(e.opacity,0,1)||!num(e.width,0,20)||!num(e.blur,0,50)||!num(e.angle,0,360)||!e.triggers||!['skill','power','attack','targeted'].every(k=>typeof e.triggers[k]==='boolean'))fail('Invalid effect settings.');};effect(d.effectDefaults);
 for(const device of ['desktop','phone']){const p=d.profiles?.[device];if(!p||!num(p.width,200,4000)||!num(p.height,200,4000)||!Array.isArray(p.objects)||p.objects.length>200||!p.ui)fail('Invalid device layout.');if(!['tight','uniform'].includes(p.frameMode)||!num(p.frameWidth,12,2000)||!num(p.frameHeight,12,2000))fail('Invalid selection frame.');
  const ids=new Set();for(const o of p.objects){if(!o||!/^[a-zA-Z0-9_-]{1,80}$/.test(o.id)||ids.has(o.id)||!['background','combatant','fade','ui'].includes(o.type))fail('Invalid or duplicate object.');ids.add(o.id);if(!['x','y'].every(k=>num(o[k],-10000,10000))||!['w','h'].every(k=>num(o[k],12,8000))||!num(o.z,-1000,1000)||!num(o.opacity,0,1)||!num(o.depth,0,3)||!num(o.rotation,-360,360))fail('Invalid object geometry.');o.label=String(o.label||o.id).slice(0,120);
   if(o.type==='combatant'){if(!entries.some(e=>e.id===o.assetId))fail('Unknown sprite.');if(o.effect)effect(o.effect);for(const k of ['intent','info','nameplate']){const c=o.components?.[k];if(!c||!['head','feet'].includes(c.anchor)||!num(c.x,-4000,4000)||!num(c.y,-4000,4000)||!num(c.w,12,2000)||!num(c.h,12,1000)||!num(c.opacity,0,1)||!num(c.fontSize,6,100)||!num(c.z,-100,100)||!/^#[a-f\d]{6}$/i.test(c.color)||!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(c.background))fail('Invalid combatant component.');c.text=String(c.text).slice(0,200);}}
   if(o.type==='background'&&!library.some(e=>e.id===o.libraryId))fail('Unknown background component.');if(o.type==='fade'&&(!num(o.fadeStop,1,100)||!/^#[a-f\d]{6}$/i.test(o.color)))fail('Invalid fade.');
  }
  if(p.objects.filter(o=>o.type==='ui').length!==1)fail('A layout must contain exactly one UI group.');
  for(const [id,u] of Object.entries(p.ui)){if(!uiIds.includes(id)||!num(u.dx,-4000,4000)||!num(u.dy,-4000,4000)||!num(u.scale,.1,5)||!num(u.opacity,0,1)||!num(u.z,-1000,1000)||!num(u.fontSize,0,100)||(u.color!==null&&!/^#[a-f\d]{6}$/i.test(u.color)))fail('Invalid UI component.');if(u.text!=null)u.text=String(u.text).slice(0,200);}
 }return d;
}
