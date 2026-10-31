// tests/combat-desktop-hud.test.mjs — desktop-only HUD sizes (combat-layers.css,
// kit.css, combat.css). Every desktop override must exist and be gated on
// :root[data-form-factor='desktop'], so phone, tablet and widescreen keep their
// rules exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = name => readFileSync(fileURLToPath(new URL(`../styles/${name}`, import.meta.url)), 'utf8');
const GATE = ":root[data-form-factor='desktop']";

// Each rule: the stylesheet, and a selector fragment that must appear in a rule
// that starts with the desktop gate.
const DESKTOP_RULES = [
  ['combat-layers.css', ".combat-tools > button"],
  ['combat-layers.css', ".combat-tools .reaction-switch-value"],
  ['combat-layers.css', ".enemy .combatant-leading .intent"],
  ['combat-layers.css', ".combatant:not(.context-selected) .intent"],
  ['combat-layers.css', ".intent .intent-icon"],
  ['combat-layers.css', ".intent-stance"],
  ['combat-layers.css', ".stance-chip[data-meter-row='stance']"],
  ['combat-layers.css', ".stance-chip[data-meter-row='stance'] > .as-glyph"],
  ['combat-layers.css', "[data-footer-binding='endTurn']"],
];

// Split a stylesheet into selector-list + body chunks at top-level braces.
function rules(text) {
  const out = [];
  const bare = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bare))) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

// Owner (2026-10-31): the tools row (End Turn, Reaction, Auto) shrinks on widescreen as well, so its
// rules carry both gates in one selector list; every other override is desktop only.
const WIDE_GATE = ":root[data-form-factor='widescreen']";
const TOOLS_FRAGMENT = '.combat-tools';

test('every desktop HUD override is gated on the desktop form factor', () => {
  for (const [file, fragment] of DESKTOP_RULES) {
    const hits = rules(css(file)).filter(r => r.selector.includes(fragment) && r.selector.includes('data-form-factor'));
    assert.ok(hits.length > 0, `${file}: no desktop override for ${fragment}`);
    for (const hit of hits) {
      const gates = hit.selector.split(',').map(part => part.trim());
      assert.ok(gates[0].startsWith(GATE), `${file}: "${hit.selector.slice(0, 80)}" is not gated on ${GATE}`);
      for (const part of gates.slice(1)) {
        if (!part.includes('data-form-factor') || part.startsWith(GATE)) continue;
        assert.ok(fragment.includes(TOOLS_FRAGMENT) && part.startsWith(WIDE_GATE),
          `${file}: "${part.slice(0, 80)}" widens a desktop-only override`);
      }
    }
  }
});

test('the tools row overrides also apply on widescreen', () => {
  const text = css('combat-layers.css');
  for (const fragment of ['.combat-tools > button', '.combat-tools .reaction-switch-track', '.combat-tools .reaction-switch-value', '.combat-tools .reaction-switch-thumb']) {
    const hit = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.includes(fragment));
    assert.ok(hit, fragment);
    assert.ok(hit.selector.includes(WIDE_GATE), `${fragment} is not gated on widescreen too`);
  }
});

// Owner (2026-10-31): End Turn, Reaction and Auto 30% smaller on desktop, so the row reads at 0.7x the phone values.
test('desktop tools row sets the approved label, row and reaction sizes', () => {
  const text = css('combat-layers.css');
  const row = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.combat-tools > button'));
  assert.ok(row, 'tools button rule');
  assert.match(row.body, /min-height:\s*calc\(25\.2px \/ var\(--ui-zoom,1\)\)/);
  assert.match(row.body, /font-size:\s*calc\(9\.8px \/ var\(--ui-zoom,1\)\)/);
  const value = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.reaction-switch-value'));
  assert.ok(value, 'reaction value rule');
  assert.match(value.body, /font-size:\s*calc\(8\.4px \/ var\(--ui-zoom,1\)\)/);
  const track = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.reaction-switch-track'));
  assert.ok(track, 'reaction track rule');
  assert.match(track.body, /width:\s*calc\(58\.8px \/ var\(--ui-zoom,1\)\)/, 'track wide enough for the 8.4px value');
});

test('desktop intent badge and stance glyph are 1.25x and match each other', () => {
  const text = css('combat-layers.css');
  const glyph = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.includes("stance-chip[data-meter-row='stance'] > .as-glyph"));
  assert.ok(glyph, 'stance glyph rule');
  assert.match(glyph.body, /width:\s*calc\(26px \/ var\(--ui-zoom,1\)\)/);
  const icon = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.intent .intent-icon'));
  assert.ok(icon, 'intent icon rule');
  assert.match(icon.body, /width:\s*calc\(26px \/ var\(--ui-zoom,1\)\)/);
  const value = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith(':not(.context-selected) .intent'));
  assert.match(value.body, /font-size:\s*calc\(20px \/ var\(--ui-zoom,1\)\)/);
});

test('desktop footer words scale 1.15x and the counts keep their size', () => {
  const text = css('combat-layers.css');
  const words = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.includes("[data-footer-binding='endTurn']"));
  assert.ok(words, 'footer words rule');
  for (const binding of ['endTurn', 'drawLabel', 'discard', 'exhaust', 'potions']) {
    assert.ok(words.selector.includes(`[data-footer-binding='${binding}']`), `${binding} scaled`);
  }
  assert.match(words.body, /transform:\s*scale\(1\.15\)/);
  assert.ok(!words.selector.includes("'draw'"), 'the draw count is not scaled');
});
