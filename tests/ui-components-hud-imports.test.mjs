import test from 'node:test';
import assert from 'node:assert/strict';
import { receipt, findings } from '../tools/ui-components.mjs';

const source = receipt();
const importPattern = /import\s*\{[^}]+\}\s*from\s*(['"])((?:\.\.\/components\/|\.\/)runHud\.js)\1/g;
const replaceImport = (text, names) => text.replace(importPattern, (_match, quote, path) => `import { ${names} } from ${quote}${path}${quote}`);
const c3 = state => findings(state).filter(message => message.startsWith('C3 '));

for (const consumer of ['map', 'restFrame', 'shop']) {
  test(`${consumer} HUD contract accepts reordered bindings and additional helpers`, () => {
    const next = replaceImport(source[consumer], 'RefreshRunHud,\n  wireRunHud, runHudHtml,');
    assert.notEqual(next, source[consumer], 'fixture replaces the shared HUD import');
    assert.deepEqual(c3({ ...source, [consumer]: next }), []);
  });

  for (const missing of ['runHudHtml', 'wireRunHud']) {
    test(`${consumer} HUD contract still requires imported ${missing}`, () => {
      const names = ['RefreshRunHud', 'runHudHtml', 'wireRunHud'].filter(name => name !== missing).join(', ');
      assert.equal(c3({ ...source, [consumer]: replaceImport(source[consumer], names) }).length, 1);
    });
  }

  test(`${consumer} HUD contract still requires the shared module and live wiring call`, () => {
    const wrongModule = replaceImport(source[consumer], 'runHudHtml, wireRunHud').replace(/runHud\.js(['"])/g, 'privateHud.js$1');
    assert.equal(c3({ ...source, [consumer]: wrongModule }).length, 1);
    const disconnected = source[consumer].replaceAll('wireRunHud(app, {', 'wirePrivateHud(app, {');
    assert.equal(c3({ ...source, [consumer]: disconnected }).length, 1);
  });
}
