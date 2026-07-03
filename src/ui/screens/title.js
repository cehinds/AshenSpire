// src/ui/screens/title.js — animated main menu (SPEC §7.1)
//
// Ambient animation only (gold-glow pulse, drifting embers) — feedback
// animations stay ≤300 ms elsewhere; ambient loops respect
// prefers-reduced-motion (styles/ui.css).

export function mountTitle(app, { hasSave, onBegin, onContinue, onAbandon, onHistory }) {
  const embers = Array.from({ length: 7 }, (_, i) => {
    const left = 8 + ((i * 13.7) % 84);
    const delay = (i * 1.7) % 9;
    const dur = 7 + (i % 4) * 2;
    return `<span class="ember" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s"></span>`;
  }).join('');

  app.innerHTML = `
    <div class="screen title-screen">
      ${embers}
      <div class="title-stack">
        <h1 class="title-big title-glow">SPIRE OF THE ERDTREE</h1>
        <p class="subtitle" style="text-align:center">A ROGUELIKE DECKBUILDER</p>
      </div>
      <div class="title-menu">
        ${hasSave ? '<button id="continue-run">CONTINUE THE CLIMB</button>' : ''}
        <button id="begin-run">${hasSave ? 'NEW CLIMB' : 'BEGIN THE CLIMB'}</button>
        <button class="subtle" id="run-history">RUN HISTORY</button>
        ${hasSave ? '<button class="subtle" id="abandon-run">Abandon saved run</button>' : ''}
      </div>
      <p style="color:var(--muted);font-size:11px;letter-spacing:.15em">GRACE FLOWS UPWARD. FOLLOW IT.</p>
    </div>`;

  app.querySelector('#begin-run').addEventListener('click', onBegin);
  app.querySelector('#run-history').addEventListener('click', onHistory);
  if (hasSave) {
    app.querySelector('#continue-run').addEventListener('click', onContinue);
    app.querySelector('#abandon-run').addEventListener('click', onAbandon);
  }
}
