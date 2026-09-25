/**
 * settingsPreview — the LIVE PREVIEW STRIP above Settings → General › Display
 * and Settings → Accessibility (docs/SETTINGS-REVAMP.md §4 item 1).
 *
 * A small sample drawn with the game's own CSS: a heading, a line of body text,
 * a line of lore type, a primary and a secondary button, a resource bar and one
 * real card from `renderCard`. It holds NO copy of any display rule. Every
 * display setting (UI size, text size, accent, contrast, readable headings,
 * colour-blind palette, card sizes, lore type) is written on <html>/<body> by
 * main.js `applyDisplaySettings`, synchronously inside the settings onChange,
 * so the sample restyles itself the moment a row changes — nothing here has to
 * listen. `applyDisplaySettings` also re-fits every `.card` on the page, which
 * includes the sample card.
 *
 * The strip is a `<details>` so a phone can fold it away; its open state is the
 * sparse settings key `settingsPreviewOpen` (absent = open), saved through the
 * same onChange every row uses.
 */
import { renderCard } from './card.js';
import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';

export const SETTINGS_PREVIEW_OPEN_KEY = 'settingsPreviewOpen';
/** A colourless starter every class deals from: always in the content. */
export const SETTINGS_PREVIEW_CARD_ID = 'strike';

/** settingsPreviewShown(cat, group) → does this pane carry the strip? */
export function settingsPreviewShown(cat, group) {
  return cat === 'Accessibility' || (cat === 'General' && group === 'Display');
}

/** settingsPreviewHtml(settings) → the strip's markup; the card slot is filled by mountSettingsPreview. */
export function settingsPreviewHtml(settings = {}) {
  const open = settings[SETTINGS_PREVIEW_OPEN_KEY] !== false;
  return `<details class="set-preview" data-settings-preview${open ? ' open' : ''}>`
    + '<summary class="set-preview-summary">Preview</summary>'
    + '<div class="set-preview-body" inert>'
    + '<div class="set-preview-text">'
    + '<h3 class="as-title-s set-preview-heading">The Ashen Spire</h3>'
    + '<p class="as-prose set-preview-body-text">Body text: your hand, your costs, the words you read every turn.</p>'
    + '<p class="set-preview-lore">Ash remembers every name the fire forgot.</p>'
    + '<div class="as-meter stack set-preview-meter" data-tone="hp">'
    + '<span class="m-plate"><span class="m-label">Health</span><span class="m-value">42 / 60</span></span>'
    + '<span class="m-well"><span class="m-track" role="img" aria-label="Health 42 of 60" style="width:100%"><i class="m-fill fill" style="width:70%"></i></span></span>'
    + '</div>'
    + '<div class="set-preview-buttons">'
    + '<button type="button" class="as-btn primary" tabindex="-1">Primary</button>'
    + '<button type="button" class="as-btn" tabindex="-1">Secondary</button>'
    + '</div>'
    + '</div>'
    + `<div class="set-preview-card" data-settings-preview-card="${SETTINGS_PREVIEW_CARD_ID}"></div>`
    + '</div></details>';
}

let registries = null;

/**
 * mountSettingsPreview(host, settings, onChange) → draws the sample card into
 * the strip under `host` and saves the fold. A no-op when the pane has no strip.
 */
export function mountSettingsPreview(host, settings, onChange) {
  const strip = host?.querySelector('[data-settings-preview]');
  if (!strip) return;
  const slot = strip.querySelector('[data-settings-preview-card]');
  if (slot && !slot.firstChild) {
    try {
      registries ||= createRegistries(contentBundle);
      slot.append(renderCard(registries, { cardId: slot.dataset.settingsPreviewCard, upgraded: false }, { small: true, inspection: false }));
    } catch (error) {
      // The sample must never take Settings down with it; say why it is empty.
      slot.textContent = `Card sample unavailable: ${error.message}`;
    }
  }
  strip.addEventListener('toggle', () => {
    if ((settings[SETTINGS_PREVIEW_OPEN_KEY] !== false) === strip.open) return;
    settings[SETTINGS_PREVIEW_OPEN_KEY] = strip.open;
    onChange?.({ [SETTINGS_PREVIEW_OPEN_KEY]: strip.open });
  });
}
