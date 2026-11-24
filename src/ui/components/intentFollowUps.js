import { intentIcon } from './intentIcon.js';
import { IntentPoiseMark } from './intentPoiseMark.js';

// The remaining queued actions after an actor has acted (IntentFollowUpModel.js): "?" for each one the observer
// did not read, the maneuver icon for each one they did. Only the symbols reach the DOM, never a move.
export function intentFollowUps(symbols = []) {
  const row = document.createElement('span');
  row.className = 'intent-followups';
  row.dataset.count = String(symbols.length);
  for (const symbol of symbols) {
    const item = document.createElement('span');
    item.className = 'intent-followup';
    if (symbol.kind === 'action') {
      // A follow-up of the head's own stance carries the HP its action costs (owner, 2026-11-14), beside its icon as the head's number is.
      if (symbol.value != null) {
        item.dataset.hasValue = 'true';
        const value = document.createElement('strong'); value.className = 'intent-followup-value'; value.textContent = String(symbol.value);
        item.append(value);
      }
      item.append(intentIcon(symbol.icon));
      // ...and BREAKS YOU when it is the move that breaks the player's Poise (owner, 2026-11-17); its Poise number is in the aria-label and tooltip.
      const poise = symbol.poise && IntentPoiseMark(symbol.poise, { tagOnly: true });
      if (poise) item.append(poise);
    }
    else { item.dataset.unknown = 'true'; item.textContent = '?'; }
    row.append(item);
  }
  return row;
}
