// src/ui/components/intro.js — boss-intro title card (SPEC §7.4 feel).
//
// A full-screen name splash when a boss fight begins: act tag, the boss's name
// in the display serif with a gold glow, a thin rule. Auto-dismisses after a
// beat; any click or key skips it. Reduced-motion collapses the animation (the
// global kill) but the card still reads. `hold` freezes it mid-animation for
// screenshots (?shot=boss).

import { esc } from './tooltip.js';

export function showBossIntro({ name, act }, { hold = false } = {}) {
  const veil = document.createElement('div');
  veil.className = 'boss-intro';
  veil.innerHTML = `
    <div class="bi-stack">
      <div class="bi-tag">ACT ${Number(act) || 1} · BOSS</div>
      <h1 class="bi-name">${esc(String(name || 'THE UNNAMED').toUpperCase())}</h1>
      <div class="bi-rule"></div>
    </div>`;
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
