// Character creation: four progressive sections backed by validated content.
//
// ON THE KIT. The screen is a page door (§05 without the veil): the head
// names it, the body scrolls, the foot carries Back and Begin on the button
// ladder and never leaves the glass. Every section is a Pane; the class
// chooser is a Split (preview pane, handle, OptionCards in a list or a grid);
// the character's name and seed are Row·setting fields; modes and sprite
// styles are Segmented; sigils and tints are Swatches; keepsakes, relics and
// classes are OptionCards; primary stats are the D26 fold faces carrying kit
// Rows; and the point-buy is the md door through the one door-opener. The
// hooks the instruments read (`.screen.customize`, `.cz-scroll`, `.cz-actions`,
// `#cz-start`, `#cz-back`, `.cz-portrait`, `#cz-classes`, `.cc-class-*`,
// `#cz-statedit .se-mode`, `.cc-stat-overlay`, `#seed-input`…) ride on the kit
// elements and draw nothing of their own.

import { LOCKED_CLASSES } from '../../content/index.js';
import { DEFAULT_SPRITE_STYLE, PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { focusElement } from '../input.js';
import { mountDisclosure } from '../components/disclosure.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { statProjection, playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { startingKitViews, startingArmourViews } from '../../model/startingKits.js';
import { creationMode, orderedAttributes, classAttributePreset, attributeAllocationProblems, allocationTotal } from '../../model/attributes.js';
import { previewCompatibleHands, startingHandsRequirementFailure } from '../../model/loadout.js';
import {
  creationModeViews, creationEquipmentSectionViews, creationRelicChoices,
  selectStartingHand,
} from '../../model/characterCreation.js';
import { pieceChip } from './equipment.js';
import { relicText } from '../components/card.js';
import { renderStatAllocationCard } from '../components/statAllocationCard.js';
import { renderEquipmentRequirements, renderPlayerPoise, renderRoleCopies } from '../components/equipmentReceipts.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import {
  primaryStatCard, primaryStatCards, resourceStrip, modeChoiceButton, spriteChoiceButton,
  tintChoiceButton, sigilChoiceButton, keepsakeChoiceButton, viewModeToggle,
  booleanSettingToggle, classChoiceCard, classPreviewPane, classResourceGrid, relicChoiceButton,
  selectionSectionFace,
} from '../components/creationCards.js';
import {
  el, eyebrow, titleS, subtitle, flavour, hairline, artWell, options, row, labelStack,
  button, buttonRow, modalHead, modalFooter, pane,
} from '../kit/index.js';

/** A section's head: Eyebrow + Title·S on the left, its controls on the right. */
function sectionHead(kicker, title, trail = []) {
  return el('div', { class: 'as-pane-head' }, [
    el('div', { class: 'set-section-head' }, [eyebrow(kicker), titleS(title, { tag: 'h3' })]),
    trail.length ? el('span', { class: 'r-trail' }, trail) : null,
  ]);
}

/** The way on from a section: one long button, at the end of the row. */
function nextRow(label, next) {
  return buttonRow({ size: 'long', className: 'end', buttons: [button({ label, className: 'cz-next', attrs: { dataset: { next } } })] });
}

export function mountCustomize(app, {
  registries, meta = {}, defaultSeedString, onBack, onStart, catalog = false, shotPose = null,
}) {
  const firstClass = registries.classes.all()[0];
  const creationLayout = registries.characterCreation.layout || {};
  const visibleModes = creationModeViews(registries);
  const state = {
    classId: firstClass.id,
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: DEFAULT_SPRITE_STYLE,
    keepsakeId: registries.characterCreation.keepsakes[0].id,
    startingKitId: null,
    startingHands: { leftHand: null, rightHand: null },
    startingSlotChoices: {},
    startingArmourId: null,
    startingRelicId: firstClass.startingRelic,
    attributeMode: visibleModes[0].id,
    attributes: null,
    classChoiceView: creationLayout.classChoiceView,
    equipmentChoiceView: creationLayout.equipmentChoiceView,
    classPreviewPercent: creationLayout.classPreviewPercent,
    equipmentAutoAdvance: creationLayout.equipmentAutoAdvance,
  };

  // A capture can pose the class figure: ?shot=customize&shotClass=rogue&shotTint=ember.
  // Applied here so everything derived from classId (relic, kit) follows the
  // pose rather than the default. Unknown ids are ignored — a screenshot list
  // should not be able to fail a boot.
  if (shotPose) {
    if (shotPose.classId && registries.classes.all().some((c) => c.id === shotPose.classId)) {
      state.classId = shotPose.classId;
      state.startingRelicId = registries.classes.get(shotPose.classId).startingRelic;
    }
    if (shotPose.tint && PORTRAIT_TINTS.some((t) => t.id === shotPose.tint)) {
      state.tint = shotPose.tint;
    }
  }

  let previewAttributes = null;
  let pointBuy = null;
  let pointBuyReturnFocus = null;
  let pointBuyKeydown = null;
  let refreshSectionFaces = () => {};
  let refreshCharacterFaces = () => {};
  let refreshSpriteFaces = () => {};
  let refreshEquipmentFaces = () => {};
  const refreshFaces = () => { refreshSectionFaces(); refreshCharacterFaces(); refreshSpriteFaces(); refreshEquipmentFaces(); };
  let updateStartRefusal = () => {};

  // ---- the page door -------------------------------------------------------
  const spriteSide = registries.characterCreation.spritePreviewSide;
  const portrait = artWell({ glyph: '', attrs: { id: 'cz-portrait', class: 'figure cz-portrait', 'aria-label': 'Live character preview' } });
  portrait.removeAttribute('aria-hidden');
  const nameInput = el('input', { id: 'cz-name', class: 'cz-name', type: 'text', maxlength: '16', spellcheck: 'false', autocomplete: 'off', value: 'Forsaken', 'aria-labelledby': 'cz-name-label' });
  const nameRow = row({ tag: 'div', setting: true, className: 'cc-name-row', labelNode: labelStack({ label: 'Name', hint: 'Up to 16 characters.' }), trail: nameInput });
  nameRow.querySelector('.ls-label').id = 'cz-name-label';
  const statsSide = el('div', { class: 'as-stack cc-stats-side' }, [
    nameRow,
    el('div', { id: 'cz-character-fold', class: 'cc-character-fold cz-disc' }, [
      el('section', { id: 'cz-primary-group', class: 'as-stack cc-character-picker' }, [
        el('div', { id: 'cz-statedit', class: 'cz-statedit' }),
        el('div', { id: 'cz-primary-stats', class: 'as-stack tight cc-primary-stats' }),
        el('div', { id: 'cz-derived', class: 'cc-derived', 'aria-label': 'Derived resources' }),
      ]),
      el('section', { id: 'cz-sprite-group', class: 'as-stack cc-character-picker' }, [
        el('span', { id: 'cz-styles', class: 'as-seg cz-opts' }),
        el('div', { id: 'cz-sprite-fold', class: 'cc-sprite-fold cz-disc' }, [
          el('section', { id: 'cz-sigil-group', class: 'cc-character-picker' }, el('div', { id: 'cz-glyphs', class: 'as-swatches cz-opts' })),
          el('section', { id: 'cz-tint-group', class: 'cc-character-picker' }, el('div', { id: 'cz-tints', class: 'as-swatches cz-opts' })),
        ]),
      ]),
      el('section', { id: 'cz-keepsake-group', class: 'cc-character-picker' }, options([], { id: 'cz-keepsakes', class: 'cz-keepsakes' })),
    ]),
  ]);
  const previewSide = el('div', { class: 'as-pane flush cc-preview-side' }, portrait);
  const seedInput = el('input', { id: 'seed-input', type: 'text', value: defaultSeedString });
  const seedRow = row({ tag: 'div', setting: true, className: 'seed-line', labelNode: labelStack({ label: 'Seed', hint: 'The same seed produces the same climb.' }), trail: seedInput });

  const split = el('div', { class: 'as-split cc-class-split' }, [
    el('div', { id: 'cz-class-preview-host', class: 'as-split-pane cc-class-preview-host' }),
    el('button', {
      type: 'button', class: 'as-split-handle cc-class-divider', role: 'separator', 'aria-label': 'Resize class preview',
      'aria-orientation': 'vertical', 'aria-valuemin': '22', 'aria-valuemax': '45', 'aria-valuenow': String(state.classPreviewPercent),
    }),
    el('div', { class: 'as-split-pane cc-class-selection' }, el('div', { class: 'as-pane' }, [
      sectionHead('Choose', 'Class', [el('div', { id: 'cz-class-view-toggle' })]),
      hairline(),
      options([], { id: 'cz-classes', class: 'cc-choice-collection', dataset: { view: state.classChoiceView } }),
      nextRow('Continue to character', 'character'),
    ])),
  ]);
  split.style.setProperty('--split-share', `${state.classPreviewPercent}%`);

  const stages = {
    class: el('section', { id: 'cz-class-panel', class: 'as-pane flush cz-stage' }, split),
    character: el('section', { id: 'cz-character-panel', class: 'as-pane flush cz-stage' }, [
      el('div', { class: 'as-splitbody cc-character-grid', dataset: { spriteSide: spriteSide } },
        spriteSide === 'left' ? [previewSide, statsSide] : [statsSide, previewSide]),
      nextRow('Continue to equipment', 'equipment'),
    ]),
    equipment: el('section', { id: 'cz-equipment-panel', class: 'as-pane flush cz-stage' }, [
      sectionHead('Choose', 'Starting equipment', [el('div', { id: 'cz-auto-advance-toggle' }), el('div', { id: 'cz-equipment-view-toggle' })]),
      hairline(),
      el('div', { id: 'cz-equipment-fold', class: 'cc-equipment-fold cz-disc' }),
      el('div', { id: 'cz-equipment-receipts', class: 'cc-equip-group', 'aria-live': 'polite' }),
      flavour('An armament is one carried object. Choosing it for the other hand moves it.', { class: 'cc-move-note' }),
      nextRow('Continue to seed', 'seed'),
    ]),
    seed: el('section', { id: 'cz-seed-panel', class: 'as-pane flush cz-stage' }, seedRow),
  };
  const flow = el('div', { class: 'cz-flow cz-disc' }, Object.values(stages));

  const head = modalHead({
    eyebrow: catalog ? 'Component catalogue' : 'Divided oath',
    title: catalog ? 'Character creation components' : 'Prepare your Forsaken',
    closeLabel: 'Back',
  });
  head.querySelector('.modal-close').hidden = true; // the way back is Back, in the foot
  const back = button({ label: 'Back', id: 'cz-back' });
  const start = button({ label: 'Begin', id: 'cz-start', weight: 'primary' });
  const foot = modalFooter({ note: 'Choose your path. The spire remembers.', secondary: [back], primary: start, size: 'medium', className: 'cz-actions' });
  const body = el('div', { class: 'modal-body cz-scroll' }, [
    catalog ? subtitle('Interactive production specimens for every creation section, nested disclosure, and reusable selector card.', { class: 'cc-catalog-intro' }) : null,
    flow,
  ]);
  // ONE page door, the kit's, on its `full` rung (kit.css PAGE DOOR).
  const door = el('section', {
    class: 'modal as-pagedoor full', dataset: { size: 'xl' }, role: 'region',
    'aria-label': catalog ? 'Character creation components' : 'Prepare your Forsaken',
  }, [head, body, foot]);
  app.replaceChildren(el('div', { class: `screen customize as-page${catalog ? ' component-catalog' : ''}` }, door));

  const $ = (selector) => app.querySelector(selector);
  const customizeScreen = $('.screen.customize');
  const classBox = $('#cz-classes');
  const statBox = $('#cz-statedit');
  const STANDARD = 'standard';
  const POINTBUY = 'pointbuy';
  let equipmentSectionViews = [];
  let equipmentNodes = new Map();
  let equipmentFold = null;

  function setClassPreviewPercent(percent) {
    state.classPreviewPercent = Math.max(22, Math.min(45, Math.round(percent)));
    split.style.setProperty('--split-share', `${state.classPreviewPercent}%`);
    classDivider.setAttribute('aria-valuenow', String(state.classPreviewPercent));
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
    if (getComputedStyle(classDivider).display === 'none') return;
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
    state.startingSlotChoices = {};
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
    // The tint is the player's own choice, so the well's edge wears it.
    portrait.style.borderColor = tintCss(state.tint);
    portrait.style.boxShadow = `0 0 34px color-mix(in srgb, ${tintCss(state.tint)} 35%, transparent)`;
    const sprite = spritesAreEnabled() && state.spriteStyle !== 'glyph'
      ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, state.spriteStyle)
      : null;
    portrait.replaceChildren(sprite || state.glyph);

    const run = previewRun();
    const projection = statProjection(registries, run);
    $('#cz-primary-stats').replaceChildren(...primaryStatCards(attributeCardModels(registries, run.attributes, {
      projection,
      equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
    })));
    const poise = playerPoiseThresholdReceipt(registries, run);
    $('#cz-derived').replaceChildren(resourceStrip(projection.derived, poise));
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
    const previewPane = classPreviewPane({
      cls, sprite,
      resources: classResourceGrid(projection.derived.slice(0, 5)),
      relic,
      relicDescription: relicText(relic, registries),
    });
    $('#cz-class-preview-host').replaceChildren(previewPane);
  }

  function renderModes() {
    const modes = el('span', { class: 'as-seg se-modes', role: 'group', 'aria-label': 'Attribute mode' });
    for (const mode of visibleModes) {
      modes.appendChild(modeChoiceButton(mode, state.attributeMode === mode.id, () => {
        state.attributeMode = mode.id;
        if (mode.id === POINTBUY) {
          if (!state.attributes) resetAttributes();
          openPointBuy();
        } else {
          closePointBuy();
          previewAttributes = null;
        }
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      }));
    }
    statBox.replaceChildren(modes);
  }

  // THE POINT-BUY IS A DOOR. Opened by the one door-opener (through the shared
  // allocation card), so its veil, head, foot, Escape and veil-click are the
  // shell's. What this screen adds is policy: what Escape MEANS here (back to
  // Standard), the Tab ring, and scoping the page behind it.
  function closePointBuy({ restoreFocus = true } = {}) {
    if (!pointBuy) return;
    const door = pointBuy;
    door.outcome = door.outcome || 'reopen';
    door.restoreFocus = restoreFocus;
    door.close();
  }

  function teardownPointBuy() {
    if (pointBuyKeydown) window.removeEventListener('keydown', pointBuyKeydown, true);
    customizeScreen.inert = false;
    pointBuyKeydown = null;
    pointBuy = null;
  }

  function openPointBuy() {
    closePointBuy({ restoreFocus: false });
    pointBuyReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    customizeScreen.inert = true;
    const mode = pointbuyMode();
    const rowsNow = () => {
      const remaining = remainingPoints();
      const rules = previewRun().equipmentProfileRuleSnapshot?.profiles;
      const cards = new Map(attributeCardModels(registries, state.attributes, { equipmentProfiles: rules }).map((card) => [card.id, card]));
      return orderedAttributes(registries).map((def) => ({
        id: def.id,
        label: def.label,
        shortLabel: def.shortLabel,
        value: state.attributes[def.id],
        card: cards.get(def.id),
        canDecrease: state.attributes[def.id] > mode.minimum,
        canIncrease: state.attributes[def.id] < mode.maximum && remaining > 0,
      }));
    };
    let refreshDone = () => {};
    const door = { outcome: null, restoreFocus: true, close: () => {} };
    const step = (id, delta) => {
      state.attributes[id] += delta;
      if (!statsProblem()) previewAttributes = { ...state.attributes };
      // The pressed stepper keeps the cursor across the redraw.
      const overlay = allocation.card;
      const focusedStep = overlay.querySelector('.se-step.gp-focus')
        || (overlay.contains(document.activeElement) ? document.activeElement.closest('.se-step') : null);
      const preservedFocus = focusedStep ? {
        statId: focusedStep.dataset.statId,
        action: focusedStep.dataset.statAction,
        dom: document.activeElement === focusedStep,
        cursor: focusedStep.classList.contains('gp-focus'),
      } : null;
      allocation.update({ remaining: remainingPoints(), rows: rowsNow() });
      refreshDone();
      if (preservedFocus) {
        const replacement = [...overlay.querySelectorAll('.se-step')].find((control) => (
          control.dataset.statId === preservedFocus.statId && control.dataset.statAction === preservedFocus.action
        ));
        if (replacement) {
          if (preservedFocus.dom) replacement.focus();
          if (preservedFocus.cursor) focusElement(replacement);
        }
      }
      renderCharacterPreview(); updateStartRefusal();
    };
    const allocation = renderStatAllocationCard(app, {
      title: 'Assign points',
      remaining: remainingPoints(),
      modal: true,
      cancelLabel: 'Standard',
      rows: rowsNow(),
      onDecrease: (id) => step(id, -1),
      onIncrease: (id) => step(id, 1),
      onCancel: () => { door.outcome = 'cancel'; allocation.close(); },
      onClose: () => {
        const outcome = door.outcome; // null: the shell dismissed it (Escape, the veil) — that is Standard
        const restore = door.restoreFocus;
        teardownPointBuy();
        if (outcome === 'reopen') return;
        if (outcome === 'done') {
          previewAttributes = { ...state.attributes };
          renderCharacterPreview();
          if (restore) focusElement(statBox.querySelector('.se-mode.chosen'));
          return;
        }
        state.attributeMode = STANDARD;
        previewAttributes = null;
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        if (restore) {
          const standard = statBox.querySelector('.se-mode.chosen');
          standard?.focus(); focusElement(standard);
        }
      },
    });
    door.close = allocation.close;
    pointBuy = door;
    refreshDone = refusesWhen(allocation.done, statsProblem, 'Apply these stats');
    allocation.done.addEventListener('click', () => {
      if (statsProblem()) return;
      door.outcome = 'done';
      allocation.close();
    });
    pointBuyKeydown = (event) => {
      if (event.key !== 'Tab') return;
      const overlay = allocation.card;
      const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); event.stopPropagation(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); event.stopPropagation(); first.focus();
      } else if (!overlay.contains(document.activeElement)) {
        event.preventDefault(); event.stopPropagation(); (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', pointBuyKeydown, true);
    void pointBuyReturnFocus;
  }

  function renderClasses() {
    classBox.dataset.view = state.classChoiceView;
    const cards = registries.classes.all().map((cls) => classChoiceCard(cls, {
      selected: cls.id === state.classId,
      visual: classGlyph(cls.id),
      onChoose: () => {
        if (state.classId === cls.id) return;
        state.classId = cls.id; resetClassChoices();
        renderClasses(); renderEquipment(); renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      },
    }));
    for (const cls of LOCKED_CLASSES) cards.push(classChoiceCard(cls, { locked: true, visual: classGlyph(cls.id) }));
    classBox.replaceChildren(...cards);
    renderViewToggles();
  }

  function renderAppearance() {
    $('#cz-styles').replaceChildren(...SPRITE_STYLES.map((style) => spriteChoiceButton(style, style.id === state.spriteStyle, () => {
      state.spriteStyle = style.id; renderAppearance(); renderCharacterPreview(); refreshFaces();
    })));
    $('#cz-tints').replaceChildren(...PORTRAIT_TINTS.map((tint) => tintChoiceButton(tint, tint.id === state.tint, () => {
      state.tint = tint.id; renderAppearance(); renderCharacterPreview(); refreshFaces();
    })));
    $('#cz-glyphs').replaceChildren(...PORTRAIT_GLYPHS.map((glyph) => sigilChoiceButton(glyph, glyph === state.glyph, () => {
      state.glyph = glyph; renderAppearance(); renderCharacterPreview(); refreshFaces();
    })));
    $('#cz-keepsakes').replaceChildren(...registries.characterCreation.keepsakes.map((keepsake) => keepsakeChoiceButton(keepsake, keepsake.id === state.keepsakeId, () => {
      state.keepsakeId = keepsake.id; renderAppearance(); refreshFaces();
    })));
  }

  function renderEquipment(preferredOpenId = null) {
    equipmentSectionViews = creationEquipmentSectionViews(registries, state.classId, { armourChoices: armourChoices() });
    equipmentNodes = new Map();
    for (const section of equipmentSectionViews) {
      const boxId = section.kind === 'armour' ? 'cz-armours'
        : section.kind === 'relic' ? 'cz-relics'
          : section.kind === 'hand' ? `cz-${section.slot === 'leftHand' ? 'left' : 'right'}-hand`
            : `cz-${section.id}`;
      const box = options([], { id: boxId, class: 'cc-card-selectors cc-choice-collection', dataset: { view: state.equipmentChoiceView } });
      const node = el('section', { class: 'cc-equip-group', dataset: { equipmentSection: section.id } }, box);
      equipmentNodes.set(section.id, node);

      for (const piece of section.choices) {
        if (section.kind === 'relic') {
          box.appendChild(relicChoiceButton(piece, relicText(piece, registries), piece.id === state.startingRelicId, () => {
            state.startingRelicId = piece.id;
            renderEquipment(section.id); renderCharacterPreview(); refreshFaces(); advanceEquipment(section.id);
          }));
          continue;
        }
        const selected = section.kind === 'armour'
          ? piece.id === state.startingArmourId
          : section.kind === 'hand'
            ? state.startingHands[section.slot] === piece.id
            : state.startingSlotChoices[section.id] === piece.id;
        const chipButton = pieceChip(registries, piece, { selected });
        markUiComponent(chipButton, UI.equipmentChoiceCard, section.id);
        if (section.kind === 'armour') chipButton.dataset.startingArmourId = piece.id;
        else if (section.kind === 'hand') { chipButton.dataset.hand = section.slot; chipButton.dataset.armamentId = piece.id; }
        else chipButton.dataset.startingSlotItemId = piece.id;
        chipButton.setAttribute('aria-pressed', selected ? 'true' : 'false');
        chipButton.addEventListener('click', () => {
          if (section.kind === 'armour') state.startingArmourId = piece.id;
          else if (section.kind === 'hand') state.startingHands = selectStartingHand(state.startingHands, section.slot, piece.id);
          else state.startingSlotChoices[section.id] = piece.id;
          renderEquipment(section.id); renderCharacterPreview(); refreshFaces(); updateStartRefusal(); advanceEquipment(section.id);
        });
        box.appendChild(chipButton);
      }
    }

    const equipmentFaces = new Map(equipmentSectionViews.map((section) => [
      section.id, selectionSectionFace(section.label, equipmentValue(section)),
    ]));
    equipmentFold = mountDisclosure($('#cz-equipment-fold'), equipmentSectionViews.map((section) => ({
      key: section.id, kind: 'pick', disclosure: 'face',
      face: { node: equipmentFaces.get(section.id).node },
      reveal: { node: equipmentNodes.get(section.id), sense: `Choose ${section.label.toLowerCase()}.` },
    })));
    refreshEquipmentFaces = () => {
      for (const section of equipmentSectionViews) equipmentFaces.get(section.id).setValue(equipmentValue(section));
    };
    const openId = equipmentSectionViews.some((section) => section.id === preferredOpenId)
      ? preferredOpenId
      : equipmentSectionViews[0]?.id;
    if (openId) equipmentFold.open(openId);

    const surface = equipmentSurfaceReceipt(registries, previewRun());
    $('#cz-equipment-receipts').innerHTML = '<section class="equip-role-receipts"><b>Starting equipment card packages</b>'
      + renderRoleCopies(surface)
      + '</section>'
      + renderEquipmentRequirements(surface.requirements)
      + renderPlayerPoise(surface.poise);
  }

  function advanceEquipment(sectionId) {
    if (!state.equipmentAutoAdvance || !equipmentFold) return;
    const current = equipmentSectionViews.find((section) => section.id === sectionId || section.slot === sectionId || section.kind === sectionId);
    if (!current?.nextId) return;
    equipmentFold.open(current.nextId);
    queueMicrotask(() => focusElement(app.querySelector(`[data-face="${current.nextId}"]`)));
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
      selectedRow(state.attributeMode, visibleModes)?.label || state.attributeMode
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
  markUiComponent($('#cz-character-fold'), UI.characterDisclosure);
  refreshCharacterFaces = () => {
    for (const row of characterRows) characterFold.setValue(row.key, row.value());
  };
  characterFold.open('primary');

  const equipmentValue = (section) => {
    if (section.kind === 'armour') return registries.equipment.armour.find((row) => (
      row.classId === state.classId && row.id === state.startingArmourId
    ))?.name || 'None';
    if (section.kind === 'relic') return section.choices.find((row) => row.id === state.startingRelicId)?.name || 'None';
    if (section.kind === 'slot') return section.choices.find((row) => row.id === state.startingSlotChoices[section.id])?.name || 'None';
    const id = state.startingHands[section.slot];
    return registries.equipment.armaments.find((row) => row.id === id)?.name || 'Empty';
  };
  resetClassChoices();
  renderClasses(); renderModes(); renderAppearance(); renderEquipment(); renderCharacterPreview(); renderViewToggles(); refreshFaces();

  const panels = stages;
  const selectedName = (id, rows, fallback = '—') => (rows.find((row) => row.id === id) || {}).name || fallback;
  const sectionRows = [
    { key: 'class', label: 'CLASS', node: panels.class, value: () => registries.classes.get(state.classId).name },
    { key: 'character', label: 'CHARACTER', node: panels.character, value: () => state.name || 'Forsaken' },
    { key: 'equipment', label: 'STARTING EQUIP', node: panels.equipment, value: () => {
      const arms = registries.equipment.armaments;
      return `${selectedName(state.startingHands.leftHand, arms, 'Empty')} / ${selectedName(state.startingHands.rightHand, arms, 'Empty')}`;
    } },
    { key: 'seed', label: 'SEED', node: panels.seed, value: () => seedInput.value.trim() || '—' },
  ];
  let fold = null;
  if (catalog) {
    // THE COMPONENT CATALOGUE is a dev-only ?shot=components reach state. It
    // moves the real creation panels into specimen Panes; it does not copy
    // their markup or grow a second renderer that could drift from the
    // player-facing screen.
    const fragment = document.createDocumentFragment();
    const appendCatalogItem = (row, kind) => {
      const item = pane({ eyebrow: kind, title: row.label, attrs: { class: 'flush cc-catalog-item', dataset: { catalogComponent: row.key } } });
      const headingId = `cc-catalog-${row.key}`;
      item.querySelector('h3').id = headingId;
      row.node.setAttribute('aria-labelledby', headingId);
      item.appendChild(row.node);
      fragment.appendChild(item);
    };
    for (const row of sectionRows) appendCatalogItem(row, 'Live section');

    const choiceSpecimen = (className, choices, idFor, renderer, initial) => {
      const host = el('div', { class: `cc-catalog-specimen ${className}` });
      let selected = initial;
      const draw = () => host.replaceChildren(...choices.map((choice) => renderer(
        choice, idFor(choice) === selected, () => { selected = idFor(choice); draw(); },
      )));
      draw();
      return host;
    };
    const specimenRun = previewRun();
    const specimenProjection = statProjection(registries, specimenRun);
    const specimenAttributes = attributeCardModels(registries, specimenRun.attributes, {
      projection: specimenProjection,
      equipmentProfiles: specimenRun.equipmentProfileRuleSnapshot?.profiles,
    });
    const disclosureHost = el('div', { class: 'cc-character-fold cc-catalog-specimen cz-disc' });
    const disclosureStat = el('div', { class: 'cc-character-picker' }, primaryStatCard(specimenAttributes[0]));
    const disclosureKeepsake = options([], { class: 'cc-character-picker cz-keepsakes' });
    let disclosureKeepsakeId = registries.characterCreation.keepsakes[0].id;
    const drawDisclosureKeepsakes = () => disclosureKeepsake.replaceChildren(...registries.characterCreation.keepsakes.slice(0, 2).map((keepsake) => keepsakeChoiceButton(
      keepsake, keepsake.id === disclosureKeepsakeId,
      () => { disclosureKeepsakeId = keepsake.id; drawDisclosureKeepsakes(); },
    )));
    drawDisclosureKeepsakes();
    const disclosureSpecimen = mountDisclosure(disclosureHost, [
      { key: 'sample-primary', kind: 'pick', disclosure: 'face', face: { label: 'PRIMARY STATS', value: 'Standard' }, reveal: { node: disclosureStat, sense: 'Edit primary stats.' } },
      { key: 'sample-keepsake', kind: 'pick', disclosure: 'face', face: { label: 'KEEPSAKE', value: registries.characterCreation.keepsakes[0].name }, reveal: { node: disclosureKeepsake, sense: 'Edit keepsake.' } },
    ]);
    markUiComponent(disclosureHost, UI.characterDisclosure);
    disclosureSpecimen.open('sample-primary');
    const statHost = el('div', { class: 'as-stack tight cc-primary-stats cc-catalog-specimen' }, primaryStatCards(specimenAttributes));
    const classChoiceHost = options([], { class: 'cc-catalog-specimen', dataset: { view: 'list' } });
    let specimenClassId = state.classId;
    const drawClassChoices = () => classChoiceHost.replaceChildren(...registries.classes.all().slice(0, 2).map((cls) => classChoiceCard(cls, {
      selected: cls.id === specimenClassId,
      visual: classGlyph(cls.id),
      onChoose: () => { specimenClassId = cls.id; drawClassChoices(); },
    })));
    drawClassChoices();
    const previewRelic = registries.relics.get(state.startingRelicId);
    const classPreviewHost = classPreviewPane({
      cls: registries.classes.get(state.classId),
      sprite: classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, 'rendered'),
      resources: classResourceGrid(specimenProjection.derived.slice(0, 5)),
      relic: previewRelic,
      relicDescription: relicText(previewRelic, registries),
    });
    classPreviewHost.classList.add('cc-catalog-specimen');
    const classResourceSpecimen = classResourceGrid(specimenProjection.derived.slice(0, 5));
    classResourceSpecimen.classList.add('cc-catalog-specimen');
    let viewToggleHost = null;
    const setCatalogView = (mode) => {
      const next = viewModeToggle(mode, setCatalogView, 'Catalog view choice');
      next.classList.add('cc-catalog-specimen');
      if (viewToggleHost) viewToggleHost.replaceWith(next);
      viewToggleHost = next;
    };
    setCatalogView('list');
    let autoAdvanceSpecimen = null;
    const setCatalogAutoAdvance = (value) => {
      const next = booleanSettingToggle('Auto-advance on valid choice', value, setCatalogAutoAdvance);
      next.classList.add('cc-catalog-specimen');
      if (autoAdvanceSpecimen) autoAdvanceSpecimen.replaceWith(next);
      autoAdvanceSpecimen = next;
    };
    setCatalogAutoAdvance(true);
    const armourSpecimen = options([], { class: 'cc-card-selectors cc-catalog-specimen', dataset: { view: 'list' } });
    const specimenArmours = armourChoices().slice(0, 2);
    let specimenArmourId = specimenArmours[0].id;
    const drawArmourChoices = () => armourSpecimen.replaceChildren(...specimenArmours.map((piece) => {
      const chipButton = pieceChip(registries, piece, { selected: piece.id === specimenArmourId });
      chipButton.setAttribute('aria-pressed', piece.id === specimenArmourId ? 'true' : 'false');
      markUiComponent(chipButton, UI.equipmentChoiceCard, 'armour');
      chipButton.addEventListener('click', () => { specimenArmourId = piece.id; drawArmourChoices(); });
      return chipButton;
    }));
    drawArmourChoices();
    const specimenRelics = creationRelicChoices(registries, state.classId).slice(0, 2);
    const relicSpecimen = options([], { class: 'cc-card-selectors cc-catalog-specimen' });
    let specimenRelicId = specimenRelics[0].id;
    const drawRelicChoices = () => relicSpecimen.replaceChildren(...specimenRelics.map((relic) => relicChoiceButton(
      relic, relicText(relic, registries), relic.id === specimenRelicId,
      () => { specimenRelicId = relic.id; drawRelicChoices(); },
    )));
    drawRelicChoices();
    const selectionFaceSpecimen = selectionSectionFace('STARTING ARMOUR', 'Ashen Vigil').node;
    selectionFaceSpecimen.classList.add('cc-catalog-specimen');
    const specimens = [
      { key: 'character-disclosure', label: 'Character sub-disclosure', node: disclosureHost },
      { key: 'class-preview-pane', label: 'Class preview pane', node: classPreviewHost },
      { key: 'class-resource-grid', label: 'Class resource strip', node: classResourceSpecimen },
      { key: 'class-choice-card', label: 'Class choice card', node: classChoiceHost },
      { key: 'view-mode-toggle', label: 'List / grid toggle', node: viewToggleHost },
      { key: 'boolean-setting-toggle', label: 'Boolean setting toggle', node: autoAdvanceSpecimen },
      { key: 'selection-section-face', label: 'Selection subcard face', node: selectionFaceSpecimen },
      { key: 'primary-stat-card', label: 'Primary stat card', node: statHost },
      { key: 'resource-strip', label: 'Resource strip', node: resourceStrip(
        specimenProjection.derived, playerPoiseThresholdReceipt(registries, specimenRun),
      ) },
      { key: 'mode-choice', label: 'Standard / assign points', node: choiceSpecimen(
        'as-seg se-modes', visibleModes, (row) => row.id, modeChoiceButton, state.attributeMode,
      ) },
      { key: 'sprite-choice', label: 'Sprite choice', node: choiceSpecimen(
        'as-seg cz-opts', SPRITE_STYLES, (row) => row.id, spriteChoiceButton, state.spriteStyle,
      ) },
      { key: 'tint-choice', label: 'Tint swatch', node: choiceSpecimen(
        'as-swatches cz-opts', PORTRAIT_TINTS, (row) => row.id, tintChoiceButton, state.tint,
      ) },
      { key: 'sigil-choice', label: 'Sigil choice', node: choiceSpecimen(
        'as-swatches cz-opts', PORTRAIT_GLYPHS, (glyph) => glyph, sigilChoiceButton, state.glyph,
      ) },
      { key: 'keepsake-choice', label: 'Keepsake card', node: choiceSpecimen(
        'as-options cz-keepsakes', registries.characterCreation.keepsakes, (row) => row.id, keepsakeChoiceButton, state.keepsakeId,
      ) },
      { key: 'equipment-choice-card', label: 'Equipment choice card', node: armourSpecimen },
      { key: 'relic-choice-card', label: 'Relic choice card', node: relicSpecimen },
    ];
    for (const row of specimens) appendCatalogItem(row, 'Reusable component');
    flow.replaceChildren(fragment);
  } else {
    fold = mountDisclosure(flow, sectionRows.map((row) => ({
      key: row.key, kind: 'pick', disclosure: 'face',
      face: { label: row.label, value: row.value() },
      reveal: { node: row.node, sense: `Edit ${row.label.toLowerCase()}.` },
    })));
    refreshSectionFaces = () => { for (const row of sectionRows) fold.setValue(row.key, row.value()); };
    fold.open('class');
  }

  app.querySelectorAll('.cz-next').forEach((control) => control.addEventListener('click', () => {
    if (catalog) {
      const target = app.querySelector(`[data-catalog-component="${control.dataset.next}"]`);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      focusElement(target?.querySelector('button, input'));
      return;
    }
    fold.open(control.dataset.next);
    const target = app.querySelector(`[data-face="${control.dataset.next}"]`);
    if (target) focusElement(target);
  }));

  nameInput.addEventListener('input', () => { state.name = nameInput.value.trim() || 'Forsaken'; refreshFaces(); });
  attachTooltip(nameInput, () => `Your character's name. Up to ${nameInput.maxLength} characters.`);
  const seed = attachSeedField(seedInput);
  seed.onChange(() => { refreshFaces(); updateStartRefusal(); });

  updateStartRefusal = refusesWhen(start, () => seed.problem() || statsProblem(), () => {
    const cls = registries.classes.get(state.classId);
    const keepsake = registries.characterCreation.keepsakes.find((row) => row.id === state.keepsakeId);
    return `Begin as <b>${esc(cls.name)}</b> with <b>${esc(keepsake.name)}</b>.`;
  });
  attachTooltip(back, () => 'Back to the title screen. Nothing here is saved.');
  back.addEventListener('click', onBack);
  start.addEventListener('click', () => {
    if (seed.problem() || statsProblem()) return;
    onStart({
      classId: state.classId,
      seedString: seedInput.value.trim(),
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
