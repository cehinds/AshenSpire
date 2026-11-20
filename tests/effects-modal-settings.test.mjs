// THE EFFECTS MODAL (owner, 2026-11-19): Combat shows one Effects button; the
// master switch and its sub-switches draw only inside the modal it opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, generalGroups, effectsModalHtml, settingsRowHtml, allResettableKeys } from '../src/ui/screens/settings.js';
import { effectsSummary } from '../src/ui/performance.js';
import { t } from '../src/ui/strings.js';

const rows = settingsRows();
const row = (key) => rows.find((candidate) => candidate.key === key);
const modalKeys = () => rows.filter((candidate) => candidate.modal === 'effects').map((candidate) => candidate.key);

test('Combat draws one Effects button and none of the modal rows', () => {
  const combat = [...generalGroups('Combat').values()].flat().map((candidate) => candidate.key);
  assert.ok(combat.includes('effectsMenu'), 'the button row is listed');
  for (const key of modalKeys()) assert.ok(!combat.includes(key), `${key} draws only in the modal`);
});

test('the modal rows keep their keys, defaults and reset', () => {
  assert.equal(row('effects').def, false, 'Effects stays off by default');
  for (const key of ['fxGlow', 'fxSparks', 'fxFlash', 'fxHitStop']) assert.equal(row(key).def, true, `${key} defaults on`);
  const resettable = allResettableKeys();
  for (const key of modalKeys()) assert.ok(resettable.includes(key), `${key} is reset by Reset all`);
  assert.ok(!resettable.includes('effectsMenu'), 'the button is not a setting');
});

test('the button face says Off, or On with how many visual effects are on', () => {
  const off = settingsRowHtml({}, row('effectsMenu'));
  assert.match(off, new RegExp(`>${t('settings.effects.statusOff')}</button>`));
  const { count, total } = effectsSummary({ effects: true, fxSparks: false });
  assert.equal(total - count, 1);
  const on = settingsRowHtml({ effects: true, fxSparks: false }, row('effectsMenu'));
  assert.ok(on.includes(`>${t('settings.effects.statusOn', { count, total })}</button>`), on);
});

test('the modal draws the master first and greys Visual effects while Effects is off', () => {
  const off = effectsModalHtml({});
  assert.ok(off.indexOf('data-row-key="effects"') < off.indexOf('data-effects-section="visual"'), 'master switch on top');
  assert.match(off, /data-effects-section="visual" data-off="1"/);
  assert.ok(off.includes(t('settings.effects.visualOff')));
  for (const key of ['fxGlow', 'fxSparks', 'fxFlash', 'fxHitStop']) assert.ok(off.includes(`data-row-key="${key}"`), key);
  const on = effectsModalHtml({ effects: true });
  assert.doesNotMatch(on, /data-effects-section="visual" data-off/);
});

test('screen shake, ambient and fighter motion moved into the modal, keys and defaults unchanged', () => {
  assert.deepEqual(rows.filter((r) => r.modalSection === 'visual').map((r) => r.key),
    ['fxGlow', 'fxSparks', 'fxFlash', 'screenShake', 'fxHitStop', 'ambient']);
  assert.deepEqual(rows.filter((r) => r.modalSection === 'motion').map((r) => r.key),
    ['motionAttack', 'motionHit', 'motionIdle', 'motionDefeat']);
  assert.equal(row('screenShake').def, true);
  assert.equal(row('ambient').def, 'normal');
  const html = effectsModalHtml({});
  assert.ok(html.indexOf('data-effects-section="motion"') > html.indexOf('data-effects-section="visual"'));
  assert.doesNotMatch(html, /data-effects-section="motion" data-off/, 'fighter motion works with Effects off');
  assert.ok(html.includes(t('settings.effects.motionNote')));
  const interfaceRows = rows.filter((r) => r.advancedGroup === 'Interface' && !r.modal).map((r) => r.key);
  assert.ok(!interfaceRows.includes('ambient'), 'ambient left Advanced > Interface');
});
