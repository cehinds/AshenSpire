// Trader and Blacksmith re-entry (owner, 2026-11-18): like a rest site, a shop node you left and still stand on re-opens, until you
// travel to another node. One record serves all three (src/model/restRevisit.js); a save with only an old `restRevisit` still loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import {
  openRestRecord, OpenSiteRecord, SiteRevisitKind, markRestLeft, restRevisitNodeId, clearRestRevisitOnTravel,
} from '../src/model/restRevisit.js';

const REG = createRegistries(contentBundle);
const standingOn = nodeId => { const run = createRunState({ seed: 1, classId: 'reaver', registries: REG }); run.mapNodeId = nodeId; return run; };

for (const kind of ['shop', 'blacksmith']) {
  test(`a left ${kind} node stays enterable until another node is chosen`, () => {
    const run = standingOn('n4_1');
    assert.equal(restRevisitNodeId(run), null);
    const record = OpenSiteRecord(run, kind);
    assert.equal(SiteRevisitKind(record), kind);
    assert.equal(restRevisitNodeId(run), 'n4_1', 'the node is the re-entry target while its record exists');
    assert.equal(OpenSiteRecord(run, kind), record, 'a re-entry reuses the record');
    markRestLeft(run);
    assert.equal(run.restRevisit.left, true);
    assert.equal(restRevisitNodeId(run), 'n4_1');
    clearRestRevisitOnTravel(run, 'n4_1');
    assert.equal(restRevisitNodeId(run), 'n4_1', 'clicking the same node is not travel');
    clearRestRevisitOnTravel(run, 'n5_1');
    assert.equal(run.restRevisit, undefined, 'travel ends re-entry');
  });
}

test('a Blacksmith keeps the stock it was left with', () => {
  const run = standingOn('n4_1');
  const record = OpenSiteRecord(run, 'blacksmith');
  record.stock = { kind: 'blacksmith', offerings: [] };
  const saved = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))), REG);
  assert.deepEqual(saved.restRevisit.stock, { kind: 'blacksmith', offerings: [] });
});

test('a record for another place is replaced, not reused', () => {
  const run = standingOn('n4_1');
  OpenSiteRecord(run, 'shop');
  run.mapNodeId = 'n6_0';
  assert.equal(restRevisitNodeId(run), null);
  const record = OpenSiteRecord(run, 'shop');
  assert.equal(record.nodeId, 'n6_0');
});

test('an old save with only restRevisit loads and reads as a rest site', () => {
  const run = standingOn('n1');
  openRestRecord(run);
  assert.equal(Object.hasOwn(run.restRevisit, 'kind'), false, 'rest records carry no kind, as saved before');
  assert.equal(SiteRevisitKind(run.restRevisit), 'rest');
  const data = JSON.parse(JSON.stringify(serializeRun(run)));
  assert.doesNotThrow(() => validateRunShape(data));
  const loaded = deserializeRun(data, REG);
  assert.equal(loaded.restRevisit.nodeId, 'n1');
  assert.equal(restRevisitNodeId(loaded), 'n1');
  assert.equal(SiteRevisitKind(loaded.restRevisit), 'rest');
});

// Blacksmith stock: a node's own Blacksmith and the workshop a trader keeps both hold their stock across leave and re-entry.
import { VisitSiteStock, StashSiteStock } from '../src/model/restRevisit.js';
for (const [label, kind, slot] of [['a Blacksmith node', 'blacksmith', 'stock'], ['a trader\'s Blacksmith', 'shop', 'smithStock']]) {
  test(`${label}: buy, leave, re-enter shows the same stock minus the purchase, with no new roll`, () => {
    const run = standingOn('n4_1');
    OpenSiteRecord(run, kind);
    let rolls = 0;
    const roll = () => { rolls++; return { kind: 'blacksmith', offerings: ['a', 'b', 'c'] }; };
    run.shopStock = VisitSiteStock(run, slot, roll);
    assert.equal(rolls, 1);
    run.shopStock.offerings = run.shopStock.offerings.filter(id => id !== 'b'); // bought
    StashSiteStock(run, slot, run.shopStock); // back to the trader / leave
    run.shopStock = null;                      // the trader's Leave clears the live stock
    markRestLeft(run);
    // Survives a save and load between visits.
    const loaded = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))), REG);
    run.restRevisit = loaded.restRevisit;
    run.shopStock = VisitSiteStock(run, slot, roll);
    assert.equal(rolls, 1, 're-entry never re-rolls');
    assert.deepEqual(run.shopStock.offerings, ['a', 'c']);
  });
}
