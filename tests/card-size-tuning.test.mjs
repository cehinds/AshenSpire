// tests/card-size-tuning.test.mjs — the tunable card-size table, and the three
// promises it makes to the person tuning it.
//
// WHY THIS FILE EXISTS, STATED PLAINLY. The card-size feature took SIXTEEN
// review findings before it worked, and not one of them came from a gate. Every
// one was found by a human or a review bot reading the diff. Four of the last
// six were defects introduced while fixing the previous defect — the ladder
// guard that skipped its own variants, the clamp that disagreed with the control
// it was meant to agree with, the threshold that measured the window instead of
// the door, the rounding that showed 200 and drew 201. Each was a pure function
// with no DOM in it, reachable in a millisecond from Node, and each survived
// because nothing here asked it a question.
//
// So these are the questions. They are not a claim that the feature works —
// geometry is measured in a browser by tools/card-one-shape.mjs and
// tools/character-creation-check.mjs, and this file cannot see a pixel. They
// are the arithmetic underneath it, where the defects actually lived.
//
// THREE PROPERTIES:
//
//   A  THE LADDER IS REFUSED WHOLE, INCLUDING ITS VARIANTS. `glance < focus <
//      inspect` is the promise that a card you opened to read is never smaller
//      than one you were browsing past. The first version checked only
//      `glance.widthPx` and let `glance.variants.mobile` — the width a PHONE
//      actually rests at — sail past. A refusal must also be a refusal of the
//      WHOLE table, not a partial merge: half-applied sizes are worse than none,
//      because they look deliberate.
//
//   B  WHAT THE CONTROL SHOWS IS WHAT THE LAYOUT DRAWS. These were two
//      normalisations, and they differed twice: a floor against a round (200.9
//      shown as 200, applied as 201) and a clamp against a fallback (a negative
//      shown as the 64px minimum, drawn at the authored width). A tuner that
//      lies about the number it is using is worse than one that refuses.
//
//   C  THE EXPORT IS PASTEABLE AT THE PATH IT NAMES. Its whole purpose is to
//      leave this machine and become a default. It has been wrong in both
//      directions — a bare `{levels}` that left no `sizing` block, then the
//      right nesting with an instruction that would have produced
//      `sizing.levels.sizing.levels`.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardLevels,
  cardLevelsWithOverrides,
  cardSizingExport,
  cardSizingExportPath,
  cardWidthBounds,
  normalizeTunedNumber,
  restingWidthPx,
  cardMobileBelowPx,
  tunableVariantNames,
  cardDoorStackBelowPx,
  doorReadableMinPx,
} from '../src/ui/models/CardSizeModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const AUTHORED = cardLevels();
const { min, max } = cardWidthBounds();

// ── A. the ladder ───────────────────────────────────────────────────────────

test('A1 the authored table ships as a valid ladder', () => {
  assert.ok(AUTHORED.glance.widthPx < AUTHORED.focus.widthPx);
  assert.ok(AUTHORED.focus.widthPx < AUTHORED.inspect.widthPx);
  for (const [name, width] of Object.entries(AUTHORED.glance.variants)) {
    assert.ok(width < AUTHORED.focus.widthPx, `glance:${name} must be under focus`);
  }
});

test('A2 no overrides leaves the authored table exactly', () => {
  const { levels, refused } = cardLevelsWithOverrides({});
  assert.equal(refused, null);
  assert.deepEqual(levels, AUTHORED);
});

test('A3 a broken ladder is refused, by every key that can break it', () => {
  // The variants are the half that was missing, so they are named first.
  const cases = [
    ['cardWidth_glance_mobile', 600, /glance:mobile/],
    ['cardWidth_glance_compact', 600, /glance:compact/],
    ['cardWidth_glance', 400, /^glance \(/],
    ['cardWidth_focus', 600, /^focus \(/],
  ];
  for (const [key, value, pattern] of cases) {
    const { levels, refused } = cardLevelsWithOverrides({ [key]: value });
    assert.match(refused ?? '', pattern, `${key}=${value} must be refused by name`);
    assert.deepEqual(levels, AUTHORED, `${key}=${value} must fall back to the WHOLE authored table`);
  }
});

test('A4 equal is refused too — a resting card may not match a selected one', () => {
  const focus = AUTHORED.focus.widthPx;
  for (const key of ['cardWidth_glance', 'cardWidth_glance_mobile', 'cardWidth_glance_compact']) {
    const { refused } = cardLevelsWithOverrides({ [key]: focus });
    assert.ok(refused, `${key} equal to focus must be refused`);
  }
});

test('A5 a valid ladder is applied, variants included', () => {
  const { levels, refused } = cardLevelsWithOverrides({
    cardWidth_glance: 200, cardWidth_glance_mobile: 110, cardWidth_focus: 300, cardWidth_inspect: 400,
  });
  assert.equal(refused, null);
  assert.equal(levels.glance.widthPx, 200);
  assert.equal(levels.glance.variants.mobile, 110);
  assert.equal(levels.focus.widthPx, 300);
  assert.equal(levels.inspect.widthPx, 400);
});

// ── B. the control and the layout agree ─────────────────────────────────────

test('B1 a stored width is normalised into the authored range', () => {
  const { levels } = cardLevelsWithOverrides({ cardWidth_inspect: max + 1000 });
  assert.equal(levels.inspect.widthPx, max, 'above the range clamps to the maximum the control shows');
  const low = cardLevelsWithOverrides({ cardWidth_glance: 1 });
  assert.equal(low.levels.glance.widthPx, min, 'below the range clamps to the minimum');
});

test('B2 the model floors exactly as the control does', () => {
  // 200.9 was shown as 200 and applied as 201. Same value, one rule now.
  // Every value here must keep the ladder valid on its own, or the refusal
  // path answers instead of the normalisation path — which is what the first
  // draft of this test got wrong, with `focus: 64.99` flooring under glance.
  for (const raw of [200.9, '200.9', 279.99, 160.5]) {
    const viaControl = normalizeTunedNumber(raw, { min, max, def: 0 });
    const { levels } = cardLevelsWithOverrides({ cardWidth_focus: raw });
    assert.equal(levels.focus.widthPx, viaControl, `${raw} must resolve the same both ways`);
    assert.equal(viaControl, Math.floor(Number(raw)), `${raw} must floor, not round`);
  }
});

test('B3 a value the control would reject falls back the same way', () => {
  for (const raw of ['', null, undefined, 'abc', NaN]) {
    const { levels, refused } = cardLevelsWithOverrides({ cardWidth_focus: raw });
    assert.equal(refused, null, `${String(raw)} is not a broken ladder, it is no override`);
    assert.equal(levels.focus.widthPx, AUTHORED.focus.widthPx);
  }
});

test('B4 a negative width is clamped, not silently dropped', () => {
  // The control renders the minimum for a negative; the model used to fall back
  // to the authored width, so screen and layout disagreed.
  const shown = normalizeTunedNumber(-5, { min, max, def: AUTHORED.glance.widthPx });
  assert.equal(shown, min);
  const { levels } = cardLevelsWithOverrides({ cardWidth_glance: -5 });
  assert.equal(levels.glance.widthPx, min, 'the layout must use the width the control displays');
});

// ── C. the export ───────────────────────────────────────────────────────────

test('C1 the export is nested at sizing.levels and carries only widths', () => {
  const { levels } = cardLevelsWithOverrides({ cardWidth_glance: 200 });
  const parsed = JSON.parse(cardSizingExport(levels));
  assert.deepEqual(Object.keys(parsed), ['sizing']);
  assert.deepEqual(Object.keys(parsed.sizing), ['levels']);
  assert.equal(parsed.sizing.levels.glance.widthPx, 200);
  // ratio resolves to a NUMBER in the generated config while card.json authors
  // {numerator, denominator}; emitting it would rewrite the file's shape.
  assert.ok(!('ratio' in parsed.sizing), 'ratio must not ride along');
  assert.ok(!('bands' in parsed.sizing), 'bands must not ride along');
});

test('C2 the export round-trips into the authored tree', () => {
  const tuned = { cardWidth_glance: 200, cardWidth_glance_mobile: 110, cardWidth_focus: 300, cardWidth_inspect: 400 };
  const { levels } = cardLevelsWithOverrides(tuned);
  const parsed = JSON.parse(cardSizingExport(levels));
  // Merged at the root, as the settings row instructs, it replaces sizing.levels
  // and leaves the rest of sizing intact.
  const merged = { ...uiConfig.components.card.sizing, ...parsed.sizing };
  assert.equal(merged.levels.glance.widthPx, 200);
  assert.equal(merged.levels.glance.variants.mobile, 110);
  assert.equal(merged.ratio, uiConfig.components.card.sizing.ratio, 'ratio survives the merge');
  assert.deepEqual(merged.bands, uiConfig.components.card.sizing.bands, 'bands survive the merge');
  assert.equal(merged.doorReadableMinPx, doorReadableMinPx(), 'the readable minimum survives');
});

test('C3 the export names the path it belongs at, and says it is a fragment', () => {
  assert.match(cardSizingExportPath, /card\.json/);
  assert.match(cardSizingExportPath, /sizing\.levels/);
  // "over sizing.levels" would yield sizing.levels.sizing.levels with this shape.
  assert.match(cardSizingExportPath, /root/i);
});

// ── the resting width, and the door's threshold ─────────────────────────────

test('D1 the mobile variant ships equal to glance, so nothing moves untuned', () => {
  assert.equal(AUTHORED.glance.variants.mobile, AUTHORED.glance.widthPx);
});

test('D2 the resting width follows the kit token, strictly below', () => {
  const edge = cardMobileBelowPx();
  const { levels } = cardLevelsWithOverrides({ cardWidth_glance: 250, cardWidth_glance_mobile: 110 });
  assert.equal(restingWidthPx(edge, levels), 250, 'at the boundary it is not yet mobile');
  assert.equal(restingWidthPx(edge - 1, levels), 110);
  assert.equal(restingWidthPx(edge + 1, levels), 250);
});

test('D3 the door threshold is the inspect width plus the readable minimum', () => {
  assert.equal(cardDoorStackBelowPx(), AUTHORED.inspect.widthPx + doorReadableMinPx());
});

test('D4 a missing authored term throws by name rather than guessing', () => {
  assert.throws(() => cardDoorStackBelowPx({ levels: { inspect: {} }, doorReadableMinPx: 384 }),
    /inspect\.widthPx/);
  assert.throws(() => doorReadableMinPx({ levels: AUTHORED }), /doorReadableMinPx/);
  assert.throws(() => cardWidthBounds({ tuning: { minPx: 640, maxPx: 64 } }), /minPx < maxPx/);
});

// ── variants without a control of their own ────────────────────────────────

test('E1 an un-slidered variant follows its level; a slidered one does not', () => {
  const slidered = new Set(tunableVariantNames());
  assert.ok(slidered.has('mobile'), 'mobile has its own row');
  assert.ok(!slidered.has('compact'), 'compact has no row, so it must inherit');

  const base = cardLevelsWithOverrides({});
  assert.deepEqual(base.levels.glance.variants, AUTHORED.glance.variants,
    'untuned, every variant is exactly the authored one');

  const tuned = cardLevelsWithOverrides({ cardWidth_glance: 200 });
  const ratio = AUTHORED.glance.variants.compact / AUTHORED.glance.widthPx;
  assert.equal(tuned.levels.glance.variants.compact, Math.round(200 * ratio),
    'compact keeps its proportion to glance');
  assert.equal(tuned.levels.glance.variants.mobile, AUTHORED.glance.variants.mobile,
    'mobile holds at the value ITS OWN control displays, or the two disagree');
});

test('E2 an explicit variant override still wins over inheritance', () => {
  const { levels } = cardLevelsWithOverrides({ cardWidth_glance: 200, cardWidth_glance_mobile: 110 });
  assert.equal(levels.glance.variants.mobile, 110);
  assert.equal(levels.glance.variants.compact, Math.round(200 * (AUTHORED.glance.variants.compact / AUTHORED.glance.widthPx)));
});

test('E3 the slidered list is authored, not invented here', () => {
  assert.throws(() => tunableVariantNames({ tuning: { minPx: 64, maxPx: 640 } }), /slidered/);
});
