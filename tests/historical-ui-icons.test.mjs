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
    assert.equal(text.getAttribute('font-family'),null,'DOM keeps the original inherited UI font');
    assert.equal(text.getAttribute('x'),'32');assert.equal(text.getAttribute('y'),'32');
    assert.equal(node.querySelector('svg').getAttribute('viewBox'),'-2 -2 68 68');
    assert.equal(node.querySelector('svg').getAttribute('width'),'100%');
    assert.equal(node.querySelector('svg').getAttribute('height'),'100%');
    assert.ok(engravedIconHtml(id).includes(`>${char}</text>`));
    assert.doesNotMatch(engravedIconHtml(id),/font-family=/,'HTML keeps the original inherited UI font');
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
    assert.ok(svg.includes(`>${char}</text>`));assert.match(svg,/viewBox="-2 -2 68 68"/);
    assert.match(svg,/fill="#d8b976"/);
    assert.match(svg,/font-family="&quot;Inter&quot;, &quot;Segoe UI&quot;/);
    assert.ok(svg.includes('&quot;Noto Color Emoji&quot;'));
    assert.match(svg,/x="32" y="32"/);assert.match(svg,/font-size="46"/);assert.doesNotMatch(svg,/currentColor|<script|href=/);
  }
  assert.ok(engravedIconUrl('progression').endsWith('/progression.svg'));
});
test('official CSS comment stripping preserves the bounded historical glyph modifier', () => {
  const css=stripCssComments(readFileSync(new URL('../styles/player-polish.css',import.meta.url),'utf8'));
  assert.match(css,/\.engraved-icon\.engraved-glyph\s*\{[^}]*mask:none/);
  assert.match(css,/\.engraved-glyph > svg\s*\{[^}]*width:100%; height:100%; overflow:hidden/);
});

test('authored class choices recover each original identity in folded and unfolded slots', async () => {
  const { classes } = await import('../src/content/classes.js');
  const { classChoiceCard, classUnfold } = await import('../src/ui/components/creationCards.js');
  const expected={reaver:'historic-crossed-swords',starseer:'historic-comet',rogue:'historic-dagger',herald:'historic-sun'};
  assert.deepEqual(Object.fromEntries(classes.map(c=>[c.id,c.glyph])),expected);
  withKitDom(({document})=>{
    for(const cls of classes)for(const render of [()=>classChoiceCard(cls,{visual:cls.glyph}),()=>classUnfold({cls,visual:cls.glyph})]) {
      const card=render();assert.equal(card.querySelector('[data-engraved-icon]').querySelector('text').textContent,original[expected[cls.id]]);
    }
    for(const [raw,alias] of [['\u2604','progression'],['\u2600','madness']]) {
      const card=classChoiceCard(classes[0],{visual:raw});assert.equal(card.querySelector('[data-engraved-icon]').dataset.engravedIcon,alias);
      assert.equal(card.querySelector('[data-engraved-icon]').querySelector('text'),null,'saved raw aliases retain their generic vector behavior');
    }
    const custom=document.createElement('img');assert.equal(classChoiceCard(classes[0],{visual:custom}).querySelector('.og').firstChild,custom);
  });
});
test('map faces and legend/atlas icon slots share original glyphs while keeping node-state CSS ownership', async () => {
  const { mapNodeInk }=await import('../src/ui/components/mapNodeInk.js');
  const { NODE_TYPES, legendEntries }=await import('../src/ui/uiContent.js');
  const expected={monster:'historic-crossed-swords',fight:'historic-crossed-swords',elite:'historic-skull',boss:'historic-eye',shrine:'historic-hot-springs',merchant:'historic-scales',treasure:'historic-chest'};
  for(const [type,id] of Object.entries(expected)) {
    assert.equal(NODE_TYPES[type].icon,id);const markup=mapNodeInk({type,x:12,y:25,radius:21});
    assert.ok(markup.endsWith(`<text x="12" y="25">${original[id]}</text>`));assert.doesNotMatch(markup,/<image|fill=/,'inline glyph inherits existing map-node text colors');
    assert.ok(engravedIconHtml(id).includes(`>${original[id]}</text>`),'atlas HTML boundary displays the same icon');
  }
  assert.equal(legendEntries().length,7,'shared monster/fight identity stays deduplicated');
  withKitDom(()=>{for(const entry of legendEntries().filter(e=>e.icon.startsWith('historic-')))assert.equal(glyph(entry.icon).querySelector('text').textContent,original[entry.icon]);});
  const saved=NODE_TYPES.monster.icon;
  try{
    NODE_TYPES.monster.icon='mana';assert.match(mapNodeInk({type:'monster',radius:21}),/<image[^>]+mana\.svg/,'custom named vector remains an asset');
    NODE_TYPES.monster.icon='\u2604';assert.match(mapNodeInk({type:'monster',radius:21}),/<image[^>]+progression\.svg/,'raw custom saved icon alias is unchanged');
    NODE_TYPES.monster.icon='\u2600';assert.match(mapNodeInk({type:'monster',radius:21}),/<image[^>]+madness\.svg/);
    NODE_TYPES.monster.icon='historic-sun<script>';assert.match(mapNodeInk({type:'monster',radius:21}),/>\?<\/text>/);assert.doesNotMatch(mapNodeInk({type:'monster',radius:21}),/<script/);
  }finally{NODE_TYPES.monster.icon=saved;}
});

// Bounds captured by the failed source445 phone QA, not a geometry mock.
test('centered padded SVG fits the observed original UI-font metric boxes without relaxing the gate', () => {
  const observed=[{x:3.2941176891326904,y:2,width:60.235294342041016,height:64},{x:3.2941176891326904,y:2.20915,width:60.235294342041016,height:63.5817}];
  for(const box of observed){
    const y=box.y-2; // source text anchor moves34 ->32; font and outer slots stay unchanged
    assert.ok(box.y+box.height>64,'the original64px source failed its strict gate');
    assert.ok(box.x>=-2&&y>=-2&&box.x+box.width<=66&&y+box.height<=66,'new68px frame contains actual failed-font metrics');
  }
});
