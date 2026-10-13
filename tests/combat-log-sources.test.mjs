// Every combat log line names its source (the actor and the card, move, status,
// relic or stance) and its target; a hit shows its calculation; an Evade names
// the evader and the attack, and a failed Evade is logged too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { combatLogEntries } from '../src/model/combatLog.js';

const registries = createRegistries(contentBundle);
const enemies = [{ id: 'e1', enemyId: 'wyrmLord' }, { id: 'e2', enemyId: 'wanderingSoldier' }];
const log = events => combatLogEntries(events, { registries, enemies }).map(row => row.text);
// Moves carry no authored name: the log words the move id ('goldenBulwark' → 'Golden Bulwark').
const move = (enemyId, moveId) => registries.enemies.get(enemyId).moves[moveId].name
  || moveId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());

test('Block, Barrier and heals name the move, card or stance that raised them', () => {
  const guard = Object.keys(registries.enemies.get('wanderingSoldier').moves).find(id => registries.enemies.get('wanderingSoldier').moves[id].block);
  const lines = log([
    { type: 'blockGained', sourceId: 'e2', targetId: 'e2', amount: 6, moveId: guard },
    { type: 'barrierGained', sourceId: 'player', targetId: 'player', amount: 8, cardId: 'crystalBarrier' },
    { type: 'blockGained', targetId: 'e1', amount: 1, source: 'defendStance' },
    { type: 'healed', sourceId: 'e1', targetId: 'e1', amount: 6, moveId: 'goldenBulwark' },
    { type: 'barrierGained', sourceId: 'player', targetId: 'e1', amount: 3, cardId: 'crystalBarrier' },
  ]);
  assert.deepEqual(lines, [
    `Wandering Soldier gained 6 Block (${move('wanderingSoldier', guard)}).`,
    'Forsaken gained 8 Barrier (Crystal Barrier).',
    'Wyrm Lord gained 1 Block (Defend stance).',
    `Wyrm Lord recovered 6 HP (${move('wyrmLord', 'goldenBulwark')}).`,
    "Wyrm Lord gained 3 Barrier (Forsaken's Crystal Barrier).",
  ]);
});

test('a status names who applied it and from what; a tick names the status', () => {
  const lines = log([
    { type: 'statusApplied', sourceId: 'player', targetId: 'e1', status: 'crimsonBlight', stacks: 2, cardId: 'blightTouch' },
    { type: 'statusApplied', sourceId: 'player', targetId: 'player', status: 'starstoneCharge', stacks: 1, cardId: 'crystalBarrier' },
    { type: 'statusApplied', sourceId: 'e1', targetId: 'player', status: 'bleeding', stacks: 1, moveId: 'halberdReign' },
    { type: 'hpLost', targetId: 'e1', amount: 1, cause: 'effect', triggeredBy: { kind: 'status', id: 'crimsonBlight', ownerId: 'e1' } },
    { type: 'statusApplied', sourceId: 'e2', targetId: 'player', status: 'weak', stacks: 1 },
  ]);
  assert.deepEqual(lines, [
    "Wyrm Lord gained 2 Crimson Blight (Forsaken's Blight Touch).",
    'Forsaken gained Starstone Charge (Crystal Barrier).',
    `Forsaken gained ${registries.statuses.get('bleeding').name} (Wyrm Lord's ${move('wyrmLord', 'halberdReign')}).`,
    'Wyrm Lord lost 1 HP (Crimson Blight).',
    `Forsaken gained ${registries.statuses.get('weak').name} (from Wandering Soldier).`,
  ]);
});

test('an event with no cause of its own takes the card or move resolving for that actor', () => {
  const lines = log([
    { type: 'enemyMoveStarted', sourceId: 'e1', enemyId: 'wyrmLord', moveId: 'goldenBulwark' },
    { type: 'blockGained', sourceId: 'e1', targetId: 'e1', amount: 16 },
    { type: 'enemyTurnEnd' },
    { type: 'blockGained', sourceId: 'e1', targetId: 'e1', amount: 2 },
  ]);
  const name = move('wyrmLord', 'goldenBulwark');
  assert.deepEqual(lines, [`Wyrm Lord used ${name}.`, `Wyrm Lord gained 16 Block (${name}).`, 'Wyrm Lord gained 2 Block.']);
});

test('a hit names the attack and shows base, typed resistance or weakness, each layer and the HP dealt', () => {
  const [weak, resisted] = log([
    { type: 'damageDealt', sourceId: 'player', targetId: 'e2', cardId: 'strike', amount: 8, blocked: 3, blockRemaining: 0,
      base: 6, incoming: 6, damageType: 'blunt' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', moveId: 'halberdReign', amount: 4, blocked: 0, base: 12, incoming: 15,
      damageType: 'slashing', wardAbsorbed: 5, wardRemaining: 0 },
  ]);
  assert.equal(weak, "Forsaken's Strike hit Wandering Soldier for 6: Blunt weakness +2 (6 → 8), Block absorbed 3 (3 → 0); 5 HP dealt.");
  assert.equal(resisted, `Wyrm Lord's ${move('wyrmLord', 'halberdReign')} hit Forsaken for 12: modifiers +3 (12 → 15), `
    + 'Slashing resisted 6 (15 → 9), Ward absorbed 5 (5 → 0); 4 HP dealt.');
  // An older event without `incoming` reads its typed reduction from `resisted`.
  assert.match(log([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 5, blocked: 0, resisted: 3, damageType: 'fire' }])[0],
    /for 8: Fire resisted 3 \(8 → 5\); 5 HP dealt\.$/);
});

test('an Evade names the evader and the attack; a failed Evade and a failed distance roll are logged', () => {
  const at = { sourceId: 'e1', targetId: 'player', moveId: 'halberdReign' };
  const name = move('wyrmLord', 'halberdReign');
  assert.deepEqual(log([
    { type: 'combatAvoidanceResolved', ...at, avoided: true, evade: { roll: 17, total: 17, difficulty: 16, success: true } },
    { type: 'combatAvoidanceResolved', ...at, avoided: false, evade: { roll: 9, total: 9, difficulty: 16, success: false } },
    { type: 'combatAvoidanceResolved', ...at, avoided: false, distance: { roll: 40, chance: 20, success: false } },
    { type: 'combatAvoidanceResolved', ...at, avoided: true, prevention: 'decoy' },
  ]), [
    `Forsaken evaded Wyrm Lord's ${name}: Evade roll 17 beat 16.`,
    `Forsaken's Evade failed against Wyrm Lord's ${name}: rolled 9, needed more than 16.`,
    `Forsaken's range failed against Wyrm Lord's ${name}: distance rolled 40, needed 20 or less.`,
    `Forsaken avoided Wyrm Lord's ${name} (Decoy).`,
  ]);
});

test('breaks, Ward refills and deaths name what caused them', () => {
  assert.deepEqual(log([
    { type: 'wardBroken', sourceId: 'player', targetId: 'e1', cardId: 'strike', interrupted: true },
    { type: 'wardBroken', sourceId: 'player', targetId: 'player', statusId: 'crimsonBlight', staminaLoss: 1 },
    { type: 'barrierBroken', sourceId: 'e1', targetId: 'player', moveId: 'halberdReign' },
    { type: 'persistentWardChanged', sourceId: 'player', targetId: 'player', cardId: 'crystalBarrier', restored: 3, value: 5, max: 10 },
    { type: 'enemyDied', sourceId: 'player', targetId: 'e2', cardId: 'strike', enemyId: 'wanderingSoldier' },
  ]), [
    "Wyrm Lord's Ward broke (by Forsaken's Strike; interrupted).",
    "Forsaken's Ward broke (by Crimson Blight flux; −1 Stamina next turn).",
    `Forsaken's Barrier broke (Wyrm Lord's ${move('wyrmLord', 'halberdReign')}).`,
    'Forsaken restored 3 Ward (2 → 5) from Crystal Barrier.',
    "Wandering Soldier was defeated by Forsaken's Strike.",
  ]);
});

test('one Bashing Blow logs each stagger-meter impact with its own cause, and a relic names itself', () => {
  const c = createCombat({ registries, rng: createRng(998), combatExpansionVersion: 2, ratingsRules: resolveCombatRatings({}, contentBundle),
    player: { id: 'p1', classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, maxStamina: 5, energyMax: 5, drawPerTurn: 3,
      relicIds: ['forsakenMedallion'], attributes: { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 },
      deck: Array.from({ length: 5 }, (_, i) => ({ instanceId: `s${i}`, cardId: 'bashingBlow', upgraded: false })) },
    enemyIds: ['valkyrieShade'] });
  dispatch(c, { type: 'playCard', cardInstanceId: c.piles.hand[0].instanceId, targetId: c.enemies[0].id });
  const impacts = c.eventLog.filter(event => event.type === 'ratingImpact');
  assert.deepEqual(impacts.map(event => event.cause), ['hit', 'rider:blunt', 'poiseDamage', 'trait:impact', 'relic:forsakenMedallion']);
  const lines = combatLogEntries(c.eventLog, { registries, enemies: c.enemies }).map(row => row.text).filter(text => text.includes('stagger meter'));
  const relic = registries.relics.get('forsakenMedallion').name;
  assert.deepEqual(lines.map(text => text.replace(/ \(\d+\/\d+(, broke)?\)\.$/, '')), [
    "Valkyrie Shade's stagger meter took 1 from the hit (Forsaken's Bashing Blow)",
    "Valkyrie Shade's stagger meter took 2 from Blunt (Forsaken's Bashing Blow)",
    "Valkyrie Shade's stagger meter took 4 from Poise damage (Forsaken's Bashing Blow)",
    "Valkyrie Shade's stagger meter took 4 from Impact (Forsaken's Bashing Blow)",
    `Valkyrie Shade's stagger meter took 4 from Forsaken's ${relic}`,
  ]);
  for (const text of lines) assert.match(text, /\(\d+\/\d+(, broke)?\)\.$/, 'each line ends with the meter after it');
});

test('engine events carry their cause: an enemy move stamps moveId, a status tick stamps triggeredBy', () => {
  const c = createCombat({ registries, rng: createRng(7), combatExpansionVersion: 2, hpMult: 4,
    player: { id: 'p1', classId: 'herald', maxHp: 80, maxMana: 10, maxStamina: 5, energyMax: 5, drawPerTurn: 6, relicIds: [],
      deck: Array.from({ length: 8 }, (_, i) => ({ instanceId: `c${i}`, cardId: i % 2 ? 'strike' : 'blightTouch', upgraded: false })) },
    enemyIds: ['wyrmLord'] });
  for (let turn = 0; turn < 4 && !c.result; turn++) {
    for (const card of [...c.piles.hand]) { try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' }); } catch {} }
    try { dispatch(c, { type: 'endTurn' }); } catch { break; }
  }
  const fromMove = c.eventLog.filter(event => ['blockGained', 'healed', 'statusApplied'].includes(event.type) && event.sourceId === 'e1');
  assert.ok(fromMove.length > 0 && fromMove.every(event => event.moveId), 'every enemy move effect names its move');
  const ticks = c.eventLog.filter(event => event.type === 'hpLost' && event.cause === 'effect');
  assert.ok(ticks.length > 0 && ticks.every(event => event.triggeredBy?.kind === 'status'), 'every status tick names its status');
  const lines = combatLogEntries(c.eventLog, { registries, enemies: c.enemies }).map(row => row.text);
  for (const text of lines.filter(line => / (gained|recovered|lost) /.test(line))) assert.match(text, /\(.+\)\.$/, `${text} names its cause`);
});

test('a hidden charging enemy logs its Block and Barrier as preparing, never naming the move', () => {
  for (const combatExpansionVersion of [1, 2]) {
    const charging = createRegistries({ ...contentBundle,
      balance: { ...contentBundle.balance, combatIntent: { ...contentBundle.balance.combatIntent,
        baseHiddenChance: 1, minimumHiddenChance: 1, maximumHiddenChance: 1, wisdomReduction: 0, intelligenceReduction: 0 } },
      enemies: contentBundle.enemies.map(enemy => enemy.id === 'fellWarden' ? { ...enemy, firstMove: 'heldBlade' } : enemy),
      enemyMoves: contentBundle.enemyMoves.map(row => row.enemyId === 'fellWarden' && row.id === 'heldBlade'
        ? { ...row, delay: { turns: 1, whileCharging: { block: 8, barrier: 3 } } } : row) });
    const c = createCombat({ registries: charging, rng: createRng(11), combatExpansionVersion, hpMult: 4,
      player: { id: 'p1', classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, maxStamina: 5, energyMax: 5, drawPerTurn: 3, relicIds: [],
        deck: Array.from({ length: 6 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'strike', upgraded: false })) },
      enemyIds: ['fellWarden'] });
    assert.equal(c.enemies[0].intent.moveId, 'heldBlade');
    dispatch(c, { type: 'endTurn' });
    assert.equal(c.enemies[0].pendingMove?.moveId, 'heldBlade', `v${combatExpansionVersion}: the Warden is charging`);
    const gains = c.eventLog.filter(event => ['blockGained', 'barrierGained'].includes(event.type) && event.sourceId === 'e1');
    assert.deepEqual(gains.map(event => event.type).sort(), ['barrierGained', 'blockGained']);
    for (const event of gains) {
      assert.equal(event.moveId, undefined, `v${combatExpansionVersion}: ${event.type} carries no moveId`);
      assert.equal(event.preparing, true);
    }
    const name = move('fellWarden', 'heldBlade');
    const warden = charging.enemies.get('fellWarden').name;
    const lines = combatLogEntries(c.eventLog, { registries: charging, enemies: c.enemies }).map(row => row.text);
    assert.ok(lines.includes(`${warden} gained 8 Block (preparing).`), lines.join('\n'));
    assert.ok(lines.includes(`${warden} gained 3 Barrier (preparing).`), lines.join('\n'));
    for (const text of lines) assert.ok(!text.includes(name), `the log never names the hidden move: ${text}`);
  }
});
