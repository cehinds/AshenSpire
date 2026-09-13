/* Reference-only compensation for the final transform applied by layoutActors.
 * scale must include every ancestor transform/zoom that affects the assembly.
 * This changes information density, never sprite dimensions or transform.
 */
const combatantLegibilityLabels = new WeakMap();
function applyCombatantLegibility(actor, scale, config) {
  if (!actor || !actor.style || !actor.classList) throw new TypeError('A combatant element is required');
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Combatant scale must be finite and positive');
  const keys = { fontMinRem: 'font', hpMinRem: 'hp', secondaryMinRem: 'secondary', stanceMinRem: 'stance', iconMinRem: 'icon' };
  for (const key of Object.keys(keys)) {
    if (!config || !Number.isFinite(config[key]) || config[key] <= 0) throw new RangeError('Invalid legibility token: ' + key);
  }
  // Never downsize existing typography when the assembly is enlarged.
  const compensation = Math.max(1, 1 / scale);
  actor.classList.add('combatant-legible');
  actor.style.setProperty('--combatant-legibility-compensation', String(compensation));
  const screenTokens = { valueFontMinPx: ['value-font',12], infoSizePx: ['info-size',44], infoFontPx: ['info-font',16] };
  for (const [key,[token,fallback]] of Object.entries(screenTokens)) {
    const value=config[key] ?? fallback;
    if (!Number.isFinite(value)||value<=0) throw new RangeError('Invalid '+key);
    actor.style.setProperty('--combatant-legible-'+token,value*compensation+'px');
  }
  for (const [key, token] of Object.entries(keys)) {
    actor.style.setProperty('--combatant-legible-' + token, config[key] * compensation + 'rem');
  }
  // Optional width floor is in screen pixels; defaults off to avoid neighboring overlap.
  const minimumBarWidthPx = config.barMinWidthPx ?? 0;
  if (!Number.isFinite(minimumBarWidthPx) || minimumBarWidthPx < 0) throw new RangeError('Invalid barMinWidthPx');
  actor.style.setProperty('--combatant-legible-bar-width', minimumBarWidthPx * compensation + 'px');
  // Compact visible labels preserve the value; the accessible meter name stays.
  for (const meter of actor.querySelectorAll('.combatant-meter')) {
    const label = meter.querySelector('span');
    if (!label) continue;
    if (!combatantLegibilityLabels.has(label)) combatantLegibilityLabels.set(label, label.textContent);
    const current = meter.getAttribute('aria-valuenow');
    const maximum = meter.getAttribute('aria-valuemax');
    label.textContent = scale < 1 && current !== null && maximum !== null ? current + '/' + maximum : combatantLegibilityLabels.get(label);
  }
  // Keep narrow intent badges readable without covering the neighboring actor.
  const intent=actor.querySelector('.combatant-intent');
  if(intent){
    if(!combatantLegibilityLabels.has(intent))combatantLegibilityLabels.set(intent,intent.textContent);
    const full=combatantLegibilityLabels.get(intent);
    const compact=full.replace(/Attack\s*[·:]?\s*/i,'').trim();
    intent.textContent=scale<1?compact:full;
  }
  actor.dataset.legibilityScale = String(scale);
  // Existing ResizeObserver/overflow logic owns +N. Updating CSS dimensions
  // triggers that observer; do not create duplicate observers or rewrite icons.
  return { scale, compensation, minimumScreenRem: { ...config } };
}
