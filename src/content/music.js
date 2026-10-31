// src/content/music.js — the procedural score, as data (SPEC §3.1(4), §7.4).
//
// The synth engine (src/ui/audio.js) knows how to PLAY a bed; what the beds
// are is content. Adding a mood or a new screen's music is a data edit in
// content/source/music.json, with no change to the engine — same rule the cards
// and enemies follow. content-build compiles it to src/content/generated/music.js.
//
// THE SILENCE WORD: a context that should be deliberately quiet is spelled
// with the exact word 'silence' as its whole value — `credits: 'silence'` —
// never null, never a missing key, never [] or a zero gain. Those are
// mistakes and the validator rejects each by name (model/validate.js; the
// word's one home is MUSIC_SILENCE_WORD in model/schemas.js). A quiet screen
// must be a decision someone typed, because untyped quiet is how a broken
// audio path hides. A user music folder naming tracks for a silence context
// still plays them — the more specific typed intent wins.
//
// The music sample manifest sits here too: naming a file for a context makes
// the engine play that sample instead of synthesizing, and a missing/failed
// load falls back to the synth, so this stays safe to point at art that
// doesn't exist yet. (The SFX manifest + recipes live in content/sfx.js —
// one home per medium.)

import { MUSIC_SILENCE_WORD } from '../model/schemas.js';
import { music } from './generated/music.js';

// THE SHIPPED SCORE. The repo's music/ folder (music/manifest.json, filled from
// music/PROMPTS.md); the folder name is authored in content/source/music.json
// (shippedMusicFolder) and what it does is in content/source/CONTENT-NOTES.md,
// "Music".
export const SHIPPED_MUSIC_FOLDER = music.shippedMusicFolder;

// A real build can point these at files; missing/failed loads fall back to synth.
export const MUSIC_MANIFEST = {
  // combat: 'assets/music/combat.ogg',
};

// Minor / phrygian-ish scales (semitone offsets from the root) per mood.
export const SCALES = music.scales;

// Music beds per context (authored in content/source/music.json, `beds`).
// `quiet` is not in the JSON: the silence word's one home is MUSIC_SILENCE_WORD
// (model/schemas.js), so it is spelled here, first, and the authored beds follow.
export const BEDS = {
  quiet: MUSIC_SILENCE_WORD,
  ...music.beds,
};

// THE MAP SOUNDS LIKE WHERE YOU ARE: each region in `mapRegions` (music.json)
// gets a `map-<region id>` context sharing the map's bed, and a fallback to the
// folder's plain `map` list (MUSIC_TRACK_FALLBACK).
export const MAP_REGIONS = music.mapRegions;
export const MUSIC_TRACK_FALLBACK = {};
for (const id of MAP_REGIONS) {
  BEDS[`map-${id}`] = BEDS.map;
  MUSIC_TRACK_FALLBACK[`map-${id}`] = 'map';
}

// The context the map screen asks for: its region's, or plain `map` when the
// region is unknown.
export function mapMusicContext(regionId) {
  return MAP_REGIONS.includes(regionId) ? `map-${regionId}` : 'map';
}
