import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';
import { createRunState } from '../../model/state.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { renderCard } from '../components/card.js';
import { configureTooltipGlossary, inspectionTag } from '../components/tooltipGlossary.js';
import { attachTooltip, esc, hideTooltip } from '../components/tooltip.js';
import { statusTooltipText } from '../uiContent.js';

/** Disposable review fixtures, entered only through an explicit shot URL. */
export async function mountTooltipReview(scene) {
  const r = createRegistries(contentBundle), app = document.querySelector('#app');
  configureTooltipGlossary(r); hideTooltip();
  if (['combat', 'coop', 'reward', 'shop', 'customize', 'map', 'combat-test'].includes(scene)) return;
  const run = createRunState({ seed: 671, classId: 'reaver', registries: r });
  window.__tooltipReviewRun = run;
  const meta = { settings: { holdConfirm: 'off' }, found: r.equipment.armaments.map(i => i.id) };
  if (scene === 'potion') {
    const { mountRewards } = await import('../screens/reward.js');
    const potion = r.flasks.all().find(d => d.name === 'Blood Unction');
    mountRewards(app, { registries:r, run, rewards:{cinders:0, cardChoices:[], flaskId:potion.id}, onDone(){} });
  } else if (scene === 'equipment') {
    const { mountEquipment } = await import('../screens/equipment.js');
    mountEquipment(app, { registries:r, run, meta, inCombat:false, onClose(){}, onEquipmentChanged(){} });
  } else if (scene === 'smith') {
    const { mountSmithUpgradeModal } = await import('../components/smithUpgradeModal.js');
    const { smithSelectionModel } = await import('../models/SmithSelectionModel.js');
    const { smithingPlan } = await import('../../model/smithing.js');
    run.smithingStones=5;
    const plan=smithingPlan(r,run);
    const modal=mountSmithUpgradeModal(document.body,smithSelectionModel(r,plan),{registries:r,meta,
      onSelect:id=>modal.update(smithSelectionModel(r,plan,id)),onBack(){},onConfirm(){}});
  } else if (scene === 'compendium') {
    const { mountCompendium } = await import('../screens/compendium.js');
    mountCompendium(app,{registries:r,meta,onClose(){},onBack(){}});
  } else {
    document.body.classList.add('tooltip-review-gallery');
    const style=document.createElement('style');
    style.textContent='.tooltip-review-gallery{overflow:auto!important}.tooltip-review-gallery #app{overflow:visible!important;display:block;height:auto;padding:24px}.review-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:28px;padding:20px 0}.review-grid>.equipment-poker-card{width:200px}.review-grid>.card{width:200px;height:280px;transform:none}.review-controls{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.review-grid .status-sample{min-height:70px;padding:12px;border:1px solid #806638;border-radius:6px}.review-grid .card-info-button{z-index:4}';
    document.head.append(style);
    app.innerHTML='<h1>Card & keyword collection</h1><p>Choose a category. Select a card and use its Information button. Hover or tap tags to read their definitions.</p><div class="review-controls"></div><div class="review-grid"></div>';
    const controls=app.querySelector('.review-controls'), grid=app.querySelector('.review-grid');
    const categories=['Armaments','Armor','Potions','Relics','Cards','Statuses','Stances','Keywords'];
    const show = category => {
      hideTooltip(); grid.replaceChildren();
      app.dataset.reviewCategory=category;
      if (['Armaments','Armor'].includes(category)) for(const item of category==='Armor'?r.equipment.armour:r.equipment.armaments) grid.append(renderEquipmentCard(r,item).card);
      if (['Potions','Relics'].includes(category)) for(const item of (category==='Potions'?r.flasks:r.relics).all()) grid.append(renderCollectibleCard(r,item,category==='Potions'?'Potion':'Relic').card);
      if(category==='Cards') for(const def of r.cards.all()) grid.append(renderCard(r,{cardId:def.id,upgraded:false},{inspectReadOnly:true}));
      if(['Statuses','Stances','Keywords'].includes(category)) for(const def of r[category.toLowerCase()].all()) {
        const sample=inspectionTag(def.name,statusTooltipText(def)); sample.classList.add('status-sample'); sample.dataset.contentId=def.id; grid.append(sample);
      }
    };
    for(const category of categories) { const b=document.createElement('button');b.textContent=category;b.onclick=()=>show(category);controls.append(b); }
    if(scene==='lab') {
      app.querySelector('h1').textContent='Hover timing & nested terms';
      for(const name of ['First target','Second target']) {
        const b=document.createElement('button');b.textContent=name;b.dataset.lab=name;
        attachTooltip(b,()=>`<div class="tt-title">${esc(name)}</div><p>Apply Bleed. <span data-tip="Removed for the rest of this combat." role="button" tabindex="0">Exhaust</span>.</p>`,{autoHideMs:100});grid.append(b);
      }
      const native=document.createElement('button');native.textContent='Native title';native.title='A title uses the same delayed tooltip.';grid.append(native);
      grid.append(inspectionTag('Tag','A tag uses the same delayed tooltip.'));
    } else show('Potions');
  }
  document.body.dataset.tooltipReviewReady='true';
}
