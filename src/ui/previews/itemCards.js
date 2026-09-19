import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';
import { renderEquipmentCard, equipmentDetails } from '../components/equipmentCard.js';
import { createPaintedStage } from '../paintedOutfits.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
const registries = createRegistries(contentBundle);
const gallery = document.querySelector('#weapon-gallery');
const sharedArmor = new URL(location.href).searchParams.has('sharedArmor');
const equipment = sharedArmor
  ? registries.equipment.armour.filter(item => item.sharedSet && item.classId === 'reaver')
  : [...registries.equipment.armaments, ...registries.equipment.armour];
if (sharedArmor) {
  document.body.classList.add('shared-armor-preview');
  document.title = 'AshenSpire · All-class armor';
  document.querySelector('h1').textContent = 'Armor for every class';
  document.querySelector('header p:last-child').textContent = 'Available in the Armoury. Meet the listed attribute requirement to equip a set. Select a card to inspect bonuses and tags.';
}
for (const item of equipment) {
  const rendered = renderEquipmentCard(registries, item, sharedArmor ? { level: 'inspect' } : {});
  if (!sharedArmor) { gallery.append(rendered.card); continue; }
  const article = document.createElement('article');
  article.dataset.armorId = item.id;
  article.append(rendered.card, equipmentDetails(rendered.explanations));
  const figures = document.createElement('div');
  figures.className = 'shared-outfit-figures';
  for (const cls of registries.classes.all()) {
    const figure = document.createElement('figure');
    const stage = createPaintedStage(cls.id, item.id);
    stage.el.style.cssText = 'position:relative;width:100%;height:160px';
    stage.el.setAttribute('aria-label', `${cls.name} wearing ${item.name}`);
    const caption = document.createElement('figcaption');
    caption.textContent = cls.name;
    figure.append(stage.el, caption);
    figures.append(figure);
    // The same stage renderer used by combat; keep its rest pose selectable for review.
    figure.stage = stage;
  }
  const label = document.createElement('label');
  label.textContent = 'Preview pose';
  const select = document.createElement('select');
  select.setAttribute('aria-label', `${item.name} preview pose`);
  for (const [value, text] of [['idle', 'Standing'], ['guard', 'Guarding'], ['attack2', 'Attacking'], ['power2', 'Casting'], ['hit', 'Hurt'], ['defeated', 'Defeated'], ['prepared', 'Prepared'], ['bloodRite', 'Blood Rite']]) {
    const option = document.createElement('option');
    option.value = value; option.textContent = text; select.append(option);
  }
  select.addEventListener('change', () => {
    for (const figure of figures.children) figure.stage.setRestPose(select.value, { immediate: true });
  });
  label.append(select);
  article.append(figures, label);
  gallery.append(article);
}
if (!sharedArmor) {
for (const [kind, items] of [['Potion', registries.flasks], ['Relic', registries.relics]]) {
  for (const item of items.all()) gallery.append(renderCollectibleCard(registries, item, kind).card);
}
}
document.body.dataset.previewReady = 'true';
