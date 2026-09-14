import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { balance } from '../src/content/balance.js';
import {
  BUTTON_SIZE_IDS, BUTTON_GROUP_KINDS, resolveButtonSize, planButtonGroup, resolveButtonGroupWidths, buttonSizeTokens,
} from '../src/ui/models/ButtonSizeModel.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const reference = JSON.parse(read('docs/architecture-handoff/button-widths.json'));
const config = wireframeUi.buttons;
const rem = 16;

test('the configuration mirrors the approved button-widths.json', () => {
  assert.equal(`${config.standardHeightRem}rem`, reference.standardHeight);
  assert.deepEqual(config.heightMultipliers, reference.heightMultipliers);
  assert.deepEqual(config.presets, reference.presets);
  assert.equal(config.choice, reference.choice);
  assert.equal(`${config.minimumReadableRem}rem`, reference.minimumReadable);
  assert.equal(`${config.iconSizeRem}rem`, reference.iconSize);
  assert.equal(config.footer, reference.footer);
  assert.equal(config.singleFooter, reference.singleFooter);
  assert.deepEqual([...BUTTON_SIZE_IDS].sort(), Object.keys(reference.sizes).sort());
  for (const [id, { width, height }] of Object.entries(reference.sizes)) {
    const size = resolveButtonSize(id);
    assert.deepEqual([size.width, size.height], [width, height], id);
  }
  assert.ok(Object.isFrozen(config) && Object.isFrozen(config.presets), 'shared configuration is frozen');
});

test('nine sizes: 30/50/100% widths and 1, 1.5, 2 × the standard height', () => {
  assert.equal(BUTTON_SIZE_IDS.length, 9);
  assert.deepEqual(resolveButtonSize('third-standard'), { id: 'third-standard', width: 'third', height: 'standard', widthPercent: 30, heightRem: 2.75 });
  assert.equal(resolveButtonSize('half-tall').heightRem, 4.125);
  assert.equal(resolveButtonSize('full-double').heightRem, 5.5);
  assert.equal(resolveButtonSize('full-double').widthPercent, 100);
  for (const bad of ['quarter-standard', 'half', 'half-huge', 'half-tall-x', '', null]) {
    assert.throws(() => resolveButtonSize(bad), /Unknown button size/, String(bad));
  }
});

test('footer: equal shares after gaps, a sole action fills the region', () => {
  assert.deepEqual(BUTTON_GROUP_KINDS, ['footer', 'choice']);
  const sole = resolveButtonGroupWidths({ kind: 'footer', count: 1, hostWidth: 400, rem });
  assert.equal(sole.layout, 'fill');
  assert.equal(sole.width, 400);
  assert.equal(sole.size, 'full-standard');
  const pair = resolveButtonGroupWidths({ kind: 'footer', count: 2, hostWidth: 400, rem });
  assert.equal(pair.layout, 'equal-shares');
  assert.equal(pair.gap, 8);
  assert.equal(pair.width, 196);
  assert.equal(pair.groupWidth, 400, 'shares plus gaps fill the region exactly');
  const three = resolveButtonGroupWidths({ kind: 'footer', count: 3, hostWidth: 316, rem });
  assert.equal(three.width, 100);
  assert.equal(planButtonGroup({ kind: 'footer', count: 0 }).layout, 'empty');
  assert.throws(() => planButtonGroup({ kind: 'footer', count: 2, size: 'half-tall' }), /equal shares/);
});

test('choice: one preset for every sibling, capped by the equal share; label length never enters', () => {
  const plan = planButtonGroup({ kind: 'choice', count: 2 });
  assert.equal(plan.size, 'half-standard', 'choice controls default to the half preset');
  // Two halves of 400 would overflow by the gap: both fit the share instead.
  assert.equal(resolveButtonGroupWidths({ kind: 'choice', count: 2, hostWidth: 400, rem }).width, 196);
  // Three thirds (30%) fit inside their share, so the preset holds and edges stay equal.
  const thirds = resolveButtonGroupWidths({ kind: 'choice', count: 3, size: 'third-tall', hostWidth: 400, rem });
  assert.equal(thirds.width, 120);
  assert.equal(thirds.height, 2.75 * 1.5 * rem);
  // A narrow host keeps the shared width (labels wrap); siblings never floor at the readable minimum.
  assert.equal(resolveButtonGroupWidths({ kind: 'choice', count: 2, hostWidth: 200, rem }).width, 96);
  // A sole choice keeps its preset but not below the readable minimum, and never past the host.
  assert.equal(resolveButtonGroupWidths({ kind: 'choice', count: 1, hostWidth: 400, rem }).width, 200);
  assert.equal(resolveButtonGroupWidths({ kind: 'choice', count: 1, hostWidth: 200, rem }).width, 128);
  assert.equal(resolveButtonGroupWidths({ kind: 'choice', count: 1, hostWidth: 100, rem }).width, 100);
  // The reference rem scales heights and gaps together (text size or a zoomed-down root).
  const big = resolveButtonGroupWidths({ kind: 'choice', count: 2, hostWidth: 400, rem: 20 });
  assert.equal(big.gap, 10);
  assert.equal(big.height, 55);
  assert.throws(() => planButtonGroup({ kind: 'header', count: 1 }), /Unknown button group/);
  assert.throws(() => planButtonGroup({ kind: 'choice', count: 1.5 }), /whole number/);
  assert.throws(() => planButtonGroup({ kind: 'choice', count: 2, size: 'huge-standard' }), /Unknown button size/);
});

test('the icon exception agrees with the declared exit geometry', () => {
  // WCB5: the exit square is iconSize on both axes. The shell draws it from
  // --iconbtn-size = --tap-floor, whose default target is balance.ui.tapSize.def.
  assert.equal(config.iconSizeRem * rem, balance.ui.tapSize.def);
  assert.equal(config.standardHeightRem * rem, balance.ui.tapSize.def, 'a standard button clears the default tap floor');
});

test('kit.css reads every token the model writes, and writes no preset the model does not', () => {
  const css = read('styles/kit.css');
  const tokens = buttonSizeTokens();
  for (const [name, value] of Object.entries(tokens)) {
    assert.ok(css.includes(`var(${name}`), `${name} is written (${value}) but kit.css never reads it`);
    assert.ok(!new RegExp(`${name}\\s*:`).test(css), `${name} has one home: the model, not a CSS literal`);
  }
  assert.equal(tokens['--button-half'], '50%');
  assert.equal(tokens['--button-height-tall'], '1.5');
  assert.ok(!('--button-quarter' in tokens), 'the quarter preset has no consumer yet, so no token');
  const read_ = [...css.matchAll(/var\((--button-[a-z-]+)/g)].map((m) => m[1]);
  // Defined by: the model's root tokens, a CSS declaration, or a kit builder's inline style (choiceRow's count).
  const inline = [...read('src/ui/kit/index.js').matchAll(/'(--button-[a-z-]+)':/g)].map((m) => m[1]);
  assert.deepEqual(inline, ['--button-count']);
  const defined = new Set([...Object.keys(tokens), ...inline, ...[...css.matchAll(/(--button-[a-z-]+)\s*:/g)].map((m) => m[1])]);
  for (const name of read_) assert.ok(defined.has(name), `kit.css reads ${name}, which nothing defines`);
});

test('real consumers: the shared footer and a choice row resolve through the model', () => {
  const shell = read('src/ui/components/modalShell.js');
  assert.match(shell, /planButtonGroup\(\{ kind: 'footer'/);
  assert.match(shell, /button\.dataset\.buttonSize = plan\.size/);
  const kit = read('src/ui/kit/index.js');
  assert.match(kit, /export function choiceRow\(/);
  assert.match(kit, /node\.dataset\.buttonSize = resolveButtonSize\(size\)\.id/);
  assert.match(read('src/ui/screens/gameover.js'), /choiceRow\(\{ buttons: \[toHistory, toTitle\] \}\)/);
  // Declared geometry stays its own: the packed combat footer never takes a preset.
  assert.doesNotMatch(read('src/ui/models/CombatLayout.js'), /ButtonSizeModel/);
});
