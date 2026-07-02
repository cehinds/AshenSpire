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

// Enemy id → size tier (display only; defaults to medium).
const ENEMY_TIER = {
  rotHound: 'small',
  graveWisp: 'small',
  wanderingSoldier: 'medium',
  demiBrute: 'medium',
  crucibleAspirant: 'large',
  watchfulOmen: 'large',
};

const ENEMY_TINT = {
  graveWisp: 'var(--grace)',
  rotHound: 'var(--rot)',
  crucibleAspirant: 'var(--gold)',
  watchfulOmen: 'var(--blood)',
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

export function playerSprite() {
  const el = document.createElement('div');
  el.style.cssText =
    'width:110px;height:140px;border-radius:10px;background:#2a2418;border:2px solid var(--gold);' +
    'display:flex;align-items:center;justify-content:center;font-size:52px;position:relative;' +
    'box-shadow:0 10px 12px rgba(0,0,0,.5);';
  el.textContent = '🛡';
  return el;
}

export function classGlyph(classId) {
  return { vagabond: '⚔', astrologer: '☄', prophet: '☀' }[classId] || '❖';
}
