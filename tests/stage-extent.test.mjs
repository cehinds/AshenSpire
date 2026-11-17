// Owner, 2026-11-17: the battlefield runs lower and longer into the room the smaller hand cards freed. Two drawings sit
// behind one switch (perspectiveGrid.stageExtent.mode): 'handTop' (the default) and 'fixed' (+20%); 'none' is the old field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StagePlacement, alternativeFormation } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const GRID = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
const profile = { top: 0.5 }, footRows = 6, stripFraction = 0.05; // the lead's feet at 0.8 of the stage
const handTop = { mode: 'handTop', handGapPx: 8, fixedExtraFraction: 0.2 };

test('the default is "stretch to hand top", with "fixed +20%" one value away', () => {
  assert.equal(GRID.stageExtent.mode, 'handTop');
  assert.equal(GRID.stageExtent.fixedExtraFraction, 0.2);
  assert.ok(GRID.stageExtent.handGapPx >= 0);
});

test('handTop: a short stage stretches until the lead stands handGapPx above the cards', () => {
  const { stage, lift } = StagePlacement({ height: 400, profile, footRows, stripFraction, cardsTop: 408, extent: handTop });
  assert.equal(stage, 500, 'feet at 0.8 x 500 = 400 = 408 - 8');
  assert.equal(lift, 0);
});

test('handTop: where the feet would already be below the cards, the stage keeps its height and the grid rises', () => {
  const { stage, lift } = StagePlacement({ height: 400, profile, footRows, stripFraction, cardsTop: 300, extent: handTop });
  assert.equal(stage, 400);
  assert.equal(lift, Math.min(400 * GRID.handLiftMaxFraction, 320 - 292));
});

test('fixed: the stage is 20% taller whatever the hand, and the strip lift stays in charge', () => {
  const fixed = { ...handTop, mode: 'fixed' };
  assert.deepEqual(StagePlacement({ height: 400, profile, footRows, stripFraction, cardsTop: 408, extent: fixed }), { stage: 480, lift: null });
});

test('none, or no hand measured yet: the field keeps its own height', () => {
  assert.deepEqual(StagePlacement({ height: 400, profile, footRows, stripFraction, cardsTop: 408, extent: { mode: 'none' } }), { stage: 400, lift: null });
  assert.deepEqual(StagePlacement({ height: 400, profile, footRows, stripFraction, cardsTop: null, extent: handTop }), { stage: 400, lift: null });
});

test('in a phone formation the lead player stands handGapPx above the cards, lower than the old drawing', () => {
  const [width, height, cardsTop] = [390, 488.36, 470];
  const lead = extent => alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a'] }), width, height, true, { formFactor: 'mobile', handTop: 400, handCardsTop: cardsTop, stageExtent: extent })
    .slots.find(slot => slot.side === 'player');
  const stretched = lead(GRID.stageExtent), old = lead({ mode: 'none' }), taller = lead({ ...GRID.stageExtent, mode: 'fixed' });
  assert.ok(Math.abs(stretched.ground - (cardsTop - GRID.stageExtent.handGapPx)) < 1e-6, `feet at ${stretched.ground}`);
  assert.ok(stretched.ground > old.ground, 'the party stands lower than before');
  assert.ok(taller.ground > old.ground, 'the fixed drawing also stands it lower');
});
