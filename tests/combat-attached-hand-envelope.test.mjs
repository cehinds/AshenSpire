import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, handGeometryKey, restingHandEnvelope } from '../src/ui/models/HandLayout.js';
import { playerDetailsPlacement } from '../src/ui/models/PlayerDetailsPlacementModel.js';
import { visibleCombatPanelRect, combatControlWidth } from '../src/ui/components/battlefieldStage.js';

test('the resting fan floor is the union of rotated authored corners at every text and phone scale', () => {
  for (const count of [0, 1, 5, 8, 15]) for (const zoom of [.67, .738, 1, 1.5]) {
    const plan = handLayout({ width: 296 / zoom, height: 234 / zoom, count, rem: 16 / zoom, zoom, controlsHeight: 100 / zoom });
    const tops = plan.cards.map(card => {
      const angle = Math.abs(card.angle) * Math.PI / 180;
      const cornerHeight = (Math.sin(angle) * plan.cardWidth + Math.cos(angle) * plan.cardHeight) / 2;
      return plan.top + card.y + plan.cardHeight / 2 - cornerHeight;
    });
    assert.equal(plan.restTop, tops.length ? Math.min(...tops) : 0);
    assert.ok(Number.isFinite(plan.restTop));
    assert.ok(plan.restTop >= 0, 'authored resting faces remain inside the clipped hand');
    if (count === 1) assert.ok(Math.abs(plan.restTop - plan.top) < 1e-9, 'an unrotated single face has no extra corner extent');
  }
});

function receipt() {
  const rect = { left: 50, top: 420, width: 296, height: 234 };
  const input = { rect, clientWidth: 400, clientHeight: 234 / .74, fontSize: '21.6px' };
  const plan = handLayout({ width: input.clientWidth, height: input.clientHeight, count: 8, rem: 16 / .74, zoom: .74, controlsHeight: 100 / .74 });
  return { ...input, restLeft: plan.restLeft, restTop: plan.restTop, clearanceTop: plan.clearanceTop,
    geometry: handGeometryKey({ width: input.clientWidth, height: input.clientHeight, zoom: .74, fontSize: input.fontSize, left: rect.left }) };
}

test('HUD hand clearance uses validated layout geometry and survives selection, pan, and equivalent remounts', () => {
  const input = receipt(); const copy = structuredClone(input);
  const envelope = restingHandEnvelope(input);
  assert.equal(envelope.validated, true);
  assert.equal(envelope.top, input.rect.top + input.restTop * .74);
  assert.equal(envelope.left, input.rect.left + input.restLeft * .74);
  // These are real presentation-only changes the hand can carry. None is a
  // source for the resting fan receipt or player details placement.
  const transformed = { ...input, selectedCardTop: 100, scrollLeft: 180, hoverLift: 30 };
  assert.equal(restingHandEnvelope(transformed, envelope), envelope);
  assert.equal(restingHandEnvelope(structuredClone(input), envelope), envelope);
  const shifted = restingHandEnvelope({ ...input, rect: { ...input.rect, top: 440 } }, envelope);
  assert.equal(shifted.top, envelope.top + 20, 'a genuine viewport movement must update the screen floor');
  assert.notEqual(shifted, envelope);
  assert.deepEqual(input, copy);
});

test('stale or absent fan receipts use a finite viewport fallback rather than previous transformed geometry', () => {
  const input = receipt(); const previous = restingHandEnvelope(input);
  for (const changed of [{ geometry: 'stale' }, { fontSize: '24px' }, { restTop: NaN }, { clientWidth: 390 }]) {
    const next = restingHandEnvelope({ ...input, ...changed }, previous);
    assert.equal(next.validated, false);
    assert.deepEqual([next.left, next.top], [input.rect.left, input.rect.top]);
  }
  assert.equal(restingHandEnvelope({ ...input, clientWidth: 0 }, previous), null);
});

test('clearance is authored before a hover, selection, wrapped chooser rise, or changed hand count', () => {
  for (const count of [0, 1, 8, 15]) for (const zoom of [.67, .738, 1, 1.5]) for (const controlsHeight of [0, 52 / zoom, 100 / zoom]) {
    const plan = handLayout({ width: 296 / zoom, height: 234 / zoom, count, rem: 16 / zoom, zoom, controlsHeight });
    assert.ok(plan.clearanceTop <= plan.restTop + 1e-9);
    for (const card of plan.cards) {
      const selectedTop = plan.top + card.y - plan.lift;
      assert.ok(plan.clearanceTop <= selectedTop + 1e-9, 'full selected faces cannot rise above the reserved HUD floor');
      if (controlsHeight > 0) assert.equal(plan.clearanceTop, 0, 'Upcast correction can admit its owner at the clipping edge');
    }
  }
});

test('beside-art player details honor the resting hand floor and visible enemy panels without moving their actor', () => {
  const input = receipt(); const envelope = restingHandEnvelope(input);
  const art = Object.freeze({ left: 70, right: 130, top: 340, bottom: 450 });
  const viewport = Object.freeze({ left: 0, right: 390, top: 0, bottom: 650 });
  const enemyPanel = Object.freeze({ left: 260, right: 364, top: 250, bottom: 320 });
  const options = { art, viewport, width: 128, height: 100, handTop: envelope.clearanceTop, hudBottom: 150, obstacles: [enemyPanel] };
  const placement = playerDetailsPlacement(options);
  assert.ok(placement.left >= viewport.left + 10 && placement.left + 128 <= viewport.right - 10);
  assert.ok(placement.top + 100 <= envelope.clearanceTop - 10, 'all resources clear every bounded raised selected face');
  assert.ok(placement.left + 128 + 10 <= enemyPanel.left || placement.left >= enemyPanel.right + 10
    || placement.top + 100 + 10 <= enemyPanel.top || placement.top >= enemyPanel.bottom + 10);
  assert.deepEqual(playerDetailsPlacement({ ...options, handTop: restingHandEnvelope({ ...input, selectedCardTop: 60 }, envelope).clearanceTop }), placement);
  assert.deepEqual(art, { left: 70, right: 130, top: 340, bottom: 450 });
});

test('hidden enemy and HUD ancestors never reserve ghost rectangles, while visible 104px footers remain complete', () => {
  const original = globalThis.getComputedStyle;
  const field = { style: {}, parentElement: null };
  const leading = { style: {}, parentElement: field };
  const rect = { left: 200, top: 280, width: 104, height: 44, right: 304, bottom: 324 };
  let reads = 0;
  const panel = { style: {}, parentElement: leading, getBoundingClientRect() { reads++; return rect; } };
  globalThis.getComputedStyle = node => ({ display: 'block', visibility: 'visible', opacity: '1', ...node.style });
  try {
    assert.equal(visibleCombatPanelRect(panel, field), rect);
    const before = reads;
    for (const hidden of [{ display: 'none' }, { visibility: 'hidden' }, { visibility: 'collapse' }, { opacity: '0' }]) {
      leading.style = hidden;
      assert.equal(visibleCombatPanelRect(panel, field), null);
    }
    assert.equal(reads, before, 'hidden layout boxes are not even measured');
    leading.style = {}; panel.hidden = true;
    assert.equal(visibleCombatPanelRect(panel, field), null);
    panel.hidden = false; field.style = { display: 'none' };
    assert.equal(visibleCombatPanelRect(panel, field), null);
    field.style = {};
    assert.equal(visibleCombatPanelRect(panel, field).width, 104);
  } finally {
    if (original === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = original;
  }
});

test('the display-none Info door reserves its authored physical width before context selection', () => {
  const original = globalThis.getComputedStyle;
  const node = { rect: { width: 0 }, getBoundingClientRect() { return this.rect; } };
  globalThis.getComputedStyle = () => ({ display: 'none', boxSizing: 'border-box', width: '59.621px', minWidth: '59.621px' });
  try {
    const reserved = combatControlWidth(node, .738);
    assert.ok(Math.abs(reserved - 44) < .001);
    node.rect = { width: reserved };
    assert.equal(combatControlWidth(node, .738), reserved, 'making the Info door visible keeps the same reserved footprint');
    assert.equal(combatControlWidth(null, .738), 0);
  } finally {
    if (original === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = original;
  }
});
