import { gameModule, gameContent } from './gameProfile.js';
import { DeckAttributeBonuses } from './cardUpgrade.js';
import { resolveGearItem, upgradeTierBonus } from '../../engine/kernel/gameConfig.js';
import { ItemStatBonus } from './itemPicks.js';
import { ClassLevelAttributeBonus } from './classLevelBonus.js';
const ATTRIBUTES = ['strength','dexterity','constitution','wisdom','intelligence'];
const STATS = ['hp','mp','sp','ar','dr','poise','ward','evasion','precision',...ATTRIBUTES];
// A single resolved-value path. Points are never also granted as raw bonuses.
export function gameProfileEquipmentReceipt(registries, run) {
  const settings = gameModule(run,'gear');
  const totals = Object.fromEntries(STATS.map(id=>[id,0])), sources = [];
  if (settings?.mode !== 'configured' || !settings.armorBudget || !run.loadout) return { totals, sources };
  const catalog = gameContent(run,'gear') || [];
  for (const [slot, sets] of Object.entries(run.loadout.sets || {})) {
    const id = sets[run.loadout.active?.[slot] || 0];
    if (!id) continue;
    const armor = slot === 'armor';
    const item = catalog.find(item => (item.source?.id || item.id) === id && (item.kind === 'armor') === armor && (!item.classes || item.classes.includes(run.class)));
    if (!item) continue;
    const sourceId = armor ? `armor/${run.class}/${id}` : `armament/${id}`;
    const tier = run.itemUpgradeLevels?.[sourceId] || 0;
    const resolved = resolveGearItem(item, settings, {rank: (item.rank ?? 1) + upgradeTierBonus(gameModule(run,'equipment'), tier)});
    // The Blacksmith's picks and the item's properties add stat points on top (W25 step 4).
    const values = { ...resolved.values };
    for (const [key, n] of Object.entries(ItemStatBonus(run, sourceId))) values[key] = (values[key] || 0) + n;
    for (const key of STATS) totals[key] += values[key] || 0;
    sources.push({ name:item.name.replace(/_/g,' '), kind:'equipment', sourceId, slot, itemId:item.id, ...values, resolved });
  }
  // A held relic's properties are stat points too (a relic has no gear row, so nothing else adds them).
  for (const id of run.relics || []) {
    const bonus = ItemStatBonus(run, `relic/${id}`);
    if (!Object.keys(bonus).length) continue;
    for (const key of STATS) totals[key] += bonus[key] || 0;
    sources.push({ name:id, kind:'relic', sourceId:`relic/${id}`, itemId:id, ...bonus });
  }
  return { totals, sources };
}
export function gameProfileEffectiveAttributes(registries, run, attributes = run.allocatedAttributes ?? run.player?.allocatedAttributes ?? run.attributes) {
  const gear = gameProfileEquipmentReceipt(registries,run);
  // Run-long INT / WIS upgrades on the cards in the deck (W25-L), read here so the sheet, the ratings and a fight all price the same attributes.
  const deck = DeckAttributeBonuses(run.deck);
  // The class bonus of every odd character level (model/classLevelBonus.js).
  const level = ClassLevelAttributeBonus(run);
  return Object.fromEntries(Object.entries(attributes || {}).map(([id,value])=>[id,value+(gear.totals[id] || 0)+(deck[id] || 0)+(level[id] || 0)]));
}
