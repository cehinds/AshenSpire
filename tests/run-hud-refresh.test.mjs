import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { runHudHtml, runHudRefreshSignature } from '../src/ui/components/runHud.js';
import { withKitDom } from './helpers/dom.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function options() {
  return { registries, run: createRunState({ seed: 71, classId: 'reaver', registries }), meta: { settings: {} }, place: 'shop' };
}

test('HUD refresh signature is stable for no-op returns and unrelated run bookkeeping', () => withKitDom(() => {
  const opts = options(), initial = runHudRefreshSignature(opts);
  assert.equal(runHudRefreshSignature(opts), initial);
  opts.run.gameProfileOpenShop = 'merchant';
  opts.run.notesForTest = 'not a HUD presentation input';
  assert.equal(runHudRefreshSignature(opts), initial);
}));

for (const [label, change] of [
  ['current HP', run => { run.hp = Math.max(0, run.hp - 1); }],
  ['maximum HP', run => { run.maxHp += 5; }],
  ['relic inventory', run => { run.relics = [...run.relics, registries.relics.all().find(def => !run.relics.includes(def.id)).id]; }],
  ['charge flask count', run => { run.flaskCharges = { ...run.flaskCharges, hpCurrent: (run.flaskCharges?.hpCurrent || 0) + 1 }; }],
  ['carried potion count', run => { run.flasks = [...run.flasks, { flaskId: registries.flasks.all()[0].id }]; }],
]) {
  test(`HUD refresh detects ${label} changes even when its shell markup is identical`, () => withKitDom(() => {
    const opts = options(), shell = runHudHtml(opts), before = runHudRefreshSignature(opts);
    change(opts.run);
    assert.equal(runHudHtml(opts), shell, 'the shell does not contain this independently wired content');
    assert.notEqual(runHudRefreshSignature(opts), before, 'the dependent HUD must refresh');
  }));
}
