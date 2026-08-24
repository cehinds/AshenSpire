import { childModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { uiComponentAttrs } from './uiComponents.js';
import { fullscreenCapability, isFullscreen, toggleFullscreen } from '../screens/settings.js';
import { musicQuickSettingsPlan } from '../models/HudQuickSettingsModel.js';

let releaseActiveStack = null;
const HUD_QUICK_REFRESH = 'ashenspire:hud-quick-settings-refresh';

export function updateHudQuickSettingsBinding(binding, nextSettings) {
  binding.settings = nextSettings && typeof nextSettings === 'object' ? nextSettings : {};
  return binding.settings;
}

export function refreshHudQuickSettings(root, settings) {
  const stack = root?.querySelector?.('[data-hud-quick-settings]');
  if (!stack || typeof stack.dispatchEvent !== 'function') return false;
  stack.dispatchEvent(new CustomEvent(HUD_QUICK_REFRESH, { detail: { settings } }));
  return true;
}

function controlHtml(model, action, label, glyph, stateLabel, active) {
  return `<button type="button" class="hud-quick-setting${active ? ' on' : ''}" data-hud-quick-action="${action}"
    ${uiComponentAttrs(model.component, model.variant)} aria-label="${model.accessibility.label}" aria-pressed="${active}">
    <span class="hud-quick-setting-glyph" aria-hidden="true">${glyph}</span>
    <span class="hud-quick-setting-label">${label}</span>
    <span class="hud-quick-setting-state" data-hud-quick-state>${stateLabel}</span>
  </button>`;
}

export function hudQuickSettingsHtml(model) {
  if (!model.properties.enabled) return '';
  const fullscreen = childModel(model, UI.fullscreenControl);
  const music = childModel(model, UI.musicControl);
  const style = `--hud-quick-edge-gap:${model.properties.edgeGapPx}px;--hud-quick-stack-gap:${model.properties.stackGapPx}px;`
    + `--hud-quick-label-font:${model.properties.labelFontPx}px;--hud-quick-glyph-size:${model.properties.glyphSizePx}px;`
    + `--hud-quick-state-dot:${model.properties.stateDotPx}px`;
  return `<aside class="hud-quick-settings${model.properties.showLabels ? '' : ' compact'}" data-hud-quick-settings
    data-place="${model.properties.place}" data-card-background="${model.properties.showCardBackground}" ${uiComponentAttrs(model.component, model.variant)} style="${style}" aria-label="Quick display and audio settings">
    ${controlHtml(fullscreen, 'fullscreen', 'Fullscreen', '⛶', 'Off', false)}
    ${controlHtml(music, 'music', 'Music', '♪', music.properties.stateLabel, music.properties.active)}
    <p class="hud-quick-notice" data-hud-quick-notice role="status" aria-live="polite" hidden></p>
  </aside>`;
}

function showHudNotice(stack, message, kind = 'status') {
  const notice = stack.querySelector('[data-hud-quick-notice]');
  if (!notice) return null;
  notice.textContent = message;
  notice.dataset.kind = kind;
  notice.hidden = false;
  return notice;
}

function hideHudNotice(stack, kind = null) {
  const notice = stack.querySelector('[data-hud-quick-notice]');
  if (!notice) return;
  if (kind && notice.dataset.kind !== kind) return;
  notice.hidden = true;
  notice.textContent = '';
  delete notice.dataset.kind;
}

function syncFullscreen(stack) {
  const button = stack.querySelector('[data-hud-quick-action="fullscreen"]');
  if (!button) return;
  const capability = fullscreenCapability();
  const active = isFullscreen();
  button.classList.toggle('on', active);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', capability.supported
    ? (active ? 'Exit fullscreen' : 'Enter fullscreen')
    : 'Fullscreen unavailable in this browser');
  button.disabled = !capability.supported;
  button.setAttribute('aria-disabled', String(!capability.supported));
  button.title = capability.supported
    ? (active ? 'Exit fullscreen' : 'Enter fullscreen')
    : 'Fullscreen is unavailable here. On iPhone, use Add to Home Screen.';
  const state = button.querySelector('[data-hud-quick-state]');
  if (state) state.textContent = capability.supported ? (active ? 'On' : 'Off') : 'N/A';
  if (!capability.supported) {
    showHudNotice(stack, 'Fullscreen is unavailable here. On iPhone, use Add to Home Screen.', 'unsupported');
  } else {
    hideHudNotice(stack, 'unsupported');
  }
}

function syncMusic(stack, settings) {
  const button = stack.querySelector('[data-hud-quick-action="music"]');
  if (!button) return;
  const plan = musicQuickSettingsPlan(settings);
  button.classList.toggle('on', plan.active);
  button.setAttribute('aria-pressed', String(plan.active));
  button.setAttribute('aria-label', plan.label);
  button.title = plan.label;
  const state = button.querySelector('[data-hud-quick-state]');
  if (state) state.textContent = plan.stateLabel;
}

export function wireHudQuickSettings(root, { settings = {}, onSettingsChange = null } = {}) {
  if (releaseActiveStack) releaseActiveStack();
  const stack = root.querySelector('[data-hud-quick-settings]');
  if (!stack) {
    releaseActiveStack = null;
    return () => {};
  }
  const fullscreenButton = stack.querySelector('[data-hud-quick-action="fullscreen"]');
  const musicButton = stack.querySelector('[data-hud-quick-action="music"]');
  const binding = { settings };
  const fullscreenSyncTimers = new Set();
  let noticeTimer = null;
  const onFullscreenChange = () => syncFullscreen(stack);
  const onSettingsRefresh = (event) => {
    updateHudQuickSettingsBinding(binding, event.detail?.settings);
    syncMusic(stack, binding.settings);
  };
  const onFullscreenClick = async () => {
    fullscreenButton.disabled = true;
    fullscreenButton.setAttribute('aria-disabled', 'true');
    const result = await toggleFullscreen();
    syncFullscreen(stack);
    // Some browser shells settle fullscreen one frame after the request and
    // omit the matching change event when they refuse or immediately exit.
    // Re-read the platform state so the toggle never stays visually inverted.
    for (const delay of [150, 900]) {
      const timer = setTimeout(() => {
        fullscreenSyncTimers.delete(timer);
        if (stack.isConnected) syncFullscreen(stack);
      }, delay);
      fullscreenSyncTimers.add(timer);
    }
    if (result.ok) {
      hideHudNotice(stack);
    } else {
      showHudNotice(stack, result.message || 'Fullscreen is unavailable in this browser.', 'refused');
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        if (stack.isConnected) hideHudNotice(stack, 'refused');
      }, 6500);
    }
  };
  const onMusicClick = () => {
    const change = musicQuickSettingsPlan(binding.settings).change;
    Object.assign(binding.settings, change);
    if (onSettingsChange) onSettingsChange(change);
    syncMusic(stack, binding.settings);
  };
  fullscreenButton?.addEventListener('click', onFullscreenClick);
  musicButton?.addEventListener('click', onMusicClick);
  stack.addEventListener(HUD_QUICK_REFRESH, onSettingsRefresh);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  syncFullscreen(stack);
  syncMusic(stack, binding.settings);
  // Fullscreen exit notifications are inconsistent in embedded and mobile
  // browser shells. A cheap state read keeps the control truthful even when
  // the platform drops that event; this interval owns no simulation state.
  const fullscreenStatePoll = setInterval(() => syncFullscreen(stack), 750);

  const detachObserver = new MutationObserver(() => {
    if (!stack.isConnected) release();
  });
  const release = () => {
    detachObserver.disconnect();
    clearInterval(fullscreenStatePoll);
    clearTimeout(noticeTimer);
    fullscreenSyncTimers.forEach(clearTimeout);
    fullscreenSyncTimers.clear();
    fullscreenButton?.removeEventListener('click', onFullscreenClick);
    musicButton?.removeEventListener('click', onMusicClick);
    stack.removeEventListener(HUD_QUICK_REFRESH, onSettingsRefresh);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    if (releaseActiveStack === release) releaseActiveStack = null;
  };
  detachObserver.observe(document.body, { childList: true, subtree: true });
  releaseActiveStack = release;
  return release;
}
