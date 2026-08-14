// src/ui/screens/event.js — Unknown-node events (SPEC §5.6, §7.1)
//
// Choices run through executeRunEffects (the same DSL as everything else).
// A startCombat effect sets run.combatEntered; the orchestrator (main.js)
// launches it after the result text.

import { executeRunEffects } from '../../engine/actions.js';
import { esc } from '../components/tooltip.js';
import { isEngaged, focusFirst } from '../input.js';
import { isBindingChoice } from '../../model/consequence.js';
import { beatArmer } from '../components/holdconfirm.js';

export function mountEvent(app, { registries, run, meta, rng, eventId, onDone }) {
  const def = registries.events.get(eventId);
  // THE ONE DOOR. This screen no longer knows what a hold is, what the dial
  // says, or which choices deserve one — it names the action and hands over the
  // commit. `secondbeat.js` rules; `holdconfirm.js` performs. That is the whole
  // point of tonight: `armHold` used to have exactly one caller and it was this
  // line, which is how "same with ending turn" was lost.
  const arm = beatArmer(meta, registries);
  const disarmers = [];

  function meets(requires) {
    if (!requires) return true;
    if (typeof requires.cinders === 'number' && run.cinders < requires.cinders) return false;
    return true;
  }

  // `min(420px, 100%)`, NOT `420px` — Sten, 2026-08-14, on Marina's axisfit
  // ruling (event rows 15-18px, DEFECT, dated 2026-08-16). The bare 420 was a
  // desk width the narrow container never granted: `.screen`'s content box is
  // 385 local px at 390x844, so the centred column stuck 18px past the
  // scrollport's end edge (15 at 360x640, 17 at 412x915 — measured at 929b6ea
  // by tools/axisfit.mjs; these were the only red rows on this screen). The px
  // half is LAWFUL — a choice column's width is box geometry and answers to no
  // text setting (Law 4 clause 3) — the defect was the missing bound, so the
  // bound is what the fix adds (Law 2: named container, proven inside it).
  // The bars inside stretch to the column; their `min-height: var(--tap-floor)`
  // (button.ev-choice, ui.css) is untouched, so nothing shrinks under 44.
  app.innerHTML = `
    <div class="screen" style="gap:20px">
      <div class="event-art" style="font-size:56px">${esc(def.art || '❖')}</div>
      <h2 style="color:var(--gold);font-size:24px">${esc(def.name).toUpperCase()}</h2>
      <p style="max-width:560px;text-align:center;line-height:1.7;color:var(--parchment)">${esc(def.text)}</p>
      <div id="choices" style="display:flex;flex-direction:column;gap:10px;min-width:min(420px,100%)"></div>
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
    // A PRICE IS A CONTENT FACT AND THE SCREEN PUBLISHES IT, whether or not the
    // player can pay today. Vira's finding, and it is my own sentence back at
    // me — latent is not fixed.
    //
    // The lockout property is "a player who cannot perform a hold can still
    // leave every event screen", and that has to hold at EVERY purse. My
    // instrument was reading `disabled`, which is a fact about ONE MOUNTED
    // STATE: `meets()` below disables only an UNAFFORDABLE requirement, and
    // `balance.startingCinders` is 0, so the sweep mounts poor and the two
    // predicates happen to agree. They agreed via a number in balance.js that
    // nothing tied to them. Raise the purse and they diverge on three choices
    // (weepingPilgrim, sleepingSmith, merchantsGhost) — no verdict moved, which
    // is luck, not a guarantee.
    //
    // So the fact goes on the element, like `data-binding` beside it: a door
    // behind a price is not a door you can count on, at any purse, and the
    // instrument reads that off the screen instead of re-deriving it.
    // ---- BOTH CONTENT FACTS ARE WRITTEN HERE, ABOVE THE BRANCH, and the second
    // one is Vira handing me my own sentence back a second time: LATENT IS NOT
    // FIXED. I hoisted `data-requires` out of the affordability branch and
    // walked straight past its neighbour three lines below, in the same
    // function. `data-binding` was set only inside the AFFORDABLE branch, so an
    // unaffordable binding choice published NO `data-binding` — the screen
    // saying "not binding" about a choice that is.
    //
    // It changes nothing today: she checked rather than assumed, and the
    // priced-and-binding overlap is EMPTY across all 54 shipped choices; the
    // free-door test was safe regardless, because such a bar carries
    // `data-requires`. It is still the same defect, and the reason it is worth
    // the hoist is her breadcrumb, which I am keeping verbatim:
    //
    //   WHEN A FACT MOVES FROM A MODULE ONTO A SCREEN, ASK AT WHAT MOMENT IT IS
    //   WRITTEN. A `data-` attribute set inside a conditional branch is a STATE
    //   FACT WEARING A CONTENT FACT'S CLOTHES.
    //
    // So: whether this choice is priced, and whether it binds, are properties of
    // the ENTRY and are published unconditionally. What stays inside the branch
    // is only what is genuinely about this moment — the disabling, and the
    // arming of a gesture on a button nobody can press.
    if (choice.requires) btn.dataset.requires = '1';
    // WHICH BARS BIND IS DERIVED, never listed. `isBindingChoice` reads this
    // choice's own ops and the cards they name; author a twenty-first event with
    // a curse in it and the hold is already there.
    const binding = isBindingChoice(choice, registries);
    if (binding) btn.dataset.binding = '1';

    if (!meets(choice.requires)) {
      btn.disabled = true;
      btn.textContent += ' (cannot afford)';
    } else {
      const commit = () => {
        executeRunEffects({ run, registries, rng }, choice.effects);
        showResult(choice.resultText);
      };
      // WHETHER THIS BAR HOLDS IS NOT DECIDED HERE. `binding` is a
      // CHARACTERISTIC of the choice, derived from its own ops
      // (model/consequence.js); the beat is derived from that characteristic
      // (model/secondbeat.js). The HOLD hint, the fill, the dial and the "off"
      // position all moved into the machinery with it — a bar that cannot be
      // pressed still never gets armed, because this branch is the affordable
      // one and always was.
      disarmers.push(arm(btn, 'eventChoice', { ctx: { binding }, onConfirm: commit }));
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
