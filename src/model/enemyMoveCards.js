// Read-only enemy action cards. The engine owns selection and live previews.
import { enemyMoveDamage } from './state.js';
import { combatProfileFor, combatProfileTags } from './combatCardProfile.js';
import { combatMatchups } from '../content/combatMatchups.js';
import { variableIntentDamage } from './intentDamage.js';
import { enemySmashFallbackPoise, enemyCounterPoiseDamage } from './stanceRules.js';
const words = (value) => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function enemyActionEffectText(effect, registries) {
  const value = input => typeof input === 'number' || typeof input === 'string' ? String(input) : 'variable';
  const target = effect.target === 'self' ? 'self' : effect.target === 'player' ? 'player' : words(effect.target || 'default target');
  if (effect.op === 'applyStatus') {
    const name = registries?.statuses?.get(effect.status)?.name || words(effect.status);
    return `Apply ${value(effect.stacks ?? effect.value ?? effect.amount ?? 1)} ${name} to ${target}${effect.duration != null ? ` for ${effect.duration} turns` : ''}`;
  }
  if (effect.op === 'heal') return `Heal ${target} for ${value(effect.amount)}`;
  if (effect.op === 'block') return `Give ${target} ${value(effect.amount)} base Block`;
  if (effect.op === 'poiseDamage') return `${value(effect.amount)} base Poise damage to ${target}`;
  if (effect.op === 'addCard') return `Add ${registries?.cards?.get(effect.card)?.name || words(effect.card)} to ${words(effect.pile)}${effect.position ? ` (${effect.position})` : ''}`;
  if (effect.op === 'damage') return `Base ${value(effect.amount)}${effect.hits > 1 ? ` × ${effect.hits}` : ''} damage to ${target} before combat modifiers`;
  if (effect.op === 'moveEngagement') return `${effect.bands < 0 ? 'Close' : 'Retreat'} ${Math.abs(effect.bands)} range band${Math.abs(effect.bands) === 1 ? '' : 's'}`;
  if (effect.op === 'wardDamage') return `${value(effect.amount)} Ward damage to ${target}`;
  if (effect.op === 'buildup') return `Build ${value(effect.amount)} ${registries?.statuses?.get(effect.status)?.name || words(effect.status)} on ${target}`;
  if (effect.op === 'removeStatus') return `Remove ${registries?.statuses?.get(effect.status)?.name || words(effect.status)} from ${target}`;
  if (effect.op === 'restoreMana' || effect.op === 'restoreStamina') return `Restore ${value(effect.amount)} ${effect.op === 'restoreMana' ? 'MP' : 'SP'} to ${target}`;
  // Unsupported future operations stay named without exposing executable source.
  return `${words(effect.op)}${effect.amount == null ? '' : ` ${value(effect.amount)}`} (${target})`;
}

function chargingPoiseText(move, profile, context) {
  if (context.combatExpansionVersion !== 2) return [];
  const pieces = [];
  // Expansion inherits the parent maneuver through every charging payload.
  for (let charging = move.delay?.whileCharging, stage = 1; charging; charging = charging.delay?.whileCharging, stage++) {
    const phase = stage === 1 ? 'while charging' : `during charging stage ${stage}`;
    pieces.push(...(charging.effects || []).filter(effect => effect.op === 'poiseDamage')
      .map(effect => `${enemyActionEffectText(effect, context.registries)} ${phase}`));
    const fallback = enemySmashFallbackPoise(charging, profile, context);
    if (fallback != null) pieces.push(`${fallback} base Poise damage to player ${phase}`);
  }
  return pieces;
}

/** No RNG, mutation, selection or engine dispatch; preview must come from previewIntent. */
export function enemyMoveCards(def, { enemy = null, preview = null, registries = null, combatMatchupRules = null,
  combatExpansionVersion = enemy?.combatExpansionVersion || 1, stanceRules = null, actionPreviews = null } = {}) {
  return Object.entries(def.moves || {}).map(([moveId, move]) => {
    const actionPreview = actionPreviews?.[moveId];
    const profile = combatProfileFor({ ...move, enemyId: def.id, moveId });
    const combatTags = combatProfileTags(profile, registries);
    const active = !preview?.hidden && preview?.moveId === moveId;
    const liveDamage = active && preview.damage != null;
    const projectedDamage = actionPreview?.actionEffects.find(effect => effect.op === 'damage');
    const damage = liveDamage ? preview.damage : projectedDamage?.amount ?? enemyMoveDamage(enemy, move);
    const hits = liveDamage ? (preview.hits ?? 1) : (projectedDamage?.hits ?? move.hits ?? 1);
    const locked = !!move.locked && !(enemy?.unlockedMoves || []).includes(moveId);
    const pieces = [];
    if (profile.maneuver === 'counter') {
      const rules = combatMatchupRules?.counter || registries?.balance?.combatMatchups?.counter || combatMatchups.counter;
      const base = enemyMoveDamage(enemy, { ...move,
        damage: move.counterDamage ?? move.damage ?? rules.defaultDamage });
      pieces.push(`${base} base counter damage`);
      pieces.push(`One eligible hit spends the reaction. Incoming eligible damage × ${rules.incomingMultiplier}; reply only after full Guard or Ward absorption: floor(base × ${rules.retaliationMultiplier}) + ${rules.retaliationFlat} + bonus`);
      const poise = enemyCounterPoiseDamage(move, profile, { combatExpansionVersion, stanceRules, registries });
      if (poise > 0) pieces.push(`${poise} base counter Poise damage${combatExpansionVersion === 2 ? '' : ` × ${rules.poiseMultiplier}`}`);
    }
    const sequence = liveDamage ? variableIntentDamage(preview) : null;
    if (damage != null && (!actionPreview || liveDamage)) pieces.push(`${sequence ? `${sequence.text} (${sequence.totalDamage} total)` : `${damage}${hits > 1 ? ` × ${hits}` : ''}`} ${liveDamage ? 'projected damage' : 'base damage'}`);
    if (!actionPreview && move.block != null) pieces.push(`${move.block} base Block`);
    pieces.push(...(actionPreview?.actionEffects || move.effects || []).filter((effect, index) => !(actionPreview && liveDamage && move.damage != null && index === 0 && effect.op === 'damage')).map(effect => `${enemyActionEffectText(effect, registries)}${effect.conditionMet === false ? ' (condition not met)' : ''}`));
    const fallback = enemySmashFallbackPoise(move, profile, { combatExpansionVersion, stanceRules, registries });
    if (!actionPreview && fallback != null) pieces.push(`${fallback} base Poise damage to player`);
    if (move.delay) {
      pieces.push(`Delayed ${move.delay.turns} turn${move.delay.turns === 1 ? '' : 's'}`);
      if (!actionPreview && move.delay.whileCharging?.block != null) pieces.push(`${move.delay.whileCharging.block} base Block while charging`);
      if (actionPreview) pieces.push(...actionPreview.chargingEffects.map(effect => `${enemyActionEffectText(effect, registries)} while charging`));
      else pieces.push(...chargingPoiseText(move, profile, { combatExpansionVersion, stanceRules, registries }));
    }
    const phaseRequirements = (def.phases || []).filter((phase) => phase.unlockMoves?.includes(moveId)).map((phase) => (
      phase.on === 'hpBelowPct' ? `Unlocks at ${phase.pct}% HP or below` : `Unlocks on ${words(phase.on)}`
    ));
    const tags = Array.isArray(move.tags) ? [...move.tags] : [];
    const state = active ? (preview.pending ? 'Charging' : 'Current intent') : locked ? 'Locked' : 'Move set';
    const meta = [state, words(move.intent), ...phaseRequirements];
    if (move.maxConsecutive != null) meta.push(`At most ${move.maxConsecutive} consecutive selections`);
    if (tags.length) meta.push(`Tags: ${tags.map(words).join(', ')}`);
    if (combatTags.length) meta.push(combatTags.map(tag => tag.label).join(' · '));
    pieces.push(...combatTags.filter(tag => tag.blurb).map(tag => `${tag.label}: ${tag.blurb}`));
    return { id: `${def.id}:${moveId}`, moveId, name: move.name || words(moveId), active, locked,
      tags, combatTags, profile, intent: move.intent, detail: pieces.join(' · ') || words(move.intent), meta: meta.join(' · ') };
  });
}
