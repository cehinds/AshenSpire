import { anchorLocalBox } from '../fx.js';
import { inspectControlRisePx } from '../models/InspectControlModel.js';

// Focus cannot reveal an absolute control on the outside card of a fitted fan.
// Prefer its scroller; an overflow-visible hand translates only its active
// owning face. Keep the chooser beneath the card that owns its rank.
export function revealHandUpcastControl(hand, control, viewportWidth = window.innerWidth) {
  const card = control.classList?.contains('card') ? control : control.parentElement;
  const port = hand.getBoundingClientRect();
  let box = control.getBoundingClientRect();
  if (!hand.clientWidth || !port.width || !box.width) return;
  const left = Math.max(0, port.left);
  const right = Math.min(viewportWidth, port.right);
  if (right <= left) return;
  const scale = port.width / hand.clientWidth;
  const outside = bounds => bounds.left < left ? bounds.left - left : bounds.right > right ? bounds.right - right : 0;
  const delta = outside(box);
  if (delta) hand.scrollLeft += delta / scale;
  box = control.getBoundingClientRect();
  const remaining = outside(box);
  if (remaining && card) {
    const shift = parseFloat(card.style.getPropertyValue('--hand-upcast-shift')) || 0;
    card.style.setProperty('--hand-upcast-shift', `${shift - remaining / scale}px`);
  }
  // The chooser belongs below its card, but must clear the fixed footer.
  // Move only that selected owner; resting fan geometry stays unchanged.
  if (control !== card && card && Number.isFinite(port.bottom)) {
    box = control.getBoundingClientRect();
    const rise = parseFloat(card.style.getPropertyValue('--hand-upcast-rise')) || 0;
    const overflow = box.bottom - port.bottom + 1;
    if (Number.isFinite(overflow) && overflow > 0) {
      card.style.setProperty('--hand-upcast-rise', `${rise - overflow / scale}px`);
    }
  } else if (control === card && card.style.getPropertyValue('--hand-upcast-rise')) {
    card.style.removeProperty('--hand-upcast-rise');
  }
}

// The hand is the only horizontal scroller. Its inspection control lives in
// the enclosing overlay so clipping the fan cannot clip the reading door.
export function mountHandInspectionOverlay(hand) {
  let owner = null;
  let control = null;
  let request = 0;
  const pointers = new Set();
  let awaitingClick = false;
  let revealOwner = null;
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
    const upcast = hand.querySelector('.card:is(.selected,.inspection-selected) > .card-upcast-controls');
    const focused = hand.querySelector('.card.gp-focus');
    // Inspection lights at hold start. Moving that face before release can
    // redirect a touch's trailing click or interfere with a card drag.
    if (!pointers.size && !awaitingClick) {
      const selectedOwner = hand.querySelector('.card:is(.selected,.inspection-selected)') || upcast?.parentElement;
      const active = revealOwner && (revealOwner === focused || revealOwner === selectedOwner ||
        revealOwner.parentElement === hand && revealOwner.matches?.('.selected,.inspection-selected'))
        ? revealOwner : focused || selectedOwner;
      const ownedControl = active === upcast?.parentElement ? upcast : active?.querySelector?.('.card-upcast-controls');
      if (active) revealHandUpcastControl(hand, ownedControl?.getBoundingClientRect().width ? ownedControl : active);
    }
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
      // WCB1: the control's size plus its gap, in physical px like the rect.
      top: anchor.top - inspectControlRisePx(),
      width: 0,
      height: 0,
    });
    control.style.left = `${local.left}px`;
    control.style.top = `${local.top}px`;
  };
  const schedule = () => { cancelAnimationFrame(request); request = requestAnimationFrame(position); };
  const press = event => { awaitingClick = false; pointers.add(event.pointerId); };
  const release = event => {
    if (!pointers.delete(event.pointerId)) return;
    awaitingClick = event.type === 'pointerup';
    schedule();
  };
  // Native touch clicks may follow the first release frame. Let their target
  // settle before translating, including a click the card gesture consumes.
  // A new press, keyboard action or blur also releases a suppressed click.
  const settle = () => { awaitingClick = false; schedule(); };
  const blur = () => { pointers.clear(); settle(); };
  const choose = event => { revealOwner = event.target.closest('.card'); schedule(); };
  const observer = new MutationObserver(schedule);
  observer.observe(hand, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  hand.addEventListener('scroll', schedule);
  hand.addEventListener('pointerdown', press, true);
  hand.addEventListener('gpfocus', choose, true);
  hand.addEventListener('cardinspectionselect', choose, true);
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('click', settle, true);
  window.addEventListener('keydown', settle, true);
  window.addEventListener('blur', blur);
  window.addEventListener('resize', schedule);
  return () => {
    observer.disconnect(); cancelAnimationFrame(request);
    hand.removeEventListener('scroll', schedule);
    hand.removeEventListener('pointerdown', press, true);
    hand.removeEventListener('gpfocus', choose, true);
    hand.removeEventListener('cardinspectionselect', choose, true);
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    window.removeEventListener('click', settle, true);
    window.removeEventListener('keydown', settle, true);
    window.removeEventListener('blur', blur);
    window.removeEventListener('resize', schedule);
    restore();
  };
}
