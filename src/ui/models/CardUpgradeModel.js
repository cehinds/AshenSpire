// A DOM-free read model for the Core card-upgrade picker (rest site and Blacksmith).
// Every fact comes from planCardUpgrade, which is inert: the rolled step shown here
// is the step commitCardUpgrade applies. Nothing here mutates the run.
import { planCardUpgrade } from '../../model/cardUpgradeService.js';
import { upgradeCount } from '../../model/cardUpgrade.js';
import { cardRank } from '../../model/cardRank.js';
import { t } from '../strings.js';

const freeze = (value) => Object.freeze(value);
// A 'maxed' or 'cap' card cannot be upgraded again: its row is disabled and says so.
const SPENT_CODES = freeze(['maxed', 'cap']);
// 'armament' (upgraded with its armament) and 'missing' are not deck-card upgrades at all.
const HIDDEN_CODES = freeze(['armament', 'missing']);

const costLabel = (plan) => (SPENT_CODES.includes(plan.code) ? t('cardUpgrade.maxed') : plan.cost === 0 ? t('cardUpgrade.free') : t('cardUpgrade.stone', { n: plan.cost }));

export function cardUpgradeModel(registries, run, selectedInstanceId = null, { blockedReason = '' } = {}) {
  const stones = Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0;
  const rows = [];
  for (const instance of run.deck || []) {
    const plan = planCardUpgrade(run, registries, instance.instanceId);
    if (HIDDEN_CODES.includes(plan.code)) continue;
    const base = registries.cards.get(instance.cardId);
    const spent = SPENT_CODES.includes(plan.code);
    rows.push(freeze({
      instanceId: instance.instanceId, cardId: instance.cardId, name: plan.before?.name || base.name, rarity: base.rarity || 'common',
      upgrades: upgradeCount(instance), rank: cardRank(instance), plan, code: plan.code,
      spent, disabled: spent, cost: plan.cost, costLabel: costLabel(plan),
      statusLabel: spent ? t('cardUpgrade.maxed') : t('cardUpgrade.row.next', { n: plan.n }),
    }));
  }
  const selected = rows.find((row) => row.instanceId === selectedInstanceId && !row.disabled) || null;
  const affordable = !!selected && selected.plan.ok;
  return freeze({
    rows: freeze(rows), selected, stones, affordable,
    canConfirm: affordable && !blockedReason,
    blockedReasons: freeze(selected && !selected.plan.ok ? [selected.plan.reason] : blockedReason ? [blockedReason] : []),
    faces: selected && selected.plan.before && selected.plan.after ? freeze({ before: selected.plan.before, after: selected.plan.after }) : null,
  });
}
