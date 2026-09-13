import { anchorLocalBox } from '../fx.js';

// The hand is the only horizontal scroller. Its inspection control lives in
// the enclosing overlay so clipping the fan cannot clip the reading door.
export function mountHandInspectionOverlay(hand) {
  let owner = null;
  let control = null;
  let request = 0;
  const restore = () => {
    if (control) {
      control.classList.remove('hand-info-portal');
      control.style.removeProperty('left');
      control.style.removeProperty('top');
      if (owner?.isConnected) owner.appendChild(control);
      else control.remove();
    }
    owner = control = null;
  };
  const position = () => {
    request = 0;
    const selected = hand.querySelector('.card.inspection-selected.inspection-info-visible');
    if (selected !== owner) {
      restore();
      if (!selected) return;
      const info = selected.querySelector('.card-info-button');
      if (!info) return;
      owner = selected; control = info;
      control.classList.add('hand-info-portal');
      hand.parentElement.appendChild(control);
    }
    if (!owner || !control) return;
    const anchor = owner.getBoundingClientRect();
    const local = anchorLocalBox(hand.parentElement, {
      left: anchor.left + anchor.width / 2,
      top: anchor.top - 48,
      width: 0,
      height: 0,
    });
    control.style.left = `${local.left}px`;
    control.style.top = `${local.top}px`;
  };
  const schedule = () => { cancelAnimationFrame(request); request = requestAnimationFrame(position); };
  const observer = new MutationObserver(schedule);
  observer.observe(hand, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  hand.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  return () => {
    observer.disconnect(); cancelAnimationFrame(request);
    hand.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    restore();
  };
}
