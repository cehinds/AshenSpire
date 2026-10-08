import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDisplayAppearance } from '../src/model/displayAppearance.js';
import { applyDisplayAppearance, displayAppearance, onDisplayAppearanceChange, publishDisplayAppearanceChange } from '../src/ui/displayAppearance.js';
import { settingsRow, settingsSearchHits } from '../src/ui/screens/settings.js';
import { alternativeSprite, alternativeBackdropHtml, alternativeCardFadeHtml } from '../src/ui/alternativeArt.js';
import { combatBackdropHtml } from '../src/ui/components/environmentArt.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';

test('alternative is the default and the saved classic choice is independent of debug visibility', () => {
  assert.equal(resolveDisplayAppearance(), 'alternative');
  assert.equal(resolveDisplayAppearance({ classicAppearance: false }), 'alternative');
  assert.equal(resolveDisplayAppearance({ classicAppearance: true, debug: false }), 'classic');
  const row = settingsRow('classicAppearance');
  assert.equal(row.label, 'Classic appearance');
  assert.equal(row.def, false);
  assert(settingsSearchHits('Classic appearance', true).some(hit => hit.row.key === 'classicAppearance'));
  assert(!settingsSearchHits('Classic appearance', false).some(hit => hit.row.key === 'classicAppearance'));
});

test('classic restores the previous backdrop and animation plans without modifying game inputs', () => {
  const run = { worldId: 'pale-marches' };
  const card = { cardTags: ['kind:attack', 'source:spell'] };
  const before = JSON.stringify({ run, card });
  const root = { dataset: {} };
  try {
    applyDisplayAppearance({}, root);
    assert.match(combatBackdropHtml(run, 'hollow-weald-1'), /alternative-backdrop/);
    const layered = resolveCombatAnimation(card, [], { classId: 'starseer', appearance: displayAppearance() });
    applyDisplayAppearance({ classicAppearance: true }, root);
    assert.equal(root.dataset.displayAppearance, 'classic');
    assert.equal(alternativeSprite('graveWisp'), null);
    assert.equal(alternativeBackdropHtml('hollow-weald-1'), null);
    assert.equal(alternativeCardFadeHtml(), '');
    const old = combatBackdropHtml(run, 'hollow-weald-1');
    assert(!old.includes('alternative-backdrop'));
    assert.match(old, /illustrated/);
    const classic = resolveCombatAnimation(card, [], { classId: 'starseer', appearance: displayAppearance() });
    assert.equal(classic.technique, 'cast');
    assert.notDeepEqual(classic, layered);
    assert.equal(JSON.stringify({ run, card }), before);
    applyDisplayAppearance({}, root);
    assert.match(combatBackdropHtml(run, 'hollow-weald-1'), /alternative-backdrop/);
  } finally { applyDisplayAppearance({}); }
});

test('redraw is published after settings application and detached screens stop receiving changes', () => {
  const root = { dataset: {} };
  const live = { isConnected: true }, gone = { isConnected: false };
  let draws = 0;
  const release = onDisplayAppearanceChange(live, () => {
    assert.equal(root.dataset.displayAppearance, 'classic'); draws++;
  });
  const releaseGone = onDisplayAppearanceChange(gone, () => assert.fail('detached screen redraw'));
  try {
    assert.equal(applyDisplayAppearance({ classicAppearance: true }, root), true);
    assert.equal(draws, 0);
    publishDisplayAppearanceChange();
    assert.equal(draws, 1);
    assert.equal(applyDisplayAppearance({ classicAppearance: true }, root), false);
    live.isConnected = false;
    publishDisplayAppearanceChange();
    assert.equal(draws, 1);
  } finally { release(); releaseGone(); applyDisplayAppearance({}); }
});

test('a remounted screen subscribes for the next appearance publication', () => {
  const root = { isConnected: true };
  let first = 0, replacement = 0, releaseReplacement = () => {};
  const release = onDisplayAppearanceChange(root, () => {
    first++;
    release();
    releaseReplacement = onDisplayAppearanceChange(root, () => { replacement++; });
  });
  try {
    publishDisplayAppearanceChange();
    assert.equal(first, 1);
    assert.equal(replacement, 0, 'a replacement must not redraw in the same publication');
    publishDisplayAppearanceChange();
    assert.equal(replacement, 1);
  } finally { release(); releaseReplacement(); }
});
