// Smith receipts for a configured Core profile (Core 2: gear.armorBudget).
//
// Core cards never go through resolveCard's tier rows, so the legacy
// content/source/itemUpgradeChanges.csv deltas (attack +3, guard +3...) are not what
// an upgrade does there. What it does: a weapon adds weaponARPerTier AR; armor and
// shields add armorBudget.perRank stat-budget points. Every number below is read from
// that same pipeline (the gear resolver, the rating receipt, and the live combat card
// preview), so the receipt cannot disagree with the fight.
import { gameModule, gameContent } from './gameProfile.js';
import { resolveGearItem } from '../../engine/kernel/gameConfig.js';
import { createRunCombat } from '../engine/runCombat.js';
import { previewCard } from '../engine/combat.js';
import { createRng } from '../engine/rng.js';
import { resolveCombatCard } from '../engine/combatExpansion.js';
import { itemRefIdentity } from './itemUpgrades.js';

const STAT_ORDER = ['ar', 'dr', 'poise', 'ward', 'hp', 'mp', 'sp', 'evasion', 'precision',
  'strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const STAT_LABELS = {
  ar: 'AR', dr: 'DR', poise: 'Poise', ward: 'Ward', hp: 'HP', mp: 'MP', sp: 'SP', evasion: 'Evasion', precision: 'Precision',
  strength: 'STR', dexterity: 'DEX', constitution: 'CON', wisdom: 'WIS', intelligence: 'INT',
};
const CARD_VALUES = [
  { op: 'damage', label: 'Damage', rating: 'AR' },
  { op: 'block', label: 'Block', rating: 'DR' },
];

/** True when this run's Smith upgrades follow the Core 2 gear pipeline. */
export function coreSmithingActive(run) {
  const gear = gameModule(run, 'gear');
  return gear?.mode === 'configured' && !!gear.armorBudget && gameModule(run, 'stats')?.mode === 'configured';
}

function gearItemFor(run, itemRef) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || identity.itemKind === 'relic') return null;
  const armor = identity.itemKind === 'armor';
  return (gameContent(run, 'gear') || []).find((item) => (item.source?.id || item.id) === identity.itemId
    && (item.kind === 'armor') === armor && (!item.classes || !run.class || item.classes.includes(run.class))) || null;
}

/** The item's own stat points and values at a tier, exactly as the equipped-gear receipt resolves them. */
function itemAtTier(run, item, level) {
  const settings = gameModule(run, 'gear');
  const resolved = resolveGearItem(item, settings, { rank: (item.rank ?? 1) + level });
  const values = { ...resolved.values };
  // A weapon (or staff) keeps its pool and adds weaponARPerTier AR per tier, as the rating receipt does.
  if (item.kind !== 'armor' && item.kind !== 'shield') {
    values.ar += level * (gameModule(run, 'equipment')?.upgradeBonuses?.weaponARPerTier || 0);
  }
  const points = Object.values(resolved.points).reduce((sum, n) => sum + n, 0) + resolved.tagCost;
  return { values, points, budget: resolved.budget };
}

function isEquipped(run, itemRef) {
  const identity = itemRefIdentity(itemRef);
  const sets = run.loadout?.sets || {};
  return Object.entries(sets).some(([slot, ids]) => {
    const id = ids[run.loadout.active?.[slot] || 0];
    return id === identity.itemId && (slot === 'armor') === (identity.itemKind === 'armor');
  });
}

// The run's levels with one item moved to `level`. The item's own current level is left as the run has it,
// so the "before" fight is the same cached fight for every candidate.
function levelsWith(run, itemRef, level) {
  const current = run.itemUpgradeLevels || {};
  return (current[itemRef] || 0) === level ? { ...current } : { ...current, [itemRef]: level };
}

const memo = new Map();
function memoized(run, parts, compute) {
  let key = null;
  try { key = JSON.stringify([run.gameProfile?.hash, { ...run, gameProfile: undefined, itemUpgradeLevels: undefined }, parts]); } catch { key = null; }
  if (key !== null && memo.has(key)) return memo.get(key);
  const value = compute();
  if (key !== null) {
    if (memo.size >= 12) memo.delete(memo.keys().next().value);
    memo.set(key, value);
  }
  return value;
}

/** Distinct deck cards' live damage and block (the combat card face's preview) with the item at a tier. */
function liveCardValues(registries, run, itemRef, level) {
  const levels = levelsWith(run, itemRef, level);
  return memoized(run, levels, () => {
    const enemyId = registries.enemies?.ids?.()[0];
    if (!enemyId) return new Map();
    const staged = { ...run, itemUpgradeLevels: levels };
    const combat = createRunCombat({ registries, run: staged, rng: createRng(17), enemyIds: [enemyId] });
    const rows = new Map();
    for (const pile of ['hand', 'draw', 'discard']) for (const instance of combat.piles[pile]) {
      // Copies of one card can differ (mods, upgraded, rank...): each distinct face is its own row.
      const { instanceId, ...face } = instance;
      const key = `${instance.cardId}|${JSON.stringify(face)}`;
      const row = rows.get(key);
      if (row) { row.copies++; continue; }
      // A card with no damage or block effect cannot change; skip its (costly) detached preview.
      const def = resolveCombatCard(combat, instance);
      if (!(def.effects || []).some((effect) => CARD_VALUES.some(({ op }) => op === effect.op))) { rows.set(key, { cardId: instance.cardId, name: def.name, copies: 1, values: {} }); continue; }
      const preview = previewCard(combat, instance.instanceId);
      rows.set(key, { cardId: instance.cardId, name: preview.name, copies: 1,
        values: Object.fromEntries(CARD_VALUES.map(({ op }) => [op, preview.values.find((value) => value.op === op)?.value])) });
    }
    return rows;
  });
}

/** The item's own rows for one tier step: stat points, budget and ratings. Cheap (no combat). */
export function coreSmithingStats(run, itemRef, currentLevel, nextLevel) {
  const item = gearItemFor(run, itemRef);
  if (!item) return [];
  const before = itemAtTier(run, item, currentLevel), after = itemAtTier(run, item, nextLevel);
  const stats = [];
  if (item.kind === 'armor' || item.kind === 'shield') {
    stats.push({ kind: 'budget', tag: `core:budget:${itemRef}`, label: item.kind === 'armor' ? 'Armor budget' : 'Stat points',
      before: before.budget ?? before.points, after: after.budget ?? after.points });
  }
  for (const id of STAT_ORDER) if (before.values[id] !== after.values[id]) {
    stats.push({ kind: 'stat', tag: `core:${id}:${itemRef}`, label: STAT_LABELS[id], before: before.values[id], after: after.values[id] });
  }
  return stats;
}

/**
 * Each deck card whose live damage or block changes with this tier step (equipped items only; a stored
 * item changes no card until it is equipped). Runs two real combats and previews every card, so callers
 * ask for it only for the item being reviewed or committed.
 */
export function coreSmithingCards(registries, run, itemRef, currentLevel, nextLevel) {
  if (!gearItemFor(run, itemRef) || !isEquipped(run, itemRef)) return [];
  const was = liveCardValues(registries, run, itemRef, currentLevel), now = liveCardValues(registries, run, itemRef, nextLevel);
  const cards = [];
  for (const [key, row] of now) for (const spec of CARD_VALUES) {
    const b = was.get(key)?.values[spec.op], a = row.values[spec.op];
    if (b === undefined || a === undefined || b === a) continue;
    cards.push({ kind: 'card', tag: `core:card:${key}:${spec.op}`, label: `${row.name} ${spec.label.toLowerCase()}`,
      cardId: row.cardId, name: row.name, op: spec.op, opLabel: spec.label, rating: spec.rating, copies: row.copies, before: b, after: a });
  }
  return cards;
}

/** Card-shaped rows for the Smith modal's "affected" list: the item's stats first, then each card. */
export function coreSmithingPreviewRows(itemName, stats, cards = []) {
  const rows = [];
  if (stats.length) rows.push({
    instanceId: null, cardId: null, role: 'item', name: itemName, rating: null, reference: null, used: true, activeCopies: 1,
    changes: stats.map((row) => ({ kind: row.kind, tag: row.tag, op: row.tag, label: row.label, before: row.before, after: row.after })),
  });
  for (const card of cards) rows.push({
    instanceId: null, cardId: card.cardId, role: 'card', name: card.name, rating: { id: card.rating.toLowerCase(), label: card.rating },
    reference: null, used: true, activeCopies: card.copies,
    changes: [{ kind: 'card', tag: card.tag, op: card.op, label: card.opLabel, before: card.before, after: card.after }],
  });
  return rows;
}
