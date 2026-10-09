import { writeFileSync } from 'node:fs';
const out=process.env.REACTION_QA_OUTPUT;
if(!out)throw Error('Start measurements through capture-driver.mjs');
export async function inspect(p) {
  return p.evaluate(() => ({ url:location.href, touch:navigator.maxTouchPoints,
    text:document.body.innerText.slice(0,4000),
    buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent,id:e.id,cls:e.className,disabled:e.disabled,aria:e.getAttribute('aria-label')})),
    combat:window.__combat && {phase:__combat.phase,turn:__combat.turn,pending:__combat.pendingReaction,
      hp:__combat.player.hp,sp:__combat.player.energy,mp:__combat.player.mana,events:__combat.eventLog.slice(-12)},
    coop:window.__coopSnapshot && {kind:__coopSnapshot.scene?.kind,phase:__coopSnapshot.scene?.phase,scene:__coopSnapshot.scene} }));
}
export async function measures(p) {
  return p.evaluate(() => {
    const box = selector => { const e=document.querySelector(selector); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,right:r.right}; };
    const sprite=document.querySelector('.combatant.player .sprite');
    const hud=document.querySelector('.combatant.player .combatant-mini-hud');
    const art=[];
    const painted=sprite?.querySelector('.pose-stage')?.__poseStage?.currentArt;
    if(painted?.image?.naturalWidth){
      const c=document.createElement('canvas');c.width=painted.image.naturalWidth;c.height=painted.image.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(painted.image,0,0);
      const data=ctx.getImageData(0,0,c.width,c.height).data;let y=0;
      for(;y<c.height;y++){let hit=false;for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=40){hit=true;break;}if(hit)break;}
      const r=painted.canvas.getBoundingClientRect();if(y<c.height)art.push(r.top+(painted.top+y*painted.height/c.height)*r.height/painted.canvas.height);
    }
    if (sprite) for(const img of sprite.querySelectorAll('.pose-frame,.pose-previous,.painted-presentation,.defeated-frame,.facing > img')) {
      const style=getComputedStyle(img), r=img.getBoundingClientRect();
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||!r.width||!r.height||!img.naturalWidth) continue;
      let hidden=false; for(let parent=img.parentElement;parent&&parent!==sprite;parent=parent.parentElement){ const s=getComputedStyle(parent); if(parent.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0){hidden=true;break;} } if(hidden)continue;
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let y=0; for(;y<canvas.height;y++){let found=false;for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>=40){found=true;break;}if(found)break;}
      const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight);
      if(y<canvas.height)art.push(r.top+(r.height-img.naturalHeight*scale)/2+y*scale);
    }
    const menuBottom=Math.max(0,...[...document.querySelectorAll('.topbar button')].map(e=>e.getBoundingClientRect().bottom));
    const handElement=document.querySelector('.hand'), handBounds=handElement?.getBoundingClientRect();
    const dock=document.querySelector('.combat-tools')?.getBoundingClientRect();
    const clipsHand=handElement&&getComputedStyle(handElement).overflowX!=='visible';
    const cards=[...document.querySelectorAll('.hand .card')].map(e=>{
      const r=e.getBoundingClientRect();
      const visible=handBounds?{left:clipsHand?Math.max(r.left,handBounds.left):r.left,right:clipsHand?Math.min(r.right,handBounds.right):r.right,top:clipsHand?Math.max(r.top,handBounds.top):r.top,bottom:clipsHand?Math.min(r.bottom,handBounds.bottom):r.bottom}:null;
      return {id:e.dataset.instanceId,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
        visibleWidth:visible?Math.max(0,visible.right-visible.left):0,
        dockOverlap:!!(visible&&dock&&visible.right>visible.left&&visible.bottom>visible.top&&visible.right>dock.left&&visible.left<dock.right&&visible.bottom>dock.top&&visible.top<dock.bottom)};
    });
    return {viewport:{width:innerWidth,height:innerHeight,visibleHeight:visualViewport?.height},touch:navigator.maxTouchPoints,
      tools:box('.combat-tools'),log:box('.combat-log-panel'),card:box('.hand .card'),hand:box('.hand-overlay')||box('.combat.coop > .hand-area > .hand'),footer:box('.combat-action-row'),hud:box('.combatant.player .combatant-mini-hud'),
      cards,handScroll:handElement?{left:handElement.scrollLeft,width:handElement.clientWidth,contentWidth:handElement.scrollWidth,overflow:getComputedStyle(handElement).overflowX}:null,
      menuBottom,artTop:art.length?Math.min(...art):null,hudGap:art.length&&hud?Math.min(...art)-hud.getBoundingClientRect().bottom:null,
      controls:[...document.querySelectorAll('.combat-tools button')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:e.textContent,height:e.getBoundingClientRect().height})),
      reaction:document.querySelector('[role="switch"]')?.getAttribute('aria-checked')};
  });
}
export async function freeze(p) {
  return p.evaluate(()=>JSON.stringify({player:__combat.player,eventLog:__combat.eventLog,rng:__combat.rng,pending:__combat.pendingReaction}));
}
export async function startTrace(p) {
  await p.evaluate(()=>{
    window.__qaFrames=[];let previous='';
    window.__qaTraceTimer=setInterval(()=>{
      const player=document.querySelector('.combatant.player'),enemy=document.querySelector('.combatant.enemy');
      const state={hp:player?.querySelector('[data-meter-row="hp"]')?.textContent,enemy:enemy?.querySelector('[data-meter-row="hp"]')?.textContent,
        playerAction:player?.querySelector('.sprite')?.dataset.actionFamily,enemyAction:enemy?.querySelector('.sprite')?.dataset.actionFamily,
        enemies:[...document.querySelectorAll('.combatant.enemy')].map(e=>({id:e.dataset.eid,hp:e.querySelector('[data-meter-row="hp"]')?.textContent,action:e.querySelector('.sprite')?.dataset.actionFamily})),
        intents:[...document.querySelectorAll('.combatant.enemy .intent')].map(e=>e.textContent),modal:!!document.querySelector('.reaction-choice'),log:document.querySelector('.combat-log-entries')?.innerText};
      const key=JSON.stringify(state);if(key!==previous){previous=key;__qaFrames.push({time:performance.now(),...state});}
    },30);
  });
}
export async function stopTrace(p) {return p.evaluate(()=>{clearInterval(__qaTraceTimer);return {frames:__qaFrames,fx:window.__fx};});}
export function report(name,data) {writeFileSync(`${out}/${name}.json`,JSON.stringify(data,null,2)+'\n');}
