import { presentationConfig } from './advancedConfig.js';
import { formationDimensions, formationSpawn, isFormationCell } from './formationLayout.js';

export function formationMovePlan(combat, cell, settings = {}) {
  const config = presentationConfig(settings);
  const dimensions = formationDimensions(config, Math.max(1, combat.enemies?.length || 0));
  const current = isFormationCell(combat.player.formationCell, dimensions) ? combat.player.formationCell : formationSpawn(config, 'player', dimensions);
  const cost = config.movementCostsAction ? 1 : 0;
  let reason = '';
  if (!config.movementEnabled) reason = 'Formation movement is disabled.';
  else if (combat.result || combat.phase !== 'player' || combat.player.alive === false) reason = 'Move only during your turn.';
  else if (!isFormationCell(cell, dimensions)) reason = 'Choose a tile on your side.';
  else if (cell === current) reason = 'Already at that position.';
  else if (combat.player.energy < cost) reason = 'Not enough actions to move.';
  return { ok: !reason, reason, current, cell, cost };
}
