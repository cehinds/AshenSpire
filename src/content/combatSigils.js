// Original monochrome marks. Identity comes from authored combat tags, never a card name or colour.
// Content may not import model/strings.js (tests/layering.test.mjs), so words come from uiStrings.
import { CARD_COMPONENTS } from './cardComponents.generated.js';
import { uiStrings } from './generated/uiStrings.js';

const SOLID_MARK = true;
const SHIELD_SHAPE =
  '<path d="M16 2 28 7v10c0 7-12 13-12 13S4 24 4 17V7Zm0 4v20c5-3 8-6 8-9V10Z"/>';
const TAG_SYMBOLS = CARD_COMPONENTS.template.symbols.tags;
const TECHNIQUE_ID = 'technique';
const SKILL_ID = 'skill';
const SPELL_ID = 'spell';
const TRADITION_STRING_PREFIX = 'card.tradition.';
const TECHNIQUE_MARK_TEXT = Object.freeze(
  {
    label: 'Technique',
    help: 'A basic technique.',
  },
);

function uiRow(id)
{
  const row = uiStrings.find(entry => entry.id === id);
  if (!row?.short || !row.full)
  {
    throw new Error(`combatSigils: uiStrings row ${id} needs short and full text`);
  }
  return row;
}

function uiShortText(id)
{
  return uiRow(id).short;
}

function uiFullText(id)
{
  return uiRow(id).full;
}

function mark(label, shape, help, solid = false)
{
  return Object.freeze(
    {
      label,
      shape,
      help,
      solid,
    },
  );
}

export const ACTION_SIGILS = Object.freeze(
{
  attack: mark(
    'Attack',
    '<path d="m3 2 7 3 15 18-3 3L6 10Zm26 0-7 3L7 23l3 3L26 10ZM3 22l7 7 2-2-7-7Zm19 5 2 2 7-7-2-2ZM2 29l2 2 4-4-2-2Zm22-2 4 4 2-2-4-4Z"/>',
    'A direct attack.',
    SOLID_MARK,
  ),
  defense: mark(
    'Defense',
    SHIELD_SHAPE,
    'Defensive stance: grant protection.',
    SOLID_MARK,
  ),
  stance: mark(
    'Stance',
    '<path d="M5 28 16 3l11 25M10 18h12"/>',
    'A combat stance: Attack, Smash, Sweep, Counter, Defend or Prepared.',
  ),
  consumable: mark(
    'Consumable',
    '<path d="M11 3h10v7l5 8v11H6V18l5-8ZM11 20h10"/>',
    'A consumable item card.',
  ),
  defend: mark(
    'Defend',
    SHIELD_SHAPE,
    'Guard or other defensive support.',
    SOLID_MARK,
  ),
  evade: mark(
    'Evade',
    TAG_SYMBOLS.evade.svg.body,
    'Evade: a defensive tag and status, not a stance.',
    SOLID_MARK,
  ),
  counter: mark(
    'Counter',
    '<path d="M15 2 26 6v3L7 28c-3-3-4-6-4-11V7Zm11 14v2c0 6-11 12-11 12l-4-2ZM28 2l2 1-1 6L12 26l-3-3ZM6 21l7 7-2 2-7-7ZM2 29l2 2 4-4-2-2Z"/>',
    'Prepare a reply to a qualifying incoming action. Inspect for its conditions.',
    SOLID_MARK,
  ),
  sweep: mark(
    'Sweep',
    '<path d="M4 23q12-24 24 0M4 23h24M24 18l4 5-4 5"/>',
    'An attack across several targets.',
  ),
  ranged: mark(
    'Ranged',
    '<path d="m30 2-5 14-4-5L10 22v6l-5 3v-6H0l4-6h6L20 9l-5-3Z"/>',
    'An attack made at range.',
    SOLID_MARK,
  ),
  // Smash wears the hammer the blunt, heavy and Poise marks use.
  smash: mark(
    'Smash',
    '<path d="M5 2h22v12H5Zm8 14h6v15h-6Z"/>',
    'A heavy, forceful attack.',
    SOLID_MARK,
  ),
  spell: mark(
    'Spell',
    '<path d="m16 2 5 9 9 5-9 5-5 9-5-9-9-5 9-5Zm0 9-5 5 5 5 5-5Z"/>',
    'A spell. Information identifies its school.',
    SOLID_MARK,
  ),
  power: mark(
    'Power',
    '<path d="M13 28V13H8L16 3l8 10h-5v15ZM4 16v6m-3-3h6m19 1v8m-4-4h8"/>',
    'Cast once; its buff lasts for this combat. The paid card leaves play.',
  ),
  skill: mark(
    'Skill',
    '<path d="M5 17v-5l4-4 4 4v3l5-8 5 3-4 7h7v5l-9 6H9Z"/>',
    'Reusable utility or a buff. Inspect for its effects.',
  ),
  status: mark(
    'Status',
    '<path d="m16 3 13 25H3ZM16 11v7m0 5h.01"/>',
    'A status-effect card added to the deck, usually harmful.',
  ),
});
export const SCHOOL_SIGILS = Object.freeze(
{
  frost: mark(
    'Frost',
    '<path d="M16 3v26M5 9l22 14M5 23 27 9M12 5l4 4 4-4M12 27l4-4 4 4"/>',
    'Frost magic.',
  ),
  fire: mark(
    'Fire',
    '<path d="M17 3c3 8-5 10-1 15 3-1 5-5 5-8 9 10 7 19-5 19C3 29 2 17 10 11c-1 6 2 8 3 8-3-8 4-10 4-16Z"/>',
    'Fire magic.',
  ),
  lightning: mark(
    'Lightning',
    '<path d="M19 3 7 18h9l-3 11 13-16h-9Z"/>',
    'Lightning magic.',
  ),
  force: mark(
    'Force',
    '<circle cx="6" cy="16" r="3"/><path d="M12 9q8 7 0 14M18 5q12 11 0 22M24 3q12 13 0 26"/>',
    'Force magic.',
  ),
  alteration: mark(
    'Alteration',
    TAG_SYMBOLS.alteration.svg.body,
    'Alteration magic, including earth and grounding.',
    SOLID_MARK,
  ),
  earth: mark(
    'Earth',
    TAG_SYMBOLS.earth.svg.body,
    'Earth magic.',
    SOLID_MARK,
  ),
  illusion: mark(
    'Illusion',
    '<path d="M2 16Q16 1 30 16 16 31 2 16Z"/><circle cx="16" cy="16" r="5"/><path d="m6 28 20-24"/>',
    'Illusion magic.',
  ),
  divine: mark(
    'Divine',
    '<circle cx="16" cy="16" r="8"/><path d="M16 4v24M4 16h24M7 7l3 3m12 12 3 3M7 25l3-3M22 10l3-3"/>',
    'Divine magic.',
  ),
  decay: mark(
    'Decay',
    '<path d="M26 5C9 2 3 10 7 22c12 4 20-2 19-17ZM7 25l14-14M12 20l-1-7m6 2 6 1M4 28h.01M27 25h.01"/>',
    'Decay magic.',
  ),
});

// A tradition's word and sentence are uiStrings rows named after its id.
function traditionMark(traditionId, shape)
{
  const stringId = TRADITION_STRING_PREFIX + traditionId;
  return mark(
    uiShortText(stringId),
    shape,
    uiFullText(stringId),
    SOLID_MARK,
  );
}

// Tradition marks stay apart from action marks so spell costs and triggers keep the spell camp.
export const TRADITION_SIGILS = Object.freeze(
{
  arcane: traditionMark(
    'arcane',
    '<path d="M16 1 30 9v14L16 31 2 23V9Zm0 5L6 12v8l10 6 10-6v-8Zm0 3 7 12H9Zm0 5-3 5h6Z"/>',
  ),
  divine: traditionMark(
    'divine',
    '<path d="M14 1h4v6h-4Zm0 24h4v6h-4ZM1 14h6v4H1Zm24 0h6v4h-6ZM4 6l2-2 5 5-2 2Zm17 17 2-2 5 5-2 2ZM4 26l5-5 2 2-5 5ZM21 9l5-5 2 2-5 5ZM16 8a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',
  ),
});

// Technique has no mark of its own: it wears the Skill mark under its own word.
export function mirrorSigil(id)
{
  if (id !== TECHNIQUE_ID)
  {
    return { id, mark: ACTION_SIGILS[id] };
  }
  const techniqueMark = Object.freeze(
    {
      ...ACTION_SIGILS[SKILL_ID],
      ...TECHNIQUE_MARK_TEXT,
    },
  );
  return { id: SKILL_ID, mark: techniqueMark };
}

// A Spell that mirrors a basic card shows the Spell mark and its basic's mark.
function mirroredBasicId(action, mirrors)
{
  if (action !== SPELL_ID)
  {
    return null;
  }
  const mirrorsBasic = mirrors !== SPELL_ID && Object.hasOwn(ACTION_SIGILS, mirrors);
  return mirrors === TECHNIQUE_ID || mirrorsBasic
    ? mirrors
    : null;
}

export function cardSigilIdentity(primaryType, profile)
{
  const action = primaryType.toLowerCase();
  if (!Object.hasOwn(ACTION_SIGILS, action))
  {
    throw new Error(`Unknown primary card type: ${primaryType}`);
  }
  // The authored school keeps Earth and Alteration on distinct marks.
  const school = profile.school || null;
  if (school && !Object.hasOwn(SCHOOL_SIGILS, school))
  {
    throw new Error(`Unknown card school: ${school}`);
  }
  const mirror = mirroredBasicId(action, profile.mirrors);
  const mirrorField = mirror
    ? { mirror }
    : {};
  return Object.freeze(
    {
      action,
      school,
      ...mirrorField,
    },
  );
}
