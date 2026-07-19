// src/ui/assets.js — asset lookup + placeholder generator (SPEC §2.4)
//
// Every visual goes through here. M1 ships zero downloaded assets: everything
// renders as the style guide's placeholder recipe (tinted rounded rect +
// glyph + name). Swapping in real art later = mapping an id to a URL here,
// with a CREDITS.md row — no game-code changes.

// Sizes are generous on purpose — the board reads best when sprites fill it, and
// the whole UI is zoomed to fit the window (main.js applyUiScale), so larger
// base sizes just mean a bolder board rather than overflow.
const SIZE_TIERS = {
  small: { w: 92, h: 128, font: 44 },
  medium: { w: 132, h: 168, font: 58 },
  large: { w: 194, h: 206, font: 78 },
};

// Enemy id → size tier (display only; defaults to medium). Bosses & the biggest
// bruisers read 'large'; fast/fragile minions 'small'. All three acts tuned so
// no enemy falls back to the generic default.
const ENEMY_TIER = {
  // Act 1
  rotHound: 'small', graveWisp: 'small', wanderingSoldier: 'medium', demiBrute: 'medium',
  crucibleAspirant: 'large', watchfulOmen: 'large',
  // Act 2 — The Grafted Court
  courtMarionette: 'small', graftedHound: 'small', courtSurgeon: 'medium',
  gildedKnight: 'medium', livingArmor: 'medium', courtDuelist: 'large', graftedKing: 'large',
  // Act 3 — The Ashen Crown
  graceStarvedPilgrim: 'small', valkyrieShade: 'medium', ashRevenant: 'medium',
  charredColossus: 'large', crucibleLord: 'large', rotValkyrie: 'large',
};

// Enemy id → border tint (thematic: blood=Bleed, rot=Scarlet Rot, gold=elite/boss
// radiance, frost=armor, grace=spectral, ember=ash). Defaults to var(--line-soft).
const ENEMY_TINT = {
  // Act 1
  graveWisp: 'var(--grace)', rotHound: 'var(--rot)', crucibleAspirant: 'var(--gold)', watchfulOmen: 'var(--blood)',
  // Act 2
  gildedKnight: 'var(--gold)', courtSurgeon: 'var(--grace)', graftedHound: 'var(--blood)',
  courtMarionette: 'var(--rot)', livingArmor: 'var(--frost)', courtDuelist: 'var(--frost)', graftedKing: 'var(--gold)',
  // Act 3
  ashRevenant: 'var(--ember)', graceStarvedPilgrim: 'var(--grace)', valkyrieShade: 'var(--blood)',
  charredColossus: 'var(--ember)', crucibleLord: 'var(--gold)', rotValkyrie: 'var(--rot)',
};

/** Placeholder sprite: tinted rounded rect + glyph (+shadow), per style guide. */
export function enemySprite(enemyDef) {
  const tier = SIZE_TIERS[ENEMY_TIER[enemyDef.id] || 'medium'];
  const tint = ENEMY_TINT[enemyDef.id] || 'var(--line-soft)';
  const el = document.createElement('div');
  el.style.cssText = `width:${tier.w}px;height:${tier.h}px;border-radius:10px;` +
    `background:var(--panel);border:2px solid ${tint};display:flex;align-items:center;` +
    `justify-content:center;font-size:${tier.font}px;position:relative;` +
    `box-shadow:0 ${Math.round(tier.h * 0.08)}px 10px rgba(0,0,0,.5);`;
  el.textContent = enemyDef.art || '☠';
  return el;
}

// Character customization options (cosmetic — stored on run.customization).
export const PORTRAIT_GLYPHS = ['⚔', '🛡', '🔥', '🌙', '☀', '🐺'];
export const PORTRAIT_TINTS = [
  { id: 'gold', css: 'var(--gold)', name: 'Erdtree gold' },
  { id: 'ember', css: 'var(--ember)', name: 'Bloodflame ember' },
  { id: 'frost', css: 'var(--frost)', name: 'Carian frost' },
  { id: 'rot', css: 'var(--rot)', name: 'Scarlet rot' },
  { id: 'grace', css: 'var(--grace)', name: 'Lost grace' },
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
    `<text x="${cx}" y="${cy + 0.5}" font-size="11" fill="#e8dcc0" text-anchor="middle" dominant-baseline="central">${safe}</text>`
  );
}

const CLASS_SVG = {
  // Vagabond — armored knight, greatsword held point-down, cape behind.
  vagabond: (t, sigil) => `
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
  // Astrologer — robed mage, wide pointed hat, star-topped staff, sparkles.
  astrologer: (t, sigil) => `
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
  // Prophet — hooded pilgrim, halo, prayer beads at the waist.
  prophet: (t, sigil) => `
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
const SPRITE_TINT_IDS = ['gold', 'ember', 'frost', 'rot', 'grace'];
const SPRITE_CLASSES = ['vagabond', 'astrologer', 'prophet'];
function renderedSpriteUrl(classId, tintId) {
  if (!SPRITE_CLASSES.includes(classId)) return null;
  const t = SPRITE_TINT_IDS.includes(tintId) ? tintId : 'gold';
  return `assets/sprites/${classId}_${t}.png`;
}

/** A tinted class sprite (rendered PNG, SVG fallback), or null if unknown. */
export function classSprite(classId, tint, sigil, tintId) {
  const build = CLASS_SVG[classId];
  if (!build) return null;
  const el = document.createElement('div');
  el.className = 'class-sprite';
  el.style.cssText = 'width:150px;height:190px;display:flex;align-items:flex-end;justify-content:center;position:relative;';

  const fallbackToSvg = () => {
    el.innerHTML = build(tint, sigil);
    const svg = el.querySelector('svg');
    if (svg) {
      // The class SVGs hardcode 110×140; scale them to the (larger) container so
      // the player figure reads as boldly as the enemies (viewBox keeps ratio).
      svg.setAttribute('width', '150');
      svg.setAttribute('height', '190');
    }
  };

  const url = renderedSpriteUrl(classId, tintId);
  if (!url) {
    fallbackToSvg();
    return el;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = classId;
  img.style.cssText = 'width:150px;height:190px;object-fit:contain;image-rendering:auto;';
  img.addEventListener('error', fallbackToSvg); // dist / file:// → SVG
  el.appendChild(img);
  // The chosen sigil rides the rendered art as a chest medallion overlay.
  if (sigil) {
    const med = document.createElement('span');
    med.textContent = sigil;
    med.style.cssText =
      `position:absolute;left:50%;top:53%;transform:translate(-50%,-50%);` +
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
export function playerSprite(customization = {}, classId) {
  const tint = tintCss(customization.tint);
  if (spritesEnabled && CLASS_SVG[classId]) {
    return classSprite(classId, tint, customization.glyph, customization.tint);
  }
  const el = document.createElement('div');
  el.style.cssText =
    `width:150px;height:190px;border-radius:10px;background:#2a2418;border:2px solid ${tint};` +
    'display:flex;align-items:center;justify-content:center;font-size:70px;position:relative;' +
    `box-shadow:0 10px 12px rgba(0,0,0,.5), inset 0 0 24px rgba(0,0,0,.4);`;
  el.textContent = customization.glyph || '🛡';
  return el;
}

export function tintCss(tintId) {
  const t = PORTRAIT_TINTS.find((x) => x.id === tintId);
  return t ? t.css : 'var(--gold)';
}

export function classGlyph(classId) {
  return { vagabond: '⚔', astrologer: '☄', prophet: '☀' }[classId] || '❖';
}
