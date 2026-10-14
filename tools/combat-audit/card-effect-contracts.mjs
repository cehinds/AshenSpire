import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadAuditRuntime } from './runtime.mjs';
import { auditInventory } from './inventory.mjs';
import { makeAuditCombat, settleAuditChoices, setAuditHand, setAuditPredicate } from './fixtures.mjs';

// The current-source renderer applies stance-pressure bonuses when a queued
// poiseDamage effect resolves. Older pinned builds predate this config file and
// correctly use a multiplier of 1. Importing the authored defaults keeps this
// oracle tied to the game rule instead of accepting an unexplained meter delta.
let authoredStanceRules = null;
try { ({ stanceRules: authoredStanceRules } = await import('../../src/content/stanceRules.js')); } catch {}

// One authored representative per requested opcode. Variant rows (upgrade and
// ability grade) come from the registry inventory, never a handwritten list.
const representatives = {
  buildup: 'rimeNeedle', poiseDamage: 'rondelParry', enterStance: 'enterBulwark',
  draw: 'timeDilation', applyStatus: 'rallyingStandard', gainBarrier: 'blightedBlightward',
  removeStatus: 'lethalDose', loseHp: 'bloodPact', gainEnergy: 'setupRogue',
  addCard: 'setupRogue', grantRollMode: 'clearHead', restoreMana: 'attune',
  gainWard: 'attune', discard: 'pilfer', grantCardCharge: 'progression-nightglass-reading',
};
const unsupportedOps = ['shuffleDiscardIntoDraw', 'retain', 'exhaust'];
const eventFor = {
  buildup: 'statusPressure', poiseDamage: 'combatImpactApplied', enterStance: 'stanceEntered',
  draw: 'cardDrawn', applyStatus: 'statusApplied', gainBarrier: 'barrierGained',
  removeStatus: 'statusRemoved', loseHp: 'hpLost', gainEnergy: 'energyGained',
  addCard: 'cardAdded', grantRollMode: null, restoreMana: 'manaRestored',
  gainWard: 'persistentWardChanged', discard: 'cardDiscarded', grantCardCharge: null,
};

function actorClass(card, classes) {
  return card.class && card.class !== 'colorless' ? card.class : classes[0];
}
function resolvedTarget(api, combat, definition) {
  const plan = api.cardTargetPlan(definition, combat.player.id, combat.enemies,
    [{ ...combat.player, connected: true }], { solo: true });
  assert.ok(plan.legalIds.length, `${definition.id}: authored card has a legal audit target`);
  return plan.legalIds[0];
}
function seedContractState(op, combat) {
  const player = combat.player, enemy = combat.enemies[0];
  if (op === 'buildup') combat.rng = combat.rng; // authored 50% roll is repeated with deterministic seeds below.
  if (op === 'poiseDamage') enemy.poiseMeter = { value: 0, max: 10000 };
  if (op === 'draw') combat.piles.draw = [{ cardId: 'defend', instanceId: 'audit:draw-a' }, { cardId: 'strike', instanceId: 'audit:draw-b' }, ...combat.piles.draw];
  if (op === 'applyStatus') enemy.statuses.bleed = undefined;
  if (op === 'gainBarrier') { player.barrier = 0; player.ward = 0; }
  if (op === 'removeStatus') enemy.statuses.venom = { stacks: 2 };
  if (op === 'loseHp') player.hp = 9000;
  if (op === 'gainEnergy') player.energy = 0;
  if (op === 'grantRollMode') player.statuses.dazed = { stacks: 1 };
  if (op === 'restoreMana') player.mana = 2;
  if (op === 'gainWard') { player.ward = 0; player.maxWard = 10; }
  if (op === 'discard') combat.piles.hand.push({ cardId: 'defend', instanceId: 'audit:discard-candidate' });
}
function stateFor(op, combat, cardId, effect) {
  const p = combat.player, e = combat.enemies[0];
  switch (op) {
    case 'buildup': return { pressure: e.pressure?.frost || e.statusPressure?.frost || 0, gauge: e.statusGauges?.frost || 0 };
    case 'poiseDamage': return { poise: e.poiseMeter?.value || 0, max: e.poiseMeter?.max || 0, staggered: e.statuses.staggered?.stacks || 0 };
    case 'enterStance': return { stanceId: p.stanceId };
    case 'draw': return { hand: combat.piles.hand.map(c => c.instanceId), draw: combat.piles.draw.map(c => c.instanceId) };
    case 'applyStatus': {
      const target = effect?.target === 'self' ? p : e;
      return { stacks: target.statuses[effect.status]?.stacks || 0 };
    }
    case 'gainBarrier': return { barrier: p.barrier || 0, ward: p.ward || 0 };
    case 'removeStatus': return { venom: e.statuses.venom?.stacks || 0 };
    case 'loseHp': return { hp: p.hp };
    case 'gainEnergy': return { energy: p.energy };
    case 'addCard': return { hand: combat.piles.hand.map(c => c.cardId), draw: combat.piles.draw.map(c => c.cardId), discard: combat.piles.discard.map(c => c.cardId) };
    case 'grantRollMode': return { nextEvadeMode: p.nextEvadeMode || null };
    case 'restoreMana': return { mana: p.mana };
    case 'gainWard': return { ward: p.ward || 0, barrier: p.barrier || 0 };
    case 'discard': return { hand: combat.piles.hand.map(c => c.instanceId), discard: combat.piles.discard.map(c => c.instanceId) };
    case 'grantCardCharge': return structuredClone(p.abilityRiders?.charges || {});
    default: throw new Error(`No state contract for ${op}/${cardId}`);
  }
}
function assertContract(op, before, after, events, instanceId, effect) {
  const ownEvents = events.filter(e => e.cardInstanceId === instanceId);
  const matching = eventFor[op] && ownEvents.filter(e => e.type === eventFor[op]);
  switch (op) {
    case 'buildup': assert.ok(ownEvents.some(e => e.type === 'statusPressure' && e.status === 'frost'), 'authored buildup reaches the enemy pressure path'); break;
    case 'poiseDamage': assert.ok(events.some(e => e.type === 'combatCounterTriggered' && e.poiseDamage > 0), 'deferred counter produces a positive authored Poise receipt'); break;
    case 'enterStance': assert.equal(after.stanceId, 'bulwark'); assert.ok(ownEvents.some(e => e.type === 'stanceEntered' && e.stance === 'bulwark')); break;
    case 'draw': assert.ok(after.hand.length > before.hand.length, 'draw moves real instances from draw pile to hand'); assert.ok(events.some(e => e.type === 'cardDrawn'), 'draw emits real draw receipts'); break;
    case 'applyStatus': assert.ok(after.stacks > before.stacks, 'authored status increases target stacks'); assert.ok(ownEvents.some(e => e.type === 'statusApplied' && e.status === effect.status)); break;
    case 'gainBarrier': assert.ok(after.barrier + after.ward > before.barrier + before.ward, 'barrier effect adds defense'); assert.ok(events.some(e => ['barrierGained', 'persistentWardChanged'].includes(e.type) && e.amount > 0)); break;
    case 'removeStatus': assert.equal(after.venom, 0); assert.ok(ownEvents.some(e => e.type === 'statusRemoved' && e.status === 'venom')); break;
    case 'loseHp': assert.ok(after.hp < before.hp, 'self HP loss changes player state'); assert.ok(ownEvents.some(e => e.type === 'hpLost' && e.amount > 0)); break;
    case 'gainEnergy': assert.ok(after.energy > before.energy, 'energy gain survives card payment'); assert.ok(ownEvents.some(e => e.type === 'energyGained' && e.amount > 0)); break;
    case 'addCard': assert.ok(after.hand.includes('rogueShiv'), 'added card reaches its authored hand pile'); break;
    case 'grantRollMode': assert.equal(after.nextEvadeMode?.advantage, true); assert.equal(after.nextEvadeMode?.disadvantage, false); break;
    // Every authored restoreMana card funds one point from its own payment, so
    // the actual-pool effect is a valid neutral after payment, not a positive gain.
    case 'restoreMana':
      assert.equal(effect.amount, effect.funded, 'authored recovery is fully funded by this card');
      assert.ok(before.mana < 50, 'Mana pool has room, so zero restoration is not a full-pool clamp');
      assert.equal(after.mana, before.mana, 'funded recovery leaves the live pool unchanged');
      assert.ok(matching.some(e => e.amount === 0), 'restoreMana emitted its actual zero-delta receipt');
      break;
    case 'gainWard': assert.ok(after.ward + after.barrier > before.ward + before.barrier, 'ward effect adds persistent defense'); assert.ok(events.some(e => e.type === 'persistentWardChanged' || e.type === 'barrierGained')); break;
    case 'discard': assert.ok(after.discard.includes('audit:discard-candidate'), 'authored discard moves a real hand card'); assert.ok(events.some(e => e.type === 'cardDiscarded' && e.cardInstanceId === 'audit:discard-candidate')); break;
    case 'grantCardCharge': assert.notDeepEqual(after, before, 'authored charge creates a persistent ability rider'); assert.ok(Object.keys(after).length); break;
  }
}

export async function auditCardEffectContracts({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), inventory = auditInventory(api.registries);
  const report = { mode, inventory: { cards: inventory.cardIds.length, classes: inventory.classes.length, variants: inventory.variants.length },
    contracts: [], neutral: [], unsupported: [], failures: [], candidates: {} };
  for (const op of [...Object.keys(representatives), ...unsupportedOps]) {
    const cardIds = [...new Set(api.registries.cards.all().filter(card => (card.effects || []).some(effect => effect.op === op)).map(card => card.id))].sort();
    report.candidates[op] = { authoredCardIds: cardIds, authoredCount: cardIds.length, exercisedRepresentative: representatives[op] || null,
      uncoveredCardIds: cardIds.filter(id => id !== representatives[op]) };
  }
  for (const [op, cardId] of Object.entries(representatives)) {
    const card = api.registries.cards.get(cardId);
    const variants = inventory.variants.filter(v => v.instance.cardId === cardId && !v.instance.profileId &&
      (v.upcastTier === undefined || v.upcastTier === null));
    assert.ok(variants.length, `${op}: representative ${cardId} missing from authored inventory`);
    // Keep all base/upgraded/rank variants; avoid multiplying the same card by equipment.
    for (const variant of variants) {
      const seed = op === 'buildup' ? [701, 702, 703, 704, 705, 706][0] : 701;
      const { combat } = makeAuditCombat(api, { classId: actorClass(card, inventory.classes), instance: { ...variant.instance, instanceId: `audit:${cardId}:${variant.key}` }, seed, relicIds: [] });
      seedContractState(op, combat);
      const inst = combat.piles.hand[0], def = api.resolveCombatCard(combat, inst);
      const eff = (def.effects || []).find(effect => effect.op === op);
      if (!eff) continue; // Some authored effects are added by real class/loadout resolution, not registry rows.
      if (eff.if) {
        const predicateTarget = eff.if.of === 'target' ? combat.enemies[0] : combat.player;
        setAuditPredicate(combat, eff.if, true, predicateTarget);
        assert.equal(api.evalPredicate(combat, eff.if, { owner: combat.player, source: combat.player, target: predicateTarget }), true,
          `${variant.key}: authored condition fixture is true before paid play`);
      }
      if (op === 'buildup') {
        // Chance is authored at 50%; retry fresh deterministic fixtures until a real
        // play produces the pressure event. No status/dispatch function is called directly.
        let played = false;
        for (let attempt = 0; attempt < 16 && !played; attempt++) {
          const seed = 701 + attempt;
          const fixture = makeAuditCombat(api, { classId: actorClass(card, inventory.classes), instance: { ...variant.instance, instanceId: `audit:${cardId}:${variant.key}:${seed}` }, seed, relicIds: [] });
          const c = fixture.combat, cardInst = c.piles.hand[0], definition = api.resolveCombatCard(c, cardInst);
          const targetId = resolvedTarget(api, c, definition), before = stateFor(op, c, cardId, eff), start = c.eventLog.length;
          api.dispatch(c, { type: 'playCard', cardInstanceId: cardInst.instanceId, targetId }); settleAuditChoices(api, c);
          const events = c.eventLog.slice(start);
          if (events.some(e => e.type === 'statusPressure' && e.status === 'frost' && e.cardInstanceId === cardInst.instanceId)) {
            assertContract(op, before, stateFor(op, c, cardId, eff), events, cardInst.instanceId, eff);
            report.contracts.push({ op, cardId, variant: variant.key, result: 'positive', seed, event: 'statusPressure', condition: eff.if || null }); played = true;
          }
        }
        assert.ok(played, `${cardId}: chance-gated authored buildup never triggered over deterministic seed sweep`);
        continue;
      }
      const targetId = resolvedTarget(api, combat, def), before = stateFor(op, combat, cardId, eff), start = combat.eventLog.length;
      api.dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId }); settleAuditChoices(api, combat);
      const events = combat.eventLog.slice(start), receipt = events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === inst.instanceId);
      assert.equal(receipt.length, 1, `${variant.key}: exactly one paid authored card receipt`);
      assert.ok(events.some(e => e.type === 'cardResolved' && e.cardInstanceId === inst.instanceId), `${variant.key}: action queue resolves`);
      if (op === 'poiseDamage') {
        assert.ok(events.some(e => e.type === 'combatCounterArmed' && e.cardInstanceId === inst.instanceId), 'real paid counter card arms its deferred Poise payload');
        const ownerTurn = combat.turn;
        api.dispatch(combat, { type: 'endTurn' }); settleAuditChoices(api, combat);
        assert.ok(combat.turn > ownerTurn, 'enemy turn and following owner turn settle through the real turn loop');
        const reaction = combat.eventLog.slice(start).find(e => e.type === 'combatCounterTriggered' && e.cardId === cardId && e.poiseDamage > 0);
        assert.ok(reaction, 'real enemy action triggers the selected card counter and explicit Poise result');
        const after = stateFor(op, combat, cardId);
        const receiver = combat.enemies.find(enemy => enemy.id === reaction.targetId);
        // actions.js resolves the queued reaction's poiseDamage through
        // stancePressureMultiplier. A Counter return against a target currently
        // in Attack/Smash therefore receives the authored counterMultiplier;
        // the combatCounterTriggered receipt remains the pre-pressure payload.
        const receiverStance = receiver?.combatStance?.maneuver;
        const pressureMultiplier = authoredStanceRules && ['attack', 'smash'].includes(receiverStance)
          ? authoredStanceRules.counterMultiplier : 1;
        const expectedPoiseDelta = Math.floor(reaction.poiseDamage * pressureMultiplier);
        assert.equal(after.poise - before.poise, expectedPoiseDelta,
          `actual enemy meter delta matches counter receipt ${reaction.poiseDamage} × stance pressure ${pressureMultiplier}`);
        report.contracts.push({ op, cardId, variant: variant.key, result: 'deferred-positive', event: 'combatCounterTriggered',
          poiseDamage: reaction.poiseDamage, pressureMultiplier, expectedPoiseDelta,
          beforePoise: before.poise, afterPoise: after.poise, receiverStance });
        continue;
      }
      const after = stateFor(op, combat, cardId, eff);
      assertContract(op, before, after, events, inst.instanceId, eff);
      (op === 'restoreMana' ? report.neutral : report.contracts).push({ op, cardId, variant: variant.key, result: op === 'restoreMana' ? 'funded-neutral-after-payment' : 'positive', event: eventFor[op], condition: eff.if || null, ...(op === 'restoreMana' ? { authoredAmount: eff.amount, funded: eff.funded, beforeMana: before.mana, afterMana: after.mana, maxMana: combat.player.maxMana, paidReceipt: receipt[0] } : {}) });
    }
    assert.ok(report.contracts.some(row => row.op === op) || report.neutral.some(row => row.op === op), `${op}: no real resolved representative was exercised`);
  }
  for (const op of unsupportedOps) {
    const candidates = api.registries.cards.all().filter(card => (card.effects || []).some(effect => effect.op === op));
    report.unsupported.push({ op, status: candidates.length ? 'needs-audited-fixture' : 'no-authored-card-op', authoredCards: candidates.map(card => card.id) });
  }
  // Lifecycle keywords are tested from real card data and owner-turn end, not from
  // direct runOpcode calls. Their meaning is documented separately from DSL ops.
  for (const keyword of ['retain', 'exhaust']) {
    const card = api.registries.cards.all().find(c => (c.keywords || []).includes(keyword) && c.class && c.class !== 'colorless' && !['status', 'curse'].includes(c.type));
    if (!card) { report.unsupported.push({ op: `keyword:${keyword}`, status: 'no-authored-class-card' }); continue; }
    const { combat } = makeAuditCombat(api, { classId: card.class, instance: { cardId: card.id, instanceId: `audit:lifecycle:${keyword}` }, relicIds: [] });
    const inst = combat.piles.hand[0];
    if (keyword === 'retain') {
      api.dispatch(combat, { type: 'endTurn' }); settleAuditChoices(api, combat);
      assert.ok(combat.piles.hand.some(c => c.instanceId === inst.instanceId), `${card.id}: actual owner-turn end retains the card in hand`);
      report.contracts.push({ op: 'keyword:retain', cardId: card.id, result: 'owner-turn-retained' });
    } else {
      const def = api.resolveCombatCard(combat, inst), targetId = resolvedTarget(api, combat, def);
      api.dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId }); settleAuditChoices(api, combat);
      assert.ok(combat.piles.exhaust.some(c => c.instanceId === inst.instanceId), `${card.id}: actual play exhausts the card`);
      report.contracts.push({ op: 'keyword:exhaust', cardId: card.id, result: 'played-to-exhaust' });
    }
  }
  for (const keyword of ['retain', 'exhaust']) {
    report.candidates[`keyword:${keyword}`] = { authoredCardIds: api.registries.cards.all().filter(c => (c.keywords || []).includes(keyword)).map(c => c.id).sort(),
      exercisedRepresentative: report.contracts.find(row => row.op === `keyword:${keyword}`)?.cardId || null };
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await auditCardEffectContracts({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' });
  console.log(JSON.stringify(report));
  if (report.failures.length) process.exitCode = 1;
}
