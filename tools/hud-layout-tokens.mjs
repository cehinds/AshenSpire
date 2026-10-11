// tools/hud-layout-tokens.mjs — the HUD layout token allowlist and its
// validators (docs/hud-layout-tokens.md is the contract this implements).
//
// A token is a CSS custom property with a fixed name, a type, a default and
// the stylesheet(s) that consume it. tools/hud-layout-css.mjs validates
// content/hud-layout/<form-factor>.json against this table and writes
// styles/hud-layout.generated.css; nothing else writes these properties.
//
// DEFAULTS REPRODUCE THE LOOK BEFORE THE PIPELINE EXISTED. Most tokens have one
// pre-pipeline literal and that literal is the default. Some name one style for
// several elements that did not agree before (the text shadow is four different
// literals across the HUD; the panel background is #1c1812f2 on the player's
// details and #1c1812ef on the enemy nameplate). Those default to PER_CONSUMER:
// the generator writes `initial` — the guaranteed-invalid value — so every
// consumer's `var(--hud-…, <its old literal>)` fallback applies and an empty
// file changes nothing. A JSON value sets them all to one style. `consumers`
// records each fallback; tests/hud-layout-css.test.mjs holds the stylesheets
// to it.

export const HUD_LAYOUT_FORMAT = 'ashenspire-hud-layout/1';
export const FORM_FACTORS = Object.freeze(['mobile', 'tablet', 'desktop', 'widescreen']);
/** The default of a token whose consumers keep their own pre-pipeline literal. */
export const PER_CONSUMER = 'initial';

const FOUR_WAY = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
const c = (file, fallback) => ({ file, fallback });

export const HUD_LAYOUT_TOKENS = Object.freeze([
  { name: '--hud-text-shadow', type: 'shadow', default: PER_CONSUMER, consumers: [
    c('styles/player-polish.css', FOUR_WAY), // header HP value
    c('styles/combat.css', 'none'), // turn ribbon label
    c('styles/combat-layers.css', 'none'), // idle enemy intent, enemy names, Combat log label
    c('styles/kit.css', '0 1px 2px #000'), // enemy / player / details HP values
    c('styles/combat.css', FOUR_WAY), // Reaction label
    c('styles/kit.css', '0 1px 3px #000'), // footer labels
  ] },
  { name: '--hud-text-plate-bg', type: 'color', default: 'transparent', consumers: [c('styles/combat-layers.css')] },
  { name: '--hud-text-plate-radius', type: 'length', default: '0px', consumers: [c('styles/combat-layers.css')] },
  { name: '--hud-text-plate-pad', type: 'length', default: '0px', consumers: [c('styles/combat-layers.css')] },
  { name: '--hud-panel-bg', type: 'color', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', '#1c1812f2'), // selected player details
    c('styles/combat-layers.css', '#1c1812ef'), // selected enemy nameplate
    c('styles/combat-layers.css', '#201b15'), // intent bubble
  ] },
  { name: '--hud-panel-shadow', type: 'shadow', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', '0 2px 6px #0006'), // selected player details
    c('styles/combat-layers.css', 'none'), // enemy nameplate; Combat log / Reaction row
    c('styles/combat-layers.css', 'inset 0 1px 0 #ffffff36, 0 2px 5px #0009'), // intent bubble
  ] },
  { name: '--hud-panel-radius', type: 'length', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', '4px'), // player details, enemy nameplate
    c('styles/combat-layers.css', 'calc(8px / var(--ui-zoom, 1))'), // intent bubble
    c('styles/combat-layers.css', '0px'), // Combat log / Reaction row backing
  ] },
  { name: '--hud-player-panel-border', type: 'color', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', '#a48743'), // targeted (selected-target) player
    c('styles/combat-layers.css', 'var(--combatant-highlight)'), // context-selected player
  ] },
  { name: '--hud-enemy-panel-border', type: 'color', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'var(--combatant-highlight)'),
  ] },
  { name: '--hud-details-font', type: 'font', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'var(--font-body)'),
  ] },
  { name: '--hud-details-name-size', type: 'length', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'calc(11px / var(--ui-zoom,1))'),
  ] },
  { name: '--hud-details-value-size', type: 'length', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'var(--combatant-value-text, calc(12px / var(--ui-zoom, 1)))'), // HP
    c('styles/combat-layers.css', 'calc(9px / var(--ui-zoom,1))'), // Poise / Ward
  ] },
  { name: '--hud-details-label-color', type: 'color', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'var(--muted)'),
  ] },
  { name: '--hud-details-min-width', type: 'length', default: PER_CONSUMER, consumers: [
    c('styles/combat-layers.css', 'auto'),
  ] },
  { name: '--hud-tools-bg', type: 'color', default: 'transparent', consumers: [c('styles/combat-layers.css')] },
  { name: '--hud-header-hp-max-width', type: 'length', allowNone: true, default: 'none', consumers: [c('styles/player-polish.css')] },
  { name: '--hud-tools-span', type: 'keyword', values: ['field', 'hand'], default: 'field', consumers: [c('src/ui/components/combatTools.js')] },
  { name: '--hud-player-details-dx', type: 'px', default: '0px', consumers: [c('src/ui/models/HudLayoutOffsetModel.js')] },
  { name: '--hud-player-details-dy', type: 'px', default: '0px', consumers: [c('src/ui/models/HudLayoutOffsetModel.js')] },
  { name: '--hud-enemy-nameplate-dy', type: 'px', default: '0px', consumers: [c('src/ui/models/HudLayoutOffsetModel.js')] },
  { name: '--hud-turn-ribbon-dy', type: 'px', default: '0px', consumers: [c('src/ui/models/HudLayoutOffsetModel.js')] },
  { name: '--hud-tools-dy', type: 'px', default: '0px', consumers: [c('src/ui/models/HudLayoutOffsetModel.js')] },
].map((token) => Object.freeze(token)));
// The px geometry tokens are read by name in src/ui/models/HudLayoutOffsetModel.js
// (hudGeometry) and applied by battlefieldStage.js (player details, enemy
// nameplate, turn ribbon) and combatTools.js (the tools row).

export const HUD_LAYOUT_TOKEN_NAMES = Object.freeze(HUD_LAYOUT_TOKENS.map((token) => token.name));
const BY_NAME = new Map(HUD_LAYOUT_TOKENS.map((token) => [token.name, token]));
export function hudLayoutToken(name) { return BY_NAME.get(name) || null; }

// ---- type checks ------------------------------------------------------------

const FORBIDDEN = [';', '{', '}', '<', 'url(', 'expression(', '\\', '/*', '!'];
const NAMED_COLOR = /^[a-z]+$/i;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(?:rgb|rgba|hsl|hsla)\(\s*[-+0-9.%\s,/a-z]*\)$/i;
const LENGTH = /^(?:-?(?:\d+|\d*\.\d+)(?:px|%|rem|em)|0)$/;
const SHADOW_LENGTH = /^(?:-?(?:\d+|\d*\.\d+)(?:px|rem|em)|0)$/;
const PX = /^-?(?:\d+|\d*\.\d+)px$/;
const FAMILY = /^(?:"[^"]+"|'[^']+'|[a-z][a-z0-9-]*(?:\s+[a-z0-9-]+)*)$/i;

/** Splits on separator characters outside parentheses and quotes. */
function splitTop(text, isSep) {
  const parts = []; let depth = 0, quote = null, cur = '';
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && isSep(ch)) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((part) => part.trim());
}

export function isCssColor(value) {
  if (HEX.test(value) || COLOR_FN.test(value)) return true;
  return NAMED_COLOR.test(value) && !['none', 'initial', 'inherit', 'unset', 'revert'].includes(value.toLowerCase());
}

function isShadow(value) {
  if (value === 'none') return true;
  return splitTop(value, (ch) => ch === ',').every((layer) => {
    const words = splitTop(layer, (ch) => /\s/.test(ch)).filter(Boolean);
    const rest = words.filter((word) => word !== 'inset');
    if (words.length - rest.length > 1) return false;
    const lengths = rest.filter((word) => SHADOW_LENGTH.test(word));
    const colors = rest.filter((word) => !SHADOW_LENGTH.test(word));
    return lengths.length >= 2 && lengths.length <= 4 && colors.length <= 1 && colors.every(isCssColor);
  });
}

function isFont(value) {
  const families = splitTop(value, (ch) => ch === ',');
  return families.length > 0 && families.every((family) => FAMILY.test(family));
}

/** Returns null when `value` is a valid value for `token`, else the reason. */
export function checkTokenValue(token, value) {
  if (typeof value !== 'string' || !value.trim()) return 'value must be a non-empty string';
  const text = value.trim();
  const bad = FORBIDDEN.find((needle) => text.toLowerCase().includes(needle));
  if (bad) return `value contains forbidden text '${bad}'`;
  const ok = {
    shadow: isShadow,
    color: isCssColor,
    length: (v) => LENGTH.test(v) || (token.allowNone === true && v === 'none'),
    px: (v) => PX.test(v),
    font: isFont,
    keyword: (v) => token.values.includes(v),
  }[token.type];
  if (!ok) return `unknown token type '${token.type}'`;
  if (!ok(text)) {
    const want = token.type === 'keyword' ? `one of ${token.values.join(' | ')}`
      : token.type === 'length' && token.allowNone ? 'a length (px, %, rem, em) or none'
        : { shadow: 'a CSS shadow list or none', color: 'a CSS color', length: 'a length (px, %, rem, em)', px: 'a signed px number', font: 'a font-family list' }[token.type];
    return `'${text}' is not ${want}`;
  }
  return null;
}

/**
 * Validates one parsed layout file. `expectedFormFactor` is the one its file
 * name says. Returns a list of error strings (empty when valid).
 */
export function validateHudLayoutFile(doc, expectedFormFactor) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['file must hold a JSON object'];
  for (const key of Object.keys(doc)) {
    if (!['format', 'formFactor', 'source', 'tokens'].includes(key)) errors.push(`unknown key '${key}'`);
  }
  if (doc.format !== HUD_LAYOUT_FORMAT) errors.push(`format must be '${HUD_LAYOUT_FORMAT}'`);
  if (!FORM_FACTORS.includes(doc.formFactor)) errors.push(`formFactor '${doc.formFactor}' is not one of ${FORM_FACTORS.join(', ')}`);
  else if (expectedFormFactor && doc.formFactor !== expectedFormFactor) errors.push(`formFactor '${doc.formFactor}' does not match the file name (${expectedFormFactor})`);
  if (doc.source !== undefined && typeof doc.source !== 'string') errors.push('source must be a string');
  if (!doc.tokens || typeof doc.tokens !== 'object' || Array.isArray(doc.tokens)) {
    errors.push('tokens must be an object');
    return errors;
  }
  for (const [name, value] of Object.entries(doc.tokens)) {
    const token = hudLayoutToken(name);
    if (!token) { errors.push(`unknown token '${name}'`); continue; }
    const reason = checkTokenValue(token, value);
    if (reason) errors.push(`${name}: ${reason}`);
  }
  return errors;
}
