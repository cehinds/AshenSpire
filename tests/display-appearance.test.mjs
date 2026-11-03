import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDisplayAppearance } from '../src/model/displayAppearance.js';
import { applyDisplayAppearance, displayAppearance } from '../src/ui/displayAppearance.js';
import { settingsRow, settingsSearchHits } from '../src/ui/screens/settings.js';
import { alternativeBackdropHtml, alternativeCardFadeHtml } from '../src/ui/alternativeArt.js';
import { combatBackdropHtml } from '../src/ui/components/environmentArt.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';

const combatScreen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('alternative is the only appearance: a saved classicAppearance key is ignored and the Settings row is gone', () => {
  assert.equal(resolveDisplayAppearance(), 'alternative');
  assert.equal(resolveDisplayAppearance({ classicAppearance: false }), 'alternative');
  assert.equal(resolveDisplayAppearance({ classicAppearance: true }), 'alternative', 'an old profile loads as the grid layout');
  assert.throws(() => settingsRow('classicAppearance'), /no settings row/);
  assert(!settingsSearchHits('Classic appearance', true).some(hit => hit.row.key === 'classicAppearance'));
});

test('a saved classic choice still renders the layered backdrop, art and animation plans', () => {
  const run = { worldId: 'pale-marches' };
  const root = { dataset: {} };
  try {
    applyDisplayAppearance({ classicAppearance: true }, root);
    assert.equal(root.dataset.displayAppearance, 'alternative');
    assert.equal(displayAppearance(), 'alternative');
    assert.match(combatBackdropHtml(run, 'hollow-weald-1'), /alternative-backdrop/);
    assert.notEqual(alternativeBackdropHtml('hollow-weald-1'), null);
    assert.match(alternativeCardFadeHtml(), /alternative-card-fade/);
    const layered = resolveCombatAnimation({ cardTags: ['kind:attack', 'source:spell'] }, [], { classId: 'starseer', appearance: displayAppearance() });
    assert.ok(layered);
  } finally { applyDisplayAppearance({}); }
});

test('the classic redraw and lane-normalising machinery is gone', () => {
  assert.doesNotMatch(combatScreen, /onDisplayAppearanceChange|normalizeClassicPlayerFormationCell|paintedAppearance/);
});
