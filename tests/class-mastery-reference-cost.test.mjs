// A card tap on a phone stalled for seconds because every armament/armour
// lookup through registriesForClassMastery re-scanned every mastery row
// (4305 masteryReferenceOpen calls per card selection, 12383 per enemy tap).
// masteryReferenceOpen must group rows once, not scan them per call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { masteryReferenceOpen } from '../src/model/classMasteryRun.js';
import { masteryRowId } from '../src/model/classMastery.js';

function countedRows(n) {
  const reads = { ref: 0 };
  const rows = Array.from({ length: n }, (_, i) => {
    const row = { classId: i % 2 ? 'reaver' : 'starseer', level: 1 + (i % 7), kind: 'armament', value: i };
    Object.defineProperty(row, 'ref', { enumerable: true, get() { reads.ref += 1; return `armament/item${i}`; } });
    return row;
  });
  return { rows, reads };
}

test('masteryReferenceOpen answers from the rows that name the ref', () => {
  const { rows } = countedRows(40);
  const registries = { classMastery: rows };
  const open = { classMastery: { reaver: { unlockedRows: [masteryRowId(rows[1])] } } };
  assert.equal(masteryReferenceOpen(registries, open, 'armament/item1', ['armament']), true);
  assert.equal(masteryReferenceOpen(registries, { classMastery: {} }, 'armament/item1', ['armament']), false);
  // A different kind never gates the ref; a ref no row names is open.
  assert.equal(masteryReferenceOpen(registries, { classMastery: {} }, 'armament/item1', ['cards']), true);
  assert.equal(masteryReferenceOpen(registries, { classMastery: {} }, 'armament/none', ['armament']), true);
  assert.equal(masteryReferenceOpen({}, { classMastery: {} }, 'armament/item1'), true);
});

test('masteryReferenceOpen never rescans the rows per call', () => {
  const { rows, reads } = countedRows(600);
  const registries = { classMastery: rows };
  const meta = { classMastery: {} };
  for (let i = 0; i < 2000; i += 1) masteryReferenceOpen(registries, meta, `armament/item${i % 600}`, ['armament']);
  // One grouping pass reads each row's ref once and a lookup reads only its own
  // row; the per-call scan read all 600 rows' refs on every call (1.2 million).
  assert.ok(reads.ref <= rows.length + 2000 * 2, `rows' ref read ${reads.ref} times for 2000 lookups`);
});
