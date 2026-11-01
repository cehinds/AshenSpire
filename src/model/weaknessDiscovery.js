// Weakness discovery (owner, 2026-11-01; SPEC 5.3). An enemy's weakness is hidden - no chip, no inspector or bestiary
// "Weak to" line - until the player triggers it. The ledger is { [enemyId]: ['piercing:damage', ...] }, keyed by enemy TYPE
// and weakness row (`to:effect`), so a discovery shows for every enemy of that type for the rest of the run. It lives on the run
// (`run.weaknessDiscovery`), so a save keeps it; it is derived from `weaknessTriggered` events, so a restored fight re-derives it.
// Pure data rules, no DOM and no engine state.
const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 64 && !['__proto__', 'prototype', 'constructor'].includes(key);

export const weaknessKey = row => `${row?.to}:${row?.effect}`;

/** The ledger's problems (empty when valid; undefined is a fresh ledger). */
export function weaknessDiscoveryProblems(ledger) {
  if (ledger === undefined) return [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return ['weaknessDiscovery must be an object'];
  const problems = [];
  for (const [enemyId, keys] of Object.entries(ledger)) {
    if (!safeKey(enemyId) || !Array.isArray(keys) || keys.length > 8 || !keys.every(key => typeof key === 'string' && /^[a-z]+:[a-z]+$/.test(key))) problems.push(`weaknessDiscovery.${enemyId} must list weakness keys`);
  }
  return problems;
}

export const isWeaknessDiscovered = (ledger, enemyId, row) => !!ledger && Object.hasOwn(ledger, enemyId) && ledger[enemyId].includes(weaknessKey(row));

/** The rows of `weaknesses` this enemy type has discovered: what a chip, the inspector and the bestiary may show. */
export function discoveredWeaknesses(weaknesses, ledger, enemyId) {
  return (Array.isArray(weaknesses) ? weaknesses : []).filter(row => isWeaknessDiscovered(ledger, enemyId, row));
}

/** Record every weaknessTriggered event in `events` into the ledger; `enemies` maps an event's targetId to its type. True when it grew. */
export function recordWeaknessDiscoveries(ledger, events, enemies) {
  let changed = false;
  for (const event of events || []) {
    if (event?.type !== 'weaknessTriggered' || !event.to || !event.effect) continue;
    const enemy = (enemies || []).find(row => row.id === event.targetId);
    if (!enemy?.enemyId || !safeKey(enemy.enemyId) || isWeaknessDiscovered(ledger, enemy.enemyId, event)) continue;
    (Object.hasOwn(ledger, enemy.enemyId) ? ledger[enemy.enemyId] : (ledger[enemy.enemyId] = [])).push(weaknessKey(event));
    changed = true;
  }
  return changed;
}
