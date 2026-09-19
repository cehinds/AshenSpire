// Keep the existing inspection button and its handlers, but paint it in the
// browser top layer. A z-index alone cannot escape a scrolling ancestor.
export function mountCreationInfoLayer(root) {
  let control = null, owner = null, frame = 0;
  const close = () => {
    if (control?.matches(':popover-open')) control.hidePopover();
    control = owner = null;
  };
  const update = () => {
    frame = 0;
    if (!root.isConnected) { dispose(); return; }
    if (document.querySelector('.card-inspection-modal')) { close(); return; }
    const selected = [...root.querySelectorAll('.cc-card-selectors .inspection-selected')]
      .find(card => card.getClientRects().length && (card.classList.contains('inspection-info-visible') || card.contains(document.activeElement)));
    const button = selected?.querySelector('.card-info-button');
    if (button !== control) {
      close();
      if (!button || !button.showPopover) return;
      owner = selected; control = button;
      control.setAttribute('popover', 'manual');
      control.classList.add('creation-info-popover');
    }
    if (!control) return;
    const box = owner.getBoundingClientRect();
    const pane = (root.querySelector('.cz-pane') || root).getBoundingClientRect();
    const gallery = owner.closest('.cc-card-selectors').getBoundingClientRect();
    if (box.right <= gallery.left || box.left >= gallery.right || box.bottom <= pane.top || box.top >= pane.bottom || root.inert) { close(); return; }
    if (!control.matches(':popover-open')) control.showPopover();
    const size = control.getBoundingClientRect();
    const zoom = size.width / control.offsetWidth || 1;
    const left = Math.max(8, Math.min(innerWidth - size.width - 8, box.left + (box.width - size.width) / 2));
    const top = Math.max(8, box.top - size.height - 8);
    control.style.left = `${left / zoom}px`;
    control.style.top = `${top / zoom}px`;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'open', 'hidden', 'inert'] });
  // Screen replacement also closes the control and releases listeners.
  const lifetime = new MutationObserver(() => { if (!root.isConnected) dispose(); else schedule(); });
  lifetime.observe(root.parentElement, { childList: true });
  root.addEventListener('scroll', schedule, true);
  root.addEventListener('focusin', schedule);
  root.addEventListener('transitionend', schedule);
  window.addEventListener('resize', schedule);
  function dispose() {
    observer.disconnect(); lifetime.disconnect(); cancelAnimationFrame(frame);
    root.removeEventListener('scroll', schedule, true);
    root.removeEventListener('focusin', schedule);
    root.removeEventListener('transitionend', schedule);
    window.removeEventListener('resize', schedule);
    close();
  }
  return dispose;
}
