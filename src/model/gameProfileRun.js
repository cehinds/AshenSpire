// Profile-selected run policies. Legacy profiles never enter these branches.
import { gameModule, gameContent } from './gameProfile.js';

export const isConfiguredRun = (subject) => gameModule(subject, 'class-selection')?.mode === 'configured';
export const gameProfileAttributes = (subject, classId) => gameContent(subject, 'classAttributes')?.[classId];

export function gameProfileClassAvailable(subject, meta = {}, classId) {
  const rules = gameContent(subject, 'classUnlocks');
  if (!isConfiguredRun(subject) || !rules) return true;
  const state = meta.gameProfileUnlocks?.[unlockKey(subject)];
  return [...rules.initial, ...rules.sequence.slice(0, state?.completedRunIds?.length || 0)].includes(classId);
}
const unlockKey = (subject) => (subject.gameProfile || subject).id;

export function gameProfileCompletedRunMeta(subject, meta, result) {
  const rules = gameContent(subject, 'classUnlocks');
  if (!isConfiguredRun(subject) || !rules) return { meta, unlocked: [] };
  if (!result.finishId) throw new Error('Configured completion requires a durable finishId');
  const key = unlockKey(subject);
  const next = structuredClone(meta);
  next.gameProfileUnlocks ||= {};
  const ledger = next.gameProfileUnlocks[key] ||= { completedRunIds: [] };
  if (ledger.completedRunIds.includes(result.finishId)) return { meta, unlocked: [] };
  const outcome = result.victory ? 'victory' : 'defeat';
  if (!rules.qualifyingOutcomes.includes(outcome)) return { meta, unlocked: [] };
  const count = ledger.completedRunIds.length;
  ledger.completedRunIds.push(result.finishId);
  return { meta: next, unlocked: rules.sequence[count] ? [rules.sequence[count]] : [] };
}

export function gameProfileStarterDeck(subject, classId) {
  const deck = gameContent(subject, 'starterDeck');
  if (gameModule(subject, 'cards')?.mode !== 'configured' || !deck) return null;
  const ids = deck.shared.flatMap(row => Array(row.copies).fill(row.card));
  const special = deck.classSpecials[classId];
  if (!special) throw new Error(`starterDeck.classSpecials.${classId}: missing card`);
  return [...ids, ...Array(deck.classSpecificCopies).fill(special)];
}

// Replace primary weights, retaining secondary terms and authored bounds/bases.
export function gameProfileStatOptions(subject, options = {}) {
  if (gameModule(subject, 'stats')?.mode !== 'configured') return options;
  const stats = gameContent(subject, 'stats');
  const rows = {};
  const aliases = { mp: 'mana', sp: 'stamina' };
  for (const [attribute, benefits] of Object.entries(stats.levelGains)) {
    for (const [name, amount] of Object.entries(benefits)) rows[aliases[name] || name] = {
      ...(rows[aliases[name] || name] || {}), [attribute]: amount,
    };
  }
  for (const id of ['openingHand', 'draw']) rows[id] = {
    ...(rows[id] || {}), base: stats.handBase, intelligence: 1, attributeBaseline: 0,
    byClass: {},
  };
  return { ...options, explicitOverride: {
    ...(options.explicitOverride || {}), rules: {
      ...(options.explicitOverride?.rules || {}), ...rows,
    },
  } };
}

export function initializeGameProfileRun(registries, run, { profileMeta = {} } = {}) {
  const ids = gameProfileStarterDeck(run, run.class);
  if (!ids) {
    const profile = run.gameProfile;
    if (profile && profile.foundation.mode !== 'legacy' && !gameModule(run, 'cards')) {
      run.deck = []; run.sideboard = []; run.equipmentAttackSlotCount = 0;
    }
    return;
  }
  for (const id of ids) if (!registries.cards.has(id)) throw new Error(`starterDeck: unknown card '${id}'`);
  run.deck = ids.map((cardId, i) => ({ instanceId: `gp${i + 1}`, cardId, upgraded: false }));
  run.sideboard = [];
  run.equipmentAttackSlotCount = 0;
  run.feats = [];
  run.skills = {};
  run.coreTags = [];
}
