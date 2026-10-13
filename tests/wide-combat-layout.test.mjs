// Desktop and widescreen form factors (the wide-screen combat layout). Owner
// (2026-10-13): their bands, hand, formation and horizon are the phone's, scaled
// to the viewport. Only the footer art width and the desktop tool corners differ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight } from '../src/ui/models/FooterLayoutModel.js';
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
// height, so a wide window's battlefield and hand are the phone's proportions.
for (const windowHeight of [720, 1080, 1440, 2160]) {
  test(`widescreen band shares equal desktop and the phone's at a ${windowHeight}px window`, () => {
    const zoom = windowHeight / 730, localHeight = 730, width = 1920 / zoom;
    const plan = (formFactor) => allocateCombatBands({ width, height: localHeight, zoom, footerArtPx: footerArtHeight(width, zoom, formFactor) * zoom });
    const desktopPlan = plan('desktop');
    const widePlan = plan('widescreen');
    assert.deepEqual({ ...widePlan }, { ...desktopPlan }, `widescreen plan at ${windowHeight}px`);
    assert.ok(widePlan.footer * zoom <= desktopPlan.footer * zoom + .5);
    assert.ok(near(widePlan.hand / localHeight, .30) || widePlan.hand * zoom <= 208 + 1e-6, `hand share at ${windowHeight}px`);
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
