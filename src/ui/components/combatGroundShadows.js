// All foot shadows share one plane below every figure. Using the settled
// formation geometry also keeps shadows still during a pose or melee lunge.
export function syncCombatGroundShadows(field, actors) {
  let layer = field.querySelector(':scope > .combat-ground-shadows');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'combat-ground-shadows';
    layer.setAttribute('aria-hidden', 'true');
    field.prepend(layer);
  }
  const current = new Map([...layer.children].map(node => [node.dataset.shadowFor, node]));
  for (const { id, x, ground, width, height, dead } of actors) {
    const shadow = current.get(id) || document.createElement('div');
    shadow.className = 'combat-ground-shadow';
    // data-eid is reserved for live combatants: targeting and co-op playback
    // query it directly, so decorative shadows must use their own identity.
    shadow.dataset.shadowFor = id;
    shadow.style.cssText = `left:${x}px;top:${ground}px;width:${width * .7}px;height:${height * .08}px;opacity:${dead ? .25 : 1}`;
    if (!shadow.parentNode) layer.append(shadow);
    current.delete(id);
  }
  for (const stale of current.values()) stale.remove();
}
