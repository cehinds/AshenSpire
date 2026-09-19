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

// The roles of an item-owned card (loadout.js ITEM_OWNED_ROLES; spelled here
// because loadout.js would close an import cycle through validate.js).
const ITEM_OWNED_ROLES = Object.freeze(['granted', 'weaponArt']);

/** The kinds of track, and the balance row each reads its curve from. */
export const SKILL_KINDS = Object.freeze(['weapon', 'armour', 'focus', 'dual', 'class']);

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
    tracks.push({ id: node.id, kind: node.id === FOCUS_ITEM_TYPE ? 'focus' : 'weapon', label: node.label });
  }
  for (const cls of (mechanics.weight && mechanics.weight.classes) || []) {
    tracks.push({ id: armourSkillId(cls.id), kind: 'armour', label: `${cls.label || cls.id} armour` });
  }
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
 * `level + 1` costs: round(base × growth^level, roundTo). One shape for every
 * track (proposal §10); the class curve reads balance.skill.class.xp, the
 * rest balance.skill.xp.
 */
export function xpToNext(registries, kind, level) {
  if (!SKILL_KINDS.includes(kind)) throw new Error(`xpToNext: '${kind}' is not a skill kind (${SKILL_KINDS.join(', ')})`);
  const { base, growth, roundTo } = curveFor(registries, kind);
  const step = Number.isInteger(level) && level > 0 ? level : 0;
  const raw = base * Math.pow(growth, step);
  const unit = Number.isInteger(roundTo) && roundTo > 0 ? roundTo : 1;
  return Math.max(unit, Math.round(raw / unit) * unit);
}

/** A fresh ledger: no track has been touched. */
export const emptySkills = () => ({});

/** The level a run holds in a track; 0 for a track it has never touched. */
export function skillLevel(run, skillId) {
  const row = run && run.skills && run.skills[skillId];
  return row && Number.isInteger(row.level) ? row.level : 0;
}

/**
 * awardSkillXp(registries, run, skillId, amount) → { skillId, before, after,
 * levelUps } — writes the ledger and climbs as many steps as the XP buys;
 * each step queues one draft (`pendingDrafts`, which phase 4b spends). A
 * non-positive or non-finite amount writes nothing.
 */
export function awardSkillXp(registries, run, skillId, amount) {
  const kind = skillKindOf(registries, skillId);
  if (!kind) throw new Error(`awardSkillXp: '${skillId}' is not a skill track`);
  if (!run.skills || typeof run.skills !== 'object') run.skills = emptySkills();
  const row = run.skills[skillId] || (run.skills[skillId] = { xp: 0, level: 0, pendingDrafts: 0 });
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.floor(amount) : 0;
  if (gain <= 0) return { skillId, before, after: before, levelUps: 0, upgraded: [] };
  row.xp += gain;
  let cost = xpToNext(registries, kind, row.level);
  while (row.xp >= cost) {
    row.xp -= cost;
    row.level += 1;
    row.pendingDrafts += 1;
    cost = xpToNext(registries, kind, row.level);
  }
  // The auto-upgrade threshold (plan phase 4b) is a STANDING RULE, applied at
  // every write of a track at or past it — not only the crossing — so a card
  // that joined the deck later, and a ledger written before the rule existed,
  // are upgraded at the next award. Idempotent, so the cost of re-asking is
  // one pass over the deck.
  const upgraded = skillUpgradesCards(registries, row.level) ? applySkillUpgrades(registries, run, skillId) : [];
  return { skillId, before, after: row.level, levelUps: row.level - before, upgraded };
}

// ---- drafts, rarity and auto-upgrade (plan phase 4b) ------------------------

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

/** Whether a track at `level` has reached the auto-upgrade threshold. */
export function skillUpgradesCards(registries, level) {
  const at = draftRows(registries).upgradeAt;
  return Number.isInteger(at) && at > 0 && level >= at;
}

/**
 * applySkillUpgrades(registries, run, skillId) → the instance ids upgraded:
 * every ORDINARY deck card carrying one of the track's schools gains
 * `upgraded: true` (proposal §6.1: "skill thresholds auto-upgrade cards
 * tagged with that group"; the shrine keeps the untagged ones). An
 * equipment-bound basic (`sourceArmamentId`) and an item-owned card (a kit,
 * package or weapon-art card) are the piece's: their upgrade is the smith's
 * tier, and stampDeck re-derives it on every restamp, so a flag written here
 * would be gone by the reward door. Idempotent; a card already upgraded is
 * not counted.
 */
export function applySkillUpgrades(registries, run, skillId) {
  const schools = new Set(skillSchools(registries, run.loadout, skillId));
  if (!schools.size || !Array.isArray(run.deck)) return [];
  const cards = registries && registries.cards;
  const out = [];
  for (const inst of run.deck) {
    if (!inst || inst.upgraded || inst.sourceArmamentId || ITEM_OWNED_ROLES.includes(inst.equipmentRole)) continue;
    const def = cards && cards.has(inst.cardId) ? cards.get(inst.cardId) : null;
    if (!def || !(def.tags || []).some((t) => schools.has(t))) continue;
    inst.upgraded = true;
    out.push(inst.instanceId);
  }
  return out;
}

/**
 * reconcileSkillUpgrades(registries, run) → { [skillId]: instanceIds }, the
 * standing rule asked of every track at or past the threshold — the load
 * door's call, for a ledger written before the rule existed (a schema-8 save
 * carries no version for it, and none is needed: the rule is idempotent).
 */
export function reconcileSkillUpgrades(registries, run) {
  const out = {};
  for (const [skillId, row] of Object.entries((run && run.skills) || {})) {
    if (!row || !skillUpgradesCards(registries, row.level) || !skillKindOf(registries, skillId)) continue;
    const ids = applySkillUpgrades(registries, run, skillId);
    if (ids.length) out[skillId] = ids;
  }
  return out;
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
    for (const key of Object.keys(row)) if (!['xp', 'level', 'pendingDrafts'].includes(key)) problems.push(`skills.${id}.${key} is not a ledger field`);
  }
  return problems;
}
