// Inserted inside the existing battlefield editor closure by adapt-editor.py.
const artCatalog = window.COMBAT_ART_CATALOG.entries;
const sceneryFiles={far:'far',ruins:'ruins',ground:'ground',foreground:'foreground'};
function artSeed(){
  state=defaults();Object.assign(state.canvas,{width:1600,height:1000,grid:10,battlefieldPercent:58});
  state.cards.cardCount=0;state.sprites.selectedOnTop=false;
  const make=(id,label,x,y,w,h,z,depth,assetId,scenery)=>({id,label,x,y,w,h,z,depth,assetId,scenery,kind:scenery?'tile':'sprite',role:scenery?'layer':id==='hero'?'player':'enemy',side:id==='hero'?'player':'enemy',rotation:0,locked:!!scenery,hidden:false,group:null,anchor:'bottom-center',padding:0,margin:0,autoSize:false,lockAspect:!scenery,scale:1,displayState:'base'});
  state.objects=[
    make('far','Sky & distant castle',-48,-30,1696,1060,0,.15,null,'far'),
    make('ruins','Ruins & arch',-48,-30,1696,1060,1,.4,null,'ruins'),
    make('ground','Ground plane',-48,-180,1696,1240,3,.7,null,'ground'),
    make('enemy','Charred Colossus',720,70,544,480,4,.7,'charredColossus'),
    make('hero','Reaver · rear view',112,200,512,420,5,.7,'reaver-default'),
    make('hound','Blight Hound',1168,380,336,180,6,.7,'blightHound'),
    make('foreground','Near trees & lantern',-48,-30,1696,1060,7,1.1,null,'foreground')
  ];
}
seed=artSeed;
if(!restored)seed();
const originalValidate=validateImport;
validateImport=function(data){
  const next=originalValidate(data);
  next.objects.forEach((o,i)=>{
    const incoming=data.objects[i];
    if(incoming.assetId!=null){if(!artCatalog.some(e=>e.id===incoming.assetId))throw Error('Unknown sprite asset');o.assetId=incoming.assetId;}
    if(incoming.scenery!=null){if(!Object.hasOwn(sceneryFiles,incoming.scenery))throw Error('Unknown scenery layer');o.scenery=incoming.scenery;}
    if(incoming.depth!=null){if(typeof incoming.depth!=='number'||!Number.isFinite(incoming.depth)||incoming.depth<0||incoming.depth>3)throw Error('Invalid layer depth');o.depth=incoming.depth;}
  });return next;
};
// Restore again after the art extension is installed so custom fields survive.
if(remembered){try{state=validateImport(JSON.parse(remembered));}catch{seed();}}
const originalRenderBoard=renderBoard;
renderBoard=function(){
  originalRenderBoard();
  for(const o of state.objects){
    const el=board.querySelector(`[data-id="${o.id}"]`);if(!el)continue;
    const entry=artCatalog.find(e=>e.id===o.assetId);
    if(!entry&&!o.scenery)continue;
    el.classList.add('painted-object');el.classList.toggle('scenery-object',!!o.scenery);
    el.style.transform=`rotate(${o.rotation}deg)`;
    el.title=o.label;el.setAttribute('aria-label',o.label);
    const art=document.createElement('span');art.className='painted-art';
    const img=new Image();img.alt=o.label;img.draggable=false;
    if(entry){
      img.src='../'+entry.file;
      const [w,h]=entry.validation.size,b=entry.validation.visibleBounds;
      const k=Math.min(o.w/(b[2]-b[0]),o.h/(b[3]-b[1]));
      Object.assign(img.style,{width:w*k+'px',height:h*k+'px',left:o.w/2-entry.validation.anchor[0]*k+'px',bottom:-(h-entry.validation.anchor[1])*k+'px'});
    }else{img.src='../layers/'+sceneryFiles[o.scenery]+'.png';Object.assign(img.style,{left:'0',top:'0',width:'100%',height:'100%',objectFit:'cover'});}
    art.append(img);el.prepend(art);
  }
  const ui=$('#current-ui');ui.style.width=state.canvas.width+'px';ui.style.height=state.canvas.height+'px';
  $('#scene-summary').textContent=`Layered art · ${state.canvas.width} × ${state.canvas.height}`;
};
const originalInspector=renderInspector;
renderInspector=function(){
  originalInspector();const o=selected()[0];
  if(tab==='object'&&o){
    let controls=control('object.depth','Motion depth',o.depth??.7,0,3,.05);
    if(o.assetId)controls=selectControl('object.assetId','Sprite artwork',o.assetId,artCatalog.filter(e=>e.family===(o.side==='player'?'armor':'enemy')).map(e=>[e.id,e.name]))+controls;
    $('#inspector-body').insertAdjacentHTML('afterbegin',section('Artwork & depth',controls));
  }
};
const originalChangeDevice=changeDevice;
changeDevice=function(value){
  const oldW=state.canvas.width,oldH=state.canvas.height;
  state.canvas.device=value;state.canvas.width=value==='phone'?390:1600;state.canvas.height=value==='phone'?844:1000;
  const sx=state.canvas.width/oldW,sy=state.canvas.height/oldH;
  state.objects.forEach(o=>{o.x*=sx;o.y*=sy;o.w*=sx;o.h*=sy});
  requestAnimationFrame(fitCanvas);
};
const ui=document.createElement('iframe');ui.id='current-ui';ui.title='Current HUD cards and footer';ui.src='../../../../index.html?shot=combat';board.append(ui);
ui.addEventListener('load',()=>{const d=ui.contentDocument;if(!d?.head)return;const style=d.createElement('style');style.id='layered-art-ui-style';style.textContent='html{color-scheme:dark!important}html,body,#app,.combat,.field{background:transparent!important}body::before,body::after,.backdrop,.formation-grid,.combatant,.fx-layer{display:none!important}.hand-area{background:transparent!important}';d.head.append(style);});
const toggle=document.createElement('button');toggle.className='quiet';toggle.textContent='HUD';toggle.title='Show or hide the unchanged game interface';toggle.setAttribute('aria-pressed','true');toggle.addEventListener('click',()=>{ui.hidden=!ui.hidden;toggle.setAttribute('aria-pressed',String(!ui.hidden));});$('.top-spacer').after(toggle);
// Art layouts retain explicit depth order and user positions.
autoArrange=function(){status('Use drag, snapping and Object coordinates to place artwork.');};
const originalExport=exportValue;
exportValue=function(){const value=originalExport();value.notes='Layered combat art review. HUD/cards/footer remain unchanged. Asset IDs and motion depth are included.';return value;};
window.BATTLEFIELD_ART_EDITOR={export:exportValue,validate:validateImport};
board.addEventListener('pointermove',e=>{
  if(tool!=='preview'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const r=board.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*2-1,y=(e.clientY-r.top)/r.height*2-1;
  for(const o of state.objects){const art=board.querySelector(`[data-id="${o.id}"] .painted-art`);if(art)art.style.transform=`translate(${x*(o.depth??.7)*12}px,${y*(o.depth??.7)*4}px)`;}
});
board.addEventListener('pointerleave',()=>board.querySelectorAll('.painted-art').forEach(el=>el.style.transform='none'));
