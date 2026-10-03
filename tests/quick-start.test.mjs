// tests/quick-start.test.mjs — the Title's Quick start (docs/FINISH.md §6).
//
// The input count itself needs a browser: tools/quick-start-inputs.mjs walks
// Title -> Quick start -> first card play with real input and judges it against
// the FINISH budget (.github/workflows/quick-start.yml). This file pins what a
// node run can see: the defaults are data, refused by name when they do not
// resolve, begin a real run, and the Title and the composition root are wired
// to them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { characterCreationProblems, quickStartRunConfig } from '../src/model/characterCreation.js';
import { createRunState } from '../src/model/state.js';
import { seedFromString } from '../src/engine/rng.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REG = createRegistries(contentBundle);
const authored = JSON.parse(readFileSync(new URL('../content/source/characterCreation.json', import.meta.url), 'utf8')).quickStart;

test('the shipped quick start row is valid and reads as authored', () => {
  assert.deepEqual(characterCreationProblems(REG).filter((p) => p.includes('quickStart')), []);
  const cfg = quickStartRunConfig(REG);
  assert.equal(cfg.classId, authored.classId);
  assert.equal(cfg.keepsakeId, authored.keepsakeId);
  assert.equal(cfg.attributeMode, authored.attributeMode);
  assert.equal(cfg.skipOpening, authored.skipOpening);
  assert.equal(cfg.startingRelicId, REG.classes.get(authored.classId).startingRelic);
});

test('a quick start row that does not resolve is refused by name', () => {
  const cases = [
    [{ ...authored, classId: 'nobody' }, 'characterCreation.quickStart.classId'],
    [{ ...authored, keepsakeId: 'nothingAtAll' }, 'characterCreation.quickStart.keepsakeId'],
    [{ ...authored, attributeMode: 'freeform' }, 'characterCreation.quickStart.attributeMode'],
    [{ ...authored, skipOpening: 'yes' }, 'characterCreation.quickStart.skipOpening'],
    [{ ...authored, seed: 'ABC' }, 'characterCreation.quickStart.seed: Unknown field'],
    [undefined, 'characterCreation.quickStart: must be an object'],
  ];
  for (const [row, expected] of cases) {
    const source = { ...REG, characterCreation: { ...REG.characterCreation, quickStart: row } };
    const problems = characterCreationProblems(source);
    assert.ok(problems.some((p) => p.startsWith(expected)), `${expected} — got ${JSON.stringify(problems)}`);
  }
});

test('the quick start config begins a real run with a dealt deck', () => {
  const cfg = quickStartRunConfig(REG);
  const run = createRunState({ seed: seedFromString('QUICK'), classId: cfg.classId, registries: REG, startingRelicId: cfg.startingRelicId, attributeMode: cfg.attributeMode });
  assert.equal(run.class, cfg.classId);
  assert.ok(Array.isArray(run.deck) && run.deck.length > 0, 'the run has a starting deck');
});

test('the Title offers Quick start and the composition root begins it without the character workspace', () => {
  const title = readFileSync(`${ROOT}src/ui/screens/title.js`, 'utf8');
  assert.match(title, /entry\(t\('title\.quickstart'\), 'quick-start'/);
  assert.match(title, /action === 'quick-start'\) onQuickStart\?\.\(\)/);
  const main = readFileSync(`${ROOT}src/main.js`, 'utf8');
  assert.match(main, /onQuickStart: \(\) => \{[\s\S]{0,400}startRunInSlot\(\{ \.\.\.quickStartRunConfig\(registries\), seedString: randomSeedString\(\) \}/);
  assert.match(main, /startClimb\(\{ skipOpening \}\)/);
  assert.match(main, /if \(!skipOpening && \(!shotState/);
});

test('the Title focuses Quick start by priority, after Continue and before New', () => {
  // The browser check is tools/quick-start-inputs.mjs ("a fresh profile's Title
  // focuses Quick start"); this pins the priority list it relies on.
  const title = readFileSync(`${ROOT}src/ui/screens/title.js`, 'utf8');
  const list = title.match(/const TITLE_DEFAULT_FOCUS = \[([^\]]*)\]/);
  assert.ok(list, 'title.js names its default-focus priority list');
  const order = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 3), ['.slot-continue', '.slot-quick', '.slot-new']);
  assert.match(title, /TITLE_DEFAULT_FOCUS\.map\(\(s\) => app\?\.querySelector\(s\)\)\.find\(Boolean\)/);
});
