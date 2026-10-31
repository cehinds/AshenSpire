import { intentIcon } from './intentIcon.js';

// The remaining queued actions after an actor has acted (IntentFollowUpModel.js): "?" for each one the observer
// did not read, the maneuver icon for each one they did. Only the symbols reach the DOM, never a move.
export function intentFollowUps(symbols = []) {
  const row = document.createElement('span');
  row.className = 'intent-followups';
  row.dataset.count = String(symbols.length);
  for (const symbol of symbols) {
    const item = document.createElement('span');
    item.className = 'intent-followup';
    if (symbol.kind === 'action') item.append(intentIcon(symbol.icon));
    else { item.dataset.unknown = 'true'; item.textContent = '?'; }
    row.append(item);
  }
  return row;
}
