// Scene duration includes its entrance transition; it is never added twice.
// Leave most of the scene fully visible, even with a long transition setting.
export function prologueSceneMs(scene) { return scene.seconds * 1000; }
export function prologueTransitionMs(scene, presentation, reduced = false) {
  return reduced || scene.effect === 'still' ? 0
    : Math.min(presentation.transitionSeconds * 1000, prologueSceneMs(scene) / 4);
}
