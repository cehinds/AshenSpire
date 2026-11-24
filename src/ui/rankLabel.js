// The rank a card reads in a picker, a shelf or a status line (owner, 2026-11-23): "Rank N" for a ranked card, else the
// deck editor's own name for an unranked one, Basic, or Cantrip for a spell. Presentation only.
import { t } from './strings.js';
import { combatProfileFor } from '../model/combatCardProfile.js';

/** RankLabel(def, rank) -> 'Rank N' when rank > 0, else 'Cantrip' for a spell or 'Basic'. */
export function RankLabel(def, rank) {
  if (rank > 0) return t('deckEditor.rank', { rank });
  return t(combatProfileFor(def || {}).camp === 'spell' ? 'deckEditor.rank.cantrip' : 'deckEditor.rank.basic');
}
