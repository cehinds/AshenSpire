// Keep the existing inspection button and its handlers, but paint it in the
// browser top layer. A z-index alone cannot escape a scrolling ancestor.
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';

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
    const selected = [...root.querySelectorAll('.cc-card-selectors .inspection-selected, .cc-card-selectors .is-chosen')]
      .find(card => card.getClientRects().length && (card.classList.contains('inspection-info-visible') || card.classList.contains('is-chosen') || card.contains(document.activeElement)));
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
    // Relic details already name the selected card below the compact shelf.
    // Keep its same inspector beside that heading rather than reserving an
    // otherwise empty band above the cards (or overlapping the page title).
    const detailHeading = owner.closest('#cz-keepsake-panel')
      ?.querySelector('.cc-equipment-details .cc-item-heading');
    const headingBox = detailHeading?.getBoundingClientRect();
    let left = Math.max(8, Math.min(innerWidth - size.width - 8, headingBox
      ? headingBox.right - size.width : box.left + (box.width - size.width) / 2));
    let top = Math.max(8, headingBox
      ? headingBox.top + (headingBox.height - size.height) / 2 : box.top - size.height - 8);
    if (!headingBox && owner.closest('.cc-ability-choice') && top < pane.top + 8) {
      const art = (owner.querySelector('.art,[data-component="art"]') || owner).getBoundingClientRect();
      const artTop = Math.max(art.top, pane.top + 8);
      const artBottom = Math.min(art.bottom, pane.bottom - 8);
      const artLeft = Math.max(art.left, gallery.left, 8);
      const artRight = Math.min(art.right, gallery.right, innerWidth - 8);
      if (artRight - artLeft < size.width || artBottom - artTop < size.height) { close(); return; }
      left = artRight - size.width;
      top = artTop + (artBottom - artTop - size.height) / 2;
    }
    const position = anchorLocalBox(VIEWPORT_ORIGIN, { left, top, width: size.width, height: size.height });
    control.style.left = `${position.left}px`;
    control.style.top = `${position.top}px`;
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
