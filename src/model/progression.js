// src/model/progression.js — the climb, read for a surface to draw.
//
// Two ledgers already exist and neither had a window: `run.level`
// (levelup.js — XP toward the next character level and the points it grants)
// and `run.skills` (skills.js — a track per weapon group, armour weight
// class, the focus group, dual-wielding and each class). The Armoury showed
// the LEVEL NUMBER and nothing of either climb, so a player could not see how
// far the next level was, nor that swinging a sword was levelling a track at
// all.
//
// THIS MODULE READS, IT NEVER WRITES. Every number is taken from the two
// ledgers' own functions — `levelUpPlan`, `characterLevel` and `xpToNext` —
// so the bar and the shrine can never disagree about what the next step
// costs. It carries no curve, no award size and no cap of its own.
//
// AND IT SPELLS EACH PHRASE ONCE. The waiting-points line and the waiting-
// drafts line are returned as `pointsLabel` / `draftsLabel` rather than kept
// private inside `sense`: the Armoury used to re-spell both beside the bar,
// so the plural rule lived in two files and a reworded tooltip would have
// silently disagreed with the badge under it.
import { characterLevel, levelUpPlan } from './levelup.js';
import { classSkillId, skillLevel, skillTracks, xpToNext as skillXpToNext } from './skills.js';

// How many tracks the fold summary names before it counts the rest. One home,
// because the sentence says the number twice ("the first three · +2 more").
const SUMMARY_NAMES = 3;

/** A fill percentage, clamped and rounded to a tenth — what a meter wants. */
function fillPct(xp, cost) {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const raw = (Number.isFinite(xp) ? xp : 0) / cost;
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 10;
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * levelProgress(registries, run) → the character level as a bar:
 * `{ level, xp, xpToNext, remaining, pct, capped, points, pointsLabel,
 * label, value, sense }`.
 *
 * A capped run reads full rather than empty: there is no next step to be
 * partway through, and an empty bar at the ceiling would read as a loss.
 *
 * AT THE CAP, `xpToNext` IS 0, NOT THE DEAD STEP. `levelUpPlan` keeps
 * quoting the cost of a level that can never be reached, and `awardLevelXp`
 * keeps adding XP to the ledger past the ceiling — so a capped run could
 * hand the meter `cur: 999, max: 170` to stamp onto `data-cur` / `data-max`,
 * which is the one pair the kit tells an instrument to trust instead of the
 * label. There is no next step, so the honest answer is no step.
 *
 * THE LEVEL IS `characterLevel`'s, NOT the plan's raw row: levelup.js keeps
 * that as the guarded home for the DISPLAYED level, and reading the row
 * directly let a corrupt ledger print "XP to level x1" from `level + 1`.
 */
export function levelProgress(registries, run) {
  const plan = levelUpPlan(registries, run);
  const capped = !!plan.capped;
  const level = characterLevel(run);
  const cost = !capped && Number.isFinite(plan.xpToNext) && plan.xpToNext > 0 ? plan.xpToNext : 0;
  const xp = Number.isFinite(plan.xp) && plan.xp > 0 ? plan.xp : 0;
  const points = Number.isInteger(plan.points) && plan.points > 0 ? plan.points : 0;
  const pointsLabel = points ? `${plural(points, 'point')} to assign` : '';
  const shrineWord = points ? ` ${plural(points, 'point')} waiting to be assigned at a shrine.` : '';
  return {
    level,
    xp: capped ? 0 : xp,
    xpToNext: cost,
    remaining: capped ? 0 : Math.max(0, cost - xp),
    pct: capped ? 100 : fillPct(xp, cost),
    capped,
    points,
    pointsLabel,
    label: `Level ${level}`,
    value: capped ? 'Level cap' : `${xp} / ${cost} XP`,
    sense: capped
      ? `Level ${level} — the level cap.${shrineWord}`
      : `${Math.max(0, cost - xp)} XP to level ${level + 1}. Fights pay XP; each level grants attribute points.${shrineWord}`,
  };
}

/**
 * skillProgressRows(registries, run, { includeUntouched }) → one row per
 * skill track worth showing, each `{ id, kind, label, level, xp, xpToNext,
 * remaining, pct, pendingDrafts, draftsLabel, own, order, value, sense }`.
 *
 * WHICH TRACKS: the run's own class track always — it is the tree's ladder and
 * reads 0 honestly — plus every track the run has touched. An untouched
 * greatsword track is not progression the player has, and listing all of them
 * would bury the four that are. `includeUntouched` asks for the full ledger.
 *
 * THE ORDER: the class track first, then the busiest climb, then the authored
 * track order, so the list does not reshuffle under a single point of XP.
 *
 * A CLASS THE REGISTRY DOES NOT KNOW FAILS BY NAME. The promise above is
 * "the run's own class track always"; a run whose class has no track would
 * have quietly returned a list without it, and the fold would have read "no
 * track trained yet" over a ledger that had them. Bad data is named here the
 * way skills.js names an unknown track id, not degraded into a plausible
 * screen.
 */
export function skillProgressRows(registries, run, { includeUntouched = false } = {}) {
  const tracks = skillTracks(registries);
  const classId = run && typeof run.class === 'string' ? run.class : '';
  const ownId = classId ? classSkillId(classId) : null;
  if (ownId && !tracks.some((track) => track.id === ownId)) {
    throw new Error(`skillProgressRows: '${classId}' is not a class the registry declares, so it has no class track`);
  }
  const ledger = (run && run.skills && typeof run.skills === 'object') ? run.skills : {};
  const rows = [];
  tracks.forEach((track, order) => {
    const row = ledger[track.id] || null;
    const level = skillLevel(run, track.id);
    const xp = row && Number.isFinite(row.xp) && row.xp > 0 ? Math.floor(row.xp) : 0;
    const pendingDrafts = row && Number.isInteger(row.pendingDrafts) && row.pendingDrafts > 0 ? row.pendingDrafts : 0;
    const own = track.id === ownId;
    const touched = level > 0 || xp > 0 || pendingDrafts > 0;
    if (!includeUntouched && !own && !touched) return;
    const cost = skillXpToNext(registries, track.kind, level);
    const draftsLabel = pendingDrafts ? plural(pendingDrafts, 'draft') : '';
    rows.push({
      id: track.id,
      kind: track.kind,
      label: track.label,
      level,
      xp,
      xpToNext: cost,
      remaining: Math.max(0, cost - xp),
      pct: fillPct(xp, cost),
      pendingDrafts,
      draftsLabel,
      own,
      order,
      value: `${xp} / ${cost} XP`,
      sense: `${track.label} — level ${level}, ${Math.max(0, cost - xp)} XP to level ${level + 1}.`
        + (pendingDrafts ? ` ${draftsLabel} waiting at the next reward.` : ''),
    });
  });
  rows.sort((a, b) => (Number(b.own) - Number(a.own)) || (b.level - a.level) || (b.xp - a.xp) || (a.order - b.order));
  return rows;
}

/**
 * staleSkillTracks(registries, run) → the ledger's ids that no track declares
 * any more, so a caller can say so rather than drop them in silence. A row
 * here has no label to draw and cannot become a bar, but it may be holding
 * pending drafts, and a summary that omits it lies about what is waiting.
 */
export function staleSkillTracks(registries, run) {
  const known = new Set(skillTracks(registries).map((track) => track.id));
  const ledger = (run && run.skills && typeof run.skills === 'object') ? run.skills : {};
  return Object.keys(ledger).filter((id) => !known.has(id));
}

/** The one-line fold summary: the levels that exist, or why none do. */
export function skillProgressSummary(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'No track trained yet';
  const drafts = rows.reduce((sum, row) => sum + row.pendingDrafts, 0);
  const named = rows.slice(0, SUMMARY_NAMES).map((row) => `${row.label} ${row.level}`).join(' · ');
  const rest = rows.length > SUMMARY_NAMES ? ` · +${rows.length - SUMMARY_NAMES} more` : '';
  return `${named}${rest}${drafts ? ` · ${plural(drafts, 'draft')} waiting` : ''}`;
}
