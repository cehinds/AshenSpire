import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import { ValidateScoringConfig, GetActiveScoring, SetCustomScoring, ClearCustomScoring, HasCustomScoring } from '../src/model/activeScoring.js';
import { ScoreCard, BaseFace } from '../src/model/combatPower.js';
import { readStudioConfig, saveStudioScoring, saveStudioArtLayers } from '../tools/score-studio-save.mjs';

test('activeScoring: validates config, activates override for ScoreCard, and cleanly reverts', () => {
  ClearCustomScoring();
  assert.equal(HasCustomScoring(), false);
  assert.equal(GetActiveScoring(), shippedScoring);

  assert.ok(ValidateScoringConfig(null).length > 0);
  assert.ok(ValidateScoringConfig({}).length > 0);
  const noCardModel = structuredClone(shippedScoring);
  delete noCardModel.cardModel;
  assert.ok(ValidateScoringConfig(noCardModel).some((m) => m.includes('cardModel')));
  assert.deepEqual(ValidateScoringConfig(shippedScoring), []);

  const custom = structuredClone(shippedScoring);
  custom.costs.sp.weight = -9;
  const face = { ...BaseFace(), sp: 1, dmg: 6 };
  const baseRaw = ScoreCard(face).raw;

  assert.equal(SetCustomScoring(custom).ok, true);
  assert.equal(HasCustomScoring(), true);
  assert.equal(ScoreCard(face).raw, baseRaw + (-9 - shippedScoring.costs.sp.weight));

  ClearCustomScoring();
  assert.equal(HasCustomScoring(), false);
  assert.equal(ScoreCard(face).raw, baseRaw);
});

test('score-studio-save: reads/writes custom paths inside repo and rejects escaping paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ashen-studio-'));
  try {
    mkdirSync(join(dir, 'content/source'), { recursive: true });
    writeFileSync(join(dir, 'content/source/scoring.json'), JSON.stringify(shippedScoring), 'utf8');

    const loaded = readStudioConfig(dir);
    assert.equal(loaded.scoringExists, true);
    assert.equal(loaded.scoringPath, 'content/source/scoring.json');
    assert.equal(loaded.artLayersExists, false);

    assert.throws(() => readStudioConfig(dir, { scoringPath: '../outside.json' }), /escapes the repository root/);
    if (process.platform === 'win32') {
      const otherDrive = dir[0].toUpperCase() === 'Z' ? 'Y:/outside.json' : 'Z:/outside.json';
      assert.throws(() => readStudioConfig(dir, { scoringPath: otherDrive }), /escapes the repository root/);
    }
    assert.throws(() => saveStudioScoring(dir, { path: 'content/source/scoring.txt', scoring: shippedScoring, rebuild: false }), /must be a \.json file/);
    assert.throws(() => saveStudioScoring(dir, { path: 'content/source/custom.json', scoring: {}, rebuild: false }), /Invalid scoring configuration/);

    const saved = saveStudioScoring(dir, { path: 'content/source/custom-scoring.json', scoring: shippedScoring, rebuild: false });
    assert.equal(saved.path, 'content/source/custom-scoring.json');
    assert.equal(JSON.parse(readFileSync(join(dir, 'content/source/custom-scoring.json'), 'utf8')).version, shippedScoring.version);

    const art = saveStudioArtLayers(dir, { artLayers: { version: 1, layers: [{ id: 'l1', assetId: 'Z.effect.5', opacity: 50 }] } });
    assert.equal(art.path, 'content/source/cardArtLayers.json');
    assert.equal(art.layerCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pages-site publishScoreStudio extracts every module tree transitively imported by Score Studio', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pagesSrc = readFileSync(join(root, 'tools/pages-site.mjs'), 'utf8');
  const treesMatch = pagesSrc.match(/const SCORE_STUDIO_TREES = \[([^\]]+)\]/);
  assert.ok(treesMatch, 'SCORE_STUDIO_TREES constant must exist in tools/pages-site.mjs');
  const extractedTrees = [...treesMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const seen = new Set();
  const queue = [join(root, 'tools/score-studio/studio.js')];
  const importRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const rel = relative(root, file).replace(/\\/g, '/');
    assert.ok(
      extractedTrees.some((t) => rel === t || rel.startsWith(`${t}/`)),
      `Score Studio imports "${rel}" which is not covered by SCORE_STUDIO_TREES (${extractedTrees.join(', ')})`
    );
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(importRe)) {
      const target = resolve(dirname(file), m[1]);
      if (existsSync(target)) queue.push(target);
    }
  }
  assert.ok(seen.size > 10, `Expected transitive module closure > 10 files, got ${seen.size}`);
});

test('weights staging: Apply keeps live sections, diffs leaf paths, and clears only rank pins', async () => {
  const { ScoringDiffPaths, MergePendingScoring, HasRankPin, WithoutRankPin, STUDIO_SAVE_PATH } = await import('../tools/score-studio/weightsStaging.js');
  const applied = structuredClone(shippedScoring);
  applied.overrides = { 'core.example': { rank: 2 } };
  const pending = structuredClone(shippedScoring);
  pending.costs.sp.weight += 3;
  pending.overrides = {};

  assert.deepEqual(ScoringDiffPaths(applied, applied), []);
  assert.ok(ScoringDiffPaths(applied, pending).includes('costs.sp.weight'));

  // Staged weight edits never undo a card override made while they were pending.
  const merged = MergePendingScoring(applied, pending);
  assert.equal(merged.costs.sp.weight, pending.costs.sp.weight);
  assert.deepEqual(merged.overrides, applied.overrides);
  assert.deepEqual(ScoringDiffPaths(applied, merged), ['costs.sp.weight']);
  // An import replaces everything, overrides included.
  assert.deepEqual(MergePendingScoring(applied, pending, { replaceAll: true }).overrides, {});

  assert.equal(HasRankPin({ rank: 1 }), true);
  assert.equal(HasRankPin({ cp: 40 }), true);
  assert.equal(HasRankPin({ rarity: 'rare' }), false);
  assert.equal(HasRankPin(null), false);
  assert.deepEqual(WithoutRankPin({ rank: 1, cp: 3, raw: 2, rarity: 'rare' }), { rarity: 'rare' });
  assert.equal(WithoutRankPin({ rank: 1 }), null);

  // The studio's saved config sits outside content/, which the game build sweeps for stray sources.
  assert.ok(!STUDIO_SAVE_PATH.startsWith('content/'));
  assert.ok(STUDIO_SAVE_PATH.endsWith('.json'));
});
