// Presentation only. Tag IDs are the live vocabulary in content/source/tags.csv.
// First matching row wins regardless of the incoming tag order. Bookkeeping
// tags (basic, extractable) deliberately do not imply an animation.
//
// The four tables live in content/config/ui/presentation/actionAnimations.json.
// The actor rows are written out in full there rather than built by the `player`
// and `enemy` helpers this file used to carry: a helper that silently supplies
// `dodgeRoll` and `defend` is a rule about the data hidden in code, and an
// author reading the JSON now sees every action an actor actually has.
import { uiConfig } from '../config/generated/ui.js';

const { behavior, motion } = uiConfig.presentation.actionAnimations;

export const ACTION_ANIMATION_TAGS = behavior.tags;
export const ACTION_ANIMATION_TYPES = behavior.types;
export const ACTION_ANIMATION_FAMILIES = motion.families;
export const ACTION_ANIMATION_ACTORS = behavior.actors;
