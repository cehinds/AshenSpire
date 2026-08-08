// src/ui/screens/event.js — Unknown-node events (SPEC §5.6, §7.1)
//
// Choices run through executeRunEffects (the same DSL as everything else).
// A startCombat effect sets run.combatEntered; the orchestrator (main.js)
// launches it after the result text.

import { executeRunEffects } from '../../engine/actions.js';
import { esc } from '../components/tooltip.js';
import { isEngaged, focusFirst } from '../input.js';
import { isBindingChoice } from '../../model/consequence.js';
import { armHold, holdMs } from '../components/holdconfirm.js';

export function mountEvent(app, { registries, run, meta, rng, eventId, onDone }) {
  const def = registries.events.get(eventId);
  // The dial, read once per mount. `holdConfirm` lives in balance.ui and this
  // screen restates none of it.
  const hold = holdMs((meta && meta.settings) || {}, registries.balance.ui.holdConfirm);
  const disarmers = [];

  function meets(requires) {
    if (!requires) return true;
    if (typeof requires.cinders === 'number' && run.cinders < requires.cinders) return false;
    return true;
  }

  app.innerHTML = `
    <div class="screen" style="gap:20px">
      <div class="event-art" style="font-size:56px">${esc(def.art || '❖')}</div>
      <h2 style="color:var(--gold);font-size:24px">${esc(def.name).toUpperCase()}</h2>
      <p style="max-width:560px;text-align:center;line-height:1.7;color:var(--parchment)">${esc(def.text)}</p>
      <div id="choices" style="display:flex;flex-direction:column;gap:10px;min-width:420px"></div>
    </div>`;

  const box = app.querySelector('#choices');
  def.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    // `ev-choice`, not a bare `.subtle`: these three bars are the only control
    // on this screen and the floor belongs to THEM, not to every subtle button
    // in the game. Law 4 is a ratchet, not a sweep — flooring `.subtle` would
    // be the blanket conversion the law tells nobody to attempt.
    btn.className = 'subtle ev-choice';
    // `style.fontSize = '13px'` was here, and it was Law 4 clause 1 backwards:
    // a px label does NOT answer the Text size control, while `.subtle`'s
    // `padding: 0.6rem` meant the BOX did. Text that will not grow inside a box
    // that will. The size now lives in the stylesheet in rem, where the one
    // question it answers is "how big is a letter".
    btn.dataset.choice = String(i);
    btn.style.animationDelay = `${i * 70}ms`; // staggered entrance
    btn.textContent = choice.label;
    if (!meets(choice.requires)) {
      btn.disabled = true;
      btn.textContent += ' (cannot afford)';
    } else {
      const commit = () => {
        executeRunEffects({ run, registries, rng }, choice.effects);
        showResult(choice.resultText);
      };
      // WHICH BARS GET THE HOLD IS DERIVED, never listed. `isBindingChoice`
      // reads this choice's own ops and the cards they name; author a
      // twenty-first event with a curse in it and the hold is already there.
      const binding = isBindingChoice(choice, registries);
      if (binding && hold > 0) {
        // THE INSTRUCTION IS ON SCREEN, not announced and not discovered. A
        // gesture a tired player has to find is a gesture they will fight; the
        // word is three letters and it costs the bar nothing.
        const hint = document.createElement('span');
        hint.className = 'hold-hint';
        hint.textContent = 'HOLD';
        btn.appendChild(hint);
        btn.dataset.binding = '1';
        disarmers.push(armHold(btn, { ms: hold, onConfirm: commit }));
      } else {
        if (binding) btn.dataset.binding = '1';
        btn.addEventListener('click', commit);
      }
    }
    box.appendChild(btn);
  });

  // Smart default (keyboard/gamepad): land on the first available choice.
  if (isEngaged()) setTimeout(() => focusFirst('#choices button'), 0);

  function showResult(text) {
    // Every armed bar is torn down before the box is emptied. `box.innerHTML =
    // ''` drops the buttons but NOT the window-level Escape listener each hold
    // owns, and a listener outliving its button is exactly the leak #22 was
    // about — one screen's worth is nothing, thirteen floors of it is not.
    while (disarmers.length) disarmers.pop()();
    box.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = 'max-width:560px;text-align:center;line-height:1.7;color:var(--muted);font-style:italic';
    p.textContent = text;
    const cont = document.createElement('button');
    cont.textContent = run.combatEntered ? 'STEEL YOURSELF' : 'CONTINUE';
    cont.addEventListener('click', onDone);
    box.appendChild(p);
    box.appendChild(cont);
    if (isEngaged()) setTimeout(() => focusFirst('#choices button'), 0);
  }
}
