import { gameProfileEquipmentReceipt, gameProfileEffectiveAttributes } from './gameProfileGear.js';
export { gameProfileEquipmentReceipt, gameProfileEffectiveAttributes };
import { deriveStat } from './derivedStats.js';
// Profile-selected run policies. Legacy profiles never enter these branches.
import { gameModule, gameContent } from './gameProfile.js';
import { PrAttributeView } from './fixCoreMechanics.js';
import { upgradeTierBonus } from '../../engine/kernel/gameConfig.js';
import { ItemFamily } from './itemPicks.js';
import { CLASS_LEVEL_BONUS_VERSION } from './classLevelBonus.js';

const STAT_ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
export const isConfiguredRun =(subject) => (subject?.gameProfile || subject)?.foundation?.mode === 'configured';
export const gameProfileAttributes = (subject, classId) => gameContent(subject, 'classAttributes')?.[classId];

export function gameProfileClassAvailable(subject, meta = {}, classId) {
  const rules = gameContent(subject, 'classUnlocks');
  if (gameModule(subject, 'class-selection')?.mode !== 'configured' || !rules) return true;
  const state = meta.gameProfileUnlocks?.[unlockKey(subject)];
  return [...rules.initial, ...rules.sequence.slice(0, state?.completedRunIds?.length || 0)].includes(classId);
}
const unlockKey = (subject) => (subject.gameProfile || subject).id;

export function gameProfileCompletedRunMeta(subject, meta, result) {
  const rules = gameContent(subject, 'classUnlocks');
  if (!isConfiguredRun(subject) || !rules) return { meta, unlocked: [] };
  if (!result.finishId) throw new Error('Configured completion requires a durable finishId');
  if (typeof result.victory !== 'boolean') throw new Error('Configured completion requires a terminal victory or defeat fact');
  const key = unlockKey(subject);
  const next = structuredClone(meta);
  next.gameProfileUnlocks ||= {};
  const ledger = next.gameProfileUnlocks[key] ||= { completedRunIds: [] };
  if (ledger.completedRunIds.includes(result.finishId)) return { meta, unlocked: [] };
  const outcome = result.victory ? 'victory' : 'defeat';
  if (!rules.qualifyingOutcomes.includes(outcome)) return { meta, unlocked: [] };
  const count = ledger.completedRunIds.length;
  ledger.completedRunIds.push(result.finishId);
  return { meta: next, unlocked: rules.sequence[count] ? [rules.sequence[count]] : [] };
}

export function gameProfileStarterDeck(subject, classId) {
  const deck = gameContent(subject, 'starterDeck');
  if (gameModule(subject, 'cards')?.mode !== 'configured' || !deck) return null;
  // A class may author its whole opening list (classDecks, specials included); otherwise the shared list plus the class special applies.
  const own = deck.classDecks?.[classId];
  if (own) return own.flatMap(row => Array(row.copies).fill(row.card));
  const ids = deck.shared.flatMap(row => Array(row.copies).fill(row.card));
  const special = deck.classSpecials[classId];
  if (!special) throw new Error(`starterDeck.classSpecials.${classId}: missing card`);
  return [...ids, ...Array(deck.classSpecificCopies).fill(special)];
}

// Replace primary weights, retaining secondary terms and authored bounds/bases.
export function gameProfileStatOptions(subject, options = {}, classId = subject?.class) {
  if (gameModule(subject, 'stats')?.mode !== 'configured') return options;
  const stats = gameContent(subject, 'stats');
  const rows = {};
  const aliases = { mp: 'mana', sp: 'stamina' };
  for (const [attribute, benefits] of Object.entries(stats.levelGains)) {
    for (const [name, amount] of Object.entries(benefits)) rows[aliases[name] || name] = {
      ...(rows[aliases[name] || name] || {}), [attribute]: amount,
    };
  }
  // Select only this run's authored class base. A base-only byClass row
  // would replace (not merge) all attribute weights and erase WIS growth.
  for (const [id, base] of Object.entries(stats.poolBasesByClass?.[classId] || {})) rows[id] = {
    ...(rows[id] || {}), base,
  };
  // Owner, 2026-11-17: under `secondaryPolicy: "primaryOnly"` a row levelGains names reads only the attributes it lists
  // (AR from STR, DR from DEX, Stamina from CON, Mana from WIS); every other attribute weight of that row is zeroed.
  if (stats.secondaryPolicy === 'primaryOnly') {
    for (const row of Object.values(rows)) for (const attribute of STAT_ATTRIBUTES) if (!Object.hasOwn(row, attribute)) row[attribute] = 0;
  }
  // How many attribute points one +1 of a pool costs, the points it counts from, and the attributes it reads the highest of
  // (owner, 2026-11-17: SP = 3 + floor((DEX - 1) / 3), MP = 1 + floor((max(INT, WIS) - 1) / 3)).
  for (const [name, points] of Object.entries(stats.pointsPerIncrease || {})) {
    const id = aliases[name] || name;
    rows[id] = { ...(rows[id] || {}), pointsPerIncrease: points };
  }
  for (const [name, baseline] of Object.entries(stats.attributeBaseline || {})) {
    const id = aliases[name] || name;
    rows[id] = { ...(rows[id] || {}), attributeBaseline: baseline };
  }
  for (const [name, ids] of Object.entries(stats.maxOf || {})) {
    const id = aliases[name] || name;
    rows[id] = { ...(rows[id] || {}), maxOf: [...ids] };
  }
  for (const id of ['openingHand', 'draw']) rows[id] = {
    ...(rows[id] || {}), base: stats.handBase, intelligence: 1, attributeBaseline: 0,
    byClass: {},
  };
  // Every class's pool base and per-level growth (owner, 2026-11-17: HP = 30 + 5 x (CON + level) is base 35, CON 5 and 5 per level
  // after the first). A run layer, not the explicit override, so a relic's flat bonus still adds to the base.
  const pools = {};
  for (const [id, base] of Object.entries(stats.poolBases || {})) pools[id] = { ...(pools[id] || {}), base };
  for (const [id, perLevel] of Object.entries(stats.levelGrowth || {})) pools[id] = { ...(pools[id] || {}), perLevel };
  const runModifiers = Array.isArray(options.runModifiers) ? options.runModifiers : options.runModifiers ? [options.runModifiers] : [];
  return { ...options,
    ...(Object.keys(pools).length ? { runModifiers: [...runModifiers, { rules: pools }] } : {}),
    explicitOverride: {
      ...(options.explicitOverride || {}), rules: {
        ...(options.explicitOverride?.rules || {}), ...rows,
      },
    } };
}

export function initializeGameProfileRun(registries, run, { profileMeta = {} } = {}) {
  const ids = gameProfileStarterDeck(run, run.class);
  if (!ids) {
    const profile = run.gameProfile;
    if (profile && profile.foundation.mode !== 'legacy' && !gameModule(run, 'cards')) {
      run.deck = []; run.sideboard = []; run.equipmentAttackSlotCount = 0;
    }
    return;
  }
  for (const id of ids) if (!registries.cards.has(id)) throw new Error(`starterDeck: unknown card '${id}'`);
  run.deck = ids.map((cardId, i) => ({ instanceId: `gp${i + 1}`, cardId, upgraded: false }));
  run.sideboard = [];
  run.equipmentAttackSlotCount = 0;
  run.skills = {};
  run.coreTags = [];
  // A run born from today pays the odd-level class bonus; an older save carries no field and gets none.
  if (gameModule(run, 'progression')?.characterLevels) run.classLevelBonusVersion = CLASS_LEVEL_BONUS_VERSION;
}

// Synchronous internal service scope; low-level mutation doors cannot bypass rest.
const services = new WeakMap();
export function withGameProfileService(run, service, operation) {
  if (services.has(run)) throw new Error('Nested configured service transaction');
  services.set(run, service);
  try { return operation(); } finally { services.delete(run); }
}
export const gameProfileServiceActive = (run, service) => services.get(run) === service;


// One configured receipt shared by character inspection and combat creation.
// Read equipped active slots every time: a swap must never leave a cached bonus.
export function gameProfileRatingReceipt(registries, run) {
  if (!isConfiguredRun(run)) return null;
  const ids = ['ar','dr','pr','ward','poise'];
  const totals = Object.fromEntries(ids.map(id => [id,0]));
  const attributeReceipts = {};
  const gear = gameProfileEquipmentReceipt(registries,run);
  const attributes = gameProfileEffectiveAttributes(registries,run);
  const stats = gameModule(run,'stats')?.mode === 'configured';
  if (stats) for (const id of ids) {
    const table = run.derivedStatRuleSnapshot?.rules || registries.derivedStatRules;
    const receipt = deriveStat(table,id,{attributes: id === 'pr' ? PrAttributeView(run,attributes) : attributes,classDef:registries.classes.get(run.class),level:run.level?.level || 1});
    attributeReceipts[id] = receipt; totals[id] = receipt.value;
  }
  const sources = [{name:'Attributes',kind:'attribute',...totals}];
  for (const source of gear.sources) {
    const ratingSource = {...source,pr:0};
    for (const id of ids) { ratingSource[id] = source[id] || 0; totals[id] += ratingSource[id]; }
    sources.push(ratingSource);
  }
  const policy = gameModule(run,'equipment')?.upgradeBonuses;
  if (stats && policy && run.loadout) {
    let weaponTier = 0, armorTier = 0;
    const tier = ref => Number.isSafeInteger(run.itemUpgradeLevels?.[ref]) && run.itemUpgradeLevels[ref] > 0 ? run.itemUpgradeLevels[ref] : 0;
    for (const [slot,sets] of Object.entries(run.loadout.sets || {})) {
      const id = sets[run.loadout.active?.[slot] || 0];
      if (!id) continue;
      if (slot === 'armor') armorTier = Math.max(armorTier,tier(`armor/${run.class}/${id}`));
      else {
        const piece = registries.equipment.armaments.find(row => row.id === id);
        if (!piece) continue;
        if (piece.kind === 'shield') armorTier = Math.max(armorTier,tier(`armament/${id}`));
        else {
          const itemTier = tier(`armament/${id}`);
          weaponTier = Math.max(weaponTier,itemTier);
          // Under the gear module's `statPoints` (Core, owner 2026-11-17) a tier adds attribute points to the item instead (gameProfileGear.js).
          if (gameModule(run,'gear')?.armorBudget && !gameModule(run,'gear')?.statPoints && itemTier) {
            const ar = upgradeTierBonus(gameModule(run,'equipment'),itemTier) * policy.weaponARPerTier;
            // A magic weapon's tier also raises its spells: the same bonus lands in PR (W25 upgrades, step 1).
            const pr = ItemFamily(run,`armament/${id}`) === 'magic' ? ar : 0; // a category change can make a staff martial, a sword magic
            totals.ar += ar; totals.pr += pr;
            sources.push({name:piece.name || id,kind:'equipment',sourceId:`armament/${id}`,itemId:id,slot,ar,dr:0,pr,ward:0,poise:0,weaponTier:itemTier});
          }
        }
      }
    }
    const ar = gameModule(run,'gear')?.armorBudget ? 0 : weaponTier * policy.weaponARPerTier, dr = gameModule(run,'gear')?.armorBudget ? 0 : armorTier * policy.armorDRPerTier;
    totals.ar += ar; totals.dr += dr;
    if (ar || dr) sources.push({name:'Equipped upgrade tiers',kind:'equipment',sourceId:'configured-upgrades',ar,dr,pr:0,ward:0,poise:0,weaponTier,armorTier});
  }
  return {totals,sources,attributeReceipts,baseEvasionBonus:gear.totals.evasion,basePrecisionBonus:gear.totals.precision};
}
