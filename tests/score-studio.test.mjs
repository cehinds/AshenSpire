import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
