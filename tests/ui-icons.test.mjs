import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

test('editable implementation and authored presentation avoid embedded pictograms', () => {
  // Arrows, mathematical operators, controller directions and prose typography
  // are intentionally outside this range. Artwork remains named asset paths.
  const pictogram = /[\u2600-\u27bf\u{1f000}-\u{1faff}]/u;
  for (const file of files('../src').filter(file => file.endsWith('.js')
    && !file.includes('/generated/') && !file.endsWith('.generated.js'))) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, pictogram, file);
  }
  const config = readFileSync(new URL('../content/config/ui/presentation/uiContent.json', import.meta.url), 'utf8');
  assert.doesNotMatch(config, pictogram);
});

test('the active Core bundle authors readable icon IDs in every installed source pack', () => {
  const bundle = JSON.parse(readFileSync(new URL('../games/ashenspire/bundles/core/bundle.json', import.meta.url), 'utf8'));
  let checked = 0;
  const visit = (value, path) => {
    if (Array.isArray(value)) return value.forEach((entry, i) => visit(entry, `${path}[${i}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      // Source proposals are frozen evidence, not runtime icon authoring.
      if (key === 'provenance') continue;
      if (key === 'icon' || key === 'glyph') {
        assert.ok(typeof entry === 'string' && /^[a-z][a-z-]*$/.test(entry) && uiIconId(entry), `${path}.${key}: ${JSON.stringify(entry)}`);
        assert.equal(engravedGlyphId(entry), uiIconId(entry), `${path}.${key} resolves to named vector art`);
        checked++;
      } else visit(entry, `${path}.${key}`);
    }
  };
  for (const pack of bundle.packs) {
    const manifestUrl = new URL(pack.path, new URL('../games/ashenspire/bundles/core/bundle.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(fileURLToPath(manifestUrl), 'utf8'));
    for (const path of Object.values(manifest.content)) visit(JSON.parse(readFileSync(fileURLToPath(new URL(path, manifestUrl)), 'utf8')), path);
  }
  assert.ok(checked > 100, 'the guard traverses installed source content, including reward cards');
  assert.equal(engravedGlyphId('\u2694'), 'attack', 'saved legacy attack glyph remains compatible');
  assert.equal(engravedGlyphId('defend'), 'block', 'older maneuver icon IDs remain compatible');
  assert.equal(engravedGlyphId('move'), 'motion');
  assert.equal(engravedGlyphId('\u25b0'), 'block', 'saved base-card defense glyph remains compatible');
  assert.equal(engravedGlyphId('\u25d2'), 'mana');
});
