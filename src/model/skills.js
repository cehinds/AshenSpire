import { progressionFeats, progressionFeatUnlocks } from '../content/progression/feats.js';
import { progressionUnlocks } from '../content/progression/unlocks.js';
import { isAbilitySkill, SPELLCRAFT_SKILL, MANEUVERS_SKILL } from './abilityGrades.js';
import { expandedProgression, queueClassMilestone } from './classMilestones.js';
// src/model/skills.js — the skill ledger and its one curve (plan phase 4a,
// proposal §6.1). A track per weapon group, per armour weight class, one for
// the focus group, one for dual-wielding and one per class; every track
// climbs the same curve shape, so one simulator probe measures them all.
//
// THE TRACKS ARE DERIVED, NEVER LISTED: the weapon and focus tracks are the
// itemType nodes of the tree (content/source/nodes.csv), the armour tracks
// are the framework's weight classes (content/framework/mechanics.json), the
// class tracks are the class registry. Author a new item type or a class and
// its track exists; there is no second list to keep in step.
//
// THE NUMBERS ARE balance.skill's: base, growth and roundTo for the shape,
// the award sizes for the engine's hooks (engine/skillXp.js). Nothing here
// carries a number of its own.

import { mechanics } from '../framework/data/mechanics.js';
import { activeIn, HAND_SLOT_IDS } from './zones.js';
import { xpStepCost } from './xpCurve.js';
import { classSkillFeats } from '../content/classSkillFeats.js';
import { hasClassMastery, claimRunClassMastery, masteryProfileFor } from './classMasteryRun.js';
import { classMastery } from '../content/generated/classMastery.js';
import { masteryRowId } from './classMastery.js';
import { skillFeats } from '../content/skillFeats.js';

// The roles of an item-owned card (loadout.js ITEM_OWNED_ROLES; spelled here
// because loadout.js would close an import cycle through validate.js).
const ITEM_OWNED_ROLES = Object.freeze(['granted', 'weaponArt']);

/** The kinds of track, and the balance row each reads its curve from. */
export const SKILL_KINDS = Object.freeze(['weapon', 'armour', 'focus', 'ability', 'dual', 'class']);

const FOCUS_ITEM_TYPE = 'item:magic-focus';
const ARMOUR_ITEM_TYPE = 'item:armor';
export const DUAL_WIELD_SKILL = 'dualWield';

/** The armour track a weight class id names. */
export const armourSkillId = (weightClassId) => `armour:${weightClassId}`;
/** The class track a class id names. */
export const classSkillId = (classId) => `class:${classId}`;

/**
 * skillTracks(registries) → [{ id, kind, label }], in a stable order: the
 * weapon groups as the tree lists them, the focus group, the armour classes
 * light to heavy, dual-wield, then the classes.
 */
export function skillTracks(registries) {
  const nodes = Array.isArray(registries && registries.nodes) ? registries.nodes : [];
  const tracks = [];
  for (const node of nodes) {
    if (node.parentId !== 'itemType' || node.id === ARMOUR_ITEM_TYPE) continue;
    tracks.push({ id: node.id, kind: node.id === FOCUS_ITEM_TYPE ? 'focus' : 'weapon', label: node.id === FOCUS_ITEM_TYPE ? 'Spellcraft' : node.label });
  }
  for (const cls of (mechanics.weight && mechanics.weight.classes) || []) {
    tracks.push({ id: armourSkillId(cls.id), kind: 'armour', label: `${cls.label || cls.id} armour` });
  }
  tracks.push({ id: MANEUVERS_SKILL, kind: 'ability', label: 'Combat Maneuvers' });
  tracks.push({ id: DUAL_WIELD_SKILL, kind: 'dual', label: 'Dual-wield' });
  // Runtime registries hand the classes as a registry, the content bundle
  // (validate.js) as the authored array; both are the same rows.
  const classes = registries && Array.isArray(registries.classes) ? registries.classes
    : registries && registries.classes && typeof registries.classes.all === 'function' ? registries.classes.all() : [];
  for (const cls of classes) tracks.push({ id: classSkillId(cls.id), kind: 'class', label: cls.name || cls.id });
  return tracks;
}

/** The kind a track id belongs to, or null when no track has that id. */
export function skillKindOf(registries, skillId) {
  const track = skillTracks(registries).find((t) => t.id === skillId);
  return track ? track.kind : null;
}

function curveFor(registries, kind) {
  const skill = (((registries || {}).balance || {}).skill) || {};
  const row = kind === 'class' ? (skill.class && skill.class.xp) : skill.xp;
  if (!row) throw new Error(`balance.skill${kind === 'class' ? '.class' : ''}.xp is not authored — the ${kind} curve has no numbers`);
  return row;
}

/**
 * xpToNext(registries, kind, level) → the XP the step from `level` to
 * `level + 1` costs: linear base + level × base × scaler, or exponential
 * round(base × growth^level, roundTo) (the shipped default). One shape for every
 * track (proposal §10); the class curve reads balance.skill.class.xp, the
 * rest balance.skill.xp.
 */
export function xpToNext(registries, kind, level) {
  if (!SKILL_KINDS.includes(kind)) throw new Error(`xpToNext: '${kind}' is not a skill kind (${SKILL_KINDS.join(', ')})`);
  const step = Number.isInteger(level) && level > 0 ? level : 0;
  // Legacy skill/class curves rounded without the character curve's epsilon.
  // Preserve those saved thresholds; new linear curves share the new rounding.
  if ((kind === 'ability' || kind === 'focus') && registries.progressionEnabled) {
    const rule = registries.balance.progression.ability;
    return rule.base + Math.max(0, step - 1) * rule.growthPerLevel;
  }
  return xpStepCost(curveFor(registries, kind), step, { exponentialEpsilon: 0 });
}

/**
 * skillMaxLevel(registries, kind) → the level a track stops at
 * (`balance.skill.xp.maxLevel`, the class track's `balance.skill.class.xp.maxLevel`),
 * or null for no ceiling. XP past it stays on the ledger.
 */
export function skillMaxLevel(registries, kind) {
  const cap = (kind === 'ability' || kind === 'focus') && registries.progressionEnabled ? registries.balance.progression.ability.maxLevel : curveFor(registries, kind === 'ability' ? 'weapon' : kind).maxLevel;
  return Number.isInteger(cap) && cap > 0 ? cap : null;
}
const belowCap = (registries, kind, level) => {
  const cap = skillMaxLevel(registries, kind);
  return cap == null || level < cap;
};

/** A fresh ledger: no track has been touched. */
export const emptySkills = () => ({});

/** The level a run holds in a track; 0 for a track it has never touched. */
export function skillLevel(run, skillId) {
  const row = run && run.skills && run.skills[skillId];
  return row && Number.isInteger(row.level) ? row.level : 0;
}

/**
 * awardSkillXp(registries, run, skillId, amount) → { skillId, before, after,
 * levelUps, gained } — writes the ledger and climbs as many steps as the XP
 * buys; `gained` is the XP actually paid, the receipt a caller shows the
 * player (ui/screens/reward.js's progression panel reads it through main.js);
 * each step queues one draft (`pendingDrafts`, which phase 4b spends). A
 * non-positive or non-finite amount writes nothing.
 *
 * A level no longer upgrades cards: the `upgradeAt` standing rule is retired
 * for card ranks (SPEC §13.4o), which a level's rank-up raises one at a time.
 */
export function awardSkillXp(registries, run, skillId, amount) {
  const kind = skillKindOf(registries, skillId);
  if (!kind) throw new Error(`awardSkillXp: '${skillId}' is not a skill track`);
  if (!run.skills || typeof run.skills !== 'object') run.skills = emptySkills();
  if (expandedProgression(run) && isAbilitySkill(skillId) && amount > 0) activateAbilitySkill(run, skillId);
  const row = run.skills[skillId] || (run.skills[skillId] = { xp: 0, level: 0, pendingDrafts: 0 });
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.floor(amount) : 0;
  if (gain <= 0) return { skillId, before, after: before, levelUps: 0, gained: 0 };
  row.xp += gain;
  let cost = xpToNext(registries, kind, row.level);
  while (belowCap(registries, kind, row.level) && row.xp >= cost) {
    if (kind === 'class' && hasClassMastery(run)) run.classMasteryState.spentXp[skillId.slice(6)] += cost;
    row.xp -= cost;
    row.level += 1;
    row.pendingDrafts += 1;
    if (!(expandedProgression(run) && isAbilitySkill(skillId))) queueRankUp(kind, row);
    if (!(expandedProgression(run) && kind === 'class')) { queueAttributePick(registries, skillId, row); queueSkillFeat(registries, skillId, row); }
    cost = xpToNext(registries, kind, row.level);
  }
  const skillAwards = [];
  if (kind === 'class' && row.level > before) {
    claimRunClassMastery(registries, run);
    for (let level = before + 1; level <= row.level; level++) skillAwards.push(...payClassMilestone(registries, run, skillId.slice(6), level));
  }
  return { skillId, before, after: row.level, levelUps: row.level - before, gained: gain, skillAwards };
}

/** Count the levels already paid for by a track, without advancing its ledger. */
export function pendingSkillLevelCount(registries, run, skillId) {
  const kind = skillKindOf(registries, skillId);
  const row = run && run.skills && run.skills[skillId];
  if (!kind || !row) return 0;
  let xp = row.xp;
  let level = row.level;
  let count = 0;
  while (belowCap(registries, kind, level) && xp >= xpToNext(registries, kind, level)) {
    xp -= xpToNext(registries, kind, level);
    level += 1;
    count += 1;
  }
  return count;
}

/** Pay XP now; the player's Level Up! action advances the skill later. */
export function bankSkillXp(registries, run, skillId, amount) {
  const kind = skillKindOf(registries, skillId);
  if (!kind) throw new Error(`bankSkillXp: '${skillId}' is not a skill track`);
  if (!run.skills || typeof run.skills !== 'object') run.skills = emptySkills();
  if (expandedProgression(run) && isAbilitySkill(skillId) && amount > 0) activateAbilitySkill(run, skillId);
  const row = run.skills[skillId] || (run.skills[skillId] = { xp: 0, level: 0, pendingDrafts: 0 });
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  row.xp += gain;
  return { skillId, before, after: before, levelUps: 0, pendingLevelUps: pendingSkillLevelCount(registries, run, skillId), gained: gain };
}

/** Claim exactly one paid-for skill level, retaining excess XP and queuing its reward. */
export function claimBankedSkillLevel(registries, run, skillId) {
  const owner = run;
  if (hasClassMastery(run) && skillId.startsWith('class:')) run = { ...run, skills: structuredClone(run.skills), classMasteryState: structuredClone(run.classMasteryState), ...(expandedProgression(run) ? {classMilestones:structuredClone(run.classMilestones || {})} : {}) };
  const kind = skillKindOf(registries, skillId);
  const row = run && run.skills && run.skills[skillId];
  if (!kind || !row || !belowCap(registries, kind, row.level)) return null;
  const cost = xpToNext(registries, kind, row.level);
  if (row.xp < cost) return null;
  const before = row.level;
  if (kind === 'class' && hasClassMastery(run)) run.classMasteryState.spentXp[skillId.slice(6)] += cost;
  row.xp -= cost;
  row.level += 1;
  row.pendingDrafts += 1;
  if (!(expandedProgression(run) && isAbilitySkill(skillId))) queueRankUp(kind, row);
  if (!(expandedProgression(run) && kind === 'class')) { queueAttributePick(registries, skillId, row); queueSkillFeat(registries, skillId, row); }
  const skillAwards = kind === 'class' ? payClassMilestone(registries, run, skillId.slice(6), row.level) : [];
  if (kind === 'class') claimRunClassMastery(registries, run);
  if (owner !== run) { owner.skills = run.skills; owner.classMasteryState = run.classMasteryState; if (expandedProgression(run)) owner.classMilestones = run.classMilestones; }
  return { skillId, before, after: row.level, levelUps: 1, gained: 0, skillAwards };
}

// ---- drafts and rarity (plan phase 4b) ---------------------------------------

/**
 * rollDraftRank(registries, rng, level) → the rank a drafted card arrives at
 * (SPEC §13.4o): 1 to min(level, balance.skill.rankMax), each rank r weighted
 * r, so a high rank comes up more often the higher the track — rank 5 is a
 * third of a level-5 draft, rank 1 a fifteenth. On the `cardRewards` stream,
 * so a seeded run rolls the same ranks.
 */
export function rollDraftRank(registries, rng, level) {
  const max = Math.max(1, Math.min(Number.isInteger(level) ? level : 1, draftRows(registries).rankMax || 1));
  if (max === 1 || !rng) return 1;
  let pick = rng.int('cardRewards', 1, (max * (max + 1)) / 2);
  for (let rank = 1; rank <= max; rank += 1) {
    if (pick <= rank) return rank;
    pick -= rank;
  }
  return max;
}

function draftRows(registries) {
  return (((registries || {}).balance || {}).skill) || {};
}

/**
 * skillSchools(registries, loadout, skillId) → the card schools a track
 * drafts from, DERIVED, no second table: a weapon or focus track reads the
 * card-domain tags the HELD pieces of that item type carry in tagging.csv (a
 * greatsword: blade, heavy; a straight sword: blade, basic); dualWield reads
 * both hands; a type no hand holds has no schools — the draft waits until
 * one is held (a union over every piece of the type would hand a swordless
 * blade track guard and blood cards); armour and class tracks have no
 * schools (nothing to draft until phase 5b's tree). "The sword you levelled
 * drafts sword cards."
 */
export function skillSchools(registries, loadout, skillId) {
  const kind = skillKindOf(registries, skillId);
  if (kind !== 'weapon' && kind !== 'focus' && kind !== 'dual') return [];
  const schools = new Set((Array.isArray(registries && registries.nodes) ? registries.nodes : [])
    .filter((n) => n.parentId === 'card').map((n) => n.id));
  const armaments = (((registries || {}).equipment || {}).armaments) || [];
  // The hands, read through the zones leaf (loadout.js would close an import
  // cycle through validate.js): a track's cards come from what the hands hold.
  const held = Object.values(HAND_SLOT_IDS).map((slotId) => activeIn(loadout, slotId))
    .map((id) => (id ? armaments.find((a) => a.id === id) : null)).filter(Boolean);
  const ofType = (piece) => (piece.itemTypeTags || []).includes(skillId);
  const pieces = kind === 'dual' ? held : held.filter(ofType);
  const out = [];
  for (const piece of pieces) {
    for (const tag of piece.tags || []) if (schools.has(tag) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/**
 * rarityUnlockedAt(registries, level) → the rarities a track at `level` may
 * draft: every row of balance.skill.rarityUnlock whose threshold the level
 * has reached. Level 0 unlocks nothing — a draft is a level's reward.
 */
export function rarityUnlockedAt(registries, level) {
  const unlock = draftRows(registries).rarityUnlock || {};
  return Object.keys(unlock).filter((rarity) => Number.isInteger(unlock[rarity]) && level >= unlock[rarity]);
}

/**
 * spendSkillDraft(run, skillId) → true when a queued draft was spent. The
 * reward door's one write to the ledger's draft count.
 */
export function spendSkillDraft(run, skillId) {
  const row = run && run.skills && run.skills[skillId];
  if (!row || !(row.pendingDrafts > 0)) return false;
  row.pendingDrafts -= 1;
  return true;
}

// ---- the rank-up (SPEC §13.4o B2b) ------------------------------------------

// The tracks whose levels raise a card: the ones that draft from card schools.
const RANK_UP_KINDS = Object.freeze(['weapon', 'focus', 'dual']);
/** Whether a track of this kind queues a rank-up at each level. */
export const rankUpKind = (kind) => RANK_UP_KINDS.includes(kind);

/**
 * Whether reaching `level` on a track of this kind queues a rank-up: every
 * level of a card-school track from 2 on — a card's rank never passes its
 * track's level, so at level 1 there is nothing a rank-up could raise.
 */
export const levelQueuesRankUp = (kind, level) => rankUpKind(kind) && level >= 2;

// Each level of a card-school track queues one rank-up beside its draft.
function queueRankUp(kind, row) {
  if (levelQueuesRankUp(kind, row.level)) row.pendingRankUps = (row.pendingRankUps || 0) + 1;
}

/**
 * rankUpCandidates(registries, run, skillId) → the owned card instances (deck,
 * then sideboard) a rank-up of that track may raise: an ordinary card of the
 * track's schools whose rank is below both the track's level and
 * balance.skill.rankMax. An equipment-bound basic or an item-owned card is the
 * piece's (its upgrade is the smith's tier) and is not offered.
 */
export function rankUpCandidates(registries, run, skillId) {
  const schools = new Set(skillSchools(registries, run && run.loadout, skillId));
  const ceiling = Math.min(skillLevel(run, skillId), draftRows(registries).rankMax || 1);
  if (!schools.size || ceiling < 2) return [];
  const cards = registries && registries.cards;
  return [...((run && run.deck) || []), ...(Array.isArray(run && run.sideboard) ? run.sideboard : [])].filter((inst) => {
    if (!inst || inst.sourceArmamentId || ITEM_OWNED_ROLES.includes(inst.equipmentRole)) return false;
    const def = cards && cards.has(inst.cardId) ? cards.get(inst.cardId) : null;
    if (!def || !(def.tags || []).some((t) => schools.has(t))) return false;
    return (Number.isInteger(inst.rank) && inst.rank >= 1 ? inst.rank : 1) < ceiling;
  });
}

/**
 * raiseCardRank(registries, run, skillId, instanceId) → the instance raised by
 * one rank, spending one queued rank-up; null (and nothing written) when the
 * ledger holds none or the card is not a candidate.
 */
export function raiseCardRank(registries, run, skillId, instanceId) {
  const row = run && run.skills && run.skills[skillId];
  if (!row || !(row.pendingRankUps > 0)) return null;
  const inst = rankUpCandidates(registries, run, skillId).find((card) => card.instanceId === instanceId);
  if (!inst) return null;
  row.pendingRankUps -= 1;
  inst.rank = (Number.isInteger(inst.rank) && inst.rank >= 1 ? inst.rank : 1) + 1;
  return inst;
}

// ---- the every-5th-level flat (SPEC §13.4o) ----------------------------------

/**
 * skillBonusFor(registries, run, inst) → the flat a card earns from the run's
 * skill levels: the SUM, over every card-school track whose schools (the held
 * pieces') the card's tags meet, of floor(level / balance.skill.flatEvery) —
 * a card of several tracks earns each (owner ruling, 2026-10-05). Every owned
 * card counts, equipment-bound and item-owned ones too: the flat is not an
 * upgrade. Capped at MAX_SKILL_BONUS, so no setting can stamp a value a save
 * refuses.
 */
export const MAX_SKILL_BONUS = 99;
export function skillBonusFor(registries, run, inst, schoolsByTrack = trackSchools(registries, run)) {
  const def = inst && registries.cards.has(inst.cardId) ? registries.cards.get(inst.cardId) : null;
  if (!def) return 0;
  const tags = def.tags || [];
  let bonus = 0;
  for (const { flat, schools } of schoolsByTrack) if (tags.some((tag) => schools.has(tag))) bonus += flat;
  return Math.min(bonus, MAX_SKILL_BONUS);
}

// The tracks that earn a flat now, with their schools: read once per stamp.
function trackSchools(registries, run) {
  const every = draftRows(registries).flatEvery;
  if (!Number.isInteger(every) || every < 1) return [];
  const out = [];
  for (const [skillId, row] of Object.entries((run && run.skills) || {})) {
    const flat = row && Number.isInteger(row.level) ? Math.floor(row.level / every) : 0;
    if (!flat || !rankUpKind(skillKindOf(registries, skillId))) continue;
    const schools = new Set(skillSchools(registries, run.loadout, skillId));
    if (schools.size) out.push({ flat, schools });
  }
  return out;
}

/**
 * passiveBlockFor(registries, run, inst) → the Block the run's passive tags
 * add to a card (SPEC §13.4o "Passive tag effects"): the sum of `passive.block`
 * over the taken skill feats whose tags the card's meet. It is stamped by tags
 * alone: where it lands is the RESOLVED face's business (`registries.js
 * applyPassiveBlock`, the first unconditional Block after upgrade, mods and
 * school), so a card that gains a Block on upgrade (Enter Bulwark+) gains it
 * too, and one with none is unchanged. Each feat is taken once; a table row
 * that grants a passive again (content C) adds again. Capped at
 * MAX_SKILL_BONUS.
 */
export function passiveBlockFor(registries, run, inst) {
  const def = inst && registries.cards.has(inst.cardId) ? registries.cards.get(inst.cardId) : null;
  if (!def) return 0;
  const tags = def.tags || [];
  let bonus = 0;
  for (const feat of (Array.isArray(run && run.skillFeats) ? run.skillFeats : []).map(skillFeatById)) {
    const passive = feat && feat.passive;
    if (passive && Number.isInteger(passive.block) && passive.tags.some((tag) => tags.includes(tag))) bonus += passive.block;
  }
  return Math.min(bonus, MAX_SKILL_BONUS);
}

/**
 * stampSkillBonuses(registries, run) → how many cards changed: writes each
 * owned card's `skillBonus` and `passiveBlock` (deck, then sideboard),
 * deleting each at 0. Both are DERIVED — from skill levels, the held pieces'
 * schools and the feats taken — so they are stamped at every door that can
 * move them: each save, each combat start and each full restamp, the way
 * equipment numbers are.
 */
export function stampSkillBonuses(registries, run) {
  if (!run || !Array.isArray(run.deck)) return 0;
  const schoolsByTrack = trackSchools(registries, run);
  let changed = 0;
  for (const inst of [...run.deck, ...(Array.isArray(run.sideboard) ? run.sideboard : [])]) {
    if (!inst) continue;
    const bonus = schoolsByTrack.length ? skillBonusFor(registries, run, inst, schoolsByTrack) : 0;
    const block = passiveBlockFor(registries, run, inst);
    if ((inst.skillBonus || 0) === bonus && (inst.passiveBlock || 0) === block) continue;
    if (bonus) inst.skillBonus = bonus; else delete inst.skillBonus;
    if (block) inst.passiveBlock = block; else delete inst.passiveBlock;
    changed += 1;
  }
  return changed;
}

// ---- the every-4th-level attribute pick (SPEC §13.4o) ------------------------

/**
 * linkedAttributes(registries, skillId) → the attribute ids a track's pick
 * offers (`balance.skill.linkedAttributes`, data: Blade STR/DEX, Shield
 * STR/DEX/CON/WIS, Magic DEX/CON/WIS/INT); [] for a track with none authored.
 */
export function linkedAttributes(registries, skillId) {
  if (registries.progressionEnabled && skillId.startsWith('class:')) return (registries.balance.progression.classAttributes[skillId.slice(6)] || []).slice();
  const table = draftRows(registries).linkedAttributes || {};
  return Array.isArray(table[skillId]) ? table[skillId].slice() : [];
}

/** Whether reaching `level` on this track queues an attribute pick. */
export function levelQueuesAttributePick(registries, skillId, level) {
  if (registries.progressionEnabled && skillId.startsWith('class:')) return registries.balance.progression.cadence.attribute.includes(level);
  const every = draftRows(registries).attributeEvery;
  return Number.isInteger(every) && every > 0 && level > 0 && level % every === 0 && linkedAttributes(registries, skillId).length > 0;
}

function queueAttributePick(registries, skillId, row) {
  if (levelQueuesAttributePick(registries, skillId, row.level)) row.pendingAttributePicks = (row.pendingAttributePicks || 0) + 1;
}

/** spendAttributePick(run, skillId) → true when a queued pick was spent. */
export function spendAttributePick(run, skillId) {
  const row = run && run.skills && run.skills[skillId];
  if (!row || !(row.pendingAttributePicks > 0)) return false;
  row.pendingAttributePicks -= 1;
  return true;
}

// ---- the every-2nd-level skill feat (SPEC §13.4o) ----------------------------

/** A skill feat by id, or null. */
export const skillFeatById = (id, registries = null) => [...skillFeats, ...(registries?.classSkillFeats || [...classSkillFeats,...progressionFeats])].find((feat) => feat.id === id) || null;
/** The feats a track authors (content/skillFeats.js), in authored order. */
export const trackSkillFeats = (skillId, mastery = false, registries = null) => [...skillFeats, ...(mastery ? registries?.classSkillFeats || [...classSkillFeats,...progressionFeats] : [])].filter((feat) => feat.skillId === skillId);

/** Whether reaching `level` on this track queues a feat pick: every featEvery levels of a track that authors any. */
export function levelQueuesSkillFeat(registries, skillId, level) {
  if (registries.progressionEnabled && skillId.startsWith('class:')) return registries.balance.progression.cadence.feat.includes(level);
  const every = draftRows(registries).featEvery;
  return Number.isInteger(every) && every > 0 && level > 0 && level % every === 0 && trackSkillFeats(skillId, !!registries.masteryRun).length > 0;
}

function queueSkillFeat(registries, skillId, row) {
  if (levelQueuesSkillFeat(registries, skillId, row.level)) row.pendingSkillFeats = (row.pendingSkillFeats || 0) + 1;
}

/** skillFeatOptions(run, skillId, level) → the track's feats open at `level` the run has not taken. */
export function skillFeatOptions(run, skillId, level, registries = null) {
  const taken = new Set(Array.isArray(run && run.skillFeats) ? run.skillFeats : []);
  return trackSkillFeats(skillId, hasClassMastery(run), registries).filter((feat) => {
    if (taken.has(feat.id)) return false;
    const gate = (registries?.classMastery || (expandedProgression(run) ? [...progressionUnlocks,...progressionFeatUnlocks] : classMastery)).find(row => row.kind === 'feat' && row.ref === feat.id);
    // A reward plan previews the level its claim will reach; the commit calls
    // this again with the actual claimed level before spending the pick.
    if (hasClassMastery(run) && gate) return level >= gate.level || (masteryProfileFor(run).classMastery?.[gate.classId]?.unlockedRows || []).includes(masteryRowId(gate));
    return feat.minLevel <= level;
  }).map((feat) => feat.id);
}

/**
 * takeSkillFeat(run, skillId, featId) → true when the feat joined the run: it
 * is the track's, not yet taken, and a pick was queued (which it spends).
 */
export function takeSkillFeat(run, skillId, featId, registries = null) {
  const feat = skillFeatById(featId, registries);
  const row = run && run.skills && run.skills[skillId];
  if (!feat || feat.skillId !== skillId || !row || !(row.pendingSkillFeats > 0)) return false;
  if (hasClassMastery(run) && !skillFeatOptions(run, skillId, row.level, registries).includes(featId)) return false;
  if (Array.isArray(run.skillFeats) && run.skillFeats.includes(featId)) return false;
  row.pendingSkillFeats -= 1;
  run.skillFeats = [...(Array.isArray(run.skillFeats) ? run.skillFeats : []), featId];
  return true;
}

/** critRulesFor(featIds) → the crit rules the run's skill feats grant, for the fight. */
export function critRulesFor(featIds) {
  return (Array.isArray(featIds) ? featIds : []).map(skillFeatById).filter((feat) => feat && feat.crit).map((feat) => structuredClone(feat.crit));
}

/**
 * skillsProblems(skills) → the shape's refusals, by name. Registry-free, as
 * the save door must be: a track id the registries no longer know is a stale
 * ledger row, not a malformed one, and stays.
 */
export function skillsProblems(skills) {
  const problems = [];
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) return ['skills must be an object keyed by track id'];
  for (const [id, row] of Object.entries(skills)) {
    if (typeof id !== 'string' || !id) { problems.push('skills has a blank track id'); continue; }
    if (!row || typeof row !== 'object' || Array.isArray(row)) { problems.push(`skills.${id} must be { xp, level, pendingDrafts }`); continue; }
    for (const key of ['xp', 'level', 'pendingDrafts']) {
      if (!Number.isInteger(row[key]) || row[key] < 0) problems.push(`skills.${id}.${key} must be a non-negative integer`);
    }
    // The queued rank-ups (SPEC §13.4o), absent on a ledger written before them.
    for (const key of ['pendingRankUps', 'pendingAttributePicks', 'pendingSkillFeats']) {
      if (row[key] !== undefined && !(Number.isInteger(row[key]) && row[key] >= 0)) problems.push(`skills.${id}.${key} must be a non-negative integer`);
    }
    for (const key of Object.keys(row)) if (!['xp', 'level', 'pendingDrafts', 'pendingRankUps', 'pendingAttributePicks', 'pendingSkillFeats'].includes(key)) problems.push(`skills.${id}.${key} is not a ledger field`);
  }
  return problems;
}

export function activateAbilitySkill(run, skillId) {
  if (!isAbilitySkill(skillId)) return false;
  run.skills ||= {};
  const row = run.skills[skillId] ||= { xp: 0, level: 0, pendingDrafts: 0 };
  if (row.level > 0) return false;
  row.level = 1; row.pendingDrafts += 1;
  return true;
}
function payClassMilestone(registries, run, classId, level) {
  if (!expandedProgression(run) || !queueClassMilestone(registries, run, classId, level)) return [];
  return (registries.balance.progression.classSkills[classId] || []).map(skillId => bankSkillXp(registries, run, skillId, registries.balance.progression.skillBonusXp));
}
