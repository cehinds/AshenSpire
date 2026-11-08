// src/model/validate/progression.js — level, xp, level-up, deck floor, skill-track numbers and card mounts.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { CARD_RARITIES } from '../schemas.js';
import { normalizeCardMountRules } from '../cardMounts.js';

export function progressionProblems(b, err, ctx) {
  const { bundle } = ctx;
  if (b.balance && b.balance.level !== undefined) {
    const lv = b.balance.level;
    if (!lv || typeof lv !== 'object' || Array.isArray(lv)) err('balance.level', 'must be an object { xp }');
    else {
      for (const key of Object.keys(lv)) if (!['xp', 'maxLevelsPerFight'].includes(key)) err(`balance.level.${key}`, 'Unknown field');
      // The levelling cap (SPEC §15.2): 0 is no cap, else a whole number of levels.
      if (lv.maxLevelsPerFight !== undefined && !(Number.isInteger(lv.maxLevelsPerFight) && lv.maxLevelsPerFight >= 0)) {
        err('balance.level.maxLevelsPerFight', `must be a non-negative integer (0 is no cap), got ${JSON.stringify(lv.maxLevelsPerFight)}`);
      }
      const xp = lv.xp;
      if (!xp || typeof xp !== 'object' || Array.isArray(xp)) err('balance.level.xp', 'must be an object { base, growth, roundTo }');
      else {
        for (const key of Object.keys(xp)) if (!['base', 'growth', 'roundTo', 'linear', 'multScaler'].includes(key)) err(`balance.level.xp.${key}`, 'Unknown field');
        if (xp.linear !== undefined && typeof xp.linear !== 'boolean') err('balance.level.xp.linear', 'must be a boolean');
        if ((xp.linear === true || xp.multScaler !== undefined) && !(Number.isFinite(xp.multScaler) && xp.multScaler >= 0)) err('balance.level.xp.multScaler', 'must be a non-negative number');
        if (!(Number.isFinite(xp.base) && xp.base > 0)) err('balance.level.xp.base', `must be a positive number, got ${JSON.stringify(xp.base)}`);
        if (!(Number.isFinite(xp.growth) && xp.growth >= 1)) err('balance.level.xp.growth', `must be a number of at least 1, got ${JSON.stringify(xp.growth)}`);
        if (!(Number.isInteger(xp.roundTo) && xp.roundTo > 0)) err('balance.level.xp.roundTo', `must be a positive integer, got ${JSON.stringify(xp.roundTo)}`);
      }
    }
  }
  if (b.balance && b.balance.xp !== undefined) {
    const xp = b.balance.xp;
    if (!xp || typeof xp !== 'object' || Array.isArray(xp)) err('balance.xp', 'must be an object { combatWin, combatPowerMultiplier, kill, killLevelMultiplier, quest }');
    else {
      for (const key of Object.keys(xp)) if (!['combatWin', 'combatPowerMultiplier', 'kill', 'killLevelMultiplier', 'quest'].includes(key)) err(`balance.xp.${key}`, 'Unknown field');
      for (const key of ['combatWin', 'quest']) if (!(Number.isInteger(xp[key]) && xp[key] >= 0)) err(`balance.xp.${key}`, `must be a non-negative integer, got ${JSON.stringify(xp[key])}`);
      if (!(Number.isFinite(xp.killLevelMultiplier) && xp.killLevelMultiplier >= 0)) err('balance.xp.killLevelMultiplier', `must be a non-negative number, got ${JSON.stringify(xp.killLevelMultiplier)}`);
      if (!(Number.isFinite(xp.combatPowerMultiplier) && xp.combatPowerMultiplier >= 0)) err('balance.xp.combatPowerMultiplier', `must be a non-negative number, got ${JSON.stringify(xp.combatPowerMultiplier)}`);
      if (!xp.kill || typeof xp.kill !== 'object' || Array.isArray(xp.kill)) err('balance.xp.kill', 'must be an object { normal, elite, boss }');
      else {
        for (const key of Object.keys(xp.kill)) if (!['normal', 'elite', 'boss'].includes(key)) err(`balance.xp.kill.${key}`, 'Unknown field');
        for (const key of ['normal', 'elite', 'boss']) if (!(Number.isInteger(xp.kill[key]) && xp.kill[key] >= 0)) err(`balance.xp.kill.${key}`, `must be a non-negative integer, got ${JSON.stringify(xp.kill[key])}`);
      }
    }
  }
  if (b.balance && b.balance.levelUp !== undefined) {
    const lu = b.balance.levelUp;
    if (!lu || typeof lu !== 'object' || Array.isArray(lu)) err('balance.levelUp', 'must be an object');
    else {
      for (const key of Object.keys(lu)) if (!['pointsPerLevel', 'maxLevels', 'pointsPerLevelMin', 'pointsPerLevelMax'].includes(key)) err(`balance.levelUp.${key}`, 'Unknown field — cinders buy no level (plan phase 6); the curve is balance.level.xp');
      if (!(Number.isInteger(lu.pointsPerLevel) && lu.pointsPerLevel > 0)) err('balance.levelUp.pointsPerLevel', `must be a positive integer, got ${JSON.stringify(lu.pointsPerLevel)}`);
      if (lu.maxLevels !== null && lu.maxLevels !== undefined && !(Number.isInteger(lu.maxLevels) && lu.maxLevels >= 1)) err('balance.levelUp.maxLevels', `must be null or an integer of at least 1, got ${JSON.stringify(lu.maxLevels)}`);
    }
  }
  if (b.balance && b.balance.deck !== undefined) {
    const deck = b.balance.deck;
    if (!deck || typeof deck !== 'object' || Array.isArray(deck)) err('balance.deck', 'must be an object { minimum, minimumStepLevels, minimumPerStep }');
    else {
      for (const key of Object.keys(deck)) if (!['minimum', 'minimumStepLevels', 'minimumPerStep'].includes(key)) err(`balance.deck.${key}`, 'Unknown field');
      if (!Number.isInteger(deck.minimum) || deck.minimum < 0) err('balance.deck.minimum', `must be a non-negative integer, got ${JSON.stringify(deck.minimum)}`);
      if (!Number.isInteger(deck.minimumStepLevels) || deck.minimumStepLevels < 1) err('balance.deck.minimumStepLevels', `must be a positive integer, got ${JSON.stringify(deck.minimumStepLevels)}`);
      if (!Number.isInteger(deck.minimumPerStep) || deck.minimumPerStep < 0) err('balance.deck.minimumPerStep', `must be a non-negative integer, got ${JSON.stringify(deck.minimumPerStep)}`);
    }
  }
  // The skill tracks' numbers (plan phase 4a): the curve and the award rows
  // model/skills.js and engine/skillXp.js read. Refused by name, never clamped.
  if (b.balance && b.balance.skill !== undefined) {
    const skill = b.balance.skill;
    const posInt = (v) => Number.isInteger(v) && v > 0;
    const nonNeg = (v) => Number.isFinite(v) && v >= 0;
    const curve = (row, path) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { err(path, 'must be an object { base, growth, roundTo, … }'); return; }
      if (!posInt(row.base)) err(`${path}.base`, `must be a positive integer, got ${JSON.stringify(row.base)}`);
      if (!Number.isFinite(row.growth) || row.growth < 1) err(`${path}.growth`, `must be a number ≥ 1, got ${JSON.stringify(row.growth)}`);
      if (!posInt(row.roundTo)) err(`${path}.roundTo`, `must be a positive integer, got ${JSON.stringify(row.roundTo)}`);
      if (row.linear !== undefined && typeof row.linear !== 'boolean') err(`${path}.linear`, 'must be a boolean');
      if ((row.linear === true || row.multScaler !== undefined) && !nonNeg(row.multScaler)) err(`${path}.multScaler`, 'must be a non-negative number');
    };
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) err('balance.skill', 'must be an object { xp, class }');
    else {
      for (const key of Object.keys(skill)) if (!['xp', 'class', 'rarityUnlock', 'draftSize', 'draftsPerCombat', 'rankMax', 'rankUpBonusScale', 'flatEvery', 'attributeEvery', 'featEvery', 'linkedAttributes', 'favoredXpMult'].includes(key)) err(`balance.skill.${key}`, 'Unknown field');
      // The class card's leaning (plan phase 5a): a multiplier of 1 or more.
      if (!(Number.isFinite(skill.favoredXpMult) && skill.favoredXpMult >= 1)) err('balance.skill.favoredXpMult', `must be a number ≥ 1, got ${JSON.stringify(skill.favoredXpMult)}`);
      // The draft rows (plan phase 4b), each present and refused by name.
      for (const key of ['draftSize', 'draftsPerCombat', 'rankMax', 'flatEvery', 'attributeEvery', 'featEvery']) {
        if (!Number.isInteger(skill[key]) || skill[key] < 1) err(`balance.skill.${key}`, `must be a positive integer, got ${JSON.stringify(skill[key])}`);
      }
      // The every-4th-level pick's sets (SPEC §13.4o): a known track to known attributes.
      const linked = skill.linkedAttributes;
      if (!linked || typeof linked !== 'object' || Array.isArray(linked)) err('balance.skill.linkedAttributes', 'must be an object { <trackId>: [attributeId, …] }');
      else {
        const known = new Set((bundle.attributes || []).map((row) => row && row.id));
        // A track key is an item-type node of the tree, or dual-wield: a
        // misspelt key would otherwise never queue a pick, silently.
        const tracks = new Set([...(Array.isArray(bundle.nodes) ? bundle.nodes : []).filter((n) => n && n.parentId === 'itemType' && n.id !== 'item:armor').map((n) => n.id), 'dualWield']);
        for (const [trackId, set] of Object.entries(linked)) {
          if (!tracks.has(trackId)) err(`balance.skill.linkedAttributes.${trackId}`, `'${trackId}' is not a weapon, focus or dual-wield track`);
          if (!Array.isArray(set) || !set.length || set.some((id) => !known.has(id)) || new Set(set).size !== set.length) {
            err(`balance.skill.linkedAttributes.${trackId}`, `must be a non-empty list of distinct attribute ids (${[...known].join(', ')})`);
          }
        }
      }
      // The rank-up bonus's multiplier (owner, 2026-11-01): optional, 1 to 10 (a bonus is never smaller than an upgrade).
      if (skill.rankUpBonusScale !== undefined && !(Number.isFinite(skill.rankUpBonusScale) && skill.rankUpBonusScale >= 1 && skill.rankUpBonusScale <= 10)) err('balance.skill.rankUpBonusScale', `must be a number from 1 to 10, got ${JSON.stringify(skill.rankUpBonusScale)}`);
      // A save refuses a rank above state.js MAX_CARD_RANK (99), so no setting may roll one.
      if (Number.isInteger(skill.rankMax) && skill.rankMax > 99) err('balance.skill.rankMax', `must be at most 99, got ${skill.rankMax}`);
      if (!skill.rarityUnlock || typeof skill.rarityUnlock !== 'object' || Array.isArray(skill.rarityUnlock)) {
        err('balance.skill.rarityUnlock', 'must be an object { <rarity>: level }');
      } else {
        for (const [rarity, level] of Object.entries(skill.rarityUnlock)) {
          if (!CARD_RARITIES.includes(rarity)) err(`balance.skill.rarityUnlock.${rarity}`, `'${rarity}' is not a card rarity (${CARD_RARITIES.join(', ')})`);
          if (!Number.isInteger(level) || level < 1) err(`balance.skill.rarityUnlock.${rarity}`, `must be a positive integer level, got ${JSON.stringify(level)}`);
        }
        if (!Object.keys(skill.rarityUnlock).length) err('balance.skill.rarityUnlock', 'names no rarity — no draft could ever offer a card');
      }
      curve(skill.xp, 'balance.skill.xp');
      if (skill.xp && typeof skill.xp === 'object') {
        for (const key of ['perHit', 'perWinEquipped', 'evadeXp']) if (!nonNeg(skill.xp[key])) err(`balance.skill.xp.${key}`, `must be a non-negative number, got ${JSON.stringify(skill.xp[key])}`);
        for (const key of ['impactPerXp', 'buildupPerXp']) if (!(Number.isFinite(skill.xp[key]) && skill.xp[key] > 0)) err(`balance.skill.xp.${key}`, `must be a positive number, got ${JSON.stringify(skill.xp[key])}`);
        if (!(Number.isFinite(skill.xp.killMult) && skill.xp.killMult >= 1)) err('balance.skill.xp.killMult', `must be a number ≥ 1, got ${JSON.stringify(skill.xp.killMult)}`);
        for (const key of Object.keys(skill.xp)) if (!['base', 'growth', 'roundTo', 'linear', 'multScaler', 'maxLevel', 'perHit', 'perWinEquipped', 'killMult', 'impactPerXp', 'evadeXp', 'buildupPerXp'].includes(key)) err(`balance.skill.xp.${key}`, 'Unknown field');
        // SPEC §13.4o: the level a track stops at; absent or null is no ceiling.
        if (skill.xp.maxLevel != null && !posInt(skill.xp.maxLevel)) err('balance.skill.xp.maxLevel', `must be null or a positive integer level, got ${JSON.stringify(skill.xp.maxLevel)}`);
      }
      if (!skill.class || typeof skill.class !== 'object') err('balance.skill.class', 'must be an object { xp }');
      else {
        for (const key of Object.keys(skill.class)) if (!['xp', 'tierAt'].includes(key)) err(`balance.skill.class.${key}`, 'Unknown field');
        curve(skill.class.xp, 'balance.skill.class.xp');
        if (skill.class.xp && typeof skill.class.xp === 'object') {
          for (const key of Object.keys(skill.class.xp)) if (!['base', 'growth', 'roundTo', 'linear', 'multScaler', 'maxLevel', 'perWin', 'bossKill', 'perQuest'].includes(key)) err(`balance.skill.class.xp.${key}`, 'Unknown field');
          if (skill.class.xp.maxLevel != null && !posInt(skill.class.xp.maxLevel)) err('balance.skill.class.xp.maxLevel', `must be null or a positive integer level, got ${JSON.stringify(skill.class.xp.maxLevel)}`);
          // The class XP sources (plan phase 5b), each present and non-negative.
          for (const key of ['perWin', 'bossKill', 'perQuest']) if (!nonNeg(skill.class.xp[key])) err(`balance.skill.class.xp.${key}`, `must be a non-negative number, got ${JSON.stringify(skill.class.xp[key])}`);
        }
        // The class levels the tree's tiers open at (plan phase 5b): one per
        // tier, rising, the first at level 1 or above.
        const tierAt = skill.class.tierAt;
        if (!Array.isArray(tierAt) || !tierAt.length || tierAt.some((n) => !posInt(n)) || tierAt.some((n, i) => i > 0 && n <= tierAt[i - 1])) {
          err('balance.skill.class.tierAt', `must be a rising list of positive integer levels, one per tier, got ${JSON.stringify(tierAt)}`);
        }
      }
    }
  }
  if (b.balance && b.balance.equipment && b.balance.equipment.cardMounts !== undefined) {
    try {
      const rules = normalizeCardMountRules(b.balance.equipment.cardMounts);
      const tag = (b.tags || []).find((row) => row && row.id === rules.extractableTag);
      if (!tag) err('balance.equipment.cardMounts.extractableTag', `names unknown tag '${rules.extractableTag}' — add a node under the card root in nodes.csv`);
      else if (tag.domain !== 'card') err('balance.equipment.cardMounts.extractableTag', `'${rules.extractableTag}' is in the ${tag.domain} domain, not card — a card could never carry it`);
      for (const [kind, spec] of Object.entries(rules.kinds)) {
        for (const accepted of spec.accepts) {
          if (!(b.tags || []).some((row) => row && row.id === accepted && row.domain === 'card')) {
            err(`balance.equipment.cardMounts.kinds.${kind}.accepts`, `names unknown card tag '${accepted}'`);
          }
        }
        if (spec.fallback && spec.fallback.cardId && !(b.cards || []).some((card) => card && card.id === spec.fallback.cardId)) {
          err(`balance.equipment.cardMounts.kinds.${kind}.fallback`, `names unknown card '${spec.fallback.cardId}'`);
        }
        if (spec.fallback && spec.fallback.unarmedProfile && !((b.balance.equipment.unarmedProfiles || {})[spec.fallback.unarmedProfile])) {
          err(`balance.equipment.cardMounts.kinds.${kind}.fallback`, `names unarmed profile role '${spec.fallback.unarmedProfile}', which balance.equipment.unarmedProfiles does not author`);
        }
      }
    } catch (error) {
      err('balance.equipment.cardMounts', error?.message || 'must be a complete card-mount block');
    }
  }
}
