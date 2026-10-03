import { presentationConfig } from '../../model/advancedConfig.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { combatSpriteGeometry } from './combatSpriteGeometry.js';
import { combatSpriteRatio, fitCombatSprites } from '../models/CombatSpriteScaleModel.js';
import { playerSprite, enemySprite } from '../assets.js';
import { statureFor } from './stature.js';
import { formationPositioningHtml, wireFormationPositioning, wirePositionWindow } from './formationPositioning.js';
import { formationTileGeometry } from '../models/FormationGridModel.js';
import { formationTileOutline } from './formationGrid.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { esc } from './tooltip.js';
import { suppliedFormationPositioning } from '../../content/formationPositioningPresets.js';

// A presentation sandbox: no engine dispatch, roster writes, rewards or turn changes.
export function openFormationWorkbench({ registries, readSettings, onSettingsChange, combatRoot }) {
  const draft = presentationConfig(readSettings());
  const classes = registries.classes.all(), enemies = registries.enemies.all();
  const dialog = document.createElement('dialog');
  dialog.className = 'position-workbench';
  dialog.setAttribute('aria-label', 'Positioning and sizing');
  const zoom = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  dialog.style.zoom = String(1/zoom); dialog.style.setProperty('--ui-zoom','1');
  dialog.innerHTML = `<header class="position-workbench-heading"><button type="button" data-workbench-drag>Drag positioning &amp; sizing</button><button type="button" data-workbench-max>Maximize</button><button type="button" data-workbench-close>Close</button></header>
    <div class="position-workbench-layout"><div class="position-workbench-preview">
      <div class="position-test-controls">
        <label>Grid per team · columns × rows<select data-test-layout><option value="1x1">1×1</option><option value="2x2">2×2</option><option value="2x3" selected>2×3</option></select></label>
        <label>Player spawns<select data-test-player-count></select></label><label>Enemy spawns<select data-test-enemy-count></select></label>
        <label>Classes<select data-test-classes><option value="mixed">Mixed classes</option>${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
        <label>Enemies<select data-test-enemies><option value="mixed">Mixed enemies</option>${enemies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
        <button type="button" data-test-cycle>Next reference set</button><button type="button" data-test-supplied>Load supplied positioning</button>
      </div><p class="formation-help">Test spawns fill from the bottom outside corners. Counts are per team. These reference actors do not affect the current fight.</p>
      <div class="position-test-stage" aria-label="Spawn positioning preview"><div data-test-tiles></div><div data-test-actors></div></div>
      <output data-test-summary></output><div class="position-test-controls"><label>Formation width · %<input data-test-width type="number" min="40" max="100" value="${draft.formationWidth}"></label><label>Formation depth · %<input data-test-depth type="number" min="30" max="100" value="${draft.formationDepth}"></label><button type="button" data-test-apply>Apply positioning &amp; sizing to game</button></div><p data-test-status role="status">Preview only until applied. JSON export includes this test roster.</p>
      </div><aside data-workbench-editor>${formationPositioningHtml()}</aside></div>`;
  document.body.append(dialog); dialog.showModal();
  const $ = selector => dialog.querySelector(selector), stage = $('[aria-label="Spawn positioning preview"]');
  const savedLayout = `${draft.formationColumns}x${draft.formationRows}`;
  if (['1x1','2x2','2x3'].includes(savedLayout)) $('[data-test-layout]').value = savedLayout;
  let activeLayout = $('[data-test-layout]').value;
  const layoutDrafts = new Map();
  const baseDraft = { ...draft, formationGroups: '[]' };
  function selectLayout(reload = false) {
    if (!reload) layoutDrafts.set(activeLayout, { ...draft });
    activeLayout = $('[data-test-layout]').value;
    const supplied = suppliedFormationPositioning(activeLayout);
    Object.assign(draft, (!reload && layoutDrafts.get(activeLayout)) || supplied || baseDraft);
    $('[data-test-width]').value = draft.formationWidth;
    $('[data-test-depth]').value = draft.formationDepth;
    $('[data-test-supplied]').disabled = !supplied;
    $('[data-test-status]').textContent = `${activeLayout} positioning loaded. Apply to save to the game.`;
    syncCounts(); roster();
  }
  $('[data-test-supplied]').disabled = !suppliedFormationPositioning(activeLayout);
  const backdrop = combatRoot?.querySelector('.environment-backdrop')?.cloneNode(true);
  if (backdrop) { backdrop.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; stage.prepend(backdrop); }
  let actors = [], editor, offset = 0, frame, released = false, current = {plan:null,width:1,height:1};
  const selection = () => ({ layout:$('[data-test-layout]').value, players:Number($('[data-test-player-count]').value), enemies:Number($('[data-test-enemy-count]').value), classes:$('[data-test-classes]').value, enemyTypes:$('[data-test-enemies]').value, offset });
  function syncCounts() {
    const [columns,rows] = $('[data-test-layout]').value.split('x').map(Number);
    draft.formationColumns=columns; draft.formationRows=rows;
    for(const side of ['player','enemy']) {
      const select=$(`[data-test-${side}-count]`), count=columns*rows;
      select.innerHTML=Array.from({length:count+1},(_,i)=>`<option value="${i}"${i===count?' selected':''}>${i}</option>`).join('');
    }
  }
  function roster() {
    $('[data-test-actors]').replaceChildren(); actors=[];
    for(const side of ['player','enemy']) {
      const pool=side==='player'?classes:enemies, choice=$(`[data-test-${side==='player'?'classes':'enemies'}]`).value;
      const count=Number($(`[data-test-${side}-count]`).value);
      for(let index=0;index<count;index++) {
        const def=choice==='mixed'?pool[(index+offset)%pool.length]:pool.find(c=>c.id===choice);
        if(!def) continue;
        const node=document.createElement('div'); node.className='position-reference';
        const sprite=document.createElement('div'); sprite.className='position-reference-sprite';
        sprite.append(side==='player'?playerSprite({},def.id):enemySprite(def));
        const label=document.createElement('span'); label.className='position-reference-name';
        node.append(sprite,label); $('[data-test-actors]').append(node);
        actors.push({id:`${side}-${index}`,side,index,def,node,sprite,label});
      }
    }
    schedule();
  }
  function schedule() { if (!released) { cancelAnimationFrame(frame); frame=requestAnimationFrame(paint); } }
  function paint() {
    if (released) return;
    const width=stage.clientWidth, height=stage.clientHeight;
    if(!width || !height) return;
    const plan=combatFormation({width,height,presentation:draft,friends:actors.filter(a=>a.side==='player').map(a=>a.id),enemies:actors.filter(a=>a.side==='enemy').map(a=>a.id)});
    current={plan,width,height};
    $('[data-test-tiles]').innerHTML=plan.cells.map(c=>{const tile=formationTileGeometry(c,plan,draft);return `<div class="formation-grid-cell" data-side="${c.side}" style="left:${c.x}px;top:${c.ground}px;width:${tile.width}px;height:${tile.height}px;--tile-transform:${tile.transform}">${formationTileOutline()}</div>`;}).join('');
    const fittedActors=actors.map(a=>{
      const slot=plan.slots.find(s=>s.id===a.id), art=a.sprite.firstElementChild;
      a.sprite.style.width=`${art.offsetWidth}px`; a.sprite.style.height=`${art.offsetHeight}px`;
      return {...a,slot,...combatSpriteGeometry(a.sprite,schedule),ratio:a.side==='player'?1:combatSpriteRatio(statureFor(registries,a.def.id),a.def.id),leading:18,
        multiplier:(draft[`row${'ABCDEF'[slot.row]}Scale`]||1)*(draft[a.side==='player'?'playerSpriteScale':'enemySpriteScale']||1)*(slot.characterScale||1)*wireframeUi.formation.displayScale};
    });
    const sizes=fitCombatSprites({width,height,actors:fittedActors});
    for(const a of fittedActors) {
      const size=sizes.find(s=>s.id===a.id); if(!size) continue;
      a.node.style.left=`${a.slot.x}px`; a.node.style.top=`${a.slot.ground}px`; a.node.style.zIndex=String(a.slot.row+1);
      a.sprite.style.transform=`translateX(-50%) scale(${size.scale})`; a.sprite.firstElementChild.style.top=`${a.footOffset}px`;
      a.label.textContent=`${a.index+1} · ${a.def.name} · ${a.slot.cell}`;
    }
    $('[data-test-summary]').textContent=`${width} × ${height} CSS px · ${plan.columns} columns × ${plan.rows} rows per side · ${actors.length} reference actors`;
    editor?.draw();
  }
  syncCounts(); roster();
  editor=wireFormationPositioning($('[data-workbench-editor]'),stage,{
    read:()=>draft.formationGroups, write:value=>{draft.formationGroups=value;return {ok:true};},getPlan:()=>current,
    readPresentation:()=>draft,readSpawnTest:()=>({...selection(),roster:actors.map(a=>({side:a.side,spawn:a.index+1,id:a.def.id}))}),onDraw:paint,saveMessage:'Preview updated. Apply to save to the game.',
  });
  $('[data-test-layout]').addEventListener('change',()=>selectLayout());
  $('[data-test-supplied]').addEventListener('click',()=>selectLayout(true));
  for(const name of ['player-count','enemy-count','classes','enemies']) $(`[data-test-${name}]`).addEventListener('change',roster);
  $('[data-test-cycle]').addEventListener('click',()=>{offset++;roster();});
  for(const [name,key,min] of [['width','formationWidth',40],['depth','formationDepth',30]]) $(`[data-test-${name}]`).addEventListener('change',event=>{draft[key]=Math.max(min,Math.min(100,Number(event.target.value)||min));event.target.value=draft[key];paint();});
  $('[data-test-apply]').addEventListener('click',()=>{
    const keys=Object.keys(draft);
    const result=onSettingsChange(Object.fromEntries(keys.map(key=>[`gameConfig.presentation.${key}`,draft[key]])));
    $('[data-test-status]').textContent=result?.ok===false?'Could not save positioning.':'Positioning and sizing saved. Current fights keep enough cells for their real roster.';
  });
  wirePositionWindow($('[data-workbench-drag]'),dialog);
  $('[data-workbench-max]').addEventListener('click',()=>{
    const full=dialog.classList.toggle('position-workbench-max');
    dialog.style.left='';dialog.style.top='';dialog.style.margin='auto';dialog.style.width='';dialog.style.height='';
    $('[data-workbench-max]').textContent=full?'Restore size':'Maximize';
  });
  $('[data-workbench-close]').addEventListener('click',()=>dialog.close());
  const resize=new ResizeObserver(schedule);resize.observe(stage);
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{released=true;cancelAnimationFrame(frame);resize.disconnect();editor.release();dialog.remove();},{once:true});
  stage.addEventListener('load',schedule,true);
  return dialog;
}
