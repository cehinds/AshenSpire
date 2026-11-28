// src/ui/artTier.js — Settings → Display → Art quality, the built-in tier
// (docs/EXTERNAL-ASSETS-PLAN.md §5, step 8c).
//
// The web edition carries no art inside it: src/ui/assetPacks.js loads the
// light or the high pack the HTML pins. This module decides which one to ask
// for, from the setting:
//
//   Auto            light on a narrow layout (`data-layout="narrow"`, the one
//                   decider in main.js), on a phone-sized screen in either
//                   orientation, with Save-Data on, or on a low-memory device;
//                   the build's default tier otherwise.
//   Light / High    that tier, whatever the device.
//   Local high-res  Auto's tier, with the player's folder laid over it
//                   (src/ui/highResArt.js, unchanged).
//
// The loader's fallback still applies: High on a build that carries no high
// pack, or whose high index fails, shows light; nothing loaded shows
// placeholders. The boot load asks for this tier (main.js passes `tier`), and a
// change in play reloads the indexes at once (applyArtTier): images on screen
// are re-pointed (builtInArtArrived), and if the new load fails the art already
// on screen stays. Auto is decided when the game loads and when it is chosen;
// a window resized later does not swap the art under the player.
//
// When the load has failed (placeholders), the row offers Retry
// (retryBuiltInArt, step 5), the same reload the title's notice runs.
//
// A single file (ASSET_MAP filled) and the source tree pin no packs: Light and
// High are disabled there and the row says why (tierRowNote). The setting is
// per-device (LOCAL_ONLY_KEYS in src/model/settingsSync.js), never synced.

import {
  ART_QUALITY_KEY, ART_AUTO, ART_LIGHT, ART_HIGH, ART_LOCAL_HIGH, ART_QUALITY_CHOICES, LEGACY_ART_QUALITY, ART_SOURCE_EVENT,
} from './highResArt.js';
import {
  ASSET_PACKS, packsPinned, builtInArtStatus, loadBuiltInPacks, startBuiltInArt,
} from './assetPacks.js';
import { ASSET_MAP } from './assetmap.js';
import { UiFullText } from './strings.js';
import { RETRY_WAIT_MS } from './bootArt.js';

const TIER_LIGHT = 'light';
const TIER_HIGH = 'high';
const LOAD_STATE_IDLE = 'idle';
const LOAD_STATE_LOADING = 'loading';
const LOAD_STATE_LOADED = 'loaded';
const LOAD_STATE_FAILED = 'failed';
const LAYOUT_ATTRIBUTE = 'data-layout';
const NARROW_LAYOUT = 'narrow';
const LIGHT_REASON_STRINGS = Object.freeze(
  {
    saveData: 'art.tier.reason.saveData',
    narrow: 'art.tier.reason.narrow',
    small: 'art.tier.reason.small',
    lowMemory: 'art.tier.reason.lowMemory',
  },
);

/** At or under this many GB (navigator.deviceMemory), Auto picks light. */
export const LOW_MEMORY_GB = 2;
/**
 * At or under this many CSS pixels on the screen's SHORT side, Auto picks
 * light: a phone booted in landscape has a wide layout but is still a phone
 * (deviceMemory is Chromium-only, so Safari and Firefox phones need this).
 * Phones are about 320–480; small tablets start near 740.
 */
export const SMALL_SCREEN_PX = 600;

/** The setting's choice, with a value stored before step 8c ('Built-in') read as Auto. */
export function artQualityChoice(settings) {
  const raw = (settings || {})[ART_QUALITY_KEY];
  const value = Object.hasOwn(LEGACY_ART_QUALITY, raw) ? LEGACY_ART_QUALITY[raw] : raw;
  return ART_QUALITY_CHOICES.includes(value) ? value : ART_AUTO;
}

// The uiStrings row naming why this device should get light art, or null.
function lightReasonId(doc, nav, scr)
{
  if (nav?.connection?.saveData === true)
  {
    return LIGHT_REASON_STRINGS.saveData;
  }
  const layout = doc?.documentElement?.getAttribute?.(LAYOUT_ATTRIBUTE);
  if (layout === NARROW_LAYOUT)
  {
    return LIGHT_REASON_STRINGS.narrow;
  }
  const shortSide = Math.min(Number(scr?.width), Number(scr?.height));
  if (Number.isFinite(shortSide) && shortSide > 0 && shortSide <= SMALL_SCREEN_PX)
  {
    return LIGHT_REASON_STRINGS.small;
  }
  const memory = Number(nav?.deviceMemory);
  if (Number.isFinite(memory) && memory > 0 && memory <= LOW_MEMORY_GB)
  {
    return LIGHT_REASON_STRINGS.lowMemory;
  }
  return null;
}

/**
 * autoTier({ defaultTier, doc, nav }) → { tier, reason }. `reason` names why
 * Auto chose light below the build's default, else ''.
 */
export function autoTier(
  {
    defaultTier = ASSET_PACKS?.tier,
    doc = globalThis.document,
    nav = globalThis.navigator,
    scr = globalThis.screen,
  } = {},
)
{
  if (defaultTier !== TIER_HIGH)
  {
    return { tier: TIER_LIGHT, reason: '' };
  }
  const reasonId = lightReasonId(doc, nav, scr);
  return reasonId
    ? { tier: TIER_LIGHT, reason: UiFullText(reasonId) }
    : { tier: TIER_HIGH, reason: '' };
}

/** The tier the setting asks the loader for: light or high. */
export function requestedTier(settings, env = {}) {
  const choice = artQualityChoice(settings);
  if (choice === ART_LIGHT) return TIER_LIGHT;
  if (choice === ART_HIGH) return TIER_HIGH;
  return autoTier(env).tier;
}

/** True when Light and High can do something here: the build pins packs. */
export function tiersAvailable(pin = ASSET_PACKS, inlineMap = ASSET_MAP) {
  return packsPinned(pin, inlineMap);
}

/** For the settings row: Light and High are disabled where no packs are pinned. */
export function tierChoiceDisabled(choice, pin = ASSET_PACKS, inlineMap = ASSET_MAP) {
  return (choice === ART_LIGHT || choice === ART_HIGH) && !tiersAvailable(pin, inlineMap);
}

let lastSettings = null;
let lastSceneryChoice = null;

// Display exports are common to both packs, so their desktop default is high.
export function displaySceneryTier(env = {}) {
  return requestedTier(lastSettings, { ...env, defaultTier: TIER_HIGH });
}

// Painted scene backdrops are static, drawn once, and read badly upscaled from the
// 256px phone files, so phones get the full scene art unless the player chose
// Light, Data Saver is on, or the device reports little memory (Auto's
// narrow-layout "light" does not apply here).
export function SceneryFullArt(env = {}) {
  const choice = artQualityChoice(lastSettings);
  if (choice === ART_LIGHT) return false;
  if (choice === ART_HIGH) return true;
  const nav = env.nav ?? globalThis.navigator;
  if (nav?.connection?.saveData === true) return false;
  const memory = Number(nav?.deviceMemory);
  return !(Number.isFinite(memory) && memory > 0 && memory <= LOW_MEMORY_GB);
}

let lastChoice = null; // the choice the art on screen was loaded for
let switching = false;
let retrying = false; // a Retry (step 5) is running
// The Retry in flight, from the press until it settles (queued or loading):
// one at a time, shared by the title's notice and Settings (Codex on #1471).
let retryInFlight = null;
// The load the queue is running now (a switch or a Retry) and its round. A
// newer round aborts it at once, so a Retry stalled on its 60 s deadline does
// not hold back the switch the player made after it (Codex on #1471): its
// requests are aborted and it settles as superseded (null).
let inFlight = null; // { round, controller }
function startInFlight(mine) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  inFlight = { round: mine, controller };
  return controller?.signal || null;
}
function supersedeInFlight() {
  if (inFlight && inFlight.round !== round) {
    try { inFlight.controller?.abort(); } catch { /* settled */ }
    inFlight = null;
  }
}

/**
 * True from a Retry's press until it settles. Every Retry control reads this
 * when it is drawn and when it is pressed: a Settings slot rebuilt mid-retry
 * draws its button busy, and a press meanwhile is refused.
 */
export function retryRunning() { return !!retryInFlight; }

// Told when a Retry starts and how it ends, from whichever control pressed it:
// the title's notice follows a Retry pressed in Settings too.
let onRetry = null;
/** onRetryProgress(fn) — fn({ phase: 'start' }) when a Retry begins, fn({ phase: 'end', result }) when it settles. */
export function onRetryProgress(fn) { onRetry = typeof fn === 'function' ? fn : null; }
function tellRetry(event) { if (onRetry) try { onRetry(event); } catch { /* a listener must not fail the Retry */ } }
let queue = Promise.resolve();
let round = 0;
let onArrived = null;

// The Settings row's sentences and tier words, as uiStrings rows.
const TIER_STRINGS = Object.freeze(
  {
    inlineOnly: 'art.tier.inlineOnly',
    sourceTree: 'art.tier.sourceTree',
    loading: 'art.tier.loading',
    showing: 'art.tier.showing',
    notLoaded: 'art.tier.notLoaded',
    notCarried: 'art.tier.notCarried',
    autoLight: 'art.tier.autoLight',
    failed: 'art.failed.settings',
  },
);
const STILL_LOADING_STATES = Object.freeze(
  [
    LOAD_STATE_LOADING,
    LOAD_STATE_IDLE,
  ],
);

// One status sentence about the tier on screen; a tier id is also its word.
function tierLine(stringId, shownTier, extraTokens = {})
{
  return UiFullText(stringId, { tier: shownTier, ...extraTokens });
}

function noTiersLine(inlineMap)
{
  const carriesArtInside = Object.keys(inlineMap || {}).length > 0;
  return UiFullText(
    carriesArtInside
      ? TIER_STRINGS.inlineOnly
      : TIER_STRINGS.sourceTree,
  );
}

// Why the shown tier is not the one asked for, or null when they match.
function mismatchLine(status, pin)
{
  if (!status.requested || status.requested === status.tier)
  {
    return null;
  }
  const requestedPackExists = Boolean(pin?.packs?.[status.requested]);
  const stringId = requestedPackExists
    ? TIER_STRINGS.notLoaded
    : TIER_STRINGS.notCarried;
  return tierLine(stringId, status.tier, { requested: status.requested });
}

// Auto chose Light below the build's default: say why, or null.
function autoLightLine(settings, status, pin, env)
{
  const choice = artQualityChoice(settings);
  if (choice !== ART_AUTO && choice !== ART_LOCAL_HIGH)
  {
    return null;
  }
  const auto = autoTier({ defaultTier: pin?.tier, ...env });
  const lightByAuto = status.tier === TIER_LIGHT && status.requested === TIER_LIGHT;
  if (!lightByAuto || !auto.reason)
  {
    return null;
  }
  return tierLine(TIER_STRINGS.autoLight, status.tier, { reason: auto.reason });
}

/**
 * tierStatus(settings, opts) — the row's live line: which tier is on screen and
 * why, or why Light and High do nothing in this copy.
 */
export function tierStatus(settings, { pin = ASSET_PACKS, inlineMap = ASSET_MAP, env = {} } = {})
{
  if (!tiersAvailable(pin, inlineMap))
  {
    return noTiersLine(inlineMap);
  }
  const status = builtInArtStatus();
  if (switching || STILL_LOADING_STATES.includes(status.state))
  {
    const wanted = requestedTier(settings, { defaultTier: pin?.tier, ...env });
    return tierLine(TIER_STRINGS.loading, wanted);
  }
  if (status.state !== LOAD_STATE_LOADED)
  {
    return UiFullText(TIER_STRINGS.failed);
  }
  return mismatchLine(status, pin)
    ?? autoLightLine(settings, status, pin, env)
    ?? tierLine(TIER_STRINGS.showing, status.tier);
}

/**
 * True when the row offers Retry (step 5): the build pins packs and its load
 * has failed, or a Retry is running (the button stays, disabled, so the focus
 * the player put on it is not lost).
 */
export function retryOffered({ pin = ASSET_PACKS, inlineMap = ASSET_MAP } = {})
{
  const loadFailed = !switching && builtInArtStatus().state === LOAD_STATE_FAILED;
  return tiersAvailable(pin, inlineMap) && (retrying || loadFailed);
}

function showTierStatus(settings, where = {}) {
  const doc = globalThis.document;
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const text = tierStatus(settings, where);
  for (const el of doc.querySelectorAll('[data-art-tier-status]')) el.textContent = text;
  const offered = retryOffered(where);
  for (const el of doc.querySelectorAll('[data-art-retry]')) {
    const focused = doc.activeElement === el;
    el.hidden = !offered;
    // aria-disabled, not disabled, while it runs: a disabled control drops the
    // focus the player put on it (the click handler ignores it meanwhile).
    if (retrying) { el.setAttribute('aria-disabled', 'true'); el.setAttribute('aria-busy', 'true'); }
    else { el.removeAttribute('aria-disabled'); el.removeAttribute('aria-busy'); }
    // A Retry that loaded hides its button: the focus goes to the row's live
    // line, which now says which art is on screen.
    if (focused && !offered) {
      const line = doc.getElementById?.('set-artQuality-tier');
      if (line) { line.setAttribute('tabindex', '-1'); try { line.focus({ preventScroll: true }); } catch { /* detached */ } }
    }
  }
}

function stamp(result, { failed = false } = {}) {
  try {
    const root = globalThis.document?.documentElement;
    if (!root?.dataset)
    {
      return;
    }
    if (result.state === LOAD_STATE_LOADED)
    {
      root.dataset.builtInArt = result.tier;
    }
    else if (failed && result.state === LOAD_STATE_FAILED)
    {
      root.dataset.builtInArt = LOAD_STATE_FAILED;
    }
  } catch { /* no document: tests */ }
}

/**
 * onTierArrived(fn) — called with the new Map once a tier switch has loaded
 * (main.js passes builtInArtArrived, which re-points the images on screen).
 */
export function onTierArrived(fn) { onArrived = typeof fn === 'function' ? fn : null; }

/**
 * applyArtTier(settings, opts) — called with every settings change. In a build
 * that pins packs, once the boot load has settled, a change of the Art quality
 * choice reloads the indexes when it asks for another tier; switches made in
 * quick succession run one at a time and only the latest is loaded. Any other
 * setting changing leaves the tier alone, so Auto is not re-decided because the
 * window was resized meanwhile. Resolves to the loader's status, or null when
 * nothing was loaded. Never throws.
 */
export function applyArtTier(settings, opts = {}) {
  lastSettings = settings;
  const sceneryChoice = artQualityChoice(settings);
  if (sceneryChoice !== lastSceneryChoice) {
    lastSceneryChoice = sceneryChoice;
    try { globalThis.document?.dispatchEvent?.(new CustomEvent(ART_SOURCE_EVENT)); } catch { /* a listener must not break the setting */ }
  }
  const pin = opts.pin ?? ASSET_PACKS;
  if (!packsPinned(pin, opts.inlineMap ?? ASSET_MAP)) return Promise.resolve(null);
  const state = builtInArtStatus().state;
  const choice = artQualityChoice(settings);
  // The boot load is not started yet: main.js asks it for this tier.
  if (state === LOAD_STATE_IDLE) { lastChoice = choice; return Promise.resolve(null); }
  // The boot load is under way: look again once it settles (startBuiltInArt
  // returns the load already running; it never starts a second one).
  if (state === LOAD_STATE_LOADING && !switching) {
    return startBuiltInArt().then(() => (lastSettings === settings ? applyArtTier(settings, opts) : null), () => null);
  }
  if (choice === lastChoice) { showTierStatus(settings); return Promise.resolve(null); }
  lastChoice = choice;
  const mine = ++round;
  supersedeInFlight();
  queue = queue.then(async () => {
    if (mine !== round) return null;
    // Decided here, in the queued job, not when the setting changed: a batch
    // update (a profile load, a restore) applies the display settings before
    // applyUiScale writes the new data-layout, and Auto must read the new one.
    const want = requestedTier(settings, { defaultTier: pin.tier, ...(opts.env || {}) });
    const now = builtInArtStatus();
    // Already showing it — or asked for it before on a build that has no such
    // pack, where asking again would only fall back the same way.
    const fallsBackTheSameWay = now.tier === want || !pin.packs?.[want];
    if (now.state === LOAD_STATE_LOADED && now.requested === want && fallsBackTheSameWay)
    {
      showTierStatus(settings);
      return null;
    }
    switching = true;
    showTierStatus(settings);
    try {
      const result = await loadBuiltInPacks({
        ...opts.load, pin, tier: want, keepOnFail: true, stillWanted: () => mine === round, signal: startInFlight(mine),
        onSource: (map) => { if (onArrived) try { onArrived(map); } catch { /* a listener must not fail the switch */ } },
      });
      if (result.superseded) return null;
      stamp(result);
      if (result.failed.length) console.warn(`built-in art: ${result.failed.join('; ')}`);
      return result;
    } catch {
      return null;
    } finally {
      switching = false;
      showTierStatus(lastSettings || settings);
    }
  });
  return queue;
}

/**
 * retryBuiltInArt(settings, opts) — Retry (step 5): load the indexes again for
 * the tier the setting asks for, whatever the last load asked. It goes through
 * the same queue as a tier switch and supersedes one still waiting (the
 * stillWanted guard), keeps the art on screen when it fails (keepOnFail), and
 * hands a map that loads to onTierArrived, which re-points the images, lets
 * the shipped score be read again (step 3c's musicHold) and sends
 * ART_SOURCE_EVENT (the map tiles ask again). Under file:// the loader reads
 * the .js twins (step 4). Resolves to the loader's status, or null when this
 * build pins no packs or the retry was superseded. Never throws.
 */
export function retryBuiltInArt(settings = lastSettings, opts = {}) {
  const pin = opts.pin ?? ASSET_PACKS;
  const where = { pin, inlineMap: opts.inlineMap ?? ASSET_MAP };
  if (!packsPinned(pin, where.inlineMap)) return Promise.resolve(null);
  // One Retry at a time: a second press while one is in flight gets the same
  // outcome, rather than queuing a second load behind it.
  if (retryInFlight) return retryInFlight;
  retrying = true;
  tellRetry({ phase: 'start' });
  if (settings) lastSettings = settings;
  lastChoice = artQualityChoice(lastSettings);
  const mine = ++round;
  supersedeInFlight();
  queue = queue.then(async () => {
    if (mine !== round) return null;
    const want = requestedTier(lastSettings, { defaultTier: pin.tier, ...(opts.env || {}) });
    switching = true;
    retrying = true;
    showTierStatus(lastSettings, where);
    try {
      // Its own deadline (RETRY_WAIT_MS, content/config), not the boot's: the
      // title stays usable meanwhile, and a slow link needs the time.
      const result = await loadBuiltInPacks({
        // Past the HTTP cache ('reload'): the failure it retries may be a
        // cached error, or a cached copy that fails its pin (Codex on #1471).
        deadlineMs: RETRY_WAIT_MS, cache: 'reload', ...opts.load, pin, tier: want, keepOnFail: true, stillWanted: () => mine === round, signal: startInFlight(mine),
        onSource: (map) => { if (onArrived) try { onArrived(map); } catch { /* a listener must not fail the retry */ } },
      });
      if (result.superseded) return null;
      stamp(result, { failed: true });
      if (result.failed.length) console.warn(`built-in art: ${result.failed.join('; ')}`);
      return result;
    } catch {
      return null;
    } finally {
      switching = false;
      retrying = false;
      retryInFlight = null;
      showTierStatus(lastSettings, where);
    }
  });
  // A Retry superseded before it ran (the job returns at once) settles here too.
  const tracked = queue.finally(() => { if (retryInFlight === tracked) { retryInFlight = null; retrying = false; } });
  tracked.then((result) => tellRetry({ phase: 'end', result }), () => tellRetry({ phase: 'end', result: null }));
  retryInFlight = tracked;
  return tracked;
}

/** For tests: forget the switches. */
export function resetArtTier() {
  lastSettings = null;
  lastSceneryChoice = null;
  lastChoice = null;
  switching = false;
  retrying = false;
  retryInFlight = null;
  inFlight = null;
  queue = Promise.resolve();
  round = 0;
  onArrived = null;
  onRetry = null;
}
