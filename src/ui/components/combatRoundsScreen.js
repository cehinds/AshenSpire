// src/ui/components/combatRoundsScreen.js — the combat screen's target-outline layer (SPEC §4.6a). It only adds
// to what the live combat screen already drew: the stance outline on a targeted sprite. Every call first removes
// what an earlier call added, so the layer is safe to re-run on each render. The follow-up symbols are NOT added
// here: the intent node carries them itself (combat.js followUpsFor, drawn by combatantIntent), so a rebuilt node
// never loses them.
import { cardTimelineViewFor, previewIntent } from '../../engine/combat.js';
import { stanceOutline } from '../../engine/combatRounds/resolver.js';
import { enemyIntentStance, normalStanceTable } from '../../engine/normalPreview.js';
import { readStage } from '../models/CombatRoundsScreenModel.js';

// decorateCombatRoundsScreen(root, combat, { armedCardId }) → void.
// root: the .combat element. armedCardId: the hand card being aimed (null when none).
// Two passes (review item 4): every read (the boxes, the plans and the outline art's layout) happens first, then
// every write. The browser lays the page out once for the whole decoration, not once per enemy.
export function decorateCombatRoundsScreen(root, combat, { armedCardId = null, memo = (key, compute) => compute() } = {}) {
  if (!root) return;
  // Pass 1, reads only.
  const rows = [];
  for (const enemy of armedCardId ? combat.enemies : []) {
    const box = root.querySelector(`.combatant.enemy[data-eid="${CSS.escape(enemy.id)}"]`);
    if (!box || !enemy.alive) continue;
    const intent = memo(`intent:${enemy.id}`, () => previewIntent(combat, enemy.id));
    const row = { box, intentEl: box.querySelector('.intent'), stage: readStage(intent), colour: null, art: [] };
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
  root.querySelectorAll('[data-target-outline]').forEach((node) => delete node.dataset.targetOutline);
  root.querySelectorAll('[data-cr-outline]').forEach((node) => delete node.dataset.crOutline);
  // The target outline marks the enemy box, so the CSS hides the live aim halo only there, and the visible art and
  // intent glyphs carry the colour.
  for (const row of rows) {
    if (!row.colour) continue;
    row.box.dataset.crOutline = row.colour;
    const glyphs = row.intentEl ? [...row.intentEl.querySelectorAll('.intent-icon')] : [];
    for (const node of [...row.art, ...glyphs]) node.dataset.targetOutline = row.colour;
  }
}
