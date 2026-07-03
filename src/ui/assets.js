// src/ui/assets.js — asset lookup + placeholder generator (SPEC §2.4)
//
// Every visual goes through here. M1 ships zero downloaded assets: everything
// renders as the style guide's placeholder recipe (tinted rounded rect +
// glyph + name). Swapping in real art later = mapping an id to a URL here,
// with a CREDITS.md row — no game-code changes.

const SIZE_TIERS = {
  small: { w: 70, h: 100, font: 34 },
  medium: { w: 100, h: 130, font: 44 },
  large: { w: 150, h: 160, font: 60 },
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

export function playerSprite(customization = {}) {
  const tint = tintCss(customization.tint);
  const el = document.createElement('div');
  el.style.cssText =
    `width:110px;height:140px;border-radius:10px;background:#2a2418;border:2px solid ${tint};` +
    'display:flex;align-items:center;justify-content:center;font-size:52px;position:relative;' +
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
