// src/content/skillFeats.js — the feats a skill track's every-2nd level offers
// (SPEC §13.4o, "every 2nd level: a feat tied to the skill"). Each is taken
// once. Only the owner's own examples are authored here; the rest of the
// table is content phase C.
//
//   crit — Blade-tagged attacks may crit (owner, 2026-10-04): chance
//          base + Σ weight·attribute / divisor, capped; a crit multiplies the
//          hit. Chances from several sources add before the cap.
//   passive — a tag on the character that changes every card meeting its
//          tags (SPEC §13.4o "Passive tag effects"): `block` adds to the
//          card's first unconditional Block, shown on the card's face.
export const skillFeats = Object.freeze([
  {
    id: 'bladeCritical',
    skillId: 'item:blade',
    minLevel: 2,
    name: 'Critical Edge',
    description: 'Blade attacks can deal a critical hit for 1.5× damage: 5% + (0.1 × Dexterity + 0.2 × Wisdom + 0.1 × Intelligence)%, up to 50%.',
    crit: { tags: ['blade'], base: 0.05, weights: { dexterity: 0.1, wisdom: 0.2, intelligence: 0.1 }, divisor: 100, cap: 0.5, multiplier: 1.5 },
  },
  {
    id: 'shieldBraced',
    skillId: 'item:shield',
    minLevel: 2,
    name: 'Braced Shield',
    description: 'Every Shield card gains +3 Block, shown on the card.',
    passive: { tags: ['guard'], block: 3 },
  },
]);
