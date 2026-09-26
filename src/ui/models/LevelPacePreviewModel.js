// src/ui/models/LevelPacePreviewModel.js — the Levelling preview on Settings →
// Advanced → Progression, decided without a DOM (SPEC §15.2).
//
// "I change XP settings and I'm levelling up way too much" (owner,
// 2026-09-26). Nothing on the Settings screen showed what the curve, the awards,
// the XP multiplier and the Level-up value make together. This does, from the
// same configured content bundle a new run is born from (the XP multiplier is
// already rounded into its awards there), through the one pure function the
// game climbs with (`levelPace` in model/levelup.js, which shares its climb
// with `awardLevelXp`), so the preview cannot disagree with play.

import { contentBundle } from '../../content/index.js';
import { configuredContentBundle } from '../../model/advancedConfig.js';
import { levelPace } from '../../model/levelup.js';

const POOL_WORDS = Object.freeze({ normal: 'A normal fight', elite: 'An elite fight', boss: 'A boss fight' });

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * levelPacePreview(settings, { pointsPerLevel }) → levelPace's result on the
 * configured content, plus the XP multiplier in force and a sentence per fight
 * that states its kill count:
 *
 *   { ...levelPace(registries, { pointsPerLevel }), xpMultiplier,
 *     fights: [{ ...fight, text }], problem }
 *
 * `pointsPerLevel` is the Level-up value the screen resolved (settings.js
 * `resolveLevelUpValue`); omitted, the configured bundle's, which already
 * reads `settings.levelUpValue`.
 */
export function levelPacePreview(settings = {}, { pointsPerLevel = null } = {}) {
  let balance;
  try {
    balance = configuredContentBundle(contentBundle, settings || {}).balance;
  } catch (error) {
    return { problem: `The preview cannot read these settings: ${error.message}`, curve: [], fights: [] };
  }
  // levelPace reads only `registries.balance`; the whole registry build is not needed to price a climb.
  const pace = levelPace({ balance }, { pointsPerLevel });
  const multiplier = Number((settings || {})['gameConfig.progression.xpMultiplier']);
  const fights = pace.fights.map((fight) => {
    const worth = fight.from.map((row) => `${plural(row.levelsGained, 'level')} from level ${row.level}${row.capped ? ' (capped)' : ''}`).join(', ');
    return { ...fight, text: `${POOL_WORDS[fight.pool] || fight.pool} (${plural(fight.kills, 'kill')}) gives ${fight.xp} XP: ${worth}.` };
  });
  return { ...pace, xpMultiplier: Number.isFinite(multiplier) ? multiplier : 1, fights, problem: null };
}
