// The Simple Combat switches (docs/design/SIMPLE-COMBAT-PLAN.md): one reader per mechanic that a
// profile may turn off. A missing module or setting keeps today's rule, so tests without a profile
// and saved fights play exactly as before.
import { gameModule } from './gameProfile.js';

const STAGGER_MODULE = 'stagger';

const POISE_SETTING = 'poise';

function settingOf(subject, moduleId, settingId)
{
  const settings = gameModule(subject, moduleId);
  return settings
    ? settings[settingId]
    : undefined;
}

// Only an explicit false turns a switch off.
function switchOn(subject, moduleId, settingId)
{
  return settingOf(subject, moduleId, settingId) !== false;
}

/** Whether Poise pools fill, absorb and break (stagger.poise). */
export function PoiseEnabled(subject)
{
  return switchOn(subject, STAGGER_MODULE, POISE_SETTING);
}
