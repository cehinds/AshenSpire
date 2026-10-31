// A DOM-free read model for the Core card-upgrade picker (rest site and Blacksmith).
// Every fact comes from planCardUpgrade, which is inert: the rolled step shown here
// is the step commitCardUpgrade applies. Nothing here mutates the run.
import { planCardUpgrade } from '../../model/cardUpgradeService.js';
import { upgradeCount, upgradeStepsOf } from '../../model/cardUpgrade.js';
import { cardRank } from '../../model/cardRank.js';
import { combatCardRange, combatProfileFor } from '../../model/combatCardProfile.js';
import { upgradeChoiceCount } from '../../model/cardUpgradeLimits.js';
import { staticTokens } from '../components/card.js';
import { playingCardArtwork } from '../cardArtwork.js';
import { t } from '../strings.js';

const freeze = (value) => Object.freeze(value);
// Completed cards leave the picker, as do cards upgraded with their armament.
const HIDDEN_CODES = freeze(['armament', 'missing', 'maxed', 'cap']);

const row_upgrades = (instance) => (upgradeCount(instance) === 1 ? 'cardUpgrade.row.chipOne' : 'cardUpgrade.row.chip');
const costLabel = (plan) => (plan.cost === 0 ? t('cardUpgrade.free') : t('cardUpgrade.stone', { n: plan.cost }));

const num = (value) => (Number.isFinite(value) ? value : 0);
const hitsOf = (def) => (def?.effects || []).reduce((most, e) => (e.op === 'damage' && Number.isInteger(e.hits) && e.hits > 1 ? Math.max(most, e.hits) : most), 1);
/** Total stacks of each plain status a card applies, by status id. */
const statusStacks = (def) => {
  const found = new Map();
  for (const e of def?.effects || []) if (e.status && Number.isFinite(e.stacks)) found.set(e.status, (found.get(e.status) || 0) + e.stacks);
  return found;
};
const statusName = (registries, id) => registries.frameworkTerms?.statusDisplay?.(id)?.name || String(id);
const statusText = (registries, stacks) => (stacks.size
  ? [...stacks].map(([id, n]) => `${statusName(registries, id)} ${n}`).join(', ') : 'none');
const cap = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : '');

/** The face numbers that changed between the plan's before and after faces, as [{ label, before, after }]. */
export function cardUpgradeChanges(registries, before, after) {
  if (!before || !after) return [];
  const out = [];
  const a = staticTokens(before, registries), b = staticTokens(after, registries);
  const push = (label, from, to) => { if (String(from) !== String(to)) out.push(freeze({ label, before: String(from), after: String(to) })); };
  push('DAMAGE', num(a.damage), num(b.damage));
  push('GUARD', num(a.block), num(b.block));
  push('HITS', hitsOf(before), hitsOf(after));
  push('STAMINA', num(before.staminaCost), num(after.staminaCost));
  push('MANA', num(before.manaCost), num(after.manaCost));
  const poise = (def) => (def?.effects || []).filter((e) => e.op === 'poiseDamage' && Number.isFinite(e.amount)).reduce((sum, e) => sum + e.amount, 0);
  push(t('cardUpgrade.change.poise'), poise(before), poise(after));
  push(t('cardUpgrade.change.range'), cap(combatCardRange(before) || 'none'), cap(combatCardRange(after) || 'none'));
  const targeting = (def) => t((def?.effects || []).find((e) => e.op === 'damage' && e.target === 'allEnemies') ? 'cardUpgrade.value.area' : 'cardUpgrade.value.single');
  if ((before.effects || []).some((e) => e.op === 'damage')) push(t('cardUpgrade.change.target'), targeting(before), targeting(after));
  push(t('cardUpgrade.change.stance'), cap(combatProfileFor(before).maneuver || 'none'), cap(combatProfileFor(after).maneuver || 'none'));
  push(t('cardUpgrade.change.school'), cap(combatProfileFor(before).school || 'none'), cap(combatProfileFor(after).school || 'none'));
  push(t('cardUpgrade.change.element'), cap(before.damageSchool || 'none'), cap(after.damageSchool || 'none'));
  const cantrip = (def) => t((def?.tags || []).includes('rank.cantrip') ? 'cardUpgrade.value.cantrip' : 'cardUpgrade.value.ranked');
  push(t('cardUpgrade.change.rank'), cantrip(before), cantrip(after));
  const from = statusStacks(before), to = statusStacks(after);
  if (statusText(registries, from) !== statusText(registries, to)) out.push(freeze({ label: t('cardUpgrade.change.status'), before: statusText(registries, from), after: statusText(registries, to) }));
  return freeze(out);
}

/** Card type, rarity and keyword words, as the face shows them. */
const cardTags = (registries, def, rarity) => freeze([
  cap(def?.type), cap(rarity),
  ...(def?.keywords || []).map((kw) => registries.framework?.keywordDisplay?.(kw)?.name || cap(kw)),
].filter(Boolean));

/**
 * cardUpgradeModel(registries, run, selectedInstanceId, { blockedReason, blacksmith }).
 * `blacksmith` offers a choice (upgradeChoiceCount: 2 for a Basic card, 3 for a ranked one); each row then lists
 * `options` [{ index, step, after, changes }] (a single entry otherwise) and its `plan` carries the same list.
 */
export function cardUpgradeModel(registries, run, selectedInstanceId = null, { blockedReason = '', blacksmith = false } = {}) {
  const stones = Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0;
  const groups = new Map();
  const rows = [];
  // Every owned card: deck first (deck order), then the sideboard. Deck and sideboard copies are separate instances,
  // so they never share a row (inDeck is part of the group key).
  const owned = [...(run.deck || []).map((instance) => ({ instance, inDeck: true })), ...(run.sideboard || []).map((instance) => ({ instance, inDeck: false }))];
  for (const { instance, inDeck } of owned) {
    if (!instance || !registries.cards.has(instance.cardId)) continue;
    const choices = blacksmith ? upgradeChoiceCount(registries.cards.get(instance.cardId), instance, { blacksmith }) : 1;
    const plan = planCardUpgrade(run, registries, instance.instanceId, { choices });
    if (HIDDEN_CODES.includes(plan.code)) continue;
    // Identical copies (same card, same upgrade steps and rank) are one row that selects the first instance.
    // upgradeStepsOf normalises an old-style `upgraded: true` (no step list) to the authored step, so such a copy
    // never shares a row with fresh copies of the same card.
    // The next step is rolled per instance id, so copies whose next upgrade differs stay separate rows: each
    // distinct outcome stays previewable and purchasable.
    const key = JSON.stringify([instance.cardId, upgradeStepsOf(instance), cardRank(instance), plan.options ? plan.options.map((o) => o.step) : plan.step, inDeck]);
    if (groups.has(key)) { groups.get(key).instanceIds.push(instance.instanceId); groups.get(key).copies += 1; continue; }
    const base = registries.cards.get(instance.cardId);
    const rarity = base.rarity || 'common';
    const row = {
      instanceId: instance.instanceId, instanceIds: [instance.instanceId], copies: 1, inDeck, cardId: instance.cardId,
      name: plan.before?.name || base.name, rarity,
      upgrades: upgradeCount(instance), rank: cardRank(instance), plan, code: plan.code,
      spent: false, disabled: !plan.ok || !!blockedReason, cost: plan.cost, costLabel: costLabel(plan),
      blockedReason: plan.reason || blockedReason,
      chipLabel: t(row_upgrades(instance), { rank: cardRank(instance), n: upgradeCount(instance) }),
      statusLabel: t('cardUpgrade.row.next', { n: plan.n }),
      levelFrom: upgradeCount(instance), levelTo: upgradeCount(instance) + 1,
      changes: cardUpgradeChanges(registries, plan.before, plan.after),
      options: freeze((plan.options || (plan.step ? [{ step: plan.step, after: plan.after }] : [])).map((option, index) => freeze({
        index, step: option.step, after: option.after, changes: cardUpgradeChanges(registries, plan.before, option.after),
      }))),
      tags: cardTags(registries, plan.before || base, rarity),
      artAsset: playingCardArtwork({ cardId: instance.cardId }), artGlyph: (plan.before || base).icon || 'smith',
    };
    groups.set(key, row);
    rows.push(row);
  }
  for (let i = 0; i < rows.length; i += 1) rows[i] = freeze({ ...rows[i], instanceIds: freeze(rows[i].instanceIds) });
  // Stable sorting keeps deck order within each group. An existing selection
  // can keep its preview after a purse/service change, with Confirm disabled.
  rows.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  const selected = rows.find((row) => row.instanceIds.includes(selectedInstanceId)) || null;
  const affordable = !!selected && selected.plan.ok;
  return freeze({
    rows: freeze(rows), selected, stones, affordable,
    canConfirm: affordable && !blockedReason,
    blockedReasons: freeze(selected && !selected.plan.ok ? [selected.plan.reason] : blockedReason ? [blockedReason] : []),
    faces: selected && selected.plan.before && selected.plan.after ? freeze({ before: selected.plan.before, after: selected.plan.after }) : null,
  });
}
