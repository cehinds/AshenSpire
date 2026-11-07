// src/ui/components/combatRoundsScreen.js — the combat screen's follow-up and target-outline layer (SPEC §4.9,
// §4.6a). It only adds to what the live combat screen already drew: follow-up symbols in each enemy's intent
// box (the multi-action preview) and the stance outline on a targeted sprite. Every call first removes what an
// earlier call added, so the layer is safe to re-run on each render.
import { intentIcon } from './intentIcon.js';
import { cardTimelineViewFor, previewIntent } from '../../engine/combat.js';
import { stanceOutline } from '../../engine/combatRounds/resolver.js';
import { enemyIntentStance, enemyPlanActions, multiActionOn, normalStanceTable } from '../../engine/normalPreview.js';
import { followUpSymbols, perceptionLevel, readStage } from '../models/CombatRoundsScreenModel.js';

const CLEAN = ['.cr-followups'];

// decorateCombatRoundsScreen(root, combat, { armedCardId }) → void.
// root: the .combat element. armedCardId: the hand card being aimed (null when none).
// Two passes (review item 4): every read (the boxes, the plans and the outline art's layout) happens first, then
// every write. The browser lays the page out once for the whole decoration, not once per enemy.
export function decorateCombatRoundsScreen(root, combat, { armedCardId = null, memo = (key, compute) => compute() } = {}) {
  if (!root) return;
  // Follow-ups show in the intent box when the multi-action preview is on (always, in a Core fight).
  const followUpsOn = multiActionOn(combat);
  const perception = followUpsOn ? perceptionLevel(combat) : 0;

  // Pass 1, reads only. The art is measured as the previous decoration left it: the follow-up symbols are added to
  // the intent box, which the sprite art does not depend on.
  const rows = [];
  for (const enemy of followUpsOn || armedCardId ? combat.enemies : []) {
    const box = root.querySelector(`.combatant.enemy[data-eid="${CSS.escape(enemy.id)}"]`);
    if (!box || !enemy.alive) continue;
    const intent = memo(`intent:${enemy.id}`, () => previewIntent(combat, enemy.id));
    const actions = memo(`plan:${enemy.id}`, () => enemyPlanActions(combat, enemy));
    const row = { box, intentEl: box.querySelector('.intent'), actions: followUpsOn ? actions : [], stage: readStage(intent), colour: null, art: [] };
    // The target outline (every fight): only while a card is aimed, and only the visible art and the intent glyphs.
    if (armedCardId) {
      const card = cardTimelineViewFor(combat, armedCardId, enemy.id);
      row.colour = card ? stanceOutline({ card, foe: { stance: enemyIntentStance(combat, enemy) }, stage: row.stage,
        stanceTable: normalStanceTable() }) : null;
      // The visible art only: not the hidden aim copy, and not the foot shadow (which is not an image).
      if (row.colour) row.art = [...box.querySelectorAll('.sprite img')].filter((node) => !node.closest('.aim-silho') && node.getClientRects().length > 0
        && getComputedStyle(node).visibility !== 'hidden');
    }
    rows.push(row);
  }

  // Pass 2, writes only.
  for (const selector of CLEAN) root.querySelectorAll(selector).forEach((node) => node.remove());
  root.querySelectorAll('[data-target-outline]').forEach((node) => delete node.dataset.targetOutline);
  root.querySelectorAll('[data-cr-outline]').forEach((node) => delete node.dataset.crOutline);
  // The target outline marks the enemy box, so the CSS hides the live aim halo only there, and the visible art and
  // intent glyphs carry the colour.
  decorateFollowUps(rows, perception);
  for (const row of rows) {
    if (!row.colour) continue;
    row.box.dataset.crOutline = row.colour;
    const glyphs = row.intentEl ? [...row.intentEl.querySelectorAll('.intent-icon')] : [];
    for (const node of [...row.art, ...glyphs]) node.dataset.targetOutline = row.colour;
  }
}

// The follow-up symbols of each enemy's intent box, in play order after the current action (SPEC §4.9).
function decorateFollowUps(rows, perception = 0) {
  for (const row of rows) {
    const { intentEl } = row;
    if (!intentEl || row.actions.length < 2) continue;
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
}
