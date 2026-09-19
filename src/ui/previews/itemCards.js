import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';
import { renderEquipmentCard, equipmentDetails } from '../components/equipmentCard.js';
import { paintedPresentation } from '../paintedOutfits.js';
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
  const sprite = paintedPresentation(item.classId, item.id);
  sprite.style.cssText = 'display:block;height:200px;max-width:100%;object-fit:contain;margin:auto';
  sprite.alt = `${item.name} equipped sprite`;
  article.append(sprite);
  gallery.append(article);
}
if (!sharedArmor) {
for (const [kind, items] of [['Potion', registries.flasks], ['Relic', registries.relics]]) {
  for (const item of items.all()) gallery.append(renderCollectibleCard(registries, item, kind).card);
}
}
document.body.dataset.previewReady = 'true';
