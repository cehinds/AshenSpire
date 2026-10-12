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

test('every desktop HUD override is gated on the desktop form factor', () => {
  for (const [file, fragment] of DESKTOP_RULES) {
    const hits = rules(css(file)).filter(r => r.selector.includes(fragment) && r.selector.includes('data-form-factor'));
    assert.ok(hits.length > 0, `${file}: no desktop override for ${fragment}`);
    for (const hit of hits) {
      assert.ok(hit.selector.startsWith(GATE), `${file}: "${hit.selector.slice(0, 80)}" is not gated on ${GATE}`);
    }
  }
});

test('desktop tools row sets the approved label, row and reaction sizes', () => {
  const text = css('combat-layers.css');
  const row = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.combat-tools > button'));
  assert.ok(row, 'tools button rule');
  assert.match(row.body, /min-height:\s*calc\(36px \/ var\(--ui-zoom,1\)\)/);
  assert.match(row.body, /font-size:\s*calc\(14px \/ var\(--ui-zoom,1\)\)/);
  const value = rules(text).find(r => r.selector.startsWith(GATE) && r.selector.endsWith('.reaction-switch-value'));
  assert.ok(value, 'reaction value rule');
  assert.match(value.body, /font-size:\s*calc\(12px \/ var\(--ui-zoom,1\)\)/);
});
