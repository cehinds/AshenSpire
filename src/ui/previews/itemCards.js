import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
const registries = createRegistries(contentBundle);
const gallery = document.querySelector('#weapon-gallery');
for (const item of [...registries.equipment.armaments, ...registries.equipment.armour]) gallery.append(renderEquipmentCard(registries, item).card);
for (const [kind, items] of [['Potion', registries.flasks], ['Relic', registries.relics]]) {
  for (const item of items.all()) gallery.append(renderCollectibleCard(registries, item, kind).card);
}
document.body.dataset.previewReady = 'true';
