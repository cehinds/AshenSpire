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
// ledgers' own functions — `levelUpPlan` and `xpToNext` — so the bar and the
// shrine can never disagree about what the next step costs. It carries no
// curve, no award size and no cap of its own.
import { levelUpPlan } from './levelup.js';
import { classSkillId, skillLevel, skillTracks, xpToNext as skillXpToNext } from './skills.js';

/** A fill percentage, clamped and rounded to a tenth — what a meter wants. */
function fillPct(xp, cost) {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const raw = (Number.isFinite(xp) ? xp : 0) / cost;
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 10;
}

/**
 * levelProgress(registries, run) → the character level as a bar:
 * `{ level, xp, xpToNext, remaining, pct, capped, points, label, value, sense }`.
 *
 * A capped run reads full rather than empty: there is no next step to be
 * partway through, and an empty bar at the ceiling would read as a loss.
 */
export function levelProgress(registries, run) {
  const plan = levelUpPlan(registries, run);
  const capped = !!plan.capped;
  const cost = Number.isFinite(plan.xpToNext) && plan.xpToNext > 0 ? plan.xpToNext : 0;
  const xp = Number.isFinite(plan.xp) && plan.xp > 0 ? plan.xp : 0;
  const remaining = capped ? 0 : Math.max(0, cost - xp);
  const points = Number.isInteger(plan.points) && plan.points > 0 ? plan.points : 0;
  const pointWord = `${points} point${points === 1 ? '' : 's'} waiting to be assigned at a shrine`;
  return {
    level: plan.level,
    xp,
    xpToNext: cost,
    remaining,
    pct: capped ? 100 : fillPct(xp, cost),
    capped,
    points,
    label: `Level ${plan.level}`,
    value: capped ? 'Level cap' : `${xp} / ${cost} XP`,
    sense: capped
      ? `Level ${plan.level} — the level cap.${points ? ` ${pointWord}.` : ''}`
      : `${remaining} XP to level ${plan.level + 1}. Fights pay XP; each level grants attribute points.${points ? ` ${pointWord}.` : ''}`,
  };
}

/**
 * skillProgressRows(registries, run, { includeUntouched }) → one row per
 * skill track worth showing, each `{ id, kind, label, level, xp, xpToNext,
 * remaining, pct, pendingDrafts, own, value, sense }`.
 *
 * WHICH TRACKS: the run's own class track always — it is the tree's ladder and
 * reads 0 honestly — plus every track the run has touched. An untouched
 * greatsword track is not progression the player has, and listing all of them
 * would bury the four that are. `includeUntouched` asks for the full ledger.
 *
 * THE ORDER: the class track first, then the busiest climb, then the authored
 * track order, so the list does not reshuffle under a single point of XP.
 */
export function skillProgressRows(registries, run, { includeUntouched = false } = {}) {
  const ownId = run && typeof run.class === 'string' && run.class ? classSkillId(run.class) : null;
  const rows = [];
  skillTracks(registries).forEach((track, order) => {
    const ledger = (run && run.skills && run.skills[track.id]) || null;
    const level = skillLevel(run, track.id);
    const xp = ledger && Number.isFinite(ledger.xp) && ledger.xp > 0 ? Math.floor(ledger.xp) : 0;
    const pendingDrafts = ledger && Number.isInteger(ledger.pendingDrafts) && ledger.pendingDrafts > 0 ? ledger.pendingDrafts : 0;
    const own = track.id === ownId;
    const touched = level > 0 || xp > 0 || pendingDrafts > 0;
    if (!includeUntouched && !own && !touched) return;
    const cost = skillXpToNext(registries, track.kind, level);
    const draftWord = pendingDrafts ? ` ${pendingDrafts} draft${pendingDrafts === 1 ? '' : 's'} waiting at the next reward.` : '';
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
      own,
      order,
      value: `${xp} / ${cost} XP`,
      sense: `${track.label} — level ${level}, ${Math.max(0, cost - xp)} XP to level ${level + 1}.${draftWord}`,
    });
  });
  rows.sort((a, b) => (Number(b.own) - Number(a.own)) || (b.level - a.level) || (b.xp - a.xp) || (a.order - b.order));
  return rows;
}

/** The one-line fold summary: the levels that exist, or why none do. */
export function skillProgressSummary(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'No track trained yet';
  const drafts = rows.reduce((sum, row) => sum + row.pendingDrafts, 0);
  const named = rows.slice(0, 3).map((row) => `${row.label} ${row.level}`).join(' · ');
  const rest = rows.length > 3 ? ` · +${rows.length - 3} more` : '';
  return `${named}${rest}${drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'} waiting` : ''}`;
}
