import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { withModalDom } from './helpers/modal-dom.mjs';
import { settingsRowHtml, categoryHandler, refreshGates, refreshHandRuleControls, setSettingsControlDisabled } from '../src/ui/screens/settings.js';
import { resolveHandRules, HAND_RULES_PREFIX } from '../src/model/handRules.js';

function stepper(dom, container, key) {
  const row = dom.document.createElement('div'); row.className = 'set-row';
  const label = dom.document.createElement('span'); label.className = 'as-labelstack'; row.append(label);
  const wrap = dom.document.createElement('span'); wrap.className = 'set-stepper'; wrap.dataset.stepper = ''; wrap.dataset.numberDisabled = 'false';
  const field = dom.document.createElement('input'); field.type = 'number'; field.setAttribute('type', 'number'); field.dataset.key = key; field.value = '5'; field.disabled = false;
  const slider = dom.document.createElement('input'); slider.type = 'range'; slider.setAttribute('type', 'range'); slider.value = '5'; slider.min = '0'; slider.max = '10';
  const buttons = [-1, 1].map(step => { const button = dom.document.createElement('button'); button.className = 'set-step'; button.dataset.step = String(step); button.dataset.stepBy = '1'; return button; });
  wrap.append(buttons[0], slider, field, buttons[1]); row.append(wrap); container.append(row);
  return { row, wrap, field, slider, buttons };
}

test('initial number/range rows declare an enabled number independently of bound buttons', () => {
  for (const type of ['number', 'range']) {
    const html = settingsRowHtml({}, { type, key: 'test', label: 'Number', def: 0, min: 0, max: 10, step: 1 });
    assert.match(html, /data-stepper data-number-disabled="false"/);
    assert.match(html, /data-step="-1"[^>]* disabled/);
    assert.doesNotMatch(html, /<input type="number"[^>]* disabled/);
  }
});

test('only the canonical number input changes the parent marker', () => {
  withModalDom(dom => {
    const { wrap, field, slider, buttons } = stepper(dom, dom.document.body, 'number');
    setSettingsControlDisabled(field, true);
    assert.equal(field.disabled, true); assert.equal(field.getAttribute('aria-disabled'), 'true'); assert.equal(wrap.dataset.numberDisabled, 'true');
    setSettingsControlDisabled(slider, false); setSettingsControlDisabled(buttons[0], false);
    assert.equal(wrap.dataset.numberDisabled, 'true', 'slider and bound-button availability cannot unlock a disabled number');
    setSettingsControlDisabled(field, false);
    assert.equal(field.getAttribute('aria-disabled'), 'false'); assert.equal(wrap.dataset.numberDisabled, 'false');
  });
});

test('gate close, inherited display, reopen and a rebuilt row keep the marker current', () => {
  withModalDom(dom => {
    const key = 'gameConfig.equipmentRequirements.greatsword.strength', own = 'gameConfig.own.equipmentRequirements.greatsword.strength';
    const host = dom.document.createElement('section'); dom.document.body.append(host);
    let controls = stepper(dom, host, key); controls.field.value = '1';
    const settings = { 'gameConfig.equipmentRequirements.scale': .5, [key]: 1, [own]: false };
    refreshGates(host, settings);
    assert.equal(controls.field.disabled, true); assert.equal(controls.wrap.dataset.numberDisabled, 'true'); assert.equal(controls.field.value, '2');
    settings[own] = true; refreshGates(host, settings);
    assert.equal(controls.field.disabled, false); assert.equal(controls.wrap.dataset.numberDisabled, 'false'); assert.equal(controls.field.value, '1');
    controls.row.remove(); controls = stepper(dom, host, key);
    settings[own] = false; refreshGates(host, settings);
    assert.equal(controls.field.disabled, true); assert.equal(controls.wrap.dataset.numberDisabled, 'true', 'search/reopen replacement rows receive the current gate state');
  });
});

test('hand retention dependencies and fixed-draw visibility update number markers in both directions', () => {
  withModalDom(dom => {
    const host = dom.document.createElement('section'); dom.document.body.append(host);
    const discard = stepper(dom, host, HAND_RULES_PREFIX + 'discardLimit');
    const fixedRow = categoryHandler('Advanced').rows.find(row => row.fixedOnly && row.type === 'number');
    assert.ok(fixedRow); const fixed = stepper(dom, host, fixedRow.key);
    const rules = { ...resolveHandRules({}), retain: false, promptDiscard: true, drawMode: 'fixed' };
    refreshHandRuleControls(host, rules);
    assert.equal(discard.field.disabled, true); assert.equal(discard.wrap.dataset.numberDisabled, 'true');
    assert.equal(fixed.field.disabled, false); assert.equal(fixed.wrap.dataset.numberDisabled, 'false'); assert.equal(fixed.row.hidden, false);
    rules.retain = true; refreshHandRuleControls(host, rules);
    assert.equal(discard.field.disabled, false); assert.equal(discard.wrap.dataset.numberDisabled, 'false');
    rules.drawMode = 'fill'; rules.promptDiscard = false; refreshHandRuleControls(host, rules);
    assert.equal(discard.wrap.dataset.numberDisabled, 'true'); assert.equal(fixed.wrap.dataset.numberDisabled, 'true'); assert.equal(fixed.row.hidden, true);
    rules.drawMode = 'fixed'; rules.promptDiscard = true; refreshHandRuleControls(host, rules);
    assert.equal(discard.wrap.dataset.numberDisabled, 'false'); assert.equal(fixed.wrap.dataset.numberDisabled, 'false'); assert.equal(fixed.row.hidden, false);
  });
});

test('keyboard stepping still trusts native disabled and keeps min/max buttons independent', () => {
  withModalDom(dom => {
    const { wrap, field, slider, buttons } = stepper(dom, dom.document.body, 'number');
    const source = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
    const start = source.indexOf('function wireStepper('), end = source.indexOf('\n/** markModified', start);
    const wire = runInNewContext(`${source.slice(start, end)}\nwireStepper`, { setTimeout: () => 1, clearTimeout() {} });
    let value = 5, commits = 0;
    wire(wrap, { read: () => value, commit: next => { value = Number(next); field.value = String(next); commits++; }, min: 5, max: 10, step: 1 });
    field.dispatchEvent(new dom.Event('change'));
    assert.equal(buttons[0].disabled, true); assert.equal(field.disabled, false); assert.equal(wrap.dataset.numberDisabled, 'false');
    const click = () => { const event = new dom.Event('click'); event.detail = 0; buttons[1].dispatchEvent(event); };
    setSettingsControlDisabled(field, true); wrap.dataset.numberDisabled = 'false'; click();
    assert.equal(commits, 0, 'even a stale presentation marker cannot bypass the number lock');
    slider.value = '8'; slider.dispatchEvent(new dom.Event('change')); assert.equal(commits, 0);
    setSettingsControlDisabled(field, false); click();
    assert.equal(commits, 1); assert.equal(value, 6); assert.equal(buttons[0].disabled, false); assert.equal(wrap.dataset.numberDisabled, 'false');
  });
});
