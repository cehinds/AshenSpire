// A relic's effect text fills the height its face has (owner, 2026-11-15): FitBonusLines raises the
// line clamp from the authored 2 while the effects region still holds the text, and never past it.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.customElements ??= { get: () => null, define() {} };
globalThis.HTMLElement ??= class {};
const { FitBonusLines } = await import('../src/ui/components/equipmentCard.js');

// A fake face with real geometry: `textLines` of text at `lineH` px, a heading, and a region `regionH` tall.
function fakeCard({ textLines, lineH = 20, headingH = 14, regionH, floor = 2 }) {
  const vars = { '--epc-bonus-lines': String(floor) };
  const shown = () => Math.min(Number(vars['--epc-bonus-lines']), textLines);
  const bonus = {
    hidden: false,
    get clientHeight() { return shown() * lineH; },
    get scrollHeight() { return textLines * lineH; },
  };
  const effects = {
    dataset: {}, clientHeight: regionH,
    get scrollHeight() { return Math.max(regionH, headingH + bonus.clientHeight); },
    querySelector: sel => (sel.startsWith('.epc-bonus') ? bonus : null),
  };
  return {
    dataset: { bonusFloor: String(floor) },
    style: { getPropertyValue: n => vars[n] ?? '', setProperty: (n, v) => { vars[n] = String(v); } },
    querySelector: sel => (sel === '.epc-effects' ? effects : null),
    lines: () => Number(vars['--epc-bonus-lines']), vars,
  };
}

test('a five-line relic effect shows in full when the region holds five lines', () => {
  const card = fakeCard({ textLines: 5, regionH: 14 + 5 * 20 });
  assert.equal(FitBonusLines(card), 5);
  assert.equal(card.lines(), 5);
});

test('the clamp stops at the lines that fit, not at a fixed two', () => {
  const card = fakeCard({ textLines: 9, regionH: 14 + 4 * 20 });
  assert.equal(FitBonusLines(card), 4);
  assert.equal(card.lines(), 4);
});

test('a short effect keeps the authored floor and a face with no height is left alone', () => {
  assert.equal(FitBonusLines(fakeCard({ textLines: 1, regionH: 200 })), 2);
  assert.equal(FitBonusLines(fakeCard({ textLines: 5, regionH: 0 })), 0);
});
