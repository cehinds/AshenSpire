// src/ui/components/armouryStatsPanel.js — the Armoury's character-stats panel,
// extracted from mountEquipment (screens/equipment.js) so it can be built and
// tested alone. Its data comes from models/ArmouryStatsModel.js; this file only
// builds the cards, so the rendered DOM is exactly what mountEquipment drew.
import { viewViewportBox } from '../viewViewport.js';
import { characterStatsButton, progressionTip } from './progressionCards.js';
import { esc, attachTooltip } from './tooltip.js';
import { reducedMotionRequested } from '../motion.js';
import { mountDisclosure } from './disclosure.js';
import { primaryStatCards } from './creationCards.js';
import { FOLD_GLYPH } from './foldGlyph.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { armouryStatsModel, relicsSummary } from '../models/ArmouryStatsModel.js';
import { t } from '../strings.js';
import {
  el, titleS, flavour, detailCard, row, button, meters,
} from '../kit/index.js';

/**
 * @typedef {object} ArmouryStatsPanelCtx
 * @property {object} registries  Content registries.
 * @property {object} run         The run (read live: pass a getter-backed object only if the run is replaced).
 * @property {object} meta        Meta (`meta.settings` is read for the hand rules).
 * @property {object} layout      The normalised Armoury layout (`layout.combatPower.groupLabel`).
 * @property {boolean} inCombat   Whether a fight is on (the attributes card replaces the stats button).
 * @property {object|null} handRules  The fight's own hand-rule snapshot, if any.
 * @property {boolean} onCharacterSheet  Whether the panel sits on the Character sheet (skills stay open).
 * @property {() => {character: string}} viewMode  The current view's fold modes (read at draw time).
 * @property {() => Array} characterPowerEntries  The combat-power face entries.
 * @property {(rowModel: object) => HTMLElement} skillProgressMeter  One skill track as a Meter.
 * @property {() => Array} relicEntries  The equipped relics' face entries.
 * @property {(surface: object) => HTMLElement} equipmentReceiptPanel  Builds the equipment-cards body.
 * @property {(opener: HTMLElement, tab: string) => void} openProgression  Opens the progression dialog.
 */

/** @param {ArmouryStatsPanelCtx} ctx */
export function armouryStatsPanel(ctx) {
  const {
    registries, run, meta, layout, inCombat, handRules, onCharacterSheet,
    viewMode, characterPowerEntries, relicEntries, skillProgressMeter, equipmentReceiptPanel, openProgression,
  } = ctx;
  const box = document.createElement('section');
  box.className = 'armoury-character-stats';
  const model = armouryStatsModel({
    registries, run, meta, inCombat, handRules, characterMode: viewMode().character,
  });
  const { surface, initiallyOpen } = model;
  const informationCards = [];
  let revealFrame = 0;

  function revealInformationCard(card, head) {
    cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      if (!card.isConnected || !card.open) return;
      // Focus must not scroll before closing the old card has settled layout.
      if (document.activeElement !== head) head.focus({ preventScroll: true });
      let top = viewViewportBox().top;
      let bottom = viewViewportBox().bottom;
      for (let parent = card.parentElement; parent; parent = parent.parentElement) {
        if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) continue;
        const rect = parent.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
      const rect = card.getBoundingClientRect();
      if (bottom <= top || (rect.top >= top && rect.bottom <= bottom)) return;
      // A tall card cannot fit: keep its header reachable, not its bottom.
      const tall = rect.height > bottom - top;
      if (tall && Math.abs(rect.top - top) <= 2) return;
      const target = tall ? head : card;
      const behavior = reducedMotionRequested() ? 'instant' : 'smooth';
      try {
        target.scrollIntoView({ block: tall ? 'start' : 'nearest', inline: 'nearest', behavior });
      } catch {
        target.scrollIntoView(tall);
      }
    });
  }

  // AN INFORMATION CARD is a fold-open DetailCard: its head a Row (caret
  // Glyph, the label as Title·S, the one-line summary as StatusText), its
  // body the group's faces.
  function informationCard({ id, label, summary, body }) {
    const head = el('summary', {}, row({
      glyph: FOLD_GLYPH.collapsed,
      labelNode: titleS(label, { tag: 'span', class: 'r-label character-info-label' }),
      status: summary, tag: 'div', className: 'character-info-head',
    }));
    head.querySelector('.as-glyph').classList.add('caret');
    const card = detailCard({ tag: 'details', attrs: { class: `character-info-card ${id}`, dataset: { component: `armoury.${id}` } }, children: [head, body] });
    card.open = id === initiallyOpen;
    head.setAttribute('aria-expanded', card.open ? 'true' : 'false');
    const entry = { card, setOpen(open) {
      card.open = open;
      head.setAttribute('aria-expanded', String(open));
    } };
    informationCards.push(entry);
    function activate(open) {
      cancelAnimationFrame(revealFrame);
      for (const peer of informationCards) {
        if (peer === entry) peer.setOpen(open);
        else if (open && peer.card.open) peer.setOpen(false);
      }
      if (open) revealInformationCard(card, head);
    }
    // Keyboard activation of a native summary also produces click. Update
    // siblings and ARIA together, before the asynchronous toggle events.
    head.addEventListener('click', (event) => {
      event.preventDefault();
      activate(!card.open);
    });
    card.addEventListener('toggle', (event) => {
      if (event.target !== card) return;
      // Ignore initial/handled/coalesced events; support external .open writes.
      if (head.getAttribute('aria-expanded') !== String(card.open)) activate(card.open);
    });
    attachTooltip(head, () => `<div class="tt-title">${esc(label)}</div><p>${esc(card.open ? `Fold ${label}.` : `Expand ${label} for its full calculation and details.`)}</p>`);
    return card;
  }

  const powers = el('section', { class: 'character-power-cards', dataset: { component: UI.armouryCombatPowerGroup } });
  const powerEntries = characterPowerEntries();
  mountDisclosure(powers, powerEntries, { moreLabel: 'more powers', layout: 'column' });
  box.appendChild(informationCard({
    id: 'combatPowerCard',
    label: layout.combatPower.groupLabel,
    summary: powerEntries.map((entry) => `${entry.face.node?.querySelector('.combat-power-label')?.textContent || entry.face.label} ${entry.face.value}`).join(' · '),
    body: powers,
  }));

  if (inCombat) {
    const attributes = el('section', { class: 'character-attributes' });
    const attributeHost = el('div');
    // (The attribute rows, with the hand-rules note, are the model's.)
    const { attributeRows } = model;
    attributeHost.replaceChildren(...primaryStatCards(attributeRows));
    attributes.appendChild(attributeHost);
    box.appendChild(informationCard({
      id: 'attributesCard',
      label: t('progression.attributes'),
      summary: model.attributesSummary,
      body: attributes,
    }));
  } else {
    box.append(characterStatsButton({ registries, run, settings: meta.settings || {} }));
  }

  const relics = el('section', { class: 'character-relics' });
  const relicHost = el('div');
  const entries = relicEntries();
  for (const entry of entries) entry.face = { ...entry.face, compact: true };
  if (entries.length) mountDisclosure(relicHost, entries, { moreLabel: 'more relics', layout: 'column' });
  else relicHost.appendChild(flavour('No relics equipped.', { class: 'ep-hint' }));
  relics.appendChild(relicHost);
  box.appendChild(informationCard({
    id: 'relicsCard',
    label: 'Relics',
    summary: relicsSummary(entries.map((entry) => entry.face.label)),
    body: relics,
  }));
  // (skillRows and the stale tracks are the model's: see armouryStatsModel.)
  // A stale ledger track is SAID, once per draw, rather than dropped.
  const { skillRows, staleTracks: stale } = model;
  if (stale.length) {
    console.warn(`[armoury] the skill ledger carries ${stale.length} track(s) no content declares`
      + ` — ${stale.join(', ')}. They are not drawn, and any drafts they hold are not counted.`);
  }
  const skills = el('section', { class: 'character-skills', dataset: { component: UI.armourySkillProgressGroup } }, [
    meters(skillRows.map(skillProgressMeter), { class: 'character-skill-meters' }),
  ]);
  const progression = button({ label: t('progression.skill'), className: 'character-skill-progression', attrs: { 'aria-haspopup': 'dialog' } });
  progressionTip(progression, 'Open progression');
  progression.addEventListener('click', () => openProgression(progression, 'skills'));
  if (!onCharacterSheet) progression.addEventListener('click', () => skills.hidden = !skills.hidden);
  const skillSection = el('section', { class: 'character-skill-section' }, model.configuredFoundation ? [] : [progression, skills]);
  box.querySelector('.combatPowerCard').after(skillSection);
  box.appendChild(informationCard({
    id: 'equipmentReceiptsCard',
    label: 'Equipment cards',
    summary: model.equipmentCardsSummary,
    body: equipmentReceiptPanel(surface),
  }));
  return box;
}
