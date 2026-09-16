// Runs the documentation renderers in actual browser layout without invoking game code.
async function runAtlasAudit(){
 const output=document.getElementById('atlasAuditOutput'),button=document.getElementById('atlasAudit');
 const saved=current,failures=[],checks=[];button.disabled=true;
 const root=document.createElement('div');root.className='atlas-audit-root';root.setAttribute('aria-hidden','true');
 root.style.cssText='position:absolute;left:-10000px;top:0;width:1280px;contain:layout style;pointer-events:none';document.body.append(root);
 try{
  for(const definition of DATA){
   current=definition;
   for(const view of definition.views){
    const observerStart=statusObservers.length,timerStart=timers.length;
    try{
     root.style.width=({wide:'72rem',compact:'48rem',iphoneSE:'375px',galaxyS24:'360px'})[view.mode];
     const rendered=tabbedPreview(definition.id,view);root.replaceChildren(rendered);initializeHudPlaygrounds(root);
     const panels=rendered.querySelectorAll('.preview-tabpanel');
     if(panels.length!==3)throw Error('Expected three preview tabs');
     for(const panel of panels){panel.hidden=false;if(!panel.textContent.trim()&&!panel.querySelector('svg,img,meter,[role=img]'))throw Error('Empty preview');if(!Number.isFinite(panel.getBoundingClientRect().height))throw Error('Invalid layout height')}
     for(const face of rendered.querySelectorAll('.cardhost:not(.combatant-host)>.cardbox')){const bounds=face.getBoundingClientRect();const ratio=CARD_REFERENCE.config.geometry.ratioHeight/CARD_REFERENCE.config.geometry.ratioWidth;if(bounds.width>0&&Math.abs(bounds.height/bounds.width-ratio)>.04)throw Error('Card aspect ratio changed')}
     checks.push({id:definition.id,mode:view.mode,panels:panels.length});
    }catch(error){failures.push({id:definition.id,mode:view.mode,error:error.message})}
    finally{root.replaceChildren();statusObservers.splice(observerStart).forEach(observer=>observer.disconnect());timers.splice(timerStart).forEach(clearTimeout)}
   }
   output.textContent=JSON.stringify({completed:checks.length,failures},null,2);
   await new Promise(requestAnimationFrame);
  }
 }finally{root.remove();current=saved;render();nav();button.disabled=false}
 output.textContent=JSON.stringify({entries:DATA.length,renderedViews:checks.length,previewPanels:checks.reduce((n,c)=>n+c.panels,0),failures,scope:'Real-browser construction and finite-layout checks for each reference. Does not validate game mechanics or replace visual inspection.'},null,2);
}
