// Desktop and widescreen form factors (the wide-screen combat layout). Owner
// (2026-10-13): their bands, hand, formation and horizon are the phone's, scaled
// to the viewport. Only the footer art width and the desktop tool corners differ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planCombatLayout } from './helpers/combat-layout-plan.mjs';
import { isWideFormFactor, WIDE_FORM_FACTORS } from '../src/ui/models/FormFactorModel.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;
const combatLayoutSource = readFileSync(new URL('../src/ui/components/combatLayout.js', import.meta.url), 'utf8');

test('only desktop and widescreen are wide form factors', () => {
  assert.deepEqual([...WIDE_FORM_FACTORS], ['desktop', 'widescreen']);
  assert.equal(isWideFormFactor('desktop'), true);
  assert.equal(isWideFormFactor('widescreen'), true);
  assert.equal(isWideFormFactor('tablet'), false);
  assert.equal(isWideFormFactor('mobile'), false);
  assert.equal(isWideFormFactor(undefined), false);
});

// Widescreen, desktop, tablet and phone share one band plan at every window
// size. Each form factor reaches the plan through the real caller
// (wireCombatLayout reading data-form-factor), so a wide window's bands are
// the phone's, not a table of its own.
const WINDOWS = [
  { width: 1280, height: 720, zoom: 0.99 },
  { width: 1920, height: 1080, zoom: 1.48 },
  { width: 2560, height: 1440, zoom: 1.97 },
  { width: 1920, height: 1080, zoom: 1 },
];
// The hud, hand and arrangement are the phone's. The footer band is the art
// height at the form factor's art width (footerLayout), so the wide footer keeps
// its own art; it must sit at the 92px physical floor the phone footer floors at.
const SHARED = ['hud', 'hand', 'arrangement', 'supported'];
for (const { width, height, zoom } of WINDOWS) {
  test(`widescreen and desktop bands equal the phone's at ${width}x${height} (zoom ${zoom})`, () => {
    const local = { width: width / zoom, height: height / zoom, zoom };
    const phone = planCombatLayout({ formFactor: 'mobile', ...local });
    for (const formFactor of ['desktop', 'widescreen']) {
      const wide = planCombatLayout({ formFactor, ...local });
      assert.deepEqual(SHARED.map(key => wide[key]), SHARED.map(key => phone[key]), `${formFactor} bands at ${width}x${height}`);
      assert.ok(Math.abs(wide.footer * zoom - 92) < 1.5, `${formFactor} footer at ${width}x${height}: ${wide.footer * zoom}px`);
      assert.ok(near(wide.hand / local.height, .30) || wide.hand * zoom <= 208 + 1e-6, `hand share at ${width}x${height}`);
    }
  });
}

// applyUiScale writes data-form-factor after its debounced resize, so a band
// plan that only re-runs on ResizeObserver can keep the old form factor's
// shares. The combat layout must re-plan on that attribute's change, and let go
// of the observer when it releases.
test('the combat layout re-plans when data-form-factor changes', () => {
  assert.match(combatLayoutSource, /formFactorObserver = new MutationObserver\(schedule\);/);
  assert.match(combatLayoutSource, /formFactorObserver\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['data-form-factor'\] \}\);/);
  assert.match(combatLayoutSource, /function release\(\) \{[\s\S]*?formFactorObserver\?\.disconnect\(\);/);
});
