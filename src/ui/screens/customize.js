// Character creation: four progressive sections backed by validated content.

import { LOCKED_CLASSES } from '../../content/index.js';
import { PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { focusElement } from '../input.js';
import { mountDisclosure } from '../components/disclosure.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { statProjection, playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { startingKitViews, startingArmourViews } from '../../model/startingKits.js';
import { creationMode, orderedAttributes, classAttributePreset, attributeAllocationProblems, allocationTotal, defaultCreationModeId } from '../../model/attributes.js';
import { previewCompatibleHands, startingHandsRequirementFailure } from '../../model/loadout.js';
import {
  creationHandChoices, creationRelicChoices,
  selectStartingHand,
} from '../../model/characterCreation.js';
import { pieceChip } from './equipment.js';
import { relicText } from '../components/card.js';
import {
  primaryStatCard, resourceStrip, modeChoiceButton, spriteChoiceButton,
  tintChoiceButton, sigilChoiceButton, keepsakeChoiceButton, viewModeToggle,
  booleanSettingToggle, classChoiceCard, classPreviewPane, classResourceGrid, relicChoiceButton,
  selectionSectionFace,
} from '../components/creationCards.js';

export function mountCustomize(app, { registries, meta = {}, defaultSeedString, onBack, onStart, catalog = false }) {
  const firstClass = registries.classes.all()[0];
  const creationLayout = registries.characterCreation.layout || {};
  const state = {
    classId: firstClass.id,
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: 'rendered',
    keepsakeId: registries.characterCreation.keepsakes[0].id,
    startingKitId: null,
    startingHands: { leftHand: null, rightHand: null },
    startingArmourId: null,
    startingRelicId: firstClass.startingRelic,
    attributeMode: defaultCreationModeId(registries),
    attributes: null,
    classChoiceView: creationLayout.classChoiceView,
    equipmentChoiceView: creationLayout.equipmentChoiceView,
    classPreviewPercent: creationLayout.classPreviewPercent,
    equipmentAutoAdvance: creationLayout.equipmentAutoAdvance,
  };
  let previewAttributes = null;
  let pointBuyOverlay = null;
  let refreshSectionFaces = () => {};
  let refreshCharacterFaces = () => {};
  let refreshSpriteFaces = () => {};
  let refreshEquipmentFaces = () => {};
  const refreshFaces = () => { refreshSectionFaces(); refreshCharacterFaces(); refreshSpriteFaces(); refreshEquipmentFaces(); };
  let updateStartRefusal = () => {};

  app.innerHTML = `
    <div class="screen customize${catalog ? ' component-catalog' : ''}">
      <div class="cz-scroll">
        ${catalog ? '' : '<p class="cz-kicker">DIVIDED OATH</p>'}
        <h2 class="cz-title">${catalog ? 'CHARACTER CREATION COMPONENTS' : 'PREPARE YOUR FORSAKEN'}</h2>
        ${catalog ? '' : '<p class="cz-subtitle">Choose your path. The spire remembers.</p>'}
        ${catalog ? '<p class="cc-catalog-intro">Interactive production specimens for every creation section, nested disclosure, and reusable selector card.</p>' : ''}
        <div class="cz-flow cz-disc">
          <section id="cz-class-panel" class="cz-stage">
            <div class="cc-class-split" style="--cc-class-preview-share:${state.classPreviewPercent}%">
              <div id="cz-class-preview-host" class="cc-class-preview-host"></div>
              <button type="button" class="cc-class-divider" role="separator" aria-label="Resize class preview" aria-orientation="vertical" aria-valuemin="22" aria-valuemax="45" aria-valuenow="${state.classPreviewPercent}"></button>
              <div class="cc-class-selection">
                <header class="cc-stage-toolbar"><h3>CLASS SELECTION</h3><div id="cz-class-view-toggle"></div></header>
                <div id="cz-classes" class="class-row cc-choice-collection" data-view="${state.classChoiceView}"></div>
                <button type="button" class="cz-next" data-next="character">Continue to Character</button>
              </div>
            </div>
          </section>
          <section id="cz-character-panel" class="cz-stage">
            <div class="cc-character-grid" data-sprite-side="${esc(registries.characterCreation.spritePreviewSide)}">
              <div class="cc-stats-side">
                <label class="cc-name-row" for="cz-name"><span>NAME</span><input id="cz-name" class="cz-name" type="text" maxlength="16" spellcheck="false" autocomplete="off" value="Forsaken"></label>
                <div id="cz-character-fold" class="cc-character-fold cz-disc">
                  <section id="cz-primary-group" class="cc-character-picker">
                    <div id="cz-statedit" class="cz-statedit"></div>
                    <div id="cz-primary-stats" class="cc-primary-stats"></div>
                    <div id="cz-derived" class="cc-derived" aria-label="Derived resources"></div>
                  </section>
                  <section id="cz-sprite-group" class="cc-character-picker">
                    <div id="cz-styles" class="cz-opts"></div>
                    <div id="cz-sprite-fold" class="cc-sprite-fold cz-disc">
                      <section id="cz-sigil-group" class="cc-character-picker"><div id="cz-glyphs" class="cz-opts"></div></section>
                      <section id="cz-tint-group" class="cc-character-picker"><div id="cz-tints" class="cz-opts"></div></section>
                    </div>
                  </section>
                  <section id="cz-keepsake-group" class="cc-character-picker"><div id="cz-keepsakes" class="cz-keepsakes"></div></section>
                </div>
              </div>
              <div class="cc-preview-side">
                <div id="cz-portrait" class="cz-portrait" aria-label="Live character preview"></div>
              </div>
            </div>
            <button type="button" class="cz-next" data-next="equipment">Continue to Starting Equip</button>
          </section>
          <section id="cz-equipment-panel" class="cz-stage">
            <header class="cc-stage-toolbar"><h3>STARTING EQUIPMENT</h3><div class="cc-stage-tools"><div id="cz-auto-advance-toggle"></div><div id="cz-equipment-view-toggle"></div></div></header>
            <div id="cz-equipment-fold" class="cc-equipment-fold cz-disc"></div>
            <p class="cc-move-note">An armament is one carried object. Choosing it for the other hand moves it.</p>
            <button type="button" class="cz-next" data-next="seed">Continue to Seed</button>
          </section>
          <section id="cz-seed-panel" class="cz-stage">
            <label class="seed-line" for="seed-input">Seed <input id="seed-input" type="text" value="${esc(defaultSeedString)}"></label>
            <p class="cc-seed-note">The same seed produces the same climb.</p>
          </section>
        </div>
      </div>
      <div class="cz-actions">
        <button class="subtle" id="cz-back">Back</button>
        <button id="cz-start">Begin</button>
      </div>
    </div>`;

  const $ = (selector) => app.querySelector(selector);
  const classBox = $('#cz-classes');
  const statBox = $('#cz-statedit');
  const POINTBUY = 'pointbuy';
  const equipmentSections = registries.characterCreation.equipmentSections;
  const equipmentNodes = new Map();
  for (const section of equipmentSections) {
    const node = document.createElement('section');
    node.className = 'cc-equip-group';
    node.dataset.equipmentSection = section.id;
    const choices = document.createElement('div');
    choices.className = 'cc-card-selectors cc-choice-collection';
    choices.dataset.view = state.equipmentChoiceView;
    if (section.kind === 'armour') choices.id = 'cz-armours';
    else if (section.kind === 'relic') choices.id = 'cz-relics';
    else if (section.kind === 'hand') choices.id = `cz-${section.slot === 'leftHand' ? 'left' : 'right'}-hand`;
    else choices.id = `cz-${section.id}`;
    node.appendChild(choices);
    equipmentNodes.set(section.id, node);
  }
  let equipmentFold = null;

  function setClassPreviewPercent(percent) {
    state.classPreviewPercent = Math.max(22, Math.min(45, Math.round(percent)));
    $('.cc-class-split').style.setProperty('--cc-class-preview-share', `${state.classPreviewPercent}%`);
    const divider = $('.cc-class-divider');
    divider.setAttribute('aria-valuenow', String(state.classPreviewPercent));
  }

  const classDivider = $('.cc-class-divider');
  classDivider.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') setClassPreviewPercent(22);
    else if (event.key === 'End') setClassPreviewPercent(45);
    else setClassPreviewPercent(state.classPreviewPercent + (event.key === 'ArrowRight' ? 2 : -2));
  });
  classDivider.addEventListener('pointerdown', (event) => {
    if (matchMedia('(max-width: 760px)').matches) return;
    const split = $('.cc-class-split');
    const move = (moveEvent) => {
      const rect = split.getBoundingClientRect();
      setClassPreviewPercent(((moveEvent.clientX - rect.left) / rect.width) * 100);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    move(event);
  });

  function renderViewToggles() {
    $('#cz-class-view-toggle').replaceChildren(viewModeToggle(state.classChoiceView, (mode) => {
      state.classChoiceView = mode;
      renderClasses();
    }, 'Class choice view'));
    $('#cz-equipment-view-toggle').replaceChildren(viewModeToggle(state.equipmentChoiceView, (mode) => {
      state.equipmentChoiceView = mode;
      for (const node of equipmentNodes.values()) node.querySelector('.cc-card-selectors').dataset.view = mode;
      renderViewToggles();
    }, 'Starting equipment choice view'));
    $('#cz-auto-advance-toggle').replaceChildren(booleanSettingToggle('Auto-advance on valid choice', state.equipmentAutoAdvance, (value) => {
      state.equipmentAutoAdvance = value;
      renderViewToggles();
    }));
  }

  function baseKit() {
    const views = startingKitViews(registries, state.classId, meta);
    return views.find((row) => row.baseline) || views.find((row) => row.available) || views[0];
  }

  function armourChoices() {
    return startingArmourViews(registries, state.classId, meta).map((view) =>
      registries.equipment.armour.find((row) => row.classId === state.classId && row.id === view.id));
  }

  function resetAttributes() {
    state.attributes = { ...classAttributePreset(registries, state.classId, POINTBUY) };
    previewAttributes = { ...state.attributes };
  }

  function resetClassChoices() {
    const kit = baseKit();
    state.startingKitId = kit.id;
    state.startingHands = { leftHand: kit.leftHand || null, rightHand: kit.rightHand || null };
    state.startingArmourId = armourChoices()[0].id;
    state.startingRelicId = registries.classes.get(state.classId).startingRelic;
    if (state.attributeMode === POINTBUY) resetAttributes();
  }

  function pointbuyMode() { return creationMode(registries, POINTBUY); }
  function remainingPoints() {
    if (!state.attributes) return pointbuyMode().bonusPool;
    return allocationTotal(registries, POINTBUY) - Object.values(state.attributes).reduce((sum, value) => sum + value, 0);
  }
  function statsProblem() {
    let attributes = classAttributePreset(registries, state.classId, state.attributeMode);
    if (state.attributeMode === POINTBUY && state.attributes) {
      const remaining = remainingPoints();
      if (remaining !== 0) return remaining > 0
        ? `${remaining} stat point${remaining === 1 ? '' : 's'} still to assign.`
        : `${-remaining} stat point${remaining === -1 ? '' : 's'} over the pool.`;
      const problems = attributeAllocationProblems(registries, state.classId, POINTBUY, state.attributes);
      if (problems.length) return problems[0].msg;
      attributes = state.attributes;
    }
    const rejected = startingHandsRequirementFailure(registries, state.startingHands, attributes);
    if (rejected) return `${rejected.piece.name} needs ${rejected.failure.attributeId} ${rejected.failure.required} — you have ${rejected.failure.actual}.`;
    return null;
  }

  function previewRun() {
    const attributes = state.attributeMode === POINTBUY && previewAttributes
      ? previewAttributes
      : classAttributePreset(registries, state.classId, state.attributeMode);
    return createRunState({
      seed: 0, classId: state.classId, registries,
      startingKitId: state.startingKitId,
      startingHands: previewCompatibleHands(registries, state.startingHands, attributes),
      startingArmourId: state.startingArmourId,
      startingRelicId: state.startingRelicId,
      attributeMode: state.attributeMode,
      ...(state.attributeMode === POINTBUY && previewAttributes ? { attributes: { ...previewAttributes } } : {}),
      profileMeta: meta,
    });
  }

  function renderCharacterPreview() {
    const portrait = $('#cz-portrait');
    portrait.style.borderColor = tintCss(state.tint);
    portrait.style.boxShadow = `0 0 34px color-mix(in srgb, ${tintCss(state.tint)} 35%, transparent)`;
    portrait.innerHTML = '';
    const sprite = spritesAreEnabled() && state.spriteStyle !== 'glyph'
      ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, state.spriteStyle)
      : null;
    if (sprite) portrait.appendChild(sprite); else portrait.textContent = state.glyph;

    const run = previewRun();
    const projection = statProjection(registries, run);
    $('#cz-primary-stats').replaceChildren(...projection.attributes.map(primaryStatCard));
    const poise = playerPoiseThresholdReceipt(registries, run);
    const resources = resourceStrip(projection.derived, poise);
    $('#cz-derived').replaceChildren(...resources.childNodes);
    renderClassPreview();
  }

  function renderClassPreview() {
    const cls = registries.classes.get(state.classId);
    const run = previewRun();
    const projection = statProjection(registries, run);
    const sprite = spritesAreEnabled()
      ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, 'rendered')
      : null;
    const relic = registries.relics.get(state.startingRelicId || cls.startingRelic);
    const pane = classPreviewPane({
      cls, sprite,
      resources: classResourceGrid(projection.derived.slice(0, 5)),
      relic,
      relicDescription: relicText(relic, registries),
    });
    $('#cz-class-preview-host').replaceChildren(pane);
  }

  function renderModes() {
    statBox.innerHTML = '';
    const modes = document.createElement('div');
    modes.className = 'se-modes';
    for (const mode of registries.creationModes.all()) {
      const button = modeChoiceButton(mode, state.attributeMode === mode.id, () => {
        state.attributeMode = mode.id;
        if (mode.id === POINTBUY) {
          if (!state.attributes) resetAttributes();
          openPointBuy();
        } else {
          closePointBuy();
          previewAttributes = null;
        }
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      });
      modes.appendChild(button);
    }
    statBox.appendChild(modes);
  }

  function closePointBuy() {
    if (!pointBuyOverlay) return;
    pointBuyOverlay.remove();
    pointBuyOverlay = null;
  }

  function openPointBuy() {
    closePointBuy();
    const overlay = document.createElement('div');
    overlay.className = 'modal-veil cc-stat-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cc-stat-title');
    pointBuyOverlay = overlay;
    app.appendChild(overlay);

    const draw = () => {
      const focusedStep = overlay.querySelector('.se-step.gp-focus')
        || (overlay.contains(document.activeElement) ? document.activeElement.closest('.se-step') : null);
      const preservedFocus = focusedStep ? {
        statId: focusedStep.dataset.statId,
        action: focusedStep.dataset.statAction,
        dom: document.activeElement === focusedStep,
        cursor: focusedStep.classList.contains('gp-focus'),
      } : null;
      const mode = pointbuyMode();
      const remaining = remainingPoints();
      overlay.innerHTML = `<div class="modal cc-stat-modal"><h3 id="cc-stat-title">ASSIGN POINTS</h3>`
        + `<p class="se-pool">Points to assign: ${remaining}</p><div class="cc-allocation-rows"></div>`
        + `<div class="cc-stat-actions"><button type="button" class="subtle" data-stat-cancel>Standard</button><button type="button" data-stat-done>Done</button></div></div>`;
      const rows = overlay.querySelector('.cc-allocation-rows');
      for (const def of orderedAttributes(registries)) {
        const value = state.attributes[def.id];
        const row = document.createElement('div');
        row.className = 'se-row';
        row.innerHTML = `<span class="se-name" title="${esc(def.label)}">${esc(def.shortLabel)}</span>`;
        const minus = document.createElement('button');
        minus.type = 'button'; minus.className = 'se-step'; minus.textContent = '−';
        minus.dataset.statId = def.id; minus.dataset.statAction = 'decrease';
        minus.setAttribute('aria-label', `Decrease ${def.label}`);
        minus.setAttribute('aria-disabled', value <= mode.minimum ? 'true' : 'false');
        const number = document.createElement('span'); number.className = 'se-value'; number.textContent = value;
        const plus = document.createElement('button');
        plus.type = 'button'; plus.className = 'se-step'; plus.textContent = '+';
        plus.dataset.statId = def.id; plus.dataset.statAction = 'increase';
        plus.setAttribute('aria-label', `Increase ${def.label}`);
        plus.setAttribute('aria-disabled', value >= mode.maximum || remaining <= 0 ? 'true' : 'false');
        minus.addEventListener('click', () => {
          if (value <= mode.minimum) return;
          state.attributes[def.id] -= 1;
          if (!statsProblem()) previewAttributes = { ...state.attributes };
          draw(); renderCharacterPreview(); updateStartRefusal();
        });
        plus.addEventListener('click', () => {
          if (value >= mode.maximum || remaining <= 0) return;
          state.attributes[def.id] += 1;
          if (!statsProblem()) previewAttributes = { ...state.attributes };
          draw(); renderCharacterPreview(); updateStartRefusal();
        });
        row.append(minus, number, plus); rows.appendChild(row);
      }
      const done = overlay.querySelector('[data-stat-done]');
      refusesWhen(done, statsProblem, 'Apply these stats');
      done.addEventListener('click', () => {
        if (statsProblem()) return;
        previewAttributes = { ...state.attributes };
        closePointBuy(); renderCharacterPreview(); focusElement(statBox.querySelector('.se-mode.chosen'));
      });
      overlay.querySelector('[data-stat-cancel]').addEventListener('click', () => {
        state.attributeMode = defaultCreationModeId(registries);
        previewAttributes = null;
        closePointBuy(); renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      });
      if (preservedFocus) {
        const replacement = [...overlay.querySelectorAll('.se-step')].find((button) => (
          button.dataset.statId === preservedFocus.statId && button.dataset.statAction === preservedFocus.action
        ));
        if (replacement) {
          if (preservedFocus.dom) replacement.focus();
          if (preservedFocus.cursor) focusElement(replacement);
        }
      }
    };
    draw();
  }

  function renderClasses() {
    classBox.innerHTML = '';
    classBox.dataset.view = state.classChoiceView;
    for (const cls of registries.classes.all()) {
      const button = classChoiceCard(cls, {
        selected: cls.id === state.classId,
        visual: classGlyph(cls.id),
        onChoose: () => {
        if (state.classId === cls.id) return;
        state.classId = cls.id; resetClassChoices();
        renderClasses(); renderEquipment(); renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        },
      });
      classBox.appendChild(button);
    }
    for (const cls of LOCKED_CLASSES) {
      classBox.appendChild(classChoiceCard(cls, { locked: true, visual: classGlyph(cls.id) }));
    }
    renderViewToggles();
  }

  function renderAppearance() {
    const styleBox = $('#cz-styles');
    styleBox.innerHTML = '';
    for (const style of SPRITE_STYLES) {
      const button = spriteChoiceButton(style, style.id === state.spriteStyle, () => {
        state.spriteStyle = style.id; renderAppearance(); renderCharacterPreview(); refreshFaces();
      });
      styleBox.appendChild(button);
    }
    const tintBox = $('#cz-tints');
    tintBox.innerHTML = '';
    for (const tint of PORTRAIT_TINTS) {
      const button = tintChoiceButton(tint, tint.id === state.tint, () => {
        state.tint = tint.id; renderAppearance(); renderCharacterPreview(); refreshFaces();
      });
      tintBox.appendChild(button);
    }
    const glyphBox = $('#cz-glyphs');
    glyphBox.innerHTML = '';
    for (const glyph of PORTRAIT_GLYPHS) {
      const button = sigilChoiceButton(glyph, glyph === state.glyph, () => {
        state.glyph = glyph; renderAppearance(); renderCharacterPreview(); refreshFaces();
      });
      glyphBox.appendChild(button);
    }
    const keepsakeBox = $('#cz-keepsakes');
    keepsakeBox.innerHTML = '';
    for (const keepsake of registries.characterCreation.keepsakes) {
      const button = keepsakeChoiceButton(keepsake, keepsake.id === state.keepsakeId, () => {
        state.keepsakeId = keepsake.id; renderAppearance(); refreshFaces();
      });
      keepsakeBox.appendChild(button);
    }
  }

  function renderEquipment() {
    const armourBox = $('#cz-armours');
    armourBox.innerHTML = '';
    for (const piece of armourChoices()) {
      const button = pieceChip(registries, piece, { selected: piece.id === state.startingArmourId });
      button.dataset.startingArmourId = piece.id;
      button.setAttribute('aria-pressed', piece.id === state.startingArmourId ? 'true' : 'false');
      button.addEventListener('click', () => {
        state.startingArmourId = piece.id;
        renderEquipment(); renderCharacterPreview(); refreshFaces(); advanceEquipment('armour');
      });
      armourBox.appendChild(button);
    }
    for (const hand of ['leftHand', 'rightHand']) {
      const box = $(`#cz-${hand === 'leftHand' ? 'left' : 'right'}-hand`);
      box.innerHTML = '';
      for (const piece of creationHandChoices(registries, state.classId, hand)) {
        const button = pieceChip(registries, piece, { selected: state.startingHands[hand] === piece.id });
        button.dataset.hand = hand; button.dataset.armamentId = piece.id;
        button.setAttribute('aria-pressed', state.startingHands[hand] === piece.id ? 'true' : 'false');
        button.addEventListener('click', () => {
          state.startingHands = selectStartingHand(state.startingHands, hand, piece.id);
          renderEquipment(); renderCharacterPreview(); refreshFaces(); updateStartRefusal(); advanceEquipment(hand);
        });
        box.appendChild(button);
      }
    }
    const relicBox = $('#cz-relics');
    relicBox.innerHTML = '';
    for (const relic of creationRelicChoices(registries, state.classId)) {
      const button = relicChoiceButton(relic, relicText(relic, registries), relic.id === state.startingRelicId, () => {
        state.startingRelicId = relic.id;
        renderEquipment(); renderCharacterPreview(); refreshFaces(); advanceEquipment('relic');
      });
      relicBox.appendChild(button);
    }
    for (const section of equipmentSections.filter((row) => row.kind === 'slot')) {
      const box = equipmentNodes.get(section.id).querySelector('.cc-card-selectors');
      if (!box.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'cc-empty-slot';
        empty.textContent = 'No starting options in this build. Content added to this slot will appear here.';
        box.appendChild(empty);
      }
    }
    for (const node of equipmentNodes.values()) node.querySelector('.cc-card-selectors').dataset.view = state.equipmentChoiceView;
    refreshEquipmentFaces();
  }

  function advanceEquipment(sectionId) {
    if (!state.equipmentAutoAdvance || !equipmentFold) return;
    const index = equipmentSections.findIndex((section) => section.id === sectionId || section.slot === sectionId || section.kind === sectionId);
    const next = equipmentSections.slice(index + 1).find((section) => section.kind !== 'slot');
    if (!next) return;
    equipmentFold.open(next.id);
    queueMicrotask(() => focusElement(app.querySelector(`[data-face="${next.id}"]`)));
  }

  const selectedRow = (id, rows) => rows.find((row) => row.id === id);
  const spriteRows = [
    { key: 'sigil', label: 'SIGIL', node: $('#cz-sigil-group'), value: () => state.glyph },
    { key: 'tint', label: 'TINT', node: $('#cz-tint-group'), value: () => (
      selectedRow(state.tint, PORTRAIT_TINTS)?.name || state.tint
    ) },
  ];
  const spriteFold = mountDisclosure($('#cz-sprite-fold'), spriteRows.map((row) => ({
    key: row.key, kind: 'pick', disclosure: 'face',
    face: { label: row.label, value: row.value() },
    reveal: { node: row.node, sense: `Edit ${row.label.toLowerCase()}.` },
  })));
  refreshSpriteFaces = () => {
    for (const row of spriteRows) spriteFold.setValue(row.key, row.value());
  };

  const characterRows = [
    { key: 'primary', label: 'PRIMARY STATS', node: $('#cz-primary-group'), value: () => (
      selectedRow(state.attributeMode, registries.creationModes.all())?.label || state.attributeMode
    ) },
    { key: 'sprite', label: 'SPRITE', node: $('#cz-sprite-group'), value: () => (
      selectedRow(state.spriteStyle, SPRITE_STYLES)?.name || state.spriteStyle
    ) },
    { key: 'keepsake', label: 'KEEPSAKE', node: $('#cz-keepsake-group'), value: () => (
      selectedRow(state.keepsakeId, registries.characterCreation.keepsakes)?.name || state.keepsakeId
    ) },
  ];
  const characterFold = mountDisclosure($('#cz-character-fold'), characterRows.map((row) => ({
    key: row.key, kind: 'pick', disclosure: 'face',
    face: { label: row.label, value: row.value() },
    reveal: { node: row.node, sense: `Edit ${row.label.toLowerCase()}.` },
  })));
  refreshCharacterFaces = () => {
    for (const row of characterRows) characterFold.setValue(row.key, row.value());
  };
  characterFold.open('primary');

  const equipmentValue = (section) => {
    if (section.kind === 'armour') return registries.equipment.armour.find((row) => (
      row.classId === state.classId && row.id === state.startingArmourId
    ))?.name || 'None';
    if (section.kind === 'relic') return creationRelicChoices(registries, state.classId).find((row) => row.id === state.startingRelicId)?.name || 'None';
    if (section.kind === 'slot') return 'None';
    const id = state.startingHands[section.slot];
    return registries.equipment.armaments.find((row) => row.id === id)?.name || 'Empty';
  };
  const equipmentFaces = new Map(equipmentSections.map((section) => [
    section.id, selectionSectionFace(section.label, equipmentValue(section)),
  ]));
  equipmentFold = mountDisclosure($('#cz-equipment-fold'), equipmentSections.map((section) => ({
    key: section.id, kind: 'pick', disclosure: 'face',
    face: { node: equipmentFaces.get(section.id).node },
    reveal: { node: equipmentNodes.get(section.id), sense: `Choose ${section.label.toLowerCase()}.` },
  })));
  refreshEquipmentFaces = () => {
    for (const section of equipmentSections) equipmentFaces.get(section.id).setValue(equipmentValue(section));
  };
  equipmentFold.open(equipmentSections[0].id);

  resetClassChoices();
  renderClasses(); renderModes(); renderAppearance(); renderEquipment(); renderCharacterPreview(); renderViewToggles(); refreshFaces();

  const panels = {
    class: $('#cz-class-panel'), character: $('#cz-character-panel'),
    equipment: $('#cz-equipment-panel'), seed: $('#cz-seed-panel'),
  };
  const selectedName = (id, rows, fallback = '—') => (rows.find((row) => row.id === id) || {}).name || fallback;
  const sectionRows = [
    { key: 'class', label: 'CLASS', node: panels.class, value: () => registries.classes.get(state.classId).name },
    { key: 'character', label: 'CHARACTER', node: panels.character, value: () => state.name || 'Forsaken' },
    { key: 'equipment', label: 'STARTING EQUIP', node: panels.equipment, value: () => {
      const arms = registries.equipment.armaments;
      return `${selectedName(state.startingHands.leftHand, arms, 'Empty')} / ${selectedName(state.startingHands.rightHand, arms, 'Empty')}`;
    } },
    { key: 'seed', label: 'SEED', node: panels.seed, value: () => $('#seed-input').value.trim() || '—' },
  ];
  let fold = null;
  if (catalog) {
    const flow = $('.cz-flow');
    const fragment = document.createDocumentFragment();
    const appendCatalogItem = (row, kind) => {
      const article = document.createElement('article');
      article.className = 'cc-catalog-item';
      article.dataset.catalogComponent = row.key;
      const headingId = `cc-catalog-${row.key}`;
      article.innerHTML = `<header class="cc-catalog-head"><h3 id="${headingId}">${esc(row.label)}</h3><span>${esc(kind)}</span></header>`;
      row.node.setAttribute('aria-labelledby', headingId);
      article.appendChild(row.node);
      fragment.appendChild(article);
    };
    for (const row of sectionRows) appendCatalogItem(row, 'LIVE SECTION');

    const choiceSpecimen = (className, choices, idFor, renderer, initial) => {
      const host = document.createElement('div');
      host.className = `cc-catalog-specimen ${className}`;
      let selected = initial;
      const draw = () => host.replaceChildren(...choices.map((choice) => renderer(
        choice, idFor(choice) === selected, () => { selected = idFor(choice); draw(); },
      )));
      draw();
      return host;
    };
    const specimenRun = previewRun();
    const specimenProjection = statProjection(registries, specimenRun);
    const disclosureHost = document.createElement('div');
    disclosureHost.className = 'cc-character-fold cc-catalog-specimen cz-disc';
    const disclosureStat = document.createElement('div');
    disclosureStat.className = 'cc-character-picker';
    disclosureStat.appendChild(primaryStatCard(specimenProjection.attributes[0]));
    const disclosureKeepsake = document.createElement('div');
    disclosureKeepsake.className = 'cc-character-picker cz-keepsakes';
    disclosureKeepsake.appendChild(keepsakeChoiceButton(registries.characterCreation.keepsakes[0], true));
    const disclosureSpecimen = mountDisclosure(disclosureHost, [
      { key: 'sample-primary', kind: 'pick', disclosure: 'face', face: { label: 'PRIMARY STATS', value: 'Standard' }, reveal: { node: disclosureStat, sense: 'Edit primary stats.' } },
      { key: 'sample-keepsake', kind: 'pick', disclosure: 'face', face: { label: 'KEEPSAKE', value: registries.characterCreation.keepsakes[0].name }, reveal: { node: disclosureKeepsake, sense: 'Edit keepsake.' } },
    ]);
    disclosureSpecimen.open('sample-primary');
    const statHost = document.createElement('div');
    statHost.className = 'cc-primary-stats cc-catalog-specimen';
    statHost.append(...specimenProjection.attributes.map(primaryStatCard));
    const classChoiceSpecimen = document.createElement('div');
    classChoiceSpecimen.className = 'cc-class-selection cc-catalog-specimen';
    const classChoiceHost = document.createElement('div');
    classChoiceHost.className = 'class-row';
    classChoiceHost.dataset.view = 'list';
    for (const cls of registries.classes.all().slice(0, 2)) classChoiceHost.appendChild(classChoiceCard(cls, {
      selected: cls.id === state.classId, visual: classGlyph(cls.id),
    }));
    classChoiceSpecimen.appendChild(classChoiceHost);
    const previewRelic = registries.relics.get(state.startingRelicId);
    const classPreviewHost = classPreviewPane({
      cls: registries.classes.get(state.classId),
      sprite: classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, 'rendered'),
      resources: classResourceGrid(specimenProjection.derived.slice(0, 5)),
      relic: previewRelic,
      relicDescription: relicText(previewRelic, registries),
    });
    classPreviewHost.classList.add('cc-catalog-specimen');
    const viewToggleHost = viewModeToggle('list', (mode) => {
      viewToggleHost.replaceWith(viewModeToggle(mode, () => {}, 'Catalog view choice'));
    }, 'Catalog view choice');
    viewToggleHost.classList.add('cc-catalog-specimen');
    const autoAdvanceSpecimen = booleanSettingToggle('Auto-advance on valid choice', true, () => {});
    autoAdvanceSpecimen.classList.add('cc-catalog-specimen');
    const armourSpecimen = document.createElement('div');
    armourSpecimen.className = 'cc-card-selectors cc-catalog-specimen';
    armourSpecimen.dataset.view = 'list';
    armourSpecimen.appendChild(pieceChip(registries, armourChoices()[0], { selected: true }));
    const relicSpecimen = relicChoiceButton(previewRelic, relicText(previewRelic, registries), true);
    relicSpecimen.classList.add('cc-catalog-specimen');
    const selectionFaceSpecimen = selectionSectionFace('STARTING ARMOUR', 'Ashen Vigil').node;
    selectionFaceSpecimen.classList.add('cc-catalog-specimen');
    const specimens = [
      { key: 'character-disclosure', label: 'CHARACTER SUB-DISCLOSURE', node: disclosureHost },
      { key: 'class-preview-pane', label: 'CLASS PREVIEW PANE', node: classPreviewHost },
      { key: 'class-choice-card', label: 'CLASS CHOICE CARD', node: classChoiceSpecimen },
      { key: 'view-mode-toggle', label: 'LIST / GRID TOGGLE', node: viewToggleHost },
      { key: 'auto-advance-toggle', label: 'AUTO-ADVANCE TOGGLE', node: autoAdvanceSpecimen },
      { key: 'selection-section-face', label: 'SELECTION SUBCARD FACE', node: selectionFaceSpecimen },
      { key: 'primary-stat-card', label: 'PRIMARY STAT CARD', node: statHost },
      { key: 'resource-strip', label: 'RESOURCE STRIP', node: resourceStrip(
        specimenProjection.derived, playerPoiseThresholdReceipt(registries, specimenRun),
      ) },
      { key: 'mode-choice', label: 'STANDARD / ASSIGN POINTS', node: choiceSpecimen(
        'se-modes', registries.creationModes.all(), (row) => row.id, modeChoiceButton, state.attributeMode,
      ) },
      { key: 'sprite-choice', label: 'SPRITE CHOICE', node: choiceSpecimen(
        'cz-opts', SPRITE_STYLES, (row) => row.id, spriteChoiceButton, state.spriteStyle,
      ) },
      { key: 'tint-choice', label: 'TINT SWATCH', node: choiceSpecimen(
        'cz-opts', PORTRAIT_TINTS, (row) => row.id, tintChoiceButton, state.tint,
      ) },
      { key: 'sigil-choice', label: 'SIGIL CHOICE', node: choiceSpecimen(
        'cz-opts', PORTRAIT_GLYPHS, (glyph) => glyph, sigilChoiceButton, state.glyph,
      ) },
      { key: 'keepsake-choice', label: 'KEEPSAKE CARD', node: choiceSpecimen(
        'cz-keepsakes', registries.characterCreation.keepsakes, (row) => row.id, keepsakeChoiceButton, state.keepsakeId,
      ) },
      { key: 'equipment-choice-card', label: 'EQUIPMENT CHOICE CARD', node: armourSpecimen },
      { key: 'relic-choice-card', label: 'RELIC CHOICE CARD', node: relicSpecimen },
    ];
    for (const row of specimens) appendCatalogItem(row, 'REUSABLE COMPONENT');
    flow.replaceChildren(fragment);
  } else {
    fold = mountDisclosure($('.cz-flow'), sectionRows.map((row) => ({
      key: row.key, kind: 'pick', disclosure: 'face',
      face: { label: row.label, value: row.value() },
      reveal: { node: row.node, sense: `Edit ${row.label.toLowerCase()}.` },
    })));
    refreshSectionFaces = () => { for (const row of sectionRows) fold.setValue(row.key, row.value()); };
    fold.open('class');
  }

  app.querySelectorAll('.cz-next').forEach((button) => button.addEventListener('click', () => {
    if (catalog) {
      const target = app.querySelector(`[data-catalog-component="${button.dataset.next}"]`);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      focusElement(target?.querySelector('button, input'));
      return;
    }
    fold.open(button.dataset.next);
    const target = app.querySelector(`[data-face="${button.dataset.next}"]`);
    if (target) focusElement(target);
  }));

  const name = $('#cz-name');
  name.addEventListener('input', () => { state.name = name.value.trim() || 'Forsaken'; refreshFaces(); });
  attachTooltip(name, () => `Your character's name. Up to ${name.maxLength} characters.`);
  const seed = attachSeedField($('#seed-input'));
  seed.onChange(() => { refreshFaces(); updateStartRefusal(); });

  updateStartRefusal = refusesWhen($('#cz-start'), () => seed.problem() || statsProblem(), () => {
    const cls = registries.classes.get(state.classId);
    const keepsake = registries.characterCreation.keepsakes.find((row) => row.id === state.keepsakeId);
    return `Begin as <b>${esc(cls.name)}</b> with <b>${esc(keepsake.name)}</b>.`;
  });
  attachTooltip($('#cz-back'), () => 'Back to the title screen. Nothing here is saved.');
  $('#cz-back').addEventListener('click', onBack);
  $('#cz-start').addEventListener('click', () => {
    if (seed.problem() || statsProblem()) return;
    onStart({
      classId: state.classId,
      seedString: $('#seed-input').value.trim(),
      customization: { name: state.name, glyph: state.glyph, tint: state.tint, spriteStyle: state.spriteStyle },
      keepsakeId: state.keepsakeId,
      startingKitId: state.startingKitId,
      startingHands: { ...state.startingHands },
      startingArmourId: state.startingArmourId,
      startingRelicId: state.startingRelicId,
      attributeMode: state.attributeMode,
      ...(state.attributeMode === POINTBUY && state.attributes ? { attributes: { ...state.attributes } } : {}),
    });
  });
  updateStartRefusal();
}
