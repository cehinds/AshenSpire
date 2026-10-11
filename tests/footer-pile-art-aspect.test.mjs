// tests/footer-pile-art-aspect.test.mjs — the footer's Draw and Discard piles
// and Potions were drawn flattened on phones (360x620): their art faces stretch
// with the control box, and each image is then stretched to the face. Piles and
// potions must letterbox their artwork (contain) so each keeps its natural shape.
// The root face keeps preserveAspectRatio="none" (footer-art-threads), because
// its box takes the viewBox's own aspect, so that stretch is a no-op.
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

test('draw, discard and potions faces are contain-fit with their box aspect', async () => {
  const { installFooterArt } = await import('../src/ui/components/footerArt.js');
  withKitDom((dom) => {
    const row = buildRow(dom);
    installFooterArt(row);
    for (const sel of ['.pile.draw', '.pile.spent', '.combat-potions']) {
      const face = row.querySelector(sel).querySelector('.footer-art-face');
      assert.ok(face, `${sel} carries an art face`);
      assert.equal(face.getAttribute('data-art-fit'), 'contain', `${sel} is contain-fit`);
      const [vbw, vbh] = face.getAttribute('viewBox').split(' ').slice(2).map(Number);
      assert.equal(face.getAttribute('style'), `aspect-ratio:${vbw} / ${vbh}`, `${sel} face takes its viewBox aspect`);
      const images = [...face.querySelectorAll('image')];
      assert.ok(images.length >= 1, `${sel} draws its artwork`);
      for (const image of images) {
        assert.equal(image.getAttribute('preserveAspectRatio'), 'xMidYMid meet',
          `${sel} artwork keeps its natural shape inside its authored box`);
      }
    }
  });
});

test('the end plate keeps its stretch: only piles and potions are contain-fit', async () => {
  const { installFooterArt } = await import('../src/ui/components/footerArt.js');
  withKitDom((dom) => {
    const row = buildRow(dom);
    installFooterArt(row);
    const end = row.querySelector('.end-turn').querySelector('.footer-art-face');
    assert.equal(end.getAttribute('data-art-fit'), 'stretch');
    assert.equal(end.getAttribute('style'), null);
  });
});

test('compact contain faces size by height, so their width follows the art aspect', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /^\.combat-action-row\[data-footer-compact='true'\] \.footer-art-face\[data-art-fit='contain'\] \{ width: auto; \}$/m);
});

test('phone piles and potions take a 60px art face in a 92px column, not the 28px face', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /\.combat\[data-compact-combat='true'\] \.combat-action-row\[data-footer-compact='true'\] \.pile \.footer-art-face\[data-art-fit='contain'\] \{ height: calc\(60px \/ var\(--ui-zoom, 1\)\); \}/);
  assert.match(css, /\.combat\[data-compact-combat='true'\] \.combat-action-row\[data-footer-compact='true'\] \.combat-potions \.footer-art-face\[data-art-fit='contain'\] \{ height: calc\(60px \/ var\(--ui-zoom, 1\)\); \}/);
  assert.match(css, /height: calc\(92px \/ var\(--ui-zoom, 1\)\); min-height: calc\(92px \/ var\(--ui-zoom, 1\)\);/);
});
