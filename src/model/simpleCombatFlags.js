// The Simple Combat switches (docs/design/SIMPLE-COMBAT-PLAN.md): one reader per mechanic that a
// profile may turn off. A missing module or setting keeps today's rule, so tests without a profile
// and saved fights play exactly as before.
import { gameModule } from './gameProfile.js';

const STAGGER_MODULE = 'stagger';
const STANCES_MODULE = 'stances';
const PROGRESSION_MODULE = 'progression';
const ENEMIES_MODULE = 'enemies';

const POISE_SETTING = 'poise';
const BUILT_IN_BENEFITS_SETTING = 'builtInBenefits';
const SAME_STANCE_DISCOUNT_SETTING = 'sameStanceDiscount';
const UPGRADE_MODE_SETTING = 'upgradeMode';
const TURN_ACTIONS_SETTING = 'turnActions';

export const UPGRADE_MODE_ROLLED = 'rolled';
export const UPGRADE_MODE_AUTHORED = 'authored';
export const ENEMY_TURN_SP_POOL = 'spPool';
export const ENEMY_TURN_SINGLE = 'single';

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

/** Whether each stance's built-in bonus applies (stances.builtInBenefits). */
export function StanceBenefitsEnabled(subject)
{
  return switchOn(subject, STANCES_MODULE, BUILT_IN_BENEFITS_SETTING);
}

/** Whether playing into the stance already held cuts the cost and raises the effect. */
export function SameStanceDiscountEnabled(subject)
{
  return switchOn(subject, STANCES_MODULE, SAME_STANCE_DISCOUNT_SETTING);
}

/** Whether a card upgrade is only its hand-authored `upgrade` block (progression.upgradeMode). */
export function AuthoredUpgradesOnly(subject)
{
  return settingOf(subject, PROGRESSION_MODULE, UPGRADE_MODE_SETTING) === UPGRADE_MODE_AUTHORED;
}

/** Whether an enemy plans and plays one move a turn instead of spending its SP pool. */
export function SingleEnemyAction(subject)
{
  return settingOf(subject, ENEMIES_MODULE, TURN_ACTIONS_SETTING) === ENEMY_TURN_SINGLE;
}
