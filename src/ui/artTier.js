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
// A single file (ASSET_MAP filled) and the source tree pin no packs: Light and
// High are disabled there and the row says why (tierRowNote). The setting is
// per-device (LOCAL_ONLY_KEYS in src/model/settingsSync.js), never synced.

import {
  ART_QUALITY_KEY, ART_AUTO, ART_LIGHT, ART_HIGH, ART_LOCAL_HIGH, ART_QUALITY_CHOICES, LEGACY_ART_QUALITY,
} from './highResArt.js';
import {
  ASSET_PACKS, packsPinned, builtInArtStatus, loadBuiltInPacks, startBuiltInArt,
} from './assetPacks.js';
import { ASSET_MAP } from './assetmap.js';

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

/**
 * autoTier({ defaultTier, doc, nav }) → { tier, reason }. `reason` names why
 * Auto chose light below the build's default, else ''.
 */
export function autoTier({ defaultTier = ASSET_PACKS?.tier, doc = globalThis.document, nav = globalThis.navigator, scr = globalThis.screen } = {}) {
  const best = defaultTier === 'high' ? 'high' : 'light';
  if (best === 'light') return { tier: 'light', reason: '' };
  if (nav?.connection?.saveData === true) return { tier: 'light', reason: 'Data Saver is on' };
  if (doc?.documentElement?.getAttribute?.('data-layout') === 'narrow') return { tier: 'light', reason: 'the screen is narrow' };
  const short = Math.min(Number(scr?.width), Number(scr?.height));
  if (Number.isFinite(short) && short > 0 && short <= SMALL_SCREEN_PX) return { tier: 'light', reason: 'the screen is small' };
  const memory = Number(nav?.deviceMemory);
  if (Number.isFinite(memory) && memory > 0 && memory <= LOW_MEMORY_GB) return { tier: 'light', reason: 'this device has little memory' };
  return { tier: best, reason: '' };
}

/** The tier the setting asks the loader for: 'light' or 'high'. */
export function requestedTier(settings, env = {}) {
  const choice = artQualityChoice(settings);
  if (choice === ART_LIGHT) return 'light';
  if (choice === ART_HIGH) return 'high';
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
let lastChoice = null; // the choice the art on screen was loaded for
let switching = false;
let queue = Promise.resolve();
let round = 0;
let onArrived = null;

const TIER_WORD = { high: 'high', light: 'light' };

/**
 * tierStatus(settings, opts) — the row's live line: which tier is on screen and
 * why, or why Light and High do nothing in this copy.
 */
export function tierStatus(settings, { pin = ASSET_PACKS, inlineMap = ASSET_MAP, env = {} } = {}) {
  if (!tiersAvailable(pin, inlineMap)) {
    return Object.keys(inlineMap || {}).length
      ? 'This file carries its art inside it, so it has no other tier to load: Light and High apply to the web edition (the hosted game or the full game folder).'
      : 'This copy loads its art straight from the game’s folders, so there are no tiers to choose: Light and High apply to the built web edition.';
  }
  const choice = artQualityChoice(settings);
  const s = builtInArtStatus();
  if (switching || s.state === 'loading' || s.state === 'idle') return `Loading ${TIER_WORD[requestedTier(settings, { defaultTier: pin?.tier, ...env })]} art…`;
  if (s.state !== 'loaded') return 'The art could not be loaded, so the game is showing placeholders. Reload the page to try again.';
  const showing = `Showing ${TIER_WORD[s.tier]} art`;
  if (s.requested && s.requested !== s.tier) {
    return pin?.packs?.[s.requested] ? `${showing}: the ${TIER_WORD[s.requested]} art could not be loaded.` : `${showing}: this build carries no ${TIER_WORD[s.requested]} art.`;
  }
  if (choice === ART_AUTO || choice === ART_LOCAL_HIGH) {
    const auto = autoTier({ defaultTier: pin?.tier, ...env });
    if (s.tier === 'light' && auto.reason && s.requested === 'light') return `${showing}, because ${auto.reason}. Choose High to load it anyway.`;
  }
  return `${showing}.`;
}

function showTierStatus(settings) {
  const doc = globalThis.document;
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const text = tierStatus(settings);
  for (const el of doc.querySelectorAll('[data-art-tier-status]')) el.textContent = text;
}

function stamp(result) {
  try {
    const root = globalThis.document?.documentElement;
    if (root?.dataset && result.state === 'loaded') root.dataset.builtInArt = result.tier;
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
  const pin = opts.pin ?? ASSET_PACKS;
  if (!packsPinned(pin, opts.inlineMap ?? ASSET_MAP)) return Promise.resolve(null);
  const state = builtInArtStatus().state;
  const choice = artQualityChoice(settings);
  // The boot load is not started yet: main.js asks it for this tier.
  if (state === 'idle') { lastChoice = choice; return Promise.resolve(null); }
  // The boot load is under way: look again once it settles (startBuiltInArt
  // returns the load already running; it never starts a second one).
  if (state === 'loading' && !switching) {
    return startBuiltInArt().then(() => (lastSettings === settings ? applyArtTier(settings, opts) : null), () => null);
  }
  if (choice === lastChoice) { showTierStatus(settings); return Promise.resolve(null); }
  lastChoice = choice;
  const mine = ++round;
  queue = queue.then(async () => {
    if (mine !== round) return null;
    // Decided here, in the queued job, not when the setting changed: a batch
    // update (a profile load, a restore) applies the display settings before
    // applyUiScale writes the new data-layout, and Auto must read the new one.
    const want = requestedTier(settings, { defaultTier: pin.tier, ...(opts.env || {}) });
    const now = builtInArtStatus();
    // Already showing it — or asked for it before on a build that has no such
    // pack, where asking again would only fall back the same way.
    if (now.state === 'loaded' && now.requested === want && (now.tier === want || !pin.packs?.[want])) { showTierStatus(settings); return null; }
    switching = true;
    showTierStatus(settings);
    try {
      const result = await loadBuiltInPacks({
        ...opts.load, pin, tier: want, keepOnFail: true, stillWanted: () => mine === round,
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

/** For tests: forget the switches. */
export function resetArtTier() {
  lastSettings = null;
  lastChoice = null;
  switching = false;
  queue = Promise.resolve();
  round = 0;
  onArrived = null;
}
