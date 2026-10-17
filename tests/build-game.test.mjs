// The build compiler (tools/build-game.mjs): one deterministic artifact from every authored JSON layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';
import { createRuntime, runCases, loadMechanics } from '../engine/runtime/interpreter.mjs';
import { buildGame, hashOf, summaryFile, summaryText } from '../tools/build-game.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = f => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const first = buildGame();
const artifact = first.artifact;

test('the build is deterministic: two builds give the same hash and bytes', () => {
  const second = buildGame();
  assert.equal(second.artifact.hash, first.artifact.hash);
  assert.equal(second.text, first.text);
  assert.match(artifact.hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hashOf(JSON.parse(first.text)), artifact.hash);
  assert.ok(!/\d{4}-\d\d-\d\dT/.test(first.text), 'no timestamps in the artifact');
});

test('the artifact satisfies build-artifact.schema.json', () => {
  validateGameSchema(JSON.parse(first.text), readJson('engine/contracts/build-artifact.schema.json'));
  assert.equal(artifact.format, 'ashen.build@1');
  assert.equal(artifact.game, 'ashenspire');
});

test('the committed summary is current and --check passes', () => {
  assert.equal(readFileSync(join(ROOT, summaryFile('ashenspire')), 'utf8').replace(/\r\n/g, '\n'), summaryText(first.summary));
  const run = spawnSync(process.execPath, [join(ROOT, 'tools/build-game.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr + run.stdout);
});

test('report counts match the mechanics index, the ui index and the maps', () => {
  const idx = readJson('engine/mechanics/index.json').mechanics;
  const ui = readJson('engine/ui/index.json');
  const r = artifact.report;
  assert.equal(r.mechanics, idx.length);
  for (const p of ['portable', 'legacy', 'data']) assert.equal(r[p], idx.filter(m => m.portability === p).length, p);
  assert.equal(r.portable + r.legacy + r.data, r.mechanics);
  assert.equal(r.components, ui.components.length);
  assert.equal(r.screens, ui.screens.length);
  assert.deepEqual(Object.keys(artifact.ui.components).sort(), ui.components);
  assert.deepEqual(Object.keys(artifact.ui.screens).sort(), ui.screens);
  assert.equal(r.maps, readdirSync(join(ROOT, 'games/ashenspire/maps')).filter(f => f.endsWith('.json')).length);
  assert.equal(r.assets, Object.keys(artifact.assets.catalog.assets).length);
  assert.equal(Object.keys(artifact.tags).length, idx.length);
  for (const m of idx) assert.equal(artifact.tags[m.tag], m.id, m.tag);
});

test('tags, layout refs and references resolve', () => {
  for (const [tag, slug] of Object.entries(artifact.tags)) assert.equal(artifact.mechanics[slug].manifest.tag, tag);
  for (const c of Object.values(artifact.ui.components)) if (c.layout?.ref) assert.ok(artifact.ui.layout[c.layout.ref], c.layout.ref);
  for (const s of Object.values(artifact.ui.screens)) for (const r of s.regions) assert.ok(artifact.ui.components[r.component], r.component);
  assert.deepEqual(artifact.report.unboundTags, []);
  assert.equal(artifact.runtime.ops.format, 'ashen.ops@1');
  assert.ok(artifact.content.cards.length > 0 && artifact.content.characters.length > 0 && artifact.content.gear.length > 0);
});

test('the build fails on dangling references', () => {
  assert.throws(() => buildGame({ patch: ({ uiScreens }) => { uiScreens.combat.regions.push({ slot: 'x', component: 'noSuchComponent' }); } }), /unknown component 'noSuchComponent'/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { uiComponents.hud.layout = { ref: 'content/config/ui/components/missing.json' }; } }), /layout ref .* does not exist/);
  assert.throws(() => buildGame({ patch: ({ mapDocs }) => { const m = Object.values(mapDocs)[0]; m.generator.weights = { ...m.generator.weights, 'node.nope': 5 }; } }), /weights names 'node\.nope', which is not a node component/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { const c = Object.values(uiComponents).find(x => x.layout?.ref); c.layout = { ...c.layout, path: 'no.such.path' }; } }), /layout path 'no\.such\.path' not found/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { delete uiComponents.hud.viewModel; } }), /ui\/components\/hud.*viewModel/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { const vm = uiComponents.enemyPanel.viewModel; vm.bindings = { ...vm.bindings, spShown: '$entity.pools.sp' }; delete vm.visibility; } }), /enemyPanel: binds sp without the enemy_visibility\.visibleFields visibility query/);
  assert.throws(() => buildGame({ patch: ({ mapDocs }) => { const m = Object.values(mapDocs).find(x => x.atlas); m.atlas = { ...m.atlas, path: 'nope.nothing' }; } }), /atlas path 'nope\.nothing' does not resolve/);
  assert.throws(() => buildGame({ patch: ({ mapDocs }) => { const m = Object.values(mapDocs)[0]; m.generator.proposed = { ...(m.generator.proposed || {}), names: { elite: 'node.nope' } }; } }), /proposed\.names elite -> 'node\.nope' is not a node component/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { uiComponents.hud.id = 'wrong'; } }), /ui\/components\/hud: id 'wrong' does not match the file name/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).some(h => h.on?.startsWith('command.'))); const h = m.service.handlers.find(x => x.on.startsWith('command.')); h.on = 'command.typo'; } }), /handler 'command\.typo' is not a command in its interface/);
  assert.throws(() => buildGame({ game: 'nonexistent-game' }));
});

// Case data that does not yet pass on the base branch (wrong state shapes, scalar-vs-object statuses, $model.*).
// The worker on worker/JsonBuildExport/reconcile fixes it; once that merges every slug here passes, this test
// then fails on purpose so the set is emptied and the loop below is fully strict.
const KNOWN_FAILING = new Set([]);

test('every portable mechanic in the artifact passes its cases through the interpreter loaded from the artifact', () => {
  const parsed = JSON.parse(first.text); // what a consumer reads, not what is on disk
  const mechanics = new Map(Object.entries(parsed.mechanics));
  const runtime = createRuntime({ mechanics, ops: parsed.runtime.ops });
  const disk = loadMechanics();
  const diskRuntime = createRuntime({ mechanics: disk });
  const portable = [...mechanics.values()].filter(m => m.manifest.portability === 'portable');
  assert.equal(portable.length, parsed.report.portable);
  let cases = 0;
  for (const m of portable) {
    const slug = m.manifest.id;
    const results = runCases(m, runtime);
    // Only verdicts compare: the artifact has sorted keys, so which mismatch an error message names first can differ.
    const verdict = rs => rs.map(r => [r.name, r.ok]);
    assert.deepEqual(verdict(results), verdict(runCases(disk.get(slug), diskRuntime)), `${slug}: artifact and disk interpreters disagree`);
    cases += results.length;
    const failed = results.filter(r => !r.ok);
    if (KNOWN_FAILING.has(slug)) assert.ok(failed.length > 0, `${slug} now passes: remove it from KNOWN_FAILING`);
    else for (const r of failed) assert.fail(`${slug}: ${r.name}: ${r.error}`);
  }
  assert.ok(cases > 0);
});

test('the artifact file is build output and git-ignored', () => {
  assert.ok(readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').includes('/dist/build/'));
  assert.ok(existsSync(join(ROOT, 'games/ashenspire/build.summary.json')));
});
