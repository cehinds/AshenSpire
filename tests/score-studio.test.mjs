import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alternativeArtCatalog } from '../src/ui/alternativeArtCatalog.js';
import { RECIPIENT_EFFECT_ATLAS } from '../src/content/recipientEffectAtlas.js';
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
  const index = readFileSync(join(root, 'tools/score-studio/index.html'), 'utf8');
  const preview = index.match(/<iframe id="effects-timing-frame"[^>]+data-src="([^"]+)"/)?.[1];
  assert.ok(preview, 'Score Studio loads the shared Effects Timing page');
  const markup = readFileSync(join(root, preview), 'utf8');
  const previewModule = resolve(dirname(join(root, preview)), markup.match(/<script type="module" src="([^"]+)"/)[1]);
  const previewStyles = resolve(dirname(join(root, preview)), markup.match(/rel="stylesheet" href="([^"]+)"/)[1]);
  const timings = pagesSrc.match(/const SCORE_STUDIO_TIMING_FILES = \[([^\]]+)\]/);
  assert.ok(timings);
  const timingFiles = [...timings[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  for (const path of [join(root, preview), previewModule, previewStyles]) {
    assert.ok(timingFiles.includes(relative(root, path).replaceAll('\\', '/')), 'Published Studio includes ' + path);
  }
  extractedTrees.push(...timingFiles);

  const seen = new Set();
  const queue = [join(root, 'tools/score-studio/studio.js'), previewModule];
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

  const scene = alternativeArtCatalog.scenes['ashen-crown-1'].devices.desktop.layers.map(({ id }) => alternativeArtCatalog.sceneLayers[id].path);
  const actors = ['reaver-default', 'fellWarden', 'wanderingSoldier', 'blightHound'].map(id => alternativeArtCatalog.sprites[id].path);
  const timingAssetsMatch = pagesSrc.match(/const SCORE_STUDIO_TIMING_ASSETS = new Set\(\[([^\]]+)\]\)/);
  assert.ok(timingAssetsMatch);
  const timingAssets = [...timingAssetsMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual([...timingAssets].sort(), [...scene, ...actors].sort(), 'Pages hydrates exactly the fixture actors and scene');
  const manifest = JSON.parse(readFileSync(join(root, 'art-manifest.json'), 'utf8'));
  for (const id of [...timingAssets, ...Object.values(RECIPIENT_EFFECT_ATLAS).map(entry => entry.asset)]) {
    assert.ok(manifest.assets[id]?.common || manifest.assets[id]?.light, id + ' is available to the Studio hydrator');
  }
  assert.match(pagesSrc, /id\.startsWith\('assets\/recipient-effects\/'\)/);
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
  assert.equal(weightExample('effects', 'ward', scoring, 'ward'), `Not this box: scored with the block row (6 Ward HP = ${blockValue} pts)`);
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
  assert.ok(ValidateScoringConfig(withLimit({ maxChars: 20, keep: [] })).some((m) => m.includes('at least one part')), 'an empty keep order is refused');
  assert.ok(ValidateScoringConfig(withLimit({ maxChars: 20, keep: ['base', 'rarity', 'rarity'] })).some((m) => m.includes('each once')), 'a repeated part is refused');
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

test('weights tab: cost, effect and status rows switch to the multiplier form and back without a stray change', async () => {
  const { weightSentence, weightExample, SetWeightForm } = await import('../tools/score-studio/weightExamples.js');
  const { ScoringDiffPaths, MergePendingScoring } = await import('../tools/score-studio/weightsStaging.js');
  const applied = structuredClone(shippedScoring);
  const repo = shippedScoring;
  // Stage the switch as applyWeightEdit does: a pending copy next to the base it came from.
  const pending = structuredClone(applied);
  SetWeightForm(pending.costs.sp, repo.costs.sp, true);
  assert.deepEqual([pending.costs.sp.multiplier, pending.costs.sp.weight], [true, 0], 'on starts at the no-change weight 0');
  pending.costs.sp.weight = -0.1;
  SetWeightForm(pending.effects.block, repo.effects.block, true);
  SetWeightForm(pending.statuses.vulnerable, repo.statuses.vulnerable, true);
  assert.deepEqual(ScoringDiffPaths(applied, pending).sort(), ['costs.sp.multiplier', 'costs.sp.weight', 'effects.block.multiplier', 'effects.block.weight', 'statuses.vulnerable.multiplier', 'statuses.vulnerable.weight']);
  assert.deepEqual(ValidateScoringConfig(pending), []);
  // Apply: the merged config scores SP as P x -0.1 per SP, so the stronger card pays more.
  const merged = MergePendingScoring(applied, applied, pending);
  const low = ScoreCard({ ...BaseFace(), sp: 1, dmg: 5 }, merged), high = ScoreCard({ ...BaseFace(), sp: 1, dmg: 40 }, merged);
  assert.equal(low.parts.SP, low.positive * -0.1);
  assert.equal(high.parts.SP, high.positive * -0.1);
  assert.ok(high.parts.SP < low.parts.SP);
  // The words and the worked example name the multiplier form, with the selected card's positive score when given.
  assert.deepEqual(weightSentence('costs', 'sp', merged), { before: '', mid: '× P per SP', after: '' });
  assert.deepEqual(weightSentence('effects', 'block', merged, 'block'), { before: '', mid: '× P per', after: 'Block' });
  assert.deepEqual(weightSentence('statuses', 'vulnerable', merged), { before: '', mid: '× P per stack', after: '' });
  assert.equal(weightExample('costs', 'sp', merged, 'SP'), 'Positive score 20: 2 SP = -4 pts');
  assert.equal(weightExample('costs', 'sp', merged, 'SP', { name: 'Strike', positive: 14 }), 'Strike (positive score 14): 2 SP = -2.8 pts');
  assert.equal(weightSentence('costs', 'mp', merged).mid, 'pts per MP', 'a flat row keeps its words');
  // Switching back restores the repo's flat weight and drops the flag, so nothing is left staged.
  SetWeightForm(pending.costs.sp, repo.costs.sp, false);
  SetWeightForm(pending.effects.block, repo.effects.block, false);
  SetWeightForm(pending.statuses.vulnerable, repo.statuses.vulnerable, false);
  assert.deepEqual(ScoringDiffPaths(applied, pending), []);
  assert.deepEqual(pending, applied);
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

test('name sets: Default names, save, Rename all and restore', async () => {
  const NS = await import('../tools/score-studio/nameSets.js');
  const repo = [{ id: 'core.a', name: 'Acid Splash' }, { id: 'core.b', name: 'Backstep' }];
  const cards = structuredClone(repo);
  const defaults = NS.DefaultNameSet(repo);
  assert.equal(defaults.label, 'Default names');
  assert.deepEqual(defaults.names['core.a'], { name: 'Acid Splash', autoName: false });
  // Rename all turns Auto-name on for every card (the studio then renames them).
  assert.equal(NS.TurnOnAutoNames(cards), 2);
  cards[0].name = 'Brittle Blight Rite IV'; cards[1].name = 'Evasive Guard II';
  const when = new Date(2026, 10, 24, 14, 5);
  assert.equal(NS.DefaultNameSetLabel(when), 'Names 2026-11-24 14:05');
  const saved = NS.CaptureNameSet(cards, '', when);
  assert.equal(saved.label, 'Names 2026-11-24 14:05');
  assert.deepEqual(saved.names['core.a'], { name: 'Brittle Blight Rite IV', autoName: true });
  // Restoring Default names gives back the authored names with Auto-name off; the default set is not changed.
  assert.equal(NS.ApplyNameSet(cards, defaults), 2);
  assert.deepEqual(cards.map((c) => [c.name, c._autoName]), [['Acid Splash', false], ['Backstep', false]]);
  assert.equal(defaults.names['core.a'].name, 'Acid Splash');
  assert.equal(NS.ApplyNameSet(cards, defaults), 0, 'nothing left to change');
  // A saved set restores its own names, also with Auto-name off.
  assert.equal(NS.ApplyNameSet(cards, saved), 2);
  assert.deepEqual(cards.map((c) => [c.name, c._autoName]), [['Brittle Blight Rite IV', false], ['Evasive Guard II', false]]);
  // Saved configs carry the sets apart from the weights; the default set and bad rows are never stored.
  const older = { ...NS.CaptureNameSet(cards, 'Old', new Date(2026, 0, 1)) };
  const joined = NS.JoinSavedConfig({ rank: {} }, [older, saved, defaults, { id: 'x' }]);
  const split = NS.SplitSavedConfig(joined);
  assert.deepEqual(split.scoring, { rank: {} });
  assert.deepEqual(split.nameSets.map((s) => s.id), [older.id, saved.id]);
  assert.deepEqual(NS.MergeNameSets([older], [saved]).map((s) => s.label), ['Names 2026-11-24 14:05', 'Old'], 'newest first');
  assert.deepEqual(ValidateScoringConfig(NS.JoinSavedConfig(shippedScoring, [saved])), [], 'a saved config with sets still validates');
});

test('name sets: Save names writes one set as a names file, and Load names reads it back as a new set', async () => {
  const NS = await import('../tools/score-studio/nameSets.js');
  const cards = [{ id: 'core.a', name: 'Flame Bolt VII', _autoName: true }, { id: 'core.b', name: 'Strike', _autoName: false }];
  const set = NS.CaptureNameSet(cards, 'My Names', new Date(2026, 10, 24, 14, 5));
  const file = NS.NameSetFile(set);
  assert.equal(file.kind, NS.NAME_SET_FILE_KIND);
  assert.equal(NS.NameSetFileName('Names 2026-11-24 14:05'), 'names-2026-11-24-14-05.json');
  assert.equal(NS.NameSetFileName('  '), 'card-names.json');
  const [loaded] = NS.ParseNameSetFile(JSON.parse(JSON.stringify(file)), new Date(2026, 10, 25));
  assert.notEqual(loaded.id, set.id, 'a loaded set never replaces a saved one');
  assert.equal(loaded.label, 'My Names');
  assert.deepEqual(loaded.names, set.names);
  // A list of sets and a studio config carrying $nameSets load too; a scoring file without names is refused.
  assert.equal(NS.ParseNameSetFile([file, file]).length, 2);
  assert.equal(NS.ParseNameSetFile(NS.JoinSavedConfig({ rank: {} }, [set])).length, 1);
  assert.throws(() => NS.ParseNameSetFile({ rank: {} }), /no card names/);
});

test('Ward and Bonus Poise (barrier / gainBarrier / bonusPoise tag) are separated in scoring, combatPower, and weight examples', async () => {
  const { weightExample } = await import('../tools/score-studio/weightExamples.js');
  const { cardCombatPower } = await import('../src/content/generated/combatPower.js');
  const { tags } = await import('../src/content/generated/tags.js');
  const { COST_TAGS } = await import('../src/content/actionCosts.js');

  assert.match(shippedScoring.statuses.ward.why, /no Poise/i);
  assert.equal(shippedScoring.statuses.barrier.target, 'self');
  assert.equal(shippedScoring.statuses.barrier.weight, 4);
  assert.equal(shippedScoring.tags.bonusPoise.domain, 'card');
  assert.ok(tags.some((t) => t.id === 'bonusPoise' && t.domain === 'card'), 'bonusPoise tag exists in generated tags');
  assert.deepEqual(COST_TAGS.bonusPoise, { weight: 0, side: 'sp' });

  const wardOnly = ScoreCard({ ...BaseFace(), sp: 1, statuses: [['ward', 1, 'self']] });
  const poiseOnly = ScoreCard({ ...BaseFace(), sp: 1, statuses: [['barrier', 1, 'self']] });
  assert.equal(wardOnly.parts.ward, shippedScoring.statuses.ward.weight);
  assert.equal(wardOnly.parts.barrier, undefined);
  assert.equal(poiseOnly.parts.barrier, shippedScoring.statuses.barrier.weight);
  assert.equal(poiseOnly.parts.ward, undefined);

  assert.match(weightExample('effects', 'gainBarrier', shippedScoring, 'gainBarrier'), /Bonus Poise uses the barrier status row/);
  assert.match(weightExample('statuses', 'barrier', shippedScoring), /^3 stacks = /);
  assert.ok(cardCombatPower['core.moteShield'].raw >= 18, 'Mote Shield scores both Ward and Bonus Poise');
  assert.ok(cardCombatPower['core.hallowedWard'].raw >= 9, 'Hallowed Ward scores its gainBarrier Bonus Poise');

  const studioSrc = readFileSync(new URL('../tools/score-studio/studio.js', import.meta.url), 'utf8');
  assert.match(studioSrc, /restorePoise:\s*\{\s*part:\s*'block',\s*weight:\s*'block'\s*\}/, 'restorePoise is mapped in EFFECT_SCORE_KEYS');
  assert.match(studioSrc, /eff\.op === 'gainBarrier'\s*\?\s*wanted\s*:\s*authoredAmountForFace/, 'gainBarrier edits stacks directly without x5 Poise scaling');
});

test('score-studio loading state: initial HTML shows card loading UI and loadingState helpers summarize art progress', async () => {
  const LS = await import('../tools/score-studio/loadingState.js');

  assert.equal(LS.parseLoadingShotMode(''), null);
  assert.equal(LS.parseLoadingShotMode('?shot=loading'), 'loading');
  assert.equal(LS.parseLoadingShotMode('?foo=1&shot=art-loading'), 'art-loading');
  assert.equal(LS.parseLoadingShotMode('?shot=other'), null);

  assert.equal(LS.artLoadingPercent(0, 0), 100);
  assert.equal(LS.artLoadingPercent(0, 100), 0);
  assert.equal(LS.artLoadingPercent(42, 106), 40);
  assert.equal(LS.artLoadingPercent(200, 106), 100);

  assert.equal(LS.formatArtLoadingStatus(0, 0), 'Loading card art…');
  assert.equal(LS.formatArtLoadingStatus(1, 1), 'Loading card art… 1 / 1 card');
  assert.equal(LS.formatArtLoadingStatus(24, 106), 'Loading card art… 24 / 106 cards');

  const partial = LS.summarizeTileArtLoad([
    [{ complete: true }, { complete: true }],
    [{ complete: true }, { complete: false }],
    [{ complete: false }],
    [],
  ]);
  assert.deepEqual(partial, {
    total: 3,
    settled: 1,
    pending: 2,
    percent: 33,
    complete: false,
    text: 'Loading card art… 1 / 3 cards',
  });

  const done = LS.summarizeTileArtLoad([
    [{ complete: true }],
    [{ complete: true }, { complete: true }],
  ]);
  assert.equal(done.complete, true);
  assert.equal(done.pending, 0);
  assert.equal(done.percent, 100);

  const html = readFileSync(new URL('../tools/score-studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /<span id="draft-status" class="studio-pill is-loading">Loading…<\/span>/, 'top bar starts in loading state before JS executes');
  assert.match(html, /<div id="cards-loading" class="studio-loading-state" role="status" aria-live="polite" aria-busy="true">/, 'cards loading placeholder renders on first paint');
  assert.match(html, /<div id="cards-grid" class="cards-grid" hidden><\/div>/, 'cards grid stays hidden until populated');
  assert.match(html, /<div id="cards-art-loading" class="studio-loading-bar" role="status" aria-live="polite" hidden>/, 'art loading bar starts hidden until cards render');
  assert.match(html, /<div id="items-loading" class="studio-loading-state studio-loading-compact" role="status" aria-live="polite" aria-busy="true">/, 'items loading state renders initially');

  const studioSrc = readFileSync(new URL('../tools/score-studio/studio.js', import.meta.url), 'utf8');
  assert.match(studioSrc, /deriveFaceFromDef:\s*def\s*=>\s*withRebalancePreviewRegistry\(\(\)\s*=>\s*cardDefToFace\(clone\(def\),\s*state\.scoring\)\)/, 'rebalance derives faces from detached cards without leaking preview cache changes');
});

test('score-studio app menubar preserves approved commands, context selectors and export actions', () => {
  const html = readFileSync(new URL('../tools/score-studio/index.html', import.meta.url), 'utf8');
  for (const id of ['menu-file', 'menu-edit', 'menu-view', 'menu-tools', 'menu-git', 'menu-test']) {
    assert.match(html, new RegExp(`id="${id}"`), `menu bar exposes #${id}`);
  }
  for (const id of [
    'studio-file-menu', 'studio-edit-menu', 'studio-view-menu', 'studio-tools-menu', 'studio-git-menu', 'studio-test-menu',
    'gallery-type-cards', 'gallery-type-items',
    'btn-auto-balance-cards', 'btn-auto-balance-items', 'btn-generate-cards',
    'btn-batch-generate-cards', 'btn-batch-generate-items', 'btn-custom-decks',
    'btn-export-repo', 'btn-download-json', 'btn-decks-export-json',
    'btn-save-names', 'btn-download-art',
    'restore-names-menu', 'btn-restore-names', 'btn-restore-names-apply',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `moved menu action or panel #${id} is present`);
  }
  assert.match(html, /id="studio-menubar"[^>]*role="menubar"/, 'the approved command row remains the application menubar');
  assert.doesNotMatch(html, /id="restore-names-modal"/, 'Restore names retains one live set of controls');
});
