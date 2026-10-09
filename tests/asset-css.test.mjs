// tests/asset-css.test.mjs — the web edition's CSS assets (tools/asset-css.mjs,
// docs/EXTERNAL-ASSETS-PLAN.md §3.7, step 3b): every font and backdrop url()
// in the real stylesheets becomes an ASSET_CSS slot, the masks are inlined,
// and nothing else in the cascade moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalizeCss, newTemplate, templateValue, slotIds, cssVarName, CSS_URL, propertyAt } from '../tools/asset-css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hrefs = [...readFileSync(resolve(ROOT, 'index.html'), 'utf8').matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
const idFor = (cssAbs) => (ref) => posix.join('assets', relative(resolve(ROOT, 'assets'), resolve(dirname(cssAbs), ref)).split(/[\\/]/g).join('/'));
const MASK = (id) => `data:image/svg+xml;base64,${Buffer.from(id).toString('base64')}`;

function externalizeAll() {
  const template = newTemplate();
  const sheets = hrefs.map((href) => {
    const abs = resolve(ROOT, href);
    const css = readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n');
    return { href, abs, css, out: externalizeCss(css, { idFor: idFor(abs), inlineData: MASK, template }) };
  });
  return { template, sheets, value: templateValue(template) };
}

test('the real stylesheets externalize fonts and scene/material art, inline vectors, and leave no file URL', () => {
  const { template, sheets, value } = externalizeAll();
  const ids = slotIds(value);
  assert.equal(ids.filter((id) => id.startsWith('assets/fonts/')).length, 15, 'every "AS Lore" face');
  assert.equal(ids.filter((id) => id.startsWith('assets/bg/')).length, 9, 'every backdrop id, once');
  assert.equal(ids.filter((id) => id.startsWith('assets/player-polish/')).length, 9, 'eight desktop/portrait scene IDs and one material, each once');
  assert.equal(value.rules.length, 34);
  assert.equal(template.urls, 138, 'fonts, canonical backdrops, player scenes/materials, shared combat and Blight textures, and vector frame/mask uses');
  assert.equal(template.inlined, 93, 'canonical, footer, folio and file-play icon fallback vectors; close uses its single shared glyph');
  for (const { href, out } of sheets) {
    for (const m of out.matchAll(CSS_URL)) assert.match(m[2], /^data:image\/svg\+xml;base64,/, `${href}: only the masks stay as url()`);
    assert.doesNotMatch(out, /@font-face[^}]*url\(\s*['"]?\.\./, `${href}: no face names a file`);
  }
  for (const rule of value.rules) assert.match(rule, /^(?::root\{--as-css-[\w-]+:url\("\{\{assets\/[^{}]+\}\}"\)\}|@font-face \{[^{}]*url\("\{\{assets\/fonts\/[^{}]+\.woff2\}\}"\)[^{}]*\})$/, rule);
});

test('the cascade does not move: put each url() back where its variable is, and the sheet is the original less its faces', () => {
  const { sheets, template } = externalizeAll();
  for (const { href, abs, css, out } of sheets) {
    const back = out.replace(/var\((--as-css-[\w-]+), none\)/g, (_, name) => {
      const id = template.names.get(name);
      return `url(${id})`;
    }).replace(/url\("data:image\/svg\+xml;base64,([^"]+)"\)/g, (_, b64) => `url(${Buffer.from(b64, 'base64').toString()})`);
    const original = css.replace(/@font-face\s*\{[^{}]*\}/g, (block) => (/url\(/.test(block) ? '' : block))
      .replace(CSS_URL, (whole, _q, ref) => (/^(data:|https?:|\/\/|#)/i.test(ref) ? whole : `url(${idFor(abs)(ref)})`));
    assert.equal(back, original, href);
  }
});

test('a url() where var(…, none) would change its meaning is refused, and so is a variable-name collision', () => {
  const opts = () => ({ idFor: (ref) => `assets/${ref}`, inlineData: MASK, template: newTemplate() });
  assert.throws(() => externalizeCss('.x { cursor: url(a.webp), auto; }', opts()), /sits in "cursor"/);
  assert.throws(() => externalizeCss('.x { content: url(a.webp); }', opts()), /sits in "content"/);
  assert.throws(() => externalizeCss('.x { background-image: url(a.b.webp); } .y { background-image: url(a-b.webp); }', opts()), /share the CSS variable/);
  const ok = opts();
  assert.equal(externalizeCss('.x { background: linear-gradient(red, blue), url(bg/a.webp) center / cover; }', ok),
    '.x { background: linear-gradient(red, blue), var(--as-css-bg-a-webp, none) center / cover; }');
  assert.equal(externalizeCss('.y { background-image: url("https://example.com/a.webp"); }', ok), '.y { background-image: url("https://example.com/a.webp"); }', 'a remote url is left alone');
  assert.equal(cssVarName('assets/bg/bg_act1.webp'), '--as-css-bg-bg_act1-webp');
  assert.equal(templateValue(newTemplate()), null, 'no asset url(), no template');
});

test('the property is read past a `;` inside a data: url, a string or a comment, and an unreadable one says so', () => {
  const opts = () => ({ idFor: (ref) => `assets/${ref}`, inlineData: MASK, template: newTemplate() });
  assert.equal(externalizeCss('.x { background: url(data:image/png;base64,AA), url(a.webp); }', opts()),
    '.x { background: url(data:image/png;base64,AA), var(--as-css-a-webp, none); }');
  assert.equal(externalizeCss('.x { /* a; b */ background-image: url(a.webp); }', opts()), '.x { /* a; b */ background-image: var(--as-css-a-webp, none); }');
  assert.equal(externalizeCss('.x { background-image: image-set("x;y" 1x), url(a.webp); }', opts()), '.x { background-image: image-set("x;y" 1x), var(--as-css-a-webp, none); }');
  const css = '.x { color: red; } .y { background: url(a.webp) }';
  assert.equal(propertyAt(css, css.indexOf('url(a')), 'background');
  assert.throws(() => externalizeCss('url(a.webp)', opts()), /could not be read/);
});
