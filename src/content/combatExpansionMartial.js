// src/content/combatExpansionMartial.js — the Martial projection (applyCombatExpansionMartial).
// The tables are JSON: the per-card role rows (combatExpansionMartialOverlay) are authored in
// content/source/combatExpansionMartialOverlay.json, and the lists and numbers the projection
// reads (area, ranged, evades, poise replies, upcast, status) in
// content/source/combatExpansionMartialTables.json; content-build compiles both to
// src/content/generated/. The projection itself is real logic and stays JS. The comments that
// lived here are in content/source/CONTENT-NOTES.md under "## Combat expansion tables".
import { objectTagIds } from './tags.js';
import { combatExpansionMartialOverlay } from './generated/combatExpansionMartialOverlay.js';
import { combatExpansionMartialTables } from './generated/combatExpansionMartialTables.js';
export { combatExpansionMartialOverlay };
const AREA = new Set(combatExpansionMartialTables.area);
const RANGED = new Set(combatExpansionMartialTables.ranged);
const EVADES = new Set(combatExpansionMartialTables.evades);
const POISE_REPLIES = combatExpansionMartialTables.poiseReplies;
const REPLY_SOURCE_BASE = combatExpansionMartialTables.replySourceBase;
const UPCAST = combatExpansionMartialTables.upcast;
const STATUS = combatExpansionMartialTables.status;
const addedAmount = (amount, delta) => typeof amount === 'number' ? Math.max(0, amount + delta)
  : { f: 'add', args: [amount, delta], min: 0 };
function replyProjection(def) {
  const baseline = REPLY_SOURCE_BASE[def.id], conditional = [];
  let damage = 0, poise = 0;
  for (const effect of def.effects || []) {
    if (!['damage', 'poiseDamage'].includes(effect.op)) continue;
    if (effect.if || effect.oncePerTurn) {
      conditional.push({ ...structuredClone(effect), op: 'poiseDamage' });
    } else if (effect.op === 'damage') damage += typeof effect.amount === 'number' ? effect.amount : 0;
    else poise += typeof effect.amount === 'number' ? effect.amount : 0;
  }
  return { amount: POISE_REPLIES[def.id] + Math.max(0, damage - baseline.damage)
    + Math.max(0, poise - baseline.poise), conditional };
}
function pressureEffects(effects = []) {
  return effects.filter(effect => effect.op !== 'dodgeRoll').map(effect => {
    if (effect.op !== 'applyStatus' || !STATUS[effect.status] || !['enemy', 'allEnemies', 'target'].includes(effect.target)) return structuredClone(effect);
    const { stacks, ...rest } = effect;
    return { ...rest, op: 'buildup', camp: 'physical', recoveryProfile: STATUS[effect.status],
      amount: typeof stacks === 'number' ? stacks * 4 : { f: 'mul', args: [stacks ?? 1, 4] } };
  });
}
function tagsFor(tags, row, range, targeting) {
  const preserved = tags.filter(tag => !['maneuver:', 'range:', 'targeting:', 'counter:'].some(prefix => tag.startsWith(prefix)));
  if (row.maneuver !== 'support') preserved.push(`maneuver:${row.maneuver}`);
  preserved.push(`range:${range}`, `targeting:${targeting}`);
  if (row.maneuver === 'counter') preserved.push(`counter:${row.counterMode || 'melee'}`);
  return preserved;
}

export function applyCombatExpansionMartial(def) {
  const row = combatExpansionMartialOverlay[def.id];
  const tags = def.cardTags ?? def.tags ?? objectTagIds('card', def.id);
  if (!row || !tags.includes('camp:physical')) return def;
  // Mounted basics already carry their weapon's authoritative role and camp.
  // Preserve a bow's Ranged Strike or a staff's spell rather than overwriting it.
  const existing = tags.find(tag => tag.startsWith('maneuver:'))?.slice(9);
  const role = def.equipmentRole && !['dodgeRoll', 'evasiveGuard'].includes(def.id) && existing
    ? { ...row, maneuver: existing } : row;
  const range = def.range || role.range || (RANGED.has(def.id) ? 'ranged' : role.maneuver === 'ranged' ? 'reach' : 'melee');
  const targeting = def.targeting || (role.maneuver === 'sweep' || AREA.has(def.id) ? 'area' : 'single');
  const rewritten = tagsFor(tags, role, range, targeting);
  const card = { ...def, tags: rewritten, cardTags: rewritten, range, targeting,
    ...(row.defensiveReaction ? { defensiveReaction: true } : {}),
    effects: pressureEffects(def.effects), ...(role.maneuver === 'support' ? { stanceTrigger: false } : {}) };
  if (def.upgrade?.effects) card.upgrade = { ...def.upgrade, effects: pressureEffects(def.upgrade.effects) };
  if (row.buildup) {
    card.effects.push(structuredClone(row.buildup));
    card.textTemplate = `${def.textTemplate} Add {offBalance} Off Balance buildup to ALL enemies.`;
    if (card.upgrade?.effects) {
      card.upgrade.effects.push(structuredClone(row.buildup));
      card.upgrade.textTemplate = `${def.upgrade.textTemplate ?? def.textTemplate} Add {offBalance} Off Balance buildup to ALL enemies.`;
    }
  }
  if (role.maneuver === 'smash') card.breakPoiseBonus = 3;
  if (role.maneuver === 'ranged' || row.projectile) card.projectile = true;
  if (role.maneuver === 'counter') {
    if (def.id === 'shieldBash') {
      card.effects.unshift({ op: 'block', target: 'self', amount: 5 });
      card.ratingId = 'dr';
    }
    card.counterCoverage = { camps: ['physical'], ranges: [role.counterMode === 'ranged' ? 'reach' : 'melee', ...(role.counterMode === 'ranged' ? ['ranged'] : [])],
      targeting: ['single'], effects: ['damage'], ...(role.counterMode === 'ranged' ? {} : { maneuvers: ['attack', 'smash'] }) };
    if (POISE_REPLIES[def.id]) {
      const reply = replyProjection(def), returnPoise = reply.amount;
      card.counterPayload = { hp: 0, poise: returnPoise, ward: 0, hpRating: false,
        ...(role.counterMode === 'ranged' ? {} : { smashPoiseBonus: 2 }) };
      card.effects = card.effects.filter(effect => !['damage', 'poiseDamage', 'wardDamage'].includes(effect.op));
      card.effects.push({ op: 'poiseDamage', target: 'enemy', amount: returnPoise });
      card.effects.push(...reply.conditional);
      const supportText = def.id === 'shieldBash' ? 'Gain {block} Block.' : (def.textTemplate || '').split('. ').filter(sentence => !/Counter|base reply|Poise damage|^Deal /i.test(sentence)).join('. ');
      card.textTemplate = `${supportText}${supportText ? ' ' : ''}Prepare ${role.counterMode === 'ranged' ? 'Ranged' : 'Melee'} Counter: return {poiseDamage} Poise when the full incoming action is absorbed.${role.counterMode === 'ranged' ? '' : ' Return +2 Poise against Smash.'}${EVADES.has(def.id) ? ' Prepare one Evade.' : ''}`;
      // The version-2 projection is already the resolved rank/break definition.
      delete card.upgrade;
    }
  }
  if (EVADES.has(def.id)) card.evade = { charges: 1, bonus: 0 };
  if (['quickstep', 'dodgeRoll'].includes(def.id)) {
    const originalBlock = def.id === 'quickstep' ? 4 : 3;
    let primaryBlock = false;
    const support = card.effects.filter(effect => !['damage', 'poiseDamage', 'wardDamage', 'gainWard', 'gainPoise'].includes(effect.op))
      .map(effect => {
        if (effect.op !== 'block' || effect.if || effect.oncePerTurn || primaryBlock) return effect;
        primaryBlock = true;
        return { ...effect, amount: addedAmount(effect.amount, 5 - originalBlock) };
      });
    if (!primaryBlock) support.unshift({ op: 'block', target: 'self', amount: 5 });
    // Quickstep's new base draw supplements, rather than erases, earned draws.
    if (def.id === 'quickstep') support.push({ op: 'draw', amount: 1 });
    card.effects = [...support, { op: 'damage', target: 'enemy', amount: 3 }];
    card.counterPayload = { hp: 3, poise: 0, ward: 0 };
    // Equipment ratingId can point at DR for the guard face; the reply uses AR.
    delete card.ratingId; delete card.ratingValue; delete card.ratingCap;
    card.textTemplate = `Gain {block} Block. Prepare one Evade and Melee Counter: return {damage} damage when the full incoming action is absorbed.${def.id === 'quickstep' ? ' Draw {draw} card.' : ''}`;
    delete card.upgrade; delete card.singleBreak;
  }
  if (UPCAST[def.id]) card.upcast = { baseTier: 0, unlockedTiers: [1, 2, 3], maximumTier: 3, ...UPCAST[def.id] };
  return card;
}
