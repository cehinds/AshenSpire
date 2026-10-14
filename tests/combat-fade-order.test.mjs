import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    selection: variables['--combat-layer-selection'] + 3, cards: variables['--combat-layer-cards'],
    hud: variables['--combat-layer-hud'], footer: variables['--combat-layer-hud'] };
}

test('declared fade covers idle and selected fighters below selection, cards and HUD', () => {
  const layers = declaredLayers(css);
  assert.equal(layers.sprites.length, 6, 'enemy, player and context-selected rules are evaluated at both depths');
  assertCombatLayerOrder(layers);
  assert.match(css, /\.combatant\.context-selected \.sprite\s*\{\s*scale: 1\.05;/);
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
