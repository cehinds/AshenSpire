// The card pick of the "rank up a card" service (W25-R): a combat reward, a shop shelf or any other door that offers it
// opens this. Option rows of the cards that can rise (the design of the upgrade picker, owner 2026-11-14): art, name,
// "Rank N to N+1", the slots it will have, a Cancel exit and one primary that stays disabled until a row is selected.
// `onChoose(instanceId)` runs once, after the dialog closes; Cancel changes nothing.
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { optionRowList, markOptionRows } from './optionRowList.js';
import { playingCardArt } from '../cardArtwork.js';
import { UpgradeSlots } from '../../model/cardUpgradeLimits.js';
import { InstanceRank, RankUpCandidates } from '../../model/rankUpService.js';

/** RankUpCardRows(registries, run) -> one row per card that can rise: { id, name, text, chip, artAsset, artGlyph }. */
export function RankUpCardRows(registries, run) {
  return RankUpCandidates(registries, run).map((card) => {
    const definition = registries.cards.get(card.cardId);
    const rank = InstanceRank(card);
    const after = { ...card, rank: rank + 1 };
    let art = null;
    try { art = playingCardArt({ cardId: card.cardId }, { definition, registries })?.path || null; } catch { art = null; }
    return {
      id: card.instanceId, className: 'rank-up-option', name: definition?.name || card.cardId, line: [], costs: [],
      text: t('blacksmith.rankUp.desc', { from: rank, to: rank + 1 }),
      chip: t('rankUp.pick.slots', { slots: UpgradeSlots(run, after) }),
      artAsset: art, artGlyph: art ? null : 'attack',
    };
  });
}

/** OpenRankUpCardModal({ registries, run, price, opener, onChoose, onClosed }) -> the modal shell. */
export function OpenRankUpCardModal({ registries, run, price = '', opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  let selected = null;
  let bodyHost = null;
  const rows = RankUpCardRows(registries, run);
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const commit = button({ label: t('rankUp.pick.confirm'), weight: 'primary', disabled: true, attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md',
    className: 'option-choice rank-up-pick',
    opener,
    eyebrow: t('rankUp.pick.eyebrow'),
    title: t('rankUp.pick.title'),
    closeLabel: t('common.cancel'),
    bodyClassName: 'as-pane card-choice-body',
    deferFocus: true,
    initialFocus: () => [...(bodyHost?.querySelectorAll('[data-rank-up-card]') || [])].find((row) => !row.disabled) || null,
    body: (host) => {
      bodyHost = host;
      if (price) host.append(Object.assign(document.createElement('p'), { className: 'smith-options-price', textContent: price }));
      if (!rows.length) { host.append(Object.assign(document.createElement('p'), { textContent: t('rankUp.pick.none') })); return; }
      const list = optionRowList(rows, { idAttr: 'data-rank-up-card', columns: 1, onSelect: (id, row) => {
        selected = id;
        row?.focus?.({ preventScroll: true });
        markOptionRows(list, 'data-rank-up-card', [id]);
        commit.disabled = false;
      } });
      host.appendChild(list);
    },
    primary: commit,
    secondary: [cancel],
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  commit.addEventListener('click', () => { if (selected == null) return; chosen = selected; shell.close(); });
  cancel.addEventListener('click', shell.close);
  return shell;
}
