import { renderCollectibleCard } from '../components/collectibleCard.js';
import { renderEquipmentCard, equipmentDetails } from '../components/equipmentCard.js';
import { EMPTY_HAND_PRESENTATION } from '../components/emptyHandCard.js';
import { startingEquipmentPreview } from '../../model/startingEquipmentPreview.js';
import { paintedPresentation } from '../paintedOutfits.js';
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
import { DEFAULT_SPRITE_STYLE, PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, paintedFigure, spritesAreEnabled } from '../assets.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { focusElement } from '../input.js';
import { mountDisclosure } from '../components/disclosure.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { createRunState } from '../../model/state.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { settingOn } from './settings.js';
import { statProjection, playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { startingKitViews, startingArmourViews } from '../../model/startingKits.js';
import { creationMode, orderedAttributes, classAttributePreset, attributeAllocationProblems, allocationTotal, baselineAttributeAllocation } from '../../model/attributes.js';
import { previewCompatibleHands, startingHandsRequirementFailure } from '../../model/loadout.js';
import {
  creationModeViews, creationEquipmentSectionViews, creationRelicChoices,
  selectStartingHand,
} from '../../model/characterCreation.js';
import { pieceChip } from './equipment.js';
import { ATLAS } from '../../model/worldAtlas.js';
import { relicText, renderCard } from '../components/card.js';
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
  button, buttonRow, modalHead, modalFooter, pane, statPair,
} from '../kit/index.js';

/** A section's head: Eyebrow + Title·S on the left, its controls on the right. */
function sectionHead(kicker, title, trail = []) {
  return el('div', { class: 'as-pane-head' }, [
    el('div', { class: 'set-section-head' }, [eyebrow(kicker), titleS(title, { tag: 'h3' })]),
    trail.length ? el('span', { class: 'r-trail' }, trail) : null,
  ]);
}

/** The way on from a section: one long button, at the end of the row.
 *  A gated step's button is primary — green once the step is complete, muted
 *  with its reason until then (refusal.js). The seed's is a plain button:
 *  Begin, in the foot, is the one that turns green at the end. */
function nextRow(label, next, weight = 'primary') {
  return buttonRow({ size: 'long', className: 'end', buttons: [button({ label, weight, className: 'cz-next', attrs: { dataset: { next } } })] });
}

/** Show or stash a live node. Inline display, not `hidden` alone — the kit's
 *  author display rules beat the UA `[hidden]` rule (disclosure.js measured it). */
function showNode(node, on) {
  if (!node) return;
  node.hidden = !on;
  node.style.display = on ? '' : 'none';
}

export function mountCustomize(app, {
  registries, meta = {}, defaultSeedString, onBack, onStart, catalog = false, shotPose = null,
}) {
  const firstClass = registries.classes.all()[0];
  const creationLayout = registries.characterCreation.layout || {};
  const visibleModes = creationModeViews(registries);
  // THE FLOW IS GATED (2026-09-11). Constantine: "continue to character
  // didn't turn green after I selected a class". Nothing was waiting for a
  // choice — class, Standard, keepsake and armour were all preselected at
  // mount, and the section Continues were secondary-weight, which can never
  // turn green. Now each step starts UNCHOSEN and its Continue refuses, with
  // the reason as its tooltip, until the step is complete. `classId` still
  // carries the first class so everything derived from it (preview, kit,
  // relic) has a value; `classChosen` is whether the player has said so.
  // The component catalogue keeps the old preselection: its specimens need
  // a chosen state to draw.
  const gated = !catalog;
  const state = {
    classId: firstClass.id,
    classChosen: !gated,
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: DEFAULT_SPRITE_STYLE,
    keepsakeId: gated ? null : registries.characterCreation.keepsakes[0].id,
    startingKitId: null,
    startingHands: { leftHand: null, rightHand: null },
    startingSlotChoices: {},
    startingArmourId: null,
    startingRelicId: firstClass.startingRelic,
    attributeMode: gated ? null : visibleModes[0].id,
    attributes: null,
    classChoiceView: creationLayout.classChoiceView,
    equipmentChoiceView: creationLayout.equipmentChoiceView,
    classPreviewPercent: creationLayout.classPreviewPercent,
    // The preference lives in Settings (Advanced → Gameplay); the authored
    // layout key is the fallback for a mount that carries no settings bag.
    equipmentAutoAdvance: meta.settings && 'creationAutoAdvance' in meta.settings
      ? settingOn(meta.settings, 'creationAutoAdvance') : creationLayout.equipmentAutoAdvance,
  };

  // A capture can pose the class figure: ?shot=customize&shotClass=rogue&shotTint=ember.
  // Applied here so everything derived from classId (relic, kit) follows the
  // pose rather than the default. Unknown ids are ignored — a screenshot list
  // should not be able to fail a boot.
  if (shotPose) {
    if (shotPose.classId && registries.classes.all().some((c) => c.id === shotPose.classId)) {
      state.classId = shotPose.classId;
      state.classChosen = true;
      state.startingRelicId = registries.classes.get(shotPose.classId).startingRelic;
    }
    if (shotPose.tint && PORTRAIT_TINTS.some((t) => t.id === shotPose.tint)) {
      state.tint = shotPose.tint;
    }
  }

  let pointBuy = null;
  let pointBuyReturnFocus = null;
  let pointBuyKeydown = null;
  let refreshSectionFaces = () => {};
  let refreshCharacterFaces = () => {};
  let refreshSpriteFaces = () => {};
  let refreshEquipmentFaces = () => {};
  const refreshFaces = () => { refreshSectionFaces(); refreshCharacterFaces(); refreshSpriteFaces(); refreshEquipmentFaces(); };
  // Every gated Continue re-reads its step when the start refusal does: one
  // call site per state change, and the gates cannot fall behind Begin.
  const gateRefreshers = [];
  let equipmentGateRefreshers = [];
  const refreshGates = () => { for (const refresh of [...gateRefreshers, ...equipmentGateRefreshers]) refresh(); };
  let updateStartRefusal = () => { refreshGates(); };

  // ---- the page door -------------------------------------------------------
  const spriteSide = registries.characterCreation.spritePreviewSide;
  const portrait = artWell({ glyph: '', attrs: { id: 'cz-portrait', class: 'figure cz-portrait', 'aria-label': 'Live character preview' } });
  portrait.removeAttribute('aria-hidden');
  const nameInput = el('input', { id: 'cz-name', class: 'cz-name', type: 'text', maxlength: '16', spellcheck: 'false', autocomplete: 'off', value: 'Forsaken', 'aria-labelledby': 'cz-name-label' });
  const nameRow = row({ tag: 'div', setting: true, className: 'cc-name-row', labelNode: labelStack({ label: 'Name', hint: 'Up to 16 characters.' }), trail: nameInput });
  nameRow.querySelector('.ls-label').id = 'cz-name-label';
  const spriteGroup = el('section', { id: 'cz-sprite-group', class: 'as-stack cc-character-picker' }, [
    el('span', { id: 'cz-styles', class: 'as-seg cz-opts' }),
    el('div', { id: 'cz-sprite-fold', class: 'cc-sprite-fold cz-disc' }, [
      el('section', { id: 'cz-sigil-group', class: 'cc-character-picker' }, el('div', { id: 'cz-glyphs', class: 'as-swatches cz-opts' })),
      el('section', { id: 'cz-tint-group', class: 'cc-character-picker' }, el('div', { id: 'cz-tints', class: 'as-swatches cz-opts' })),
    ]),
  ]);
  const statsSide = el('div', { class: 'as-stack cc-stats-side' }, [
    nameRow,
    el('div', { id: 'cz-character-fold', class: 'cc-character-fold cz-disc' }, [
      el('section', { id: 'cz-primary-group', class: 'as-stack cc-character-picker' }, [
        el('div', { id: 'cz-statedit', class: 'cz-statedit' }),
        el('div', { id: 'cz-primary-stats', class: 'as-stack tight cc-primary-stats' }),
        el('div', { id: 'cz-derived', class: 'cc-derived', 'aria-label': 'Derived resources' }),
        // The way on from the stats, bottom-right of the section: shown once a
        // mode is chosen, green once the allocation is complete.
        buttonRow({ size: 'long', className: 'end cc-primary-continue-row', buttons: [
          button({ label: 'Continue', weight: 'primary', className: 'cc-primary-continue' }),
        ] }),
      ]),
      el('section', { id: 'cz-keepsake-group', class: 'cc-character-picker' }, options([], { id: 'cz-keepsakes', class: 'cz-keepsakes' })),
    ]),
  ]);
  const previewSide = el('div', { class: 'as-pane flush cc-preview-side' }, [
    portrait,
    el('div', { id: 'cz-preview-fold', class: 'cc-preview-fold cz-disc' }, spriteGroup),
  ]);
  const seedInput = el('input', { id: 'seed-input', type: 'text', value: defaultSeedString });
  const seedRow = row({ tag: 'div', setting: true, className: 'seed-line', labelNode: labelStack({ label: 'Seed', hint: 'The same seed produces the same climb.' }), trail: seedInput });
  const journeySelect = el('select', { id: 'cz-journey', 'aria-label': 'Journey mode' }, [
    el('option', { value: '' }, 'Classic Climb'),
    ...Object.values(ATLAS.profiles).map(p => el('option', { value: p.profileId }, `World Journey · ${p.displayName} (${p.activeTarget} places)`)),
  ]);
  const journeyRow = row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Journey', hint: 'Explore a fixed world with a new route each run, or climb the classic acts.' }), trail: journeySelect });

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
      sectionHead('Choose', 'Starting equipment', [el('div', { id: 'cz-equipment-view-toggle' })]),
      hairline(),
      el('div', { id: 'cz-equipment-fold', class: 'cc-equipment-fold cz-disc' }),
      el('div', { id: 'cz-equipment-receipts', class: 'cc-equip-group', 'aria-live': 'polite' }),
      flavour('An armament is one carried object. Choosing it for the other hand moves it.', { class: 'cc-move-note' }),
      nextRow('Continue to seed', 'seed', 'secondary'),
    ]),
    seed: el('section', { id: 'cz-seed-panel', class: 'as-pane flush cz-stage' }, [journeyRow, seedRow]),
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
    // Opening Assign Points is a refund boundary, not a return to the authored
    // class suggestion. Every stat goes back to the mode's baseline and the
    // complete bonus pool becomes available again (SPEC 7.2). The helper is
    // #692's; this branch computed the same thing inline before it existed.
    state.attributes = baselineAttributeAllocation(registries, POINTBUY);
  }

  function resetClassChoices() {
    const kit = baseKit();
    state.startingKitId = kit.id;
    state.startingHands = { leftHand: kit.leftHand || null, rightHand: kit.rightHand || null };
    state.startingSlotChoices = {};
    // Armour is the player's to choose: it starts unchosen and the armour
    // step's Continue waits for it. Hands and relic keep the class defaults
    // so the common case is one click per step, not four mandatory picks.
    state.startingArmourId = gated ? null : armourChoices()[0].id;
    state.startingRelicId = registries.classes.get(state.classId).startingRelic;
    if (state.attributeMode === POINTBUY) resetAttributes();
  }

  // ---- what each step still needs ------------------------------------------
  // One reason per step, read by that step's Continue AND by Begin, so the
  // foot and the section can never disagree about what is missing.
  function classProblem() { return state.classChosen ? null : 'Choose a class.'; }
  function modeProblem() { return state.attributeMode ? null : 'Choose Standard or Assign points.'; }
  function keepsakeProblem() { return state.keepsakeId ? null : 'Choose a keepsake.'; }
  function armourProblem() { return state.startingArmourId ? null : 'Choose starting armour.'; }
  /** The stats step: the mode, then a complete and legal allocation. */
  function statsStepProblem() { return modeProblem() || allocationProblem(); }
  function characterProblem() { return statsStepProblem() || keepsakeProblem(); }
  function equipmentProblem() { return armourProblem() || handsProblem(); }
  function flowProblem() { return classProblem() || characterProblem() || equipmentProblem(); }

  function pointbuyMode() { return creationMode(registries, POINTBUY); }
  function remainingPoints() {
    if (!state.attributes) return pointbuyMode().bonusPool;
    return allocationTotal(registries, POINTBUY) - Object.values(state.attributes).reduce((sum, value) => sum + value, 0);
  }
  /** The point-buy alone: the pool spent exactly, every stat in bounds. */
  function allocationProblem() {
    if (state.attributeMode !== POINTBUY || !state.attributes) return null;
    const remaining = remainingPoints();
    if (remaining !== 0) return remaining > 0
      ? `${remaining} stat point${remaining === 1 ? '' : 's'} still to assign.`
      : `${-remaining} stat point${remaining === -1 ? '' : 's'} over the pool.`;
    const problems = attributeAllocationProblems(registries, state.classId, POINTBUY, state.attributes);
    return problems.length ? problems[0].msg : null;
  }
  /** The attributes the run would begin with: a complete point-buy, else the
   *  class preset for the chosen mode (Standard until one is chosen). */
  function effectiveAttributes() {
    if (state.attributeMode === POINTBUY && state.attributes && !allocationProblem()) return state.attributes;
    return classAttributePreset(registries, state.classId, state.attributeMode || STANDARD);
  }
  /** A held weapon the effective attributes cannot wield. Checked at the
   *  hand step and at Begin — NOT in Assign points, which used to refuse
   *  "Done" at 0 points because the default staff wanted INT 12, a fact the
   *  player had not yet been shown and could not act on from that door. */
  function handsProblem(hands = state.startingHands) {
    const rejected = startingHandsRequirementFailure(registries, hands, effectiveAttributes());
    if (rejected) return `${rejected.piece.name} needs ${rejected.failure.attributeId} ${rejected.failure.required} — you have ${rejected.failure.actual}.`;
    return null;
  }
  function handProblem(slot) { return handsProblem({ [slot]: state.startingHands[slot] }); }
  function statsProblem() { return allocationProblem() || handsProblem(); }

  function previewRun() {
    // Validate the live allocation independently of weapon requirements.
    // An incomplete point-buy draft uses a valid standard preset for hints.
    const hasCompletePointBuy = state.attributeMode === POINTBUY && state.attributes
      && attributeAllocationProblems(registries, state.classId, POINTBUY, state.attributes).length === 0;
    const previewMode = hasCompletePointBuy ? POINTBUY : STANDARD;
    const attributes = hasCompletePointBuy
      ? state.attributes
      : classAttributePreset(registries, state.classId, previewMode);
    return createRunState({
      seed: 0, classId: state.classId, registries,
      startingKitId: state.startingKitId,
      startingHands: previewCompatibleHands(registries, state.startingHands, attributes),
      startingArmourId: state.startingArmourId,
      startingRelicId: state.startingRelicId,
      attributeMode: previewMode,
      ...(hasCompletePointBuy ? { attributes: { ...state.attributes } } : {}),
      profileMeta: meta,
    });
  }
  function renderCharacterPreview() {
    // The tint is the player's own choice, so the well's edge wears it.
    portrait.style.borderColor = tintCss(state.tint);
    portrait.style.boxShadow = `0 0 34px color-mix(in srgb, ${tintCss(state.tint)} 35%, transparent)`;
    const sprite = spritesAreEnabled() && state.spriteStyle !== 'glyph'
      ? (state.spriteStyle === 'classic'
        ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, 'classic')
        // Framed, not bare: the chosen sigil rides the figure here as it does
        // everywhere else a figure is drawn. `classic` draws its own sigil
        // inside the silhouette, so it keeps going through classSprite().
        : paintedFigure(state.classId, tintCss(state.tint), state.glyph, state.startingArmourId, 'detail'))
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
      ? paintedPresentation(state.classId, state.startingArmourId, 'portrait')
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
          // Entering Assign Points is an explicit fresh allocation. Return the
          // entire authored pool instead of reopening the class-biased preset
          // (or a previous edit) with points already spent.
          resetAttributes();
          openPointBuy();
        } else {
          closePointBuy();
        }
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      }));
    }
    statBox.replaceChildren(modes);
    // Until a mode is chosen the section is the question alone: the stat rows,
    // the resources and the way on appear with the answer.
    const chosen = Boolean(state.attributeMode);
    showNode($('#cz-primary-stats'), chosen);
    showNode($('#cz-derived'), chosen);
    showNode($('.cc-primary-continue-row'), chosen);
  }

  /** Bring a fold's face to the top of the scroll and seat the cursor on
   *  `target` (the face itself by default), once the layout has it. */
  function seatFace(key, target = null) {
    queueMicrotask(() => {
      const face = app.querySelector(`[data-face="${key}"]`);
      if (!face) return;
      face.scrollIntoView({ block: 'start' });
      focusElement(target || face);
    });
  }

  /** Stats settled: fold Primary Stats, unfold Keepsake, put the cursor there. */
  function advanceToKeepsake({ focus = true } = {}) {
    characterFold.open('keepsake');
    if (focus) seatFace('keepsake', $('#cz-keepsakes .cz-keepsake'));
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
    resetAttributes();
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
      // ENFORCE THE BOUND WHERE THE CHANGE HAPPENS, not only on the control.
      // This mutated on trust: the stepper's own listener checks `allowed`,
      // but that is a closure captured when the control was drawn, so any
      // activation that reaches this function with a stale or bypassed control
      // moved the stat anyway. Measured, not theorised — the creation gate's
      // own click sequence drove the pool to **-1** (STR 15, DEX 16 out of a
      // 60-point total), after which Done refused with "1 stat point over the
      // pool" and a player would have had to work out for themselves which
      // stat to put back. The row model already computes whether a stat may
      // move; the same predicate is read here rather than restated, so the
      // control and the mutation cannot disagree.
      // The same predicate `rowsNow()` gives the controls, computed directly:
      // reading it through `rowsNow()` drags in `previewRun()` on every press,
      // and that round trip made a legitimate press do nothing at all — the
      // pool sat at 1 with four steppers reporting themselves enabled and no
      // click able to spend it. Cheap, and it cannot disagree with the row
      // model while both read `mode` and `remainingPoints()`.
      const current = state.attributes[id];
      const allowed = delta > 0
        ? current < mode.maximum && remainingPoints() > 0
        : current > mode.minimum;
      if (!allowed) return;
      state.attributes[id] += delta;
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
      doneLabel: 'Continue',
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
          renderCharacterPreview(); refreshFaces(); updateStartRefusal();
          advanceToKeepsake({ focus: restore });
          return;
        }
        state.attributeMode = STANDARD;
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        if (restore) {
          const standard = statBox.querySelector('.se-mode.chosen');
          standard?.focus(); focusElement(standard);
        }
      },
    });
    door.close = allocation.close;
    pointBuy = door;
    // Green at 0 points with a legal spread. Weapon requirements are the hand
    // step's question, asked there (handProblem) and at Begin (flowProblem).
    refreshDone = refusesWhen(allocation.done, allocationProblem, 'Apply these stats and choose a keepsake');
    allocation.done.addEventListener('click', () => {
      if (allocationProblem()) return;
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
      selected: state.classChosen && cls.id === state.classId,
      visual: classGlyph(cls.id),
      onChoose: () => {
        if (state.classChosen && state.classId === cls.id) return;
        state.classId = cls.id; state.classChosen = true; resetClassChoices();
        renderClasses(); renderEquipment(); renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
      },
    }));
    // Before a pick the preview pane follows the pointer, so it is never a
    // portrait of a class nobody chose; a pick pins it.
    for (const card of cards) {
      const id = card.dataset.class;
      if (!id || card.classList.contains('locked')) continue;
      card.addEventListener('pointerenter', () => {
        if (state.classChosen || state.classId === id) return;
        // The kit, relic and armour follow the class; nothing is chosen yet,
        // so the reset costs the player nothing.
        state.classId = id; resetClassChoices(); renderClassPreview();
      });
    }
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
      state.keepsakeId = keepsake.id; renderAppearance(); refreshFaces(); updateStartRefusal();
    })));
  }

  function renderEquipment(preferredOpenId = null) {
    equipmentSectionViews = creationEquipmentSectionViews(registries, state.classId, { armourChoices: armourChoices() });
    equipmentNodes = new Map();
    equipmentGateRefreshers = [];
    const refreshers = [];
    for (const section of equipmentSectionViews) {
      const boxId = section.kind === 'armour' ? 'cz-armours'
        : section.kind === 'relic' ? 'cz-relics'
          : section.kind === 'hand' ? `cz-${section.slot === 'leftHand' ? 'left' : 'right'}-hand`
            : `cz-${section.id}`;
      const box = options([], { id: boxId, class: 'cc-card-selectors cc-choice-collection', dataset: { view: state.equipmentChoiceView } });
      const node = el('section', { class: 'cc-equip-group', dataset: { equipmentSection: section.id } }, box);
      equipmentNodes.set(section.id, node);
      const detailPane = el('div', { class: 'cc-equipment-details card-inspection-details', 'aria-live': 'polite' });
      node.append(detailPane);
      const isSelected = piece => section.kind === 'relic' ? piece.id === state.startingRelicId : section.kind === 'armour'
        ? piece.id === state.startingArmourId : section.kind === 'hand'
          ? state.startingHands[section.slot] === piece.id : state.startingSlotChoices[section.id] === piece.id;
      const showDetails = piece => {
        detailPane.dataset.previewItem = piece.id || 'empty-hand';
        detailPane.replaceChildren(equipmentDetails((section.kind === 'relic' ? renderCollectibleCard(registries, piece, 'Relic', { interactive: false, inspection: false }) : renderEquipmentCard(registries, piece, { interactive: false, inspection: false, presentation: piece.emptyHand ? EMPTY_HAND_PRESENTATION : null })).explanations));
        const heading = document.createElement('h3');
        heading.textContent = piece.name;
        const context = el('p', { class: 'cc-choice-context' }, isSelected(piece) ? `Selected · ${section.label}` : 'Preview · Choose below the card to select');
        detailPane.prepend(heading, context);
        if (section.kind === 'hand') {
          const hands = selectStartingHand(state.startingHands, section.slot, piece.id);
          const preview = startingEquipmentPreview(registries, previewRun(), hands, section.slot);
          const grid = el('div', { class: 'cc-starting-card-grid', 'aria-label': `${piece.name} starting combat cards` });
          for (const { ref, count } of preview.cards) {
            const face = renderCard(registries, ref);
            const entry = el('div', { class: 'cc-starting-card', dataset: { cardId: ref.cardId, quantity: String(count) } }, [
              el('span', { class: 'cc-card-quantity' }, `${count} ${count === 1 ? 'copy' : 'copies'}`), face,
            ]);
            grid.append(entry);
          }
          const packageNode = el('section', { class: 'cc-starting-package' }, [
            el('h4', {}, 'Starting combat cards'),
            el('p', { class: 'cc-package-context' }, `${preview.total} ${preview.total === 1 ? 'card' : 'cards'} with this loadout. Quantities depend on both hands.`),
            preview.cards.length ? grid : el('p', {}, 'This choice adds no combat cards with the other hand currently selected.'),
          ]);
          detailPane.append(packageNode);
        }
      };
      const choiceRows = [];
      const focusChoice = piece => {
        for (const row of choiceRows) {
          const active = row.piece === piece;
          row.node.classList.toggle('choice-focused', active);
          if (!active) row.face.classList.remove('inspection-selected', 'inspection-info-visible');
        }
        showDetails(piece);
      };
      for (const piece of section.choices) {
        const chipButton = pieceChip(registries, piece, { selected: isSelected(piece), kind: section.kind === 'relic' ? 'Relic' : null, presentation: piece.emptyHand ? EMPTY_HAND_PRESENTATION : null });
        const face = chipButton.querySelector('.equipment-poker-card');
        choiceRows.push({ piece, node: chipButton, face });
        face.addEventListener('cardinspectionselect', () => focusChoice(piece));
        face.addEventListener('keydown', event => {
          if (event.target.classList.contains('equipment-poker-card') && ['Enter', ' '].includes(event.key)) {
            event.preventDefault(); focusChoice(piece);
          }
        });
        markUiComponent(chipButton, UI.equipmentChoiceCard, section.id);
        if (section.kind === 'armour') chipButton.dataset.startingArmourId = piece.id;
        else if (section.kind === 'hand') { chipButton.dataset.hand = section.slot; chipButton.dataset.armamentId = piece.id || 'empty-hand'; }
        else chipButton.dataset.startingSlotItemId = piece.id;
        chipButton.querySelector('.equipment-choose').addEventListener('click', () => {
          if (section.kind === 'relic') state.startingRelicId = piece.id;
          else if (section.kind === 'armour') state.startingArmourId = piece.id;
          else if (section.kind === 'hand') state.startingHands = selectStartingHand(state.startingHands, section.slot, piece.id);
          else state.startingSlotChoices[section.id] = piece.id;
          for (const refresh of refreshers) refresh();
          renderEquipmentSummary(); renderCharacterPreview(); refreshFaces(); updateStartRefusal(); advanceEquipment(section.id);
        });
        box.appendChild(chipButton);
      }
      const refresh = () => {
        for (const row of choiceRows) {
          const selected = isSelected(row.piece);
          row.node.classList.toggle('on', selected);
          row.face.classList.toggle('selected', selected);
          const choose = row.node.querySelector('.equipment-choose');
          choose.textContent = selected ? 'Selected' : `Choose ${row.piece.name}`;
          choose.setAttribute('aria-pressed', String(selected));
        }
        const chosen = section.choices.find(isSelected);
        if (chosen) focusChoice(chosen);
      };
      refreshers.push(refresh); refresh();
      const next = equipmentSectionViews.find(row => row.id === section.nextId);
      const nextLabel = next ? next.label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) : 'Seed';
      // Armour waits for a pick; a hand waits for a weapon the stats can
      // wield; the last section's button is plain — Begin is what goes green.
      const sectionProblem = () => (section.kind === 'armour' ? armourProblem()
        : section.kind === 'hand' ? handProblem(section.slot) : null);
      const continueButton = button({ label: `Continue to ${nextLabel}`, weight: next ? 'primary' : 'secondary', className: 'cc-equipment-continue' });
      if (next) equipmentGateRefreshers.push(refusesWhen(continueButton, sectionProblem, `On to ${nextLabel.toLowerCase()}.`));
      continueButton.addEventListener('click', () => {
        if (sectionProblem()) return;
        if (next) openEquipmentSection(next.id);
        else app.querySelector('.cz-next[data-next="seed"]')?.click();
      });
      node.append(continueButton);
    }

    const equipmentFaces = new Map(equipmentSectionViews.map((section) => [
      section.id, selectionSectionFace(section.label, equipmentValue(section)),
    ]));
    equipmentFold = mountDisclosure($('#cz-equipment-fold'), equipmentSectionViews.map((section) => ({
      key: section.id, kind: 'pick', disclosure: 'face',
      face: { node: equipmentFaces.get(section.id).node },
      reveal: { node: equipmentNodes.get(section.id), sense: `Choose ${section.label.toLowerCase()}.` },
    })), { structure: 'details' });
    refreshEquipmentFaces = () => {
      for (const section of equipmentSectionViews) equipmentFaces.get(section.id).setValue(equipmentValue(section));
    };
    const openId = equipmentSectionViews.some((section) => section.id === preferredOpenId)
      ? preferredOpenId
      : equipmentSectionViews[0]?.id;
    if (preferredOpenId && openId) equipmentFold.open(openId);

    renderEquipmentSummary();
  }

  // THE EQUIPMENT SUMMARY IS CARDS (2026-09-11). Constantine: "it should show
  // stats on a card, then armor, then main hand, off hand (if any, otherwise
  // skipped) then relic card." The cards are the pickers' own renderers, drawn
  // inert; a weapon the stats cannot wield wears the refusal under its card.
  // The calculations the old summary printed — card packages, requirements,
  // poise — fold under the cards, still drawn by the shared receipt renderers
  // (tools/equipment-surface-receipts.mjs reads that this screen uses them).
  const summaryBody = el('div', { class: 'as-stack cc-summary' });
  let summaryFold = null;
  function characterSummaryCard(run, projection) {
    const cls = registries.classes.get(state.classId);
    const stats = el('div', { class: 'cc-summary-stats', role: 'list', 'aria-label': 'Primary stats' },
      orderedAttributes(registries).map((def) => statPair({
        key: def.shortLabel, value: String(run.attributes[def.id]),
        attrs: { role: 'listitem', dataset: { stat: def.id } },
      })));
    return el('article', { class: 'cc-summary-character', 'aria-label': `${state.name} character card` }, [
      el('span', { class: 'cc-summary-eyebrow', text: cls.name }),
      el('p', { class: 'cc-summary-name', text: state.name || 'Forsaken' }),
      hairline(),
      stats,
      hairline(),
      resourceStrip(projection.derived, playerPoiseThresholdReceipt(registries, run)),
    ]);
  }
  function fillSummary() {
    const run = previewRun();
    const projection = statProjection(registries, run);
    const surface = equipmentSurfaceReceipt(registries, run);
    const inert = { interactive: false, inspection: false };
    const armament = (id) => registries.equipment.armaments.find((row) => row.id === id) || null;
    const slots = [
      { key: 'character', label: 'Character', node: characterSummaryCard(run, projection) },
    ];
    const armour = registries.equipment.armour.find((row) => row.classId === state.classId && row.id === state.startingArmourId);
    slots.push({ key: 'armour', label: 'Armour', node: armour ? renderEquipmentCard(registries, armour, inert).card : null, empty: 'Not chosen yet' });
    const handSlot = (slot, label) => {
      const piece = armament(state.startingHands[slot]);
      const node = piece
        ? renderEquipmentCard(registries, piece, inert).card
        : renderEquipmentCard(registries, { id: 'empty-hand', name: 'Empty Hand', emptyHand: true }, { ...inert, presentation: EMPTY_HAND_PRESENTATION }).card;
      return { key: slot, label, node, unmet: piece ? handProblem(slot) : null };
    };
    slots.push(handSlot('rightHand', 'Main hand'));
    if (state.startingHands.leftHand) slots.push(handSlot('leftHand', 'Off hand'));
    const relic = registries.relics.get(state.startingRelicId);
    slots.push({ key: 'relic', label: 'Relic', node: relic ? renderCollectibleCard(registries, relic, 'Relic', inert).card : null, empty: 'None' });
    const cards = el('div', { class: 'cc-summary-cards', role: 'list' }, slots.map((slot) => el('div', {
      class: `cc-summary-slot${slot.unmet ? ' unmet' : ''}`, role: 'listitem', dataset: { summarySlot: slot.key },
    }, [
      eyebrow(slot.label),
      slot.node || flavour(slot.empty || '—', { class: 'cc-summary-empty' }),
      slot.unmet ? el('p', { class: 'cc-summary-unmet', text: slot.unmet }) : null,
    ])));
    const receiptBody = el('div', { class: 'as-stack' });
    receiptBody.innerHTML = '<section class="equip-role-receipts"><b>Starting equipment card packages</b>'
      + renderRoleCopies(surface)
      + '</section>'
      + renderEquipmentRequirements(surface.requirements)
      + renderPlayerPoise(surface.poise);
    const calculations = el('div', { class: 'cc-summary-calculations cz-disc' });
    mountDisclosure(calculations, [{ key: 'equipment-calculations', kind: 'pick', disclosure: 'face',
      face: { label: 'Show calculations', value: 'Card packages, requirements and poise' },
      reveal: { node: receiptBody },
    }], { structure: 'details' });
    summaryBody.replaceChildren(cards, calculations);
  }
  function renderEquipmentSummary() {
    fillSummary();
    if (summaryFold) return;
    summaryFold = mountDisclosure($('#cz-equipment-receipts'), [{ key: 'equipment-summary', kind: 'pick', disclosure: 'face',
      face: { label: 'Equipment summary', value: 'Your character and cards' },
      reveal: { node: summaryBody },
    }], { structure: 'details' });
    // Stats can change after the equipment renders (Assign points, a class
    // reset), so the cards are redrawn when the summary is opened.
    $('#cz-equipment-receipts [data-face="equipment-summary"]').addEventListener('click', () => { if (summaryFold.openKey) fillSummary(); });
  }

  /** Open one equipment section and bring its face to the top of the scroll,
   *  so the section — capped to the glass on desktop (kit.css, THE OPEN
   *  EQUIPMENT SECTION) — is wholly in view with its Continue. */
  function openEquipmentSection(id) {
    if (!id || !equipmentFold) return;
    equipmentFold.open(id);
    seatFace(id);
  }

  function advanceEquipment(sectionId) {
    if (!state.equipmentAutoAdvance || !equipmentFold) return;
    const current = equipmentSectionViews.find((section) => section.id === sectionId || section.slot === sectionId || section.kind === sectionId);
    if (!current?.nextId) return;
    openEquipmentSection(current.nextId);
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
  })), { structure: 'details' });
  refreshSpriteFaces = () => {
    for (const row of spriteRows) spriteFold.setValue(row.key, row.value());
  };

  // A face names what is chosen; an unmade choice says so with a dash rather
  // than borrowing the first option's name.
  const UNCHOSEN = '—';
  const characterRows = [
    { key: 'primary', label: 'PRIMARY STATS', node: $('#cz-primary-group'), value: () => (
      selectedRow(state.attributeMode, visibleModes)?.label || UNCHOSEN
    ) },
    { key: 'keepsake', label: 'KEEPSAKE', node: $('#cz-keepsake-group'), value: () => (
      selectedRow(state.keepsakeId, registries.characterCreation.keepsakes)?.name || UNCHOSEN
    ) },
  ];
  const characterFold = mountDisclosure($('#cz-character-fold'), characterRows.map((row) => ({
    key: row.key, kind: 'pick', disclosure: 'face',
    face: { label: row.label, value: row.value() },
    reveal: { node: row.node, sense: `Edit ${row.label.toLowerCase()}.` },
  })), { structure: 'details' });
  markUiComponent($('#cz-character-fold'), UI.characterDisclosure);
  refreshCharacterFaces = () => {
    for (const row of characterRows) characterFold.setValue(row.key, row.value());
  };
  const previewFold = mountDisclosure($('#cz-preview-fold'), [{
    key: 'sprite', kind: 'pick', disclosure: 'face',
    face: { label: 'SPRITE', value: selectedRow(state.spriteStyle, SPRITE_STYLES)?.name || state.spriteStyle },
    reveal: { node: $('#cz-sprite-group'), sense: 'Edit sprite.' },
  }], { structure: 'details' });
  const refreshPreviewFace = () => previewFold.setValue(
    'sprite', selectedRow(state.spriteStyle, SPRITE_STYLES)?.name || state.spriteStyle,
  );
  const refreshExistingCharacterFaces = refreshCharacterFaces;
  refreshCharacterFaces = () => { refreshExistingCharacterFaces(); refreshPreviewFace(); };
  // Character choices stay folded until requested.

  const equipmentValue = (section) => {
    if (section.kind === 'armour') return registries.equipment.armour.find((row) => (
      row.classId === state.classId && row.id === state.startingArmourId
    ))?.name || UNCHOSEN;
    if (section.kind === 'relic') return section.choices.find((row) => row.id === state.startingRelicId)?.name || 'None';
    if (section.kind === 'slot') return section.choices.find((row) => row.id === state.startingSlotChoices[section.id])?.name || 'None';
    const id = state.startingHands[section.slot];
    return registries.equipment.armaments.find((row) => row.id === id)?.name || 'Empty Hand';
  };
  resetClassChoices();
  renderClasses(); renderModes(); renderAppearance(); renderEquipment(); renderCharacterPreview(); renderViewToggles(); refreshFaces();

  const panels = stages;
  const selectedName = (id, rows, fallback = '—') => (rows.find((row) => row.id === id) || {}).name || fallback;
  const sectionRows = [
    { key: 'class', label: 'CLASS', node: panels.class, value: () => (state.classChosen ? registries.classes.get(state.classId).name : UNCHOSEN) },
    { key: 'character', label: 'CHARACTER', node: panels.character, value: () => state.name || 'Forsaken' },
    { key: 'equipment', label: 'STARTING EQUIP', node: panels.equipment, value: () => {
      const arms = registries.equipment.armaments;
      return `${selectedName(state.startingHands.leftHand, arms, 'Empty Hand')} / ${selectedName(state.startingHands.rightHand, arms, 'Empty Hand')}`;
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
      sprite: paintedPresentation(state.classId, state.startingArmourId, 'portrait'),
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
    })), { structure: 'details' });
    refreshSectionFaces = () => { for (const row of sectionRows) fold.setValue(row.key, row.value()); };
    fold.open('class');
  }

  // THE WAY ON, per step: what it waits for, and what it opens inside the next
  // section so the player lands on the next question rather than a shut fold.
  const nextGates = {
    character: { problem: classProblem, tip: 'On to the character.' },
    equipment: { problem: characterProblem, tip: 'On to starting equipment.' },
  };
  const openInside = {
    character: () => {
      characterFold.open('primary');
      seatFace('primary', statBox.querySelector('.se-mode.chosen') || statBox.querySelector('.se-mode'));
      return null; // seatFace seats the cursor itself
    },
    equipment: () => {
      openEquipmentSection(equipmentSectionViews[0]?.id);
      return null; // openEquipmentSection seats the cursor itself
    },
  };
  app.querySelectorAll('.cz-next').forEach((control) => {
    const gate = nextGates[control.dataset.next];
    if (gate && !catalog) gateRefreshers.push(refusesWhen(control, gate.problem, gate.tip));
    control.addEventListener('click', () => {
      if (catalog) {
        const target = app.querySelector(`[data-catalog-component="${control.dataset.next}"]`);
        target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        focusElement(target?.querySelector('button, input'));
        return;
      }
      if (gate && gate.problem()) return;
      fold.open(control.dataset.next);
      const opener = openInside[control.dataset.next];
      const target = opener ? opener() : app.querySelector(`[data-face="${control.dataset.next}"]`);
      if (target) queueMicrotask(() => focusElement(target));
    });
  });
  const primaryContinue = $('.cc-primary-continue');
  gateRefreshers.push(refusesWhen(primaryContinue, statsStepProblem, 'On to the keepsake.'));
  primaryContinue.addEventListener('click', () => {
    if (statsStepProblem()) return;
    advanceToKeepsake();
  });

  nameInput.addEventListener('input', () => { state.name = nameInput.value.trim() || 'Forsaken'; refreshFaces(); });
  attachTooltip(nameInput, () => `Your character's name. Up to ${nameInput.maxLength} characters.`);
  const seed = attachSeedField(seedInput);
  seed.onChange(() => { refreshFaces(); updateStartRefusal(); });

  // Begin waits for the whole flow, and its tooltip names the first unmet
  // step. The catalogue has no flow to complete; it keeps the seed and stats
  // checks the specimens can answer.
  const beginProblem = () => seed.problem() || (gated ? flowProblem() : statsProblem());
  const refreshStart = refusesWhen(start, beginProblem, () => {
    const cls = registries.classes.get(state.classId);
    const keepsake = registries.characterCreation.keepsakes.find((row) => row.id === state.keepsakeId);
    return `Begin as <b>${esc(cls.name)}</b>${keepsake ? ` with <b>${esc(keepsake.name)}</b>` : ''}.`;
  });
  updateStartRefusal = () => { refreshStart(); refreshGates(); };
  attachTooltip(back, () => 'Back to the title screen. Nothing here is saved.');
  back.addEventListener('click', onBack);
  start.addEventListener('click', () => {
    if (beginProblem()) return;
    onStart({
      classId: state.classId,
      seedString: seedInput.value.trim(),
      journeyProfile: journeySelect.value || null,
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
