// src/ui/screens/customize.js — character creation: class selection, name,
// sigil + tint (cosmetic), keepsake (starting boon), seed.
//
// Everything chosen here lands on run.customization (cosmetics), the class id,
// and one keepsake whose run-level effects apply at run start (content/keepsakes.js).

import { LOCKED_CLASSES } from '../../content/index.js';
import { KEEPSAKES } from '../../content/keepsakes.js';
import { PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { mountDisclosure } from '../components/disclosure.js';
import { creationBrief } from '../../model/creationBrief.js';
import { relicText } from '../components/card.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { statProjection } from '../../model/statProjection.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { renderEquipmentRequirements, renderPlayerPoise } from '../components/equipmentReceipts.js';
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
  // 4. ONE OF THESE SIX ROWS IS FOLDED (MR-151, 2026-08-16; MR-171 took
  //    KEEPSAKE back out the same day and MR-189 took SIGIL and SPRITE out
  //    after them). The `<p class="cz-label">` for TINT is REPLACED at mount by
  //    a disclosure face carrying the same word plus the current choice IN
  //    WORDS; the picker itself is adopted into that face's reveal panel and
  //    starts hidden. CLASS, STARTING KIT, KEEPSAKE, SIGIL and SPRITE arrive
  //    open, exactly as this markup writes them. See "THE FOLD" below — the
  //    markup here is what the screen starts as, not what it arrives as.
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
            <!-- D26's SHORT FORM, and it is the DEFAULT view: starting stats,
                 starting armaments, nothing else. Everything that used to sit
                 here as prose is one tap down. The ATTRIBUTES & RESOURCES
                 details below keeps the full receipts and is now the third
                 tier, not the first — the panel
                 he called bad is still reachable, still exact, and no longer in
                 the way of picking a class. -->
            <section class="cz-brief" data-surface="creationBrief">
              <p class="cz-label">STARTING STATS</p>
              <div id="cz-brief-stats" class="cz-disc"></div>
              <p class="cz-label">STARTING ARMAMENTS</p>
              <div id="cz-brief-armaments" class="cz-disc"></div>
            </section>
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
    // THE SHORT FORM FIRST, and it is drawn from the same preview run the
    // receipts below use — one read of the run, two tiers of the same truth.
    const brief = creationBrief(registries, preview);
    // The relic's authored sentence is filled by the shared relic renderer
    // (#38's token rule); the model composes everything derivable and keeps no
    // copy of the token machinery.
    for (const entry of brief.armaments) {
      if (entry.kind !== 'relic') continue;
      entry.reveal.sense = relicText(registries.relics.get(entry.id), registries);
    }
    mountDisclosure($('#cz-brief-stats'), brief.stats, { moreLabel: 'more' });
    mountDisclosure($('#cz-brief-armaments'), brief.armaments, { moreLabel: 'more' });
    const projection = statProjection(registries, preview);
    const surface = equipmentSurfaceReceipt(registries, preview);
    const kit = surface.roles;
    const signature = surface.signature;
    const copies = surface.roleCopies;
    $('#cz-stat-projection').innerHTML = projection.attributes.map((row) => `<span><b>${esc(row.shortLabel)}</b> ${row.value}</span>`).join('')
      + projection.derived.map((row) => `<div><b>${esc(row.label)}</b> ${esc(row.formula)}${row.note ? `<small>${esc(row.note)}</small>` : ''}</div>`).join('')
      + renderEquipmentRequirements(surface.requirements)
      + renderPlayerPoise(surface.poise)
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
    // The chip's HP is the DERIVED total from the run's own home (state.js via
    // createRunState: class base + attribute tiers + kit gear), never bare
    // cls.maxHp — that is a component posing as a total, and it sat two scrolls
    // above a ledger saying 96 while claiming 84 (Bjorn's gate, 2026-08-14).
    // Same read the ledger stands on, default kit: the class's honest advert.
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><div class="cp-body"><h3>${esc(cls.name)}</h3><p>${esc(cls.description || '')}</p><span class="chip">HP ${createRunState({ seed: 0, classId: cls.id, registries, profileMeta: meta }).maxHp} · ${registries.balance.startingDeckSize} cards</span></div>`;
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
    // AND `attachTooltip` ANSWERS HOVER AND PAD-FOCUS ONLY — never a thumb. That
    // is why TINT is the row that stays folded: see "THE FOLD" below, where the
    // face is what finally says this colour's name on the glass, in words.
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

  // ---- THE FOLD (MR-151, narrowed by MR-171 and MR-189) ------------------
  // Constantine, 2026-08-16: "go ahead and allow the fold". He had already said
  // the stat descriptions "kind of suck"; D26 answered that for the preview
  // pane and left `.cz-fields` as six stacked rows, four of which are picked
  // once (or never) and then sit open for the rest of the screen. ONE of those
  // four folds, BY THE SAME MECHANISM — mountDisclosure, not a second renderer.
  // The extension is `reveal.node` in components/disclosure.js; there is no
  // fold code in this file, on purpose. A second one is what tools/onefold.mjs
  // counts and what handrenderers.mjs is still paying for on the hand.
  //
  // DEFAULT FOLDED, and that is the whole of his yes. The other reading —
  // "allow" as *available*, a fold that defaults open — leaves the arrival
  // screen exactly as long as the one he called bad, so it answers nothing.
  //
  // A ROSTER IS NOT A DECISION — IT IS FOUR DECISIONS WEARING ONE NAME. That is
  // Marina's own words ruling her own error (MR-189): a count of options is not
  // a count of legibility, so each row is judged on what its FACE BUYS IN
  // WORDS, and only one row buys anything.
  //
  //   TINT   5 unlabelled swatches → the face says `TINT Goldbough gold`. The
  //          current colour's NAME, to touch, FOR THE FIRST TIME. See the
  //          comment on the swatch above: a tint swatch is pure colour with no
  //          text of its own, and `attachTooltip` answers hover and pad-focus
  //          only. UNFOLDED, TINT ON A PHONE IS FIVE UNTITLED COLOUR BLOBS.
  //          (Viki, at e64e196: the fold is the first mechanism on this screen
  //          that tells a touch player the colour they are wearing.)
  //   SIGIL  6 glyphs → the face value is `state.glyph`, THE EMOJI AGAIN.
  //          Nothing in words, and it costs a tap on the one row you pick by
  //          look. OUT (MR-189).
  //   SPRITE 3 chips already reading Rendered / Classic / Sigil → the face
  //          repeats one of them. Nothing in words, a tap, and MORE vertical
  //          than it saves, because a 44 px face replaces a compact label.
  //          OUT (MR-189).
  //   KEEPSAKE  four tiles carrying NAME AND EFFECT in plain words ('Old Cinder
  //          · Begin the climb with 50 cinders') became one row reading
  //          `KEEPSAKE Nothing`, and it is the only one of the four that
  //          changes the run. OUT (MR-170/171); measured tiles painted 4 → 0.
  //
  // WHAT IS NOT FOLDED, and it is a decision, not an omission: CLASS, STARTING
  // KIT, KEEPSAKE, SIGIL and SPRITE. The first three change the run and are what
  // the arrival screen is FOR; folding them would hide the choosing behind a
  // choice. The last two say in their own options everything a face could say.
  //
  // THIS IS NOT A LENGTH ARGUMENT, and the length argument is WITHDRAWN
  // (MR-183): none of Constantine's 47 quoted directions names length, D26's
  // words are about CLUTTER, and his nearest adjacent words sanction vertical
  // scrolling. The metric this fold answers is the one tools/creationbrief.mjs
  // prints — OPTIONS OFF THE GLASS BEHIND FACES. Do not re-argue it in pixels.
  //
  // IT REFOLDS AS TWO LINES, ON PURPOSE. Constantine has been told, not asked,
  // and his veto is free: putting any row back is one row in the table below
  // plus one row in tools/creationbrief.mjs's roster — and creationbrief goes
  // RED at both edges until the second line is written, so the two cannot
  // drift apart. Nothing else on this screen needs touching either way.
  const FOLDED = [
    { key: 'pick:tint', label: 'TINT', box: tintBox, tip: 'Tap to change your colour.',
      value: () => (PORTRAIT_TINTS.find((t) => t.id === state.tint) || {}).name || '—' },
  ];
  for (const row of FOLDED) {
    // The host is the row wrapper `.cz-fields` already has — its <p class label>
    // is replaced by the face, which carries the same word plus the answer.
    const host = row.box.parentElement;
    host.classList.add('cz-disc');
    const mount = mountDisclosure(host, [{
      key: row.key, kind: 'pick', disclosure: 'face',
      face: { label: row.label, value: row.value() },
      reveal: { node: row.box, sense: row.tip },
    }]);
    row.refresh = () => mount.setValue(row.key, row.value());
  }
  // One call after any pick — the faces are the screen's answer to "what did I
  // choose?", so they are re-read from `state`, never written twice.
  const refreshFolds = () => { for (const row of FOLDED) row.refresh(); };
  for (const row of FOLDED) {
    row.box.addEventListener('click', refreshFolds);
  }

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
