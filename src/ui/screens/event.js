// src/ui/screens/event.js — Unknown-node events (SPEC §5.6, §7.1)
//
// Choices run through executeRunEffects (the same DSL as everything else).
// A startCombat effect sets run.combatEntered; the orchestrator (main.js)
// launches it after the result text.

import { executeRunEffects } from '../../engine/actions.js';
import { esc } from '../components/tooltip.js';
import { isEngaged, focusFirst } from '../input.js';

export function mountEvent(app, { registries, run, rng, eventId, onDone }) {
  const def = registries.events.get(eventId);

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
      btn.addEventListener('click', () => {
        executeRunEffects({ run, registries, rng }, choice.effects);
        showResult(choice.resultText);
      });
    }
    box.appendChild(btn);
  });

  // Smart default (keyboard/gamepad): land on the first available choice.
  if (isEngaged()) setTimeout(() => focusFirst('#choices button'), 0);

  function showResult(text) {
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
