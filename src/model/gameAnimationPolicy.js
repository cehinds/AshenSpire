// Presentation policy is pinned to the run, never a mutable global setting.
// Historical runs predate this optional key and retain their existing motion.
export function figureAnimationsEnabled(subject) {
  const profile = subject?.gameProfile || (subject?.formatVersion === 1 && subject?.modules ? subject : null);
  if (!profile || !Object.hasOwn(profile.modules || {}, 'animation')) return true;
  const animation = profile.modules.animation;
  return animation !== false && animation?.enabled !== false;
}
