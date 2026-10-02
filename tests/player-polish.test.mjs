import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { engravedIconId, engravedIconUrl, engravedIconHtml, engravedGlyphId, engravedMaskUrl, refreshEngravedIcons } from '../src/ui/components/engravedIcon.js';
import { setHighResSource, setBuiltInSource } from '../src/ui/assetmap.js';
import { refreshMountedArt } from '../src/ui/highResArt.js';

test('engraved resource aliases retain canonical engine identities', () => {
  assert.equal(engravedIconId('energy'), 'actions');
  assert.equal(engravedIconId('action'), 'actions');
  assert.equal(engravedIconId('hp'), 'health');
  assert.equal(engravedIconId('crimsonBlight'), 'blight');
  assert.equal(engravedIconId('invented-status'), null);
  assert.equal(engravedGlyphId('unregistered-class-sigil'), null);
  assert.equal(engravedIconHtml('<script>'), '');
});
test('engravings exist in both export tiers and resolve through the shared asset seam', () => {
  const id = 'assets/player-polish/ui/icons/mana.svg';
  assert.ok(existsSync(new URL('../' + id, import.meta.url)));
  assert.ok(existsSync(new URL('../assets-mobile/player-polish/ui/icons/mana.svg', import.meta.url)));
  try {
    setBuiltInSource(new Map([[id, 'objects/light-mana.svg']]));
    assert.equal(engravedIconUrl('mana'), 'objects/light-mana.svg');
    setHighResSource(new Map([[id, 'blob:high-mana']]));
    assert.equal(engravedIconUrl('mana'), 'blob:high-mana');
    assert.match(engravedIconHtml('mana'), /aria-hidden="true"/);
    assert.match(engravedIconHtml('mana'), /blob:high-mana/);
  } finally { setHighResSource(null); setBuiltInSource(null); }
});
test('mounted engraving follows tier changes without replacing controls or text', () => {
  const values = new Map();
  const icon = { dataset: { engravedIcon: 'health' }, style: { setProperty: (key, value) => values.set(key, value) } };
  const root = { querySelectorAll: (selector) => selector === '[data-engraved-icon]' ? [icon] : [] };
  try {
    setHighResSource(new Map([['assets/player-polish/ui/icons/health.svg', 'blob:health']]));
    refreshMountedArt(root);
    assert.equal(values.get('--engraving'), 'url("blob:health")');
    setHighResSource(null);
    refreshEngravedIcons(root);
    assert.equal(values.get('--engraving'), 'url("assets/player-polish/ui/icons/health.svg")');
  } finally { setHighResSource(null); }
});
test('file play uses the embedded vector fallback for relative masks and accepts picked-folder blobs', () => {
  const id = 'assets/player-polish/ui/icons/health.svg';
  try {
    setBuiltInSource(new Map([[id, 'objects/health.svg']]));
    assert.equal(engravedMaskUrl('health', 'file:'), null);
    assert.equal(engravedMaskUrl('health', 'https:'), 'objects/health.svg');
    setHighResSource(new Map([[id, 'blob:health']]));
    assert.equal(engravedMaskUrl('health', 'file:'), 'blob:health');
    setBuiltInSource(new Map([[id, 'objects/health.svg" onmouseover="bad']]));
    setHighResSource(null);
    const html = engravedIconHtml('health');
    assert.doesNotMatch(html, /" onmouseover="/);
    assert.match(html, /&quot;/);
  } finally { setHighResSource(null); setBuiltInSource(null); }
});

test('unverified served high-res masks retain the embedded original, including partial folders', () => {
  const id = 'assets/player-polish/ui/icons/health.svg';
  const values = new Map([['--engraving', 'url("blob:previous-health")']]);
  const icon = { dataset: { engravedIcon: 'health' }, style: {
    setProperty: (key, value) => values.set(key, value),
    removeProperty: (key) => values.delete(key),
  } };
  try {
    setHighResSource(new Map([[id, 'https://example.invalid/partial-hd/health.svg']]));
    assert.equal(engravedMaskUrl('health', 'https:'), null);
    refreshEngravedIcons({ querySelectorAll: () => [icon] });
    assert.equal(values.has('--engraving'), false);
    assert.doesNotMatch(engravedIconHtml('health'), /partial-hd/);
  } finally { setHighResSource(null); }
});
