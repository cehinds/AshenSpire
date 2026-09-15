function renderSceneComposition(id,mode,config,notify){
 const tokens=structuredClone(COMPONENT_COMPLETION_DEFAULTS);
 Object.assign(tokens.scene,{skyline:config.layers.skyline,floor:config.layers.floor,floorHeightPercent:config.background.floorHeightPercent,playerCount:config.playerCount??tokens.scene.playerCount,enemyCount:config.enemyCount??tokens.scene.enemyCount});
 const parts=createComponentReferenceRenderers(tokens),scene=document.createElement('div');
 scene.className='scene-demo scene-composition '+mode;parts.applyTokens(scene);
 scene.style.gridTemplateRows=['hud','scene','context','footer'].map(key=>key==='hud'?(config.layers.hud?'minmax('+config.minimumHudHeightRem+'rem,'+config.bands[key]+'fr)':'0fr'):key==='footer'?'minmax('+(globalThis.COMPONENT_COMPLETION_DEFAULTS?.footerLayout?.minimumHeightPx??56)+'px,'+config.bands[key]+'fr)':key==='context'&&id==='W4a'?'minmax('+(tokens.hand.minimumHeightPx??190)+'px,'+config.bands[key]+'fr)':'minmax(0,'+config.bands[key]+'fr)').join(' ');
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
  let beat=0;const portraits=parts.dialogueScene();if(!config.layers.portraits)portraits.querySelectorAll('[data-component="WGQ2"],[data-component="WGQ3"]').forEach(node=>node.remove());stage.append(portraits);
  const caption=()=>{body.replaceChildren();if(config.layers.context){body.append(parts.captions(beat,choice=>notify('Selected response: '+choice)));if(config.layers.audio)body.append(parts.speech())}};caption();
  if(config.layers.footer)footer.append(parts.button('WGQ6','Back','back',()=>{beat=Math.max(0,beat-1);caption()}),parts.button('WGQ7','Skip speech','back',()=>notify('Speech skipped; current caption retained')),parts.button('WGQ8','Continue','primary',()=>{if(beat<tokens.samples.beats.length-1){beat++;caption()}else notify('End of sample dialogue')}));
 }
 scene.append(hud,stage,body,footer);return scene;
}
