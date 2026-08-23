// src/ui/assets.js — asset lookup + placeholder generator (SPEC §2.4)
//
// Every visual goes through here. M1 ships zero downloaded assets: everything
// renders as the style guide's placeholder recipe (tinted rounded rect +
// glyph + name). Swapping in real art later = mapping an id to a URL here,
// with a CREDITS.md row — no game-code changes.

import { balance } from '../content/balance.js';
import { assetUrl } from './assetmap.js';

// Sprite size tiers (the display dimensions each enemy def's `size` selects) are
// data — content/balance.js → ui.spriteTiers. Sizes are generous on purpose: the
// board reads best when sprites fill it, and the whole UI is zoomed to fit the
// window (main.js applyUiScale), so larger base sizes mean a bolder board rather
// than overflow. These are non-text geometry and remain px when Text size
// changes; UI size still scales the containing application.
const SIZE_TIERS = balance.ui.spriteTiers;
const px = (value) => `${value}px`;

/**
 * Enemy sprite: the Blender-rendered PNG when it exists
 * (assets/sprites/enemy_<id>.webp, tools/sprites-blender.py), else the style
 * guide's placeholder recipe (tinted rounded rect + glyph). New enemies with
 * no render yet fall back automatically — the img error handler swaps in the
 * placeholder, so content can ship art-less.
 */
export function enemySprite(enemyDef) {
  const tier = SIZE_TIERS[enemyDef.size || 'medium'];
  const tint = enemyDef.tint || 'var(--line-soft)';
  const el = document.createElement('div');
  const placeholder = () => {
    el.innerHTML = '';
    el.style.cssText = `width:${px(tier.w)};height:${px(tier.h)};border-radius:10px;` +
      `background:var(--panel);border:2px solid ${tint};display:flex;align-items:center;` +
      `justify-content:center;font-size:${px(tier.font)};position:relative;` +
      `box-shadow:0 ${Math.round(tier.h * 0.08)}px 10px rgba(0,0,0,.5);`;
    el.textContent = enemyDef.art || '☠';
  };
  el.style.cssText = `width:${px(tier.w)};height:${px(tier.h)};position:relative;` +
    'display:flex;align-items:flex-end;justify-content:center;';
  const img = document.createElement('img');
  img.src = assetUrl(`assets/sprites/enemy_${enemyDef.id}.webp`);
  img.alt = enemyDef.name || enemyDef.id;
  img.style.cssText = `width:100%;height:100%;object-fit:contain;` +
    `filter:drop-shadow(0 ${Math.round(tier.h * 0.06)}px 8px rgba(0,0,0,.55));`;
  img.addEventListener('error', placeholder);
  el.appendChild(img);
  return el;
}

// Character customization options (cosmetic — stored on run.customization).
export const PORTRAIT_GLYPHS = ['⚔', '🛡', '🔥', '🌙', '☀', '🐺'];
export const PORTRAIT_TINTS = [
  { id: 'gold', css: 'var(--gold)', name: 'Goldbough gold' },
  { id: 'ember', css: 'var(--ember)', name: 'Gorefire ember' },
  { id: 'frost', css: 'var(--frost)', name: 'Hoarfrost' },
  { id: 'rot', css: 'var(--rot)', name: 'Crimson blight' },
  { id: 'grace', css: 'var(--grace)', name: 'Lost ember' },
];

// ---- Class character sprites (inline SVG, tinted) --------------------------
// Hand-authored, dependency-free silhouettes — one per class. Togglable in
// Settings; when off, playerSprite falls back to the chosen sigil glyph.
let spritesEnabled = true;
export function setSpritesEnabled(on) {
  spritesEnabled = on !== false;
}
export function spritesAreEnabled() {
  return spritesEnabled;
}

// Each builder takes a tint (CSS color/var) used for accents and the player's
// chosen sigil, worn as a chest medallion so the customization reads on the
// figure itself (not just the portrait). No sigil → the original plain accent.
// viewBox 110×140, figure standing on a soft shadow.
function sigilMedallion(cx, cy, t, sigil, plainR) {
  if (!sigil) return `<circle cx="${cx}" cy="${cy}" r="${plainR}" fill="${t}"/>`;
  const safe = String(sigil).replace(/[<>&"]/g, '');
  return (
    `<circle cx="${cx}" cy="${cy}" r="8" fill="#14100c" stroke="${t}" stroke-width="1.5"/>` +
    // The whole figure is mirrored (styles/ui.css, "the figure faces the viewer").
    // The circle is symmetric and does not care; the GLYPH is text, and mirrored
    // text reads as a rendering fault rather than as a character facing you.
    // Reflected about its own centre, so it lands exactly where it already was.
    `<g transform="translate(${cx * 2},0) scale(-1,1)">` +
    `<text x="${cx}" y="${cy + 0.5}" font-size="11" fill="#e8dcc0" text-anchor="middle" dominant-baseline="central">${safe}</text>` +
    `</g>`
  );
}

const CLASS_SVG = {
  // Reaver — armored knight, greatsword held point-down, cape behind.
  reaver: (t, sigil) => `
    <svg viewBox="0 0 110 140" xmlns="http://www.w3.org/2000/svg" width="110" height="140">
      <ellipse cx="55" cy="133" rx="28" ry="5" fill="rgba(0,0,0,.45)"/>
      <path d="M30 48 L24 130 L86 130 L80 48 Q55 40 30 48Z" fill="#20190f"/>
      <g fill="#3a3226">
        <path d="M40 56 Q55 48 70 56 L68 118 L42 118Z"/>
        <path d="M36 58 Q31 48 42 46 L46 62Z"/>
        <path d="M74 58 Q79 48 68 46 L64 62Z"/>
      </g>
      <path d="M40 56 Q55 49 70 56" fill="none" stroke="${t}" stroke-width="1.5"/>
      <path d="M44 26 Q55 12 66 26 Q68 40 55 47 Q42 40 44 26Z" fill="#4a4034" stroke="${t}" stroke-width="1.4"/>
      <rect x="53" y="28" width="4" height="16" rx="2" fill="#0e0a08"/>
      <rect x="52.5" y="66" width="5" height="58" rx="1" fill="#b8b0a0"/>
      <rect x="44" y="64" width="22" height="4" rx="2" fill="${t}"/>
      <circle cx="55" cy="61" r="4" fill="${t}"/>
      ${sigilMedallion(55, 84, t, sigil, 5.5)}
    </svg>`,
  // Starseer — robed mage, wide pointed hat, star-topped staff, sparkles.
  starseer: (t, sigil) => `
    <svg viewBox="0 0 110 140" xmlns="http://www.w3.org/2000/svg" width="110" height="140">
      <ellipse cx="55" cy="133" rx="26" ry="5" fill="rgba(0,0,0,.45)"/>
      <rect x="80" y="30" width="3.5" height="99" rx="1" fill="#6b5d45"/>
      <path d="M81.7 15 l3.4 7.6 8.3 .8 -6.2 5.6 1.8 8.1 -7.3-4.2 -7.3 4.2 1.8-8.1 -6.2-5.6 8.3-.8z" fill="${t}"/>
      <path d="M40 60 L30 130 L80 130 L70 60 Q55 54 40 60Z" fill="#2b2547"/>
      <path d="M40 60 Q55 54 70 60 L66 80 L44 80Z" fill="#3a3358"/>
      <circle cx="55" cy="50" r="9" fill="#463c2e"/>
      <path d="M32 40 Q55 5 78 40 Q55 30 32 40Z" fill="#2b2547" stroke="${t}" stroke-width="1.4"/>
      <circle cx="55" cy="12" r="2.6" fill="${t}"/>
      ${sigilMedallion(55, 66, t, sigil, 4.5)}
      <circle cx="29" cy="52" r="1.7" fill="${t}"/>
      <circle cx="40" cy="96" r="1.5" fill="${t}"/>
    </svg>`,
  // Rogue — light leathers, lowered hood, paired short blades.
  rogue: (t, sigil) => `
    <svg viewBox="0 0 110 140" xmlns="http://www.w3.org/2000/svg" width="110" height="140">
      <ellipse cx="55" cy="133" rx="25" ry="5" fill="rgba(0,0,0,.45)"/>
      <path d="M38 58 L31 130 L79 130 L72 58 Q55 51 38 58Z" fill="#202725"/>
      <path d="M39 58 Q55 52 71 58 L67 82 L43 82Z" fill="#35433f"/>
      <path d="M42 42 Q55 20 68 42 L66 59 Q55 66 44 59Z" fill="#1b211f" stroke="${t}" stroke-width="1.3"/>
      <path d="M45 48 Q55 43 65 48" fill="none" stroke="${t}" stroke-width="1.2"/>
      <path d="M31 72 L48 112" stroke="#c0b7a7" stroke-width="4"/><path d="M79 72 L62 112" stroke="#c0b7a7" stroke-width="4"/>
      <path d="M27 68 L36 76 M83 68 L74 76" stroke="${t}" stroke-width="3"/>
      ${sigilMedallion(55, 78, t, sigil, 4)}
    </svg>`,
  // Herald — hooded pilgrim, halo, prayer beads at the waist.
  herald: (t, sigil) => `
    <svg viewBox="0 0 110 140" xmlns="http://www.w3.org/2000/svg" width="110" height="140">
      <ellipse cx="55" cy="133" rx="26" ry="5" fill="rgba(0,0,0,.45)"/>
      <circle cx="55" cy="30" r="16" fill="none" stroke="${t}" stroke-width="2"/>
      <path d="M38 64 L30 130 L80 130 L72 64 Q55 58 38 64Z" fill="#2e1f1f"/>
      <path d="M40 44 Q55 20 70 44 L70 72 Q55 80 40 72Z" fill="#241413"/>
      <path d="M46 50 Q55 41 64 50 L62 68 Q55 72 48 68Z" fill="#0e0a08"/>
      <path d="M40 44 Q55 20 70 44" fill="none" stroke="${t}" stroke-width="1.4"/>
      <circle cx="55" cy="60" r="3.2" fill="${t}"/>
      ${sigilMedallion(55, 84, t, sigil, 3)}
      <path d="M49 95 Q55 105 61 95" fill="none" stroke="${t}" stroke-width="1.4"/>
    </svg>`,
};

// Rendered class sprites (tools/sprites-blender.py → assets/sprites/): one
// transparent PNG per class × accent tint. Missing/unloadable art falls back
// to the inline SVG silhouette, so the single-file dist and file:// play keep
// working with zero configuration. Art credit: procedurally generated in
// Blender by this repo (see CREDITS.md).
// Derived, never restated: the tint slots ARE the customization tints, and the
// classes with rendered art ARE the ones with a silhouette builder. Hand-listing
// them again let the sprite lookup silently drift from the content it serves.
const SPRITE_TINT_IDS = PORTRAIT_TINTS.map((t) => t.id);
const SPRITE_CLASSES = Object.keys(CLASS_SVG);
function renderedSpriteUrl(classId, tintId) {
  if (!SPRITE_CLASSES.includes(classId)) return null;
  const t = SPRITE_TINT_IDS.includes(tintId) ? tintId : 'gold';
  return assetUrl(`assets/sprites/${classId}_${t}.webp`);
}

// Player sprite styles: 'rendered' (Blender PNG), 'classic' (inline SVG
// silhouette), 'glyph' (sigil-in-a-panel). Chosen per character.
export const SPRITE_STYLES = [
  { id: 'rendered', name: 'Rendered' },
  { id: 'classic', name: 'Classic' },
  { id: 'glyph', name: 'Sigil' },
];

/** A tinted class sprite (rendered PNG, SVG fallback), or null if unknown. */
export function classSprite(classId, tint, sigil, tintId, style) {
  const build = CLASS_SVG[classId];
  if (!build) return null;
  const el = document.createElement('div');
  el.className = 'class-sprite';
  el.style.cssText = 'width:150px;height:190px;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:center;position:relative;';

  const fallbackToSvg = () => {
    el.innerHTML = build(tint, sigil);
    const svg = el.querySelector('svg');
    if (svg) {
      // The class SVGs hardcode a 110×140 viewBox; fill the fixed-geometry
      // container (viewBox keeps ratio) so Text size cannot resize the figure.
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
    }
  };

  const url = style === 'classic' ? null : renderedSpriteUrl(classId, tintId);
  if (!url) {
    fallbackToSvg();
    return el;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = classId;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:auto;';
  img.addEventListener('error', fallbackToSvg); // dist / file:// → SVG
  el.appendChild(img);
  // The chosen sigil rides the rendered art as a chest medallion overlay.
  if (sigil) {
    const med = document.createElement('span');
    med.textContent = sigil;
    // `scaleX(-1)` UNDOES the figure mirror this element inherits (styles/ui.css,
    // "the figure faces the viewer"). That mirror is right for the ART and wrong
    // for a GLYPH: a sigil is text, and mirrored text reads as a rendering fault.
    // The medallion is centred on the chest, so flipping it back moves nothing.
    med.style.cssText =
      `position:absolute;left:50%;top:53%;transform:translate(-50%,-50%) scaleX(-1);` +
      `width:22px;height:22px;border-radius:50%;background:#14100c;border:1.5px solid ${tint};` +
      'display:flex;align-items:center;justify-content:center;font-size:13px;color:#e8dcc0;';
    el.appendChild(med);
  }
  return el;
}

/**
 * The player's combat figure: the class sprite when sprites are enabled (and the
 * class has one), else the chosen sigil glyph in a tinted panel.
 */
/**
 * equippedFigure({ classId, armourId, rightId, leftId }) → element | null.
 *
 * The figure as LAYERS: a bare-handed body in the armour set's palette, with
 * each held armament stacked over it. All of them are rendered on one shared
 * camera and canvas (tools/equipment-blender.py), which is what lets them be
 * absolutely positioned on top of each other and simply line up.
 *
 * Layering is why this is affordable at all: 12 armour sets × 24 armaments ×
 * 24 off-hands pre-rendered is six figures' worth of combinations, while one
 * PNG per piece is 36 files. Any layer that fails to load just removes itself,
 * so a missing asset degrades to a plainer figure rather than a broken one.
 */
export function equippedFigure({ classId, armourId, rightId, leftId }) {
  if (!SPRITE_CLASSES.includes(classId)) return null;
  const el = document.createElement('div');
  el.className = 'equipped-figure';
  el.style.cssText = 'position:relative;width:100%;height:100%;';
  const layer = (src, z) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.style.cssText =
      `position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:${z};`;
    img.addEventListener('error', () => img.remove());
    el.appendChild(img);
  };
  layer(assetUrl(`assets/equipment/body_${classId}_${armourId || 'default'}.webp`), 1);
  if (leftId) layer(assetUrl(`assets/equipment/weapon_${leftId}.webp`), 2);
  if (rightId) layer(assetUrl(`assets/equipment/weapon_${rightId}.webp`), 3);
  return el;
}

/**
 * playerSprite(customization, classId, equip?) — the player's figure.
 *
 * With `equip` ({ armourId, rightId, leftId }) it composites the layered
 * equipment figure; without it, the single rendered class PNG as before.
 */
export function playerSprite(customization = {}, classId, equip = null) {
  const tint = tintCss(customization.tint);
  const style = customization.spriteStyle || 'rendered';
  if (equip && spritesEnabled && style === 'rendered' && SPRITE_CLASSES.includes(classId)) {
    const el = document.createElement('div');
    el.className = 'class-sprite';
    el.style.cssText = 'width:150px;height:190px;flex:0 0 auto;position:relative;';
    el.appendChild(equippedFigure({ classId, ...equip }));
    return el;
  }
  if (spritesEnabled && style !== 'glyph' && CLASS_SVG[classId]) {
    return classSprite(classId, tint, customization.glyph, customization.tint, style);
  }
  const el = document.createElement('div');
  el.style.cssText =
    `width:150px;height:190px;flex:0 0 auto;border-radius:10px;background:#2a2418;border:2px solid ${tint};` +
    'display:flex;align-items:center;justify-content:center;font-size:70px;position:relative;' +
    `box-shadow:0 10px 12px rgba(0,0,0,.5), inset 0 0 24px rgba(0,0,0,.4);`;
  el.textContent = customization.glyph || '🛡';
  return el;
}

export function tintCss(tintId) {
  const t = PORTRAIT_TINTS.find((x) => x.id === tintId);
  return t ? t.css : 'var(--gold)';
}

// Class sigil glyphs come from the class defs (data). main.js registers them at
// boot via setClassGlyphs so classGlyph(id) stays a cheap synchronous lookup for
// its many call sites; unknown classes fall back to the generic sigil.
let classGlyphs = {};
export function setClassGlyphs(classes) {
  classGlyphs = {};
  for (const c of classes || []) if (c.glyph) classGlyphs[c.id] = c.glyph;
}
export function classGlyph(classId) {
  return classGlyphs[classId] || '❖';
}
