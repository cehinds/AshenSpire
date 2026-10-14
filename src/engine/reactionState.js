// Shared by player and enemy reactions. Keep this leaf free of reaction-module
// imports: the standalone bundle snapshots imports while a module initializes.
export const reactionPaused = ctx => !!(ctx.pendingReaction || ctx.reactionResume || ctx.pendingAbilityDiscard);
