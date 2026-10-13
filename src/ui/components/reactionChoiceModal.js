import { openModal, button, el } from '../kit/index.js';
import { t, tFull } from '../strings.js';

// `stack` is the already-committed entries of this root, top first, each
// { name }. Empty or absent is the version 1 modal, unchanged; with entries,
// the list shows above the options and Back reads Resolve (it still answers null).
// The committed entries of one root's stack, top first. The engine pushes onto
// the end and resolves the last pushed first, so the top is the last entry.
export function committedReactionStack(reactionStack, groupKey) {
  if (!reactionStack || reactionStack.groupKey !== groupKey) return [];
  return [...(reactionStack.entries || [])].reverse();
}

// What one stack entry is called in the list: the card for a player entry, or for an
// enemy entry (docs/combat-card-traits-contract.md, "Enemy reactions") the enemy and its
// reaction move, e.g. "Gilded Knight: Gilded Guard".
const words = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
export function reactionStackEntryName(entry, registries) {
  if (entry?.side === 'enemy') {
    const enemy = registries?.enemies?.get(entry.enemyId);
    const move = enemy?.moves?.[entry.moveId]?.name || words(entry.moveId);
    return enemy?.name ? `${enemy.name}: ${move}` : move;
  }
  return registries?.cards?.get(entry?.cardId)?.name || entry?.cardId || '';
}

// The card instances a seat already stacked (enemy entries hold no card). With ownerId, only
// that seat's: instance ids are unique per seat only (co-op runs each start at rc1).
export const stackedCardIds = (reactionStack, ownerId = null) => new Set((reactionStack?.entries || [])
  .filter(entry => entry.side !== 'enemy' && (ownerId == null || entry.ownerId === ownerId)).map(entry => entry.cardInstanceId));

export function openReactionChoiceModal({ pending, onAnswer, onClosed, stack = [] }) {
  const stacked = Array.isArray(stack) && stack.length > 0;
  let selected = null;
  let settled = false;
  let dismissed = false;
  const play = button({ label: t('combat.reaction.play'), weight: 'primary', disabled: true });
  const decline = button({ label: t(stacked ? 'combat.reaction.resolve' : 'common.back'), role: 'exit' });
  const shell = openModal({
    title: t('combat.reaction.title'), eyebrow: t('combat.reaction.eyebrow'), size: 'md',
    className: 'reaction-choice', closeLabel: t('common.back'), secondary: [decline], primary: play,
    body(host) {
      host.append(el('p', { text: tFull(stacked ? 'combat.reaction.helpStack' : 'combat.reaction.help') }));
      if (stacked) {
        host.append(el('p', { className: 'reaction-stack-label', text: t('combat.reaction.stack') }));
        const list = el('ol', { className: 'reaction-stack', 'data-reaction-stack': String(stack.length) });
        for (const entry of stack) list.append(el('li', { text: String(entry.name), 'data-reaction-stack-entry': '' }));
        host.append(list);
      }
      for (const option of pending.options) {
        const tier = option.play.upcastTier;
        const pick = button({ label: `${option.name}${tier ? ` · ${t('combat.reaction.upcast', { tier })}` : ''}${option.choiceName ? ` · ${option.choiceName}` : ''} · ${t('combat.reaction.sp', { amount: option.staminaCost })}${option.manaCost ? ` · ${t('combat.reaction.mp', { amount: option.manaCost })}` : ''}`,
          attrs: { 'data-reaction-option': option.id, 'aria-pressed': 'false' } });
        pick.addEventListener('click', () => {
          selected = option.id;
          host.querySelectorAll('[data-reaction-option]').forEach(node => node.setAttribute('aria-pressed', String(node === pick)));
          play.disabled = false;
        });
        host.append(pick);
      }
    },
    onClose() { onClosed?.(); if (!dismissed) onAnswer({ offerId: pending.id, optionId: settled ? selected : null }); },
  });
  play.addEventListener('click', () => { if (!selected) return; settled = true; shell.close(); });
  decline.addEventListener('click', () => shell.close());
  shell.body.querySelector('[data-reaction-option]')?.focus({ preventScroll: true });
  return { ...shell, dismiss() { dismissed = true; shell.close(); } };
}
