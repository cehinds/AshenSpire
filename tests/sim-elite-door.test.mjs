// The simulators' elite door freezes the chest before any reward row lands,
// as the game's reward door does (src/main.js): the chest reads the deck as it
// stood at the door, so its owned-upgrade option never names a card the same
// door handed out (PR #1287 review). tools/eliteDoor.mjs is the one step both
// tools/runsim.mjs and tools/measure-classes.mjs run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { rollEliteChest, chestUpgradeable } from '../src/engine/encounters.js';
import { rollChestThenApplyRows } from '../tools/eliteDoor.mjs';

const r = createRegistries(contentBundle);
const CARD = 'shieldBash';

// The door's rows as a simulator lands them: a pile of fresh, upgradeable
// instances of one card (the card row plus skill drafts, exaggerated so the
// old ordering would all but always pick one).
function landRows(run, added) {
  for (let i = 0; i < 30; i++) {
    const inst = { instanceId: `door:${i}:${CARD}`, cardId: CARD, upgraded: false };
    run.deck.push(inst);
    added.add(inst.instanceId);
  }
}

const ownedUpgrade = (chest) => (chest ? chest.options.find((o) => o.category === 'upgrade' && o.mode === 'owned') : null);

test('fixture: the door\'s card is one the chest can upgrade', () => {
  const run = createRunState({ registries: r, classId: 'reaver', seed: 1 });
  assert.ok(r.cards.has(CARD));
  assert.ok(chestUpgradeable(r, run, { instanceId: 'x', cardId: CARD, upgraded: false }));
});

test('the elite chest never offers to upgrade a card from its own door', () => {
  let owned = 0;
  let oldOrderLeaks = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRunState({ registries: r, classId: 'reaver', seed });
    const added = new Set();
    const chest = rollChestThenApplyRows(r, createRng(seed), run, 'elite', () => landRows(run, added));
    assert.equal(added.size, 30, `seed ${seed}: the rows landed`);
    const o = ownedUpgrade(chest);
    if (o) {
      owned += 1;
      assert.ok(!added.has(o.instanceId), `seed ${seed}: the chest names ${o.instanceId}, added by this door`);
    }
    // Control: the pre-fix order (rows first, chest after) does leak, so the
    // assertion above can fail.
    const late = createRunState({ registries: r, classId: 'reaver', seed });
    const lateAdded = new Set();
    landRows(late, lateAdded);
    const leak = ownedUpgrade(rollEliteChest(r, createRng(seed), late));
    if (leak && lateAdded.has(leak.instanceId)) oldOrderLeaks += 1;
  }
  assert.ok(owned > 0, 'some seed offered an owned upgrade');
  assert.ok(oldOrderLeaks > 0, 'rolling after the rows picks a door card — the ordering this test guards');
});

test('off an elite door there is no chest, and the rows still land', () => {
  const run = createRunState({ registries: r, classId: 'reaver', seed: 3 });
  let landed = false;
  assert.equal(rollChestThenApplyRows(r, createRng(3), run, 'normal', () => { landed = true; }), null);
  assert.ok(landed);
});

for (const tool of ['tools/runsim.mjs', 'tools/measure-classes.mjs']) {
  test(`${tool} rolls the elite chest through the shared door step`, () => {
    const src = readFileSync(new URL(`../${tool}`, import.meta.url), 'utf8');
    assert.match(src, /import \{ rollChestThenApplyRows \} from '\.\/eliteDoor\.mjs'/);
    assert.match(src, /rollChestThenApplyRows\(REG, rng, run, pool,/);
    assert.doesNotMatch(src, /rollEliteChest\(/, 'no chest rolled outside the door step');
  });
}
