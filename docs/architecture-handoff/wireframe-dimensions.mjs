import { positioning } from './wireframe-positioning.mjs';
// Proposed documentation dimensions; not runtime tuning or observed geometry.
const units=n=>Number(n.toFixed(2));
const content={
 W0:['body.content'],W1:['body.activePane'],
 W1a:['body.fields','body.feedback'],W1b:['body.npcIdentity','body.serviceChoices','body.feedback'],
 W1c:['body.stageControls','body.derivedSummary'],W1d:['body.offers','body.offerDetail'],
 W1e:['body.itemCollection','body.equipmentDetail'],W1f:['body.entryList','body.entryDetail'],
 W1g:['body.profileIdentity','body.categoryRecords'],W1h:['body.cardCollection','body.cardDetail'],
 W1i:['body.candidates','body.upgradePreview'],W1j:['body.items','body.mounts','body.extractionPreview'],
 W1k:['body.items','body.mounts','body.cards','body.installPreview'],W1l:['body.slotList'],W1m:['body.slotList'],
 W1n:['body.items','body.comparison'],W1o:['body.art','body.itemFacts'],W1p:['body.portrait','body.combatantFacts'],
 W1q:['body.art','body.potionFacts'],W1r:['body.saveIdentity','body.saveStatus'],
 W1s:['body.restChoices','body.consequences'],W1t:['body.rewardChoices','body.claimStatus'],
 W1u:['body.narrative','body.responses'],W1v:['body.offers','body.offerDetail'],
 W2:['body.target','body.consequence'],W2a:['body.target','body.consequence'],W2b:['body.target','body.consequence'],
 W2c:['body.target','body.consequence'],W2d:['body.target','body.consequence'],W2e:['body.target','body.consequence'],
 W3:['body.menu','body.preview'],W3a:['body.menu'],W3b:['body.menu','body.preview'],
 W4:['scene.content','context.content'],W4a:['scene.battlefield','context.hand'],
 W4b:['scene.map','context.nodeDetails'],W4c:['scene.playerPortrait','scene.npcPortrait','context.dialogue']
};
export function componentDimensions(s,mode){
 const game=s.id.startsWith('W4'), decision=s.id.startsWith('W2'), menu=s.id.startsWith('W3');
 const h=game?100:decision?50:90, w=game?100:decision?(mode==='wide'?50:90):95;
 const head=10,foot=game?(s.id==='W4b'?10:15):10,body=h-head-foot;
 const inset=2.5,inner=w-2*inset,iw=units(inner),bh=body-4;
 const nav=s.id==='W1'||/^W1[a-h]$/.test(s.id);
 const rail=nav&&mode==='wide'?units(inner*.24):0;
 const gap=rail?2.5:0, pane=units(inner-rail-gap);
 const rows=[];
 const row=(slot,width,height,note='')=>rows.push(`| \`${s.id}.${slot}\` | ${width}vw | ${typeof height==='number'?height+'vh':height} | ${positioning(s.id,slot,mode,note).join(" | ")} | ${note} |`);
 row('frame',w,h,'Centered host; W4 fills available game viewport');
 row('header',w,head,'Reserved top band');
 row('header.title',units(inner-13),6,menu?'Screen-centered override':'Top-left, shared inset');
 row('header.exit',8,6,'Top-right; min-target rule may enlarge');
 row('body',w,body,'Includes internal padding; scroll only this region if needed');
 if(nav)row('body.navigation',rail||iw,mode==='wide'?bh:6,mode==='wide'?'Left category rail':'Selector above active pane; consumes body budget');
 const usable=bh-(nav&&mode!=='wide'?8:0);
 if(game){
   const scene=s.id==='W4b'?60:40,ctx=body-scene;
   row('scene',100,scene,'Includes region internal spacing');row('context',100,ctx,'Includes region internal spacing');
   if(s.id==='W4b')row('scene.map',95,60,'Owner target ≈60vh ×95vw');
   else if(s.id==='W4c'){
    row('scene.playerPortrait',mode==='wide'?20:30,units(scene-4),'Left; bounded artwork, intrinsic ratio');
    row('scene.npcPortrait',mode==='wide'?20:30,units(scene-4),'Right; bounded artwork, intrinsic ratio');
    row('context.dialogue',95,units(ctx-4),'Short authored caption/response body; shared remaining budget');
   }else{row('scene.battlefield',95,units(scene-4),'Art and targets fit inside scene');row('context.hand',95,units(ctx-4),'Playing-card host allocation, not standalone card size');}
 }else{
   row('body.activePane',pane,usable,'All child slots below share this allocation');
   const slots=content[s.id]||['body.content'];
   if(s.id==='W1w'){
 const left=units(pane*(mode==='portrait'?.32:.34)), right=units(pane-left-2);
 row('body.cardPreview',left,usable,'Left: contained sprite/name/HP; max14rem preview width; no overlays');
 row('body.details',right,usable,'Right scroll owner; uniform label/value columns');
 row('body.details.summary',right,6,'Top: HP / Intent / Defense in one horizontal row');
 for(const part of ['currentState','previousActions','knownAbilities','knownTraits','lore']) row('body.details.'+part,right,'auto; content', 'Ordered normal-flow section; content height may exceed scroll viewport');
 }


   (s.id==='W1w'?[]:slots).forEach((slot,i)=>{
     const side=mode==='wide'&&slots.length===2&&!decision;
     row(slot,side?units((pane-2)/2):pane,side?usable:units((usable-(slots.length-1)*2)/slots.length),
      (side?'Side-by-side':'Stacked')+' nominal subdivision; optional slots collapse and siblings reclaim space');
   });
 }
 row('footer',w,foot,'Reserved bottom band; no extra height outside total');
 if(s.id==='W4a'){
   const bw=mode==='wide'?8:mode==='compact'?10:13;
   row('footer.actionsRemaining',bw,8,'Circle; large, group left');row('footer.drawPile',units(bw*.7),6,'Small');
   row('footer.endTurn',units(bw*1.5),8,'Large, group center');row('footer.discardExhaust',units(bw*.7),6,'Small');
   row('footer.potions',bw,8,'Circle; large, group right');
   row('footer.group',units(bw*4.9+2),11,'Four 0.5vw nominal gaps; packed centered, never stretched');
 }else{
   row('footer.closeBack',units((inner-2)/2),6,'Bottom-left when two actions');
   row('footer.primary',units((inner-2)/2),6,'Bottom-right when two actions');
   row('footer.singleAction',iw,6,'Alternative: exactly one action fills usable width');
   if(s.id==='W4c')row('footer.skipSpeech',units(inner/3-1),6,'Three-action variant: each button takes one third minus shared gaps; replaces two-action widths');
 }
 return '**Component IDs and nominal viewport allocations**\n\n| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |\n|---|---:|---:|---|---|---|---|---|---|\n'+rows.join('\n')+'\n\nNested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.\n';
}
