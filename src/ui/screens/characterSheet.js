// src/ui/screens/characterSheet.js — the Character sheet: every character
// level and every skill track's ladder, each level saying what it grants.
//
// READ-ONLY. It claims nothing and picks nothing: levels are claimed at the
// Level up door and its picks made there (SPEC §13.4o). This page is the map
// of that road — where the player stands and what each level ahead pays.
//
// ON THE KIT: an xl W1 modal (openModal) with two head tabs, Character and
// Skills. Character is one Meter (levelProgress, the bar the Armoury shows)
// over the level ladder; Skills is a Rail of tracks beside the chosen track's
// Meter, its cadence line and its ladder. Every number is the model's
// (models/CharacterSheetModel.js); every word is a uiStrings row.

import { el, meter, openModal, pill, prose, rail, railItem, statusText, titleS } from '../kit/index.js';
import { markUiComponent, UI_COMPONENTS as UI } from '../components/uiComponents.js';
import { characterSheetModel, DEFAULT_LEVEL_OFFERS, EVERY_LEVEL_GRANTS } from '../models/CharacterSheetModel.js';
import { levelProgress, skillProgressRows } from '../../model/progression.js';
import { t } from '../strings.js';

const RARITY_WORDS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };

/** grantText(grant) → the words one grant record says. */
export function grantText(grant) {
  switch (grant.kind) {
    case 'points': return t('characterSheet.grant.points', { n: grant.amount });
    case 'stat': return t('characterSheet.grant.stat', { stat: t(`characterSheet.stat.${grant.stat}`), n: grant.amount });
    case 'deckMinimum': return t('characterSheet.grant.deckMinimum', { n: grant.amount });
    case 'featChoice': return t('characterSheet.grant.featChoice');
    case 'classNodeChoice': return t('characterSheet.grant.classNodeChoice');
    case 'featOrNodeChoice': return t('characterSheet.grant.featOrNodeChoice');
    case 'classFeat': return grant.pct >= 100 ? t('characterSheet.grant.featChoice') : t('characterSheet.grant.classFeatChance', { pct: grant.pct });
    case 'classCard': return grant.pct >= 100 ? t('characterSheet.grant.classCard') : t('characterSheet.grant.classCardChance', { pct: grant.pct });
    case 'levelCard': return t('characterSheet.grant.levelCard');
    case 'cardDraft': return t('characterSheet.grant.cardDraft', { rank: grant.rank });
    case 'classNodeDraft': return t('characterSheet.grant.classNodeDraft');
    case 'rarity': return t('characterSheet.grant.rarity', { rarity: RARITY_WORDS[grant.rarity] || grant.rarity });
    case 'rankUp': return t('characterSheet.grant.rankUp');
    case 'classTier': return t('characterSheet.grant.classTier', { tier: grant.tier, nodes: grant.nodes.join(', ') });
    case 'feat': return grant.options.length
      ? t('characterSheet.grant.feat', { options: grant.options.join(' / ') })
      : t('characterSheet.grant.featNone');
    case 'attribute': return t('characterSheet.grant.attribute', { options: grant.options.join(' / ') });
    case 'flat': return t('characterSheet.grant.flat', { total: grant.total });
    default: return grant.kind;
  }
}

// The grants every level of a ladder repeats: shown once in the cadence line,
// muted on each row, so a milestone's own reward is what the eye lands on.
const ROUTINE = new Set(['points', 'featChoice', 'classNodeChoice', 'featOrNodeChoice', ...EVERY_LEVEL_GRANTS]);

function ladderRow(row) {
  const grants = row.grants.length
    ? row.grants.map((g) => {
      const chip = pill({ label: grantText(g), on: ROUTINE.has(g.kind) ? null : true, attrs: { class: `cs-grant${ROUTINE.has(g.kind) ? ' routine' : ''}` } });
      chip.dataset.grant = g.kind; // the kit's pill owns `dataset` (data-on); the kind rides beside it
      return chip;
    })
    : [statusText(t('characterSheet.row.start'), { class: 'cs-start' })];
  return el('li', {
    class: `cs-row${row.milestone ? ' milestone' : ''}`,
    dataset: { state: row.state, level: String(row.level) },
    'aria-current': row.state === 'current' ? 'step' : null,
  }, [
    el('span', { class: 'cs-level', text: String(row.level) }),
    el('span', { class: 'cs-xp' }, row.level === 1 && row.stepXp === 0 ? [] : [
      el('span', { class: 'cs-step', text: t('characterSheet.row.step', { n: row.stepXp.toLocaleString('en-US') }) }),
      el('span', { class: 'cs-total', text: t('characterSheet.row.total', { n: row.totalXp.toLocaleString('en-US') }) }),
    ]),
    el('span', { class: 'cs-grants' }, grants),
    row.state === 'current' ? statusText(t('characterSheet.row.here'), { class: 'cs-here' }) : null,
  ]);
}

const ladder = (rows, label) => el('ol', { class: 'cs-ladder', 'aria-label': label }, rows.map(ladderRow));

function characterPane(registries, run, sheet) {
  const progress = levelProgress(registries, run);
  return el('div', { class: 'cs-pane', dataset: { pane: 'character' } }, [
    meter({ stack: true, tone: 'xp', label: progress.label, value: progress.value, pct: progress.pct,
      cur: progress.capped ? null : progress.xp, max: progress.capped ? null : progress.xpToNext, ariaLabel: progress.sense,
      attrs: { class: 'cs-meter' } }),
    prose(t('characterSheet.character.cadence', { max: sheet.character.maxLevel }), { class: 'cs-cadence' }),
    ladder(sheet.character.rows, t('characterSheet.tab.character')),
  ]);
}

// The track's cadence, read off its own ladder: a clause only for a reward
// some level of THIS track pays, at the first level that pays it, so armour
// never promises a rank-up and a track with no feats never promises one.
export function cadenceLine(registries, track) {
  const s = (registries.balance && registries.balance.skill) || {};
  const first = (kind) => { const row = track.rows.find((r) => r.grants.some((g) => g.kind === kind)); return row ? row.level : null; };
  const parts = [];
  if (track.kind === 'class') {
    parts.push(t('characterSheet.cadence.classPick'));
    const feat = track.rows[0] && track.rows[0].grants.find((g) => g.kind === 'classFeat');
    if (feat) parts.push(feat.pct >= 100 ? t('characterSheet.cadence.classFeat') : t('characterSheet.cadence.classFeatChance', { pct: feat.pct }));
    const card = track.rows[0] && track.rows[0].grants.find((g) => g.kind === 'classCard');
    if (card) parts.push(t('characterSheet.cadence.classCardChance', { pct: card.pct }));
    if (first('classTier') != null) parts.push(t('characterSheet.cadence.classTier'));
    return parts.join(' ');
  }
  parts.push(t('characterSheet.cadence.draft'));
  if (first('rankUp') != null) parts.push(t('characterSheet.cadence.rankUp', { from: first('rankUp') }));
  if (first('feat') != null) parts.push(t('characterSheet.cadence.feat', { n: s.featEvery }));
  if (first('attribute') != null) parts.push(t('characterSheet.cadence.attribute', { n: s.attributeEvery }));
  if (first('flat') != null) parts.push(t('characterSheet.cadence.flat', { n: s.flatEvery }));
  return parts.join(' ');
}

function trackPane(registries, run, track) {
  const progress = skillProgressRows(registries, run, { includeUntouched: true }).find((r) => r.id === track.id);
  return el('div', { class: 'cs-pane', dataset: { pane: 'track', track: track.id } }, [
    titleS(track.label, { class: 'cs-track-title' }),
    progress ? meter({ stack: true, tone: 'skill', label: `${t('characterSheet.skills.level', { n: progress.level, max: track.maxLevel })}`,
      value: progress.value, pct: progress.pct, cur: progress.capped ? null : progress.xp, max: progress.capped ? null : progress.xpToNext,
      ariaLabel: progress.sense, attrs: { class: 'cs-meter' } }) : null,
    prose(cadenceLine(registries, track), { class: 'cs-cadence' }),
    ladder(track.rows, track.label),
  ]);
}

const bodyHostOf = (state) => state.host || null;

function skillsPane(registries, run, sheet, state) {
  const selected = sheet.tracks.find((tr) => tr.id === state.track) || sheet.tracks[0];
  if (!selected) return el('div', { class: 'cs-pane' }, prose(t('characterSheet.skills.none')));
  state.track = selected.id;
  const items = sheet.tracks.map((tr) => {
    const item = railItem({ label: t('characterSheet.skills.railItem', { label: tr.label, n: tr.level, max: tr.maxLevel }),
      current: tr.id === selected.id, member: tr.id,
      className: `cs-rail-item${tr.touched ? ' touched' : ''}${tr.id === sheet.ownTrackId ? ' own' : ''}` });
    item.addEventListener('click', () => {
      state.show('skills', tr.id);
      // The redraw replaced the rail: keep the keyboard on the item just chosen.
      bodyHostOf(state)?.querySelector('.cs-rail .as-railitem.on')?.focus({ preventScroll: true });
    });
    return item;
  });
  return el('div', { class: 'cs-skills' }, [
    rail(items, { class: 'cs-rail', 'aria-label': t('characterSheet.tab.skills') }),
    trackPane(registries, run, selected),
  ]);
}

/**
 * openCharacterSheet({ registries, run, offers, tab, track, opener, onClose })
 * → the modal shell. `offers` names which character-level rewards the
 * player's settings switch on (CharacterSheetModel DEFAULT_LEVEL_OFFERS).
 */
export function openCharacterSheet({ registries, run, offers = DEFAULT_LEVEL_OFFERS, tab = 'character', track = '', opener, onClose = null } = {}) {
  const sheet = characterSheetModel(registries, run, { offers });
  let bodyHost = null;
  const state = { tab, track, show: null };
  const render = () => {
    if (!bodyHost) return;
    bodyHost.replaceChildren(state.tab === 'skills' ? skillsPane(registries, run, sheet, state) : characterPane(registries, run, sheet));
    bodyHost.dataset.tab = state.tab;
    // Open on where the player stands, not on level 1 — scrolling the ladder's
    // own pane only, never the page behind the modal.
    const here = bodyHost.querySelector('.cs-ladder .cs-row[data-state="current"]');
    const pane = here && here.closest('.cs-pane');
    if (pane) pane.scrollTop = Math.max(0, here.offsetTop - (pane.clientHeight - here.offsetHeight) / 2);
  };
  state.show = (nextTab, nextTrack = state.track) => { state.tab = nextTab; state.track = nextTrack; render(); };
  const shell = openModal({
    size: 'xl',
    className: 'character-sheet',
    tabs: [
      { id: 'character', label: t('characterSheet.tab.character'), selected: tab !== 'skills' },
      { id: 'skills', label: t('characterSheet.tab.skills'), selected: tab === 'skills' },
    ],
    onTab: (id) => state.show(id),
    showMenuButton: false, // a read-only page has no menu to offer
    closeLabel: t('characterSheet.close'),
    body: (host) => { bodyHost = host; state.host = host; },
    bodyClassName: 'character-sheet-body',
    ...(opener ? { opener } : {}),
    onClose,
  });
  markUiComponent(shell.panel, UI.characterSheet);
  render();
  return shell;
}
