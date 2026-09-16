// Presentation of an engine receipt; never reroll or recalculate the outcome.
export function dodgeReceipt(event) {
  if (!event || event.type !== 'dodgeRolled') return null;
  const outcome = event.success ? 'Dodge succeeded' : 'Dodge failed';
  const guard = event.success ? event.temporaryGuard : 0;
  return {
    outcome,
    detail: outcome + '. Roll ' + event.roll + '; check ' + event.check + ' against difficulty ' + event.difficulty + ' (must exceed). ' + guard + ' base guard from this roll, before modifiers and limits. The Block gain shown in combat is the amount actually applied. Block absorbs attack damage and normally clears at the start of your next turn, unless an effect retains it. A successful roll does not guarantee avoiding an attack.',
  };
}
