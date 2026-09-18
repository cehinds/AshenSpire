// tests/ui-config.test.mjs — the content/config tree, its compiler
// (tools/config-build.mjs) and the wireframeUi compatibility shim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileEntries, generate, readConfigTree, configSourceErrors, GENERATED } from '../tools/config-build.mjs';
import { uiConfig } from '../src/config/generated/ui.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'content');
const lf = (text) => text.replace(/\r\n/g, '\n');
const realEntries = () => readConfigTree(CONTENT);

/** The real tree with one file's parsed JSON changed by `mutate`. */
function planted(rel, mutate) {
  const entries = realEntries();
  const at = entries.findIndex((e) => e.rel === rel);
  assert.ok(at >= 0, `no ${rel} in content/config`);
  const data = JSON.parse(entries[at].text);
  mutate(data);
  entries[at] = { rel, text: JSON.stringify(data, null, 2) };
  return entries;
}
const withFile = (rel, data) => [...realEntries(), { rel, text: typeof data === 'string' ? data : JSON.stringify(data) }];

function refusedWith(entries, expected) {
  const { errors } = compileEntries(entries);
  assert.ok(errors.includes(expected), `expected the refusal:\n  ${expected}\ngot:\n  ${errors.join('\n  ') || '(none)'}`);
}

function assertDeepFrozen(value, path) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value), `${path} is frozen`);
    for (const [k, v] of Object.entries(value)) assertDeepFrozen(v, `${path}.${k}`);
  }
}

test('the real tree compiles clean and the generated module is current', () => {
  const result = compileEntries(realEntries());
  assert.deepEqual(result.errors, []);
  assert.equal(generate(result), lf(readFileSync(join(ROOT, GENERATED), 'utf8')), 'run node tools/config-build.mjs');
  assert.deepEqual(result.config, JSON.parse(JSON.stringify(uiConfig)));
});

test('uiConfig mirrors the folders, holds only resolved values, and is deep-frozen', () => {
  assert.deepEqual(Object.keys(uiConfig), ['tokens', 'scenes', 'components', 'screens', 'presentation']);
  assert.deepEqual(Object.keys(uiConfig.scenes).sort(), ['w4', 'w4a', 'w4b', 'w4c']);
  for (const name of ['card', 'selection', 'inspect', 'identity', 'possession', 'buttons', 'tooltip', 'hud', 'categoryNav', 'workspace', 'choiceBody', 'inspector']) {
    assert.ok(uiConfig.components[name], `components.${name}`);
  }
  assert.deepEqual(Object.keys(uiConfig.screens).sort(), ['armoury', 'shop', 'smith']);
  assertDeepFrozen(uiConfig, 'uiConfig');
  assert.doesNotMatch(JSON.stringify(uiConfig), /"\$|numerator|"vars"/, 'no variable, fraction or vars block survives compilation');
});

test('the W4 parent and combat scene carry the contract values', () => {
  const { w4, w4a } = uiConfig.scenes;
  assert.deepEqual(w4, {
    sizing: { minimums: { footerPx: 56, targetPx: 44 }, compactBelowPx: 768 },
    layering: { plate: { bleedFraction: 0.02 } },
  });
  assert.deepEqual(w4a.sizing.bands, { hud: 10, scene: 55, context: 30, footer: 5 });
  assert.equal(w4a.sizing.floorPercent, 80);
  assert.deepEqual(w4a.layering.layers.map((l) => [l.id, l.z, l.enabled]), [
    ['skyline', 1, true], ['floor', 2, true], ['actors', 3, true], ['targets', 4, true],
    ['context', 5, true], ['hud', 6, true], ['footer', 6, true], ['effects', 7, true],
  ]);
});

test('the W4c dialogue scene resolves to exactly the authored contract', () => {
  assert.deepEqual(uiConfig.scenes.w4c, {
    sizing: {
      bands: { hud: 10, scene: 40, context: 35, footer: 15 },
      bandsCompact: { hud: 12, scene: 40, context: 33, footer: 15 },
      floorPercent: 60,
      portraitSlot: { widthVw: 20, compactWidthVw: 30 },
      context: {
        widthVw: 95, captionLines: 3, captionLineHeight: 1.45,
        titleRem: 0.95, titleLineHeight: 1.45, textRem: 0.9, paddingRem: 0.5, gapRem: 0.25,
      },
      responses: { fontRem: 0.85, lineHeight: 1.2, paddingBlockRem: 0.2, paddingInlineRem: 0.5, gapRem: 0.25, maxLines: 2 },
      hud: { compactBelowHeightPx: 500 },
      footer: { heightVh: 6 },
    },
    positioning: {
      portraitSlot: { insetVw: 2.5, topOffsetVh: 2 },
      portraits: {
        visibleFraction: 1 / 3, visibleFractionCompact: 1, mirrorNpc: true, minGapVw: 1.5, minGapPx: 24,
        fit: 'shrinkToLane', anchor: 'revealLine',
        listener: { minOpacity: 0.62, brightness: 0.8, saturation: 0.55 },
      },
      context: { insetVw: 2.5, insetVh: 2 },
      footer: { sideInsetVw: 2.5, gapVw: 1.5 },
    },
    layering: {
      layers: [
        { id: 'skybox', z: 2, enabled: true },
        { id: 'floor', z: 3, enabled: true },
        { id: 'playerPortrait', z: 4, enabled: true },
        { id: 'npcPortrait', z: 4, enabled: true },
        { id: 'context', z: 5, enabled: true, occludes: true },
        { id: 'hud', z: 6, enabled: true },
        { id: 'footer', z: 6, enabled: true },
      ],
      speakerAbove: true,
    },
    motion: {
      entrance: [
        { layers: ['skybox', 'floor', 'hud', 'footer'], atMs: 0, fadeMs: 0 },
        { layers: ['playerPortrait', 'npcPortrait'], atMs: 0, fadeMs: 400 },
        { layers: ['context'], atMs: 400, fadeMs: 300, riseVh: 2 },
      ],
    },
    components: { footer: { actions: ['back', 'skipSpeech', 'continue'] } },
    behavior: {
      maxVisibleResponses: 4,
      responseHints: 'tooltip',
      responseLayouts: [
        { columns: 1, placement: 'below' },
        { columns: 2, placement: 'below' },
        { columns: 2, placement: 'beside', textShare: 0.45 },
      ],
    },
  });
});

// #1106 shipped the dialogue reframe before this tree was on dev, reading its
// scene objects from an interim src/ui/sceneConfig.js. The fixture began as
// that file's resolved w4Parent()/w4cLayout(), captured from dev at the merge.
// #1117 ADDS to it and changes nothing in it: the lane rule, the listener's
// floor, the HUD's compact threshold and the response-hint switch are new
// keys; every value #1106 shipped is still here, in the same order.
test('the W4 scenes equal what #1106 shipped, plus the keys #1117 added, key order included', () => {
  const shipped = JSON.parse(readFileSync(new URL('./fixtures/w4-scene-config-1106.json', import.meta.url), 'utf8'));
  const ours = { w4: uiConfig.scenes.w4, w4c: uiConfig.scenes.w4c };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ours)), shipped);
  assert.equal(JSON.stringify(ours), JSON.stringify(shipped), 'same keys in the same order with the same numbers');
});

test('sceneConfig.js hands out the uiConfig scene objects and authors no number', async () => {
  const { w4Parent, w4cLayout } = await import('../src/ui/sceneConfig.js');
  assert.equal(w4Parent(), uiConfig.scenes.w4, 'w4Parent() is uiConfig.scenes.w4 itself');
  assert.equal(w4cLayout(), uiConfig.scenes.w4c, 'w4cLayout() is uiConfig.scenes.w4c itself');
  const code = lf(readFileSync(join(ROOT, 'src', 'ui', 'sceneConfig.js'), 'utf8')).replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  assert.deepEqual([...code.matchAll(/(?<![\w$.])\d+(?:\.\d+)?/g)].map((m) => m[0]), [], 'every scene number lives in content/config');
});

test('tokens are exported resolved, and a file-local variable wins over a token', () => {
  assert.equal(uiConfig.tokens.targetPx, 44);
  assert.equal(uiConfig.tokens.compactBelowPx, 768);
  const { config, errors } = compileEntries(withFile('ui/components/zz.json', {
    vars: { targetPx: 1, local: '$gapVw' }, sizing: { own: '$targetPx', shared: '$gapVw', chained: '$local' },
  }));
  assert.deepEqual(errors, []);
  assert.deepEqual(config.components.zz, { sizing: { own: 1, shared: 1.5, chained: 1.5 } });
});

test('fractions compile to the same double the old expressions gave', () => {
  assert.equal(uiConfig.components.card.sizing.ratio, 5 / 8);
  assert.equal(uiConfig.screens.shop.sizing.railFraction, 21.6 / 95);
  assert.equal(uiConfig.scenes.w4c.positioning.portraits.visibleFraction, 1 / 3);
});

// ---- refusals, each asserted by its message --------------------------------

test('an unknown section is refused by name', () => {
  refusedWith(planted('ui/components/card.json', (d) => { d.layout = {}; }),
    'content/config/ui/components/card.json: unknown section "layout" — sections are vars, sizing, positioning, layering, motion, components, behavior');
});

test('an unknown variable is refused by name', () => {
  refusedWith(planted('ui/components/inspect.json', (d) => { d.sizing.sizeRem = '$tapRem'; }),
    'content/config/ui/components/inspect.json: sizing.sizeRem: unknown variable "$tapRem" — declare it in this file\'s "vars" or in ui/tokens.json');
});

test('a token defined but never used is refused by name', () => {
  refusedWith(planted('ui/tokens.json', (d) => { d.vars.orphanPx = 3; }),
    'content/config/ui/tokens.json: variable "$orphanPx" is defined but never used — delete it or reference it');
});

test('a file-local variable defined but never used is refused by name', () => {
  refusedWith(planted('ui/components/choiceBody.json', (d) => { d.vars.spareVh = 1; }),
    'content/config/ui/components/choiceBody.json: variable "$spareVh" is defined but never used — delete it or reference it');
});

test('a variable cycle is refused by name', () => {
  refusedWith(planted('ui/components/choiceBody.json', (d) => { d.vars.bandMinVh = '$loop'; d.vars.loop = '$bandMinVh'; }),
    'content/config/ui/components/choiceBody.json: vars.loop: variable cycle $bandMinVh → $loop → $bandMinVh');
});

test('"$" inside a longer string is refused by name', () => {
  refusedWith(planted('ui/components/inspect.json', (d) => { d.positioning.gapPx = 'calc($refRemPx)'; }),
    'content/config/ui/components/inspect.json: positioning.gapPx: "calc($refRemPx)" misuses "$" — a variable reference is the whole string "$name", nothing before or after');
});

test('"$" in a key is refused by name', () => {
  refusedWith(planted('ui/components/inspect.json', (d) => { d.positioning.$gapPx = 10; }),
    'content/config/ui/components/inspect.json: positioning.$gapPx: key "$gapPx" misuses "$" — "$" marks a variable reference in a string value, never a key');
});

test('a zero fraction denominator is refused by name', () => {
  refusedWith(planted('ui/components/card.json', (d) => { d.sizing.ratio.denominator = 0; }),
    'content/config/ui/components/card.json: sizing.ratio: fraction denominator is 0');
});

test('a duplicate key is refused by name', () => {
  refusedWith(withFile('ui/components/zz.json', '{ "sizing": { "a": 1, "a": 2 } }'),
    'content/config/ui/components/zz.json: duplicate key "a" — JSON keeps only the last one');
});

test('a file outside the known places is refused by name', () => {
  refusedWith(withFile('ui/panels/zz.json', { sizing: {} }),
    'content/config/ui/panels/zz.json: not a known place — config files sit at ui/tokens.json or ui/{scenes,components,screens,presentation}/<name>.json');
});

test('scene bands that do not sum to 100 are refused by name', () => {
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.sizing.bands.footer = 20; }),
    'content/config/ui/scenes/w4c-dialogue.json: sizing.bands sum to 105, not 100');
});

test('a floorPercent outside 0–100 is refused by name', () => {
  refusedWith(planted('ui/scenes/w4a-combat.json', (d) => { d.sizing.floorPercent = 120; }),
    'content/config/ui/scenes/w4a-combat.json: sizing.floorPercent 120 is outside 0–100');
});

test('a layer id declared twice is refused by name', () => {
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.layering.layers[3].id = 'playerPortrait'; }),
    'content/config/ui/scenes/w4c-dialogue.json: layering.layers id "playerPortrait" is declared twice');
});

test('a non-integer layer z is refused by name', () => {
  refusedWith(planted('ui/scenes/w4a-combat.json', (d) => { d.layering.layers[0].z = 1.5; }),
    'content/config/ui/scenes/w4a-combat.json: layering.layers "skyline" z 1.5 is not an integer');
});

test('an entrance step naming an undeclared layer is refused by name', () => {
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.motion.entrance[2].layers = ['caption']; }),
    'content/config/ui/scenes/w4c-dialogue.json: motion.entrance[2] names layer "caption", which layering.layers does not declare');
});

test('an unknown footer action is refused by name', () => {
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.components.footer.actions.push('fastForward'); }),
    'content/config/ui/scenes/w4c-dialogue.json: components.footer.actions "fastForward" is not a known footer action (back, skipSpeech, continue)');
});

test('a portrait visibleFraction of 0 or above 1 is refused by name', () => {
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.positioning.portraits.visibleFraction = { numerator: 0, denominator: 3 }; }),
    'content/config/ui/scenes/w4c-dialogue.json: positioning.portraits.visibleFraction 0 must satisfy 0 < f ≤ 1');
  refusedWith(planted('ui/scenes/w4c-dialogue.json', (d) => { d.positioning.portraits.visibleFraction = 1.25; }),
    'content/config/ui/scenes/w4c-dialogue.json: positioning.portraits.visibleFraction 1.25 must satisfy 0 < f ≤ 1');
});

// ---- the content-build stray-source sweep ---------------------------------

test('a content/config JSON is stray, by name, unless the generated module was compiled from it', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ui-config-sweep-'));
  try {
    const content = join(tmp, 'content');
    const put = (rel, text) => { const p = join(content, 'config', ...rel.split('/')); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
    const entries = realEntries();
    for (const e of entries) put(e.rel, e.text);
    const gen = join(tmp, ...GENERATED.split('/'));
    assert.deepEqual(configSourceErrors(content).length, entries.length, 'with no generated module every file is stray');
    mkdirSync(dirname(gen), { recursive: true });
    writeFileSync(gen, generate(compileEntries(entries)));
    assert.deepEqual(configSourceErrors(content), [], 'current: nothing stray');
    // CRLF checkouts hash the same as LF ones.
    put('ui/components/card.json', entries.find((e) => e.rel === 'ui/components/card.json').text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
    assert.deepEqual(configSourceErrors(content), [], 'a CRLF copy of the same file is still current');
    put('ui/components/card.json', '{ "sizing": { "ratio": 0.7, "bands": [1, 4, 4, 1] } }\n');
    put('ui/screens/zz.json', '{ "sizing": {} }\n');
    assert.deepEqual(configSourceErrors(content), [
      `content/config/ui/components/card.json: STRAY SOURCE FILE — ${GENERATED} was not compiled from this version of it; run node tools/config-build.mjs`,
      `content/config/ui/screens/zz.json: STRAY SOURCE FILE — ${GENERATED} was not compiled from this version of it; run node tools/config-build.mjs`,
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- the compatibility shim -------------------------------------------------

test('wireframeUi still equals the pre-migration snapshot, key order included', () => {
  const snapshot = readFileSync(new URL('./fixtures/wireframe-ui-snapshot.json', import.meta.url), 'utf8');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(wireframeUi)), JSON.parse(snapshot));
  assert.equal(`${JSON.stringify(wireframeUi, null, 2)}\n`, lf(snapshot), 'same keys in the same order with the same numbers');
  assertDeepFrozen(wireframeUi, 'wireframeUi');
});

test('the wireframeUi shim authors no number of its own', () => {
  const source = lf(readFileSync(join(ROOT, 'src', 'content', 'wireframeUi.js'), 'utf8'));
  assert.match(source, /from '\.\.\/config\/generated\/ui\.js'/, 'the shim reads uiConfig');
  const code = source.replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  const literals = [...code.matchAll(/(?<![\w$.])\d+(?:\.\d+)?/g)].map((m) => m[0]);
  assert.deepEqual(literals, ['100'], 'only PERCENT = 100 is written in the shim; every other number lives in content/config');
  assert.match(code, /const PERCENT = 100;/);
});
