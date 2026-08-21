const frame = document.querySelector('#game-frame');
const canvas = document.querySelector('#ash-canvas');
const ctx = canvas.getContext('2d');
const quickMenu = document.querySelector('#quick-menu');
const quickButton = document.querySelector('#quick-menu-button');
const settings = document.querySelector('#settings-veil');
const toast = document.querySelector('#toast');
const versionToConcept = { A: 'halo', B: 'split', C: 'compact' };
const conceptToVersion = { halo: 'A', split: 'B', compact: 'C' };
const requestedVersion = new URLSearchParams(location.search).get('version')?.toUpperCase();
const state = { scene: 'splash', concept: versionToConcept[requestedVersion] || 'halo', viewport: 'desktop', meterState: 'overflow', music: true, fullscreen: false, inputFamily: 'unknown', armamentMode: 'radial', mobileArmamentPosition: 'left' };
const statusButton = document.querySelector('.status-overflow');
const statusPopover = document.querySelector('#status-popover');
const armamentButton = document.querySelector('#armament-hold');
const armamentRadial = document.querySelector('#armament-radial');
let settingsOpener = null;
let statusPinned = false;
let armamentActivationHandled = false;

function setScene(name) {
  state.scene = name;
  document.querySelectorAll('[data-scene]').forEach((el) => { el.hidden = el.dataset.scene !== name; });
  document.querySelectorAll('[data-scene-button]').forEach((b) => b.classList.toggle('is-active', b.dataset.sceneButton === name));
  closeStatusPopover();
  closeQuickMenu();
  closeSettings(false);
  if (name === 'title') requestAnimationFrame(() => document.querySelector('[data-scene="title"] button')?.focus({ preventScroll: true }));
  else frame.focus({ preventScroll: true });
}

function setConcept(name) {
  state.concept = name;
  frame.dataset.concept = name;
  document.querySelectorAll('[data-concept]').forEach((b) => {
    if (b.matches('button')) b.classList.toggle('is-active', b.dataset.concept === name);
  });
  document.querySelectorAll('[data-note]').forEach((n) => { n.hidden = n.dataset.note !== name; });
  document.querySelectorAll('[data-theme-toggle] em').forEach((el) => { el.textContent = conceptToVersion[name]; });
  const url = new URL(location.href);
  url.searchParams.set('version', conceptToVersion[name]);
  history.replaceState(null, '', url);
  resizeCanvas();
}

function setViewport(name) {
  state.viewport = name;
  frame.classList.toggle('is-phone', name === 'phone');
  frame.classList.toggle('is-desktop', name === 'desktop');
  document.querySelectorAll('[data-viewport]').forEach((b) => b.classList.toggle('is-active', b.dataset.viewport === name));
  setTimeout(resizeCanvas, 40);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 1500);
}

function syncToggles() {
  document.querySelectorAll('[data-toggle="music"] em').forEach((el) => { el.textContent = state.music ? 'ON' : 'OFF'; });
  document.querySelectorAll('[data-toggle="fullscreen"] em').forEach((el) => { el.textContent = state.fullscreen ? 'ON' : 'OFF'; });
  document.querySelectorAll('[data-armament-mode-toggle] em').forEach((el) => { el.textContent = state.armamentMode === 'radial' ? 'RADIAL MENU' : 'FIXED HUD'; });
  document.querySelectorAll('[data-mobile-armament-position] em').forEach((el) => {
    el.textContent = { left: 'LOWER LEFT', center: 'LOWER CENTER', right: 'LOWER RIGHT' }[state.mobileArmamentPosition];
  });
  frame.dataset.armamentMode = state.armamentMode;
  frame.dataset.mobileArmamentPosition = state.mobileArmamentPosition;
}

function setArmamentRadial(open, restoreFocus = false) {
  armamentRadial.hidden = !open;
  armamentButton.setAttribute('aria-expanded', String(open));
  if (open) armamentRadial.querySelector('.radial-center')?.focus({ preventScroll: true });
  else if (restoreFocus) armamentButton.focus({ preventScroll: true });
}

async function toggleFullscreen() {
  const entering = !document.fullscreenElement;
  try {
    if (entering) await frame.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch {}
  state.fullscreen = document.fullscreenElement === frame;
  syncToggles();
  if (entering && !state.fullscreen) notify('Fullscreen unavailable in this preview');
}

function setQuickMenuModal(open) {
  quickMenu.setAttribute('aria-modal', String(open));
  for (const el of quickMenu.parentElement.children) {
    if (el === quickMenu) continue;
    el.inert = open;
    if (open) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  }
}

function openQuickMenu() {
  closeStatusPopover();
  quickMenu.hidden = false;
  setQuickMenuModal(true);
  quickButton.setAttribute('aria-expanded', 'true');
  quickMenu.querySelector('button')?.focus();
}

function closeQuickMenu(restoreFocus = false) {
  setQuickMenuModal(false);
  quickMenu.hidden = true;
  quickButton?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) quickButton?.focus({ preventScroll: true });
}

function closeSettings(restoreFocus = false) {
  settings.hidden = true;
  document.querySelectorAll('.scene').forEach((scene) => {
    scene.inert = false;
    scene.removeAttribute('inert');
    scene.removeAttribute('aria-hidden');
  });
  if (restoreFocus) settingsOpener?.focus({ preventScroll: true });
  settingsOpener = null;
}

quickButton.addEventListener('click', (event) => {
  event.stopPropagation();
  if (quickMenu.hidden) openQuickMenu(); else closeQuickMenu();
});

document.addEventListener('fullscreenchange', () => {
  state.fullscreen = document.fullscreenElement === frame;
  syncToggles();
});

document.querySelectorAll('[data-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.toggle === 'music') {
      state.music = !state.music;
      syncToggles();
      notify(`Music ${state.music ? 'on' : 'off'}`);
    } else toggleFullscreen();
  });
});

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const order = ['halo', 'split', 'compact'];
    setConcept(order[(order.indexOf(state.concept) + 1) % order.length]);
    notify(`UI Version ${conceptToVersion[state.concept]}`);
  });
});

document.querySelectorAll('[data-armament-mode-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    state.armamentMode = state.armamentMode === 'radial' ? 'fixed' : 'radial';
    setArmamentRadial(false);
    syncToggles();
    notify(state.armamentMode === 'radial' ? 'Armament radial enabled' : 'Fixed potion cards enabled');
  });
});

document.querySelectorAll('[data-mobile-armament-position]').forEach((button) => {
  button.addEventListener('click', () => {
    const positions = ['left', 'center', 'right'];
    state.mobileArmamentPosition = positions[(positions.indexOf(state.mobileArmamentPosition) + 1) % positions.length];
    syncToggles();
    notify(`Phone radial: ${{ left: 'lower left', center: 'lower center', right: 'lower right' }[state.mobileArmamentPosition]}`);
  });
});

function toggleArmamentRadial(event) {
  if (state.armamentMode !== 'radial') {
    notify('Opening full Armaments');
    return;
  }
  event?.preventDefault();
  setArmamentRadial(armamentRadial.hidden, !armamentRadial.hidden);
}
armamentButton.addEventListener('pointerdown', (event) => {
  armamentActivationHandled = true;
  toggleArmamentRadial(event);
});
armamentButton.addEventListener('click', (event) => {
  event.preventDefault();
  if (armamentActivationHandled) {
    armamentActivationHandled = false;
    return;
  }
  toggleArmamentRadial(event);
});
armamentButton.addEventListener('keydown', (event) => {
  if (['Enter', ' '].includes(event.key) && !event.repeat) {
    armamentActivationHandled = true;
    toggleArmamentRadial(event);
  }
});
armamentRadial.querySelectorAll('[data-radial-action]').forEach((button) => button.addEventListener('click', () => {
  const copy = {
    flasks: 'Primary flasks selected', left: 'Left armament selected', right: 'Right armament selected',
    other: 'Other potions selected', full: 'Opening full Armaments',
  }[button.dataset.radialAction];
  notify(copy);
  if (button.dataset.radialAction === 'full') setArmamentRadial(false, true);
}));

// Releasing the Armaments control never closes the radial. It stays open until
// the control is pressed again, the player clicks/taps away, or cancels.
document.addEventListener('pointerdown', (event) => {
  if (armamentRadial.hidden) return;
  if (armamentRadial.contains(event.target) || armamentButton.contains(event.target)) return;
  setArmamentRadial(false);
});

document.querySelectorAll('[data-open-settings]').forEach((button) => button.addEventListener('click', () => {
  settingsOpener = button.closest('#quick-menu') ? quickButton : button;
  closeStatusPopover();
  closeQuickMenu();
  settings.hidden = false;
  document.querySelectorAll('.scene').forEach((scene) => {
    scene.inert = true;
    scene.setAttribute('inert', '');
    scene.setAttribute('aria-hidden', 'true');
  });
  settings.querySelector('button')?.focus();
}));
document.querySelectorAll('[data-close-settings]').forEach((button) => button.addEventListener('click', () => {
  closeSettings(true);
}));
settings.addEventListener('click', (event) => { if (event.target === settings) closeSettings(true); });
settings.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [...settings.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter((el) => !el.hidden);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
quickMenu.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [...quickMenu.querySelectorAll('button:not([disabled])')].filter((el) => !el.hidden);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

document.querySelectorAll('[data-save]').forEach((button) => button.addEventListener('click', () => {
  const status = button.querySelector('.save-state');
  if (status) status.textContent = 'SAVED';
  notify('Saved · Slot I');
  setTimeout(() => { if (status) status.textContent = ''; }, 1500);
}));
document.querySelectorAll('[data-save-quit]').forEach((button) => button.addEventListener('click', () => {
  notify('Saved · Returning to title');
  setTimeout(() => setScene('title'), 350);
}));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setScene(button.dataset.go)));

function setStatusPopover(open) {
  statusPopover.hidden = !open;
  statusButton.setAttribute('aria-expanded', String(open));
}
function closeStatusPopover(restoreFocus = false) {
  statusPinned = false;
  setStatusPopover(false);
  if (restoreFocus) statusButton.focus({ preventScroll: true });
}
statusButton.addEventListener('click', () => {
  statusPinned = !statusPinned;
  setStatusPopover(statusPinned);
});
statusButton.addEventListener('mouseenter', () => setStatusPopover(true));
statusButton.addEventListener('focus', () => setStatusPopover(true));
document.querySelector('.buildup-stack').addEventListener('mouseleave', () => {
  if (!statusPinned && !document.querySelector('.buildup-stack').contains(document.activeElement)) setStatusPopover(false);
});
statusButton.addEventListener('blur', () => {
  if (!statusPinned) setStatusPopover(false);
});

function setMeterState(name) {
  state.meterState = name;
  const count = name === 'zero' ? 0 : name === 'one' ? 1 : 3;
  document.querySelectorAll('[data-status-index]').forEach((row) => { row.hidden = Number(row.dataset.statusIndex) > count; });
  document.querySelectorAll('[data-poise-damage]').forEach((row) => { row.hidden = name === 'zero'; });
  statusButton.hidden = name !== 'overflow';
  closeStatusPopover();
  document.querySelectorAll('[data-meter-state]').forEach((button) => button.classList.toggle('is-active', button.dataset.meterState === name));
}

document.querySelectorAll('[data-concept]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation(); setConcept(button.dataset.concept);
}));
document.querySelectorAll('[data-viewport]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation(); setViewport(button.dataset.viewport);
}));
document.querySelectorAll('[data-meter-state]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation(); setMeterState(button.dataset.meterState);
}));
document.querySelectorAll('.combatant-card').forEach((card) => card.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  card.dataset.selected = String(card.dataset.selected !== 'true');
}));
document.querySelectorAll('[data-scene-button]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation(); setScene(button.dataset.sceneButton);
}));

function setInputFamily(family) {
  state.inputFamily = family;
  const copy = {
    pointer: ['CLICK TO CONTINUE', 'Mouse input detected'],
    touch: ['TAP TO CONTINUE', 'Touch input detected'],
    keyboard: ['PRESS ENTER OR SPACE', 'Keyboard input detected'],
    gamepad: ['PRESS A OR START', 'Controller input detected'],
    unknown: ['PRESS ANY BUTTON', 'Click · tap · Enter · Space · A / Cross · Start'],
  }[family];
  document.querySelector('#press-any-label').textContent = copy[0];
  document.querySelector('#input-hint').textContent = copy[1];
}
function leaveSplash() { if (state.scene === 'splash') setScene('title'); }
document.querySelector('#press-any').addEventListener('click', leaveSplash);
frame.addEventListener('pointerdown', (event) => {
  if (state.scene === 'splash') { event.preventDefault(); setInputFamily(event.pointerType === 'touch' ? 'touch' : 'pointer'); leaveSplash(); }
  else {
    if (!quickMenu.hidden && !quickMenu.contains(event.target) && event.target !== quickButton) closeQuickMenu();
    if (!armamentRadial.hidden && !armamentRadial.contains(event.target) && !armamentButton.contains(event.target)) setArmamentRadial(false);
  }
});
addEventListener('keydown', (event) => {
  if (state.scene === 'splash' && ['Enter', ' '].includes(event.key)) { event.preventDefault(); setInputFamily('keyboard'); leaveSplash(); return; }
  if (event.key === 'Escape') {
    if (!statusPopover.hidden) closeStatusPopover(true);
    else if (!settings.hidden) closeSettings(true);
    else if (!quickMenu.hidden) closeQuickMenu(true);
    else if (!armamentRadial.hidden) setArmamentRadial(false, true);
  }
});

let lastPad = false;
function pollGamepad() {
  const pads = navigator.getGamepads?.() || [];
  const pressed = [...pads].filter(Boolean).some((pad) => pad.buttons[0]?.pressed || pad.buttons[9]?.pressed);
  if (pressed && !lastPad) { setInputFamily('gamepad'); leaveSplash(); }
  lastPad = pressed;
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

document.querySelector('.volume-row input').addEventListener('input', (event) => {
  event.currentTarget.nextElementSibling.value = `${event.currentTarget.value}%`;
});

/* Deterministic procedural ash, embers, and spire silhouette. */
let particles = [];
let seed = 0xA53E91;
function rand() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967295; }
function resetParticles(width, height) {
  seed = 0xA53E91;
  particles = Array.from({ length: state.viewport === 'phone' ? 34 : 58 }, () => ({
    x: rand() * width, y: rand() * height, r: .4 + rand() * 1.6,
    vy: .08 + rand() * .28, vx: -.06 + rand() * .12,
    alpha: .12 + rand() * .4, ember: rand() > .76,
  }));
}
function resizeCanvas() {
  const box = frame.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
  canvas.style.width = `${box.width}px`; canvas.style.height = `${box.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resetParticles(box.width, box.height);
}
function drawBackdrop(time) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#332b1d'); sky.addColorStop(.34, '#211b13'); sky.addColorStop(.72, '#100d09'); sky.addColorStop(1, '#090704');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  const moonX = w * .55, moonY = h * .24, moonR = Math.min(w, h) * .135;
  const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.4);
  glow.addColorStop(0, 'rgba(225,204,125,.27)'); glow.addColorStop(.44, 'rgba(165,130,67,.11)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(204,194,132,.27)'; ctx.fill();

  const mountain = (baseline, color, points) => {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (const [x, y] of points) ctx.lineTo(w * x, h * y);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  mountain(.7, '#211a12', [[0,.56],[.07,.48],[.15,.61],[.24,.38],[.31,.59],[.42,.46],[.5,.62],[.61,.37],[.68,.57],[.78,.43],[.87,.61],[1,.5]]);
  mountain(.8, '#17120d', [[0,.68],[.12,.57],[.22,.72],[.34,.5],[.43,.72],[.54,.58],[.65,.73],[.76,.54],[.88,.71],[1,.62]]);
  mountain(.9, '#0d0a07', [[0,.79],[.13,.72],[.28,.82],[.44,.67],[.58,.83],[.72,.7],[.87,.82],[1,.74]]);

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const p of particles) {
    if (!still) { p.y -= p.vy; p.x += p.vx + Math.sin((time * .0005) + p.y * .01) * .05; }
    if (p.y < -4) { p.y = h + 4; p.x = rand() * w; }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.ember ? `rgba(222,147,65,${p.alpha})` : `rgba(204,198,181,${p.alpha * .5})`;
    ctx.fill();
  }
  requestAnimationFrame(drawBackdrop);
}

new ResizeObserver(resizeCanvas).observe(frame);
resizeCanvas(); syncToggles(); setConcept(state.concept); setMeterState('overflow'); setInputFamily('unknown'); setScene('splash'); requestAnimationFrame(drawBackdrop);
