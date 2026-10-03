// Documentation-only placement contract. All anchors are parent-relative.
import { readFileSync } from 'node:fs';
let dialogueSlotCache=null;
const dialogueSlot=()=>dialogueSlotCache??=JSON.parse(readFileSync(new URL('./gameplay-config.json',import.meta.url),'utf8')).W4c.portraits.slot;
export function positioning(id,slot,mode,note='') {
 const card=id.startsWith('WC'), menu=id.startsWith('W3'), game=id.startsWith('W4');
 const inset=card?'0.8vw':'2.5vw';
 let parent=slot.includes('.')?slot.slice(0,slot.lastIndexOf('.')):'frame';
 let anchor='top-left', align='start / start', position='normal grid flow', offset='0; shared gap between siblings';
 if(slot==='frame')return [card?'owning hand/grid/picker':'visible game viewport',card?'host-assigned cell':'center', 'center / center',card?'host grid item':'root grid item',card?'host gap token':'equal outer margins; safe area applied once'];
 if(slot==='header'){anchor='top / full width';align='stretch / center';offset='0';}
 if(slot==='body'||slot==='scene'||slot==='context'){anchor='below preceding band';align='stretch / stretch';offset='0; band padding included in height';}
 if(slot==='footer'){anchor='bottom / full width';align='stretch / center';offset='0; reserved grid row';}
 if(slot.endsWith('.title')){anchor=menu?'screen top-center':'top-left';align=menu?'center / center':'start / center';offset=menu?'center on viewport, not leftover header space':inset+' from left; vertically centered in header';}
 if(slot.endsWith('.exit')||slot.endsWith('.state')){anchor='top-right';align='end / center';offset=inset+' from right; vertically centered in header';}
 if(slot==='body.activePane'){parent='body';anchor='after category navigation, if present';align='stretch / start';offset=mode==='wide'?'2.5vw after rail; 2vh top inset':'2vh after selector / top inset';}
 if(slot==='body.navigation'){anchor=mode==='wide'?'top-left':'top / full usable width';align='start / start';offset=inset+' from left; 2vh from body top';}
 if(slot.startsWith('body.')&&!['body.activePane','body.navigation'].includes(slot)){
   parent=card?'body':'body.activePane';
   anchor=note.startsWith('Side-by-side')?'next column, left to right':'next row, top to bottom';
   align=slot.endsWith('.art')||slot.endsWith('.portrait')?'center / center':'start / start';
   offset=card?'0.8vw horizontal inset; rows share body budget':note.startsWith('Side-by-side')?'2vw column gap':'2vh row gap';
 }
 if(menu && (slot==='body.menu'||slot==='body.preview')){
 parent='body.activePane';
 anchor=id==='W3a'?'center':mode==='wide'?(slot==='body.menu'?'left-center':'right-center'):(slot==='body.menu'?'top-center':'below menu');
 align='center / center';offset=id==='W3a'?'equal free space on both sides':mode==='wide'?'2vw between menu and preview':'2vh between menu and preview';
}
if(slot==='art'){
anchor='below header';align='center / center';offset='0; preserve intrinsic artwork ratio';}
 if(slot==='tags'){anchor='below art';align='start / center';offset='0.8vw horizontal inset';}
 if(slot.startsWith('scene.')||slot.startsWith('context.')){anchor='center';align='center / center';offset='2.5vw horizontal / 2vh vertical inset, except map has no vertical inset';}
 if(slot==='scene.playerPortrait'||slot==='scene.npcPortrait'){anchor=slot.includes('player')?'left-center':'right-center';offset='2.5vw from respective scene edge';}
 // W4c is a layer stack: its scene layers are absolute sheets over the whole
 // frame, placed by config (gameplay-config.json W4c), not grid children.
 if(id==='W4c'){
   const slotConfig=dialogueSlot();
   if(slot==='scene.skybox'){parent='frame';anchor='frame top';align='stretch / start';position='layer z2 · absolute sheet, bottom of the stack';offset='0; runs behind the HUD band';}
   if(slot==='scene.floor'){parent='frame';anchor='floor line';align='stretch / start';position='layer z3 · absolute sheet';offset='0; runs behind the context and footer bands';}
   if(slot==='scene.playerPortrait'||slot==='scene.npcPortrait'){parent='frame';anchor=slot.includes('player')?'left slot top':'right slot top';align='center / start';position='layer z4 · absolute; overruns the scene into lower layers';offset=`${slotConfig.insetVw}vw from respective frame edge; top ${slotConfig.topOffsetVh}vh below the scene top`;}
   if(slot==='context.revealLine'){anchor='context top edge';align='stretch / start';position='occluding edge of layer z5';offset='0';}
   if(slot==='context.dialogue'){position='inside layer z5 (opaque band)';}
   if(slot==='context.questTitle'){parent='context.dialogue';anchor='top-left';align='start / start';position='column row 1';offset=inset+' side inset; half gap to the band top';}
   if(slot==='context.narrative'){parent='context.dialogue';anchor='below quest title';align='start / start';position='column row 2';offset='half gap';}
   if(slot==='context.responses'){parent='context.dialogue';anchor='below narrative';align='stretch / start';position='response grid; columns from config.context.responseColumns';offset='half gap between rows and columns';}
 }
 if(slot.startsWith('footer.')){
   anchor=slot==='footer.closeBack'?'bottom-left':slot==='footer.primary'?'bottom-right':slot==='footer.skipSpeech'?'bottom-center':'bottom / full usable width';
   align='center / center';position='single-row footer grid item';offset=inset+' side inset; vertically centered in footer';
   if(slot==='footer.singleAction'||card){anchor='bottom / full usable width';}
   if(id==='W4a'){
     parent=slot==='footer.group'?'footer':'footer.group';
     anchor=slot==='footer.group'?'bottom-center':({'footer.actionsRemaining':'column 1','footer.drawPile':'column 2','footer.endTurn':'column 3 (center)','footer.discardExhaust':'column 4','footer.potions':'column 5'}[slot]);
     position='single packed row; never distribute across viewport';
     offset=slot==='footer.group'?'centered horizontally; 2vh above footer bottom':['footer.drawPile','footer.discardExhaust'].includes(slot)?'0.5vw gap; bottom aligned in group':'0.5vw gap; lifted 1vh above group bottom';
   }
 }
 if(id==='W1w' && ['body.cardPreview','body.details'].includes(slot)){
 parent='body.activePane';anchor=slot==='body.cardPreview'?'left / top':'right / top';align='start / start';position='two-column grid in every mode';offset='2vw column gap; body inset inherited';
}
if(slot==='art.tags'){parent='art';anchor='bottom-left';align='start / center';position='reserved bottom row inside art band';offset='0.8vw horizontal inset; no extra band height';}
if(slot.startsWith('selection.')){
 parent='frame';anchor=slot==='selection.info'?'above top-center':'perimeter';align='center / center';position='anchored overlay following visual card transform';offset=slot==='selection.info'?'0.75vh gap above lifted card; reserve host headroom':'0; outline outside edge, no layout reflow';
}
return [id+'.'+parent,anchor,align,position,offset];
}
