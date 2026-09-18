// Presentation only: these IDs never add statuses, costs, or durations.
//
// Both tables live in content/config/ui/presentation/combatPoseStates.json.
import { uiConfig } from '../config/generated/ui.js';

export const BLOOD_RITE_STATUSES = uiConfig.presentation.combatPoseStates.behavior.bloodRiteStatuses;
export const COMBAT_POSE_STATES = uiConfig.presentation.combatPoseStates.components.poseStates;
