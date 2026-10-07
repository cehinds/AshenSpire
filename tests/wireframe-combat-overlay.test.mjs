import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayGeometry, intentVisible, OVERLAY_ROLES, overheadStackBottom } from '../src/ui/models/CombatOverlayModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('guard badges keep the accepted anchors: player upper-right, enemy lower-left', () => {
  const g = overlayGeometry();
  assert.deepEqual({ ...g.anchors.player }, { side: 'right', heightFraction: 0.12 });
  assert.deepEqual({ ...g.anchors.enemy }, { side: 'left', heightFraction: 0.88 });
  assert.ok(Object.isFrozen(g) && Object.isFrozen(g.anchors.player));
});

test('minimums hold in physical px at every UI zoom', () => {
  const config = wireframeUi.overlay;
  for (const zoom of [0.67, 1, 1.5]) {
    const rem = 16 / zoom; // the reference rem: at least 16 physical px
    const g = overlayGeometry({ zoom, rem });
    assert.ok(near(g.valueFont * zoom, config.valueFontMinPx), `value font at ${zoom}`);
    assert.ok(near(g.defenseMin * zoom, config.defenseMinRem * 16), `defense minimum at ${zoom}`);
    assert.ok(near(g.intentMin * zoom, config.intentMinRem * 16), `intent minimum at ${zoom}`);
    assert.ok(near(g.gap * zoom, config.defenseGapRem * 16), `gap at ${zoom}`);
  }
});

test('intent shows for enemies by default, never for an unknown role', () => {
  assert.equal(intentVisible('enemy'), true);
  assert.equal(intentVisible('player'), false);
  const override = { ...wireframeUi.overlay, intentVisibleByRole: { player: true, enemy: false } };
  assert.deepEqual(OVERLAY_ROLES.map((role) => intentVisible(role, override)), [true, false]);
  assert.throws(() => intentVisible('ally'), /Unknown overlay role/);
});

test('an anchor off the sprite or on no side is refused', () => {
  const bad = (anchor) => ({ ...wireframeUi.overlay, defenseAnchorByRole: { ...wireframeUi.overlay.defenseAnchorByRole, enemy: anchor } });
  assert.throws(() => overlayGeometry({}, bad({ side: 'top', heightFraction: 0.5 })), /side left or right/);
  assert.throws(() => overlayGeometry({}, bad({ side: 'left', heightFraction: 1.2 })), /0\.\.1/);
});

test('the overhead stack rests on the sprite when the field has headroom', () => {
  const placed = overheadStackBottom({ anchor: 120, height: 48, ceiling: 0 });
  assert.equal(placed.bottom, 120);
  assert.equal(placed.clamped, false);
  assert.ok(Object.isFrozen(placed));
});

test('the overhead stack never rises into the HUD band, and keeps its height', () => {
  // 844x390 at zoom 0.62: the intent (48 physical px) rested 13 px under the
  // 39 px band; selected, Inspect (44) and its gap (4) rose above the screen.
  const zoom = 0.62;
  for (const height of [48 / zoom, (44 + 4 + 48) / zoom]) {
    const placed = overheadStackBottom({ anchor: 35 / zoom, height, ceiling: 0 });
    assert.equal(placed.clamped, true);
    assert.ok(Math.abs(placed.bottom - height) < 1e-9, 'the top edge meets the band, nothing shrinks');
  }
  const below = overheadStackBottom({ anchor: 10, height: 30, ceiling: 5 });
  assert.equal(below.bottom, 35, 'a band that reaches into the field lifts the floor with it');
});

test('overhead stack inputs must be finite, and the height not negative', () => {
  assert.throws(() => overheadStackBottom({ anchor: NaN, height: 10 }), /anchor/);
  assert.throws(() => overheadStackBottom({ anchor: 0, height: -1 }), /zero or more/);
});
