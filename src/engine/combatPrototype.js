// Shared deterministic playtest policy. Uses real dispatch and exact previews.
import { dispatch } from './combat.js';
import { previewFoundationAction } from './combatRules.js';
import { createPrototypeCombat, prototypeBuilds, prototypeScenarios } from '../content/prototypes/combatBuilds.js';

const incoming = (c) => c.enemies.filter((e) => e.alive).reduce((n, e) => n + (e.intent?.damage || 0) * (e.intent?.hits || 1), 0);
export function prototypeOptions(c) {
  const targets = c.enemies.filter((e) => e.alive);
  const choices = [];
  const threat = incoming(c);
  for (const card of c.piles.hand) {
    const def = c.registries.cards.get(card.cardId);
    const targeted = def.effects.some((e) => e.target === 'enemy');
    for (const target of targeted ? targets : [null]) {
      const intent = { type: 'playCard', cardInstanceId: card.instanceId, ...(target ? { targetId: target.id } : {}) };
      try {
        const preview = previewFoundationAction(c, (copy) => dispatch(copy, intent));
        const next = preview.state;
        const dealt = c.enemies.reduce((n, e, i) => n + e.hp - Math.max(0, next.enemies[i].hp), 0);
        const kills = c.enemies.filter((e, i) => e.alive && !next.enemies[i].alive).length;
        const defense = Math.min(threat, next.player.block + (next.player.evade || 0) * (targets[0]?.intent?.damage || 0))
          - Math.min(threat, c.player.block + (c.player.evade || 0) * (targets[0]?.intent?.damage || 0));
        const stamina = next.player.stamina - c.player.stamina;
        const mana = c.player.mana - next.player.mana;
        const buildup = preview.result.events.filter((e) => e.type === 'statusApplied' && e.status === 'bleed').reduce((n, e) => n + e.stacks, 0);
        // One fixed policy for all builds. This is a diagnostic, not optimal play.
        const score = dealt + kills * 10 + defense * 0.8 + buildup * 1.5 + stamina * 1.2 - mana * 5
          + (!c.player.stanceId && next.player.stanceId ? 4 : 0);
        choices.push({ intent, score, name: def.name, events: preview.result.events });
      } catch (error) {
        if (!/not enough|insufficient|cannot afford|already|requires|cost|energy|stamina|mana/i.test(error.message)) throw error;
      }
    }
  }
  return choices.sort((a, b) => b.score - a.score || a.intent.cardInstanceId.localeCompare(b.intent.cardInstanceId)
    || (a.intent.targetId || '').localeCompare(b.intent.targetId || ''));
}

export function runPrototypeFight(buildId, scenarioId, seed, pools = {}) {
  const c = createPrototypeCombat(buildId, scenarioId, seed, pools);
  let actions = 0;
  while (!c.result && c.turn <= 30 && actions < 200) {
    const option = prototypeOptions(c)[0];
    dispatch(c, option && option.score > 0 ? option.intent : { type: 'endTurn' });
    actions++;
  }
  const events = c.eventLog;
  return { buildId, scenarioId, seed, result: c.result || 'timeout', turns: c.turn, actions,
    hp: Math.max(0, c.player.hp), stamina: c.player.stamina, mana: c.player.mana,
    impact: events.filter((e) => e.type === 'impactDealt' && e.sourceId === 'player').reduce((n, e) => n + e.amount, 0),
    bleeds: events.filter((e) => e.type === 'procBurst' && e.status === 'bleed').length,
    staggers: events.filter((e) => e.type === 'enemyStaggered').length,
    manaSpent: events.filter((e) => e.type === 'cardPlayed').reduce((n, e) => n + (e.manaSpent || 0), 0),
  };
}

export function runPrototypeMatrix(seeds = 100, progress = () => {}, pressure = 1) {
  const rows = [];
  for (const buildId of Object.keys(prototypeBuilds)) {
    for (const scenarioId of Object.keys(prototypeScenarios)) {
      for (let seed = 1; seed <= seeds; seed++) rows.push(runPrototypeFight(buildId, scenarioId, seed, { pressure }));
      progress(buildId, scenarioId);
    }
    for (let seed = 1; seed <= seeds; seed++) {
      let pools = { pressure }, completed = 0, last;
      for (const scenarioId of ['basic', 'armored', 'boss']) {
        last = runPrototypeFight(buildId, scenarioId, seed, pools);
        if (last.result !== 'victory') break;
        completed++;
        pools = { pressure, hp: last.hp, stamina: last.stamina, mana: last.mana };
      }
      rows.push({ ...last, scenarioId: 'gauntlet', completed });
    }
    progress(buildId, 'gauntlet');
  }
  const summary = [];
  for (const buildId of Object.keys(prototypeBuilds)) for (const scenarioId of [...Object.keys(prototypeScenarios), 'gauntlet']) {
    const group = rows.filter((r) => r.buildId === buildId && r.scenarioId === scenarioId);
    const mean = (key) => Number((group.reduce((n, r) => n + (r[key] || 0), 0) / group.length).toFixed(2));
    summary.push({ build: buildId, scenario: scenarioId, wins: group.filter((r) => r.result === 'victory' && (scenarioId !== 'gauntlet' || r.completed === 3)).length,
      trials: group.length, turns: mean('turns'), hp: mean('hp'), mana: mean('mana'), impact: mean('impact'), bleeds: mean('bleeds'), staggers: mean('staggers'),
      ...(scenarioId === 'gauntlet' ? { completed: mean('completed') } : {}) });
  }
  return { seeds, pressure, policy: 'greedy-exact-preview-v1', limitations: ['Armor/load derive from prototype equipment; resource caps remain controlled fixtures, not final production builds.', 'Fixed greedy policy is not optimal human play.', 'Gauntlet carries HP, stamina and mana; no rest, consumables or upgrades.', 'No reward pool or production run migration is enabled.'], summary, rows };
}
