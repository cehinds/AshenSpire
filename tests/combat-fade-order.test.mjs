import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { assertCombatLayerOrder } from '../tools/combat-layer-contract.mjs';

const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');
function declaredLayers(source) {
  source = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const variables = Object.fromEntries([...source.matchAll(/(--combat-layer-[\w-]+):\s*(\d+)/g)]
    .map(([, name, value]) => [name, Number(value)]));
  const spriteRules = [...source.matchAll(/([^{}]+\.sprite)\s*\{([^{}]+)\}/g)]
    .filter(([, , body]) => body.includes('z-index:'));
  const sprites = spriteRules.flatMap(([, , body]) => {
    const expression = body.match(/z-index:\s*calc\(([^;]+)\)\s*!important/)[1];
    // Six rows and two role bands permit twelve distinct formation layers.
    return [0, 11].map(depth => {
      const numeric = expression.replace(/var\((--combat-layer-[\w-]+)\)/g, (_, name) => variables[name])
        .replace(/var\(--combat-depth,\s*0\)/g, depth);
      assert.match(numeric, /^[\d\s+]+$/);
      return numeric.split('+').reduce((sum, term) => sum + Number(term), 0);
    });
  });
  return { scenery: variables['--combat-layer-scenery'], sprites, fade: variables['--combat-layer-fade'],
    selectionSurfaces: [variables['--combat-layer-selection'], variables['--combat-layer-selection'] + 1,
      variables['--combat-layer-selection'] + 3, variables['--combat-layer-selection'] + 4],
    hudSurfaces: [variables['--combat-layer-hud']], selectionCategories: ['enemy-leading', 'enemy-reading', 'target-proxy'],
    cards: variables['--combat-layer-cards'],
    hud: variables['--combat-layer-hud'], footer: variables['--combat-layer-hud'] };
}

test('declared fade covers idle and selected fighters below selection, cards and HUD', () => {
  const layers = declaredLayers(css);
  assert.equal(layers.sprites.length, 6, 'enemy, player and context-selected rules are evaluated at both depths');
  assertCombatLayerOrder(layers);
  assert.match(css, /\.combatant\.context-selected \.sprite\s*\{\s*scale: 1\.05;/);
});

test('picker, proxy and inspector must stay below cards while player HUD700 stays above', () => {
  const layers = declaredLayers(css);
  assertCombatLayerOrder({ ...layers, hudSurfaces: [700] });
  for (const category of ['picker', 'proxy', 'inspector']) {
    assert.throws(() => assertCombatLayerOrder({ ...layers, selectionSurfaces: [...layers.selectionSurfaces, 601] }),
      /every ordinary selection surface must stay below cards/, category);
  }
  assert.throws(() => assertCombatLayerOrder({ ...layers, hudSurfaces: [599] }), /HUD-owned surface must stay above cards/);
  assert.throws(() => assertCombatLayerOrder({ ...layers, selectionSurfaces: [...layers.selectionSurfaces, NaN] }),
    /numeric z-index/, 'visible auto must fail rather than disappear');
  assert.throws(() => assertCombatLayerOrder({ ...layers, selectionCategories: ['enemy-leading', 'enemy-reading'] }),
    /required painted selection category missing: target-proxy/);
});

test('rendered sampler skips absent dead-actor pseudos but keeps visible auto for a clear failure', () => {
  const probe = readFileSync(new URL('../tools/combat-layer-qa.mjs', import.meta.url), 'utf8');
  const start = probe.indexOf('      const paints = ');
  assert(start >= 0);
  const paints = runInNewContext(probe.slice(start, probe.indexOf('\n      const sprites = ', start)) + '\npaints', {
    getComputedStyle: (node, pseudo) => pseudo ? node.pseudo : node.style,
  });
  const style = { display: 'block', visibility: 'visible', content: '""', zIndex: 'auto' };
  const node = { style, pseudo: { ...style, content: 'none' }, parentElement: null };
  assert.equal(paints(node, '::before'), false, 'dead actor has no authored proxy content');
  node.pseudo = { ...style, display: 'none' };
  assert.equal(paints(node, '::after'), false);
  node.pseudo = style;
  assert.equal(paints(node, '::before'), true, 'visible auto must reach the numeric gate');
  node.parentElement = { style: { ...style, display: 'none' }, parentElement: null };
  assert.equal(paints(node), false, 'a hidden ancestor prevents painting');
});

test('the shared gate rejects the original fade150 regression', () => {
  const reverted = css.replace(/--combat-layer-fade:\s*\d+/, '--combat-layer-fade: 150');
  assert.notEqual(reverted, css, 'known-bad must change the production declaration');
  assert.throws(() => assertCombatLayerOrder(declaredLayers(reverted)), /fade must paint above every fighter/);
});

test('selected enemies may rise above idle players but never through the fade', () => {
  const layers = declaredLayers(css);
  assertCombatLayerOrder({ ...layers, sprites: [211, 300, 361] });
  assert.throws(() => assertCombatLayerOrder({ ...layers, sprites: [211, 300, layers.fade] }),
    /fade must paint above every fighter/);
  assert.throws(() => assertCombatLayerOrder({ ...layers, selectionSurfaces: [layers.fade] }),
    /fade must stay below every selection surface/);
});
