// src/ui/screens/draft.js — Custom Climb "Draft" deck builder.
//
// Presents `rounds` rounds of `choices` cards from the class pool; the player
// picks one each round to add to their starting deck. Deterministic on the
// run's rng (stream 'cardRewards'), so a seed drafts the same offers.
//
// ON THE KIT: a page with the screen's banner (Eyebrow + Title·L), the round
// as a Subtitle, the offer as the kit's Cards in a row, and the tally as a
// StatPair.

import { renderCard } from '../components/card.js';
import { createCardInstance, createIdGen } from '../../model/state.js';
import { el, eyebrow, titleL, subtitle, statPair } from '../kit/index.js';

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

    const grid = el('div', { class: 'reward-row draft-grid' });
    app.replaceChildren(el('div', { class: 'screen draft' }, [
      eyebrow('Custom climb'),
      titleL('Draft your deck'),
      subtitle(`Pick ${round + 1} of ${rounds} — choose a card to add`),
      grid,
      statPair({ key: 'Drafted so far', value: String(picked.length), attrs: { id: 'draft-count' } }),
    ]));

    for (const id of offer) {
      const card = renderCard(registries, { instanceId: `preview_${id}`, cardId: id, upgraded: false }, {});
      card.addEventListener('click', () => {
        picked.push(createCardInstance(id, false, idGen));
        // Remove one copy from the pool so later rounds skew fresh.
        const idx = pool.indexOf(id);
        if (idx >= 0) pool.splice(idx, 1);
        round += 1;
        if (round >= rounds) onDone(picked);
        else renderRound();
      });
      grid.appendChild(card);
    }
  }

  renderRound();
}
