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

test('weights staging: Apply replays only staged differences onto the applied config, and clears only rank pins', async () => {
  const { ScoringDiffPaths, MergePendingScoring, HasRankPin, WithoutRankPin, STUDIO_SAVE_PATH } = await import('../tools/score-studio/weightsStaging.js');
  const base = structuredClone(shippedScoring);
  base.costs.sp.weight = 4;
  const pending = structuredClone(base);
  pending.costs.mp.weight += 2;

  assert.deepEqual(ScoringDiffPaths(base, base), []);
  assert.deepEqual(ScoringDiffPaths(base, pending), ['costs.mp.weight']);

  // An undo after staging (SP back to its old value) and a card override made meanwhile both survive Apply.
  const applied = structuredClone(base);
  applied.costs.sp.weight = 1;
  applied.overrides = { ...applied.overrides, 'core.example': { rank: 2 } };
  const merged = MergePendingScoring(applied, base, pending);
  assert.equal(merged.costs.sp.weight, 1);
  assert.equal(merged.costs.mp.weight, pending.costs.mp.weight);
  assert.deepEqual(merged.overrides['core.example'], { rank: 2 });
  assert.deepEqual(ScoringDiffPaths(applied, merged), ['costs.mp.weight']);

  // Keys with dots (tag ids like "rank.cantrip") and removed keys replay exactly.
  const dotted = structuredClone(base);
  dotted.tags = { ...dotted.tags, 'rank.test': { weight: 3 } };
  delete dotted.rank.unrankedMax;
  const replayed = MergePendingScoring(applied, base, dotted);
  assert.deepEqual(replayed.tags['rank.test'], { weight: 3 });
  assert.equal('unrankedMax' in replayed.rank, false);
  assert.equal(replayed.rank === applied.rank, false, 'Apply never mutates the applied config');
  assert.equal('unrankedMax' in applied.rank, true);

  // A file carrying "__proto__" keys never reaches Object.prototype.
  const hostile = JSON.parse(JSON.stringify(base).replace('"tags":{', '"tags":{"__proto__":{"weight":3},'));
  assert.deepEqual(ScoringDiffPaths(base, hostile), []);
  MergePendingScoring(applied, base, hostile);
  assert.equal(({}).weight, undefined);

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

test('weights tab: each row reads as a sentence and its example uses the scorer math', async () => {
  const { weightSentence, weightExample } = await import('../tools/score-studio/weightExamples.js');
  const scoring = structuredClone(shippedScoring);
  scoring.effects.damage = { ...scoring.effects.damage, weight: 1, per: 4 };
  assert.deepEqual(weightSentence('effects', 'damage', scoring, 'damage'), { before: '', mid: 'pts per', after: 'damage' });
  assert.equal(weightExample('effects', 'damage', scoring, 'damage'), '8 damage = 2 pts');
  scoring.costs.sp.weight = -4;
  assert.equal(weightExample('costs', 'sp', scoring), '2 SP = -8 pts');
  // A status the scorer values by formula shows the scorer's own number, not weight x stacks.
  const burnValue = ScoreCard({ ...BaseFace(), statuses: [['burn', 3, 'enemy']] }, scoring).parts.burn;
  assert.match(weightExample('statuses', 'burn', scoring), new RegExp(`^3 stacks = ${Math.round(burnValue * 10) / 10} pts`));
  scoring.rank = { ...scoring.rank, unrankedMax: 0, width: 4, maxRank: 10 };
  assert.equal(weightExample('rank', 'width', scoring), 'CP 9 = Rank 3');
});

test('weights tab: rows the scorer reads through another weight, or not at all, say so', async () => {
  const { weightExample } = await import('../tools/score-studio/weightExamples.js');
  const scoring = structuredClone(shippedScoring);
  // Ward is scored as Block (cardDefToFace), so its example uses Block's weight, never its own box.
  scoring.effects.block = { ...scoring.effects.block, weight: 1, per: 3 };
  scoring.effects.ward = { ...scoring.effects.ward, weight: 9, per: 1 };
  const blockValue = ScoreCard({ ...BaseFace(), blk: 6 }, scoring).parts.block;
  assert.equal(weightExample('effects', 'ward', scoring, 'ward'), `Not this box: scored with the block row (6 Ward = ${blockValue} pts)`);
  assert.equal(weightExample('effects', 'addCard', scoring, 'addCard'), 'Not scored yet');
  // Only the Counterstrike tag's multiplier is read; the area tag scales by enemy count; other multiplier tags score nothing.
  const area = ScoreCard({ ...BaseFace(), dmg: 6, tags: ['targeting:area'] }, scoring);
  assert.equal(area.parts['targeting:area'], undefined, 'the area tag adds no part of its own');
  assert.match(weightExample('tags', 'targeting:area', scoring), /^Not this box: area effects count once per enemy/);
  assert.equal(weightExample('tags', 'ability:wide-cleave', scoring), 'Not scored yet');
  const strike = ScoreCard({ ...BaseFace(), dmg: 6 }, scoring);
  const counter = ScoreCard({ ...BaseFace(), dmg: 6, tags: ['trait:counterstrike'] }, scoring);
  assert.ok(counter.parts.counterstrike > 0 && strike.parts.counterstrike === undefined, 'the Counterstrike multiplier is scored');
});

test('activeScoring: naming.card.limit is optional, and checked when present', () => {
  const withLimit = (limit) => { const s = structuredClone(shippedScoring); s.naming.card.limit = limit; return s; };
  const noLimit = structuredClone(shippedScoring); delete noLimit.naming.card.limit;
  assert.deepEqual(ValidateScoringConfig(noLimit), []);
  assert.deepEqual(ValidateScoringConfig(withLimit({ maxChars: 12, keep: ['base', 'rarity'] })), []);
  assert.deepEqual(ValidateScoringConfig(withLimit({ keep: ['base', 'rarity'] })), [], 'a keep order with no maxChars is no limit');
  assert.ok(ValidateScoringConfig(withLimit({ maxChars: 0, keep: [] })).some((m) => m.includes('maxChars')));
  assert.ok(ValidateScoringConfig(withLimit({ maxChars: 20, keep: ['base', 'title'] })).some((m) => m.includes('keep')));
  assert.ok(ValidateScoringConfig(withLimit([20])).some((m) => m.includes('limit')));
});

test('scorer and validator: a multiplier tag or keyword may be set flat instead', () => {
  const flat = structuredClone(shippedScoring);
  // Counterstrike flat: its weight once, no multiplier part (it used to read only .multiplier).
  flat.tags['trait:counterstrike'] = { ...flat.tags['trait:counterstrike'], weight: 4 };
  delete flat.tags['trait:counterstrike'].multiplier;
  const hit = { ...BaseFace(), dmg: 6, tags: ['trait:counterstrike'] };
  const plain = ScoreCard({ ...BaseFace(), dmg: 6 }, flat);
  const flatHit = ScoreCard(hit, flat);
  assert.equal(flatHit.parts['trait:counterstrike'], 4);
  assert.equal(flatHit.parts.counterstrike, undefined);
  assert.equal(flatHit.raw, plain.raw + 4);
  // Flat 0 is no change, and the tag drops out of the scorer entirely.
  flat.tags['trait:counterstrike'].weight = 0;
  assert.equal(ScoreCard(hit, flat).raw, plain.raw);
  // A keyword set flat adds its flat value; a pMultiplier tag set flat adds its weight.
  flat.keywords.retain = { flat: 3 };
  assert.equal(ScoreCard({ ...BaseFace(), dmg: 6, kw: ['retain'] }, flat).parts.retain, 3);
  flat.tags.ash = { ...flat.tags.ash, weight: -2 }; delete flat.tags.ash.pMultiplier;
  assert.equal(ScoreCard({ ...BaseFace(), dmg: 6, tags: ['ash'] }, flat).parts.ash, -2);
  assert.deepEqual(ValidateScoringConfig(flat), []);
  const broken = structuredClone(shippedScoring);
  broken.keywords.retain = { why: 'neither form' };
  broken.tags.ash.pMultiplier = 'half';
  const errors = ValidateScoringConfig(broken);
  assert.ok(errors.some((m) => m.includes('keywords.retain')));
  assert.ok(errors.some((m) => m.includes('tags.ash.pMultiplier')));
});

test('weights tab: the multiply-instead switch stores flat or multiplier, and the example follows the scorer', async () => {
  const { weightSentence, weightExample, TagMultiplierKey, SetKeywordForm, SetTagForm } = await import('../tools/score-studio/weightExamples.js');
  const scoring = structuredClone(shippedScoring);
  // Keywords: unchecked stores flat 0 (multiplier gone), checked stores multiplier 0 (flat gone).
  SetKeywordForm(scoring.keywords.innate, false);
  assert.equal(scoring.keywords.innate.flat, 0);
  assert.equal('multiplier' in scoring.keywords.innate, false);
  scoring.keywords.innate.flat = 4;
  assert.deepEqual(weightSentence('keywords', 'innate', scoring), { before: 'adds', mid: 'pts', after: '' });
  const innate = ScoreCard({ ...BaseFace(), dmg: 6, kw: ['innate'] }, scoring).parts.innate;
  assert.equal(innate, 4);
  assert.equal(weightExample('keywords', 'innate', scoring), `Any card with it: +${innate} pts`);
  // The keyword's min still holds a flat value, as ScoreCard does.
  scoring.keywords.innate.flat = 0;
  assert.equal(weightExample('keywords', 'innate', scoring), `Any card with it: +${ScoreCard({ ...BaseFace(), dmg: 6, kw: ['innate'] }, scoring).parts.innate} pt`);
  SetKeywordForm(scoring.keywords.innate, true);
  assert.equal(scoring.keywords.innate.multiplier, 0);
  assert.equal('flat' in scoring.keywords.innate, false);
  // Tags: the switch keeps the tag's own multiplier kind; 'times' starts at 1, pMultiplier at 0, flat at weight 0.
  assert.equal(TagMultiplierKey(scoring.tags['trait:counterstrike']), 'multiplier');
  assert.equal(TagMultiplierKey(scoring.tags.ash), 'pMultiplier');
  assert.equal(TagMultiplierKey({ weight: 0 }, shippedScoring.tags.ash), 'pMultiplier');
  assert.equal(TagMultiplierKey({ weight: 2 }, { weight: 2 }), null);
  const cs = scoring.tags['trait:counterstrike'];
  const hit = { ...BaseFace(), dmg: 6, tags: ['trait:counterstrike'] };
  SetTagForm(cs, 'multiplier', false);
  assert.equal(cs.weight, 0);
  assert.equal('multiplier' in cs, false);
  cs.weight = 3;
  assert.equal(weightExample('tags', 'trait:counterstrike', scoring), `Any card with it: +${ScoreCard(hit, scoring).parts['trait:counterstrike']} pts`);
  SetTagForm(cs, 'multiplier', true);
  assert.deepEqual([cs.weight, cs.multiplier], [0, 1]);
  assert.equal(ScoreCard(hit, scoring).raw, ScoreCard({ ...BaseFace(), dmg: 6 }, scoring).raw, 'x1 is no change');
  SetTagForm(scoring.tags.ash, 'pMultiplier', true);
  assert.equal(scoring.tags.ash.pMultiplier, 0);
  assert.deepEqual(ValidateScoringConfig(scoring), []);
});

test('studio restore: a draft with the old naming tables takes the repo naming and drops prefix / suffix', async () => {
  const { RefreshRestoredNaming, NamingIsStale } = await import('../tools/score-studio/weightsStaging.js');
  const { CardName } = await import('../src/model/combatPower.js');
  // dev's naming.card before convention names: physical/spell base keys, a camp fallback, Ember, and the studio's word tables.
  const draft = structuredClone(shippedScoring);
  const card = draft.naming.card;
  card.base = { 'maneuver:smash': 'Smash', 'maneuver:sweep': 'Sweep', 'maneuver:counter': 'Riposte', 'maneuver:defend': 'Guard', 'maneuver:evade': 'Step', 'attack:physical': 'Strike', 'attack:spell': 'Bolt', 'attack:area:physical': 'Cleave', 'attack:area:spell': 'Wave', 'skill:physical': 'Technique', 'skill:spell': 'Rite' };
  card.fallback = { physical: 'Keen', spell: 'Astral' };
  card.element['school:fire'] = 'Ember';
  for (const key of ['rarity', 'range', 'defaultRange', 'tradition', 'defaultTradition', 'limit']) delete card[key];
  card.prefix = { burn: 'Searing' };
  card.suffix = { burn: 'Embers' };
  assert.ok(NamingIsStale(draft));
  assert.equal(NamingIsStale(shippedScoring), false);
  const hit = { ...BaseFace(), sp: 1, dmg: 3, tags: ['camp:physical', 'range:melee'] };
  RefreshRestoredNaming(draft, shippedScoring);
  assert.equal(NamingIsStale(draft), false);
  assert.deepEqual(draft.naming.card, shippedScoring.naming.card);
  assert.equal(CardName(hit, 0, draft), 'Strike');
  // A current config keeps its own edits; only the retired word tables go.
  const current = structuredClone(shippedScoring);
  current.naming.card.rarity.rare = 'Grand';
  current.naming.card.prefix = { burn: 'Searing' };
  RefreshRestoredNaming(current, shippedScoring);
  assert.equal(current.naming.card.rarity.rare, 'Grand');
  assert.equal('prefix' in current.naming.card, false);
});
