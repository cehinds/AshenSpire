// src/content/settingsDefaults.js — THE OWNER'S PROMOTED SETTINGS DEFAULTS.
//
// WRITTEN BY tools/settings-defaults.mjs, never by hand: that tool reads a
// settings profile (Settings → Advanced → Defaults & sync, or any Export
// configuration file), checks it through the same import door a player's
// file goes through, and writes the values below.
//
// What the game does with them (src/model/settingsDefaults.js):
//   · a key the player has never set starts at this value;
//   · a key still at the value an earlier promotion gave it follows a new one;
//   · a key the player changed is theirs and is never touched;
//   · Reset puts a key back to this value, not to the row's code default.
// Empty values mean the code defaults stand, exactly as before this file.
export const SETTINGS_DEFAULTS = Object.freeze({
  version: 'none',
  values: Object.freeze({}),
});
