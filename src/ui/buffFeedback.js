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
  'afterimage', 'deadlyTempo', 'opportunist', 'envenom', 'glassCannon',
  'stoneskin', 'grounded', 'invulnerability', 'decoy', 'concealed',
]);
const buffs = new Set(BUFF_STATUS_IDS);

export function buffGainFor(event = {}) {
  if (event.type !== 'statusApplied' || !buffs.has(event.status) || event.targetId == null || !(event.stacks > 0)) return 0;
  // Requested stacks are not a gain for refresh/unique/capped applications.
  if (!Number.isFinite(event.previousTotal) || !Number.isFinite(event.total)) return 0;
  return Math.max(0, event.total - event.previousTotal);
}

export function buffPopupFor(event, definition) {
  const amount = buffGainFor(event);
  if (!amount || !definition?.name || definition.meter || definition.proc) return null;
  return { kind: `buff:${event.status}`, targetId: event.targetId,
    word: `+${amount} ${definition.name}`, tone: 'gold', colour: definition.tint };
}
