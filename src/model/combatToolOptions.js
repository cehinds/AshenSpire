// Which player controls the combat tools row offers (formation.gridOption, reactions.playerToggle).
// A missing module or setting keeps the control, so tests without a profile play as before.
import { gameModule } from './gameProfile.js';

const FORMATION_MODULE = 'formation';
const REACTIONS_MODULE = 'reactions';
const GRID_OPTION_SETTING = 'gridOption';
const PLAYER_TOGGLE_SETTING = 'playerToggle';

// The combat root's data-formation-grid-option values; combat.css hides the overlay on off.
export const GRID_OPTION_ON = 'on';
export const GRID_OPTION_OFF = 'off';

// Only an explicit false hides a control.
function optionOn(subject, moduleId, settingId)
{
  const settings = gameModule(subject, moduleId);
  const value = settings
    ? settings[settingId]
    : undefined;
  return value !== false;
}

/** Whether combat offers the Grid checkbox and the overlay may follow the saved preference. */
export function FormationGridOptionEnabled(subject)
{
  return optionOn(subject, FORMATION_MODULE, GRID_OPTION_SETTING);
}

/** Whether combat offers the player's Reaction on/off switch. */
export function ReactionToggleEnabled(subject)
{
  return optionOn(subject, REACTIONS_MODULE, PLAYER_TOGGLE_SETTING);
}
