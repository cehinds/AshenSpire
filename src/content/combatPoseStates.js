// Presentation only: these IDs never add statuses, costs, or durations.
//
// Both tables live in content/config/ui/presentation/combatPoseStates.json.
import { uiConfig } from '../config/generated/ui.js';
import { shallowFrozen } from '../config/authored.js';

export const BLOOD_RITE_STATUSES = shallowFrozen(uiConfig.presentation.combatPoseStates.behavior.bloodRiteStatuses);
export const COMBAT_POSE_STATES = shallowFrozen(uiConfig.presentation.combatPoseStates.components.poseStates);
