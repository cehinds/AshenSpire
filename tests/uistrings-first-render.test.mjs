// tests/uistrings-first-render.test.mjs — the copy table owns a control's FIRST
// face, not only the face it wears after a click.
//
// Codex, #1489 (four threads): a control's t() id existed, and its first render
// or its zero-selection refresh still wrote the old literal, so rewording the
// row in content/source/uiStrings.csv moved the text only after an interaction
// — the hand-discard Confirm, the settings-sync Copy JSON button, the prologue
// editor's follow-style button, and the short-screen refusal's pointer to the
// Settings row. This file rewords those rows BEFORE any module loads, exactly
// as an edited CSV would, and asserts what the control shows on first render
// and after a refresh. Its own file for the same reason as
// tests/uistrings-stable-ids.test.mjs: node --test gives it its own process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { uiStrings } from '../src/content/generated/uiStrings.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

const reword = (id, short) => {
  const row = uiStrings.find((entry) => entry.id === id);
  assert.ok(row, `no uiStrings row '${id}'`);
  row.short = short;
};
reword('handDiscard.keepAllEndTurn', 'REWORDED keep and end');
reword('settingsSync.copy', 'REWORDED copy');
reword('prologueEditor.followStyle', 'REWORDED use style');
reword('prologueEditor.followingStyle', 'REWORDED following style');
reword('settings.row.uprightGate', 'REWORDED short-screen row');
reword('settings.group.Interface', 'REWORDED interface group');
reword('settings.title', 'REWORDED settings');
reword('potions.run.title', 'REWORDED potions');

const { openHandDiscard } = await import('../src/ui/components/handDiscard.js');
const { renderSettingsSync } = await import('../src/ui/components/settingsSync.js');
const { updateUprightGate } = await import('../src/ui/components/upright.js');
const { POTIONS_TIP_HTML } = await import('../src/ui/components/combatActionRow.js');
const { openPrologueSceneEditor } = await import('../src/ui/screens/prologueSceneEditor.js');
const { prologueSettingKey } = await import('../src/model/prologue.js');

const textOf = (node) => [node.textContent || '', ...(node.children || []).map(textOf)].join(' ');

test('hand discard: Confirm wears the reworded row on first render and after a refresh to zero', () => {
  withKitDom((dom) => {
    const registries = createRegistries(contentBundle);
    const card = { instanceId: 'c1', cardId: contentBundle.cards[0].id };
    const shell = openHandDiscard(registries, { minimum: 0, maximum: 2, cards: [card] }, () => {});
    const confirm = dom.document.body.querySelector('.hand-discard-confirm');
    assert.ok(confirm, 'no Confirm button rendered');
    assert.equal(confirm.textContent, 'REWORDED keep and end', 'first render overwrote the row with a literal');
    const box = dom.document.body.querySelector('[data-discard-id]');
    assert.ok(box, 'no discard checkbox rendered, so the refresh path went untested');
    box.checked = true; box.dispatchEvent(new dom.Event('change'));
    assert.notEqual(confirm.textContent, 'REWORDED keep and end', 'one selected should say Discard 1');
    box.checked = false; box.dispatchEvent(new dom.Event('change'));
    assert.equal(confirm.textContent, 'REWORDED keep and end', 'refresh to zero selected wrote a literal');
    shell?.close?.();
  });
});

test('settings sync: Copy JSON wears the reworded row on first render and on every redraw', () => {
  withKitDom((dom) => {
    const mount = dom.document.createElement('div');
    dom.document.body.append(mount);
    const written = [];
    const proto = Object.getPrototypeOf(mount);
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'innerHTML')?.set
      || Object.getOwnPropertyDescriptor(proto, 'innerHTML').set;
    Object.defineProperty(mount, 'innerHTML', { configurable: true, set(html) { written.push(html); setter.call(this, html); }, get() { return written.at(-1) || ''; } });
    renderSettingsSync(mount, { settings: {}, onChange: () => {}, rows: [] });
    const copyFace = (html) => html.match(/data-sync="copy"[^>]*>([^<]*)</)?.[1];
    assert.equal(copyFace(written.at(-1)), 'REWORDED copy', 'first render hard-codes the Copy button');
    // A redraw (the per-device toggle) paints the panel again from the same template.
    mount.querySelector('[data-sync="device"]')?.dispatchEvent(new dom.Event('click'));
    assert.equal(copyFace(written.at(-1)), 'REWORDED copy', 'a redraw hard-codes the Copy button');
  });
});

test('short-screen refusal: the way-out hint names the Settings row by its own string entry', () => {
  withKitDom((dom) => {
    const gate = updateUprightGate({ short: true, offerRotate: false });
    assert.ok(gate, 'the gate did not stand');
    const hint = textOf(gate.querySelector('.upright-hint'));
    assert.match(hint, /REWORDED short-screen row/, 'the hint hard-codes the row name');
    assert.match(hint, /REWORDED interface group/, 'the hint names a section other than the one Settings files the row under');
    assert.match(hint, /REWORDED settings/, 'the hint hard-codes the Settings title');
    // And again after the advice changes (the gate repaints in place).
    const turned = updateUprightGate({ short: true, offerRotate: true });
    assert.match(textOf(turned.querySelector('.upright-hint')), /REWORDED short-screen row/);
    updateUprightGate({ short: false });
  });
});

test('prologue editor: the follow-style button wears the reworded rows on first render and after a reset', () => {
  withKitDom((dom) => {
    const stubs = {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      Option: class { constructor(text, value) { const option = dom.document.createElement('option'); option.textContent = text; option.value = value; return option; } },
      ResizeObserver: class { observe() {} disconnect() {} },
    };
    const saved = Object.fromEntries(Object.keys(stubs).map((key) => [key, globalThis[key]]));
    Object.assign(globalThis, stubs);
    // A scene with its own staging and one overridden field: every staging
    // field gets a follow button, one of them live (overridden), the rest not.
    const overridden = prologueSettingKey(['scenes', 'year', 'stage', 'lineHeight']);
    const settings = { [prologueSettingKey(['scenes', 'year', 'ownStaging'])]: true, [overridden]: 1.4 };
    const onChange = (key, value) => { if (value === undefined) delete settings[key]; else settings[key] = value; };
    let door;
    try {
      door = openPrologueSceneEditor(settings, onChange, { sceneId: 'year', tab: 'Typography' });
      const faces = () => dom.document.body.querySelectorAll('.pse-follow').map((button) => [button.disabled, button.textContent]);
      assert.ok(faces().length > 1, 'no follow-style buttons rendered');
      for (const [disabled, text] of faces()) {
        assert.equal(text, disabled ? 'REWORDED following style' : 'REWORDED use style', 'first render hard-codes the follow-style button');
      }
      // Reset the overridden field: the editor redraws, and every button follows.
      const live = dom.document.body.querySelectorAll('.pse-follow').find((button) => !button.disabled);
      live.dispatchEvent(new dom.Event('click'));
      assert.equal(settings[overridden], undefined, 'the reset did not remove the override');
      assert.ok(faces().every(([disabled, text]) => disabled && text === 'REWORDED following style'), 'a redraw hard-codes the follow-style button');
    } finally {
      door?.close?.();
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    }
  });
});

test('combat potions: the tooltip title is the button\'s own row, so a reword moves both', () => {
  // Found by the same sweep (#1489): the button read t('potions.run.title') and
  // its tooltip still opened on a literal "Potions".
  assert.match(POTIONS_TIP_HTML, /<div class="tt-title">REWORDED potions<\/div>/);
});
