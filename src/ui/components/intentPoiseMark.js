import { tagSymbolSvg } from './cardTagSymbols.js';
import { t } from '../strings.js';

/**
 * The Poise beside an attack's number (owner, 2026-11-17): the gold Poise hammer and the Poise the player loses, small, inside the attack's own
 * action so the row still holds five actions; a move that breaks the player's Poise adds a BREAKS YOU tag (never the target quote's bare BREAK, which
 * is the enemy's Poise). The sentence is the intent's aria-label.
 */
export function IntentPoiseMark(poise) {
  const mark = document.createElement('span');
  mark.className = 'intent-poise';
  mark.dataset.breaks = String(!!poise.breaks);
  if (poise.mayBreak && !poise.breaks) mark.dataset.mayBreak = 'true';
  mark.setAttribute('aria-hidden', 'true');
  const value = document.createElement('span'); value.className = 'intent-poise-value'; value.textContent = String(poise.value);
  mark.append(value, tagSymbolSvg('effect:poise', 'intent-poise-icon'));
  if (poise.breaks || poise.mayBreak) {
    const flag = document.createElement('span'); flag.className = 'intent-poise-break';
    flag.textContent = poise.breaks ? t('combat.intent.poiseBreak') : `${t('combat.intent.poiseBreak')}?`;
    mark.append(flag);
  }
  return mark;
}
