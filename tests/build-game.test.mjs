// The build compiler (tools/build-game.mjs): one deterministic artifact from every authored JSON layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';
import { createRuntime, runCases, loadMechanics } from '../engine/runtime/interpreter.mjs';
import { evaluate } from '../src/model/formulas.js';
import { resolveAtlasPath } from '../tools/maps-validate.mjs';
import { buildGame, hashOf, summaryFile, summaryText } from '../tools/build-game.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = f => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const first = buildGame();
const artifact = first.artifact;

// Catalog formula validation is probed on a legacy mechanic: portable mechanics additionally refuse
// legacy-only formulas (metric, traitBonus), which has its own test.
function queryFormula(formula) {
  return buildGame({ patch: ({ mechanics }) => {
    mechanics.camp_physical.interface.queries ||= {};
    mechanics.camp_physical.interface.queries.validationProbe = { params: {}, returns: 'number', value: formula };
  } });
}

test('enemy and character phase effects are checked independently before export', () => {
  for (const kind of ['enemies', 'characters']) {
    for (const [effect, error] of [
      [{ op: 'definitelyUnknown' }, /unknown effect op 'definitelyUnknown'/],
      [{ op: 'damage' }, /op damage needs 'amount'/],
      [{ op: 'heal' }, /op heal needs 'amount'/],
      [{ op: 'heal', rule: 'misspelledHealRules' }, /unknown or unavailable phase heal rule/],
      [{ op: 'damage', amount: { f: 'definitelyUnknown' } }, /unknown formula 'definitelyUnknown'/],
    ]) {
      assert.throws(() => buildGame({ patch: ({ content }) => {
        const row = content[kind].find(c => (kind === 'characters' ? c.enemy : c)?.phases?.some(p => p.do?.length));
        assert.ok(row, `${kind}: a phase fixture exists`);
        const owner = kind === 'characters' ? row.enemy : row;
        // Detach the projected row from its shared character phase before planting.
        owner.phases = structuredClone(owner.phases);
        owner.phases[0].do = [effect];
      } }), error, kind);
    }
  }
});

test('zero and negative formula multipliers remain valid; stacks divisors stay positive', () => {
  const context = { entities: { self: { maxHp: 10, statuses: {} } }, energySpent: 3, cardsPlayedThisTurn: 3, weaponDamage: 3 };
  for (const f of ['energySpent', 'cardsPlayedThisTurn', 'metric']) {
    for (const per of [0, -2]) {
      const formula = { f, per, ...(f === 'metric' ? { metric: 'weaponDamage' } : {}) };
      assert.equal(evaluate(formula, context), 3 * per);
      assert.doesNotThrow(() => queryFormula(formula), `${f}: per ${per}`);
    }
  }
  for (const per of [0, -2]) assert.throws(() => queryFormula({ f: 'stacks', of: 'self', status: 'bleed', per }), /per must be a positive number/);
});

test('direct numeric formula fields reject nested formulas but recursive args and variables remain valid', () => {
  for (const formula of [
    { f: 'percentMaxHp', of: 'self', pct: { f: 'add', args: [50] } },
    { f: 'energySpent', per: { f: 'add', args: [2] } },
    { f: 'stacks', of: 'self', status: 'bleed', per: { f: 'add', args: [2] } },
    { f: 'traitBonus', base: 10, pct: { f: 'add', args: [0.5] } },
  ]) assert.throws(() => queryFormula(formula), /operand '(pct|per)' has the wrong type/);
  assert.doesNotThrow(() => queryFormula({ f: 'add', args: [2, { f: 'mul', args: [3, 4] }] }));
  assert.doesNotThrow(() => queryFormula({ f: 'percentMaxHp', of: '$target', pct: '$pct' }));
});

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

test('the artifact ships the asset aliases so an engine reading only the artifact can resolve a UI slot', () => {
  const aliases = readJson('games/ashenspire/assets/aliases.json').aliases;
  assert.deepEqual(artifact.assets.aliases, aliases);
  const target = aliases['icon.health'];
  assert.equal(typeof target, 'string');
  assert.equal(artifact.assets.aliases['icon.health'], target);
  assert.ok(artifact.assets.catalog.assets[target], `catalog has ${target}`);
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
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ emt: 'x.y' }]; } }), /unknown step/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { uiComponents.hud.layout = { ref: 'engine/runtime/formulas.json' }; } }), /must live under content\/config\/ui\//);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'damage', amount: { f: 'typo' } }]; } }), /unknown formula 'typo'/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ call: 42 }]; } }), /call target must be a string/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].when = { cmp: ['==', { f: 'typo' }, 1] }; } }), /when: unknown formula 'typo'/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ forEach: 'allEnemies' }]; } }), /forEach needs a string as/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'damage', amount: { f: 'add' } }]; } }), /formula 'add' needs 'args'/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op)); c.effects.find(e => e.op).op = 'definitelyUnknown'; } }), /unknown effect op 'definitelyUnknown'/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].when = { cmp: ['==', 1] }; } }), /cmp needs \[op, a, b\]/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => x.manifest.portability === 'portable'); m.interface.commands = { ...(m.interface.commands || {}), noop: { params: {} } }; } }), /interface command 'noop' has no command\.noop handler/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'heal', amount: { f: 'add', args: 5 } }]; } }), /operand 'args' has the wrong type/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].when = { all: [true] }; } }), /condition must be an object/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ emit: 'runtime.poiseBorken' }]; } }), /runtime events are raised by ops/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'heal', amount: 'five' }]; } }), /param 'amount' is not a value/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op === 'damage')); c.effects.find(e => e.op === 'damage').amount = 'five'; } }), /op damage param 'amount' is not a value/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'heal', amount: { f: 'stacks', of: 'self', status: 'bleed', per: 0 } }]; } }), /per must be a positive number/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers.push({ on: 'event.runtime.poiseBorken', do: [] }); } }), /runtime event the runtime never raises/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op === 'damage')); c.effects.find(e => e.op === 'damage').amount = { f: 'definitelyUnknown' }; } }), /unknown formula 'definitelyUnknown'/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const e = content.enemies.find(x => (x.phases || []).some(ph => (ph.do || []).length)); e.phases.find(ph => (ph.do || []).length).do[0].op = 'definitelyUnknown'; } }), /phases\[\d+\]\.do\[0\]: unknown effect op 'definitelyUnknown'/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { const m = Object.values(mechanics).find(x => (x.service.handlers || []).length); m.service.handlers[0].do = [{ op: 'heal', amount: { f: 'percentMaxHp', of: 'self', pct: { f: 'add', args: [50] } } }]; } }), /operand 'pct' has the wrong type/);
  const firstHandler = mechanics => Object.values(mechanics).find(x => (x.service.handlers || []).length).service.handlers[0];
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { firstHandler(mechanics).when = { cmp: ['<', 'x', 1] }; } }), /cmp < needs numbers/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { firstHandler(mechanics).when = { hasTag: [7, 'enemy'] }; } }), /hasTag needs \[ref, id\] as strings/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { firstHandler(mechanics).do = [{ op: 'heal', amount: { f: 'metric', metric: 'typo' } }]; } }), /unknown metric 'typo'/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { firstHandler(mechanics).do = [{ op: 'heal', amount: { f: 'add', args: [1], min: 'bad' } }]; } }), /min must be a number/);
  assert.throws(() => buildGame({ patch: ({ uiComponents }) => { uiComponents.hud.layout = { ref: 'content/config/ui/../../../engine/runtime/formulas.json' }; } }), /must live under content\/config\/ui\//);
  const portableHandler = mechanics => Object.values(mechanics).find(x => x.manifest.portability === 'portable' && (x.service.handlers || []).length).service.handlers[0];
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { portableHandler(mechanics).do = [{ op: 'heal', amount: { f: 'metric', metric: 'weaponDamage' } }]; } }), /formula 'metric' is legacy-only/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { portableHandler(mechanics).do = [{ op: 'heal', amount: { f: 'add', args: ['bad'] } }]; } }), /operand 'args' has the wrong type/);
  assert.throws(() => buildGame({ patch: ({ mechanics }) => { portableHandler(mechanics).do = [{ op: 'addCard', card: 'typo' }]; } }), /param 'card' is not a cardRef/);
  // Static content is read literally by the engine: effect targets are the closed TARGETS set, status ids are known
  // statuses, and '$name' refs are not resolved, so each fails at build time rather than mid-fight.
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op === 'damage')); c.effects.find(e => e.op === 'damage').target = 'definitelyUnknown'; } }), /op damage param 'target' is not an effect target \(self, enemy/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op === 'damage')); c.effects.find(e => e.op === 'damage').target = ['self', 'enemy']; } }), /param 'target' is not an effect target/, 'an array target is not a scalar the legacy runtime can resolve');
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op)); c.effects = [{ op: 'applyStatus', target: 'self', status: 'definitelyUnknown', stacks: 1 }]; } }), /op applyStatus names status 'definitelyUnknown', which this profile does not export/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op)); c.effects = [{ op: 'buildup', target: 'enemy', status: 'definitelyUnknown', amount: 3 }]; } }), /op buildup names status 'definitelyUnknown'/);
  assert.throws(() => buildGame({ patch: ({ content }) => { const c = content.cards.find(x => (x.effects || []).some(e => e.op)); c.effects = [{ op: 'addCard', card: '$bogus' }]; } }), /op addCard param 'card' is not a cardRef/);
  // Mechanic service steps keep '$' refs and arbitrary entity refs.
  assert.doesNotThrow(() => buildGame({ patch: ({ mechanics }) => { portableHandler(mechanics).do = [{ op: 'heal', target: '$seat', amount: 1 }, { op: 'heal', target: 'someSeat', amount: 1 }, { op: 'addCard', card: '$bogus' }]; } }));
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

test('the artifact carries every atlas document its maps and map components reference', () => {
  const refs = [...Object.values(artifact.maps.maps).map(m => m.atlas?.ref), ...Object.values(artifact.maps.components).map(c => c.placement?.atlas)].filter(Boolean);
  assert.ok(refs.length > 0);
  for (const ref of refs) assert.ok(artifact.maps.atlas[ref] && typeof artifact.maps.atlas[ref] === 'object', ref);
});

test('serialized maps resolve their atlas paths without repository access', () => {
  const { maps } = JSON.parse(first.text);
  for (const map of Object.values(maps.maps)) if (map.atlas) {
    assert.ok(maps.atlas[map.atlas.ref], `embedded atlas: ${map.atlas.ref}`);
    assert.notEqual(resolveAtlasPath(maps.atlas[map.atlas.ref], map.atlas.path), undefined, map.id);
  }
  assert.deepEqual(Object.keys(maps.atlas), ['content/source/worldAtlas.json']);
  assert.deepEqual(maps.atlas['content/source/worldAtlas.json'], readJson('content/source/worldAtlas.json'));
});

test('atlas embedding refuses references outside authored content sources', () => {
  for (const ref of ['engine/runtime/formulas.json', 'content/source/../../engine/runtime/formulas.json']) {
    assert.throws(() => buildGame({ patch: ({ mapDocs }) => { Object.values(mapDocs)[0].atlas = { ref }; } }), /atlas ref .* must live under content\/source\//);
    assert.throws(() => buildGame({ patch: ({ mapComponents }) => { Object.values(mapComponents)[0].placement = { atlas: ref }; } }), /atlas ref .* must live under content\/source\//);
  }
});

test('UI layout embedding rejects traversal for components, screen layouts and scenes', () => {
  const ref = 'content/config/ui/../../../engine/runtime/formulas.json';
  for (const kind of ['component', 'layout', 'scene']) assert.throws(() => buildGame({ patch: ({ uiComponents, uiScreens }) => {
    if (kind === 'component') uiComponents.hud.layout = { ref };
    else uiScreens.combat[kind] = { ref };
  } }), /layout ref .* must live under content\/config\/ui\//, kind);
});

test('metric names are validated before export while dynamic names remain supported', () => {
  assert.throws(() => queryFormula({ f: 'metric', metric: 'typo' }), /unknown metric 'typo'/);
  for (const metric of readJson('engine/runtime/formulas.json').ops.metric.metrics) assert.doesNotThrow(() => queryFormula({ f: 'metric', metric }));
  assert.doesNotThrow(() => queryFormula({ f: 'metric', metric: '$metric' }));
});

test('generic formula clamps accept numeric literals and variables but not nested formulas', () => {
  for (const clamp of ['min', 'max']) for (const value of ['bad', null, { f: 'add', args: [1] }]) {
    assert.throws(() => queryFormula({ f: 'add', args: [1], [clamp]: value }), /(min|max) must be a number/);
  }
  assert.doesNotThrow(() => queryFormula({ f: 'add', args: [1], min: 0, max: '$ceiling' }));
});

test('conditions check operand types without restricting deep equality or numeric variables', () => {
  const withCondition = when => buildGame({ patch: ({ mechanics }) => { mechanics.fx_heal.service.handlers[0].when = when; } });
  for (const when of [{ cmp: ['<', 'x', 1] }, { cmp: ['>', 1, {}] }, { hasTag: [7, 'enemy'] }, { hasTag: ['self', 7] }, { hasStatus: ['self', 7] }]) {
    assert.throws(() => withCondition(when), /needs numbers|needs \[ref, id\] as strings/);
  }
  for (const when of [{ cmp: ['<', '$threshold', { f: 'add', args: [1, 2] }] }, { cmp: ['==', { x: [1, true] }, { x: [1, true] }] }, { hasTag: ['$target', '$tag'] }, { hasStatus: ['self', '$status'] }]) assert.doesNotThrow(() => withCondition(when));
});
