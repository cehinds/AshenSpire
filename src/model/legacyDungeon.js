import { legacyDungeons } from '../content/generated/legacyDungeons.js';

export const LEGACY_DUNGEONS = legacyDungeons.dungeons;
export const LEGACY_SCENES = legacyDungeons.scenes;
export const dungeonForEncounter = id => LEGACY_DUNGEONS.find(d => d.bossEncounter === id);
export const dungeonDefinition = run => LEGACY_DUNGEONS.find(d => d.id === run.legacyDungeon?.id);
export const dungeonNode = run => dungeonDefinition(run)?.nodes.find(n => n.id === run.legacyDungeon.current);
export const dungeonScene = run => LEGACY_SCENES.find(s => s.region === run.legacyDungeon?.id && run.legacyDungeon.current >= s.nodeStart && run.legacyDungeon.current <= s.nodeEnd);
export function beginDungeon(run, def, parentNodeId) {
  run.legacyDungeon = { version: 1, id: def.id, parentNodeId, current: def.entrance,
    previous: def.entrance, visited: [def.entrance], resolved: [], cleared: false, pending: null };
}
export function dungeonNeighbors(run, id = run.legacyDungeon.current) {
  return dungeonDefinition(run).edges.filter(e => e.a === id || e.b === id).map(e => e.a === id ? e.b : e.a);
}
export function travelDungeon(run, id) {
  const s = run.legacyDungeon;
  if (s.pending || (!s.cleared && !s.resolved.includes(s.current)) || !dungeonNeighbors(run).includes(id)) return false;
  s.previous = s.current; s.current = id;
  if (!s.visited.includes(id)) s.visited.push(id);
  return true;
}
export function escapeChance(run) {
  const f = legacyDungeons.flee;
  return Math.max(f.min, Math.min(f.max, f.base + f.bonusPerPoint * ((run.attributes?.dexterity ?? f.dexBaseline) - f.dexBaseline)));
}
export function dungeonChoices(run) {
  const s = run.legacyDungeon, n = dungeonNode(run);
  if (s.resolved.includes(n.id) || s.cleared) return [{ id: 'leave', label: 'Return to the road', effects: [], resultText: n.reply }];
  const hostile = ['encounter', 'fight', 'boss'].includes(n.kind);
  const rows = [];
  if (!['fight', 'boss'].includes(n.kind)) rows.push({ id: 'listen', label: n.kind === 'shrine' ? 'Rest at the shrine' : n.kind === 'cache' ? 'Search the remains' : 'Listen and look closer', resultText: n.reply });
  if (hostile) rows.push({ id: 'fight', label: n.kind === 'boss' ? `Face ${dungeonDefinition(run).boss}` : 'Stand and fight', resultText: 'Steel answers. Prepare yourself.' },
    { id: 'flee', label: `Try to flee · ${escapeChance(run)}% · Dexterity bonus`, resultText: '' });
  return rows.map(c => ({ ...c, effects: [] }));
}
export function resolveDungeonNode(run) {
  const s = run.legacyDungeon;
  if (!s.resolved.includes(s.current)) s.resolved.push(s.current);
  if (s.current === dungeonDefinition(run).bossNode) s.cleared = true;
  s.pending = null;
}
// One persisted receipt owns the response, its roll and its effects. Reloads
// continue the receipt rather than rolling escape or awarding a cache again.
export function chooseDungeon(run, choiceId, rng) {
  const s = run.legacyDungeon, n = dungeonNode(run);
  if (s.pending) return s.pending;
  const choice = dungeonChoices(run).find(c => c.id === choiceId);
  if (!choice) throw Error(`Unavailable dungeon response: ${choiceId}`);
  let action = 'map', text = choice.resultText, roll = null;
  if (choiceId === 'fight') action = 'combat';
  else if (choiceId === 'flee') {
    roll = rng.int('events', 1, 100);
    const success = roll <= escapeChance(run);
    action = success ? 'retreat' : 'combat';
    text = `Escape roll ${roll} / ${escapeChance(run)}. ${success ? 'You slip back along the road. The encounter remains.' : 'Your route closes. You must fight.'}`;
  } else if (choiceId === 'listen') {
    if (n.kind === 'shrine') { const healed = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * .25)); run.hp += healed; text += ` Rest restores ${healed} health.`; }
    if (n.kind === 'cache') { run.cinders += 20; text += ' You recover 20 cinders.'; }
    resolveDungeonNode(run);
  }
  s.pending = { choiceId, action, text, roll, nodeId: n.id };
  return s.pending;
}
export function continueDungeon(run) {
  const s = run.legacyDungeon, p = s.pending;
  if (!p) return 'map';
  if (p.action === 'retreat') s.current = s.previous;
  s.pending = null;
  return p.action;
}
export function legacyDungeonProblems(run) {
  const s = run.legacyDungeon;
  if (s == null) return [];
  const d = dungeonDefinition(run);
  if (!d || s.version !== 1) return ['legacyDungeon: unknown dungeon or version'];
  const ids = new Set(d.nodes.map(n => n.id));
  const errors = [];
  if (typeof s.parentNodeId !== 'string' || !run.mapGraph?.nodes?.[s.parentNodeId]) errors.push('legacyDungeon: invalid parent');
  if (!ids.has(s.current) || !ids.has(s.previous)) errors.push('legacyDungeon: invalid position');
  for (const k of ['visited', 'resolved']) if (!Array.isArray(s[k]) || s[k].some(id => !ids.has(id)) || new Set(s[k]).size !== s[k].length) errors.push(`legacyDungeon: invalid ${k}`);
  if (typeof s.cleared !== 'boolean' || (s.cleared && !(Array.isArray(s.resolved) && s.resolved.includes(d.bossNode)))) errors.push('legacyDungeon: invalid clear');
  if (s.pending && (!['map', 'retreat', 'combat'].includes(s.pending.action) || !['listen', 'fight', 'flee', 'leave'].includes(s.pending.choiceId) || s.pending.nodeId !== s.current || typeof s.pending.text !== 'string' || (s.pending.roll !== null && (!Number.isInteger(s.pending.roll) || s.pending.roll < 1 || s.pending.roll > 100)))) errors.push('legacyDungeon: invalid pending response');
  if (run.combatEntered && (run.combatEntered.nodeId !== s.parentNodeId || run.combatEntered.encounterId !== dungeonNode(run)?.encounter)) errors.push('legacyDungeon: combat does not match location');
  return errors;
}
