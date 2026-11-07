// src/content/combatExpansionCards.js — the spell projection (applyCombatExpansionCard).
// The tables are JSON, compiled by content-build to src/content/generated/: the school/damage-type
// row per card id (content/source/combatExpansionCardOverlay.json), the weapon spell profiles
// (combatExpansionSpellProfiles.json), the colorless counters and cantrips added for the
// expansion (content/source/cards/combatExpansionNewCards.json, a card pool), and the lists and
// numbers the projection reads (combatExpansionCardTables.json). The projection is real logic and
// stays JS. The comments that lived here are in content/source/CONTENT-NOTES.md under
// "## Combat expansion tables".
import { applyCombatExpansionMartial } from './combatExpansionMartial.js';
import { RANGES } from '../model/combatRanges.js';
import { spellDefenseSplit } from '../model/spellDefense.js';
import { combatExpansionCardOverlay } from './generated/combatExpansionCardOverlay.js';
import { combatExpansionSpellProfiles } from './generated/combatExpansionSpellProfiles.js';
import { combatExpansionNewCards } from './generated/cards/combatExpansionNewCards.js';
import { combatExpansionCardTables } from './generated/combatExpansionCardTables.js';
export { combatExpansionCardOverlay, combatExpansionSpellProfiles, combatExpansionNewCards };
const AREA = new Set(combatExpansionCardTables.area);
const RANGED = new Set(combatExpansionCardTables.ranged);
const COUNTERS = combatExpansionCardTables.counters;
const UPCAST = combatExpansionCardTables.upcast;
const CHANCE_PRESSURE = new Set(combatExpansionCardTables.chancePressure);
const STATUS = combatExpansionCardTables.status;
const PROFILE = combatExpansionCardTables.profile;
function pressureValue(stacks, id) {
  // Frost's old units are retuned as units; other old stack grants become four
  // pressure units per stack instead of bypassing the new gauges/defenses.
  if (id === 'frost') return typeof stacks === 'number' ? Math.max(3, stacks) : stacks;
  return typeof stacks === 'number' ? stacks * 4 : { f: 'mul', args: [stacks ?? 1, 4] };
}
function effectsFor(effects = [], school) {
  return effects.map(effect => {
    if (effect.op === 'block') return { ...effect, op: 'gainBarrier' };
    if (effect.op === 'applyStatus' && STATUS[effect.status] && ['enemy', 'allEnemies', 'target'].includes(effect.target)) {
      const status = school === 'fire' && effect.status === 'frost' ? 'burn' : STATUS[effect.status];
      const { stacks, ...rest } = effect;
      return { ...rest, op: 'buildup', status, amount: pressureValue(stacks, effect.status), camp: 'spell', recoveryProfile: PROFILE[effect.status] };
    }
    return structuredClone(effect);
  });
}
const barrierText = text => typeof text === 'string' ? text.replace(/\{block(?=[}.])/g, '{gainBarrier').replace(/\bBlock\b/g, 'Barrier') : text;
function conditionFor(value) {
  if (Array.isArray(value)) return value.map(conditionFor);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, conditionFor(child)]));
  if (result.p === 'hasStatus' || result.f === 'stacks') result.status = { frost: 'frozen', frostExposed: 'chilled', bleed: 'bleeding' }[result.status] || result.status;
  return result;
}
// A spell's range is its explicit row, then its own authored range, then the
// ranged list, then its delivery: projectile is ranged, melee is melee, anything else is reach.
function spellRange(def, row) {
  if (row.range) return row.range;
  // Read before rewriteTags strips the range tags.
  if (RANGES.includes(def.range)) return def.range;
  const tags = def.cardTags || def.tags || [];
  const authored = tags.find(tag => tag.startsWith('range:'))?.slice(6);
  if (RANGES.includes(authored)) return authored;
  if (RANGED.has(def.id)) return 'ranged';
  if (tags.includes('delivery:projectile')) return 'ranged';
  if (tags.includes('delivery:melee')) return 'melee';
  return 'reach';
}
function rewriteTags(def, row, maneuver) {
  const tags = (def.cardTags || def.tags || []).filter(tag => !['camp:', 'school:', 'damage:', 'maneuver:', 'range:', 'targeting:', 'counter:'].some(prefix => tag.startsWith(prefix)));
  tags.push('camp:spell', `school:${row.school}`, `damage:${row.damageType}`, `range:${spellRange(def, row)}`, `targeting:${AREA.has(def.id) ? 'area' : 'single'}`);
  if (maneuver) tags.push(`maneuver:${maneuver}`);
  if (COUNTERS[def.id]) tags.push('counter:spell');
  return tags;
}

// Protection range is separate from the authored offensive range. Only the
// incoming range filter widens; camp, targeting and trait restrictions stay.
function withSpellDefenseRange(def) {
  const tags = def.cardTags || def.tags || [];
  const defensiveRole = tags.some(tag => tag === 'maneuver:defend' || tag === 'maneuver:counter');
  const grants = [...(def.effects || []), ...(def.upgrade?.effects || []), ...(def.comboHook?.effects || [])]
    .some(effect => ['block', 'gainBarrier', 'gainWard'].includes(effect.op));
  if (!spellDefenseSplit(def, 0) || (!defensiveRole && !grants)) return def;
  const defenseRange = def.defenseRange || 'ranged';
  const ranges = RANGES.slice(0, RANGES.indexOf(defenseRange) + 1);
  return { ...def, defenseRange,
    ...(def.counterCoverage ? { counterCoverage: { ...def.counterCoverage, ranges } } : {}) };
}

// Hostile spell skills have the same Spell stance as ranged offensive spells.
// The payload decides this role; classifying a card as Skill does not make it support.
function withSpellOffenseStance(def) {
  const tags = def.cardTags || def.tags || [];
  if (def.stanceTrigger === false || def.combatProfile?.stanceTrigger === false
    || !tags.includes('camp:spell') || def.combatProfile?.maneuver
    || tags.some(tag => tag.startsWith('maneuver:'))) return def;
  const range = def.range || def.combatProfile?.range || tags.find(tag => tag.startsWith('range:'))?.slice(6) || 'reach';
  const hostile = [...(def.effects || []), ...(def.upgrade?.effects || [])].some(effect =>
    ['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies', 'target'].includes(effect.target));
  if (range === 'melee' || !hostile) return def;
  const nextTags = [...tags, 'maneuver:casting'];
  return { ...def, tags: nextTags, cardTags: nextTags,
    ...(def.combatProfile ? { combatProfile: { ...def.combatProfile, maneuver: 'casting' } } : {}) };
}

export function applyCombatExpansionCard(def) {
  def = { ...applyCombatExpansionMartial(def), defenseRulesVersion: 2 };
  // Each paid Power instance leaves the usable deck for this combat. Its
  // installed status remains active; old runs never enter this projection.
  if (def.type === 'power' && !(def.keywords || []).includes('exhaust')) {
    def = { ...def, keywords: [...(def.keywords || []), 'exhaust'] };
  }
  const row = combatExpansionSpellProfiles[def.equipmentProfileId] || combatExpansionCardOverlay[def.id];
  if (!row) return withSpellDefenseRange(withSpellOffenseStance(def));
  const originalTags = def.cardTags || def.tags || [];
  const maneuver = row.maneuver || (COUNTERS[def.id] ? 'counter' : originalTags.find(tag => tag.startsWith('maneuver:'))?.slice(9)
    || (def.type === 'attack' ? 'casting' : null));
  const card = { ...def, tags: rewriteTags(def, row, maneuver), cardTags: rewriteTags(def, row, maneuver),
    damageSchool: 'magic', range: spellRange(def, row), targeting: AREA.has(def.id) ? 'area' : 'single',
    attack: { ...def.attack, source: 'spell', damageType: row.damageType }, effects: effectsFor(def.effects, row.school), textTemplate: barrierText(def.textTemplate), ...(def.faceTemplate ? { faceTemplate: def.faceTemplate.map(barrierText) } : {}) };
  if (def.upgrade) card.upgrade = { ...def.upgrade, ...(def.upgrade.effects ? { effects: effectsFor(def.upgrade.effects, row.school) } : {}), ...(def.upgrade.textTemplate ? { textTemplate: barrierText(def.upgrade.textTemplate) } : {}) };
  const damaging = card.effects.some(effect => effect.op === 'damage');
  const rider = { frost: 'frost', fire: 'burn', lightning: 'paralysis', decay: 'necroticBlight' }[row.school];
  // A decay card that prints its own Blight (Crimson or Necrotic) keeps only what it prints: one Blight per hit.
  const printsRider = effect => effect.op === 'buildup' && (effect.status === rider || (row.school === 'decay' && effect.status === 'crimsonBlight'));
  if (damaging && rider && !card.effects.some(printsRider)) {
    const target = AREA.has(def.id) ? 'allEnemies' : 'enemy';
    card.effects.push({ op: 'buildup', target, status: rider, amount: row.school === 'fire' ? 4 : 3, camp: 'spell', recoveryProfile: PROFILE[rider] || 'elemental' });
    if (card.upgrade?.effects) card.upgrade.effects.push({ op: 'buildup', target, status: rider, amount: row.school === 'fire' ? 5 : 4, camp: 'spell', recoveryProfile: PROFILE[rider] || 'elemental' });
  }
  if (row.school === 'fire' && damaging) {
    const raise = list => list.map(effect => effect.op === 'damage' ? { ...effect, amount: typeof effect.amount === 'number' ? effect.amount + 1 : { f: 'add', args: [effect.amount, 1] } } : effect);
    card.effects = raise(card.effects); if (card.upgrade?.effects) card.upgrade.effects = raise(card.upgrade.effects);
  }
  if (COUNTERS[def.id]) {
    const counter = COUNTERS[def.id];
    card.counterCoverage = { camps: counter.camps, ranges: counter.ranges, targeting: counter.targeting, effects: ['damage', 'status'] };
    card.counterPayload = { hp: 0, ward: counter.ward, poise: counter.poise };
    card.schoolEffect = counter.ward ? 'ward' : 'poise';
  }
  if (UPCAST[def.id]) card.upcast = { baseTier: 0, unlockedTiers: [1, 2, 3], maximumTier: 3, ...UPCAST[def.id] };
  const append = effect => { card.effects.push(effect); if (card.upgrade?.effects) card.upgrade.effects.push(structuredClone(effect)); };
  // These independent control payloads create the school's non-damage opening.
  if (def.id === 'hex') append({ op: 'buildup', target: 'enemy', status: 'sleep', amount: 4, camp: 'spell', recoveryProfile: 'mental' });
  if (def.id === 'attune') append({ op: 'gainWard', target: 'self', amount: 1, oncePerCombat: 'alteration-ward' });
  if (def.id === 'starPath') {
    append({ op: 'applyStatus', target: 'self', status: 'concealed', stacks: 1, duration: 2 });
    card.textTemplate += ' Gain {concealed} Concealed for 2 turns. Sweep and Holy reveal it.';
    if (card.upgrade?.textTemplate) card.upgrade.textTemplate += ' Gain {concealed} Concealed for 2 turns. Sweep and Holy reveal it.';
  }
  if (def.id === 'moonrendCut' || def.id === 'gravityWell') append({ op: 'applyStatus', target: AREA.has(def.id) ? 'allEnemies' : 'enemy', status: 'prone', stacks: 1 });
  if (def.id === 'meteorite' || def.id === 'starfallBeam') { card.traits = [...(def.traits || []), 'unreflectable']; card.tags.push('trait:unreflectable'); card.cardTags.push('trait:unreflectable'); }
  const revise = (list, chance) => list.map(effect => ({ ...effect,
    ...(effect.if ? { if: conditionFor(effect.if) } : {}),
    ...(effect.amount && typeof effect.amount === 'object' ? { amount: conditionFor(effect.amount) } : {}),
    ...(CHANCE_PRESSURE.has(def.id) && effect.op === 'buildup' ? { chance } : {}),
  }));
  card.effects = revise(card.effects, 50);
  if (card.upgrade?.effects) card.upgrade.effects = revise(card.upgrade.effects, 75);
  if (card.upcast && CHANCE_PRESSURE.has(def.id)) card.upcast.chancePerRank = 25;
  return withSpellDefenseRange(withSpellOffenseStance(card));
}
