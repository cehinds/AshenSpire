export function wireHudModeGrip(root, { settings = {}, onSettingsChange } = {}) {
  const grip = root.querySelector('.shared-hud .hud-mode-grip');
  const hud = grip?.closest('.shared-hud');
  if (!grip || !hud) return () => {};
  let startY = null;

  const commit = (mode) => {
    if (mode !== 'compact' && mode !== 'expanded') return;
    hud.dataset.hudMode = mode;
    grip.dataset.nextMode = mode === 'compact' ? 'expanded' : 'compact';
    grip.setAttribute('aria-label', mode === 'compact' ? 'Expand run HUD' : 'Compact run HUD');
    // The grip is a kit IconButton; its glyph says which way it folds next.
    grip.textContent = mode === 'compact' ? '⌄' : '⌃';
    settings.runHudMode = mode;
    onSettingsChange?.({ runHudMode: mode });
    window.dispatchEvent(new CustomEvent('ashenspire:hud-mode-change', { detail: { mode } }));
  };
  const toggle = () => commit(grip.dataset.nextMode || 'compact');
  grip.addEventListener('click', toggle);
  grip.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); commit('compact'); }
    if (event.key === 'ArrowDown') { event.preventDefault(); commit('expanded'); }
  });
  grip.addEventListener('pointerdown', (event) => { startY = event.clientY; grip.setPointerCapture?.(event.pointerId); });
  grip.addEventListener('pointerup', (event) => {
    if (startY == null) return;
    const delta = event.clientY - startY;
    startY = null;
    if (Math.abs(delta) >= 24) commit(delta < 0 ? 'compact' : 'expanded');
  });
  return () => grip.removeEventListener('click', toggle);
}
