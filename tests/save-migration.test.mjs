// tests/save-migration.test.mjs — every run schema a build ever wrote comes
// forward to the current one, and a save from a NEWER build is refused and
// kept exactly as it was (SPEC §3.12; FINISH §13 "The save-migration test
// covers the 1.0 schema").
//   node --test tests/save-migration.test.mjs
//
// The corpus is tests/fixtures/run-save-schema-versions.json: one entry per
// schemaVersion, each the exact bytes that version's last build wrote with its
// own saveRun (provenance in the file). The saves enter as BYTES under the real
// slot key and go through createSaveManager().loadRun — the door the game uses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY } from '../src/engine/save.js';

const REG = createRegistries(contentBundle);
const CORPUS = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));

function managerHolding(bytes) {
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, bytes);
  return { storage, saves: createSaveManager(storage) };
}

test('the corpus holds one real save for every run schema from v1 to the current one', () => {
  const want = Array.from({ length: RUN_SCHEMA_VERSION }, (_, i) => String(i + 1));
  assert.deepEqual(Object.keys(CORPUS.versions), want,
    `RUN_SCHEMA_VERSION is ${RUN_SCHEMA_VERSION}: capture the last build of each version into the corpus (see its _provenance)`);
  for (const [v, entry] of Object.entries(CORPUS.versions)) {
    assert.equal(JSON.parse(entry.bytes).schemaVersion, Number(v), `entry ${v} carries the stamp its build wrote`);
    assert.match(entry.ref, /^[0-9a-f]{7,40}$/, `entry ${v} names the ref that wrote it`);
  }
});

for (const [v, entry] of Object.entries(CORPUS.versions)) {
  test(`a schema-${v} save (written at ${entry.ref}) loads and migrates to schema ${RUN_SCHEMA_VERSION}`, () => {
    const { storage, saves } = managerHolding(entry.bytes);
    const run = saves.loadRun(REG);
    const status = saves.runStatus();
    assert.ok(run, `schema ${v} refused: ${status.reason}`);
    assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
    assert.notEqual(status.state, 'archived');
    assert.equal(storage.getItem(RUN_ARCHIVE_KEY), null, 'nothing was archived');
    const saved = JSON.parse(entry.bytes);
    for (const field of ['seed', 'seedString', 'class', 'floor', 'actNumber', 'mapNodeId', 'cinders', 'relics']) {
      assert.deepEqual(run[field], saved[field], `${field} came forward unchanged`);
    }
    // maxHp is DERIVED (SPEC §3.12: re-derived under the current rules at the
    // load door); what the player owns is the wound, so the deficit is kept.
    assert.equal(run.maxHp - run.hp, saved.maxHp - saved.hp, 'the HP deficit came forward');
    // The deck is re-stamped from the loadout (equipment grants cards), so it
    // may GAIN granted cards; it may never lose one the save held.
    const now = new Map(run.deck.map((c) => [c.instanceId, c.cardId]));
    for (const card of saved.deck) {
      assert.equal(now.get(card.instanceId), card.cardId, `deck card ${card.instanceId} (${card.cardId}) came forward`);
    }
    // Migrated means CURRENT: written back by this build and read again, the
    // run needs no second migration and no heal.
    saves.saveRun(run);
    assert.equal(JSON.parse(storage.getItem(RUN_KEY)).schemaVersion, RUN_SCHEMA_VERSION);
    const again = saves.loadRun(REG);
    assert.ok(again, `the re-saved schema-${v} run loads: ${saves.runStatus().reason}`);
    assert.equal(saves.runStatus().state, 'ok', 'a migrated run re-saved is a current save — nothing left to fill in');
  });
}

test('a save from a newer schema is refused, and the stored save is left untouched', () => {
  const current = JSON.parse(CORPUS.versions[String(RUN_SCHEMA_VERSION)].bytes);
  for (const newer of [RUN_SCHEMA_VERSION + 1, RUN_SCHEMA_VERSION + 99]) {
    const bytes = JSON.stringify({ ...current, schemaVersion: newer, fieldOnlyTheNewerBuildKnows: { kept: true } });
    const { storage, saves } = managerHolding(bytes);
    assert.equal(saves.loadRun(REG), null, `schema ${newer} is refused`);
    const status = saves.runStatus();
    assert.equal(status.state, 'newer', 'the refusal is named as a newer save, not a corrupt one');
    assert.match(status.reason, new RegExp(`schemaVersion ${newer} is newer than this build \\(${RUN_SCHEMA_VERSION}\\)`));
    assert.equal(storage.getItem(RUN_KEY), bytes, 'the slot still holds the exact bytes the newer build wrote');
    assert.equal(storage.getItem(RUN_ARCHIVE_KEY), null, 'nothing was moved to the archive');
    assert.equal(saves.hasRun(), true, 'the slot still reads as occupied');
  }
});
