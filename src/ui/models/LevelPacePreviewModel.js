// src/ui/models/LevelPacePreviewModel.js — the Levelling preview on Settings →
// Advanced → Progression, decided without a DOM (SPEC §15.2).
//
// "I change XP settings and I'm levelling up way too much" (owner,
// 2026-09-26). Nothing on the Settings screen showed what the curve, the awards,
// the XP multiplier and the Level-up value make together. This does, from the
// same configured content bundle a new run is born from (the XP multiplier is
// already rounded into its awards there), through the one pure function the
// game climbs with (`levelPace` in model/levelup.js, which shares its climb
// with `awardLevelXp`), so the preview cannot disagree with play. Every word
// it says is a `settings.levelPace.*` row of content/source/uiStrings.csv.

import { contentBundle } from '../../content/index.js';
import { appliedXpMultiplier, configuredContentBundle } from '../../model/advancedConfig.js';
import { combatLevelXp, levelPace } from '../../model/levelup.js';
import { SKILL_KINDS, xpToNext as skillXpToNext } from '../../model/skills.js';
import { t } from '../strings.js';
import { refusalFor } from './StatsPreviewModel.js';

const plural = (count) => (count === 1 ? '' : 's');
// Four places, so a typed multiplier such as 0.125 reads as the number applied.
const num = (value) => String(Number(Number(value).toFixed(4)));

/**
 * levelPacePreview(settings, { pointsPerLevel }) → levelPace's result on the
 * configured content, plus every line the panel draws:
 *
 *   { ...levelPace(registries, { pointsPerLevel }), xpMultiplier, refused,
 *     title, subtitle, terms, curveTitle,
 *     fights: [{ ...fight, text, pointsText }],
 *     curve: [{ ...step, label, totalText }], problem }
 *
 * `xpMultiplier` is the value configuredContentBundle applied
 * (`appliedXpMultiplier`), 1 when none is stored. `pointsPerLevel` is the
 * Level-up value the screen resolved (settings.js `resolveLevelUpValue`);
 * omitted, the configured bundle's, which already reads `settings.levelUpValue`.
 */
export function levelPacePreview(settings = {}, { pointsPerLevel = null } = {}) {
  // THE BUNDLE A RUN WOULD ACTUALLY GET. `main.js` `rebuildRegistries` refuses
  // a configuration that fails validateContent or the structural checks and
  // plays the authored defaults instead; the preview runs the same checks
  // (StatsPreviewModel `refusalFor`), prices that fallback, and says why
  // (Codex, #1349: growth 0.5 drew a curve no run would climb).
  let configured;
  let refused = null;
  try {
    configured = configuredContentBundle(contentBundle, settings || {});
    refused = refusalFor(settings || {}, configured);
  } catch (error) {
    refused = error.message;
  }
  if (refused) configured = contentBundle;
  // levelPace reads only `registries.balance`; the whole registry build is not needed to price a climb.
  const pace = levelPace({ balance: configured.balance }, { pointsPerLevel });
  // The fallback applies no multiplier either: the authored awards, ×1.
  const applied = refused ? null : appliedXpMultiplier(settings);
  const xpMultiplier = applied === null ? 1 : applied;
  const cap = pace.maxLevelsPerFight;
  const terms = [
    t('settings.levelPace.multiplier', { multiplier: num(xpMultiplier) }),
    t('settings.levelPace.pointsPerLevel', { count: pace.pointsPerLevel, plural: plural(pace.pointsPerLevel) }),
    cap ? t('settings.levelPace.cap', { count: cap, plural: plural(cap) }) : t('settings.levelPace.noCap'),
  ].join(' · ');
  const xp = configured.balance.xp;
  const killText = t('settings.levelPace.killLine', {
    base: num(xp.kill.normal),
    levelFactor: num(xp.killLevelMultiplier),
    powerBase: num(xp.combatWin),
    powerFactor: num(xp.combatPowerMultiplier),
    example: combatLevelXp({ balance: configured.balance }, {
      victory: true,
      pool: pace.fights[0].pool,
      enemies: [{ level: 5, combatPower: 3, alive: false }, { level: 5, combatPower: 3, alive: false }],
    }),
  });
  const skillText = t('settings.levelPace.skillLine', {
    hit: num(configured.balance.skill.xp.perHit),
    win: num(configured.balance.skill.xp.perWinEquipped),
    cost: skillXpToNext({ balance: configured.balance }, SKILL_KINDS[0], 0),
  });
  const fights = pace.fights.map((fight) => {
    const worth = fight.from.map((row) => t(row.capped ? 'settings.levelPace.worthCapped' : 'settings.levelPace.worth',
      { count: row.levelsGained, plural: plural(row.levelsGained), level: row.level })).join(', ');
    return {
      ...fight,
      text: t('settings.levelPace.fightLine', {
        fight: t(`settings.levelPace.fight.${fight.pool}`), kills: fight.kills, killsPlural: plural(fight.kills), xp: fight.xp, worth,
      }),
      pointsText: fight.from.map((row) => t('settings.levelPace.points', { count: row.points, plural: plural(row.points), level: row.level })).join(' · '),
    };
  });
  const curve = pace.curve.map((row) => ({
    ...row,
    label: t('settings.levelPace.curveLevel', { level: row.level }),
    totalText: t('settings.levelPace.curveTotal', { total: row.total }),
  }));
  return {
    ...pace,
    xpMultiplier,
    refused: refused ? t('settings.levelPace.refused', { problem: refused }) : null,
    title: t('settings.levelPace.title'),
    subtitle: t('settings.levelPace.subtitle'),
    terms,
    killText,
    skillText,
    curveTitle: t('settings.levelPace.curveTitle'),
    fights,
    curve,
  };
}
