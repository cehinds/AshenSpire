// tests/footer-art-threads.test.mjs — two Copilot findings on #1534 in the
// footer art. (1) The art faces letterboxed (default preserveAspectRatio meet)
// while their control boxes stretch to --art-w/--art-h percentages, so the
// artwork and its hit boxes drift apart whenever the row is taller than the
// authored aspect. The images already stretch with preserveAspectRatio="none";
// the faces must agree. (2) The compact End Turn label omitted endTurnKey, while
// the full label shows the key on its own line below the words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';

function buildRow(dom) {
  const doc = dom.document;
  const row = doc.createElement('div');
  row.className = 'combat-action-row';
  for (const cls of ['energy-orb', 'pile draw', 'pile spent', 'end-turn', 'combat-potions']) {
    const el = doc.createElement('div');
    el.className = cls;
    row.appendChild(el);
  }
  doc.body.appendChild(row);
  return row;
}

test('footer art faces stretch with their control boxes, as the full footer images do', async () => {
  const { installFooterArt } = await import('../src/ui/components/footerArt.js');
  withKitDom((dom) => {
    const row = buildRow(dom);
    installFooterArt(row);
    const faces = [...row.querySelectorAll('.footer-art-face')];
    assert.ok(faces.length >= 4, 'each control box carries an art face');
    for (const face of faces) {
      assert.equal(face.getAttribute('preserveAspectRatio'), 'none',
        'a face letterboxed under meet would misalign its stretched hit box');
    }
  });
});

test('compact End Turn label shows the bound key under its words, as the full label does', async () => {
  const { installFooterArt, paintFooterArt } = await import('../src/ui/components/footerArt.js');
  withKitDom((dom) => {
    const row = buildRow(dom);
    installFooterArt(row);
    paintFooterArt(row, { endTurnKey: 'E' });
    const label = row.querySelector('.end-turn .footer-compact-label');
    const lines = [...label.querySelectorAll('.footer-compact-line')].map(line => line.textContent);
    assert.equal(lines.length, 2, 'the compact label carries the key as its own line');
    assert.equal(lines[1], 'E', 'the key is the second line, as the full label shows it');
    assert.equal(row.querySelector('.end-turn').getAttribute('aria-label'), 'End Turn (E)');
  });
});

// Review finding on #1818: the phone-only (<= 600px) 28px/13px pile rules
// replaced the unscoped fallback, so 601-680px hosts and short-host rails
// (844x390) fell back to the generic 58% icon and 12px label inside a 44px pile.
test('every compact-label pile keeps the 42% / 11px fallback; phones override it', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /^\.combat-action-row\[data-footer-compact='true'\] \.pile \.footer-art-face \{ height: 42%; flex: 0 1 42%; \}$/m);
  assert.match(css, /^\.combat-action-row\[data-footer-compact='true'\] \.pile \.footer-compact-label \{ font-size: calc\(11px \/ var\(--ui-zoom, 1\)\); \}$/m);
  assert.match(css, /^\.combat\[data-compact-combat='true'\] \.combat-action-row\[data-footer-compact='true'\] \.pile \.footer-art-face \{ height: calc\(28px/m);
  assert.match(css, /^\.combat\[data-compact-combat='true'\] \.combat-action-row\[data-footer-compact='true'\] \.pile \.footer-compact-label \{ font-size: calc\(13px/m);
});
