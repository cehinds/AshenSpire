// src/ui/components/tutorial.js — first-run combat callouts (SPEC §7.4, §9 M4)
//
// A one-time guided overlay (≤4 dismissible callouts) shown on the player's
// first combat. Spotlights each key element and explains it; the "seen" flag is
// persisted in meta settings (main.js) so it never shows twice. Steps whose
// target isn't on screen (e.g. a Staggered enemy has no intent) are skipped.

const STEPS = [
  { sel: '.energy-orb', title: 'Energy', text: 'Three energy each turn. Cards cost energy to play — spend it wisely.' },
  { sel: '.enemy-row .intent', title: 'Enemy intent', text: 'Enemies telegraph their next move. The number is the exact damage they will deal to you.' },
  { sel: '.hand .card', title: 'Play cards', text: 'Click a card or press 1–9. Attacks need a target — click an enemy, or drag the card onto it.' },
  { sel: '.end-turn', title: 'End your turn', text: 'Done? End Turn (or press E). Unspent energy and most Block are lost at your next turn.' },
];

export function mountTutorial(root, { onDone }) {
  const steps = STEPS.filter((s) => root.querySelector(s.sel));
  if (!steps.length) return onDone();

  const veil = document.createElement('div');
  veil.className = 'tut-veil';
  veil.innerHTML = `
    <div class="tut-spot"></div>
    <div class="tut-bubble">
      <div class="tut-title"></div>
      <p class="tut-text"></p>
      <div class="tut-row">
        <button class="subtle tut-skip">Skip</button>
        <button class="tut-next"></button>
      </div>
    </div>`;
  root.appendChild(veil);

  const spot = veil.querySelector('.tut-spot');
  const bubble = veil.querySelector('.tut-bubble');
  let i = 0;

  function show() {
    const step = steps[i];
    const target = root.querySelector(step.sel);
    if (!target) return next(); // vanished between filter and show
    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.style.left = `${r.left - pad}px`;
    spot.style.top = `${r.top - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;
    veil.querySelector('.tut-title').textContent = step.title;
    veil.querySelector('.tut-text').textContent = step.text;
    veil.querySelector('.tut-next').textContent = i === steps.length - 1 ? 'Got it' : `Next (${i + 1}/${steps.length})`;

    const bubbleW = 300;
    const bubbleH = 160;
    bubble.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - bubbleW - 12))}px`;
    bubble.style.top =
      r.bottom + 20 + bubbleH < window.innerHeight ? `${r.bottom + 20}px` : `${Math.max(12, r.top - bubbleH - 12)}px`;
  }

  function next() {
    i += 1;
    if (i >= steps.length) finish();
    else show();
  }

  function finish() {
    veil.remove();
    onDone();
  }

  veil.querySelector('.tut-next').addEventListener('click', next);
  veil.querySelector('.tut-skip').addEventListener('click', finish);
  show();
}
