import { anchorLocalBox } from '../fx.js';
import { inspectControlRisePx } from '../models/InspectControlModel.js';
import { handInfoPosition } from '../models/HandLayout.js';

// Focus cannot reveal an absolute control on the outside card of a fitted fan.
// Prefer its scroller; an overflow-visible hand translates only its active
// owning face. Keep the chooser beneath the card that owns its rank.
export function revealHandUpcastControl(hand, control, viewportWidth = window.innerWidth) {
  const card = control.classList?.contains('card') ? control : control.parentElement;
  const port = hand.getBoundingClientRect();
  if (!control.getBoundingClientRect().width) return;
  const measure = () => {
    const boxes = [control.getBoundingClientRect(), card?.getBoundingClientRect?.(),
      ...[...(control.querySelectorAll?.('button,select') || [])].map(node => node.getBoundingClientRect())]
      .filter(box => box?.width && box?.height !== 0);
    return { left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
      top: Math.min(...boxes.map(box => box.top ?? Infinity)), bottom: Math.max(...boxes.map(box => box.bottom ?? -Infinity)),
      width: Math.max(...boxes.map(box => box.right)) - Math.min(...boxes.map(box => box.left)) };
  };
  let box = measure();
  if (!hand.clientWidth || !port.width || !box.width) return;
  const left = Math.max(0, port.left);
  const right = Math.min(viewportWidth, port.right);
  if (right <= left) return;
  const scale = port.width / hand.clientWidth;
  const outside = bounds => bounds.left < left ? bounds.left - left : bounds.right > right ? bounds.right - right : 0;
  const delta = outside(box);
  if (delta) hand.scrollLeft += delta / scale;
  box = measure();
  const remaining = outside(box);
  if (remaining && card) {
    const shift = parseFloat(card.style.getPropertyValue('--hand-upcast-shift')) || 0;
    card.style.setProperty('--hand-upcast-shift', `${shift - remaining / scale}px`);
  }
  // Fit the complete selected face and its controls into the clipped port.
  // Capacity is reserved by HandLayout; translation only reconciles edges.
  if (control !== card && card && Number.isFinite(port.bottom)) {
    box = measure();
    const rise = parseFloat(card.style.getPropertyValue('--hand-upcast-rise')) || 0;
    const top = Math.max(0, port.top ?? 0) + 1;
    const bottom = Math.min(globalThis.window?.innerHeight || Infinity, port.bottom) - 1;
    // Never fix a bottom overflow by clipping the face above the port.
    const lower = top - box.top, upper = bottom - box.bottom;
    const deltaY = lower <= upper ? Math.max(lower, Math.min(upper, 0)) : 0;
    if (Number.isFinite(deltaY) && deltaY) {
      card.style.setProperty('--hand-upcast-rise', `${rise + deltaY / scale}px`);
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
    const infoSize = control.getBoundingClientRect().width || 44;
    const hud = [...(hand.closest?.('.combat')?.querySelectorAll('.combatant .combatant-mini-hud, .combatant [data-meter-row="hp"], .combatant [data-res="hp"], .combatant .health-footer, .combatant .nm, .combatant .intent, .combatant .combatant-info') || [])]
      .filter(node => node.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) !== false)
      .map(node => ({ box: node.getBoundingClientRect(), style: getComputedStyle(node) }))
      .filter(({ box, style }) => box.width && box.height && style.visibility !== 'hidden' && style.display !== 'none')
      .map(({ box }) => box);
    const position = handInfoPosition({ card: anchor, port: hand.getBoundingClientRect(), size: infoSize,
      gap: Math.max(0, inspectControlRisePx() - infoSize), viewportWidth: window.innerWidth, obstacles: hud });
    const local = anchorLocalBox(hand.parentElement, {
      ...position,
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
  hand.addEventListener('handlayoutchange', schedule);
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
    hand.removeEventListener('handlayoutchange', schedule);
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
