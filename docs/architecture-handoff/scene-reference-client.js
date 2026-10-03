function renderSceneComposition(id,mode,config,notify){
 const tokens=structuredClone(COMPONENT_COMPLETION_DEFAULTS);
 Object.assign(tokens.scene,{skyline:config.layers.skyline??config.layers.skybox,floor:config.layers.floor,floorHeightPercent:config.background.floorHeightPercent,playerCount:config.playerCount??tokens.scene.playerCount,enemyCount:config.enemyCount??tokens.scene.enemyCount});
 const parts=createComponentReferenceRenderers(tokens),scene=document.createElement('div');
 scene.className='scene-demo scene-composition '+mode;parts.applyTokens(scene);
 scene.style.gridTemplateRows=['hud','scene','context','footer'].map(key=>key==='hud'?((config.layers.hud||config.layerOrder)?'minmax('+config.minimumHudHeightRem+'rem,'+config.bands[key]+'fr)':'0fr'):key==='footer'?'minmax('+(globalThis.COMPONENT_COMPLETION_DEFAULTS?.footerLayout?.minimumHeightPx??56)+'px,'+config.bands[key]+'fr)':key==='context'&&id==='W4a'?'minmax('+(tokens.hand.minimumHeightPx??190)+'px,'+config.bands[key]+'fr)':'minmax(0,'+config.bands[key]+'fr)').join(' ');
 const context=id==='W4a'?'combat':id==='W4b'?'map':'town';
 const hudConfig={...structuredClone(HUD_REFERENCE_CONFIG),context,...(config.hud||{})};
 const hud=document.createElement('div');hud.className='scene-hud';hud.dataset.component='WGH4';
 if(config.layers.hud)hud.innerHTML=renderConfiguredHUD(hudConfig);
 const stage=document.createElement('div'),body=document.createElement('div'),footer=document.createElement('footer');stage.className='scene-stage';body.className='scene-context';footer.className='scene-controls';
 if(id==='W4a'){
  const battlefield=parts.battlefield(mode,config.layers.targets);if(!config.layers.actors)battlefield.querySelector('.cc-formation')?.remove();stage.append(battlefield);
  if(config.layers.context)body.append(parts.hand(mode));if(config.layers.footer)footer.append(parts.footer());
 }else if(id==='W4b'){
  let selected=tokens.samples.mapNodes.find(node=>node.id===tokens.map.selectedNode)||tokens.samples.mapNodes[0];
  const details=()=>{body.replaceChildren();if(config.layers.context)body.append(parts.nodeDetails(selected));const enter=footer.querySelector('[data-component="WGM7"]');if(enter)enter.disabled=selected.state==='blocked'};
  const graph=parts.mapGraph(false,node=>{selected=node;details()});if(!config.layers.paths)graph.querySelector('svg')?.remove();if(!config.layers.nodes)graph.querySelectorAll('.cc-node').forEach(node=>node.remove());
  stage.append(graph,parts.region());if(config.layers.footer){const recenter=parts.button('WGM6','Recenter','back',()=>{graph.scrollTo({left:0,top:0,behavior:'auto'});notify('Map recentered')});const enter=parts.button('WGM7','Enter','primary',()=>notify('Travel requested: '+selected.label+' · reference only'));footer.append(recenter,enter)}details();
 }else{
  // W4c is one layer stack over the whole frame (config.layerOrder). The scene
  // plate is the bottom of the stack; the bands are panels painted over it. The
  // opaque context band's top edge is the reveal line: it hides each zoomed
  // figure below its visible fraction, so nothing is cropped or masked.
  scene.classList.add('layered-scene');stage.dataset.component='WGQ1';
  const order=Object.fromEntries((config.layerOrder||[]).map(layer=>[layer.id,layer.z]));
  const z=layer=>(order[layer]??0)*10;
  const on=layer=>config.layers[layer]!==false;
  const plate=document.createElement('div');plate.className='layer-plate';plate.dataset.component='WGS1';
  const sky=parts.sky();sky.classList.add('layer-skybox');sky.style.zIndex=String(z('skybox'));
  const ground=document.createElement('div');ground.className='layer-floor';ground.dataset.component='WGS7';ground.style.zIndex=String(z('floor'));
  ground.style.setProperty('--floor-color',config.background.floorColor);
  if(on('skybox'))plate.append(sky);if(on('floor'))plate.append(ground);
  const portraits=config.portraits,speaker=portraits.speaker;
  const figures=[['playerPortrait','player','WGQ2','left'],['npcPortrait','enemy','WGQ3','right']].filter(([layer])=>on(layer)).map(([layer,role,component,side])=>{
   const host=document.createElement('div');host.className='layer-figure';host.dataset.component=component;host.dataset.side=side;host.dataset.layer=layer;
   const speaking=layer===speaker;host.classList.add(speaking?'speaking':'listening');
   host.style.zIndex=String(z(layer)+(speaking&&portraits.speakerAbove?1:0));
   const listener=portraits.listener;if(listener)for(const [key,value] of Object.entries({'--listener-opacity':listener.minOpacity,'--listener-brightness':listener.brightness,'--listener-saturation':listener.saturation}))host.style.setProperty(key,String(value));
   host.append(parts.sprite(role));return host;
  });
  hud.style.zIndex=String(z('hud'));body.style.zIndex=String(z('context'));footer.style.zIndex=String(z('footer'));
  hud.classList.toggle('layer-off',!on('hud'));body.classList.toggle('layer-off',!on('context'));footer.classList.toggle('layer-off',!on('footer'));
  let beat=0;
  const context=config.context;if(context)body.style.setProperty('--response-columns',String(context.responseColumns[mode]??context.responseColumns.compact));
  const caption=()=>{body.replaceChildren();if(on('context')){body.append(parts.captions(beat,choice=>notify('Selected response: '+choice)));if(config.layers.audio)body.append(parts.speech())}};caption();
  if(on('footer'))footer.append(parts.button('WGQ6','Back','back',()=>{beat=Math.max(0,beat-1);caption()}),parts.button('WGQ7','Skip speech','back',()=>notify('Speech skipped; current caption retained')),parts.button('WGQ8','Continue','primary',()=>{if(beat<tokens.samples.beats.length-1){beat++;caption()}else notify('End of sample dialogue')}));
  // Geometry comes from the measured bands and config; the page adds no numbers.
  const place=()=>{
   const W=scene.clientWidth,H=scene.clientHeight;if(!W||!H)return;
   const hudHeight=hud.offsetHeight,window=stage.offsetHeight,reveal=hudHeight+window;
   const floorLine=hudHeight+window*(1-config.background.floorHeightPercent/100);
   sky.style.height=floorLine+'px';ground.style.top=floorLine+'px';
   const slot=portraits.slot,compact=mode!=='wide';
   // Each figure keeps to its lane: half the frame less the insets and the minimum gap.
   const inset=W*slot.insetVw/100,gap=Math.max(W*portraits.minGapVw/100,portraits.minGapPx),lane=(W-2*inset-gap)/2;
   const width=Math.min(W*(compact?slot.compactWidthVw:slot.widthVw)/100,lane),top=hudHeight+H*slot.topOffsetVh/100;
   const fraction=portraits.visibleFraction,share=fraction.numerator/fraction.denominator,zoomed=(reveal-top)/share;
   for(const host of figures){
    const box=host.querySelector('svg')?.viewBox?.baseVal,aspect=box&&box.height?box.width/box.height:1;
    // shrinkToLane: a figure wider than its lane scales down as a whole;
    // anchor revealLine: it sinks so its top share still stands on the reveal line.
    const height=portraits.fit==='shrinkToLane'?Math.min(zoomed,lane/aspect):zoomed,figureTop=portraits.anchor==='revealLine'?reveal-height*share:top,half=height*aspect/2;
    const left=host.dataset.side==='left',laneStart=left?inset:W-inset-lane,slotCenter=left?inset+width/2:W-inset-width/2;
    const center=Math.min(Math.max(slotCenter,laneStart+half),laneStart+lane-half);
    Object.assign(host.style,{top:figureTop+'px',height:height+'px',width:2*half+'px',left:center-half+'px'});
   }
   scene.style.setProperty('--reveal-line',reveal+'px');
  };
  const observer=new ResizeObserver(place);observer.observe(scene);
  // Entrance from config.entrance: scene, HUD and footer at once; the figures,
  // then the context band. Controls work when the last step ends.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,steps=config.entrance||[];
  const liveAt=Math.max(0,...steps.map(step=>step.atMs+step.fadeMs));
  requestAnimationFrame(()=>{place();if(reduced)return;
   const enter=(el,layer)=>{const step=steps.find(item=>item.layers.includes(layer));if(!step||!step.fadeMs)return;const rise=(step.riseVh||0)/100*scene.clientHeight;el.animate([{opacity:0,transform:'translateY('+rise+'px)'},{opacity:1,transform:'none'}],{duration:step.fadeMs,delay:step.atMs,easing:'ease',fill:'backwards'})};
   figures.forEach(host=>enter(host,host.dataset.layer));enter(body,'context');
   if(liveAt){footer.inert=true;body.inert=true;setTimeout(()=>{footer.inert=false;body.inert=false},liveAt)}
  });
  scene.append(plate,...figures);
 }
 scene.append(hud,stage,body,footer);return scene;
}
