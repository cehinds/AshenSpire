// src/ui/screens/customize.js — character creation: class selection, name,
// sigil + tint (cosmetic), keepsake (starting boon), seed.
//
// Everything chosen here lands on run.customization (cosmetics), the class id,
// and one keepsake whose run-level effects apply at run start (content/keepsakes.js).

import { LOCKED_CLASSES } from '../../content/index.js';
import { KEEPSAKES } from '../../content/keepsakes.js';
import { PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { focusElement } from '../input.js';
import { mountDisclosure } from '../components/disclosure.js';
import { creationBrief } from '../../model/creationBrief.js';
import { relicText } from '../components/card.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { statProjection } from '../../model/statProjection.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { renderEquipmentRequirements, renderPlayerPoise } from '../components/equipmentReceipts.js';
import { startingKitViews, startingArmourViews } from '../../model/startingKits.js';
import { creationMode, orderedAttributes, classAttributePreset, attributeAllocationProblems, allocationTotal, defaultCreationModeId } from '../../model/attributes.js';
import { equipmentRequirementReceipt } from '../../model/loadout.js';

export function mountCustomize(app, { registries, meta = {}, defaultSeedString, onBack, onStart }) {
  const state = {
    classId: 'reaver',
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: 'rendered',
    keepsakeId: 'none',
    startingKitId: null,
    // E5 (#250): the set you begin wearing, and how your stats are laid.
    // `attributes` is live only in pointbuy; in standard the preset is the
    // allocation and the model owns it (createRunState reads the preset when
    // `attributes` is not passed — one home, no copy here).
    startingArmourId: null,
    attributeMode: defaultCreationModeId(registries),
    attributes: null,
  };
  // THE PREVIEW'S ALLOCATION — the last LEGAL one. A pointbuy allocation is
  // illegal every moment the pool is part-spent (fixedTotal), and createRunState
  // rightly throws on it; a preview must never be built from a state the run
  // could not start from. The editor and the START refusal carry the mid-edit
  // truth; the receipts describe the run the last legal allocation would start.
  let previewAttributes = null;

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
  // 4. ALL SIX ROWS FOLD (E4 / #249, superseding MR-151/170/171/189's one-row
  //    scope — see "THE FOLD" below for why their reasons moved rather than
  //    died). The six wrappers and their `<p class="cz-label">`s written here
  //    are BUILD SCAFFOLDING: the pickers are constructed inside them, then
  //    one mountDisclosure over `.cz-fields` replaces the lot with six faces
  //    (label + current choice in words) and adopts every picker into the one
  //    reveal panel. CLASS arrives open — his words. The markup here is what
  //    the screen starts as, never what it arrives as.
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
            <!-- E5 (#250). Both rows arrive OPEN, and that is a ruling being
                 honoured rather than a fold being forgotten: MR-189 scopes the
                 fold to rows whose face buys words their options cannot, and
                 rows that CHANGE THE RUN never fold — "folding them would hide
                 the choosing behind a choice." Armour and stat points change
                 the run. MR-183 withdrew the length argument; vertical scroll
                 is the sanctioned cost. -->
            <div><p class="cz-label">STARTING ARMOUR</p><div id="cz-armours" class="cz-opts"></div></div>
            <div><p class="cz-label">STAT POINTS</p><div id="cz-statedit" class="cz-statedit"></div></div>
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
    const preview = createRunState({
      seed: 0, classId: state.classId, registries, startingKitId: state.startingKitId,
      startingArmourId: state.startingArmourId, attributeMode: state.attributeMode,
      // Standard passes no allocation — the model reads its own preset (one
      // home). Pointbuy passes the last LEGAL allocation; see previewAttributes.
      ...(state.attributeMode === 'pointbuy' && previewAttributes ? { attributes: { ...previewAttributes } } : {}),
      profileMeta: meta,
    });
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
    // The SAME two lines the Armoury strip prints (ui/screens/equipment.js
    // statsComparison) — same read model, same markup, one stylesheet home
    // (`.statproj-*`). They used to differ by a literal space here and a
    // <span> there, which is how the same block ended up separated on one
    // screen and welded on the other.
    $('#cz-stat-projection').innerHTML = `<div class="statproj-attributes">${projection.attributes.map((row) => `<span><b>${esc(row.shortLabel)}</b> ${row.value}</span>`).join('')}</div>`
      + `<div class="statproj-derived">${projection.derived.map((row) => `<div data-stat="${esc(row.id)}"><b>${esc(row.label)}</b><span>${esc(row.formula)}</span>${row.note ? `<small>${esc(row.note)}</small>` : ''}</div>`).join('')}</div>`
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
  // ---- E5 (#250): starting armour + stat points -------------------------
  // STARTING-ELIGIBLE ARMOUR = the class's free set plus every set this
  // profile has EARNED (model/startingKits.js, the same meta.unlocked ledger
  // the Armoury reads). A fresh profile sees one button; each prize won adds
  // one. No copy of that rule lives here.
  const armourBox = $('#cz-armours');
  function renderArmours() {
    const views = startingArmourViews(registries, state.classId, meta);
    if (!views.some((row) => row.id === state.startingArmourId)) {
      state.startingArmourId = (views.find((row) => row.free) || views[0]).id;
    }
    armourBox.innerHTML = '';
    for (const set of views) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cz-opt${set.id === state.startingArmourId ? ' chosen' : ''}`;
      button.dataset.startingArmourId = set.id;
      button.textContent = set.label;
      // Law 3 clause 4 — the blurb is the set's own authored sentence, read
      // from the row, never retyped.
      attachTooltip(button, () => esc(set.blurb || set.label));
      button.addEventListener('click', () => {
        state.startingArmourId = set.id;
        renderArmours();
        renderPortrait();
      });
      armourBox.appendChild(button);
    }
  }

  // THE STAT EDITOR. Every number on it is READ from the mode row in
  // content/attributes.js (pool, floor, ceiling, labels) — a figure typed here
  // would be a copy nothing syncs (Law 1 clause 2). His ruling, from the card:
  // 10 points; dropped points come back (fixedTotal does that by construction);
  // floor 8 is the reclaim limit; 15 caps creation, not the character (the
  // model already raises the ceiling by levelled points).
  const statBox = $('#cz-statedit');
  const POINTBUY = 'pointbuy';
  function pointbuyMode() { return creationMode(registries, POINTBUY); }
  function resetAttributes() {
    state.attributes = { ...classAttributePreset(registries, state.classId, POINTBUY) };
    previewAttributes = { ...state.attributes };
  }
  function remainingPoints() {
    const total = Object.values(state.attributes).reduce((a, b) => a + b, 0);
    return allocationTotal(registries, POINTBUY) - total;
  }
  /** The one sentence START refuses with, or null. Pool first, then the kit. */
  function statsProblem() {
    // No allocation yet (a pointbuy mode nobody has edited) is the preset by
    // construction — createRunState reads it from content — so nothing refuses.
    if (state.attributeMode !== POINTBUY || !state.attributes) return null;
    const remaining = remainingPoints();
    if (remaining !== 0) {
      return remaining > 0
        ? `${remaining} stat point${remaining === 1 ? '' : 's'} still to assign — every point lands before the climb.`
        : `${-remaining} stat point${remaining === -1 ? '' : 's'} over the pool — drop a stat to reclaim.`;
    }
    const problems = attributeAllocationProblems(registries, state.classId, POINTBUY, state.attributes);
    if (problems.length) return problems[0].msg;
    // A legal allocation can still starve the chosen kit: requirements are the
    // model's own receipt, asked here so the refusal lands at the button
    // instead of as a throw inside the preview.
    const kitRow = startingKitViews(registries, state.classId, meta).find((row) => row.id === state.startingKitId);
    for (const pieceId of (kitRow && kitRow.pieceIds) || []) {
      const piece = (registries.equipment.armaments || []).find((row) => row.id === pieceId);
      const receipt = equipmentRequirementReceipt(registries, piece, state.attributes);
      if (!receipt.ok) {
        const failed = receipt.failures[0];
        return `${piece.name || piece.id} needs ${failed.attributeId} ${failed.required} — you have ${failed.actual}.`;
      }
    }
    return null;
  }
  function renderStats() {
    const mode = pointbuyMode();
    statBox.innerHTML = '';
    // The mode chips — labels from the content rows, like the sprite chips.
    const chips = document.createElement('div');
    chips.className = 'se-modes';
    for (const m of registries.creationModes.all()) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `cz-opt se-mode${state.attributeMode === m.id ? ' chosen' : ''}`;
      chip.textContent = m.label;
      attachTooltip(chip, () => (m.id === POINTBUY
        ? `Lay your own stats: ${m.bonusPool} points over baseline ${m.baseline}.<br>`
          + `Floor ${m.minimum} — dropped points come back. Cap ${m.maximum} at creation; levels raise it later.`
        : 'The class’s authored allocation — pick and climb.'));
      chip.addEventListener('click', () => {
        if (state.attributeMode === m.id) return;
        state.attributeMode = m.id;
        if (m.id === POINTBUY && !state.attributes) resetAttributes();
        if (m.id === POINTBUY) previewAttributes = statsProblem() ? previewAttributes : { ...state.attributes };
        renderStats();
        renderPortrait();
        seedRefusal();
      });
      chips.appendChild(chip);
    }
    statBox.appendChild(chips);
    if (state.attributeMode !== POINTBUY) return;
    if (!state.attributes) resetAttributes();
    // Five rows and a pool line. Steppers refuse at the row's own edges with
    // aria-disabled (never `disabled` — an unfocusable control is unaskable).
    const remaining = remainingPoints();
    const pool = document.createElement('p');
    pool.className = 'se-pool';
    pool.textContent = `Points to assign: ${remaining}`;
    attachTooltip(pool, () => `${mode.bonusPool} over baseline ${mode.baseline}, floor ${mode.minimum}, cap ${mode.maximum} at creation.`);
    statBox.appendChild(pool);
    for (const def of orderedAttributes(registries)) {
      const row = document.createElement('div');
      row.className = 'se-row';
      const value = state.attributes[def.id];
      const atFloor = value <= mode.minimum;
      const atCeil = value >= mode.maximum || remaining <= 0;
      row.innerHTML = `<span class="se-name" title="${esc(def.label)}">${esc(def.shortLabel)}</span>`
        + `<span class="se-value">${value}</span>`;
      const mk = (sign, refused, tip) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'se-step';
        b.textContent = sign;
        if (refused) b.setAttribute('aria-disabled', 'true');
        attachTooltip(b, tip);
        b.addEventListener('click', () => {
          if (b.getAttribute('aria-disabled') === 'true') return;
          state.attributes[def.id] = value + (sign === '+' ? 1 : -1);
          if (!statsProblem()) previewAttributes = { ...state.attributes };
          renderStats();
          renderPortrait();
          seedRefusal();
        });
        return b;
      };
      row.appendChild(mk('−', atFloor,
        () => `−1 ${esc(def.label)} — floor ${mode.minimum}; a dropped point returns to the pool.`));
      row.appendChild(mk('+', atCeil,
        () => (remaining <= 0
          ? 'The pool is spent — drop another stat to reclaim a point.'
          : `+1 ${esc(def.label)} — cap ${mode.maximum} at creation; levels raise it later.`)));
      statBox.appendChild(row);
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
      // E5: a class carries its own armour rows and its own preset — both
      // choices are re-derived for the new class, exactly as the kit is.
      state.startingArmourId = null;
      if (state.attributeMode === POINTBUY) resetAttributes();
      classes.querySelectorAll('.cz-class').forEach((x) => x.classList.toggle('chosen', x === el));
      renderKits();
      renderArmours();
      renderStats();
      renderPortrait();
      seedRefusal();
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
  renderArmours();
  renderStats();

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

  // ---- THE FOLD, NOW THE WHOLE COLUMN (E4 / #249) -------------------------
  // Constantine, 2026-08-15, verbatim: "all the options to be panel buttons
  // that expand to show more details... the top menu (class) should be
  // expanded. once selected(short hold) then it collapses and the next section
  // auto opens... keep options minimum in detail with tool tips on hold or
  // hover." Filed as E4; dealt to this seat by Marina's wave-two (family
  // f30e1ca) as one pattern with B9/B10 and E2's shop bars.
  //
  // THIS SUPERSEDES MR-151/170/171/189's ONE-ROW SCOPE, AND THEIR REASONS MOVE
  // RATHER THAN DIE. MR-189 judged each row's fold on what its face buys in
  // words ON A STACKED SCREEN, where every other row sat open beside it — and
  // there it was right: folding KEEPSAKE hid the one choice that changes the
  // run behind a row reading `KEEPSAKE Nothing`. E4 replaces the stacked
  // screen with a TURN-TAKING one. Each section is auto-opened AT ITS TURN, so
  // its options get the glass they had when unfolded — nothing is hidden
  // behind a choice, it is scheduled — and after its turn the face is the
  // RECEIPT of the pick in words (`KEEPSAKE Old Cinder`), which is the exact
  // thing MR-171 measured as missing. SIGIL's face value is still the glyph:
  // his own sketch is `<icon> <option name>`, and the glyph IS that option's
  // name. tools/creationbrief.mjs's roster moved with this table (its rule:
  // one line here + one line there, red at both edges until both exist).
  //
  // THE GESTURES, per the recorded answer on the E4 row: TAP selects; HOLD /
  // HOVER explains (attachTooltip, the affordance this screen already speaks
  // on every face and option). His "short hold to select" is NOT built and NOT
  // discarded — the recorded answer defers it to a Settings option, and
  // settings.js is deliberately untouched from this lane while E3 serializes
  // that file under another seat. Wiring the option when that lane lands is
  // one listener swap in the advance below.
  //
  // ONE MOUNT, SIX ENTRIES — one panel at a time is the mount's own rule, so
  // "one section open" needs no coordination code. The mechanism's per-entry
  // live reveal is components/disclosure.js's E4 generalization; there is
  // still no fold code in this file, and tools/onefold.mjs still counts one.
  //
  // AUTO-ADVANCE IS A PICK, NEVER A TAP. Tapping a face only opens or closes
  // it — "can be re collapsed back", his message 4 — so a player can revisit
  // any section without being marched forward. Picking an OPTION inside the
  // open panel is what advances: the listener sits on the adopted box at the
  // bubbling tail, so every option's own state-writing handler has already run
  // when the faces refresh, and a locked option advances nothing.
  const SECTIONS = [
    { key: 'pick:class', label: 'CLASS', box: classes, tip: 'Choose who climbs. Tap a class to select it.',
      value: () => { const c = registries.classes.all().find((x) => x.id === state.classId); return c ? c.name : state.classId; } },
    { key: 'pick:kit', label: 'STARTING KIT', box: kitBox, tip: 'The gear you begin with. Tap to change it.',
      value: () => { const v = startingKitViews(registries, state.classId, meta).find((row) => row.id === state.startingKitId); return v ? v.label : '—'; } },
    { key: 'pick:keepsake', label: 'KEEPSAKE', box: ksBox, tip: 'One starting boon. Hold an option to read what it does.',
      value: () => { const k = KEEPSAKES.find((x) => x.id === state.keepsakeId); return k ? k.name : 'Nothing'; } },
    { key: 'pick:sigil', label: 'SIGIL', box: glyphBox, tip: 'The mark combat shows when sprites are off.',
      value: () => state.glyph },
    { key: 'pick:tint', label: 'TINT', box: tintBox, tip: 'Tap to change your colour.',
      value: () => (PORTRAIT_TINTS.find((t) => t.id === state.tint) || {}).name || '—' },
    { key: 'pick:sprite', label: 'SPRITE', box: styleBox, tip: 'How your figure is drawn on the board.',
      value: () => { const s = SPRITE_STYLES.find((x) => x.id === state.spriteStyle); return s ? s.name : '—'; } },
  ];
  const fields = app.querySelector('.cz-fields');
  fields.classList.add('cz-disc');
  // THE ROWS THE MOUNT DOES NOT TAKE ARE STILL THE SCREEN'S, AND THEY GO BACK
  // (E5 / #250 — the defect this repairs is mine, and it shipped nothing).
  //
  // `mountDisclosure` sets `host.innerHTML`, so mounting over `.cz-fields`
  // DESTROYS every row in it. The six sections survive because SECTIONS holds
  // their boxes by reference and the mount re-adopts them into its one panel.
  // STARTING ARMOUR and STAT POINTS are not in SECTIONS — deliberately, below
  // — so nothing held them and nothing brought them back: two rows this file
  // writes were absent from the document from 9676d9a to aefc356, on a screen
  // every gate called green.
  //
  // NEITHER ROW BECOMES A FACE. That is the design answer, and it is not the
  // one-line one:
  //   · MR-189's rule, still live in the comment beside their markup — a row
  //     that CHANGES THE RUN never folds, because folding it hides the
  //     choosing behind a choice. Armour and stat points change the run.
  //   · Vira's replay item (d): the stat editor is a MULTI-CLICK surface, not
  //     a pick-once choice. Every face here carries auto-advance — one pick
  //     inside the open panel opens the next section — so a stepper's first
  //     `+` would march a player off a row they had not finished. A face gives
  //     this row that semantics BY CONSTRUCTION; there is no opting out of it.
  // So both arrive OPEN, as themselves, under the fold row: the six picks read
  // as one compact chooser, and the two rows you EDIT sit below it.
  //
  // DERIVED, NEVER LISTED. The open set is *every row of `.cz-fields` that
  // does not hold a registered picker* — read off this template and SECTIONS,
  // so no third hand-written list exists to fall out of step with the other
  // two (Law 0 clause 4, which is the whole disease here). The derivation also
  // inverts the failure: a future row added to the markup with no SECTIONS
  // entry now APPEARS, open, instead of vanishing. Wrong-and-visible beats
  // absent-and-green.
  //
  // READ BEFORE THE MOUNT — after it runs the adopted pickers live in the
  // panel and no row contains its own box, so the test loses its referent.
  const openRows = [...fields.children].filter((row) => !SECTIONS.some((s) => row.contains(s.box)));
  const fold = mountDisclosure(fields, SECTIONS.map((row) => ({
    key: row.key, kind: 'pick', disclosure: 'face',
    face: { label: row.label, value: row.value() },
    reveal: { node: row.box, sense: row.tip },
  })));
  // ...and back into the host the mount just emptied, in the order the
  // template wrote them, after the fold row.
  for (const row of openRows) fields.appendChild(row);
  // One call after any pick — the faces are the screen's answer to "what did I
  // choose?", so they are re-read from `state`, never written twice.
  const refreshFolds = () => { for (const row of SECTIONS) fold.setValue(row.key, row.value()); };
  SECTIONS.forEach((row, i) => {
    // THE CURSOR'S CLAIM IS READ AT CAPTURE — before any option's own listener
    // can rebuild the box. KIT's does (renderKits), and after the rebuild the
    // `.gp-focus` element is detached: a document query at the bubbling tail
    // finds nothing and cannot tell "the pick came through the cursor" from
    // "no cursor was ever summoned". Decided the moment the press lands.
    let cursorWasInside = false;
    row.box.addEventListener('click', () => {
      const cursor = document.querySelector('.gp-focus');
      cursorWasInside = !!cursor && row.box.contains(cursor);
    }, true);
    row.box.addEventListener('click', (ev) => {
      // OWNERSHIP IS THE DISPATCH, NOT THE TREE (Vira's P1 on #288, found by
      // Codex). This listener sits ON row.box, so any event it hears travelled
      // through this box when it was dispatched — that is the whole ownership
      // question. The old `row.box.contains(picked)` re-asked it of the tree
      // as it stands NOW, and KIT is the one section whose own pick listener
      // rebuilds its box (renderKits) before this bubbling tail runs: the
      // clicked button was detached, contains() said no, and the flow stalled
      // at its second section on every kit pick.
      const picked = ev.target.closest('.cz-opt, .cz-class, .cz-keepsake');
      refreshFolds();
      if (!picked || picked.classList.contains('locked')) return;
      const next = SECTIONS[i + 1];
      if (next) fold.open(next.key); else fold.close();
      // A PICK THAT HIDES THE CURSOR'S ELEMENT OWES THE CURSOR A DESTINATION
      // (Vira's P2 on #288, found by Codex). The advance just stashed this row
      // — or renderKits detached its buttons outright — so a keyboard/pad
      // player's next Confirm would fall back to the first focusable, the
      // CLASS face, and march them back to section one on every pick. The
      // destination is the flow's own next step: the just-opened section's
      // current choice (or its first option) — so Confirm-Confirm walks the
      // whole flow accepting defaults — and BEGIN THE CLIMB when the flow
      // completes. A mouse pick with the cursor elsewhere transfers nothing:
      // a player who never summoned the cursor is not handed one.
      if (!cursorWasInside) return;
      const dest = next
        ? (next.box.querySelector('.chosen') || next.box.querySelector('.cz-opt, .cz-class, .cz-keepsake'))
        : app.querySelector('#cz-start');
      if (dest) focusElement(dest);
    });
  });
  // "the top menu (class) should be expanded" — his words, and the arrival
  // state creationbrief.mjs's roster names for exactly one key.
  fold.open('pick:class');

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
  // E5: the button refuses for the seed OR the stats, and each names itself —
  // the stat sentence is statsProblem()'s own, derived beside the editor.
  const seedRefusal = refusesWhen($('#cz-start'), () => seed.problem() || statsProblem(), () => {
    const cls = registries.classes.all().find((c) => c.id === state.classId);
    const ks = KEEPSAKES.find((k) => k.id === state.keepsakeId);
    return `Begin the climb as <b>${esc(cls ? cls.name : state.classId)}</b>`
      + (ks && ks.id !== 'none' ? `, carrying <b>${esc(ks.name)}</b>.` : ', carrying no keepsake.')
      + '<br>Scroll up to change any of it.';
  });
  seed.onChange(() => seedRefusal());

  $('#cz-back').addEventListener('click', onBack);
  $('#cz-start').addEventListener('click', () => {
    if (seed.problem() || statsProblem()) return; // the refusal already said why, at the button
    onStart({
      classId: state.classId,
      seedString: $('#seed-input').value.trim(),
      customization: { name: state.name, glyph: state.glyph, tint: state.tint, spriteStyle: state.spriteStyle },
      keepsakeId: state.keepsakeId,
      startingKitId: state.startingKitId,
      startingArmourId: state.startingArmourId,
      attributeMode: state.attributeMode,
      // Standard sends no allocation: the model's preset is the one home.
      ...(state.attributeMode === POINTBUY && state.attributes ? { attributes: { ...state.attributes } } : {}),
    });
  });

  renderPortrait();
}
