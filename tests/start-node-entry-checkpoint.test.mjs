import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const refill = readFileSync(new URL('../src/model/nodeRefill.js', import.meta.url), 'utf8');
const grace = readFileSync(new URL('../src/model/gracerefill.js', import.meta.url), 'utf8');
function declaration(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, name + ' closing boundary');
  return source.slice(start, end + 2);
}
// Execute the real travel/RAF/encounter/checkpoint path. Only imported services
// and combat construction AFTER the entry checkpoint are detached boundaries.
function fixture({ full = false, scarce = false, refillEnabled = true } = {}) {
  const run = {
    hp: 2, maxHp: 10, custom: scarce ? {} : null, floor: 0, path: [],
    mapNodeId: null, lastEncounters: [],
    flaskCharges: { hp: 3, mana: 2, hpCurrent: 0, manaCurrent: 0 },
    mapGraph: { nodes: { n1_0: { id: 'n1_0', type: 'fight', floor: 1, refill: refillEnabled } } },
  };
  const saves = [], warnings = [], frames = [], tasks = [], entered = [];
  const context = vm.createContext({
    run, shotState: null, activeSlot: 1, rng: {}, fightEntryPending: false,
    registries: { balance: { customMods: { lessHealingMult: 0.5 } } },
    sfx: { play() {} }, clearRestRevisitOnTravel() {},
    activeMods: () => ({ lessHealing: scarce }), currentSeat: () => 'weald',
    contentAct: () => 1, rollEncounter: () => 'opening-encounter',
    refreshRunClassMastery() {}, stampSkillBonuses() {}, sendLanStatus() {},
    saves: { loadMeta: () => ({}), saveRun(value) {
      saves.push(JSON.parse(JSON.stringify(value)));
      if (full) throw new Error('QuotaExceededError');
    } },
    reportAutosaveFailure: error => warnings.push(error.message),
    app: { setAttribute() {}, removeAttribute() {} },
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout: callback => tasks.push(callback),
    recordEntered: () => entered.push(run.combatEntered.encounterId),
  });
  const entry = declaration(main, 'enterCombat');
  const checkpointEnd = entry.indexOf('  const enc = combatEncounterFor');
  assert.ok(checkpointEnd > 0, 'real encounter receipt and guarded checkpoint boundary');
  vm.runInContext([
    declaration(grace, 'refillFlaskCharges'),
    declaration(refill, 'applyNodeRefill'),
    declaration(main, 'persist'), declaration(main, 'persistOrWarn'),
    declaration(main, 'enterNode'), declaration(main, 'startFight'),
    declaration(main, 'startFightNow'),
    entry.slice(0, checkpointEnd) + '  recordEntered();\n}',
  ].join('\n'), context);
  return {
    run, saves, warnings, entered,
    enter: () => vm.runInContext("enterNode('n1_0')", context),
    paint: () => { while (frames.length) frames.shift()(); while (tasks.length) tasks.shift()(); },
  };
}
for (const full of [false, true]) {
  test('start-node entry checkpoints the encounter, even with storage full=' + full, () => {
    const f = fixture({ full });
    assert.doesNotThrow(f.enter);
    assert.equal(f.saves.length, 0, 'never save a visited start without an encounter receipt during the RAF yield');
    assert.equal(f.run.hp, 10);
    assert.deepEqual(f.run.path, ['n1_0']);
    assert.equal(f.run.mapNodeId, 'n1_0');
    assert.doesNotThrow(f.paint);
    assert.deepEqual(f.entered, ['opening-encounter']);
    assert.equal(f.saves.length, 1, 'only the destination checkpoint writes');
    assert.equal(f.saves[0].combatEntered.encounterId, 'opening-encounter');
    assert.equal(f.saves[0].hp, 10);
    assert.equal(f.saves[0].flaskCharges.hpCurrent, 3);
    assert.equal(f.saves[0].flaskCharges.manaCurrent, 2);
    assert.equal(f.warnings.length, Number(full));
    f.run.hp = 4; f.run.flaskCharges.hpCurrent = 0;
    f.enter(); f.paint();
    assert.equal(f.run.hp, 4, 'revisiting never grants the refill again');
    assert.equal(f.run.flaskCharges.hpCurrent, 0);
    assert.deepEqual(f.run.path, ['n1_0']);
  });
}
test('Scarce Embers refill and disabled/legacy refill retain their entry semantics', () => {
  const scarce = fixture({ scarce: true });
  scarce.enter(); scarce.paint();
  assert.equal(scarce.run.hp, 6);
  assert.equal(scarce.saves[0].hp, 6);
  const disabled = fixture({ refillEnabled: false });
  disabled.enter(); disabled.paint();
  assert.equal(disabled.run.hp, 2);
  assert.equal(disabled.run.flaskCharges.hpCurrent, 0);
  assert.equal(disabled.saves.length, 1);
  assert.deepEqual(disabled.entered, ['opening-encounter']);
});
