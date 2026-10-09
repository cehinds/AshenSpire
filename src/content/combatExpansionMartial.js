import { objectTagIds } from './tags.js';

// Existing ids, rather than display names, own every changed Martial role.
// This projection runs after equipment composition and only for version 2.
const groups = {
  attack: 'strike gorefireSlash serratedBlade rend twinbladeFlurry impale executioner stitchedArms bloodhuntersStrike goreslash flameToBlade bloodTithe ambush rogueShiv quickCut twinPrick hamstringRogue serratedShiv lowBlow cheapShot bladeDanceRogue garrote coupDeGrace sap assassinate thousandCutsRogue deathblow katanaDrawCut twinFang rimeThrust progression-ember-hew progression-furnace-advance progression-shiv-of-ash progression-needle-feint progression-back-alley-cut progression-wire-snare progression-carrion-cut progression-twinshade progression-last-laugh',
  defend: 'defend technique ironResolve enterBulwark shieldwall wardingLunge unbreakable lastStand bracingStance ironVowCard brace setTheShield aegisOfEmbers smokePellet pocketSand smokeVeil vanish misdirect smokeBomb ironSkin quickGuard shieldGuardian guardianBulwark shieldBastion progression-cinder-guard progression-bloodstep progression-warbound-defiance progression-red-standard progression-crown-of-cinders progression-pocket-coil progression-silent-exchange',
  sweep: 'crimsonCleave cleavingBlow hewingArc whirlingGuard sweepingBlow progression-ashen-cleaver',
  smash: 'stomp kickOff ruinousBlow poiseBreaker sunderplate sunderingChop shieldCrash greatswordSunderingHew bashingBlow colossusSmash kilnCleave progression-breaker-s-toll',
  counter: 'shieldBash guardCounter riposte rondelParry bindingParry spikedReprisal progression-crimson-reprisal evasiveGuard dodgeRoll quickstep backstep acrobaticsRogue shadowstep progression-nightstep',
  ranged: 'ricochet fanOfKnives toxicVolley pinningShot arrowVolley aimedShot barbedArrow',
  support: 'enterGorefire rallyingStandard warSurgeon hemorrhage warcry goreblood warriorsVow sanguinePactCard feint pilfer setupRogue disorient afterimageCard bloodletterRogue venomcoat deadlyTempoCard opportunistCard envenomCard executionWindow perfectHeist prepare honedEdge fieldDressing blindingSand hamstring masterOfStrategy enfeeble wound dazed slimed guilt rallyingBanner',
};
export const combatExpansionMartialOverlay = Object.fromEntries(Object.entries(groups)
  .flatMap(([maneuver, ids]) => ids.split(' ').map(id => [id, { maneuver }])));
combatExpansionMartialOverlay.nockAndWait = { maneuver: 'counter', reach: 'near', counterMode: 'ranged' };
// Defensive use still pays and resolves the card's printed effects.
combatExpansionMartialOverlay.whirlingGuard.defensiveReaction = true;
combatExpansionMartialOverlay.sweepingBlow.defensiveReaction = true;
// A wide sweep disrupts footing through authored bodily pressure, rather than
// granting every Sweep an automatic active status. Two base sweeps fill 6.
combatExpansionMartialOverlay.sweepingBlow.buildup = {
  op: 'buildup', target: 'allEnemies', status: 'offBalance', amount: 3,
  camp: 'physical', recoveryProfile: 'bodily',
};
const AREA = new Set(['ricochet', 'fanOfKnives', 'toxicVolley', 'arrowVolley']);
const FAR = new Set(['aimedShot', 'barbedArrow']);
const EVADES = new Set(['evasiveGuard', 'dodgeRoll', 'quickstep', 'backstep', 'acrobaticsRogue', 'shadowstep', 'progression-nightstep']);
const POISE_REPLIES = { shieldBash: 4, riposte: 4, rondelParry: 4, bindingParry: 3, spikedReprisal: 5,
  'progression-crimson-reprisal': 5, evasiveGuard: 2, backstep: 3, acrobaticsRogue: 3,
  shadowstep: 4, 'progression-nightstep': 4, nockAndWait: 3 };
// These are the authored, ungraded v2 source amounts. Permanent primary
// damage improvements become Poise improvements on zero-HP Counters; they
// never restore HP retaliation. Conditional grade effects keep their gates.
const REPLY_SOURCE_BASE = {
  shieldBash: { damage: 3, poise: 0 }, riposte: { damage: 4, poise: 0 },
  rondelParry: { damage: 0, poise: 5 }, bindingParry: { damage: 0, poise: 0 },
  spikedReprisal: { damage: 4, poise: 0 }, 'progression-crimson-reprisal': { damage: 5, poise: 0 },
  evasiveGuard: { damage: 0, poise: 0 }, backstep: { damage: 0, poise: 0 },
  acrobaticsRogue: { damage: 0, poise: 0 }, shadowstep: { damage: 0, poise: 0 },
  'progression-nightstep': { damage: 0, poise: 0 }, nockAndWait: { damage: 0, poise: 0 },
};
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
const UPCAST = {
  shieldBash: { blockPerRank: 2, poisePerRank: 1 }, bashingBlow: { damagePerRank: 2, poisePerRank: 1 },
  stomp: { damagePerRank: 2, poisePerRank: 1 }, ironSkin: { blockPerRank: 2 },
  guardCounter: { damagePerRank: 2 }, quickstep: { damagePerRank: 2, blockPerRank: 2 },
};
const STATUS = { bleed: 'bodily', venom: 'bodily', weak: 'mental', vulnerable: 'curse', burn: 'elemental', frost: 'elemental' };
function pressureEffects(effects = []) {
  return effects.filter(effect => effect.op !== 'dodgeRoll').map(effect => {
    if (effect.op !== 'applyStatus' || !STATUS[effect.status] || !['enemy', 'allEnemies', 'target'].includes(effect.target)) return structuredClone(effect);
    const { stacks, ...rest } = effect;
    return { ...rest, op: 'buildup', camp: 'physical', recoveryProfile: STATUS[effect.status],
      amount: typeof stacks === 'number' ? stacks * 4 : { f: 'mul', args: [stacks ?? 1, 4] } };
  });
}
function tagsFor(tags, row, reach, targeting) {
  const preserved = tags.filter(tag => !['maneuver:', 'reach:', 'targeting:', 'counter:'].some(prefix => tag.startsWith(prefix)));
  if (row.maneuver !== 'support') preserved.push(`maneuver:${row.maneuver}`);
  preserved.push(`reach:${reach}`, `targeting:${targeting}`);
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
  const reach = def.reach || role.reach || (FAR.has(def.id) ? 'far' : role.maneuver === 'ranged' ? 'near' : 'contact');
  const targeting = def.targeting || (role.maneuver === 'sweep' || AREA.has(def.id) ? 'area' : 'single');
  const rewritten = tagsFor(tags, role, reach, targeting);
  const card = { ...def, tags: rewritten, cardTags: rewritten, reach, targeting,
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
  if (role.maneuver === 'ranged') card.projectile = true;
  if (role.maneuver === 'counter') {
    if (def.id === 'shieldBash') {
      card.effects.unshift({ op: 'block', target: 'self', amount: 5 });
      card.ratingId = 'dr';
    }
    card.counterCoverage = { camps: ['physical'], reaches: [role.counterMode === 'ranged' ? 'near' : 'contact', ...(role.counterMode === 'ranged' ? ['far'] : [])],
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
