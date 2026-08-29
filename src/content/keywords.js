// src/content/keywords.js — keyword display names + tooltips (SPEC §3.7 note)
//
// Semantics for these ids are engine primitives (card-zone/turn rules that
// cannot be data); this registry supplies only what tooltips show.

export const keywords = [
  { id: 'exhaust', name: 'Exhaust', tooltip: 'Removed from your deck for the rest of this combat after being played.' },
  { id: 'ethereal', name: 'Ethereal', tooltip: 'If this card is in your hand at the end of your turn, it Exhausts.' },
  { id: 'innate', name: 'Innate', tooltip: 'Starts each combat on top of your draw pile.' },
  { id: 'retain', name: 'Retain', tooltip: 'Not discarded at the end of your turn.' },
  { id: 'unplayable', name: 'Unplayable', tooltip: 'This card cannot be played.' },
];
