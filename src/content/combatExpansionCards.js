// Explicit authored ids are the mapping authority. This overlay is applied
// only by the v2 resolver; old runs continue to use their original definitions.
import { applyCombatExpansionMartial } from './combatExpansionMartial.js';
const SCHOOL_IDS = {
  force: ['starstonePebble', 'cometFragment', 'starbladePhalanx', 'starShower', 'starSlicer', 'starlance', 'starstoneArc', 'moonrendCut', 'meteorite', 'meteorSwarm', 'astralCleave', 'radiantSpray', 'supernova', 'starstoneKris', 'starfallBeam', 'starcaller', 'shootingShard', 'celestialLance', 'progression-comet-needle', 'progression-falling-constellation'],
  frost: ['frostVeil', 'frostNova', 'progression-rime-mirror', 'progression-eclipse-lance'],
  lightning: ['azureCoilCard', 'starSpark'],
  fire: ['cinderSigil', 'ashenMote', 'emberVigil', 'readTheAsh', 'pyreOfCharts', 'ashCircle', 'kindledOmen', 'cinderLance', 'ashfallRite', 'pyreLight', 'riteOfCinders', 'progression-cinder-orbit'],
  alteration: ['crystalBarrier', 'starstoneWard', 'astralArmorCard', 'gravityWell', 'timeDilation', 'umbralWard', 'wardingStar', 'moonlitShieldCard', 'astralInsight', 'attune', 'transmute', 'progression-lunar-aegis', 'progression-wellspring-sigil', 'progression-gravitic-knot', 'progression-firmament-ward'],
  illusion: ['scholarsInsight', 'twinkling', 'lucidity', 'stargazerCard', 'constellationCard', 'waxingMoonCard', 'starPath', 'astromancerCard', 'hex', 'progression-nightglass-reading'],
  divine: ['phoenixChart', 'urgentHeal', 'emberCommunion', 'penance', 'transfusion', 'blightward', 'sacredHarvest', 'thornHaloCard', 'communionCard', 'gildedOath', 'reclamation', 'secondBloom', 'lifeTitheCard', 'lastRites', 'zealotryCard', 'lastMercy', 'warmLitany', 'sharedFlame', 'ashOath', 'vesperWard', 'progression-ash-benediction', 'progression-pallbearer-s-ward', 'progression-pilgrim-s-shelter', 'progression-dawn-after-ash'],
  decay: ['bloodPact', 'blightTouch', 'flagellation', 'litany', 'graveOffering', 'bloodletting', 'contagion', 'cullTheWeak', 'martyrBlood', 'blightBloom', 'plagueBearer', 'exsanguinate', 'stigmataCard', 'scourge', 'butterflyPlague', 'crimsonRite', 'blightNova', 'bloodHarvest', 'painOffering', 'witheringTouch', 'desperateRite', 'emberTideCard', 'bloodOfferingRite', 'harbingerOfBlightCard', 'blightwardLash', 'progression-blood-censer', 'progression-blight-litany', 'progression-ember-tithe', 'progression-ossuary-cant', 'progression-requiem-brand', 'progression-crown-of-scars'],
};
const TYPE = { force: 'blunt', frost: 'frost', lightning: 'piercing', fire: 'fire', alteration: 'blunt', illusion: 'arcane', divine: 'sacred', decay: 'decay' };
export const combatExpansionCardOverlay = Object.fromEntries(Object.entries(SCHOOL_IDS).flatMap(([school, ids]) => ids.map(id => [id, { school, damageType: TYPE[school] }])));
export const combatExpansionSpellProfiles = {
  staffMagicAttack: { school: 'force', damageType: 'blunt', maneuver: 'casting', reach: 'near' },
  sceptreArcaneAttack: { school: 'force', damageType: 'blunt', maneuver: 'casting', reach: 'near' },
  staffGuard: { school: 'alteration', damageType: 'blunt', maneuver: 'defend', reach: 'contact' },
  sceptreGuard: { school: 'alteration', damageType: 'blunt', maneuver: 'defend', reach: 'contact' },
};
const AREA = new Set(['frostNova', 'meteorSwarm', 'radiantSpray', 'supernova', 'starfallBeam', 'gravityWell', 'pyreOfCharts', 'ashCircle', 'ashfallRite', 'graveOffering', 'contagion', 'scourge', 'butterflyPlague', 'bloodHarvest']);
const FAR = new Set(['starlance', 'starfallBeam', 'celestialLance', 'meteorite', 'meteorSwarm', 'progression-eclipse-lance', 'progression-comet-needle']);
const COUNTERS = {
  umbralWard: { camps: ['physical', 'spell'], reach: ['near', 'far'], targeting: ['single'], ward: 3, poise: 1 },
  wardingStar: { camps: ['spell'], reach: ['contact', 'near', 'far'], targeting: ['single'], ward: 2, poise: 0 },
  'progression-rime-mirror': { camps: ['physical', 'spell'], reach: ['contact', 'near'], targeting: ['single'], ward: 2, poise: 1 },
};
const UPCAST = {
  starstonePebble: { damagePerRank: 2 }, cometFragment: { damagePerRank: 2 },
  frostNova: { damagePerRank: 1, pressurePerRank: 1 }, starSpark: { damagePerRank: 1, pressurePerRank: 1 },
  cinderSigil: { damagePerRank: 2, pressurePerRank: 1 }, crystalBarrier: { blockPerRank: 2 },
  wardingStar: { blockPerRank: 2 }, blightTouch: { damagePerRank: 1, pressurePerRank: 1 },
  contagion: { pressurePerRank: 1 }, hex: { pressurePerRank: 1 },
};
const CHANCE_PRESSURE = new Set(['ashenMote', 'cinderSigil', 'starSpark', 'blightTouch', 'witheringTouch', 'hex']);
const STATUS = { frost: 'frost', burn: 'burn', crimsonBlight: 'crimsonBlight', weak: 'weak', vulnerable: 'vulnerable', bleed: 'bleed', insanity: 'dazed' };
const PROFILE = { frost: 'elemental', burn: 'elemental', crimsonBlight: 'curse', weak: 'mental', vulnerable: 'curse', bleed: 'bodily', insanity: 'mental' };
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
function rewriteTags(def, row, maneuver) {
  const tags = (def.cardTags || def.tags || []).filter(tag => !['camp:', 'school:', 'damage:', 'maneuver:', 'reach:', 'targeting:', 'counter:'].some(prefix => tag.startsWith(prefix)));
  tags.push('camp:spell', `school:${row.school}`, `damage:${row.damageType}`, `reach:${row.reach || (FAR.has(def.id) ? 'far' : 'near')}`, `targeting:${AREA.has(def.id) ? 'area' : 'single'}`);
  if (maneuver) tags.push(`maneuver:${maneuver}`);
  if (COUNTERS[def.id]) tags.push('counter:spell');
  return tags;
}

export function applyCombatExpansionCard(def) {
  def = applyCombatExpansionMartial(def);
  // Each paid Power instance leaves the usable deck for this combat. Its
  // installed status remains active; old runs never enter this projection.
  if (def.type === 'power' && !(def.keywords || []).includes('exhaust')) {
    def = { ...def, keywords: [...(def.keywords || []), 'exhaust'] };
  }
  const row = combatExpansionSpellProfiles[def.equipmentProfileId] || combatExpansionCardOverlay[def.id];
  if (!row) return def;
  const originalTags = def.cardTags || def.tags || [];
  const maneuver = row.maneuver || (COUNTERS[def.id] ? 'counter' : originalTags.find(tag => tag.startsWith('maneuver:'))?.slice(9)
    || (def.type === 'attack' ? 'casting' : null));
  const card = { ...def, tags: rewriteTags(def, row, maneuver), cardTags: rewriteTags(def, row, maneuver),
    damageSchool: 'magic', reach: row.reach || (FAR.has(def.id) ? 'far' : 'near'), targeting: AREA.has(def.id) ? 'area' : 'single',
    attack: { ...def.attack, source: 'spell', damageType: row.damageType }, effects: effectsFor(def.effects, row.school), textTemplate: barrierText(def.textTemplate) };
  if (def.upgrade) card.upgrade = { ...def.upgrade, ...(def.upgrade.effects ? { effects: effectsFor(def.upgrade.effects, row.school) } : {}), ...(def.upgrade.textTemplate ? { textTemplate: barrierText(def.upgrade.textTemplate) } : {}) };
  const damaging = card.effects.some(effect => effect.op === 'damage');
  const rider = { frost: 'frost', fire: 'burn', lightning: 'paralysis', decay: 'crimsonBlight' }[row.school];
  if (damaging && rider && !card.effects.some(effect => effect.op === 'buildup' && effect.status === rider)) {
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
    card.counterCoverage = { camps: counter.camps, reaches: counter.reach, targeting: counter.targeting, effects: ['damage', 'status'] };
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
  return card;
}

const counter = (id, school, { camps = ['spell'], reach = ['contact', 'near', 'far'], targeting = ['single'], poise = 0, ward = 2, cost = 1 } = {}) => ({
  id, name: `${school[0].toUpperCase() + school.slice(1)} Counter`, class: 'colorless', rarity: 'common', cost, manaCost: 1, type: 'skill', keywords: [],
  tags: ['camp:spell', `school:${school}`, `damage:${TYPE[school]}`, 'maneuver:counter', targeting.includes('area') ? 'counter:ranged' : 'counter:spell', 'reach:near', 'targeting:single'],
  reach: 'near', targeting: 'single', counterCoverage: { camps, reaches: reach, targeting, effects: ['damage', 'status'] },
  counterPayload: { hp: 0, ward, poise }, schoolEffect: ward ? 'ward' : 'poise',
  effects: [{ op: 'gainBarrier', target: 'self', amount: 5 }],
  textTemplate: `Gain {gainBarrier} Barrier. Prepare a ${school} Counter: ${ward} Ward${poise ? ` and ${poise} Poise` : ''} return.`,
  upcast: { baseTier: 0, unlockedTiers: [1, 2, 3], maximumTier: 3, blockPerRank: 2 },
});
const cantrip = (id, name, school, damage, status = null, units = 3) => ({
  id, name, class: 'colorless', rarity: 'common', cost: 1, manaCost: 0, type: 'attack', keywords: [],
  tags: ['camp:spell', `school:${school}`, `damage:${TYPE[school]}`, 'maneuver:casting', 'reach:near', 'targeting:single'],
  damageSchool: 'magic', exposureBuildupPerHit: 0, attack: { source: 'spell', damageType: TYPE[school] }, reach: 'near', targeting: 'single',
  effects: [{ op: 'damage', target: 'enemy', amount: damage }, ...(status ? [{ op: 'buildup', target: 'enemy', status, amount: units, camp: 'spell', recoveryProfile: combatProfileForPressure(status), chance: 50 }] : [])],
  textTemplate: `Deal {damage} damage.${status ? ` May add {${status}} ${status} buildup; upcasting improves its chance.` : ''}`,
  upcast: { baseTier: 0, unlockedTiers: [1, 2, 3], maximumTier: 3, damagePerRank: 1, ...(status ? { pressurePerRank: 1, chancePerRank: 25 } : {}) },
});
function combatProfileForPressure(id) { return { sleep: 'mental', crimsonBlight: 'curse', weak: 'mental' }[id] || 'elemental'; }
export const combatExpansionNewCards = [
  counter('frostCounter', 'frost', { camps: ['physical', 'spell'], reach: ['contact', 'near'], poise: 1 }),
  counter('fireCounter', 'fire'), counter('lightningCounter', 'lightning'),
  counter('forceCounter', 'force', { camps: ['physical'], reach: ['near', 'far'], ward: 0, poise: 3 }),
  counter('alterationCounter', 'alteration', { camps: ['physical', 'spell'], ward: 1, poise: 1 }),
  counter('illusionCounter', 'illusion', { camps: ['physical', 'spell'], poise: 1, ward: 1 }),
  counter('divineCounter', 'divine'), counter('decayCounter', 'decay'),
  { ...counter('barrageCounter', 'alteration', { camps: ['physical', 'spell'], targeting: ['area'], reach: ['contact', 'near', 'far'], ward: 1, poise: 1, cost: 2 }), name: 'Barrage Interception' },
  cantrip('rimeNeedle', 'Rime Needle', 'frost', 3, 'frost'),
  cantrip('emberDart', 'Ember Dart', 'fire', 5, 'burn', 4),
  cantrip('staticNeedle', 'Static Needle', 'lightning', 3, 'paralysis'),
  cantrip('forceNudge', 'Force Nudge', 'force', 4),
  cantrip('drowsingMote', 'Drowsing Mote', 'illusion', 2, 'sleep'),
  cantrip('holySpark', 'Holy Spark', 'divine', 4),
  cantrip('rotMote', 'Rot Mote', 'decay', 3, 'crimsonBlight'),
  { id: 'phaseWard', name: 'Phase Ward', class: 'colorless', rarity: 'rare', cost: 2, manaCost: 2, type: 'skill', keywords: ['exhaust'],
    tags: ['camp:spell', 'school:alteration', 'damage:blunt', 'reach:contact', 'targeting:single'],
    effects: [{ op: 'applyStatus', target: 'self', status: 'invulnerability', stacks: 1 }],
    textTemplate: 'Gain {invulnerability} Invulnerability: avoid the next direct damaging action. Status buildup still applies. Exhaust.' },
  { id: 'illusionDecoy', name: 'Illusion Decoy', class: 'colorless', rarity: 'uncommon', cost: 1, manaCost: 1, type: 'skill', keywords: [],
    tags: ['camp:spell', 'school:illusion', 'damage:arcane', 'reach:contact', 'targeting:single'],
    effects: [{ op: 'applyStatus', target: 'self', status: 'decoy', stacks: 1 }],
    textTemplate: 'Gain {decoy} Decoy: avoid a Single Near/Far damaging action. Status buildup still applies; Sweep and Holy reveal it.' },
  { id: 'earthGrounding', name: 'Earth Grounding', class: 'colorless', rarity: 'common', cost: 1, manaCost: 0, type: 'skill', keywords: [],
    tags: ['camp:spell', 'school:alteration', 'damage:blunt', 'reach:contact', 'targeting:single', 'trait:grounded'],
    effects: [{ op: 'applyStatus', target: 'self', status: 'grounded', stacks: 1 }], textTemplate: 'Gain {grounded} Grounded for 2 turns and clear pending Paralysis pressure.' },
  { id: 'restfulDream', name: 'Restful Dream', class: 'colorless', rarity: 'uncommon', cost: 1, manaCost: 1, type: 'skill', keywords: [],
    tags: ['camp:spell', 'school:illusion', 'damage:arcane', 'reach:contact', 'targeting:single'],
    effects: [{ op: 'applyStatus', target: 'self', status: 'sleep', stacks: 1 }], textTemplate: 'Gain {sleep} Sleep: lock ordinary cards and become vulnerable. Rest next turn within the combat healing and Ward caps.' },
  { id: 'sanctuaryCleanse', name: 'Sanctuary Cleanse', class: 'colorless', rarity: 'uncommon', cost: 1, manaCost: 1, type: 'skill', keywords: [],
    tags: ['camp:spell', 'school:divine', 'damage:sacred', 'reach:contact', 'targeting:single'], usableWhile: ['sleep', 'paralysis', 'dazed'],
    effects: [{ op: 'removeStatus', target: 'self', status: 'sleep', amount: 1 }, { op: 'removeStatus', target: 'self', status: 'paralysis', amount: 1 }, { op: 'removeStatus', target: 'self', status: 'dazed', amount: 1 }, { op: 'gainBarrier', target: 'self', amount: 3 }],
    textTemplate: 'Usable through Sleep, Paralysis and Dazed. Cleanse {removeStatus} Sleep, {removeStatus.2} Paralysis and {removeStatus.3} Dazed. Gain {gainBarrier} Barrier.' },
].map(card => ({ ...card, minCombatExpansionVersion: 2 }));
