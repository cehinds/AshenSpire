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
export function decorateCombatRoundsScreen(root, combat, { armedCardId = null, targetedId = null } = {}) {
  if (!root) return;
  for (const selector of CLEAN) root.querySelectorAll(selector).forEach((node) => node.remove());
  root.querySelectorAll('[data-target-outline]').forEach((node) => delete node.dataset.targetOutline);
  if (!combat?.combatRounds) { delete root.dataset.combatRounds; return; }
  root.dataset.combatRounds = 'preview';
  const cr = combat.combatRounds;
  const perception = perceptionLevel(combat);

  for (const enemy of combat.enemies) {
    const box = root.querySelector(`.combatant.enemy[data-eid="${CSS.escape(enemy.id)}"]`);
    if (!box || !enemy.alive) continue;
    const intent = previewIntent(combat, enemy.id);
    const stage = readStage(intent);
    const actions = enemyActions(combat, enemy.id);
    const intentEl = box.querySelector('.intent');
    if (intentEl && actions.length > 1) {
      const wrap = document.createElement('span');
      wrap.className = 'cr-followups';
      wrap.setAttribute('aria-hidden', 'true');
      for (const symbol of followUpSymbols(actions, perception, stage)) {
        const item = document.createElement('span');
        item.className = 'cr-followup';
        if (symbol.kind === 'action') item.append(intentIcon(symbol.icon));
        else { item.dataset.unknown = 'true'; item.textContent = '?'; }
        wrap.append(item);
      }
      intentEl.append(wrap);
    }
    // The target outline: only while a card is aimed, and only the visible art and the intent glyphs.
    if (armedCardId) {
      const card = roundCardForecast(combat, armedCardId, enemy.id);
      const forecast = card ? screenForecast(combat, enemy.id, card) : null;
      const colour = forecast?.foe ? targetOutline({ card, foe: forecast.foe, cardSpeed: forecast.cardSpeed,
        foeSpeed: forecast.foeSpeed, stage, stanceTable: forecast.stanceTable }) : null;
      if (colour) {
        // The visible art only: not the hidden aim copy, and not the foot shadow (which is not an image).
        const art = [...box.querySelectorAll('.sprite img')].filter((node) => !node.closest('.aim-silho') && node.getClientRects().length > 0
          && getComputedStyle(node).visibility !== 'hidden');
        const glyphs = intentEl ? [...intentEl.querySelectorAll('.intent-icon')] : [];
        for (const node of [...art, ...glyphs]) node.dataset.targetOutline = colour;
      }
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

  // Momentum on the turn banner, for the targeted enemy.
  const ribbon = root.querySelector('.turn-ribbon');
  if (ribbon) {
    // The decayed value: what applies to this round's order, the same one the forecast uses.
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
