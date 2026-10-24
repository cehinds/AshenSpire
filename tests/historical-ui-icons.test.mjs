import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { HISTORICAL_UI_GLYPHS, uiIconId, uiIconGlyph } from '../src/content/uiIcons.js';
import { engravedIcon, engravedIconHtml, engravedIconUrl, engravedMaskUrl } from '../src/ui/components/engravedIcon.js';
import { glyph, html } from '../src/ui/kit/index.js';
import { stripCssComments } from '../tools/css-strip.mjs';

const original = { 'historic-crossed-swords':'\u2694', 'historic-comet':'\u2604', 'historic-dagger':'\ud83d\udde1', 'historic-sun':'\u2600', 'historic-skull':'\u2620', 'historic-eye':'\ud83d\udc41', 'historic-hot-springs':'\u2668', 'historic-scales':'\u2696', 'historic-chest':'\u25a3' };
test('explicit historical identities preserve the original symbols without changing raw saved aliases', () => {
  assert.deepEqual(HISTORICAL_UI_GLYPHS, original);
  for (const [id, char] of Object.entries(original)) { assert.equal(uiIconId(id),id); assert.equal(uiIconGlyph(id),char); }
  assert.equal(uiIconId('\u2604'),'progression');
  assert.equal(uiIconId('\u2600'),'madness');
  assert.equal(uiIconGlyph('\u2604'),null);
  assert.equal(uiIconGlyph('\u2600'),null);
  assert.equal(uiIconGlyph('__proto__'),null);
  assert.equal(engravedIconUrl('custom <script>'),null);
});
test('DOM, HTML and kit slots display actual glyphs inside the existing icon box', () => withKitDom(() => {
  for (const [id,char] of Object.entries(original)) {
    const node=engravedIcon(id), text=node.querySelector('text');
    assert.equal(node.dataset.engravedIcon,id);
    assert.ok(node.classList.contains('engraved-glyph'));
    assert.equal(text.textContent,char);
    assert.equal(text.namespaceURI,'http://www.w3.org/2000/svg');
    assert.equal(text.getAttribute('fill'),'currentColor');
    assert.equal(node.querySelector('svg').getAttribute('width'),'100%');
    assert.equal(node.querySelector('svg').getAttribute('height'),'100%');
    assert.ok(engravedIconHtml(id).includes(`>${char}</text>`));
    const slot = glyph(id);
    assert.equal(slot.querySelector('text').textContent,char);
    // The lightweight DOM fixture serializes an SVG text element as its text.
    assert.ok(html(slot).includes(char));
    assert.equal(engravedMaskUrl(id),null,'no invented historical asset path or mask');
  }
  assert.ok(!engravedIcon('madness').querySelector('text'),'generic custom vector still uses its mask');
}));
test('URL-only class consumers receive fixed-whitelist escaped SVGs with explicit legible styling', () => {
  for (const [id,char] of Object.entries(original)) {
    const url=engravedIconUrl(id);assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'));
    const svg=decodeURIComponent(url.slice(url.indexOf(',')+1));
    assert.ok(svg.includes(`>${char}</text>`));assert.match(svg,/viewBox="0 0 64 64"/);
    assert.match(svg,/fill="#d8b976"/);assert.match(svg,/font-size="46"/);assert.doesNotMatch(svg,/currentColor|<script|href=/);
  }
  assert.ok(engravedIconUrl('progression').endsWith('/progression.svg'));
});
test('official CSS comment stripping preserves the bounded historical glyph modifier', () => {
  const css=stripCssComments(readFileSync(new URL('../styles/player-polish.css',import.meta.url),'utf8'));
  assert.match(css,/\.engraved-icon\.engraved-glyph\s*\{[^}]*mask:none/);
  assert.match(css,/\.engraved-glyph > svg\s*\{[^}]*width:100%; height:100%; overflow:hidden/);
});
