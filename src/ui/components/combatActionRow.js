// src/ui/components/combatActionRow.js — THE combat action row, one home for
// both boards.
//
// WHY THIS FILE EXISTS (owner, 2026-10-01: "What happened to my action bar at
// the bottom. It looks so bad now"). Solo combat (screens/combat.js) built the
// WGC6 footer — (Actions) [Draw] [End Turn] [Discard/Exhaust] (Potions) — in
// its own template, and the co-op board (screens/coop.js) hand-rolled a
// second, two-control rail plus a full-width row of flask buttons under it.
// Same game, two bottom bars. Both screens now mount the markup below, the
// layout adapter (components/combatLayout.js) sizes it, and one set of rules
// in styles/kit.css lays it out. The co-op flasks went behind Potions, exactly
// as solo's do; the potions list and the minis over the control live here too.
//
// What stays with each screen is the VIEWER half: where the counts come from
// (the live engine in solo, the host snapshot in co-op) and what Use does
// (local dispatch in solo, a network intent in co-op).

import { flaskActionPlan } from '../../model/flaskActions.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { potionContents, potionCountStringId } from '../models/PotionContentsModel.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { t, tFull } from '../strings.js';
import { esc } from './tooltip.js';
import { flaskTooltipHtml, flaskDetailLines, flaskPresentation } from './flask.js';
import { observeIconTray, unobserveIconTray, setIconTrayItems, setIconTrayOverflow, trayIcon } from './iconTray.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';
import { el, statPair, button, html, openModal, detailCard, optionCard, flavour } from '../kit/index.js';

/** A pile control: a kit button carrying a stacked StatPair (count over name). */
export function pileButton(kind, label) {
  const count = statPair({ key: label, value: '0', attrs: { class: 'stack' } });
  count.querySelector('.sp-v').classList.add('n'); // the hook the instruments count by
  const node = button({ label: '', className: `pile ${kind} tall` });
  node.appendChild(count);
  return node;
}

/**
 * THE ACTION ROW IS A KIT ButtonRow: the Actions receipt as a StatPair, Draw,
 * Discard with Exhaust, and Potions. End Turn is the primary with its Keycap
 * and, from the second-beat machinery, its HOLD hint. All five cells stay
 * present at zero so no control appears late or shifts the row.
 * `endTurnId` lets a screen keep the id its instruments address.
 */
export function combatActionRowHtml({ endTurnId = null } = {}) {
  return `<div class="combat-action-row as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">
          ${html(statPair({ key: 'Actions', value: '', attrs: { class: 'energy-orb cell stack lg', role: 'status', 'aria-label': 'Actions remaining' } }))}
          ${html(pileButton('draw', 'Draw'))}
          ${html(button({ label: 'End Turn', weight: 'primary', exception: 'combatEndTurn', className: 'end-turn wide tall', ...(endTurnId ? { id: endTurnId } : {}) }))}
          ${html(button({ label: 'Discard', className: 'pile spent tall' }))}
          ${html(button({ label: 'Potions', className: 'combat-potions tall' }))}
          <!-- The Potions minis: the shared icon tray over the Potions control,
               out of the row's grid (renderCombatPotionTray). -->
          <div class="combat-potion-tray as-pips icon-tray" aria-label="${esc(t('iconTray.potions'))}"></div>
        </div>`;
}

/** The player's tooltip timing, handed to the minis' reveal (styles/combat.css). */
export function setPotionRevealTiming(row, reveal) {
  row?.style.setProperty('--potion-reveal-delay', `${reveal.open}ms`);
  row?.style.setProperty('--potion-focus-delay', `${reveal.focus}ms`);
  row?.style.setProperty('--potion-reveal-fade', `${reveal.fade}ms`);
}

/** The row's tooltips, one wording for both boards (counts read at open time). */
export const actionsTipHtml = (left, max) => `<div class="tt-title">Actions</div>`
  + `${left} of ${max} left this turn.`
  + `<div class="ti-detail">Playing a card spends its cost. Unspent actions do not carry over.</div>`;
export const drawTipHtml = (count, { browse = true } = {}) => `<div class="tt-title">Draw pile</div>`
  + `${count} card${count === 1 ? '' : 's'} left to draw.`
  + `<div class="ti-detail">${browse ? 'Tap to look through it. ' : ''}When it empties, the discard pile is shuffled back in.</div>`;
// `browse: false` where the board has no pile viewer (co-op: the host sends
// counts, not cards), the same switch drawTipHtml takes.
export const spentTipHtml = ({ browse = true } = {}) => `<div class="tt-title">Discard and Exhaust</div>${browse ? 'Separate views and counts' : 'Separate counts'}. Discard can reshuffle; exhausted cards remain out for this fight.`;
export const SPENT_TIP_HTML = spentTipHtml();
export const POTIONS_TIP_HTML = '<div class="tt-title">Potions</div>Choose a healing, mana or carried potion. Only Use spends it.';

/**
 * Fill the Actions, Draw and Discard/Exhaust cells from plain counts. The
 * accessible labels follow the values (#1436 review): Actions reads "Actions
 * 2 of 3" as solo's renderControls writes it, and `browse: false` (co-op, no
 * pile viewer) drops the "Open piles" promise from Discard/Exhaust.
 */
export function paintCombatActionCounts(row, { energy, energyMax, draw, discard, exhaust, browse = true }) {
  if (!row) return;
  const orb = row.querySelector('.energy-orb');
  if (orb && energy != null) {
    orb.querySelector('.sp-v').textContent = `${energy}/${energyMax}`;
    orb.setAttribute('aria-label', `Actions ${energy} of ${energyMax}`);
  }
  const drawNode = row.querySelector('.pile.draw');
  if (drawNode) {
    drawNode.querySelector('.sp-v').textContent = draw;
    drawNode.setAttribute('aria-label', `Draw pile, ${draw}`);
  }
  const spent = row.querySelector('.pile.spent');
  if (spent) {
    const spentHtml = '<span>Discard ' + discard + '</span><small>Exhaust ' + exhaust + '</small>';
    if (spent.innerHTML !== spentHtml) spent.innerHTML = spentHtml;
    spent.setAttribute('aria-label', `Discard ${discard}; Exhaust ${exhaust}${browse ? '. Open piles' : ''}`);
  }
}

// WGC11 lists the WGH8 contents: ONE projection (models/PotionContentsModel.js)
// of the charge flasks and the carried consumables, each carried kind once
// with its count. A carried entry's Use spends its first slot.
export function combatPotionRows(registries, player) {
  return potionContents({ chargeKinds: CHARGE_FLASK_KINDS, flaskCharges: player.flaskCharges, carried: player.flasks || [] }).entries.map((entry) => (
    entry.category === 'charge'
      ? { entry, def: chargeFlaskDefinition(registries, entry.kind), options: { chargeKind: entry.kind, remaining: entry.count, charges: entry.count, useActionId: entry.useActionId } }
      : { entry, def: registries.flasks.get(entry.flaskId), options: { slot: entry.slots[0], remaining: entry.count, useActionId: entry.useActionId } }
  ));
}

const soloTargetLine = ({ def }) => (def.targeted ? 'Choose an enemy after Use.' : 'Applies to your character.');

/**
 * The Potions list. `shortcut` is the flask action a key pressed
 * (flask1..flask3), or the WGH8 entry key a Potions mini was tapped for; that
 * entry opens folded out. Found by action or key, not by list position.
 * `useReason(row)` is '' when Use may be offered, else the spelled-out reason;
 * `stillUsable(row)` rechecks the live fight (and that the row's potion is
 * still where the list saw it) before a confirmed Use commits;
 * `onUse(row)` is the screen's own Use (local dispatch or network intent);
 * `targetLine(row)` says where that Use lands, so the words match the board's
 * own flow (co-op aims differently from solo).
 */
export function openCombatPotions({ rows, opener, shortcut = null, arm, useReason, stillUsable, onUse, targetLine = soloTargetLine }) {
  const shortcutIndex = shortcut == null ? -1 : rows.findIndex((row) => row.options.useActionId === shortcut || row.entry.key === shortcut);
  let shell;
  shell = openModal({ title: 'Potions', size: 'md', className: 'combat-potion-menu', opener, bodyClassName: 'as-pane', body: host => {
    rows.forEach((row, index) => {
      const { def, options, entry } = row;
      const { slot = null, chargeKind = null, remaining, charges } = options;
      const countId = potionCountStringId(entry);
      const reason = useReason(row);
      const canUse = !reason;
      const action = flaskActionPlan({ context: 'combat', canUse, useReason: reason }).actions.find(r => r.id === 'use');
      const use = button({ label: 'Use', disabled: !action.enabled, className: 'potion-use', attrs: { 'aria-label': 'Use ' + def.name } });
      const fold = el('details', { class: 'armoury-card-row potion-fold' });
      if (chargeKind) { fold.dataset.chargeKind = chargeKind; fold.dataset.charges = String(charges); }
      else { fold.dataset.potionSlot = String(slot); fold.dataset.potionCount = String(remaining); }
      const summary = optionCard({ tag: 'summary', name: def.name,
        art: flaskPresentation(def, { showName: false }),
        description: flaskDetailLines(def, { charges }).join(' '),
        meta: t(countId, { count: remaining }), trail: [use], arrow: true });
      const detail = detailCard({ eyebrow: 'Potion', name: def.name + ' details',
        line: def.textTemplate || '', meta: targetLine(row),
        children: [flavour(tFull(countId, { count: remaining })), reason ? flavour(reason) : null] });
      fold.append(summary, detail);
      const moveUse = () => {
        if (fold.open) {
          for (const sibling of host.querySelectorAll('.potion-fold')) if (sibling !== fold) sibling.open = false;
          detail.appendChild(use);
        } else summary.querySelector('.r-trail').appendChild(use);
      };
      fold.addEventListener('toggle', moveUse);
      use.addEventListener('click', event => { event.stopPropagation(); event.preventDefault(); });
      if (action.enabled) arm(use, 'useFlask', {
        ctx: { targeted: !!def.targeted },
        question: 'Use ' + def.name + '? ' + remaining + ' remaining.', confirmLabel: 'USE',
        onConfirm: () => {
          // Recheck the live fight before committing a menu snapshot.
          if (!stillUsable(row)) return;
          shell.close();
          onUse(row);
        },
      });
      host.appendChild(fold);
      if (index === shortcutIndex) { fold.open = true; moveUse(); }
    });
    if (!rows.length) host.appendChild(flavour('No potions carried.'));
  } });
  return shell;
}

// Where the Potions control stands in the action row, in the row's local px
// (offsets, so no zoom arithmetic): the minis' right edge goes on the
// control's, and on a narrow layout they ride inside its top edge at its
// width (styles/combat.css reads the three values).
function placePotionTray(tray) {
  const row = tray.offsetParent;
  const control = tray.parentElement?.querySelector('.combat-potions');
  if (!control || !row || control.offsetParent !== row) return;
  tray.style.setProperty('--potion-tray-right', `${row.clientWidth - control.offsetLeft - control.offsetWidth}px`);
  tray.style.setProperty('--potion-control-top', `${control.offsetTop}px`);
  tray.style.setProperty('--potion-control-width', `${control.offsetWidth}px`);
}

// THE POTIONS MINIS (owner, 2026-09-14): the WGH8 entries — the charge
// flasks and the carried consumables, each with its count — as the shared
// icon tray, hung over the footer Potions control (WGC11) that owns them.
// A tap explains a potion; a second tap (or Enter) opens the Potions list with
// that potion folded out. The render key lives on the tray, so a screen that
// repaints every frame redraws the minis only when a count changes.
// One placement observer per tray, kept here so a board that throws its tray
// away on every render (co-op, per snapshot) can stop the old one.
const trayObservers = new WeakMap();

/** Stop a tray's observers, placement and icon fit (a board replacing or tearing down its row). */
export function disposeCombatPotionTray(tray) {
  trayObservers.get(tray)?.disconnect();
  trayObservers.delete(tray);
  unobserveIconTray(tray);
}

export function renderCombatPotionTray(tray, rows, open) {
  if (!tray) return;
  placePotionTray(tray);
  if (!trayObservers.has(tray) && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => placePotionTray(tray));
    observer.observe(tray.parentElement);
    trayObservers.set(tray, observer);
  }
  const shown = rows.filter((row) => row.def);
  const key = JSON.stringify(shown.map(({ entry }) => [entry.key, entry.count]));
  if (tray.dataset.renderKey === key) return;
  tray.dataset.renderKey = key;
  tray.style.setProperty('--icon-tray-slots', String(wireframeUi.iconTray.footerPotionIcons));
  // Where the tray cannot hold every mini, its +N opens the whole list.
  setIconTrayOverflow(tray, () => open());
  setIconTrayItems(tray, shown.map(({ entry, def }) => trayIcon({
    art: flaskPresentation(def, { showName: false }), count: entry.count, tone: def.tint || '',
    label: `${def.name}, ${tFull(potionCountStringId(entry), { count: entry.count })}`, disabled: entry.count <= 0,
    attrs: { class: 'potion-mini', dataset: { potionKey: entry.key } },
    tip: () => flaskTooltipHtml(def, entry.category === 'charge' ? { charges: entry.count } : {}),
    activate: () => open(entry.key),
  })));
  observeIconTray(tray);
}
