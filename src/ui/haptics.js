// src/ui/haptics.js — vibration on the cues that have a pattern (FINISH wave 13).
//
// Wiring: main.js passes every sfx cue id here beside the audio engine, so the
// moments that sound (card play, damage taken, turn start) can also be felt.
// The patterns are content (src/content/haptics.js); this file only decides
// whether to ask the device. The `haptics` setting is read on every cue, so
// turning it off in Settings stops the next buzz with no reload.
import { HAPTIC_PATTERNS, HAPTICS_DEFAULT_ON } from '../content/haptics.js';

/** hapticsEnabled(settings) → is the sparse `haptics` setting on? */
export function hapticsEnabled(settings = {}) {
  const value = settings?.haptics;
  return typeof value === 'boolean' ? value : HAPTICS_DEFAULT_ON;
}

/**
 * createHaptics({ getSettings, patterns? }) → cue(id) → true when it vibrated.
 * Silent (false) when the setting is off, the id has no pattern, or the device
 * has no `navigator.vibrate` (desktop browsers, iOS Safari).
 */
export function createHaptics({ getSettings = () => ({}), patterns = HAPTIC_PATTERNS } = {}) {
  return function cue(id) {
    if (!hapticsEnabled(getSettings())) return false;
    if (!Object.prototype.hasOwnProperty.call(patterns, id)) return false;
    const nav = globalThis.navigator;
    if (!nav || typeof nav.vibrate !== 'function') return false;
    try { return nav.vibrate([...patterns[id]]) !== false; } catch { return false; }
  };
}
