// A DOM-free read model for the Core card-upgrade picker (rest site and Blacksmith).
// Every fact comes from planCardUpgrade, which is inert: the rolled step shown here
// is the step commitCardUpgrade applies. Nothing here mutates the run.
import { planCardUpgrade } from '../../model/cardUpgradeService.js';
import { upgradeCount } from '../../model/cardUpgrade.js';
import { cardRank } from '../../model/cardRank.js';
import { t } from '../strings.js';

const freeze = (value) => Object.freeze(value);
// Completed cards leave the picker, as do cards upgraded with their armament.
const HIDDEN_CODES = freeze(['armament', 'missing', 'maxed', 'cap']);

const row_upgrades = (instance) => (upgradeCount(instance) === 1 ? 'cardUpgrade.row.chipOne' : 'cardUpgrade.row.chip');
const costLabel = (plan) => (plan.cost === 0 ? t('cardUpgrade.free') : t('cardUpgrade.stone', { n: plan.cost }));

export function cardUpgradeModel(registries, run, selectedInstanceId = null, { blockedReason = '' } = {}) {
  const stones = Number.isSafeInteger(run.smithingStones) ? run.smithingStones : 0;
  const rows = [];
  for (const instance of run.deck || []) {
    const plan = planCardUpgrade(run, registries, instance.instanceId);
    if (HIDDEN_CODES.includes(plan.code)) continue;
    const base = registries.cards.get(instance.cardId);
    rows.push(freeze({
      instanceId: instance.instanceId, cardId: instance.cardId, name: plan.before?.name || base.name, rarity: base.rarity || 'common',
      upgrades: upgradeCount(instance), rank: cardRank(instance), plan, code: plan.code,
      spent: false, disabled: !plan.ok || !!blockedReason, cost: plan.cost, costLabel: costLabel(plan),
      blockedReason: plan.reason || blockedReason,
      chipLabel: t(row_upgrades(instance), { rank: cardRank(instance), n: upgradeCount(instance) }),
      statusLabel: t('cardUpgrade.row.next', { n: plan.n }),
    }));
  }
  // Stable sorting keeps deck order within each group. An existing selection
  // can keep its preview after a purse/service change, with Confirm disabled.
  rows.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  const selected = rows.find((row) => row.instanceId === selectedInstanceId) || null;
  const affordable = !!selected && selected.plan.ok;
  return freeze({
    rows: freeze(rows), selected, stones, affordable,
    canConfirm: affordable && !blockedReason,
    blockedReasons: freeze(selected && !selected.plan.ok ? [selected.plan.reason] : blockedReason ? [blockedReason] : []),
    faces: selected && selected.plan.before && selected.plan.after ? freeze({ before: selected.plan.before, after: selected.plan.after }) : null,
  });
}
