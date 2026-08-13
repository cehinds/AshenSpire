// src/ui/screens/customize.js — character creation: class selection, name,
// sigil + tint (cosmetic), keepsake (starting boon), seed.
//
// Everything chosen here lands on run.customization (cosmetics), the class id,
// and one keepsake whose run-level effects apply at run start (content/keepsakes.js).

import { LOCKED_CLASSES } from '../../content/index.js';
import { KEEPSAKES } from '../../content/keepsakes.js';
import { PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { statProjection } from '../../model/statProjection.js';
import { equipmentKitReceipt } from '../../model/loadout.js';
import { startingKitViews } from '../../model/startingKits.js';

export function mountCustomize(app, { registries, meta = {}, defaultSeedString, onBack, onStart }) {
  const state = {
    classId: 'reaver',
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: 'rendered',
    keepsakeId: 'none',
    startingKitId: null,
  };

  // WHY THIS MARKUP LOOKS THE WAY IT DOES — EldenSpire#29 slice 2, out of
  // Sunna's read of the fixed screen (2026-08-01): "reachable, and still not
  // finished." Three shapes here, and each answers one of her findings.
  //
  // 1. THE SCREEN NO LONGER SCROLLS — a child does. `.cz-scroll` holds
  //    everything that can go off the bottom and `.cz-actions` is its sibling,
  //    so the way OUT of character creation is on screen the moment the screen
  //    is. Measured before: BEGIN THE CLIMB arrived 374 device px below the fold
  //    at 390x844 with no footer and no affordance, on a screen that looks
  //    finished where it stops. The height of the bar is the buttons' own — see
  //    styles/ui.css for why there is no reserved length anywhere.
  //
  // 2. THE ORDER IS THE DECISIONS FIRST. `.cz-fields` now runs CLASS, KEEPSAKE,
  //    then the three cosmetics, and the identity pane (portrait + name + seed)
  //    comes after all of it in the DOM. Sunna measured 17% of the arrival
  //    screen going to a name most players never change and a seed most never
  //    read, above the only choice that changes the run, with keepsakes last and
  //    wholly below the fold. The wide layout keeps its authored framing
  //    (portrait left) through `row-reverse` — the one place where DOM order and
  //    visual order disagree, and it is named in the stylesheet, not hidden.
  //
  // 3. THE NAME FIELD HAS A NAME. It had no label element, no placeholder and no
  //    aria-label — measured, not inferred — while displaying "Forsaken" under a
  //    heading reading PREPARE YOUR FORSAKEN, so it read as an echo of the title
  //    rather than something you type in. A real <label for>, a placeholder that
  //    invites (the value starts EMPTY so the placeholder is actually reachable —
  //    a blank field already resolves to 'Forsaken' below, so nothing is lost),
  //    and `type="text"`, which is not cosmetic: input.js's FOCUS_SELECTOR
  //    matches `input[type="text"]` by ATTRIBUTE, so neither text field on this
  //    screen was reachable by the pad or keyboard cursor at all.
  //
  // NOT TOUCHED, deliberately: the 2-then-1 class card wrap. Sunna named it and
  // it is gated on Constantine's word, which he has not given.
  app.innerHTML = `
    <div class="screen customize">
      <div class="cz-scroll">
        <h2 class="cz-title">PREPARE YOUR FORSAKEN</h2>

        <div class="cz-cols">
          <div class="cz-fields">
            <div><p class="cz-label">CLASS</p><div id="cz-classes" class="class-row"></div></div>
            <div><p class="cz-label">STARTING KIT</p><div id="cz-kits" class="cz-opts"></div></div>
            <div><p class="cz-label">KEEPSAKE</p><div id="cz-keepsakes" class="cz-keepsakes"></div></div>
            <div><p class="cz-label">SIGIL</p><div id="cz-glyphs" class="cz-opts"></div></div>
            <div><p class="cz-label">TINT</p><div id="cz-tints" class="cz-opts"></div></div>
            <div><p class="cz-label">SPRITE</p><div id="cz-styles" class="cz-opts"></div></div>
          </div>

          <div class="preview-pane">
            <div id="cz-portrait" class="cz-portrait"></div>
            <details class="cz-stats"><summary>ATTRIBUTES &amp; RESOURCES</summary><div id="cz-stat-projection"></div></details>
            <label class="cz-label cz-name-label" for="cz-name">NAME</label>
            <input id="cz-name" class="cz-name" type="text" maxlength="16" spellcheck="false"
                   autocomplete="off" placeholder="Forsaken" value="">
            <label class="seed-line" for="seed-input">Seed <input id="seed-input" type="text" value="${esc(defaultSeedString)}"></label>
          </div>
        </div>
      </div>

      <div class="cz-actions">
        <button class="subtle" id="cz-back">Back</button>
        <button id="cz-start">BEGIN THE CLIMB</button>
      </div>
    </div>`;

  const $ = (s) => app.querySelector(s);

  function renderPortrait() {
    const p = $('#cz-portrait');
    p.style.borderColor = tintCss(state.tint);
    p.style.boxShadow = `0 0 34px color-mix(in srgb, ${tintCss(state.tint)} 35%, transparent)`;
    p.innerHTML = '';
    // With sprites on, preview the class figure you'll actually play; otherwise
    // the chosen sigil (which is what combat shows when sprites are off).
    const sprite = spritesAreEnabled() && state.spriteStyle !== 'glyph'
      ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, state.spriteStyle)
      : null;
    if (sprite) p.appendChild(sprite);
    else p.textContent = state.glyph;
    const preview = createRunState({ seed: 0, classId: state.classId, registries, startingKitId: state.startingKitId, profileMeta: meta });
    const projection = statProjection(registries, preview);
    const kit = equipmentKitReceipt(registries, preview.loadout, preview.class, preview.attributes, preview.equipmentProfileRuleSnapshot);
    const signature = registries.cards.get(registries.classes.get(preview.class).startingSignatureCard);
    const copies = registries.balance.equipment.roleCopies;
    $('#cz-stat-projection').innerHTML = projection.attributes.map((row) => `<span><b>${esc(row.shortLabel)}</b> ${row.value}</span>`).join('')
      + projection.derived.map((row) => `<div><b>${esc(row.label)}</b> ${esc(row.formula)}${row.note ? `<small>${esc(row.note)}</small>` : ''}</div>`).join('')
      + `<details class="cz-kit"><summary>Starting kit · ${registries.balance.startingDeckSize} cards</summary><ul>`
      + kit.map((row) => `<li><b>${esc(row.profile.displayName)}</b> ×${copies[row.role]} <span>${row.receipt.base}+${row.receipt.value - row.receipt.base}=${row.receipt.value} · ${esc(row.profile.damageSchool)}</span></li>`).join('')
      + `<li><b>${esc(signature.name)}</b> ×${copies.signature} <span>class signature</span></li></ul></details>`;
  }

  // ---- class row (real classes + locked M3 silhouettes) ----
  const classes = $('#cz-classes');
  const kitBox = $('#cz-kits');
  function renderKits() {
    const views = startingKitViews(registries, state.classId, meta);
    if (!views.some((row) => row.id === state.startingKitId)) state.startingKitId = (views.find((row) => row.baseline) || views[0]).id;
    kitBox.innerHTML = '';
    for (const kit of views) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cz-opt${kit.id === state.startingKitId ? ' chosen' : ''}`;
      button.dataset.startingKitId = kit.id;
      button.textContent = kit.label;
      button.addEventListener('click', () => {
        state.startingKitId = kit.id;
        renderKits();
        renderPortrait();
      });
      kitBox.appendChild(button);
    }
  }
  for (const cls of registries.classes.all()) {
    const el = document.createElement('div');
    el.className = 'class-pick cz-class';
    el.dataset.classId = cls.id;
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><div class="cp-body"><h3>${esc(cls.name)}</h3><p>${esc(cls.description || '')}</p><span class="chip">HP ${cls.maxHp} · ${registries.balance.startingDeckSize} cards</span></div>`;
    el.addEventListener('click', () => {
      state.classId = cls.id;
      state.startingKitId = null;
      classes.querySelectorAll('.cz-class').forEach((x) => x.classList.toggle('chosen', x === el));
      renderKits();
      renderPortrait();
    });
    classes.appendChild(el);
  }
  for (const cls of LOCKED_CLASSES) {
    const el = document.createElement('div');
    el.className = 'class-pick locked';
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><div class="cp-body"><h3>${esc(cls.name)}</h3><p>${esc(cls.description)}</p><span class="chip">ARRIVES IN ${esc(cls.milestone)}</span></div>`;
    classes.appendChild(el);
  }
  classes.querySelector('.cz-class').classList.add('chosen');
  renderKits();

  // ---- sigil + tint pickers ----
  const glyphBox = $('#cz-glyphs');
  PORTRAIT_GLYPHS.forEach((g, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt${i === 0 ? ' chosen' : ''}`;
    b.textContent = g;
    b.addEventListener('click', () => {
      state.glyph = g;
      glyphBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    glyphBox.appendChild(b);
  });
  const tintBox = $('#cz-tints');
  PORTRAIT_TINTS.forEach((t, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt tint${i === 0 ? ' chosen' : ''}`;
    b.style.background = t.css;
    // Law 3 clause 4: a native `title=` does not satisfy the tooltip floor —
    // touch and gamepad players never see one. A tint swatch is pure colour with
    // no text of its own, so it is the one option row here that says NOTHING
    // without this. `title` is kept for the desktop mouse habit, not relied on.
    b.title = t.name;
    attachTooltip(b, () => esc(t.name));
    b.addEventListener('click', () => {
      state.tint = t.id;
      tintBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    tintBox.appendChild(b);
  });

  // ---- sprite style (rendered art / classic silhouette / sigil glyph) ----
  const styleBox = $('#cz-styles');
  SPRITE_STYLES.forEach((st, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt style${i === 0 ? ' chosen' : ''}`;
    b.textContent = st.name;
    b.style.cssText = 'width:auto;padding:0 12px;font-size:12px;letter-spacing:.08em;';
    b.addEventListener('click', () => {
      state.spriteStyle = st.id;
      styleBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    styleBox.appendChild(b);
  });

  // ---- keepsakes ----
  const ksBox = $('#cz-keepsakes');
  KEEPSAKES.forEach((ks, i) => {
    const el = document.createElement('div');
    el.className = `cz-keepsake${i === 0 ? ' chosen' : ''}`;
    el.innerHTML = `<span class="ks-icon">${esc(ks.icon)}</span><div><b>${esc(ks.name)}</b><p>${esc(ks.desc)}</p></div>`;
    el.addEventListener('click', () => {
      state.keepsakeId = ks.id;
      ksBox.querySelectorAll('.cz-keepsake').forEach((x) => x.classList.toggle('chosen', x === el));
    });
    ksBox.appendChild(el);
  });

  const nameEl = $('#cz-name');
  nameEl.addEventListener('input', (ev) => {
    state.name = ev.target.value.trim() || 'Forsaken';
  });

  // ---- the pinned action row: tooltips (Law 3 clause 4) ----
  // Every one of these fires for hover AND for the pad/keyboard focus cursor —
  // attachTooltip listens for the gpfocus/gpblur input.js dispatches, which is
  // the half a native `title=` never reaches.
  //
  // THE BUMPER ANSWER, written down because clause 6 says an undefined context
  // is a defect found by the player's thumb: this screen has NO tab set. There
  // is no strip, no folded switcher, nothing that cycles. RB/LB therefore keep
  // their global bindings here and the answer is "nothing here" — stated, not
  // left to be discovered. The action row is two buttons reached by the focus
  // cursor, exactly as a vertical list is (clause 6's corollary).
  //
  // The number in the name tooltip is READ OFF THE FIELD, never typed: maxlength
  // lives in the markup above and a prose copy of it is a defect under Law 1
  // clause 2 even in a tooltip.
  attachTooltip(nameEl, () => `Your character's name — the one the death screen uses.<br>`
    + `Up to ${nameEl.maxLength} characters. Leave it blank and you climb as Forsaken.`);
  // The seed field's rules — length, vocabulary, the promise above, and the
  // refusal when the promise cannot be kept — all live in components/seedfield.js
  // and are read from engine/rng.js. The tooltip that used to be typed here is
  // now SEED_PROMISE, said by all three seed fields instead of one.
  const seed = attachSeedField($('#seed-input'));
  attachTooltip($('#cz-back'), () => 'Back to the title screen. Nothing here is saved.');
  // Names, never numbers, and computed at show time — so the pinned row is also
  // the answer to "what did I pick?" for a player whose choices have scrolled
  // out of sight above it. That is half the affordance the bar is here to be.
  // BEGIN THE CLIMB refuses while the seed is not a seed, and the reason is the
  // field's own sentence — one home, so the button and the field can never say
  // two different things. It is marked with `aria-disabled` + `data-refusal`
  // (never `disabled`, which would make it unfocusable and unaskable) so a
  // player who presses it hears why at the place they pressed.
  const seedRefusal = refusesWhen($('#cz-start'), () => seed.problem(), () => {
    const cls = registries.classes.all().find((c) => c.id === state.classId);
    const ks = KEEPSAKES.find((k) => k.id === state.keepsakeId);
    return `Begin the climb as <b>${esc(cls ? cls.name : state.classId)}</b>`
      + (ks && ks.id !== 'none' ? `, carrying <b>${esc(ks.name)}</b>.` : ', carrying no keepsake.')
      + '<br>Scroll up to change any of it.';
  });
  seed.onChange(() => seedRefusal());

  $('#cz-back').addEventListener('click', onBack);
  $('#cz-start').addEventListener('click', () => {
    if (seed.problem()) return; // the refusal already said why, at the button
    onStart({
      classId: state.classId,
      seedString: $('#seed-input').value.trim(),
      customization: { name: state.name, glyph: state.glyph, tint: state.tint, spriteStyle: state.spriteStyle },
      keepsakeId: state.keepsakeId,
      startingKitId: state.startingKitId,
    });
  });

  renderPortrait();
}
