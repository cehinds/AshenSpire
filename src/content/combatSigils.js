// Original monochrome marks. Identity comes from authored combat tags, never
// a card name, damage element, class colour, or inferred effect.
const mark = (label, shape, help) => Object.freeze({ label, shape, help });
export const ACTION_SIGILS = Object.freeze({
  attack: mark('Attack', '<path d="m6 3 17 20-3 3L3 6Zm20 0L9 23l3 3L29 6ZM5 20l7 7m8-7 7 7M3 29l5-5m16 0 5 5"/>', 'A direct attack.'),
  defend: mark('Defend', '<path d="M16 4 26 8v9c0 6-10 11-10 11S6 23 6 17V8Z"/>', 'Guard or other defensive support.'),
  counter: mark('Counter', '<path d="M16 3 28 7v10c0 7-12 13-12 13S4 24 4 17V7Z"/><path d="M21 13a6 6 0 1 0 1 7M21 8v5h-5"/>', 'Prepare a reply to a qualifying incoming action. Inspect for its conditions.'),
  sweep: mark('Sweep', '<path d="M4 23q12-24 24 0M4 23h24M24 18l4 5-4 5"/>', 'An attack across several targets.'),
  ranged: mark('Ranged', '<path d="M8 4q16 12 0 24M8 4v24M3 16h24m-6-5 6 5-6 5"/>', 'An attack made at range.'),
  smash: mark('Smash', '<path d="m9 5 15 4-2 8-15-4ZM15 15l-4 13M23 22l4 5M5 20l-3 4"/>', 'A heavy, forceful attack.'),
  spell: mark('Spell', '<path d="m6 29 15-19"/><circle cx="22" cy="8" r="6"/><path d="m22 3 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z"/>', 'A spell. Information identifies its school.'),
  power: mark('Power', '<path d="M13 28V13H8L16 3l8 10h-5v15ZM4 16v6m-3-3h6m19 1v8m-4-4h8"/>', 'Cast once; its buff lasts for this combat. The paid card leaves play.'),
  skill: mark('Skill', '<path d="M5 17v-5l4-4 4 4v3l5-8 5 3-4 7h7v5l-9 6H9Z"/>', 'Reusable utility or a buff. Inspect for its effects.'),
  status: mark('Status', '<path d="m16 3 13 25H3ZM16 11v7m0 5h.01"/>', 'A status-effect card added to the deck, usually harmful.'),
});
export const SCHOOL_SIGILS = Object.freeze({
  frost: mark('Frost', '<path d="M16 3v26M5 9l22 14M5 23 27 9M12 5l4 4 4-4M12 27l4-4 4 4"/>', 'Frost magic.'),
  fire: mark('Fire', '<path d="M17 3c3 8-5 10-1 15 3-1 5-5 5-8 9 10 7 19-5 19C3 29 2 17 10 11c-1 6 2 8 3 8-3-8 4-10 4-16Z"/>', 'Fire magic.'),
  lightning: mark('Lightning', '<path d="M19 3 7 18h9l-3 11 13-16h-9Z"/>', 'Lightning magic.'),
  force: mark('Force', '<circle cx="6" cy="16" r="3"/><path d="M12 9q8 7 0 14M18 5q12 11 0 22M24 3q12 13 0 26"/>', 'Force magic.'),
  alteration: mark('Alteration', '<path d="m4 21 8-13 6 9 4-6 6 10ZM3 26h26M12 21v5m10-5v5"/>', 'Alteration magic, including earth and grounding.'),
  illusion: mark('Illusion', '<path d="M2 16Q16 1 30 16 16 31 2 16Z"/><circle cx="16" cy="16" r="5"/><path d="m6 28 20-24"/>', 'Illusion magic.'),
  divine: mark('Divine', '<circle cx="16" cy="16" r="8"/><path d="M16 4v24M4 16h24M7 7l3 3m12 12 3 3M7 25l3-3M22 10l3-3"/>', 'Divine magic.'),
  decay: mark('Decay', '<path d="M26 5C9 2 3 10 7 22c12 4 20-2 19-17ZM7 25l14-14M12 20l-1-7m6 2 6 1M4 28h.01M27 25h.01"/>', 'Decay magic.'),
});

export function cardSigilIdentity(primaryType, profile) {
  const action = primaryType.toLowerCase();
  if (!Object.hasOwn(ACTION_SIGILS, action)) throw new Error(`Unknown primary card type: ${primaryType}`);
  const school = profile.school || null;
  if (school && !Object.hasOwn(SCHOOL_SIGILS, school)) throw new Error(`Unknown card school: ${school}`);
  return Object.freeze({ action, school });
}
