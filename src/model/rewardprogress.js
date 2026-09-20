// src/model/rewardprogress.js — WHAT THE FIGHT MOVED, on the spoils door.
//
// Constantine, 2026-09-20, on the victory door: "why don't I see level
// progression, xp gained, skill progression in here either". He was right to
// ask: the fight pays the character level (model/levelup.js) and every skill
// track it touched (engine/skillXp.js) at `onCombatEnd`, BEFORE the door
// opens — so the ledgers the player is being rewarded on had already moved
// and the screen said nothing about it. The spoils read like the whole payout
// while being only the half you pick up.
//
// This is that missing half, derived ONCE, here, the rewardplan.js precedent:
// the screen draws rows and decides nothing. A row is a track's ledger as it
// stands NOW (levels are paid before the door) plus the XP this fight paid
// into it — the gain is a receipt the caller hands in (main.js keeps it on
// the pending-reward offer, so a reload resumes the same sentence), never a
// re-derivation from the combat log this file cannot see.
//
// WHICH TRACKS. The character level always, then the skill tracks, the ones
// this fight paid first and the highest-levelled after, `maxSkills` shown and
// the rest counted — his layout ("up to three shown", "+Y (other skills)").
// A track nothing has ever touched and this fight did not pay is not a row:
// the door would otherwise list every weapon group in the game.
//
// FAIL SOFT, and this is the one place in the model where that is right: the
// panel is INFORMATIONAL, and it is mounted by preview scenes and old callers
// whose run has no class, no ledgers and whose registries may carry no curve.
// A missing table costs the player a bar, never the spoils behind it — so
// every lookup here is guarded and an unreadable track is simply not a row.
// NOT A ROW MEANS NOT A ROW: a track whose curve will not read is dropped
// rather than carried with an empty `xpToNext`, because the only thing a row
// with no next level can say is "Max" — and a broken table reading as a
// player's ceiling is a lie, not a degradation (Copilot, #1232).

import { characterLevel, levelOf, xpToNext as levelXpToNext } from './levelup.js';
import { skillTracks, skillLevel, xpToNext as skillXpToNext } from './skills.js';

/** His layout's ceiling: three tracks shown, the rest counted. */
export const MAX_SKILL_ROWS = 3;

/**
 * combatXpGains({ receipt, awards, levelGained }) → the offer's receipt,
 * `{ level, tracks }`: the fight's per-track XP as the combat recorded it
 * (engine/skillXp.js skillXpReceipt), plus every award the run's OWNER made
 * on top of it — the class track's pay, which the combat cannot know — and
 * what the character level was paid. Summed, never replaced: a track that
 * appears in both was genuinely paid twice, and the door shows the total.
 *
 * ONE HOME, because this shape is the contract between the fight and the
 * door and it crosses the save: main.js composes it here rather than inline,
 * so what a reload resumes is the same derivation a test can hold.
 */
export function combatXpGains({ receipt = null, awards = [], levelGained = 0 } = {}) {
  const tracks = {};
  const add = (id, xp) => {
    if (typeof id !== 'string' || !id || !(Number.isFinite(xp) && xp > 0)) return;
    tracks[id] = (tracks[id] || 0) + Math.floor(xp);
  };
  for (const [id, xp] of Object.entries(receipt || {})) add(id, xp);
  for (const award of awards || []) if (award) add(award.skillId, award.gained);
  return { level: Number.isFinite(levelGained) && levelGained > 0 ? Math.floor(levelGained) : 0, tracks };
}

/** A class row from either registry shape (a registry, or the authored array). */
function classRow(registries, classId) {
  if (!classId) return null;
  const classes = registries && registries.classes;
  try {
    if (Array.isArray(classes)) return classes.find((c) => c && c.id === classId) || null;
    if (classes && typeof classes.get === 'function') return classes.get(classId) || null;
  } catch { /* an unknown id is not a crash here — the label falls back */ }
  return null;
}

const ratio = (xp, next) => (Number.isFinite(next) && next > 0 ? Math.max(0, Math.min(1, xp / next)) : 0);

/**
 * characterProgress(registries, run, gained) → the character level's row, or
 * null for a run that has neither a class nor a ledger (a preview scene's
 * stub), and null again when the curve will not read: only a CAP may leave a
 * row without a next level. `capped` is balance.levelUp.maxLevels reached —
 * the XP stays on the ledger and there is no next level to point at.
 */
export function characterProgress(registries, run, gained = 0) {
  if (!run || (!run.class && !run.level)) return null;
  const ledger = levelOf(run);
  const level = characterLevel(run);
  const cls = classRow(registries, run.class);
  const cap = ((((registries || {}).balance || {}).levelUp) || {}).maxLevels;
  const capped = Number.isInteger(cap) && level >= cap;
  let next = null;
  try { next = capped ? null : levelXpToNext(registries, level); } catch { next = null; }
  if (!capped && !(Number.isFinite(next) && next > 0)) return null;
  const xp = Number.isFinite(ledger.xp) ? Math.max(0, Math.floor(ledger.xp)) : 0;
  return Object.freeze({
    kind: 'character',
    id: 'character',
    label: (cls && cls.name) || run.class || null,
    level,
    xp,
    xpToNext: next,
    fraction: capped ? 1 : ratio(xp, next),
    gained: Number.isFinite(gained) && gained > 0 ? Math.floor(gained) : 0,
    capped,
  });
}

/**
 * skillProgress(registries, run, trackGains, { maxSkills }) → { rows, hidden }
 * The tracks worth a line, best first: what this fight paid, then what the run
 * has climbed furthest. `hidden` is how many candidate tracks the ceiling left
 * out — his "+Y (other skills)".
 */
export function skillProgress(registries, run, trackGains = {}, { maxSkills = MAX_SKILL_ROWS } = {}) {
  let tracks = [];
  try { tracks = skillTracks(registries) || []; } catch { tracks = []; }
  const ledgers = (run && run.skills) || {};
  const rows = [];
  for (const track of tracks) {
    // A class track belongs to the run that plays it; the other classes'
    // tracks are not this player's progression.
    if (track.kind === 'class' && track.id !== `class:${run && run.class}`) continue;
    const ledger = ledgers[track.id] || null;
    const gained = Number.isFinite(trackGains[track.id]) && trackGains[track.id] > 0 ? Math.floor(trackGains[track.id]) : 0;
    const level = skillLevel(run, track.id);
    const xp = ledger && Number.isFinite(ledger.xp) ? Math.max(0, Math.floor(ledger.xp)) : 0;
    if (!gained && !level && !xp) continue; // never touched, never paid — not a row
    let next = null;
    try { next = skillXpToNext(registries, track.kind, level); } catch { next = null; }
    if (!(Number.isFinite(next) && next > 0)) continue; // no curve, no row
    rows.push(Object.freeze({
      kind: track.kind,
      id: track.id,
      label: track.label || track.id,
      level,
      xp,
      xpToNext: next,
      fraction: ratio(xp, next),
      gained,
      capped: false, // skill tracks have no authored ceiling
    }));
  }
  // Paid-this-fight first (the biggest gain leading), then the deepest track,
  // then alphabetically — a stable order, so the panel does not shuffle
  // between two renders of the same door.
  rows.sort((a, b) => (b.gained - a.gained) || (b.level - a.level) || (b.xp - a.xp) || a.label.localeCompare(b.label));
  const shown = Math.max(0, Math.floor(maxSkills));
  return { rows: rows.slice(0, shown), hidden: Math.max(0, rows.length - shown) };
}

/**
 * rewardProgress(registries, run, gains, opts) → { character, skills, hidden }
 * — the whole panel, frozen. `gains` is the fight's receipt as combatXpGains
 * shapes it, `{ level, tracks: { [skillId]: xp } }`; asked without one, it
 * still reads the standing ledgers, with no gain lines (the door itself does
 * not ask where there was no fight).
 */
export function rewardProgress(registries, run, gains = null, { maxSkills = MAX_SKILL_ROWS } = {}) {
  const level = gains && Number.isFinite(gains.level) ? Math.max(0, Math.floor(gains.level)) : 0;
  const tracks = (gains && gains.tracks && typeof gains.tracks === 'object' && !Array.isArray(gains.tracks)) ? gains.tracks : {};
  const character = characterProgress(registries, run, level);
  const { rows, hidden } = skillProgress(registries, run, tracks, { maxSkills });
  return Object.freeze({ character, skills: Object.freeze(rows), hidden });
}
