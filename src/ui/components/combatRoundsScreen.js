// src/ui/components/combatRoundsScreen.js — the Combat Rounds Preview's screen layer (SPEC §4.11, PREVIEW-PLAN
// "Screen"). It only adds to what the live combat screen already drew: follow-up symbols in each enemy's intent
// box, speed hints and the queue order on hand cards, the momentum tab on the turn banner, and the target outline
// on a targeted sprite. Every call first removes what an earlier call added, so the layer is safe to re-run on
// each render. With combat.combatRounds absent it adds nothing (the DOM and CSS stay as they are).
import { intentIcon } from './intentIcon.js';
import { previewIntent, roundCardForecast } from '../../engine/combat.js';
import { screenForecast, enemyActions, roundMomentum } from '../../engine/combatRoundsAdapter.js';
import { targetOutline } from '../../engine/combatRounds/resolver.js';
import { followUpSymbols, momentumTab, perceptionLevel, readStage, speedHint, READ_EXACT } from '../models/CombatRoundsScreenModel.js';

const CLEAN = ['.cr-followups', '.cr-speed', '.cr-queue', '.cr-momentum'];

// decorateCombatRoundsScreen(root, combat, { armedCardId, targetedId }) → void.
// root: the .combat element. armedCardId: the hand card being aimed (null when none). targetedId: the enemy the
// banner and the hand hints read (the caller's last target, else the first living enemy).
// Two passes (review item 4): every read (the boxes, the forecasts and the outline art's layout) happens first, then
// every write. The browser lays the page out once for the whole decoration, not once per enemy.
export function decorateCombatRoundsScreen(root, combat, { armedCardId = null, targetedId = null } = {}) {
  if (!root) return;
  const on = Boolean(combat?.combatRounds);
  const perception = on ? perceptionLevel(combat) : 0;

  // Pass 1, reads only. The art is measured as the previous decoration left it: the follow-up symbols are added to
  // the intent box, which the sprite art does not depend on.
  const rows = [];
  for (const enemy of on ? combat.enemies : []) {
    const box = root.querySelector(`.combatant.enemy[data-eid="${CSS.escape(enemy.id)}"]`);
    if (!box || !enemy.alive) continue;
    const intent = previewIntent(combat, enemy.id);
    const row = { box, intentEl: box.querySelector('.intent'), actions: enemyActions(combat, enemy.id), stage: readStage(intent), colour: null, art: [] };
    // The target outline: only while a card is aimed, and only the visible art and the intent glyphs.
    if (armedCardId) {
      const card = roundCardForecast(combat, armedCardId, enemy.id);
      const forecast = card ? screenForecast(combat, enemy.id, card) : null;
      row.colour = forecast?.foe ? targetOutline({ card, foe: forecast.foe, cardSpeed: forecast.cardSpeed,
        foeSpeed: forecast.foeSpeed, stage: row.stage, stanceTable: forecast.stanceTable }) : null;
      // The visible art only: not the hidden aim copy, and not the foot shadow (which is not an image).
      if (row.colour) row.art = [...box.querySelectorAll('.sprite img')].filter((node) => !node.closest('.aim-silho') && node.getClientRects().length > 0
        && getComputedStyle(node).visibility !== 'hidden');
    }
    rows.push(row);
  }

  // Pass 2, writes only.
  for (const selector of CLEAN) root.querySelectorAll(selector).forEach((node) => node.remove());
  root.querySelectorAll('[data-target-outline]').forEach((node) => delete node.dataset.targetOutline);
  if (!on) { delete root.dataset.combatRounds; return; }
  root.dataset.combatRounds = 'preview';
  const cr = combat.combatRounds;

  for (const row of rows) {
    const { intentEl } = row;
    if (intentEl && row.actions.length > 1) {
      const wrap = document.createElement('span');
      wrap.className = 'cr-followups';
      wrap.setAttribute('aria-hidden', 'true');
      for (const symbol of followUpSymbols(row.actions, perception, row.stage)) {
        const item = document.createElement('span');
        item.className = 'cr-followup';
        if (symbol.kind === 'action') item.append(intentIcon(symbol.icon));
        else { item.dataset.unknown = 'true'; item.textContent = '?'; }
        wrap.append(item);
      }
      intentEl.append(wrap);
    }
    if (row.colour) {
      const glyphs = intentEl ? [...intentEl.querySelectorAll('.intent-icon')] : [];
      for (const node of [...row.art, ...glyphs]) node.dataset.targetOutline = row.colour;
    }
  }

  // Hand: the queue order on a queued card, and the speed hint against the targeted enemy when its speed is read.
  const targetedRead = targetedId && combat.enemies.some((e) => e.id === targetedId && e.alive)
    ? readStage(previewIntent(combat, targetedId)) : 0;
  for (const card of root.querySelectorAll('.hand .card[data-instance-id]')) {
    const id = card.dataset.instanceId;
    const at = cr.playerQueue?.findIndex((record) => record.instanceId === id) ?? -1;
    card.classList.toggle('cr-queued', at >= 0);
    if (at >= 0) {
      const order = document.createElement('span');
      order.className = 'cr-queue';
      order.setAttribute('aria-hidden', 'true');
      order.textContent = String(at + 1);
      card.append(order);
    }
    if (!targetedId || targetedRead < READ_EXACT) continue;
    const forecast = screenForecast(combat, targetedId, roundCardForecast(combat, id, targetedId));
    const hint = speedHint(forecast.cardSpeed, forecast.foeSpeed);
    if (!hint) continue;
    const arrow = document.createElement('span');
    arrow.className = 'cr-speed';
    arrow.dataset.tone = hint.tone;
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = hint.glyph;
    card.append(arrow);
  }

  // Momentum on the turn banner, for the targeted enemy: the decayed value, what applies to this round's order.
  const ribbon = root.querySelector('.turn-ribbon');
  if (ribbon) {
    const tab = targetedId ? momentumTab(roundMomentum(combat)[targetedId] ?? 0) : null;
    if (tab) {
      ribbon.dataset.momentum = tab.tone;
      const node = document.createElement('span');
      node.className = 'cr-momentum';
      node.dataset.tone = tab.tone;
      node.setAttribute('aria-hidden', 'true');
      node.textContent = tab.tab;
      ribbon.append(node);
    } else delete ribbon.dataset.momentum;
  }
}
