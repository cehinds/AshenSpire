// src/ui/assets.js — asset lookup + placeholder generator (SPEC §2.4)
//
// Every visual goes through here. M1 ships zero downloaded assets: everything
// renders as the style guide's placeholder recipe (tinted rounded rect +
// glyph + name). Swapping in real art later = mapping an id to a URL here,
// with a CREDITS.md row — no game-code changes.

import { armourMenuAsset } from '../model/paintedOutfitArt.js';
import { balance } from '../content/balance.js';
import { PAINTED_ENEMIES, EXPANSION_ENEMIES, ENEMY_POSES } from '../content/enemyArt.js';
import { medallionAnchor } from '../content/classArtAnchors.js';
import { DEFAULT_SPRITE_STYLE, SPRITE_STYLES } from '../model/spriteStyle.js';
import { createPaintedStage, paintedPresentation } from './paintedOutfits.js';
import { assetUrl } from './assetmap.js';
import { createEnemyPoseStage } from './enemyPoseStage.js';
import { createPoseStage, hasPoses, registerStage } from './services/PoseAnimator.js';

export { DEFAULT_SPRITE_STYLE, SPRITE_STYLES };

// Sprite size tiers (the display dimensions each enemy def's `size` selects) are
// data — content/balance.js → ui.spriteTiers. Sizes are generous on purpose: the
// board reads best when sprites fill it, and the whole UI is zoomed to fit the
// window (main.js applyUiScale), so larger base sizes mean a bolder board rather
// than overflow. These are non-text geometry and remain px when Text size
// changes; UI size still scales the containing application.
const SIZE_TIERS = balance.ui.spriteTiers;
const px = (value) => `${value}px`;

// ── WHICH WAY A FIGHTER LOOKS ────────────────────────────────────────────────
//
// A FIGHTER FACES ITS OPPONENT. That is the rule, and it is a per-SIDE fact
// because the two sides stand on opposite sides of the board: the player's zone
// is on the left, the enemy row on the right, so the player looks right and the
// enemies look left. Everything on a side looks the same way, and no surface
// decides it.
//
// THIS REVERSES A LITERAL READING OF AN EARLIER ASK, and the reversal is the
// point. Owner, 2026-09-04: "adjust so that all characters are facing the same
// direction (to the right)" — implemented here as one global `FACES = 'right'`.
// Applied to a board where the enemies stand to the RIGHT of the player, that
// turned every enemy to face away from the fight: the Blight Hound was drawn
// looking left, which is already correct for an enemy, and the global rule
// flipped it. Owner, 2026-09-05, looking at the result: "notices characters
// facing wrong way too". "The same direction" was a description of the symptom
// he wanted gone (figures pointing every which way), not a specification that
// survives contact with two opposing sides.
//
// The other half of the fact is per ASSET and lives with the rest of that
// asset's art facts (`artFaces` on the enemy def, beside `art`, `size` and
// `tint`): which way the painting or the render was drawn. Only the mismatch
// between what a side wants and how the asset was drawn is a flip, which is
// what the poses README already asks for — "Mirrored facings are a code flip,
// never a generated frame."
//
// `front` is not a third direction and never flips. A figure looking at the
// viewer has no left or right to turn: mirroring one only swaps which hand
// holds the sword. Most of the roster is front-facing, so most of it declares
// nothing and this rule leaves it exactly as drawn — the honest outcome, and
// the reason this is a per-asset fact rather than a blanket transform.
const SIDE_FACES = Object.freeze({ player: 'right', enemy: 'left' });

/**
 * spriteMirror(artFaces, side) — does this asset need flipping on this side?
 *
 * `side` defaults to 'enemy' because every caller today is an enemy sprite.
 * Player combat paintings and pose frames are already authored facing right and
 * the combat surface keeps them as drawn. Naming the side keeps this helper
 * ready for a future profile asset.
 */
export function spriteMirror(artFaces, side = 'enemy') {
  if (artFaces === 'front' || artFaces == null) return false;
  return artFaces !== SIDE_FACES[side];
}

/**
 * Enemy sprite: the Blender-rendered PNG when it exists
 * (assets/sprites/enemy_<id>.webp, tools/sprites-blender.py), else the style
 * guide's placeholder recipe (tinted rounded rect + glyph). New enemies with
 * no render yet fall back automatically — the img error handler swaps in the
 * placeholder, so content can ship art-less.
 */
export function enemySprite(enemyDef, entity = {}) {
  const unity = PAINTED_ENEMIES.includes(enemyDef.id);
  const expansion = EXPANSION_ENEMIES.includes(enemyDef.id);
  const posed = ENEMY_POSES.includes(enemyDef.id);
  const painted = posed || unity || expansion;
  const artFaces = painted ? 'left' : enemyDef.artFaces;
  const tier = SIZE_TIERS[enemyDef.size || 'medium'];
  const tint = enemyDef.tint || 'var(--line-soft)';
  const el = document.createElement('div');
  const placeholder = () => {
    el.innerHTML = '';
    // This drops the facing layer with the rest of the children, and that is
    // right rather than an omission: what replaces the art is a GLYPH, and
    // mirrored text reads as a rendering fault. A placeholder therefore always
    // draws as-drawn.
    el.style.cssText = `width:${px(tier.w)};height:${px(tier.h)};border-radius:10px;` +
      `background:var(--panel);border:2px solid ${tint};display:flex;align-items:center;` +
      `justify-content:center;font-size:${px(tier.font)};position:relative;` +
      `box-shadow:0 ${Math.round(tier.h * 0.08)}px 10px rgba(0,0,0,.5);`;
    el.textContent = enemyDef.art || '☠';
  };
  // THE MIRROR GETS ITS OWN LAYER, because every other element here is
  // something's animation target and a CSS animation on `transform` sits in a
  // HIGHER CASCADE ORIGIN than a normal declaration — inline styles included.
  // An animated transform REPLACES the inline one rather than composing, so
  // wherever the mirror sits, an animation reaching that element un-mirrors the
  // fighter for as long as it runs.
  //
  // The three elements that are NOT available, each ruled out by measurement:
  //   · the combatant frame outside this one — it carries the block badge and
  //     the resource meters, and mirroring those would flip a number.
  //   · this wrapper — `styles/combat.css` aims `hitflash`/`hit-enemy`,
  //     `wobble` and `crumble` at `.sprite > :first-child`, and this wrapper IS
  //     that first child. Driven on the board: hitflash took the wrapper to
  //     `matrix(1,0,0,1,12.8,0)`, wobble held `matrix(1,…)` for its whole
  //     550ms, and crumble interpolated -1 → -0.43, flipping THROUGH the
  //     mirror and ending the death animation facing the wrong way.
  //   · the `img` — `sprite-idle` (infinite) and `enemy-lunge` are aimed at
  //     `.combatant .sprite > img`. Those selectors are dead today, because
  //     the img is a grandchild of `.sprite` rather than a child, so the mirror
  //     would survive there by accident; the day that selector is repaired it
  //     would break, and it is already carded to be repaired.
  //
  // So: a layer between them that nothing selects. It carries the facing and
  // only the facing.
  el.style.cssText = `width:${px(tier.w)};height:${px(tier.h)};position:relative;`
    + 'display:flex;align-items:flex-end;justify-content:center;';
  const facing = document.createElement('div');
  // Same element name as the player figure's layer (classSprite(), and the
  // facing block in styles/ui.css) because it is the same mechanism. WHERE the
  // decision lives differs, and has to: an enemy's facing is a per-asset fact
  // and is set inline from `artFaces`, while the player's is one blanket
  // socket correction for a whole producer's output and stays a CSS rule with
  // its own removal condition. `data-facing` records the per-asset answer;
  // the player layer carries no such marker precisely because it has no
  // per-asset answer to record.
  facing.className = 'facing';
  facing.dataset.facing = spriteMirror(artFaces) ? 'mirrored' : 'as-drawn';
  facing.style.cssText = 'width:100%;height:100%;display:flex;align-items:flex-end;'
    + 'justify-content:center;'
    + (spriteMirror(artFaces) ? 'transform:scaleX(-1);' : '');
  const img = document.createElement('img');
  const original = assetUrl(`assets/sprites/enemy_${enemyDef.id}.webp`);
  img.src = posed ? assetUrl(`assets/enemy-poses/${enemyDef.id}_idle.png`)
    : unity ? assetUrl(`assets/enemies-unity/painted_${enemyDef.id}.png`)
    : expansion ? assetUrl(`assets/enemies-expansion/${enemyDef.id}.png`) : original;
  img.alt = enemyDef.name || enemyDef.id;
  img.style.cssText = `width:100%;height:100%;object-fit:contain;` +
    `filter:drop-shadow(0 ${Math.round(tier.h * 0.06)}px 8px rgba(0,0,0,.55));`;
  if (painted) {
    img.dataset.artSource = posed ? 'enemy-poses' : unity ? 'unity' : 'expansion';
    // Align the common foot line without cropping or stretching the frame.
    img.style.width = 'auto';
    img.style.height = '100%';
    img.style.maxWidth = 'none';
    img.style.transform = 'translateY(5.208333%)';
  }
  img.addEventListener('error', () => {
    delete facing.dataset.attackReady;
    if (img.dataset.artSource) {
      delete img.dataset.artSource;
      img.style.width = '100%'; img.style.height = '100%'; img.style.maxWidth = ''; img.style.transform = '';
      facing.dataset.facing = spriteMirror(enemyDef.artFaces) ? 'mirrored' : 'as-drawn';
      facing.style.transform = spriteMirror(enemyDef.artFaces) ? 'scaleX(-1)' : '';
      img.src = original;
    } else placeholder();
  });
  facing.appendChild(img);
  if (posed) {
    img.classList.add('enemy-pose-idle');
    const attack = img.cloneNode(false);
    attack.className = 'enemy-pose-attack';
    attack.alt = '';
    attack.setAttribute('aria-hidden', 'true');
    attack.style.position = 'absolute';
    attack.style.bottom = '0';
    // Add impact while keeping the shared foot line fixed during the pose swap.
    attack.style.transformOrigin = '50% 94.791667%';
    attack.style.transform = 'translateY(5.208333%) scale(1.05)';
    attack.src = assetUrl(`assets/enemy-poses/${enemyDef.id}_attack.png`);
    attack.addEventListener('load', () => {
      if (img.dataset.artSource === 'enemy-poses') facing.dataset.attackReady = 'true';
    });
    attack.addEventListener('error', () => { delete facing.dataset.attackReady; });
    facing.appendChild(attack);
    registerStage(el, createEnemyPoseStage(el, facing, img, enemyDef.id, entity));
  }
  el.appendChild(facing);
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
    //
    // THIS COUNTER-MIRROR STILL ASSUMES ITS ANCESTOR IS MIRRORED, which the
    // rendered path's overlay no longer has to (it sits outside the facing
    // layer). It cannot follow: this glyph is drawn INSIDE the figure's own
    // SVG, so it inherits whatever the facing layer does. In the
    // character-creation figure well, which cancels the facing, that makes this
    // glyph backwards — carded, not fixed here, because moving it out means
    // giving four hand-authored viewBoxes a chest anchor apiece. Only the
    // `classic` sprite style and the file:// fallback reach this path.
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

// Class sprites (assets/sprites/): one transparent WebP per class × accent
// tint. Missing/unloadable art falls back to the inline SVG silhouette, so the
// single-file dist and file:// play keep working with zero configuration.
//
// Art credit: these are NO LONGER Blender renders. They are AI-generated with
// ChatGPT Codex and cut out from the class concept art by
// tools/concept-cutout.mjs — see the note at the top of CREDITS.md. The enemy
// sprites in the same folder are still Blender output.
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

// THE CHEST MEDALLION, APPLIED WHATEVER THE STYLE DRAWS.
//
// It is a module-level helper rather than a closure inside classSprite()
// BECAUSE A CLOSURE IS ONLY REACHABLE FROM ONE FUNCTION, and that is exactly
// how it went missing twice. It was inline after the painted `img` (reachable
// from one style), then a closure over `el` (reachable from one function) —
// and then #740/#743 gave the painted outfits their own early return, and
// character creation began drawing `paintedPresentation()` directly. Both new
// figure paths returned before the closure could run, so the chosen sigil was
// invisible on the default figure AND at the surface where it is chosen. The
// caller hands in the frame; anything that draws a figure can ask for one.
//
// It used to be written inline after the painted `img`, which made it the
// ONE style that carried the player's chosen sigil: `animated` returns as
// soon as it has a pose stage, and since #700 `animated` is the default
// everywhere a character is made. So the sigil a player picked was invisible
// on the default figure — not because its anchor was missing but because the
// code path that draws it was never reached. A sigil is a fact about the
// CHARACTER, not about which art style renders them, so it hangs off the
// frame here and every style that shows a figure gets it.
//
// WHERE IT SITS IS PER CLASS AND MEASURED (src/content/classArtAnchors.js).
// It was one shared `top:53%` for all four, which is a claim that every
// figure keeps its chest at the same height — true of the Blender builders,
// one rig in four palettes, and false of four separately painted figures. At
// 53% the disc landed on the Starseer's face under the hat brim and inside
// the Herald's hood opening. No anchor means NO OVERLAY: a default would be
// the same shared assumption, and it would cover an unmeasured figure's face
// in silence rather than showing up as a missing medallion.
//
// NOT ON THE SVG FALLBACK PATH: that path no longer carries a sigil at all.
// `build()` is handed `null` where the chosen sigil used to go, so
// `sigilMedallion()` falls to its plain accent circle.
export function medallionOverlay(classId, tint, sigil) {
  const anchor = medallionAnchor(classId);
  if (!sigil || !anchor) return null;
  const med = document.createElement('span');
  // NO COUNTER-MIRROR, and its absence is the fix rather than an omission.
  // This used to carry `scaleX(-1)` to undo the mirror it inherited from
  // `.class-sprite` — right for the ART, wrong for a GLYPH, since mirrored
  // text reads as a rendering fault. But it hardcoded "my parent is
  // mirrored", and the character-creation figure well cancels that mirror,
  // so there the counter-mirror WAS the fault it was written to prevent.
  // The medallion sits outside the facing layer: it inherits no mirror, so
  // it needs no undoing, on any surface.
  //
  // A SHARE OF THE FRAME, NOT A PIXEL COUNT. 22px in a 190px frame was 11.6%
  // of it whatever the art did, which covered a full-body chest from collar
  // to forearm and is why three of the four anchors were once recorded as
  // unplaceable. 7% of the frame's height is a chest-sized jewel on these
  // figures and stays one in any frame this is drawn in. The glyph rides the
  // disc's own size (`cqh` against the disc as a container) so it cannot
  // drift out of proportion with it.
  med.style.cssText =
    `position:absolute;left:${anchor.x}%;top:${anchor.y}%;transform:translate(-50%,-50%);`
    + 'height:7%;aspect-ratio:1;border-radius:50%;background:#14100c;'
    + `border:1.5px solid ${tint};box-sizing:border-box;container-type:size;`
    + 'display:flex;align-items:center;justify-content:center;color:#e8dcc0;';
  // The glyph is its own element so the disc can be a size container: a
  // container's own font-size cannot be expressed in its own `cq` units.
  const mark = document.createElement('span');
  mark.textContent = sigil;
  mark.style.cssText = 'font-size:62cqh;line-height:1;';
  med.appendChild(mark);
  return med;
}

/** A painted figure in a frame that wears the character's sigil, or null.
 *
 * Character creation drew `paintedPresentation()` straight into the figure
 * well after #740/#743, and that returns a bare `<img>` — nothing an overlay
 * can hang off, so the surface where the player PICKS a sigil was the one
 * surface that never showed it. The frame and the medallion travel together
 * here rather than being re-assembled per caller.
 */
export function paintedFigure(classId, tint, sigil, armourId = 'default', pose = 'detail') {
  const art = paintedPresentation(classId, armourId, pose);
  if (!art) return null;
  const frame = document.createElement('div');
  frame.className = 'class-sprite painted-outfit';
  // Fills the well it is put in rather than classSprite()'s fixed 150x190:
  // the creation well is 16rem x 20rem and scales with Text size, and the
  // medallion is a share of whatever frame it lands in.
  frame.style.cssText = 'width:100%;height:100%;position:relative;';
  frame.appendChild(art);
  return frame;
}

// Player sprite styles: 'animated' (the default pose-stage figure), 'rendered'
// (the painted class figure, WebP), 'classic' (inline SVG silhouette), and
// 'glyph' (sigil-in-a-panel). Chosen per character.
// "Blender PNG" until 2026-09-03, which stopped being true when the class art
// was replaced — the same stale description as the lobby tooltip one file over.
/** A tinted class sprite (rendered PNG, SVG fallback), or null if unknown. */
export function classSprite(classId, tint, sigil, tintId, style, figureId, armourId = 'default') {
  const build = CLASS_SVG[classId];
  if (!build) return null;
  // THE SIGIL DOES NOT RIDE THE FIGURE. Owner's call, 2026-09-07: the chosen
  // sigil belongs beside the class information in the class picker — which is
  // where a player picks it and where it already draws — and nowhere on the
  // character. It was briefly worn as a chest medallion on every figure path,
  // combat included, and that is what this removes.
  //
  // Kept as a named no-op rather than deleted from three call sites, so the
  // decision reads at the paths that used to carry it instead of surviving
  // only in a commit message. `medallionOverlay()` is still exported and still
  // measured by tools/sigil-medallion.mjs; nothing on a FIGURE calls it.
  const applyMedallion = () => {};
  if (style === 'animated' || style === 'rendered') {
    const stage = createPaintedStage(classId, armourId);
    const art = stage?.el || paintedPresentation(classId, armourId);
    if (art) {
      const host = document.createElement('div');
      host.className = 'class-sprite painted-outfit' + (stage ? ' animated' : '');
      host.style.cssText = 'width:150px;height:190px;flex:0 0 auto;position:relative;';
      host.appendChild(art);
      if (stage) registerStage(host, stage);
      applyMedallion(host);
      return host;
    }
  }
  const el = document.createElement('div');
  el.className = 'class-sprite';
  el.style.cssText = 'width:150px;height:190px;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:center;position:relative;';

  // THE FACING LAYER, for the same reason enemySprite() has one: any orientation
  // correction must sit on an element that carries NOTHING ELSE. It used to
  // ride `.class-sprite` itself, which
  // is both an animation target and the overlay's positioning parent, and it
  // broke in both directions — measured on the board, not reasoned about:
  //
  //   · `.player .sprite.hitflash > :first-child` and `.wobble > :first-child`
  //     animate `transform` on `.class-sprite`, and an animation outranks a
  //     normal declaration, so the PLAYER FLIPPED TO FACE AWAY from the enemies
  //     for the length of every hit and every stagger:
  //         hitflash  matrix(-1,…) -> matrix(1,0,0,1,-12.82,0) -> matrix(1,…)
  //         wobble    matrix(1,0,0,1,0,0) … the whole 550ms unmirrored
  //   · `styles/kit.css` cancels the mirror in the character-creation figure
  //     well (`.as-artwell.figure .class-sprite { transform: none }`), and the
  //     sigil overlay below was counter-mirroring to undo a parent mirror that
  //     was no longer there — so the builder drew the chosen sigil BACKWARDS
  //     (measured: the medallion computed `matrix(-1,0,0,1,-11,-11)`).
  //
  // Now the art hangs off this layer and the sigil hangs off the frame, so the
  // facing applies to exactly the thing that has a facing.
  const facing = document.createElement('div');
  facing.className = 'facing';
  facing.style.cssText = 'width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center;';
  el.appendChild(facing);

  const fallbackToSvg = () => {
    // `null`, NOT `sigil`, and this is the other half of taking the sigil off
    // the character. Every SVG builder draws the value passed here through
    // sigilMedallion(), which paints it as a glyph ON THE FIGURE'S CHEST — so
    // the Classic sprite style, and any rendered figure that falls back to the
    // inline SVG, kept wearing the sigil after the overlay was removed.
    // sigilMedallion() already answers a plain accent circle for a falsy
    // sigil, which is exactly the pre-sigil silhouette.
    facing.innerHTML = build(tint, null);
    const svg = facing.querySelector('svg');
    if (svg) {
      // The class SVGs hardcode a 110×140 viewBox; fill the fixed-geometry
      // container (viewBox keeps ratio) so Text size cannot resize the figure.
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
    }
  };

  // 'animated': the default figure, changing pose from the shipped frames.
  // 'rendered' remains a separate painted still so an explicit choice never
  // swaps art styles mid-swing. A class with no shipped frames falls through
  // to the painting, so the default is never a blank figure.
  const outfitPoseId = armourId && armourId !== 'default' ? `${classId}-${armourId}` : classId;
  const poseId = hasPoses(outfitPoseId, tintId) ? outfitPoseId : classId;
  if (style === 'animated' && hasPoses(poseId, tintId)) {
    // figureId separates figures that would otherwise be the same rotation: two
    // co-op allies of the same class and tint shared one swing counter, so each
    // of them showed every other frame. Solo has one figure and needs no id.
    const stage = createPoseStage(poseId, tintId, figureId || undefined);
    if (stage) {
      el.classList.add('animated');
      // Inside the facing layer, like the painting: an animated figure has a
      // facing for exactly the same reason a still one does, and hanging the
      // stage off `.class-sprite` instead would leave it as the one style that
      // ignores the mirror. It also keeps the stage clear of the mirror in the
      // other direction — `.pose-layer` carries its own inline
      // `translateX(…)` to seat the pose's rotation anchor, and that is a
      // second transform on a second element rather than two facts fighting
      // over one. `stageFor()` searches DOWN from the combatant's `.sprite`,
      // so the extra layer does not hide the stage from it; the key still
      // rides `.class-sprite.animated`, which is what that search matches.
      facing.appendChild(stage.el);
      registerStage(el, stage);
      applyMedallion(el);
      return el;
    }
  }
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
  facing.appendChild(img);
  applyMedallion(el);
  return el;
}

/**
 * The player's combat figure: the class sprite when sprites are enabled (and the
 * class has one), else the chosen sigil glyph in a tinted panel.
 */
/**
 * equippedFigure({ classId, armourId, rightId, leftId, rightMirror, leftMirror })
 * → element | null.
 *
 * The figure as LAYERS: a bare-handed body in the armour set's palette, with
 * each held armament stacked over it. All of them are rendered on one shared
 * camera and canvas (tools/equipment-blender.py), which is what lets them be
 * absolutely positioned on top of each other and simply line up. The art is
 * currently authored at type-default sockets; the mirror flags are the
 * temporary per-slot correction until those layers are re-rendered neutral.
 *
 * Layering is why this is affordable at all: 12 armour sets × 24 armaments ×
 * 24 off-hands pre-rendered is six figures' worth of combinations, while one
 * PNG per piece is 36 files. Any layer that fails to load just removes itself,
 * so a missing asset degrades to a plainer figure rather than a broken one.
 */
export function equippedFigure({ classId, armourId, rightId, leftId, rightMirror = false, leftMirror = false }) {
  // NO PAINTED SHORT-CIRCUIT HERE, and the reason is the whole point of this
  // function. A `return paintedPresentation(classId, armourId, 'stand')` sat on
  // these two lines and returned a single standing frame, so the armament layers
  // below were never built: the Armoury drew your figure without the weapon or
  // shield you had equipped. `hand-side-probe` measured every one of the 25
  // armaments in both hands landing at the identical centroid — 50 findings, all
  // `drawn centre`, because there was no held piece on the figure to be drawn on
  // a side at all.
  //
  // It was also unreachable in the case it was written for, and harmful in the
  // case it did reach. The one call site left in the app, `figureFor` in
  // screens/equipment.js, already chooses painted art itself and returns before
  // calling here — but only when the player has NOT asked for `classic` or
  // `glyph` and sprites are on. So the only calls that arrived here were the
  // ones that had deliberately declined painted art, and this handed it back
  // anyway, overriding the sprite style the player chose. It defeated
  // `reacts === 'hands'` the same way, which sets `armourId` to `default`
  // precisely so the held pieces show.
  //
  // Painted presentation belongs at the call site that wants it, next to the
  // preference that decides it. This function composites equipment; that is the
  // only thing anything asks it for.
  if (!SPRITE_CLASSES.includes(classId)) return null;
  const el = document.createElement('div');
  el.className = 'equipped-figure';
  el.style.cssText = 'position:relative;width:100%;height:100%;';
  const layer = (src, z, mirror = false) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.style.cssText =
      `position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:${z};` +
      (mirror ? 'transform:scaleX(-1);' : '');
    img.addEventListener('error', () => img.remove());
    el.appendChild(img);
  };
  layer(assetUrl(`assets/equipment/body_${classId}_${armourId || 'default'}.webp`), 1);
  if (leftId) layer(assetUrl(`assets/equipment/weapon_${leftId}.webp`), 2, leftMirror);
  if (rightId) layer(assetUrl(`assets/equipment/weapon_${rightId}.webp`), 3, rightMirror);
  return el;
}

// Equipment art has one authored frame per outfit rather than six pose renders.
// Give it the same animation contract as a pose stage so an alternative outfit
// does not turn the fighter back into the default armour whenever combat moves.
// The transforms deliberately move the complete layered figure: body and held
// items remain registered, while the silhouette still reads as guard, swing,
// recoil, and idle at combat scale.
function animatedEquippedFigure(classId, equip) {
  const host = document.createElement('div');
  host.className = 'class-sprite animated equipped-sprite';
  host.style.cssText = 'width:150px;height:190px;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:center;position:relative;';
  host.dataset.pose = 'idle';

  const facing = document.createElement('div');
  facing.className = 'facing';
  facing.style.cssText = 'width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center;';
  facing.appendChild(equippedFigure({ classId, ...equip }));
  host.appendChild(facing);

  const attacks = ['attack1', 'attack2', 'attack3'];
  let attack = 0;
  let timer = null;
  const settle = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    host.dataset.pose = 'idle';
  };
  const stage = Object.freeze({
    el: host,
    poses: ['idle', 'guard', ...attacks, 'hit'],
    get pose() { return host.dataset.pose; },
    setPose(pose) {
      if (!this.poses.includes(pose)) return false;
      host.dataset.pose = pose;
      return true;
    },
    play(pose, ms = 260) {
      if (document.body.classList.contains('reduced-motion')) return false;
      if (pose === 'attack') {
        pose = attacks[attack % attacks.length];
        attack += 1;
      }
      if (!this.setPose(pose)) return false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, Math.max(60, ms));
      return true;
    },
    settle,
    warmed: [],
  });
  registerStage(host, stage);
  return host;
}

/**
 * playerSprite(customization, classId, armourId?) — the player's figure.
 *
 * Animated style selects the equipped armour's authored pose set when one is
 * shipped. Other styles keep using the single rendered class figure.
 */
// THE FIGURE YOU FIGHT AS IS THE FIGURE YOU PICKED. Until 2026-09-03 this took
// a third argument — the equipment spec — and, whenever the player had gear and
// the style was `rendered`, drew equippedFigure() instead: the low-poly Blender
// body in the armour set's palette with the held weapons composited on. That
// was the right call while the class art was ALSO Blender output. Once the
// class figures became paintings (#590) it meant the character builder showed
// one figure and the fight drew a different one, in a different style — and the
// Rogue's combat body was the Reaver's rig repainted, so two classes fought as
// the same shape. Owner's instruction: combat uses the class sprites.
//
// What this gives up, stated rather than hidden: the armour-set palette and the
// held-weapon overlay no longer show on the fighter. equippedFigure() still
// exists and the Armoury preview (screens/equipment.js) still calls it, so the
// composite is not dead — it is just no longer the combat figure.
export function playerSprite(customization = {}, classId, armourId = 'default') {
  const tint = tintCss(customization.tint);
  const style = customization.spriteStyle || DEFAULT_SPRITE_STYLE;
  if (spritesEnabled && style !== 'glyph' && CLASS_SVG[classId]) {
    return classSprite(classId, tint, customization.glyph, customization.tint, style, customization.figureId, armourId);
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

/* Inventory artwork uses item identity, never the character rig's artKey. */
export function equipmentCardArt(piece) {
  return assetUrl(piece.kind === 'armor'
    ? armourMenuAsset(piece.classId, piece.id)
    : `assets/equipment/icon_${piece.id}.webp`);
}
