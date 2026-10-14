// Browser-safe fixture factory. Callers provide native or compiled API exports.
// These are capability fixtures, not completed player runs or balance simulations.
export const AUDIT_SCENARIOS = Object.freeze(['baseline', 'wounded', 'charged', 'protected', 'empty-pools']);
export function makeAuditCombat(api, { classId, enemyIds, instance, seed = 701, scenario = 'baseline', cardInstances = [], relicIds } = {}) {
  if (!AUDIT_SCENARIOS.includes(scenario)) throw new Error(`Unknown audit scenario '${scenario}'`);
  const run = api.createRunState({ registries: api.registries, classId, seed });
  // Capacity permits expensive/X/rank variants without overriding their prices.
  run.maxHp = run.hp = 10000; run.maxMana = run.mana = 50;
  run.maxStamina = run.stamina = 50; run.energyMax = 10;
  if (relicIds) run.relics = [...relicIds];
  const combat = api.createRunCombat({ registries: api.registries, rng: api.createRng(seed), run,
    enemyIds: enemyIds || [api.registries.enemies.all()[0].id] });
  Object.assign(combat.player, { hp: 10000, maxHp: 10000, mana: 50, maxMana: 50,
    stamina: 50, maxStamina: 50, energy: 50, energyMax: 50 });
  combat.player.baseResourceMaxima = { maxHp: 10000, maxMana: 50, maxStamina: 50 };
  const cards = instance ? [instance, ...cardInstances] : cardInstances;
  if (cards.length) setAuditHand(combat, cards);
  for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 10000;
  applyAuditScenario(api, combat, scenario);
  return { combat, run, scenario };
}
export function settleAuditChoices(api, combat, { maxChoices = 30 } = {}) {
  const answered = [];
  for (let count = 0; count < maxChoices; count++) {
    if (combat.pendingAbilityDiscard) {
      const ids = api.discardCandidates(combat).slice(0, combat.pendingAbilityDiscard.count).map(c => c.instanceId);
      api.dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: ids }); answered.push('discard');
    } else if (combat.pendingReaction) {
      api.dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); answered.push('reaction');
    } else return answered;
  }
  throw new Error(`Audit choice budget exceeded: ${answered.join(', ')}`);
}

// DTO-only mutations: preserve dispatch, emit and every method on a live HTML combat.
export function setAuditHand(combat, instances) {
  combat.piles.draw = [...combat.piles.draw, ...combat.piles.hand];
  combat.piles.hand = instances.map((c, i) => ({ ...c, instanceId: c.instanceId || `audit:${i}:${c.cardId}` }));
  return combat.piles.hand;
}
export function applyAuditScenario(api, combat, scenario = 'baseline') {
  if (!AUDIT_SCENARIOS.includes(scenario)) throw new Error(`Unknown audit scenario '${scenario}'`);
  if (scenario === 'wounded') {
    combat.player.hp = Math.floor(combat.player.maxHp / 2);
    for (const enemy of combat.enemies) enemy.hp = Math.floor(enemy.maxHp / 5);
  }
  if (scenario === 'charged') {
    for (const id of ['starstoneCharge', 'combo']) if (api.registries.statuses.has(id)) combat.player.statuses[id] = { stacks: 3 };
  }
  if (scenario === 'protected') {
    combat.player.block = 20;
    for (const enemy of combat.enemies) enemy.block = 20;
  }
  if (scenario === 'empty-pools') combat.player.energy = combat.player.stamina = combat.player.mana = 0;
  return combat;
}
