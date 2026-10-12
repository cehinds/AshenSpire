// Desktop and widescreen form factors (the wide-screen combat layout). Both are
// "wide" for the band shares and the footer width: widescreen takes desktop's
// shares and 450px footer art. Enemy placement follows the shared perspective
// grid (SPEC: default perspective draws one uniform grid), so there is no
// wide-only enemy placement to test here. Phones and tablets keep their bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { footerArtHeight } from '../src/ui/models/FooterLayoutModel.js';
import { isWideFormFactor, WIDE_FORM_FACTORS } from '../src/ui/models/FormFactorModel.js';

const combatLayoutSource = readFileSync(new URL('../src/ui/components/combatLayout.js', import.meta.url), 'utf8');

test('only desktop and widescreen are wide form factors', () => {
  assert.deepEqual([...WIDE_FORM_FACTORS], ['desktop', 'widescreen']);
  assert.equal(isWideFormFactor('desktop'), true);
  assert.equal(isWideFormFactor('widescreen'), true);
  assert.equal(isWideFormFactor('tablet'), false);
  assert.equal(isWideFormFactor('mobile'), false);
  assert.equal(isWideFormFactor(undefined), false);
});

// Widescreen takes the desktop band shares at every window height: the same
// plan as desktop, so the footer is never taller than desktop's and the hand
// keeps desktop's share.
for (const windowHeight of [720, 1080, 1440, 2160]) {
  test(`widescreen band shares equal desktop at a ${windowHeight}px window`, () => {
    const zoom = windowHeight / 730, localHeight = 730, width = 1920 / zoom;
    const desktopPlan = allocateCombatBands({ width, height: localHeight, zoom, footerArtPx: footerArtHeight(width, zoom, 'desktop') * zoom, formFactor: 'desktop' });
    const widePlan = allocateCombatBands({ width, height: localHeight, zoom, footerArtPx: footerArtHeight(width, zoom, 'widescreen') * zoom, formFactor: 'widescreen' });
    assert.deepEqual({ ...widePlan }, { ...desktopPlan }, `widescreen plan at ${windowHeight}px`);
    assert.ok(widePlan.footer * zoom <= desktopPlan.footer * zoom + .5);
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
