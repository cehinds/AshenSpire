import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  settingsPreviewHtml, settingsPreviewShown, mountSettingsPreview,
  SETTINGS_PREVIEW_OPEN_KEY, SETTINGS_PREVIEW_CARD_ID,
} from '../src/ui/components/settingsPreview.js';
import { categoryHtml, settingsRowHtml, settingsRows, GENERAL_GROUPS } from '../src/ui/screens/settings.js';
import { contentBundle } from '../src/content/index.js';

const STRIP = 'data-settings-preview';

test('the strip carries every sample piece, drawn with the game\'s own classes', () => {
  const html = settingsPreviewHtml({});
  assert.match(html, /<details class="set-preview" data-settings-preview open>/);
  assert.match(html, /<summary[^>]*>Preview<\/summary>/);
  assert.match(html, /class="as-title-s[^"]*"/, 'a heading');
  assert.match(html, /class="as-prose[^"]*"/, 'a line of body text');
  assert.match(html, /class="set-preview-lore"/, 'a line of lore type');
  assert.match(html, /class="as-btn primary"/, 'a primary button');
  assert.match(html, /class="as-btn"/, 'a secondary button');
  assert.match(html, /class="as-meter[^"]*"[^>]*data-tone="hp"/, 'a resource bar');
  assert.match(html, new RegExp(`data-settings-preview-card="${SETTINGS_PREVIEW_CARD_ID}"`), 'the card slot');
  assert.match(html, /class="set-preview-body" inert/, 'the sample cannot be operated or tabbed into');
});

test('the sample card is a real card in the content', () => {
  const card = contentBundle.cards.find((c) => c.id === SETTINGS_PREVIEW_CARD_ID);
  assert.ok(card, `${SETTINGS_PREVIEW_CARD_ID} must exist`);
  assert.equal(card.rarity, 'starter');
});

test('the fold is remembered in settingsPreviewOpen (absent = open)', () => {
  assert.equal(SETTINGS_PREVIEW_OPEN_KEY, 'settingsPreviewOpen');
  assert.match(settingsPreviewHtml({ settingsPreviewOpen: true }), /data-settings-preview open>/);
  assert.doesNotMatch(settingsPreviewHtml({ settingsPreviewOpen: false }), /data-settings-preview open>/);
});

test('shown only for General › Display and Accessibility', () => {
  assert.equal(settingsPreviewShown('General', 'Display'), true);
  assert.equal(settingsPreviewShown('Accessibility', 'Accessibility'), true);
  for (const group of GENERAL_GROUPS.filter((g) => g !== 'Display')) assert.equal(settingsPreviewShown('General', group), false);
  assert.equal(settingsPreviewShown('Advanced', 'Display'), false);
});

test('categoryHtml puts the strip above the rows of Display and Accessibility only', () => {
  for (const [cat, group] of [['General', 'Display'], ['Accessibility', 'Accessibility']]) {
    const html = categoryHtml(cat, { settingsGeneralCategory: group }, null);
    assert.equal(html.match(/data-settings-preview[\s>]/g)?.length, 1, `${cat} carries one strip`);
    assert.ok(html.indexOf(STRIP) < html.indexOf('set-card-list'), `${cat}: the strip sits above the rows`);
    assert.ok(html.indexOf('set-general-pickers') < html.indexOf(STRIP), `${cat}: the section pickers stay first`);
  }
  for (const group of GENERAL_GROUPS.filter((g) => g !== 'Display')) {
    assert.doesNotMatch(categoryHtml('General', { settingsGeneralCategory: group }, null), new RegExp(STRIP), `General › ${group}`);
  }
  assert.doesNotMatch(categoryHtml('Advanced', {}, null), new RegExp(STRIP), 'Advanced');
  assert.doesNotMatch(categoryHtml('General', { settingsGeneralCategory: 'Display' }, null, null, null, 'text size'), new RegExp(STRIP), 'search results');
});

test('no single row carries the strip', () => {
  for (const row of settingsRows().filter((r) => !r.retired)) {
    assert.doesNotMatch(settingsRowHtml({}, row), new RegExp(STRIP), row.key);
  }
});

test('mounting is a no-op on a pane without the strip', () => {
  assert.doesNotThrow(() => mountSettingsPreview({ querySelector: () => null }, {}, () => {}));
  assert.doesNotThrow(() => mountSettingsPreview(null, {}, () => {}));
});

test('the fold saves through the pane\'s onChange', () => {
  const listeners = {};
  const strip = { open: false, addEventListener: (type, fn) => { listeners[type] = fn; }, querySelector: () => null };
  const settings = {};
  const changes = [];
  mountSettingsPreview({ querySelector: () => strip }, settings, (c) => changes.push(c));
  listeners.toggle();
  assert.deepEqual(changes, [{ settingsPreviewOpen: false }]);
  assert.equal(settings.settingsPreviewOpen, false);
  listeners.toggle();
  assert.equal(changes.length, 1, 'an unchanged fold is not saved again');
});

test('settings.js wires the strip in a few lines, and ui.css styles it under the settings host', () => {
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /settingsPreviewShown\(cat, selected\) \? settingsPreviewHtml\(settings\)/);
  assert.match(screen, /mountSettingsPreview\(container, settings, onChange\)/);
  const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-settings-host\] \.set-preview \{/);
});
