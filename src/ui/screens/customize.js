import { compactEquipmentDetails } from '../components/compactEquipmentDetails.js';
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
import { soloHandRules, soloHandSummary } from '../../model/soloHand.js';
import { settingOn } from './settings.js';
import { statProjection, playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { startingKitViews, startingArmourViews } from '../../model/startingKits.js';
import { creationMode, creationModeHasPoints, orderedAttributes, classAttributePreset, attributeAllocationProblems, allocationTotal, baselineAttributeAllocation, defaultCreationModeId } from '../../model/attributes.js';
import { previewCompatibleHands, startingHandsRequirementFailure, equipmentKitReceipt } from '../../model/loadout.js';
import {
  creationModeViews, creationEquipmentSectionViews, creationRelicChoices,
  selectStartingHand,
} from '../../model/characterCreation.js';
import { pieceChip, setPieceChipChosen } from './equipment.js';
import { ATLAS } from '../../model/worldAtlas.js';
import { relicText, renderCard, scheduleCardFits } from '../components/card.js';
import { bindCardInspection, openCardInspection } from '../components/cardInspection.js';
import { renderStatAllocationCard } from '../components/statAllocationCard.js';
import { renderEquipmentRequirements, renderPlayerPoise, renderRoleCopies } from '../components/equipmentReceipts.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import {
  primaryStatCard, primaryStatCards, resourceStrip, modeChoiceButton, spriteChoiceButton,
  tintChoiceButton, sigilChoiceButton, keepsakeChoiceButton, viewModeToggle,
  booleanSettingToggle, classChoiceCard, classPreviewPane, classUnfold, classResourceGrid, relicChoiceButton,
  selectionSectionFace,
} from '../components/creationCards.js';
import {
  el, eyebrow, subtitle, flavour, hairline, artWell, options, row, labelStack,
  button, buttonRow, modalHead, modalFooter, pane, statPair, railItem, categoryNav,
} from '../kit/index.js';
import {
  creationCategories, creationStep, creationFooterPlan, creationRailItems, creationAttributeColumns, creationCssProperties, creationFitsChoices, creationClassPreview,
} from '../models/CreationWorkspaceModel.js';
// The fold's own sentence is a row in content/source/uiStrings.csv, which is
// where #991 put the words this game says. This screen still carries plenty of
// copy in code — the baseline counts it — but a NEW sentence does not join it.
import { t } from '../strings.js';
import { clearSelection } from '../components/cardSelection.js';
import { mountCreationInfoLayer } from '../components/creationInfoLayer.js';
import { placeAnchored, placeGap, viewportLocalBox, anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { classAvailable, classUnlockRow } from '../../model/unlocks.js';

const CREATION_DERIVED_LABELS = Object.freeze({
  hp: 'HP',
  mana: 'MP',
  stamina: 'SP',
  energy: 'AP',
});
const CREATION_INSPECTION_LABELS = Object.freeze({
  hp: 'Health Points (HP)',
  mana: 'Mana Points (MP)',
  stamina: 'Stamina Points (SP)',
  energy: 'Action Points (AP)',
  ar: 'Attack Rating (AR)',
  dr: 'Defense Rating (DR)',
  pr: 'Power Rating (PR)',
});

function creationDerivedLabel(entry) {
  return CREATION_DERIVED_LABELS[entry.id] || entry.faceLabel;
}

/**
 * THE HAND A SOLO FIGHT DEALS, in place of the derived Draw row. Creation
 * starts a solo climb, and a solo fight's hand is the class's hand rules
 * (model/soloHand.js) — the derived Draw row only feeds co-op and headless
 * fights, so printing it here promised an opening hand the first turn did not
 * deal. Hand is the opening hand, Draw the cards each later turn adds; the
 * strip already wraps, so hand capacity rides in Hand's tooltip rather than
 * as a third chip.
 */
function creationHandRows(summary) {
  return [
    { id: 'hand', faceLabel: 'Hand', label: 'Opening hand', value: summary.opening,
      formula: `${summary.formulas.opening}. ${summary.formulas.capacity}.` },
    { id: 'turnDraw', faceLabel: 'Draw', label: 'Cards drawn each turn', value: summary.turn, formula: summary.formulas.turn },
  ];
}

/** `rows` with the derived Draw row replaced by the solo hand, where it stood. */
function withSoloHand(rows, summary) {
  const hand = creationHandRows(summary);
  const at = rows.findIndex((entry) => entry.id === 'draw');
  return at < 0 ? [...rows, ...hand] : [...rows.slice(0, at), ...hand, ...rows.slice(at + 1)];
}

/** Show or stash a live node. Inline display, not `hidden` alone — the kit's
 *  author display rules beat the UA `[hidden]` rule (disclosure.js measured it). */
function showNode(node, on) {
  if (!node) return;
  node.hidden = !on;
  node.style.display = on ? '' : 'none';
}

export function mountCustomize(app, {
  registries, meta = {}, defaultSeedString, onBack, onStart, catalog = false, shotPose = null, slot = null,
}) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  clearSelection();
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
      options([], { id: 'cz-classes', class: 'cc-choice-collection', dataset: { view: state.classChoiceView } }),
    ])),
  ]);
  split.style.setProperty('--split-share', `${state.classPreviewPercent}%`);

  const stages = {
    class: el('section', { id: 'cz-class-panel', class: 'as-pane flush cz-stage' }, split),
    character: el('section', { id: 'cz-character-panel', class: 'as-pane flush cz-stage' }, [
      el('div', { class: 'as-splitbody cc-character-grid', dataset: { spriteSide: spriteSide } },
        spriteSide === 'left' ? [previewSide, statsSide] : [statsSide, previewSide]),
    ]),
    equipment: el('section', { id: 'cz-equipment-panel', class: 'as-pane flush cz-stage' }, [
      el('div', { class: 'cc-equipment-header' }, [el('b', {}, 'Equipment'), el('select', { id: 'cz-equipment-section', 'aria-label': 'Equipment section' }), el('span', { id: 'cz-equipment-count' })]),
      el('div', { id: 'cz-equipment-fold', class: 'cc-equipment-fold cz-disc' }),
      el('div', { id: 'cz-equipment-receipts', class: 'cc-equip-group', 'aria-live': 'polite' }),
      flavour('An armament is one carried object. Choosing it for the other hand moves it.', { class: 'cc-move-note' }),
    ]),
    // W1c Review: the seed and journey, the destination slot, and a concise
    // summary of identity, loadout and derived values (filled on arrival).
    review: el('section', { id: 'cz-seed-panel', class: 'as-pane flush cz-stage', dataset: { stage: 'review' } }, [
      journeyRow, seedRow,
      slot == null ? null : row({ tag: 'div', setting: true, className: 'cc-destination-row', labelNode: labelStack({ label: t('creation.review.destination'), hint: t('creation.review.destination.hint') }), trail: el('span', { class: 'as-status cc-destination', text: t('creation.review.slot', { slot }) }) }),
      el('div', { id: 'cz-review-summary', class: 'as-stack cc-review' }),
    ]),
  };
  // The catalogue still lays every stage out in one column; the screen shows
  // one at a time inside the W1 pane below.
  const flow = el('div', { class: 'cz-flow cz-disc' }, catalog ? Object.values(stages) : []);
  const categories = creationCategories();
  for (const id of categories) {
    if (!stages[id]) throw new Error(`creation behavior.categories names '${id}', which is not a stage this screen draws (${Object.keys(stages).join(', ')})`);
  }
  const railItems = creationRailItems({
    categories, current: categories[0],
    labels: Object.fromEntries(categories.map((id) => [id, t(`creation.category.${id}`)])),
  }).map((entry) => {
    const item = railItem({ label: entry.label, member: entry.id, id: `cz-tab-${entry.id}`, className: 'cz-tab', attrs: { 'aria-controls': 'cz-pane' } });
    item.append(el('span', { class: 'cz-tab-value as-status' }));
    return item;
  });
  const rail = el('div', { class: 'as-rail cz-rail', role: 'tablist', 'aria-label': t('creation.categories'), 'aria-orientation': 'vertical', dataset: { surface: 'creationCategory' } }, railItems);
  const paneHost = el('div', { id: 'cz-pane', class: 'as-pane flush cz-pane', role: 'tabpanel' });
  const railed = el('div', { class: 'as-railed cz-railed', dataset: { classPreview: creationClassPreview() } }, [rail, paneHost]);

  // W1c head: one title, the small portrait, the exit. No eyebrow.
  const head = modalHead({
    eyebrow: catalog ? 'Component catalogue' : '',
    title: catalog ? 'Character creation components' : t('creation.title'),
    closeLabel: t('common.back'),
  });
  const close = head.querySelector('.modal-close');
  // The view switches live in the head, where the width is free, and only the
  // active category's shows (owner, 2026-09-19: no row spent on a toggle).
  const classTools = el('div', { id: 'cz-class-view-toggle', class: 'cz-head-tool' });
  const equipmentTools = el('div', { id: 'cz-equipment-view-toggle', class: 'cz-head-tool' });
  const headTools = el('div', { class: 'cz-head-tools' }, [classTools, equipmentTools]);
  if (catalog) { close.hidden = true; flow.prepend(headTools); }
  else {
    headTools.classList.add('cz-header-menu');
    headTools.setAttribute('popover', 'auto');
    const menu = el('button', { type: 'button', class: 'as-btn cz-menu-button', text: '\u2630', 'aria-label': 'Character menu', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    const navigation = el('div', { class: 'cz-menu-navigation' });
    for (const id of categories) {
      const item = el('button', { type: 'button', class: 'as-btn', text: t(`creation.category.${id}`) });
      item.addEventListener('click', () => { activate(id); headTools.hidePopover(); });
      navigation.append(item);
    }
    headTools.prepend(navigation);
    // THE BUTTON IS THE POPOVER'S INVOKER, NOT A HAND-ROLLED TOGGLE. It used
    // to call `togglePopover()` from a click listener, and with `popover=auto`
    // that cannot close: light dismiss runs on pointerup and shuts the menu,
    // then the click handler re-opens it. Measured on ?shot=customize at
    // 1200x730 with real CDP input, mouse and touch alike — open, open, open,
    // open; the menu could be summoned and never put away. `popovertarget`
    // hands the toggle to the browser, which knows an invoker from a stray
    // click. (quicknav's ☰ toggles correctly at the same door — true, false,
    // true — so this was this call site's bug, not the platform's.)
    headTools.id = 'cz-menu-popover';
    menu.setAttribute('popovertarget', headTools.id);
    // THE SCREEN MARGIN IS PASSED, NOT ASSUMED — flask.js's rule, and its
    // words: placeAnchored uses `pad` for the fit test AND for the bound, so
    // the cap below needs the same number rather than a literal matched
    // against the default by hand. quicknav writes the doubled `8` beside a
    // call that passes no `pad`; this follows flask, which is the one of the
    // two that homed it. That the recipe itself — "a dropdown under its
    // button, capped to the room below" — now has three call sites is real,
    // and flask.js already names the deferral ("Named, not touched"); lifting
    // it into fx.js is a change to quicknav and flask too, not this fix.
    const PAD = 4;
    // PLACED ON `toggle`, WHICH IS WHERE THE OPEN ACTUALLY HAPPENS. With the
    // browser owning the toggle there is no click handler to hang this on, and
    // an open by any other route — the keyboard, a future invoker — is placed
    // too rather than left wherever it was last.
    headTools.addEventListener('toggle', (event) => {
      menu.setAttribute('aria-expanded', String(headTools.matches(':popover-open')));
      if (event.newState !== 'open') return;
      // A DROPDOWN HANGING OFF ITS BUTTON, THROUGH THE ONE HOME FOR THAT.
      // This used to be its own arithmetic, and it read the zoom off the WRONG
      // ELEMENT: `getComputedStyle(document.documentElement).zoom`. The app is
      // zoomed by `body { zoom: var(--ui-zoom) }` (styles/base.css), and <html>
      // "is the one element the zoom does not touch" — so that read answered 1
      // at every UI size and the visual px of `getBoundingClientRect()` went
      // straight into `style.left`, a LOCAL px property. Measured through
      // tools/placement.mjs at 1920x1080 (--ui-zoom 1.48): the menu's box was
      // (1580.8,72.7)-(1800.8,304.7) in a 1297.3x729.7 room, its LEFT edge
      // alone 283 px past the right one, so none of it was on the glass. It
      // was open, sized and hit-testable the whole time — simply drawn where
      // nobody could see it, which reads as a button that does nothing.
      // `position: fixed` does not escape the zoom (EldenSpire#15); fx.js is
      // the one home for the conversion.
      const view = viewportLocalBox();
      const anchor = anchorLocalBox(VIEWPORT_ORIGIN, menu);
      // THE CAP IS COMPUTED BEFORE THE PLACEMENT, AND THAT ORDER IS THE POINT.
      // Capping afterwards — what flask.js and quicknav.js both do — means
      // placeAnchored measures the menu at its FULL height, finds it does not
      // fit under a short window's button, and slides it up OVER the button
      // before the cap ever applies. Measured at 1200x260 with the cap last:
      // menu top 4.0 against a button bottom of 58.0 — `intent: 'under'` asked
      // for, and the menu sitting on the control that summoned it. Capped
      // first, the box placeAnchored measures is the box that will be drawn,
      // it fits under the button by construction, and the categories scroll
      // inside it instead. Recomputed from the room on every open, so no cap
      // this wrote before can be measured as this open's box.
      headTools.style.maxHeight = `${Math.max(0, view.height - (anchor.top + anchor.height + placeGap(headTools)) - PAD * 2)}px`;
      placeAnchored(headTools, menu, { intent: 'under', align: 'end', view, pad: PAD });
    });
    close.querySelector('.modal-close-face').textContent = '\u00d7';
    close.before(portrait, menu, headTools);
  }
  const back = button({ label: t('common.back'), role: 'exit', id: 'cz-back' });
  const next = button({ label: t('creation.next'), id: 'cz-next', weight: 'primary', className: 'cz-next-stage' });
  const start = button({ label: 'Begin', id: 'cz-start', weight: 'primary' });
  const foot = modalFooter({ note: catalog ? 'Choose your path. The spire remembers.' : '', secondary: [back], primary: start, size: 'medium', className: 'cz-actions' });
  if (!catalog) foot.querySelector('.modal-foot-actions').insertBefore(next, start);
  const body = el('div', { class: 'modal-body cz-scroll' }, [
    catalog ? subtitle('Interactive production specimens for every creation section, nested disclosure, and reusable selector card.', { class: 'cc-catalog-intro' }) : null,
    catalog ? flow : railed,
  ]);
  // ONE page door, the kit's, on its `full` rung (kit.css PAGE DOOR).
  const door = el('section', {
    class: 'modal as-pagedoor full', dataset: { size: 'xl' }, role: 'region',
    'aria-label': catalog ? 'Character creation components' : 'Prepare your Forsaken',
  }, [head, body, foot]);
  app.replaceChildren(el('div', { class: `screen customize as-page${catalog ? ' component-catalog' : ''}` }, door));

  // W1c: only the active stage is in the document; the others wait, built,
  // off it. A lookup reaches them all so the renderers need not know which.
  const $ = (selector) => app.querySelector(selector)
    || Object.values(stages).map((stage) => (stage.matches(selector) ? stage : stage.querySelector(selector))).find(Boolean)
    || null;
  const customizeScreen = $('.screen.customize');
  mountCreationInfoLayer(customizeScreen);
  // Every --creation-* the W1c CSS reads, from the model (uiConfig.screens.creation); kit.css names no number for this screen.
  for (const [property, value] of Object.entries(creationCssProperties())) customizeScreen.style.setProperty(property, value);
  const classBox = $('#cz-classes');
  const statBox = $('#cz-statedit');
  // THE EDITABLE MODE IS DATA, NOT A LITERAL (plan phase 9). This screen used
  // to name 'pointbuy' as the one mode with points to place and 'standard' as
  // the preset it previewed from. The rebase made `tuned2` both, and two
  // hard-coded ids would have left the advertised ten placeable points
  // uneditable while the preview showed a retired mode's character (Codex,
  // #1217). Both now resolve from attributeRules.defaultMode, which is the
  // mode creation offers.
  const EDITABLE = defaultCreationModeId(registries);
  /**
   * Which mode a PLAYER has points to place in. The two aliases this replaced
   * (`STANDARD` and `POINTBUY`, both equal to the default mode) made every
   * `mode.id === POINTBUY` branch tautological and its `else` unreachable, so
   * the day a second mode returns to `visibleModeIds` the preview would price
   * it with the default mode's preset and a preset-only mode would be routed
   * into the point editor — silently, because nothing reads wrong today
   * (review, #1217). The real question is whether the mode has a pool.
   */
  const hasPoints = (modeId) => !!modeId && creationModeHasPoints(creationMode(registries, modeId));
  /** Does choosing this mode seat the class preset (Standard) rather than
   *  open the editor on the baseline (Assign points)? Data: `opensOn`. */
  const opensOnPreset = (modeId) => !!modeId && creationMode(registries, modeId).opensOn === 'preset';
  // Which sections have their starting-card fold open, for the life of this
  // screen. renderEquipment rebuilds the detail pane on every choice, so a
  // fold with no memory is one a player has to re-open after every tap.
  const packageOpen = new Map();
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
    const toggle = viewModeToggle;
    $('#cz-class-view-toggle').replaceChildren(toggle(state.classChoiceView, (mode) => {
      state.classChoiceView = mode;
      if (!catalog) headTools.hidePopover();
      renderClasses();
      fitStage();
    }, 'Class choice view'));
    $('#cz-equipment-view-toggle').replaceChildren(toggle(state.equipmentChoiceView, (mode) => {
      state.equipmentChoiceView = mode;
      if (!catalog) headTools.hidePopover();
      // THE TOGGLE REDRAWS THE CHIPS, as the class toggle above already does.
      // Setting `data-view` on the containers was enough while the view was
      // only a CSS arrangement of the same faces; a view now SELECTS a
      // presentation level (src/model/cardFields.js), and the level is read
      // when a face is built. Leaving the old chips in place would show grid's
      // arrangement with list's fields, which is the drift the one-vocabulary
      // design exists to make impossible. `renderEquipment` rebuilds each
      // container with the current view on it, so the old sweep is not a
      // second place that has to agree.
      //
      // AND IT HANDS BACK THE SECTION THE PLAYER HAD OPEN. `renderEquipment`
      // re-opens the fold only when it is TOLD which section to open
      // (`preferredOpenId`, below); called bare it rebuilds every section
      // closed. So switching the view shut the picker: all four containers
      // collapsed to zero width with their chips still inside them, and the
      // step rendered empty at every size. Measured on dev before this fix —
      // grid read `312:2` for the open section, list read `0:2` for all four.
      // Changing how the choices are ARRANGED must not change which of them
      // you are looking at.
      renderEquipment(equipmentFold?.openKey || null);
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
    state.attributes = baselineAttributeAllocation(registries, state.attributeMode || EDITABLE);
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
    // A NEW CLASS IS A NEW ALLOCATION: the preset a class is biased toward is
    // not the one the next class wants, so the points go back and the mode
    // returns to unchosen, which puts the placeholder back and makes choosing
    // it again a fresh allocation.
    // ONLY IN THE GATED FLOW. This function runs at mount too, and the
    // component catalogue deliberately mounts PRESELECTED — its specimens
    // need a chosen state to draw (the note at the head of this screen). With
    // the mode aliased to the one editable mode, clearing it here blanked the
    // catalogue's own seed on the first call: the stat rows, the resources
    // and the continue row stopped drawing, and catalogue Begin — which reads
    // statsProblem() without modeProblem() — went green on an empty mode that
    // createRunState refuses by name (review, #1217).
    if (gated && hasPoints(state.attributeMode)) { state.attributeMode = ''; state.attributes = null; }
  }

  // ---- what each step still needs ------------------------------------------
  // One reason per step, read by that step's Continue AND by Begin, so the
  // foot and the section can never disagree about what is missing.
  function classProblem() { return state.classChosen ? null : 'Choose a class.'; }
  function modeProblem() { return state.attributeMode ? null : 'Choose how to assign your stats.'; }
  function keepsakeProblem() { return state.keepsakeId ? null : 'Choose a keepsake.'; }
  function armourProblem() { return state.startingArmourId ? null : 'Choose starting armour.'; }
  /** The stats step: the mode, then a complete and legal allocation. */
  function statsStepProblem() { return modeProblem() || allocationProblem(); }
  function characterProblem() { return statsStepProblem() || keepsakeProblem(); }
  function equipmentProblem() { return armourProblem() || handsProblem(); }
  function flowProblem() { return classProblem() || characterProblem() || equipmentProblem(); }

  function pointbuyMode() { return creationMode(registries, state.attributeMode || EDITABLE); }
  function remainingPoints() {
    if (!state.attributes) return pointbuyMode().bonusPool;
    return allocationTotal(registries, state.attributeMode || EDITABLE) - Object.values(state.attributes).reduce((sum, value) => sum + value, 0);
  }
  /** The point-buy alone: the pool spent exactly, every stat in bounds. */
  function allocationProblem() {
    if (!hasPoints(state.attributeMode) || !state.attributes) return null;
    const remaining = remainingPoints();
    if (remaining !== 0) return remaining > 0
      ? `${remaining} stat point${remaining === 1 ? '' : 's'} still to assign.`
      : `${-remaining} stat point${remaining === -1 ? '' : 's'} over the pool.`;
    const problems = attributeAllocationProblems(registries, state.classId, state.attributeMode, state.attributes);
    return problems.length ? problems[0].msg : null;
  }
  /** The attributes the run would begin with: a complete point-buy, else the
   *  class preset for the chosen mode (Standard until one is chosen). */
  function effectiveAttributes() {
    if (hasPoints(state.attributeMode) && state.attributes && !allocationProblem()) return state.attributes;
    return classAttributePreset(registries, state.classId, state.attributeMode || EDITABLE);
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

  /** The rules this character's solo fight would be handed (engine/runCombat.js). */
  function creationHandRules(run) {
    return soloHandRules(registries, run.class, meta.settings);
  }
  function creationHandSummary(run) {
    return soloHandSummary(creationHandRules(run), run.attributes,
      (id) => registries.attributes.get(id)?.shortLabel || id);
  }
  function previewRun() {
    // Validate the live allocation independently of weapon requirements.
    // An incomplete draft previews from its OWN mode's class preset — not
    // from some other mode's, which is what the retired `STANDARD` alias
    // would have meant the day a second mode returned.
    const previewMode = state.attributeMode || EDITABLE;
    const hasCompletePointBuy = hasPoints(state.attributeMode) && state.attributes
      && attributeAllocationProblems(registries, state.classId, state.attributeMode, state.attributes).length === 0;
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
        : paintedFigure(state.classId, tintCss(state.tint), state.glyph, state.startingArmourId, 'portrait'))
      : null;
    portrait.replaceChildren(sprite || state.glyph);

    const run = previewRun();
    const projection = statProjection(registries, run);
    $('#cz-primary-stats').replaceChildren(...primaryStatCards(attributeCardModels(registries, run.attributes, {
      projection,
      equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
      hand: creationHandRules(run),
    })));
    const poise = playerPoiseThresholdReceipt(registries, run);
    const ratings = equipmentKitReceipt(registries, run.loadout, run.class, run.attributes, run.equipmentProfileRuleSnapshot);
    const ratingRows = [['attack', 'AR', 'Attack'], ['guard', 'DR', 'Defense']].map(([role, faceLabel, label]) => {
      const rating = ratings.find(row => row.role === role);
      return { id: `${role}Rating`, faceLabel, value: rating?.receipt.value ?? 0,
        formula: `${label} rating · ${rating?.profile.displayName || 'Unarmed'} · before card-specific modifiers.` };
    });
    // resourceStrip drops the derived `poise` row itself and appends the whole
    // threshold as one chip; this call only renames three faces.
    const resources = withSoloHand(projection.derived
      .map(entry => ({ ...entry, faceLabel: creationDerivedLabel(entry) })), creationHandSummary(run));
    $('#cz-derived').replaceChildren(resourceStrip([...resources, ...ratingRows], poise));
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
    const resources = classResourceGrid(projection.derived.slice(0, 5));
    if (!catalog && creationClassPreview() === 'unfold') {
      // THE CHOSEN CARD UNFOLDS (owner, 2026-09-19): no preview column; the
      // picked card opens to the portrait and the summary. Before a pick the
      // pointer-follow has nothing to draw.
      for (const open of classBox.querySelectorAll('.cz-class.unfolded')) { open.classList.remove('unfolded'); open.querySelector('.cc-class-unfold')?.remove(); open.removeAttribute('aria-describedby'); }
      const card = state.classChosen ? classBox.querySelector(`.cz-class[data-class="${state.classId}"]`) : null;
      if (card) {
        const unfold = classUnfold({ cls, sprite, resources, relic });
        card.classList.add('unfolded');
        card.append(unfold);
        card.setAttribute('aria-describedby', unfold.id); // the button's description: the resources and the relic
      }
      $('#cz-class-preview-host').replaceChildren();
      return;
    }
    const previewPane = classPreviewPane({
      cls, sprite,
      resources,
      relic,
      relicDescription: relicText(relic, registries),
    });
    $('#cz-class-preview-host').replaceChildren(previewPane);
  }

  function renderModes() {
    const modes = el('select', { class: 'se-modes cc-mode-select', 'aria-label': 'Attribute mode' });
    modes.append(el('option', { value: '', disabled: true, selected: !state.attributeMode }, 'Choose stat allocation'));
    for (const mode of visibleModes) {
      modes.append(el('option', { value: mode.id, selected: state.attributeMode === mode.id }, mode.label));
    }
    modes.value = state.attributeMode || '';
    modes.addEventListener('change', () => {
        const mode = visibleModes.find(mode => mode.id === modes.value);
        if (!mode) return;
        // What was chosen BEFORE this change, so Cancel on a fresh Assign
        // points puts it back (review of #1294): Standard → Assign points →
        // Cancel used to land on unchosen, the Standard preset thrown away.
        const previous = { mode: state.attributeMode, attributes: state.attributes ? { ...state.attributes } : null };
        state.attributeMode = mode.id;
        if (opensOnPreset(mode.id)) {
          // STANDARD SEATS THE CLASS PRESET (owner, 2026-09-24: "standard (pre
          // assigned class presets)"). Nothing is left to spend, so no editor
          // opens and the step's Continue is green at once; "Edit points"
          // still reshapes the same fixed total as a revision.
          closePointBuy();
          state.attributes = { ...classAttributePreset(registries, state.classId, mode.id) };
        } else if (hasPoints(mode.id)) {
          // Entering Assign Points from the SELECT is an explicit fresh
          // allocation: the whole authored pool comes back rather than the
          // class-biased preset (or a previous edit) with points already
          // spent. Reopening it from "Edit points" is a revision instead.
          openPointBuy({ fresh: true, previous });
        } else {
          closePointBuy();
        }
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
    });
    // THE WAY BACK INTO THE POINTS. The select is the only door-opener, and
    // with one visible mode it can never fire `change` twice: once an
    // allocation was committed the editor was unreachable, so a player who
    // reached the Equipment step and was told "Ash Staff needs intelligence 8
    // — you have 3" had no path back to the stats short of changing class
    // (which discards keepsake, armour, hands and relic) or leaving creation
    // (review, #1217). This button is that path, and it is a revision: the
    // committed numbers are on the steppers and Cancel puts them back.
    const editPoints = el('button', {
      type: 'button', class: 'as-btn cc-mode-edit', text: 'Edit points',
      'aria-label': 'Edit your stat allocation',
    });
    editPoints.addEventListener('click', () => openPointBuy({ fresh: false }));
    statBox.replaceChildren(modes, editPoints);
    // Until a mode is chosen the section is the question alone: the stat rows,
    // the resources and the way on appear with the answer.
    const chosen = Boolean(state.attributeMode);
    // The editor only reopens what a chosen mode owns, and only the editable
    // mode has points to edit at all.
    showNode(editPoints, chosen && hasPoints(state.attributeMode));
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
  // shell's. What this screen adds is policy: what Escape MEANS here (the
  // same as Cancel), the Tab ring, and scoping the page behind it.
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

  /**
   * `fresh` separates the TWO WAYS IN, which want opposite things of Cancel.
   * Choosing the mode is a fresh allocation: the pool comes back whole and
   * cancelling returns to unchosen. Pressing "Edit points" on a committed
   * allocation is a revision: the current numbers stay on the steppers and
   * cancelling puts back exactly what was there, because a player who opens
   * their own stats to look at them must not lose them by pressing Cancel.
   */
  function openPointBuy({ fresh = true, previous = null } = {}) {
    closePointBuy({ restoreFocus: false });
    // Taken BEFORE the reset below, which fills a null allocation in: read
    // after it, a revision opened on no allocation (the catalogue's
    // preselected mode) looked like a fresh one and Cancel then left the
    // baseline with points unplaced (review, #1255).
    const priorMode = state.attributeMode;
    const priorAttributes = state.attributes ? { ...state.attributes } : null;
    if (fresh || !state.attributes) resetAttributes();
    pointBuyReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    customizeScreen.inert = true;
    const mode = pointbuyMode();
    const rowsNow = () => {
      const remaining = remainingPoints();
      // THE PREVIEW RUN'S OWN PROJECTION, for the reason the shrine's card
      // needs one (rest.js): the point-buy modal is where the points are
      // placed, and without a projection the card reads the authored tier
      // rather than the one the creation mode actually converts at.
      const preview = previewRun();
      const rules = preview.equipmentProfileRuleSnapshot?.profiles;
      const cards = new Map(attributeCardModels(registries, state.attributes, {
        projection: statProjection(registries, preview),
        equipmentProfiles: rules,
        hand: creationHandRules(preview),
      }).map((card) => [card.id, card]));
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
      cancelLabel: 'Cancel',
      doneLabel: 'Continue',
      rows: rowsNow(),
      onDecrease: (id) => step(id, -1),
      onIncrease: (id) => step(id, 1),
      onCancel: () => { door.outcome = 'cancel'; allocation.close(); },
      onClose: () => {
        const outcome = door.outcome; // null: the shell dismissed it (Escape, the veil) — that is Cancel
        const restore = door.restoreFocus;
        teardownPointBuy();
        if (outcome === 'reopen') return;
        if (outcome === 'done') {
          renderCharacterPreview(); refreshFaces(); updateStartRefusal();
          advanceToKeepsake({ focus: restore });
          return;
        }
        // CANCEL UNDOES THE WAY IN. Creation offers one mode since the
        // rebase (plan phase 9), so "cancel" can no longer mean "take the
        // other one": re-selecting the value already in the select fires no
        // change event, so the editor could never reopen, while the reset
        // allocation left points unplaced and Continue refused for good
        // (Codex, #1217). A FRESH allocation therefore returns to unchosen —
        // the placeholder comes back and choosing the mode again starts
        // over. A REVISION puts back the allocation it opened, so looking at
        // your own stats and changing your mind costs nothing (review,
        // #1217).
        // A fresh allocation entered FROM ANOTHER CHOSEN MODE (Standard →
        // Assign points) puts that choice back, preset and all: Cancel undoes
        // the switch, it does not also undo the answer given before it.
        if (!fresh) {
          state.attributeMode = priorMode;
          state.attributes = priorAttributes;
        } else if (previous?.mode && previous.attributes) {
          state.attributeMode = previous.mode;
          state.attributes = previous.attributes;
        } else {
          state.attributeMode = '';
          state.attributes = null;
        }
        renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        if (restore) {
          const chooser = statBox.querySelector('.cc-mode-select');
          chooser?.focus(); focusElement(chooser);
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
    // Plan phase 5c: a class card the profile has not earned is listed locked,
    // with its unlock's hint; every shipped class is free until a row gates it.
    const cards = registries.classes.all().map((cls) => classChoiceCard(cls, {
      selected: state.classChosen && cls.id === state.classId,
      visual: classGlyph(cls.id),
      locked: !classAvailable(registries.unlocks, cls.id, meta),
      hint: classAvailable(registries.unlocks, cls.id, meta) ? null : (classUnlockRow(registries.unlocks, cls.id) || {}).hint || null,
      onChoose: () => {
        if (state.classChosen && state.classId === cls.id) return;
        state.classId = cls.id; state.classChosen = true; resetClassChoices();
        renderClasses(); renderEquipment(); renderModes(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        fitStage();
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
        state.classId = id; resetClassChoices(); renderClassPreview(); fitStage();
      });
    }
    for (const cls of LOCKED_CLASSES) cards.push(classChoiceCard(cls, { locked: true, visual: classGlyph(cls.id) }));
    classBox.replaceChildren(...cards);
    renderViewToggles();
    // The cards are new nodes; in unfold mode the chosen one opens again.
    if (!catalog && state.classChosen && creationClassPreview() === 'unfold') renderClassPreview();
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
      box.dataset.many = String(section.choices.length > 2);
      const node = el('section', { class: 'cc-equip-group', dataset: { equipmentSection: section.id } }, box);
      equipmentNodes.set(section.id, node);
      const detailPane = el('div', { class: 'cc-equipment-details card-inspection-details', 'aria-live': 'polite' });
      node.append(detailPane);
      const isSelected = piece => section.kind === 'relic' ? piece.id === state.startingRelicId : section.kind === 'armour'
        ? piece.id === state.startingArmourId : section.kind === 'hand'
          ? state.startingHands[section.slot] === piece.id : state.startingSlotChoices[section.id] === piece.id;
      const showDetails = piece => {
        detailPane.dataset.previewItem = piece.id || 'empty-hand';
        detailPane.replaceChildren(compactEquipmentDetails(piece.name, (section.kind === 'relic' ? renderCollectibleCard(registries, piece, 'Relic', { interactive: false, inspection: false }) : renderEquipmentCard(registries, piece, { interactive: false, inspection: false, presentation: piece.emptyHand ? EMPTY_HAND_PRESENTATION : null })).explanations));
        if (section.kind === 'hand') {
          const hands = selectStartingHand(state.startingHands, section.slot, piece.id);
          const preview = startingEquipmentPreview(registries, previewRun(), hands, section.slot);
          const grid = el('div', { class: 'cc-starting-card-grid', 'aria-label': `${piece.name} starting combat cards` });
          for (const { ref, count } of preview.cards) {
            // Small, because inside the fold these are a reference rather than
            // a thing to choose between: the choice is the armament above.
            // NOT `small: true`: that flag's only effect is a 0.92 transform, which
            // `.cc-starting-card > .card` cancels — and a transformed card keeps its
            // untransformed box, so it would save no scroll even if it applied. The
            // fold sizes these faces in CSS, where a smaller box is a smaller box.
            const face = renderCard(registries, ref);
            const entry = el('div', { class: 'cc-starting-card', dataset: { cardId: ref.cardId, quantity: String(count) } }, [
              el('span', { class: 'cc-card-quantity' }, `${count} ${count === 1 ? 'copy' : 'copies'}`), face,
            ]);
            grid.append(entry);
          }
          // THE DECK IS SUMMARISED, NOT DUMPED (Constantine, 2026-09-12:
          // *"some of the card details probably can be folded ... and the
          // continue button always in view and not requiring too much
          // scrolling"*).
          //
          // MEASURED, because the first attempt at this was measured in the
          // wrong state and looked inert. Opening the right-hand section at
          // 390x844 took the creation scroll from 838px to 3010px — +2172px,
          // nearly four screens, for six card faces drawn at full size between
          // the armament you are choosing and the way on. At 1280x800 it is
          // +525px. The count and the kinds are what a player compares two
          // weapons on; the faces are what they want once they have chosen to
          // look.
          //
          // So the summary is the face and the grid is the reveal, closed until
          // asked. `packageOpen` remembers the answer per section for the life
          // of the screen: renderEquipment repaints this pane on every choice,
          // and a fold that forgets is one you re-open after every tap.
          // DISTINCT CARDS, NOT BROAD TYPES. This counted `type` — attack, skill,
          // power — and the summary exists so a player can compare two armaments
          // WITHOUT opening the fold, which that number cannot do: measured on a
          // Reaver, the straight sword and the greatsword both resolve to exactly
          // {attack, skill}, so both read "2 kinds" and the line said the same
          // thing about two different weapons. Counting distinct cardIds says 3
          // for each, and what actually differs — Guard Counter against Sundering
          // Hew — is the named card behind the fold.
          const kinds = new Set(preview.cards.map(({ ref }) => ref.cardId).filter(Boolean));
          const summary = preview.cards.length
            ? `Adds ${preview.total} ${preview.total === 1 ? 'card' : 'cards'}`
              + (kinds.size ? ` · ${kinds.size} ${kinds.size === 1 ? 'kind' : 'kinds'}` : '')
            : 'Adds no combat cards with the other hand as it stands';
          const fold = el('details', { class: 'cc-starting-fold' });
          if (packageOpen.get(section.id)) fold.open = true;
          // A CARD MEASURED WHILE HIDDEN WAS NEVER MEASURED. renderCard schedules
          // its one fit for the next frame, and inside a closed `<details>` that
          // frame reads zeros — so `data-name`, `data-tag-rows` and above all
          // `data-truncated` are written from nothing, and only an unrelated
          // resize or a font load ever corrects them.
          //
          // MEASURED at 390x844 on opening the fold: all four faces read
          // tag-rows 1 / truncated false. Forcing a re-fit at their real 90px
          // width turns three of them to tag-rows 2 and flips ONE to truncated
          // — a card whose text is clipped, wearing no chevron. That chevron is
          // the whole affordance #987 and #998 exist for.
          //
          // So the fold asks for the fit when it opens. This is the same
          // zero-rect trap that made an earlier probe of mine report a hidden
          // button as on-screen, and that the equipment QA was walking into.
          const refitCards = () => { if (preview.cards.length) scheduleCardFits(grid.querySelectorAll('.card')); };
          fold.addEventListener('toggle', () => {
            packageOpen.set(section.id, fold.open);
            if (fold.open) refitCards();
          });
          // THE FOLD IS NOT THE ONLY THING THAT CAN BE HIDING THESE CARDS.
          // A fold restored open — the player had it open, went back to Class,
          // changed class, and returned — is built ALREADY OPEN while the
          // equipment stage itself is still shut, so its toggle never fires
          // while the cards are measurable, and revealing the outer section
          // does not toggle the inner fold. Same zeros, a different ancestor.
          //
          // Rather than chase each ancestor that could be shut, ask the one
          // question that actually matters: when do these cards HAVE A BOX?
          // A ResizeObserver answers exactly that — a hidden element reports
          // 0x0 and reports a real size the moment it is rendered — whichever
          // thing was hiding it. It disconnects on the first answer, so it is
          // one shot per restored-open fold, not a standing subscription on a
          // pane renderEquipment repaints after every choice.
          //
          // AN INTERSECTION OBSERVER WAS TRIED FIRST AND DOES NOT WORK, which
          // is worth the line: it asks whether the element is ON SCREEN, and
          // a restored fold is rendered far below the fold of a long section,
          // so it never intersects and never fires. Measured: the cards stayed
          // at the hidden-measure values until an unrelated resize. Rendered
          // and visible are not the same question.
          if (fold.open && preview.cards.length && typeof ResizeObserver === 'function') {
            const measurable = new ResizeObserver((entries, self) => {
              if (!entries.some((entry) => entry.contentRect.height > 0)) return;
              self.disconnect();
              refitCards();
            });
            measurable.observe(grid);
          }
          fold.append(
            el('summary', { class: 'cc-starting-summary' }, [
              el('b', { text: summary }),
              el('small', { class: 'cc-package-context', text: t('creation.startingCards.context') }),
            ]),
            preview.cards.length ? grid : el('p', {}, 'This choice adds no combat cards with the other hand currently selected.'),
          );
          detailPane.append(el('section', { class: 'cc-starting-package' }, [
            el('h4', {}, 'Starting combat cards'),
            fold,
          ]));
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
        // THE VIEW SELECTS A LEVEL; it does not own a field set. Grid is a
        // wall of candidates to tell apart, so it asks for `glance`; list is
        // one card at a time with room to read, so it asks for `focus`. The
        // mapping is one line in src/model/cardFields.js rather than a second
        // authored table per view — views x levels x surfaces is the shape
        // this design exists to avoid.
        const chipButton = pieceChip(registries, piece, { selected: isSelected(piece), kind: section.kind === 'relic' ? 'Relic' : null, presentation: piece.emptyHand ? EMPTY_HAND_PRESENTATION : null, level: 'glance' });
        const face = chipButton.querySelector('.equipment-poker-card');
        choiceRows.push({ piece, node: chipButton, face });
        face.addEventListener('cardinspectionselect', () => {
          if (section.kind === 'relic') state.startingRelicId = piece.id;
          else if (section.kind === 'armour') state.startingArmourId = piece.id;
          else if (section.kind === 'hand') state.startingHands = selectStartingHand(state.startingHands, section.slot, piece.id);
          else state.startingSlotChoices[section.id] = piece.id;
          for (const refresh of refreshers) refresh();
          focusChoice(piece); renderEquipmentSummary(); renderCharacterPreview(); refreshFaces(); updateStartRefusal();
        });
        face.addEventListener('keydown', event => {
          if (event.target.classList.contains('equipment-poker-card') && ['Enter', ' '].includes(event.key)) {
            event.preventDefault(); face.dispatchEvent(new CustomEvent('cardinspectionselect'));
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
          // `selected` on the face is the inspection hook (it reveals the info
          // button); the chosen ring, the quiet button and the spoken note are
          // one call, so they cannot drift apart.
          row.face.classList.toggle('selected', selected);
          setPieceChipChosen(row.node, selected);
        }
        const chosen = section.choices.find(isSelected);
        if (chosen) focusChoice(chosen);
      };
      refreshers.push(refresh); refresh();
      const next = equipmentSectionViews.find(row => row.id === section.nextId);
      const nextLabel = next ? next.label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) : 'Seed';
      // Armour waits for a pick; a hand waits for a weapon the stats can
      // wield; the last section's button is plain — Begin is what goes green.
      const sectionProblem = () => !next ? equipmentProblem() : (section.kind === 'armour' ? armourProblem()
        : section.kind === 'hand' ? handProblem(section.slot) : null);
      const continueButton = button({ label: `Continue to ${nextLabel}`, weight: next ? 'primary' : 'secondary', className: 'cc-equipment-continue' });
      equipmentGateRefreshers.push(refusesWhen(continueButton, sectionProblem, `On to ${nextLabel.toLowerCase()}.`));
      continueButton.addEventListener('click', () => {
        if (sectionProblem()) return;
        if (next) openEquipmentSection(next.id);
        else advanceFrom('equipment');
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
    const selector = $('#cz-equipment-section');
    selector.replaceChildren(...equipmentSectionViews.map(section => el('option', { value: section.id }, section.label.toLowerCase().replace(/^./, c => c.toUpperCase()))));
    selector.onchange = () => openEquipmentSection(selector.value);
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
  function characterSummaryResources(projection, poise, hand) {
    const resources = withSoloHand(projection.derived
      .filter(entry => entry.id !== 'poise')
      .map(entry => ({ ...entry, faceLabel: creationDerivedLabel(entry) })), hand)
      .map(entry => ({
        id: entry.id,
        label: entry.faceLabel,
        inspectionLabel: CREATION_INSPECTION_LABELS[entry.id] || entry.label || entry.faceLabel,
        value: entry.value,
        explanation: entry.formula,
      }));
    resources.push({
      id: 'poise',
      label: 'Poise',
      inspectionLabel: 'Poise',
      value: poise.value,
      explanation: poise.note,
    });
    if (poise.ratings) {
      for (const id of ['ward', 'ar', 'dr', 'pr']) {
        resources.push({
          id,
          label: id === 'ward' ? 'Ward' : id.toUpperCase(),
          inspectionLabel: CREATION_INSPECTION_LABELS[id] || 'Ward',
          value: poise.ratings[id],
          explanation: null,
        });
      }
    }
    return resources;
  }
  function characterSummaryGrid(rows, ariaLabel, { limit = Infinity, expanded = false } = {}) {
    const visible = rows.slice(0, limit);
    const pairs = visible.map((entry) => {
      const pair = statPair({
        key: expanded ? entry.inspectionLabel || entry.label : entry.label,
        value: String(entry.value),
        attrs: { role: 'listitem', dataset: { stat: entry.id } },
      });
      if (entry.explanation) attachTooltip(pair, () => esc(entry.explanation));
      return pair;
    });
    if (visible.length < rows.length) {
      pairs.push(el('span', {
        class: 'cc-summary-more',
        role: 'listitem',
        'aria-label': `${rows.length - visible.length} more stats available in Information`,
        text: '…',
      }));
    }
    return el('div', { class: 'cc-summary-stats', role: 'list', 'aria-label': ariaLabel }, pairs);
  }
  function characterSummaryCard(run, projection, inspection = false) {
    const cls = registries.classes.get(state.classId);
    const name = state.name || 'Forsaken';
    const attributes = orderedAttributes(registries).map((def) => ({
      id: def.id,
      label: def.shortLabel,
      inspectionLabel: `${def.label} (${def.shortLabel})`,
      value: run.attributes[def.id],
    }));
    const resources = characterSummaryResources(
      projection,
      playerPoiseThresholdReceipt(registries, run),
      creationHandSummary(run),
    );
    const card = el('article', {
      class: 'cc-summary-character',
      'aria-label': `${name} character card`,
      dataset: { summaryLevel: inspection ? 'inspect' : 'glance' },
    }, [
      el('span', { class: 'cc-summary-eyebrow', text: cls.name }),
      el('p', { class: 'cc-summary-name', text: name }),
      hairline(),
      characterSummaryGrid(attributes, 'Primary stats', inspection ? { expanded: true } : undefined),
      hairline(),
      characterSummaryGrid(resources, 'Derived resources', inspection
        ? { expanded: true }
        : { limit: 6 }),
    ]);
    if (!inspection) {
      bindCardInspection(card, {
        title: `${name} — ${cls.name}`,
        identity: 'creation-character-summary',
        open: opener => {
          const explained = resources.filter((entry) => entry.explanation);
          const details = el('div', { class: 'cc-summary-inspection-details' }, [
            el('h3', { text: 'Derived stat calculations' }),
            el('dl', {}, explained.map((entry) => [
              el('dt', { text: `${entry.inspectionLabel || entry.label} ${entry.value}` }),
              el('dd', { text: entry.explanation }),
            ])),
          ]);
          return openCardInspection({
            title: `${name} — ${cls.name}`,
            card: characterSummaryCard(run, projection, true),
            details,
            opener,
          });
        },
      });
    }
    return card;
  }
  function fillSummary(host = summaryBody) {
    const run = previewRun();
    const projection = statProjection(registries, run);
    const surface = equipmentSurfaceReceipt(registries, run);
    // The summary is a row of slots you SCAN to check your loadout, not one you
    // read — same level, and therefore same size, as the picker you chose from.
    // Same SURFACE too: these slots stand on the character-creation screen, so
    // they take that screen's glance patch (`card.json` surfaces.creation adds
    // `footer`) and show the same regions the chip you picked did. Omitting it
    // would have made the summary a quieter card than its own picker for no
    // reason anyone authored.
    const summaryCard = { interactive: false, level: 'glance', surface: 'creation' };
    const armament = (id) => registries.equipment.armaments.find((row) => row.id === id) || null;
    const slots = [
      { key: 'character', label: 'Character', node: characterSummaryCard(run, projection) },
    ];
    const armour = registries.equipment.armour.find((row) => row.classId === state.classId && row.id === state.startingArmourId);
    slots.push({ key: 'armour', label: 'Armour', node: armour
      ? renderEquipmentCard(registries, armour, { ...summaryCard, identity: 'creation-summary:armour' }).card
      : null, empty: 'Not chosen yet' });
    const handSlot = (slot, label) => {
      const piece = armament(state.startingHands[slot]);
      const options = { ...summaryCard, identity: `creation-summary:${slot}` };
      const node = piece
        ? renderEquipmentCard(registries, piece, options).card
        : renderEquipmentCard(registries, { id: 'empty-hand', name: 'Empty Hand', emptyHand: true }, { ...options, presentation: EMPTY_HAND_PRESENTATION }).card;
      return { key: slot, label, node, unmet: piece ? handProblem(slot) : null };
    };
    slots.push(handSlot('rightHand', 'Main hand'));
    if (state.startingHands.leftHand) slots.push(handSlot('leftHand', 'Off hand'));
    const relic = registries.relics.get(state.startingRelicId);
    slots.push({ key: 'relic', label: 'Relic', node: relic
      ? renderCollectibleCard(registries, relic, 'Relic', { ...summaryCard, identity: 'creation-summary:relic' }).card
      : null, empty: 'None' });
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
    host.replaceChildren(cards, calculations);
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
    $('#cz-equipment-section').value = id;
    const section = equipmentSectionViews.find(row => row.id === id);
    $('#cz-equipment-count').textContent = `${section?.choices.length || 0} options`;
    updateStartRefusal();
    const pane = $('#cz-pane'); if (pane) pane.scrollTop = 0;
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
    { key: 'review', label: 'REVIEW', node: panels.review, value: () => seedInput.value.trim() || '—' },
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
      hand: creationHandRules(specimenRun),
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
      { key: 'sample-primary', kind: 'pick', disclosure: 'face', face: { label: 'PRIMARY STATS', value: 'Assign points' }, reveal: { node: disclosureStat, sense: 'Edit primary stats.' } },
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
    // Both branches of the view toggle are catalogued: they are two authored
    // layouts of one component, and until this change only one of them existed.
    const armourSpecimen = options([], { class: 'cc-card-selectors cc-catalog-specimen', dataset: { view: 'grid' } });
    const armourListSpecimen = options([], { class: 'cc-card-selectors cc-catalog-specimen', dataset: { view: 'list' } });
    const specimenArmours = armourChoices().slice(0, 2);
    let specimenArmourId = specimenArmours[0].id;
    const drawArmourChoices = () => {
      for (const host of [armourSpecimen, armourListSpecimen]) {
        host.replaceChildren(...specimenArmours.map((piece) => {
          const chipButton = pieceChip(registries, piece, { selected: piece.id === specimenArmourId });
          markUiComponent(chipButton, UI.equipmentChoiceCard, 'armour');
          chipButton.addEventListener('click', () => { specimenArmourId = piece.id; drawArmourChoices(); });
          return chipButton;
        }));
      }
    };
    drawArmourChoices();
    // THE THREE PRESENTATION LEVELS, side by side, on one item. The catalogue's
    // job is to show what a component's model can be asked for, and "how much
    // this card says" is now part of that model (src/model/cardFields.js), so
    // a reviewer can see glance / focus / inspect differ — and by how much the
    // effect rows grow as the regions above them are withheld — without
    // driving a real screen into three different states to get there.
    //
    // These are REAL faces from the real renderer, at the real levels; nothing
    // here is a mock-up of one. `inspection: false` is how the last specimen
    // reaches `inspect`, which is the same door the modal's own face uses.
    // It wears the picker's own container classes so the faces are sized by the
    // rules that already size faces in a picker — the catalogue must not grow a
    // second opinion about how big a card is.
    const levelSpecimen = el('div', { class: 'cc-catalog-specimen cc-card-selectors cc-card-levels', dataset: { view: 'list' } });
    for (const at of ['glance', 'focus', 'inspect']) {
      // EACH SPECIMEN IS ITS OWN CARD AS FAR AS SELECTION IS CONCERNED.
      // All three draw the same item on purpose — that is the comparison — but
      // selection is page-wide and keyed by identity, so sharing one meant
      // lighting any face promoted all three to `focus` and the three-level
      // comparison collapsed into three identical cards. On a real screen that
      // sharing is the correct behaviour; here it defeats the specimen.
      const face = renderEquipmentCard(registries, specimenArmours[0], at === 'inspect'
        ? { interactive: false, inspection: false }
        : { interactive: false, level: at, identity: `catalog-level-${at}` }).card;
      levelSpecimen.append(el('figure', { class: 'cc-card-level', dataset: { level: at } }, [
        face, el('figcaption', {}, at),
      ]));
    }
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
      { key: 'mode-choice', label: 'Stat allocation mode', node: choiceSpecimen(
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
      { key: 'equipment-choice-card', label: 'Equipment choice card (grid view)', node: armourSpecimen },
      { key: 'equipment-choice-card-list', label: 'Equipment choice card (list view)', node: armourListSpecimen },
      { key: 'card-presentation-levels', label: 'Card presentation levels', node: levelSpecimen },
      { key: 'relic-choice-card', label: 'Relic choice card', node: relicSpecimen },
      // W1c moved the live portrait into the head; the catalogue still shows it.
      { key: 'creation-portrait', label: t('creation.catalog.portrait'), node: portrait },
    ];
    for (const row of specimens) appendCatalogItem(row, 'Reusable component');
    flow.replaceChildren(fragment);
  } else {
    // W1c: the rail names each category and what it holds; the pane shows one.
    refreshSectionFaces = () => {
      for (const item of railItems) {
        const rowFor = sectionRows.find((row) => row.key === item.dataset.member);
        if (rowFor) item.querySelector('.cz-tab-value').textContent = rowFor.value();
      }
    };
    const nav = categoryNav({
      items: railItems, rail, ariaLabel: t('creation.categories'),
      choose: (id) => activate(id),
      face: (item) => item.querySelector('.rail-label')?.textContent || item.firstChild?.textContent || item.dataset.member,
      toggleClass: 'cz-cat-select', toggleId: 'cz-cat-select',
      onChange: ({ mode, open }) => { railed.dataset.creationNav = mode; railed.toggleAttribute('data-nav-open', open); },
    });
    nav.attach(railed);
    // The model owns the authored column count at each pane width.
    const applyColumns = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const zoom = parseFloat(rootStyle.getPropertyValue('--ui-zoom')) || 1;
      const columns = creationAttributeColumns({ hostWidthPx: paneHost.getBoundingClientRect().width / zoom, rootFontPx: parseFloat(rootStyle.fontSize) });
      customizeScreen.style.setProperty('--creation-attribute-columns', String(columns));
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (paneHost.isConnected) { applyColumns(); fitStage(); } }).observe(paneHost);
    applyColumns();
  }

  // THE WAY ON, per step: what it waits for, and what it opens inside the next
  // section so the player lands on the next question rather than a shut fold.
  const openInside = {
    character: () => {
      characterFold.open('primary');
      seatFace('primary', statBox.querySelector('.cc-mode-select'));
      return null; // seatFace seats the cursor itself
    },
    equipment: () => {
      openEquipmentSection(equipmentSectionViews[0]?.id);
      return null; // openEquipmentSection seats the cursor itself
    },
  };
  // W1c: one persistent footer. Back leaves on the first category and steps
  // back otherwise; Next refuses with the current category's unmet step and
  // lands the cursor on the next question; Begin takes over on Review.
  const activeEquipmentProblem = () => { const section = equipmentSectionViews.find(row => row.id === equipmentFold?.openKey); return !section?.nextId ? equipmentProblem() : section?.kind === 'armour' ? armourProblem() : section?.kind === 'hand' ? handProblem(section.slot) : null; };
  const stageProblems = { class: classProblem, character: characterProblem, equipment: activeEquipmentProblem, review: () => null };
  let current = categories[0];
  const categoryLabel = (id) => t(`creation.category.${id}`);
  function activate(id) {
    if (catalog || !categories.includes(id)) return;
    current = id;
    paneHost.replaceChildren(stages[id]);
    paneHost.scrollTop = 0;
    paneHost.setAttribute('aria-labelledby', `cz-tab-${id}`);
    for (const item of railItems) {
      const on = item.dataset.member === id;
      item.classList.toggle('on', on);
      item.setAttribute('aria-selected', String(on));
      if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
    }
    const plan = creationFooterPlan({ categories, current: id });
    next.hidden = plan.primary !== 'next';
    start.hidden = plan.primary !== 'begin';
    railed.dataset.creationStage = id;
    classTools.hidden = id !== 'class';
    equipmentTools.hidden = id !== 'equipment';
    if (id === 'review') fillSummary($('#cz-review-summary'));
    refreshGates();
    fitStage();
  }
  // EVERY CHOICE IN VIEW WITHOUT SCROLLING (owner, 2026-09-19). The class pane
  // is measured after it draws; when its choices run past the pane the cards
  // fold their descriptions to one line, and when that is still too tall the
  // preview column steps aside so the choices take the width. Measurement
  // only — the rule and its lines are behavior.fitChoicesToPane and
  // sizing.choiceDescriptionLines in the config.
  function fitStage() {
    if (catalog || !creationFitsChoices()) return;
    delete railed.dataset.choiceFit;
    delete railed.dataset.previewOff;
    if (current !== 'class') return;
    // The collection is its own scrollport inside the split (kit.css), so it is
    // the box that overflows, not the pane.
    const overflows = () => classBox.scrollHeight > classBox.clientHeight + 1 || paneHost.scrollHeight > paneHost.clientHeight + 1;
    if (!overflows()) return;
    railed.dataset.choiceFit = 'compact';
    if (!overflows()) return;
    railed.dataset.previewOff = 'true';
    if (!overflows()) return;
    railed.dataset.choiceFit = 'bare';
  }
  function advanceFrom(id) {
    if (catalog) return;
    if (stageProblems[id]?.()) return;
    const to = creationStep(categories, id, 1);
    if (!to) return;
    activate(to);
    const opener = openInside[to];
    const target = opener ? opener() : paneHost.querySelector('button:not([disabled]), input, select');
    if (target) queueMicrotask(() => focusElement(target));
  }
  if (!catalog) {
    gateRefreshers.push(refusesWhen(next, () => stageProblems[current](), () => {
      const to = creationStep(categories, current, 1);
      return t('creation.next.tip', { category: to ? categoryLabel(to) : '' });
    }));
    next.addEventListener('click', () => {
      if (current === 'equipment') { equipmentNodes.get(equipmentFold?.openKey)?.querySelector('.cc-equipment-continue')?.click(); return; }
      advanceFrom(current);
    });
    activate(categories[0]);
  }
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
  attachTooltip(back, () => {
    const plan = catalog ? { back: 'leave' } : creationFooterPlan({ categories, current });
    return plan.back === 'leave' ? t('creation.leave.tip') : t('creation.previous.tip', { category: categoryLabel(plan.previous) });
  });
  back.addEventListener('click', () => {
    const plan = catalog ? { back: 'leave' } : creationFooterPlan({ categories, current });
    if (plan.back === 'leave') return onBack();
    activate(plan.previous);
    queueMicrotask(() => focusElement(paneHost.querySelector('button:not([disabled]), input, select')));
  });
  if (!catalog) {
    attachTooltip(close, () => t('creation.leave.tip'));
    close.addEventListener('click', onBack);
  }
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
      ...(hasPoints(state.attributeMode) && state.attributes ? { attributes: { ...state.attributes } } : {}),
    });
  });
  updateStartRefusal();
}
