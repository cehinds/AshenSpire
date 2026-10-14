// Browser-safe fixture factory. Callers provide native or compiled API exports.
// These are capability fixtures, not completed player runs or balance simulations.
export const AUDIT_SCENARIOS = Object.freeze(['baseline', 'wounded', 'charged', 'protected', 'empty-pools']);
export function makeAuditCombat(api, { classId, enemyIds, instance, seed = 701, scenario = 'baseline', cardInstances = [], relicIds, carrierId } = {}) {
  if (!AUDIT_SCENARIOS.includes(scenario)) throw new Error(`Unknown audit scenario '${scenario}'`);
  const run = api.createRunState({ registries: api.registries, classId, seed });
  let fixtureKind = 'registered-card';
  if (Number.isInteger(instance?.abilityRank) && instance.abilityRank > 0) {
    const card = api.registries.cards.get(instance.cardId);
    const skill = card.abilityKind === 'spell' ? 'item:magic-focus' : 'combatManeuvers';
    const level = api.registries.balance.progression.ability.ranksAt[instance.abilityRank];
    if (!Number.isInteger(level)) throw new Error(`No authored skill threshold for rank '${instance.abilityRank}'`);
    run.skills[skill] = { ...(run.skills[skill] || { xp: 0, pendingDrafts: 0 }), level };
  }
  if (carrierId !== undefined) {
    const piece = carrierId && api.registries.equipment.armaments.find(p => p.id === carrierId);
    if (carrierId && !piece) throw new Error(`Unknown audit carrier '${carrierId}'`);
    for (const [attribute, need] of Object.entries(piece?.requirements?.attributes || {})) run.attributes[attribute] = Math.max(run.attributes[attribute] || 0, need);
    if (!api.applyEquipTransition(api.registries, run.loadout, 'rightHand', 0, carrierId)) throw new Error(`Cannot equip audit carrier '${carrierId}'`);
    if (carrierId === null) api.applyEquipTransition(api.registries, run.loadout, 'leftHand', 0, null);
    api.stampDeck(api.registries, run);
    if (instance?.profileId) {
      let carrier = run.deck.find(c => c.profileId === instance.profileId);
      if (carrier) fixtureKind = 'current-equipment-grant';
      else {
        const profile = api.registries.equipment.basicCardProfiles.find(p => p.id === instance.profileId);
        if (!profile) throw new Error(`Unknown audit profile '${instance.profileId}'`);
        carrier = { ...instance, equipmentRole: profile.role === 'attack' ? 'granted' : profile.role, ...(profile.role === 'attack' ? { kitRole: 'attack' } : {}) };
        api.stampDeck(api.registries, run, [carrier]);
        if (carrier.profileId !== instance.profileId) throw new Error(`Carrier '${carrierId}' supplies no '${instance.profileId}' card`);
        fixtureKind = 'saved-legacy-equipment-role';
      }
      instance = { ...carrier, ...instance };
    }
  }
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
  return { combat, run, scenario, fixtureKind };
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
  const next = instances.map((c, i) => ({ ...c, upgraded: c.upgraded ?? false, instanceId: c.instanceId || `audit:${i}:${c.cardId}` }));
  const incoming = new Set(next.map(c => c.instanceId));
  combat.piles.draw = [...combat.piles.draw, ...combat.piles.hand.filter(c => !incoming.has(c.instanceId))];
  for (const [name, cards] of Object.entries(combat.piles)) if (name !== 'hand' && Array.isArray(cards)) combat.piles[name] = cards.filter(c => !incoming.has(c.instanceId));
  combat.piles.hand = next;
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

// Capability states for positive/negative predicate branches; no dispatch methods change.
export function setAuditPredicate(combat, predicate, truth, target = combat.enemies[0]) {
  const p = predicate;
  const entities = p.of === 'allEnemies' ? combat.enemies : [p.of === 'target' ? target : combat.player];
  switch (p.p) {
    case 'not': return setAuditPredicate(combat, p.pred, !truth, target);
    case 'all': case 'any':
      for (const child of p.preds) setAuditPredicate(combat, child, truth, target);
      return;
    case 'hasBlock': for (const entity of entities) entity.block = truth ? 20 : 0; return;
    case 'hasStatus':
      for (const entity of entities) {
        if (truth) entity.statuses[p.status] = { stacks: p.atLeast || 1 };
        else delete entity.statuses[p.status];
      }
      return;
    case 'hpBelowPct':
      for (const entity of entities) entity.hp = truth ? Math.max(1, Math.floor(entity.maxHp * p.pct / 100) - 1) : entity.maxHp;
      return;
    case 'inStance': combat.player.stanceId = truth ? p.stance : null; return;
    case 'firstCardThisTurn': combat.player.counters.cardsPlayedThisTurn = truth ? 0 : 1; return;
    case 'turnMetric': {
      const state = combat.player.abilityRiders;
      const value = truth ? p.atLeast ?? p.atMost ?? 1 : p.atLeast !== undefined ? Math.max(0, p.atLeast - 1) : p.atMost + 1;
      if (p.metric === 'tagPlays') state.tagPlays[p.tag] = value;
      else if (p.metric === 'distinctTagPlays') state.distinctTagPlays[p.tag] = Object.fromEntries(Array.from({ length: value }, (_, i) => [`audit:prior:${i}`, true]));
      else state[p.metric] = value;
      return;
    }
    default: throw new Error(`No audit predicate fixture for '${p.p}'`);
  }
}
