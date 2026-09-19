import { presentationConfig } from './advancedConfig.js';

export function formationMovePlan(combat, cell, settings = {}) {
  const config = presentationConfig(settings);
  const current = combat.player.formationCell || `${config.playerSpawnRow}${config.playerSpawnColumn}`;
  const cost = config.movementCostsAction ? 1 : 0;
  let reason = '';
  if (!config.movementEnabled) reason = 'Formation movement is disabled.';
  else if (combat.result || combat.phase !== 'player' || combat.player.alive === false) reason = 'Move only during your turn.';
  else if (typeof cell !== 'string' || !/^[ABC][12]$/.test(cell)) reason = 'Choose a tile on your side.';
  else if (cell === current) reason = 'Already at that position.';
  else if (combat.player.energy < cost) reason = 'Not enough actions to move.';
  return { ok: !reason, reason, current, cell, cost };
}
