// With the profile editing the deck only at a rest site, the Armoury's Deck tab says so (and shows a read-only list)
// instead of blaming the settings; every other no-editor case keeps the old text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameModule } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { withKitDom } from './helpers/dom.mjs';
import { mountEquipment } from '../src/ui/screens/equipment.js';
import { t } from '../src/ui/strings.js';

const profile = resolveGameProfile('core');
const REG = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function armouryDom(dom) {
  if (!dom.document.documentElement) dom.document.documentElement = dom.document.createElement('html');
  globalThis.NodeFilter = globalThis.NodeFilter || { SHOW_TEXT: 4 };
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceWith = proto.replaceWith || function replaceWith(node) {
    const parent = this.parentNode;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    node.remove?.();
    node.parentNode = parent;
    parent.children.splice(at, 1, node);
    this.parentNode = null;
  };
  if (!Object.getOwnPropertyDescriptor(proto, 'parentElement')) {
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode || null; } });
  }
}
const textOf = node => String(node.outerHTML ?? "");
function clickDeckTab(dom, run) {
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat: false, onClose() {}, onChange() {} });
  const tab = dom.document.body.querySelector('[data-modal-tab="deck"]');
  assert.ok(tab, 'the Deck tab exists');
  tab.click();
  return textOf(dom.document.body);
}

test('editorWhere "rest": the Deck tab names the rest-site rule', () => {
  withKitDom(dom => {
    armouryDom(dom);
    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    assert.equal(gameModule(run, 'cards')?.editorWhere, 'rest');
    const text = clickDeckTab(dom, run);
    assert.match(text, /You can edit your deck at a rest site\./);
    assert.doesNotMatch(text, /unavailable with the current settings/);
  });
});

test('any other profile keeps the settings text', () => {
  withKitDom(dom => {
    armouryDom(dom);
    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    run.gameProfile.modules.cards = { ...run.gameProfile.modules.cards, editorWhere: 'none' };
    const text = clickDeckTab(dom, run);
    assert.match(text, /Deck editing is unavailable with the current settings\./);
    assert.doesNotMatch(text, /edit your deck at a rest site/);
  });
});

test('the rest-site text lives in uiStrings', () => {
  assert.equal(t('armoury.deck.restOnly'), 'You can edit your deck at a rest site.');
});
