import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { UI_ICON_IDS, UI_ICON_LABELS, LEGACY_UI_ICON_IDS, uiIconId, uiIconText } from '../src/content/uiIcons.js';
import { engravedGlyphId, engravedIconUrl } from '../src/ui/components/engravedIcon.js';

const files = dir => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);

test('named icons and saved legacy glyphs resolve to the same existing artwork', () => {
  assert.equal(new Set(UI_ICON_IDS).size, UI_ICON_IDS.length);
  for (const id of UI_ICON_IDS) {
    assert.match(id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.equal(engravedGlyphId(id), id);
    assert.ok(UI_ICON_LABELS[id]?.length <= 6, `${id} has a compact text fallback`);
    assert.ok(engravedIconUrl(id)?.endsWith(`/${id}.svg`), id);
  }
  for (const [legacy, id] of Object.entries(LEGACY_UI_ICON_IDS)) assert.equal(uiIconId(legacy), id);
  assert.equal(uiIconText('health'), 'HP');
  assert.equal(uiIconId('not-an-icon'), null);
});

test('authored icon fields stay readable and named', () => {
  for (const dir of ['../content/source', '../src/content']) {
    for (const file of files(dir).filter(file => /\.(js|json)$/.test(file) && !file.includes('/generated/'))) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      for (const match of source.matchAll(/(?:\b(?:icon|glyph)\s*:|"(?:icon|glyph)"\s*:)\s*['"]([^'"\n]+)['"]/g)) {
        assert.match(match[1], /^[\x20-\x7e]+$/, `${file}: ${match[1]}`);
        assert.ok(UI_ICON_IDS.includes(match[1]), `${file}: unknown icon ${match[1]}`);
      }
    }
  }
});

test('archived fixed-loadout presenter cannot enter the runtime graph', () => {
  const archive = '../docs/archive/core-renewal/gameProfileCreation.js.txt';
  assert.match(readFileSync(new URL(archive, import.meta.url), 'utf8'), /export function mountGameProfileCreation/);
  for (const file of files('../src').filter(file => file.endsWith('.js'))) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /(?:import|export)\s[^;]*gameProfileCreation|import\s*\([^)]*gameProfileCreation/);
  }
});

test('UI implementation and authored presentation avoid embedded pictograms', () => {
  // Arrows, mathematical operators, controller directions and prose typography
  // are intentionally outside this range. Artwork remains named asset paths.
  const pictogram = /[\u2600-\u27bf\u{1f000}-\u{1faff}]/u;
  for (const file of files('../src/ui').filter(file => file.endsWith('.js'))) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    // Comments describe history and do not ship embedded runtime glyphs.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, pictogram, file);
  }
  const config = readFileSync(new URL('../content/config/ui/presentation/uiContent.json', import.meta.url), 'utf8');
  assert.doesNotMatch(config, pictogram);
});
