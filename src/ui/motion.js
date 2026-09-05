// src/ui/motion.js — one home for "has the player asked for less movement?".
//
// There are two ways to ask and both count: the in-game Reduced motion setting
// (a class on <body>) and the operating system's own preference. fx.js owned
// this test and the pose animator grew a second copy that only read the class,
// so a player who set it in their OS still got pose swaps — and in co-op, where
// the pose call is the only animation gate, that was the whole feature ignoring
// the setting.
//
// It lives here rather than in fx.js because the animator cannot import fx.js:
// fx.js imports the animator, and the cycle would be worse than the move.

/** True when the app setting or the operating system asks for reduced motion. */
export function reducedMotionRequested() {
  const appSetting = typeof document !== 'undefined'
    && document.body.classList.contains('reduced-motion');
  const operatingSystem = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return appSetting || operatingSystem;
}
