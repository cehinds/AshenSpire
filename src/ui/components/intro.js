// src/ui/components/intro.js — boss-intro title card (SPEC §7.4 feel).
//
// A full-screen name splash when a boss fight begins: act tag, the boss's name
// in the display serif with a gold glow, a thin rule. Auto-dismisses after a
// beat; any click or key skips it. Reduced-motion collapses the animation (the
// global kill) but the card still reads. `hold` freezes it mid-animation for
// screenshots (?shot=boss).

import { el, eyebrow, titleL, ornament } from '../kit/index.js';

export function showBossIntro({ name, act }, { hold = false } = {}) {
  // THE SPLASH IS THREE KIT ATOMS: the act as an Eyebrow, the boss as a
  // Title·L, and the Ornament that marks "something is being announced". The
  // case is CSS's — the string is never shouted (§02).
  const veil = el('div', { class: 'boss-intro' }, el('div', { class: 'bi-stack' }, [
    eyebrow(`Act ${Number(act) || 1} · Boss`, { class: 'bi-tag' }),
    titleL(String(name || 'The Unnamed'), { tag: 'h1', class: 'bi-name' }),
    ornament({ class: 'bi-rule' }),
  ]));
  document.body.appendChild(veil);

  if (hold) {
    // Screenshot mode: jump mid-animation and freeze.
    veil.querySelectorAll('*').forEach((el) => {
      el.style.animationDelay = '-600ms';
      el.style.animationPlayState = 'paused';
    });
    return veil;
  }

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    removeEventListener('keydown', onKey, true);
    veil.classList.add('bi-out');
    setTimeout(() => veil.remove(), 480);
  };
  const onKey = () => close();
  timer = setTimeout(close, 2300);
  veil.addEventListener('pointerdown', close);
  addEventListener('keydown', onKey, true);
  return veil;
}
