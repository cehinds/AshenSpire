// SPEC §14.3 — a quest event bought at an atlas market that starts a fight
// (Codex P1 on #1377). The fight is exactly the event's encounter, never the
// journey node's, and winning it neither advances nor completes the journey
// node; the run returns to the atlas as after any event.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { generateJourney, journeyGraph, journeyEncounter } from '../src/model/worldAtlas.js';
import { combatEncounterFor, victoryCompletesJourneyNode, serviceEventCombatEntry } from '../src/model/serviceCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const REG = createRegistries(contentBundle);
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

// An event whose choice starts a fight (the keeper's "Stand your ground").
const fightEvent = REG.events.all().find((def) => (def.choices || []).some((choice) => (choice.effects || []).some((eff) => eff.op === 'startCombat' && !eff.if)));
const fightEncounterId = fightEvent.choices.flatMap((choice) => choice.effects || []).find((eff) => eff.op === 'startCombat' && !eff.if).encounterId;

function atlasRun() {
  const run = createRunState({ seed: 11, classId: 'reaver', registries: REG });
  run.journey = generateJourney('QUESTFIGHT');
  run.mapGraph = journeyGraph(run.journey);
  return run;
}

test('an atlas quest event\'s fight is exactly the event\'s encounter, not the journey node\'s', () => {
  const run = atlasRun();
  const nodeId = run.journey.currentNodeId;
  run.combatEntered = serviceEventCombatEntry(nodeId, fightEncounterId);
  assert.deepEqual(run.combatEntered, { nodeId, encounterId: fightEncounterId, serviceEvent: true });
  assert.deepEqual(validateRunShape(run), [], 'the entry is a well-formed save');
  const enc = combatEncounterFor(REG, run, run.combatEntered);
  assert.equal(enc.id, fightEncounterId);
  assert.deepEqual(enc.enemies, REG.encounters.get(fightEncounterId).enemies);
  // Without the flag, an atlas fight is the node's own (the old behaviour a
  // node fight keeps), whatever id the receipt carries.
  let nodeEnc = null;
  try { nodeEnc = journeyEncounter(run.journey, nodeId, REG); } catch { nodeEnc = null; }
  if (nodeEnc) assert.equal(combatEncounterFor(REG, run, { nodeId, encounterId: fightEncounterId }).id, nodeEnc.id);
  // A malformed flag is refused by name.
  run.combatEntered = { nodeId, encounterId: fightEncounterId, serviceEvent: 'yes' };
  assert.ok(validateRunShape(run).some((p) => /combatEntered\.serviceEvent/.test(p)));
});

test('winning an atlas quest event\'s fight neither advances nor completes the journey node', () => {
  const run = atlasRun();
  run.combatEntered = serviceEventCombatEntry(run.journey.currentNodeId, fightEncounterId);
  assert.equal(victoryCompletesJourneyNode(run), false);
  // A node fight still completes its node.
  run.combatEntered = { nodeId: run.journey.currentNodeId, encounterId: fightEncounterId };
  assert.equal(victoryCompletesJourneyNode(run), true);
  // A classic map has no journey node to complete.
  const classic = createRunState({ seed: 11, classId: 'reaver', registries: REG });
  classic.combatEntered = serviceEventCombatEntry('n1', fightEncounterId);
  assert.equal(victoryCompletesJourneyNode(classic), false);
});

test('a quest event\'s fight saved mid-combat through the real snapshot path reloads as that fight, and still completes no node (Codex P1 on #1377)', () => {
  const run = atlasRun();
  const nodeId = run.journey.currentNodeId;
  run.combatEntered = serviceEventCombatEntry(nodeId, fightEncounterId);
  const rng = createRng(11);
  const combat = createRunCombat({ registries: REG, rng, run, enemyIds: REG.encounters.get(fightEncounterId).enemies });
  // Save Game / Save and Quit: the exact committed turn.
  commitCombatSnapshot({ run, combat, nodeId, encounterId: fightEncounterId });
  assert.equal(run.combatEntered.serviceEvent, true, 'the snapshot writer keeps the flag');
  assert.ok(run.combatEntered.snapshot);
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, rng);
  const back = createSaveManager(storage).loadRun(REG);
  assert.ok(back, 'the save loads');
  assert.equal(back.combatEntered.serviceEvent, true, 'the flag survives the reload');
  assert.equal(combatEncounterFor(REG, back, back.combatEntered).id, fightEncounterId, 'it resumes the event\'s own encounter');
  assert.equal(victoryCompletesJourneyNode(back), false, 'and a win still completes no node');
  // A node fight's snapshot stays a node fight.
  const plain = atlasRun();
  plain.combatEntered = { nodeId, encounterId: fightEncounterId };
  commitCombatSnapshot({ run: plain, combat: createRunCombat({ registries: REG, rng: createRng(11), run: plain, enemyIds: REG.encounters.get(fightEncounterId).enemies }), nodeId, encounterId: fightEncounterId });
  assert.equal(plain.combatEntered.serviceEvent, undefined);
});

test('main.js carries the quest event\'s fight as a service-event combat and returns to the atlas', () => {
  // The quest door opens the event as a service event…
  const door = main.slice(main.indexOf('enterQuestEvent:'), main.indexOf('enterQuestEvent:') + 900);
  assert.match(door, /showEvent\(eventId, \{ serviceEvent: true \}\)/);
  // …whose startCombat enters the event's own encounter with the flag…
  const show = main.slice(main.indexOf('function showEvent('), main.indexOf('function showEvent(') + 1400);
  assert.match(show, /enterCombat\(nodeId, encounterId, \{ serviceEvent \}\)/);
  // …the fight reads its encounter and the victory reads its node through the one helper each…
  assert.match(main, /combatEncounterFor\(registries, run, run\.combatEntered\)/);
  assert.match(main, /victoryCompletesJourneyNode\(run\)/);
  assert.doesNotMatch(main, /else if \(run\.journey\) completeJourneyNode\(run\.journey\);\n  run\.combatEntered = null;/);
  // …and a resumed save keeps the flag.
  assert.match(main, /enterCombat\(run\.combatEntered\.nodeId, run\.combatEntered\.encounterId, \{ resuming: true, serviceEvent: run\.combatEntered\.serviceEvent === true \}\)/);
});
