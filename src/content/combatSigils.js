// Original monochrome marks. Identity comes from authored combat tags, never
// a card name, damage element, class colour, or inferred effect.
const mark = (label, shape, help, solid = false) => Object.freeze({ label, shape, help, solid });
export const ACTION_SIGILS = Object.freeze({
  attack: mark('Attack', '<path d="m3 2 7 3 15 18-3 3L6 10Zm26 0-7 3L7 23l3 3L26 10ZM3 22l7 7 2-2-7-7Zm19 5 2 2 7-7-2-2ZM2 29l2 2 4-4-2-2Zm22-2 4 4 2-2-4-4Z"/>', 'A direct attack.', true),
  defend: mark('Defend', '<path d="M16 2 28 7v10c0 7-12 13-12 13S4 24 4 17V7Zm0 4v20c5-3 8-6 8-9V10Z"/>', 'Guard or other defensive support.', true),
  counter: mark('Counter', '<path d="M15 2 26 6v3L7 28c-3-3-4-6-4-11V7Zm11 14v2c0 6-11 12-11 12l-4-2ZM28 2l2 1-1 6L12 26l-3-3ZM6 21l7 7-2 2-7-7ZM2 29l2 2 4-4-2-2Z"/>', 'Prepare a reply to a qualifying incoming action. Inspect for its conditions.', true),
  sweep: mark('Sweep', '<path d="M4 23q12-24 24 0M4 23h24M24 18l4 5-4 5"/>', 'An attack across several targets.'),
  ranged: mark('Ranged', '<path d="m30 2-5 14-4-5L10 22v6l-5 3v-6H0l4-6h6L20 9l-5-3Z"/>', 'An attack made at range.', true),
  smash: mark('Smash', '<path d="M3 9q0-4 4-4h3q1-3 4-3h3q3 0 4 3h3q4 0 4 4v5l3 2v6l-7 6v4H10v-5l-7-7Zm6-1v8h2V8Zm7-3v11h2V5Zm7 3v8h2V8ZM8 19v3h11l6-5-2-2-5 4Z"/>', 'A heavy, forceful attack.', true),
  spell: mark('Spell', '<path d="M18 1c4 9-5 11-1 16 4-2 6-6 6-10 12 14 9 24-7 24C1 31-2 19 9 10c-1 6 1 9 4 9-4-9 3-13 5-18ZM16 21c-7 7-3 9 0 9s8-4 0-9Z"/>', 'A spell. Information identifies its school.', true),
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
