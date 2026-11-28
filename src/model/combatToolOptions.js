// Which player controls the combat tools row offers (formation.gridOption, reactions.playerToggle).
// A missing module or setting keeps the control, so tests without a profile play as before.
import { gameModule } from './gameProfile.js';
import { presentationConfig } from './advancedConfig.js';

const FORMATION_MODULE = 'formation';
const REACTIONS_MODULE = 'reactions';
const GRID_OPTION_SETTING = 'gridOption';
const PLAYER_TOGGLE_SETTING = 'playerToggle';

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

/** Whether the formation-grid overlay is drawn: the option is on and the saved preference says so. */
export function FormationGridShown(subject, settings = {})
{
  if (!FormationGridOptionEnabled(subject))
  {
    return false;
  }
  return presentationConfig(settings).showFormationGrid === true;
}
