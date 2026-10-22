import test from 'node:test';
import assert from 'node:assert/strict';
import { flaskIdentityHtml } from '../src/ui/components/flask.js';
import { classUnfold } from '../src/ui/components/creationCards.js';
import { openCardChoiceModal } from '../src/ui/components/cardChoiceModal.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { uiIconId } from '../src/content/uiIcons.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);
const flask = { name: 'Blue Draught', artKey: 'blue', tint: '#abc' };

test('flask art resolves named and legacy icons identically, without printing an ID', () => {
  const named = flaskIdentityHtml({ ...flask, icon: 'mana' });
  const legacy = flaskIdentityHtml({ ...flask, icon: String.fromCodePoint(0x1f4a7) });
  assert.equal(named, legacy);
  assert.match(named, /data-engraved-icon="mana"/);
  assert.doesNotMatch(named, />mana</);
  assert.match(named, />Blue Draught</);
  assert.match(flaskIdentityHtml({ ...flask, icon: 'custom-unavailable-icon' }), />Flask</);
});

test('class unfold renders a relic icon as artwork rather than a named token', () => withKitDom(() => {
  const view = classUnfold({ cls: { id: 'reaver', name: 'Reaver' }, relic: { name: 'Pilgrim Token', icon: 'flask-health' } });
  const art = view.querySelector('.cc-unfold-relic-glyph');
  assert.equal(art.querySelector('[data-engraved-icon]').dataset.engravedIcon, 'flask-health');
  assert.doesNotMatch(art.textContent, /flask-health/);
  assert.equal(view.querySelector('.cc-unfold-relic-name').textContent, 'Pilgrim Token');
}));

test('card choice titles contain the readable option name without its icon ID', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const shell = openCardChoiceModal({ cardName: 'Test card', plan: { kind: 'stance', options: [
    { id: 'a', icon: 'flask-health', name: 'Defensive stance', tooltip: 'Guard the next blow.' },
  ] }, onChoose() {} });
  assert.equal(document.querySelector('.co-name').textContent, 'Defensive stance');
  shell.close();
}));

test('relic reward art resolves its registry icon rather than printing a token', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const relic = registries.relics.all()[0];
  mountRewards(app, { registries, run: { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } },
    checkpoint: { states: {} }, rewards: { relicId: relic.id }, onDone() {}, onPersist: () => true,
    saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }), saveMeta() {} } });
  const identity = app.querySelector('[data-kind="relic"] b');
  assert.ok(identity, 'the relic row renders its identity');
  assert.doesNotMatch(identity.textContent, new RegExp(relic.icon));
  assert.equal(identity.querySelector('[data-engraved-icon]').dataset.engravedIcon, uiIconId(relic.icon));
}));
