// src/ui/screens/draft.js — Custom Climb "Draft" deck builder.
//
// Presents `rounds` rounds of `choices` cards from the class pool; the player
// picks one each round to add to their starting deck. Deterministic on the
// run's rng (stream 'cardRewards'), so a seed drafts the same offers.

import { renderCard } from '../components/card.js';
import { createCardInstance, createIdGen } from '../../model/state.js';

export function mountDraft(app, { registries, classId, rng, rounds = 3, choices = 3, onDone }) {
  const pool = registries.classes.get(classId).cardPool.slice();
  const idGen = createIdGen('df');
  const picked = [];
  let round = 0;

  function renderRound() {
    // Offer `choices` distinct cards from the remaining pool.
    const offer = [];
    const local = pool.slice();
    for (let i = 0; i < choices && local.length; i++) {
      const id = rng.pick('cardRewards', local);
      local.splice(local.indexOf(id), 1);
      offer.push(id);
    }

    app.innerHTML = `
      <div class="screen" style="gap:18px">
        <h2 style="color:var(--gold);font-size:24px;letter-spacing:.15em">DRAFT YOUR DECK</h2>
        <p class="subtitle">PICK ${round + 1} OF ${rounds} — CHOOSE A CARD TO ADD</p>
        <div class="grid draft-grid" style="justify-content:center"></div>
        <p class="set-note">Drafted so far: <b id="draft-count">${picked.length}</b></p>
      </div>`;

    const grid = app.querySelector('.draft-grid');
    for (const id of offer) {
      const el = renderCard(registries, { instanceId: `preview_${id}`, cardId: id, upgraded: false }, {});
      el.addEventListener('click', () => {
        picked.push(createCardInstance(id, false, idGen));
        // Remove one copy from the pool so later rounds skew fresh.
        const idx = pool.indexOf(id);
        if (idx >= 0) pool.splice(idx, 1);
        round += 1;
        if (round >= rounds) onDone(picked);
        else renderRound();
      });
      grid.appendChild(el);
    }
  }

  renderRound();
}
