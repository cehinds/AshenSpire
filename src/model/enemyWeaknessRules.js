// Enemy weaknesses (owner ask, 2026-10-31; SPEC section 5.3). Pure data rules, no engine state.
// An authored `weaknesses` array on every enemy: [{ to, effect, amount? }].
//   to     what the hit (or status) must be: a physical type, `magic`, an element, or a status.
//   effect damage  the hit deals (1 + amount/100) times as much (default 25)
//          stacks  +amount stacks when that status is applied to the enemy (default 1)
//          tick    that status's own tick or burst deals (1 + amount/100) times as much (default 50)
//          mana    the hit also costs the enemy `amount` MP (default 1)
//          stamina the hit also costs the enemy `amount` SP next turn (default 1)
//          stagger the hit may stagger the enemy, amount percent (default 25)
export const WEAKNESS_PHYSICAL = Object.freeze(['blunt', 'slashing', 'piercing']);
export const WEAKNESS_ELEMENTS = Object.freeze(['fire', 'frost', 'lightning', 'sacred', 'decay', 'arcane', 'earth', 'psychic', 'poison']);
export const WEAKNESS_STATUSES = Object.freeze(['burn', 'bleed', 'paralysis', 'frost', 'venom', 'vulnerable']);
// Statuses that deal damage of their own, so a `tick` weakness has something to scale.
export const WEAKNESS_TICK_STATUSES = Object.freeze(['burn', 'bleed', 'frost', 'venom']);
export const WEAKNESS_HIT_EFFECTS = Object.freeze(['damage', 'mana', 'stamina', 'stagger']);
export const WEAKNESS_STATUS_EFFECTS = Object.freeze(['stacks', 'tick']);
export const WEAKNESS_EFFECTS = Object.freeze([...WEAKNESS_HIT_EFFECTS, ...WEAKNESS_STATUS_EFFECTS]);
export const WEAKNESS_DEFAULT_AMOUNT = Object.freeze({ damage: 25, stacks: 1, tick: 50, mana: 1, stamina: 1, stagger: 25 });
export const WEAKNESS_HIT_TRIGGERS = Object.freeze([...WEAKNESS_PHYSICAL, 'magic', ...WEAKNESS_ELEMENTS]);

/** The amount a weakness carries: its authored amount, else the effect's default. */
export function weaknessAmount(weakness) {
  const authored = weakness?.amount;
  return Number.isFinite(authored) ? authored : WEAKNESS_DEFAULT_AMOUNT[weakness?.effect] ?? 0;
}

/** Problems with one enemy's authored weaknesses (empty when valid). Validation and tests share it. */
export function weaknessProblems(weaknesses) {
  if (!Array.isArray(weaknesses)) return ['weaknesses must be an array'];
  const problems = [], seen = new Set();
  if (weaknesses.length < 1 || weaknesses.length > 3) problems.push('an enemy has 1-3 weaknesses');
  weaknesses.forEach((row, index) => {
    const at = `weaknesses[${index}]`;
    if (!row || typeof row !== 'object') return problems.push(`${at} must be an object`);
    for (const key of Object.keys(row)) if (!['to', 'effect', 'amount'].includes(key)) problems.push(`${at}.${key} is not a weakness field`);
    if (!WEAKNESS_EFFECTS.includes(row.effect)) return problems.push(`${at}.effect '${row.effect}' is unknown`);
    const onStatus = WEAKNESS_STATUS_EFFECTS.includes(row.effect);
    if (onStatus && !WEAKNESS_STATUSES.includes(row.to)) problems.push(`${at}.to '${row.to}' must be a status for effect '${row.effect}'`);
    else if (!onStatus && !WEAKNESS_HIT_TRIGGERS.includes(row.to)) problems.push(`${at}.to '${row.to}' must be a damage type, element or 'magic' for effect '${row.effect}'`);
    if (row.effect === 'tick' && WEAKNESS_STATUSES.includes(row.to) && !WEAKNESS_TICK_STATUSES.includes(row.to)) problems.push(`${at}: '${row.to}' deals no damage of its own to tick`);
    if (row.amount !== undefined && (!Number.isFinite(row.amount) || row.amount <= 0)) problems.push(`${at}.amount must be a positive number`);
    if (row.effect === 'stagger' && row.amount > 100) problems.push(`${at}.amount is a percent chance, at most 100`);
    if ((row.effect === 'stacks' || row.effect === 'mana' || row.effect === 'stamina') && row.amount !== undefined && !Number.isInteger(row.amount)) problems.push(`${at}.amount must be a whole number`);
    const key = `${row.to}:${row.effect}`;
    if (seen.has(key)) problems.push(`${at} repeats '${key}'`);
    seen.add(key);
  });
  return problems;
}

const title = word => word.charAt(0).toUpperCase() + word.slice(1);
/** One weakness in words for the inspector and the bestiary: { label, text }. */
export function describeWeakness(weakness) {
  const amount = weaknessAmount(weakness), label = weakness.to === 'magic' ? 'Magic' : title(weakness.to);
  const text = {
    damage: `+${amount}% damage`,
    stacks: `+${amount} stack${amount === 1 ? '' : 's'} applied`,
    tick: 'ticks harder',
    mana: `loses ${amount} Mana`,
    stamina: `loses ${amount} Stamina`,
    stagger: 'may stagger',
  }[weakness.effect] || weakness.effect;
  return { label, text };
}
