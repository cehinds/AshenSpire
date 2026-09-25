// tests/card-door-stack.test.mjs — the reading door stacks OUTSIDE the modal
// too (#1164).
//
// `.card-inspection-layout` has three kinds of host: the reading modal, a bare
// host (reward detail, inventory detail, a service modal) and an Armoury pane.
// Only the modal is measured by `cardInspectionLayout()` and governed by
// `[data-card-door='stacked']`; the other two used to keep the two-column grid
// from 601px up, because the only rule that stacked them was the
// `max-width:600px` collapse. Measured on weapon-cards-preview.html with the
// modal's layout moved into a bare host and an `.armoury .armoury-item-detail`
// pane: details 162px at 601, 211px at 650, 264px at 703.
//
// The fix makes the non-modal layout a wrapping flex row whose items ask for
// the inspect width and the readable minimum, so it stacks on its OWN content
// box. CSS cannot read card.json, so the readable minimum is a literal in
// kit.css — and this file is what holds that literal to the config.
//
// WHAT THIS DOES NOT CHECK: it reads the stylesheet as text; it lays nothing
// out and sees no pixel. The rendered geometry (bare and Armoury hosts at
// 601/650/703/1280: stacked below the art, readable width, art centred; two
// columns when wide) is asserted in real Chromium by
// tools/weapon-card-preview.mjs. This file does not check the modal host
// (the `data-card-door` decision in src/ui/components/cardInspection.js and
// tests/card-size-tuning.test.mjs cover that), nor any selector in another
// stylesheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const card = JSON.parse(readFileSync(new URL('../content/config/ui/components/card.json', import.meta.url), 'utf8'));
const READABLE = card.sizing.doorReadableMinPx;
const INSPECT = card.sizing.levels.inspect.widthPx;

// Every style rule with the at-rule preludes it sits inside.
function rules(text) {
  const out = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const prelude = text.slice(start, i).trim();
      const close = matching(text, i);
      if (prelude.startsWith('@')) {
        stack.push(prelude);
        start = i + 1;
        continue;
      }
      out.push({ selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: text.slice(i + 1, close), at: [...stack] });
      i = close;
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';' && stack.length === 0 && text.slice(start, i).trim().startsWith('@')) {
      start = i + 1;
    }
  }
  return out;
}
function matching(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error('kit.css: unbalanced braces');
}
function decl(body, prop) {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
  return m ? m[1].trim() : null;
}
const all = rules(css);
const unconditional = (r) => r.at.length === 0;
const nonModal = (sel) => /\.card-inspection-layout$/.test(sel) && !sel.includes('.card-inspection-modal');

test('the bare layout wraps rather than holding a two-column grid', () => {
  const base = all.filter((r) => unconditional(r) && r.selectors.includes('.card-inspection-layout'));
  assert.ok(base.length > 0, 'kit.css has an unconditional .card-inspection-layout rule');
  const last = base.at(-1);
  assert.equal(decl(last.body, 'display'), 'flex', 'bare .card-inspection-layout is a flex row');
  assert.equal(decl(last.body, 'flex-wrap'), 'wrap', 'bare .card-inspection-layout wraps');
});

test('no unconditional non-modal rule puts the layout back on a grid', () => {
  // The Armoury's container query and the phone media rule may set a
  // one-column template; nothing outside an at-rule may restore two columns
  // for a host the data-card-door decision does not govern.
  for (const r of all.filter(unconditional)) {
    for (const sel of r.selectors.filter(nonModal)) {
      const display = decl(r.body, 'display');
      assert.ok(display === null || display === 'flex', `${sel} sets display:${display}`);
      assert.equal(decl(r.body, 'grid-template-columns'), null, `${sel} sets grid-template-columns`);
    }
  }
});

test('the details ask for the readable minimum from card.json, the art for the inspect width', () => {
  const pick = (sel) => all.filter((r) => unconditional(r) && r.selectors.includes(sel)).map((r) => decl(r.body, 'flex')).filter(Boolean).at(-1);
  const details = pick('.card-inspection-layout > .card-inspection-details');
  assert.equal(details, `1 1 ${READABLE}px`, `details flex basis is sizing.doorReadableMinPx (${READABLE}px) and grows`);
  const art = pick('.card-inspection-layout > .card-inspection-art');
  assert.equal(art, `0 1 var(--card-w-inspect,${INSPECT}px)`, 'art asks for the projected inspect width, authored fallback');
});

test('the modal keeps its measured grid', () => {
  const modal = all.filter((r) => unconditional(r) && r.selectors.includes('.card-inspection-modal .card-inspection-layout'));
  assert.ok(modal.some((r) => decl(r.body, 'display') === 'grid'), 'modal layout re-declares display:grid, so data-card-door still governs it');
});
