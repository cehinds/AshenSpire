import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { mountGameProfileSettings, readNewGameProfile } from '../src/ui/components/gameProfileSelector.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const labels = { classXpMultiplier: 'Class XP multiplier', weaponXpMultiplier: 'Used weapon XP multiplier' };
async function mounted(fn) {
  const dom = rewardDom();
  const previous = { document: globalThis.document, Option: globalThis.Option };
  globalThis.document = dom.document;
  globalThis.Option = function Option(text, value) {
    const option = dom.document.createElement('option'); option.textContent = text; option.value = value; return option;
  };
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  host.replaceChildren = (...nodes) => { for (const child of [...host.children]) child.remove(); host.append(...nodes); };
  try { await fn(host, dom); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
const author = { formatVersion: 1, core: 'ashen.core@2.0.0', modules: { progression: { classXpMultiplier: 0, weaponXpMultiplier: 1.2 } } };
const change = async (host, dom, key, value) => {
  const input = host.querySelectorAll('input').find(input => input.getAttribute('aria-label') === labels[key]);
  assert.ok(input, `${key} is actually mounted`);
  input.value = value; input.dispatchEvent(new dom.Event('change', { bubbles: true }));
  await new Promise(resolve => setImmediate(resolve));
  return input;
};

for (const key of Object.keys(labels)) for (const failure of ['rejected', 'thrown']) {
  test(`${key} restores its active value and profile after a ${failure} mounted save`, async () => mounted(async (host, dom) => {
    const text = JSON.stringify(author), settings = { newGameProfile: text, importedGameProfile: text };
    const active = readNewGameProfile(settings), calls = [];
    mountGameProfileSettings(host, { settings, onChange: async changes => {
      calls.push(changes);
      if (failure === 'thrown') throw new Error('storage offline');
      return { ok: false };
    } });
    const pickerBefore = host.querySelector('select').value;
    const input = await change(host, dom, key, '2');
    assert.equal(calls.length, 1, 'the actual change attempts one durable save');
    assert.equal(input.value, String(active.modules.progression[key]), 'rejection restores the active rate, including zero');
    assert.equal(host.querySelector('select').value, pickerBefore);
    assert.match(host.querySelector('[role="status"]').textContent, failure === 'thrown' ? /storage offline/ : /could not be saved/i);
    assert.equal(settings.newGameProfile, text);
    assert.equal(settings.importedGameProfile, text);
    assert.equal(readNewGameProfile(settings).hash, active.hash, 'failed save cannot replace the active profile');
    assert.equal(host.querySelector('select').disabled, false, 'the selector is usable again');
  }));
}

for (const key of Object.keys(labels)) for (const value of ['0', '0.5', '10']) {
  test(`${key} accepts and durably displays ${value} after a mounted save`, async () => mounted(async (host, dom) => {
    const storage = createMemoryStorage(), saves = createSaveManager(storage);
    const settings = { newGameProfile: JSON.stringify(author), importedGameProfile: JSON.stringify(author) };
    mountGameProfileSettings(host, { settings, onChange: async changes => {
      const meta = saves.loadMeta(); meta.settings = { ...settings, ...changes }; return saves.saveMeta(meta);
    } });
    await change(host, dom, key, value);
    const current = readNewGameProfile(settings);
    assert.equal(current.modules.progression[key], Number(value));
    assert.equal(host.querySelectorAll('input').find(input => input.getAttribute('aria-label') === labels[key]).value, value, 'success rerenders from the saved profile');
    const reloaded = readNewGameProfile(createSaveManager(storage).loadMeta().settings);
    assert.equal(reloaded.hash, current.hash);
    const other = key === 'classXpMultiplier' ? 'weaponXpMultiplier' : 'classXpMultiplier';
    assert.equal(current.modules.progression[other], author.modules.progression[other], 'the other multiplier stays unchanged');
  }));
}
