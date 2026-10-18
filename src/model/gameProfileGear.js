import { gameModule, gameContent } from './gameProfile.js';
import { resolveGearItem } from '../../engine/kernel/gameConfig.js';
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
    const resolved = resolveGearItem(item, settings, {rank: (item.rank ?? 1) + tier});
    for (const key of STATS) totals[key] += resolved.values[key] || 0;
    sources.push({ name:item.name.replace(/_/g,' '), kind:'equipment', sourceId, slot, itemId:item.id, ...resolved.values, resolved });
  }
  return { totals, sources };
}
export function gameProfileEffectiveAttributes(registries, run, attributes = run.attributes) {
  const gear = gameProfileEquipmentReceipt(registries,run);
  return Object.fromEntries(Object.entries(attributes || {}).map(([id,value])=>[id,value+(gear.totals[id] || 0)]));
}
