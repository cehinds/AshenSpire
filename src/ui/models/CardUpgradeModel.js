// A DOM-free read model for the Core card-upgrade picker (rest site and Blacksmith).
// Every fact comes from planCardUpgrade, which is inert: the rolled step shown here
// is the step commitCardUpgrade applies. Nothing here mutates the run.
import { planCardUpgrade } from '../../model/cardUpgradeService.js';
import { upgradeCount, upgradeStepsOf } from '../../model/cardUpgrade.js';
import { cardRank } from '../../model/cardRank.js';
import { combatCardRange, combatProfileFor } from '../../model/combatCardProfile.js';
import { upgradeChoiceCount, RestUpgradeRule } from '../../model/cardUpgradeLimits.js';
import { rampParts, playsEverOf } from '../../model/cardRamp.js';
import { staticTokens } from '../components/card.js';
import { playingCardArtwork } from '../cardArtwork.js';
import { t } from '../strings.js';
import { rankUpCandidates } from '../../model/skills.js';
import { rankUpBonusOptions } from '../../model/rankUpBonus.js';

const freeze = (value) => Object.freeze(value);
// Completed cards leave the picker. A card that upgrades with its weapon stays listed, disabled, with its reason.
const HIDDEN_CODES = freeze(['missing', 'maxed', 'cap']);

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
export function cardUpgradeChanges(registries, before, after, playsEver = 0, maxRange = undefined) {
  if (!before || !after) return [];
  const out = [];
  const a = staticTokens(before, registries), b = staticTokens(after, registries);
  const push = (label, from, to) => { if (String(from) !== String(to)) out.push(freeze({ label, before: String(from), after: String(to) })); };
  // A ramped stat reads as its retained base plus the growth the upgrade adds, never as the formula's text (which is 0).
  const stat = (name, token, label) => {
    const from = rampParts(before, name, playsEver), to = rampParts(after, name, playsEver);
    const base = (parts, tokens) => (parts ? parts.base : num(tokens[token]));
    const grown = to && (!from || from.perUse !== to.perUse || from.scope !== to.scope);
    const text = grown ? t(to.scope === 'run' ? 'cardUpgrade.change.rampRun' : 'cardUpgrade.change.rampCombat', { n: to.base, per: to.perUse }) : base(to, b);
    push(label, base(from, a), text);
  };
  stat('damage', 'damage', 'DAMAGE');
  stat('block', 'block', 'BLOCK');
  push('HITS', hitsOf(before), hitsOf(after));
  push('STAMINA', num(before.staminaCost), num(after.staminaCost));
  push('MANA', num(before.manaCost), num(after.manaCost));
  const poise = (def) => (def?.effects || []).filter((e) => e.op === 'poiseDamage' && Number.isFinite(e.amount)).reduce((sum, e) => sum + e.amount, 0);
  push(t('cardUpgrade.change.poise'), poise(before), poise(after));
  push(t('cardUpgrade.change.range'), cap(combatCardRange(before, maxRange) || 'none'), cap(combatCardRange(after, maxRange) || 'none'));
  const targeting = (def) => t((def?.effects || []).find((e) => e.op === 'damage' && e.target === 'allEnemies') ? 'cardUpgrade.value.area' : 'cardUpgrade.value.single');
  if ((before.effects || []).some((e) => e.op === 'damage')) push(t('cardUpgrade.change.target'), targeting(before), targeting(after));
  push(t('cardUpgrade.change.stance'), cap(combatProfileFor(before).maneuver || 'none'), cap(combatProfileFor(after).maneuver || 'none'));
  push(t('cardUpgrade.change.school'), cap(combatProfileFor(before).school || 'none'), cap(combatProfileFor(after).school || 'none'));
  push(t('cardUpgrade.change.element'), cap(before.damageSchool || 'none'), cap(after.damageSchool || 'none'));
  const cantrip = (def) => t((def?.tags || []).includes('rank.cantrip') ? 'cardUpgrade.value.cantrip' : 'cardUpgrade.value.ranked');
  push(t('cardUpgrade.change.rank'), cantrip(before), cantrip(after));
  // Effects the menu adds (W25): draw, discard, exhaust, a copy, a shuffle, Retain, a temporary boost, a second target, and the keywords / traits.
  const extras = (def) => [...new Set((def?.effects || []).flatMap((e) => (e.op === 'draw' || e.op === 'discard' || e.op === 'exhaust' || e.op === 'addCard' || e.op === 'shuffleDiscardIntoDraw' || e.op === 'retain'
    ? [e.op] : e.op === 'applyStatus' && e.thisTurn ? [`${e.status} this turn`] : e.op === 'changeAttribute' ? [`${e.attribute} ${e.thisTurn ? 'this turn' : 'for the fight'}`] : e.op === 'damage' && (e.target === 'randomEnemy' || e.target === 'otherEnemy') ? ['extra target'] : []))), ...Object.entries(def?.runAttributeBonus || {}).map(([stat, n]) => `+${n} ${stat} for the run`)].sort().join(', ') || 'none';
  push(t('cardUpgrade.change.effects'), extras(before), extras(after));
  const words = (def) => [...(def?.keywords || []), ...((def?.tags || []).includes('trait:reaction') ? ['reaction'] : [])].sort().join(', ') || 'none';
  push(t('cardUpgrade.change.keywords'), words(before), words(after));
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
 * cardUpgradeModel(registries, run, selectedInstanceId, { blockedReason, blacksmith, quote }).
 * `blacksmith` offers a choice (upgradeChoiceCount: 2 for a Basic card, 3 for a ranked one); each row then lists
 * `options` [{ index, step, after, changes }] (a single entry otherwise) and its `plan` carries the same list.
 * `quote(instanceId) → { ok, cost, reason, cinders }` is an optional price override (the Blacksmith's): it replaces the
 * rest-priced availability and stone cost of each row, and a `cinders` price is shown instead of Free / stones.
 * The row's `plan` stays the service's own quote (the step the commit applies).
 */
export function cardUpgradeModel(registries, run, selectedInstanceId = null, { blockedReason = '', blacksmith = false, quote = null } = {}) {
  const stones = Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0;
  const groups = new Map();
  const rows = [];
  // Every owned card: deck first (deck order), then the sideboard. Deck and sideboard copies are separate instances,
  // so they never share a row (inDeck is part of the group key).
  const owned = [...(run.deck || []).map((instance) => ({ instance, inDeck: true })), ...(run.sideboard || []).map((instance) => ({ instance, inDeck: false }))];
  for (const { instance, inDeck } of owned) {
    if (!instance || !registries.cards.has(instance.cardId)) continue;
    // Blacksmith: 2 or 3 options. Rest site (owner, 2026-11-14): 1 option up to the third upgrade, then 2, some with two effects.
    const rule = blacksmith ? { choices: upgradeChoiceCount(registries.cards.get(instance.cardId), instance, { blacksmith, run }), combos: false } : RestUpgradeRule(instance);
    const plan = planCardUpgrade(run, registries, instance.instanceId, rule);
    if (HIDDEN_CODES.includes(plan.code)) continue;
    // Identical copies (same card, same upgrade steps and rank) are one row that selects the first instance.
    // upgradeStepsOf normalises an old-style `upgraded: true` (no step list) to the authored step, so such a copy
    // never shares a row with fresh copies of the same card.
    // The next step is rolled per instance id and does not split a row: the row shows the step of its first copy
    // (the one an upgrade is applied to) and flags `nextDiffers` when another copy would roll something else.
    const nextKey = JSON.stringify(plan.options ? plan.options.map((o) => o.step) : plan.step);
    const key = JSON.stringify([instance.cardId, upgradeStepsOf(instance), cardRank(instance), inDeck]);
    if (groups.has(key)) {
      const group = groups.get(key);
      group.instanceIds.push(instance.instanceId); group.copies += 1;
      if (nextKey !== group.nextKey) group.nextDiffers = true;
      continue;
    }
    const priced = quote ? quote(instance.instanceId) : null;
    const weaponBound = plan.code === 'armament';
    const ok = !weaponBound && (priced ? !!priced.ok : plan.ok);
    const base = registries.cards.get(instance.cardId);
    const rarity = base.rarity || 'common';
    const row = {
      instanceId: instance.instanceId, instanceIds: [instance.instanceId], copies: 1, inDeck, cardId: instance.cardId,
      name: plan.before?.name || base.name, rarity,
      upgrades: upgradeCount(instance), rank: cardRank(instance), plan, code: plan.code,
      spent: false, ok, weaponBound, nextKey, nextDiffers: false, cinders: priced?.cinders > 0 ? priced.cinders : 0,
      // Is the Smithing Stone purse the blocker? (a quote's own verdict, else the service plan's stone code)
      shortStones: priced ? priced.cost > stones : plan.code === 'stones', disabled: !ok || !!blockedReason, cost: priced ? priced.cost : plan.cost,
      costLabel: priced?.cinders > 0 ? t('cardUpgrade.cinders', { n: priced.cinders }) : costLabel(priced ? { cost: priced.cost } : plan),
      blockedReason: weaponBound ? t('cardUpgrade.row.weaponBound') : (priced ? priced.reason : plan.reason) || blockedReason,
      chipLabel: t(row_upgrades(instance), { rank: cardRank(instance), n: upgradeCount(instance) }),
      statusLabel: t('cardUpgrade.row.next', { n: plan.n }),
      levelFrom: upgradeCount(instance), levelTo: upgradeCount(instance) + 1,
      changes: cardUpgradeChanges(registries, plan.before, plan.after, playsEverOf(instance), run.rangePolicy?.maxRange),
      options: freeze((plan.options || (plan.step ? [{ step: plan.step, after: plan.after }] : [])).map((option, index) => freeze({
        index, step: option.step, after: option.after, changes: cardUpgradeChanges(registries, plan.before, option.after, playsEverOf(instance), run.rangePolicy?.maxRange),
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
  // Deck cards come first, then the library (playtest 2026-11-17 item 45b); within each, an available row before a blocked one.
  rows.sort((a, b) => Number(b.inDeck) - Number(a.inDeck) || Number(a.disabled) - Number(b.disabled));
  const selected = rows.find((row) => row.instanceIds.includes(selectedInstanceId)) || null;
  const affordable = !!selected && selected.ok;
  return freeze({
    rows: freeze(rows), selected, stones, affordable,
    canConfirm: affordable && !blockedReason,
    blockedReasons: freeze(selected && !selected.ok ? [selected.blockedReason] : blockedReason ? [blockedReason] : []),
    faces: selected && selected.plan.before && selected.plan.after ? freeze({ before: selected.plan.before, after: selected.plan.after }) : null,
  });
}

/**
 * RankUpUpgradeModel(registries, run, skillId, selectedInstanceId, { faceOf }) — a usage skill's rank-up (SPEC 13.4o)
 * in the card-upgrade picker's shape (playtest 2026-11-17 item 45a: every card upgrade uses the Blacksmith's option
 * modal). Rows are the cards that can rise, deck first; a chosen card's options are its rank-up bonus picks
 * (rankUpBonus.js), or the plain rise when it has none. Free: `purse` is false, so the picker shows no price.
 * `faceOf(instance)` resolves an instance to the face the game draws (the reward screen's own resolver).
 */
export function RankUpUpgradeModel(registries, run, skillId, selectedInstanceId = null, { faceOf } = {}) {
  const rows = rankUpCandidates(registries, run, skillId).map((instance) => {
    const inDeck = (run.deck || []).includes(instance);
    const base = registries.cards.get(instance.cardId);
    const rank = cardRank(instance);
    const before = faceOf(instance);
    const raised = faceOf({ ...instance, rank: rank + 1 });
    const bonus = rankUpBonusOptions(registries, run, instance);
    const options = (bonus.length ? bonus.map((option) => ({ step: option.step, after: faceOf(option.after) })) : [{ step: null, after: raised }])
      .map((option, index) => freeze({ index, step: option.step, after: option.after, changes: cardUpgradeChanges(registries, before, option.after) }));
    return freeze({
      instanceId: instance.instanceId, instanceIds: freeze([instance.instanceId]), copies: 1, inDeck, cardId: instance.cardId,
      name: before?.name || base?.name || instance.cardId, rarity: base?.rarity || 'common', rank,
      // A lone bonus is no choice, so the picker commits the plan itself: it carries that option's step and face.
      plan: freeze({ before, after: options[0].after, step: options[0].step }), ok: true, disabled: false, weaponBound: false, cost: 0, cinders: 0, shortStones: false,
      costLabel: t('cardUpgrade.free'), blockedReason: '', levelFrom: rank, levelTo: rank + 1,
      status: t('cardUpgrade.row.rankStatus', { from: rank, to: rank + 1 }),
      changes: options[0].changes, options: freeze(options), nextDiffers: false,
      tags: cardTags(registries, before || base, base?.rarity || 'common'),
      artAsset: playingCardArtwork({ cardId: instance.cardId }), artGlyph: (before || base)?.icon || 'skill',
    });
  });
  rows.sort((a, b) => Number(b.inDeck) - Number(a.inDeck));
  const selected = rows.find((row) => row.instanceId === selectedInstanceId) || null;
  return freeze({
    rows: freeze(rows), selected, stones: 0, affordable: !!selected, canConfirm: !!selected, purse: false,
    blockedReasons: freeze([]),
    faces: selected ? freeze({ before: selected.plan.before, after: selected.options[0].after }) : null,
  });
}
