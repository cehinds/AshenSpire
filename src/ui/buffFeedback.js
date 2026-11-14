import { t, has } from './strings.js';

// Presentation classification, like fx.js STATUS_WORDS for hostile statuses.
// Names, tints and mechanics remain the recipient's registry definition. Keep
// bookkeeping markers (stanceShifted) and harmful/meter statuses out of gains.
export const BUFF_STATUS_IDS = Object.freeze([
  'precision', 'evade', 'strength', 'dexterity', 'regen',
  'bleedResist', 'frostResist', 'insanityResist',
  'rallyingStandard', 'rallyingStandardUp', 'unbreakable', 'unbreakableUp',
  'goreblood', 'sanguinePact', 'starstoneCharge', 'stargazer', 'astralArmor',
  'constellation', 'azureCoil', 'waxingMoon', 'moonlitShield', 'astromancer',
  'thornHalo', 'communion', 'lifeTithe', 'stigmata', 'zealotry', 'emberTide',
  'harbingerOfBlight', 'bloodUnction', 'ironVow', 'bulwarkEcho', 'prepared',
  'afterimage', 'deadlyTempo', 'opportunist', 'envenom',
  'stoneskin', 'grounded', 'invulnerability', 'decoy', 'concealed',
]);
// Statuses that already earn their own word (fx.js STATUS_WORDS: "ASLEEP", "VULNERABLE"). tests/buff-feedback.test.mjs holds the two lists equal.
export const WordedStatusIds = Object.freeze(['venom', 'burn', 'bleed', 'bleeding', 'frost', 'frozen', 'chilled', 'paralysis', 'sleep', 'weak',
  'vulnerable', 'magicVulnerable', 'frail', 'dazed', 'offBalance', 'prone', 'insanity', 'madness', 'crimsonBlight', 'frostExposed', 'insanityExposed']);
const worded = new Set(WordedStatusIds);
// Bookkeeping markers and pools that are announced by their own receipts (Stagger's word, Block and Barrier floaters): never a "+N" word.
const SILENT_STATUS_IDS = new Set(['stanceShifted', 'staggered', 'ward', 'barrier', 'base.persistent-block', 'base.persistent-barrier']);

export function buffGainFor(event = {}) {
  // Owner, 2026-11-14: "enemy buffs and status effects need to be shown": every status a fighter gains, that has no word of its own, reads
  // "+N Name" over it (SPEC 17), the listed buffs and the rest (Silenced, Confused, a Poison the player applied) alike.
  if (event.type !== 'statusApplied' || typeof event.status !== 'string' || worded.has(event.status) || SILENT_STATUS_IDS.has(event.status)
    || event.targetId == null || !(event.stacks > 0)) return 0;
  // Requested stacks are not a gain for refresh/unique/capped applications.
  if (!Number.isFinite(event.previousTotal) || !Number.isFinite(event.total)) return 0;
  return Math.max(0, event.total - event.previousTotal);
}

/** One word for a gained status ("Strengthened"), with a count only from 2 ("Strengthened ×2"); a status with no word reads its name. */
function statusGainWord(statusId, name, amount) {
  const key = `combat.status.applied.${statusId}`;
  const word = has(key) ? t(key) : name;
  return amount >= 2 ? `${word} ×${amount}` : word;
}

export function buffPopupFor(event, definition) {
  const amount = buffGainFor(event);
  if (!amount || !definition?.name || definition.meter || definition.proc) return null;
  return { kind: `buff:${event.status}`, targetId: event.targetId,
    word: statusGainWord(event.status, definition.name, amount), tone: 'gold', colour: definition.tint };
}
