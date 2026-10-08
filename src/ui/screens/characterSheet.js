// Progression hub and read-only skill / feat inspection. Reward claims and
// attribute allocation use their existing game writers.

import { el, meter, openModal, pill, prose, statusText, titleS, button } from '../kit/index.js';
import { markUiComponent, UI_COMPONENTS as UI } from '../components/uiComponents.js';
import { characterSheetModel, characterSheetRegistries, DEFAULT_LEVEL_OFFERS, EVERY_LEVEL_GRANTS } from '../models/CharacterSheetModel.js';
import { levelProgress, skillProgressRows } from '../../model/progression.js';
import { attributesCard, characterStatsButton, progressionTip } from '../components/progressionCards.js';
import { skillInspection, ownedFeatInspections } from '../models/ProgressionInspectionModel.js';
import { renderCard } from '../components/card.js';
import { hideTooltip } from '../components/tooltip.js';
import { pendingLevelCount } from '../../model/levelup.js';
import { deferredProgressionCount, deferredOtherClassRewardCount } from '../../model/deferredProgression.js';
import { t } from '../strings.js';

const RARITY_WORDS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };

/** grantText(grant) → the words one grant record says. */
export function grantText(grant) {
  switch (grant.kind) {
    case 'points': return t('characterSheet.grant.points', { n: grant.amount });
    case 'stat': return t(`characterSheet.grant.stat.${grant.stat}`, { n: grant.amount });
    case 'deckMinimum': return t('characterSheet.grant.deckMinimum', { n: grant.amount });
    case 'featChoice': return t('characterSheet.grant.featChoice');
    case 'classNodeChoice': return t('characterSheet.grant.classNodeChoice');
    case 'featOrNodeChoice': return t('characterSheet.grant.featOrNodeChoice');
    case 'classFeat': return grant.pct >= 100 ? t('characterSheet.grant.featChoice') : t('characterSheet.grant.classFeatChance', { pct: grant.pct });
    case 'classCard': return grant.pct >= 100 ? t('characterSheet.grant.classCard') : t('characterSheet.grant.classCardChance', { pct: grant.pct });
    case 'levelCard': return t('characterSheet.grant.levelCard');
    case 'cardDraft': return t(grant.ability ? 'characterSheet.grant.abilityDraft' : 'characterSheet.grant.cardDraft', { rank: grant.rank, n: grant.choices });
    case 'classMilestone': return grant.rewardKind === 'attribute'
      ? t('characterSheet.grant.attribute', { options: grant.options.join(' / ') })
      : t('characterSheet.grant.classMilestone', { reward: t({ cards: 'characterSheet.grant.classCard', feat: 'characterSheet.grant.featNone', armory: 'armoury.title', relic: 'reward.kind.relic' }[grant.rewardKind]) });
    case 'skillXp': return t('characterSheet.grant.skillXp', { n: grant.amount, tracks: grant.tracks.join(' / ') });
    case 'masteryUnlock': return `Unlocks ${grant.names.join(', ')}`;
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

function characterPane(registries, run, sheet, state) {
  const progress = levelProgress(registries, run);
  const levelDetails = el('details', { class: 'progression-levels' }, [
    el('summary', { text: t('progression.levels') }), ladder(sheet.character.rows, t('progression.characterLevels')),
  ]);
  progressionTip(levelDetails.querySelector('summary'), 'Show every level and its rewards');
  const rewards = pendingLevelCount(registries, run) + deferredProgressionCount(run);
  const otherClassRewards = deferredOtherClassRewardCount(run);
  const claim = state.onRewards ? button({ label: rewards ? `Level rewards · ${rewards} waiting` : t('progression.rewards') }) : null;
  claim?.addEventListener('click', () => { state.close(); state.onRewards(); });
  if (claim) progressionTip(claim, 'Open your level and skill reward choices');
  return el('div', { class: 'cs-pane progression-character', dataset: { pane: 'character' } }, [
    meter({ stack: true, tone: 'xp', label: progress.label, value: progress.value, pct: progress.pct,
      cur: progress.capped ? null : progress.xp, max: progress.capped ? null : progress.xpToNext, ariaLabel: progress.sense,
      attrs: { class: 'cs-meter' } }),
    prose(t('characterSheet.character.cadence', { max: sheet.character.maxLevel }), { class: 'cs-cadence' }),
    attributesCard({ registries, run, settings: state.settings, onChange: state.onChange ? () => { state.onChange(); state.show('character'); state.host.querySelector('.progression-points')?.focus({ preventScroll: true }); } : null }),
    characterStatsButton({ registries, run, settings: state.settings }),
    featButtons(registries, run, ownedFeatInspections(registries, run)),
    levelDetails, claim,
    otherClassRewards ? prose(`${otherClassRewards} saved rewards await their original class. Equip that class to claim them.`) : null,
  ]);
}

function tagList(registries, tags) {
  return el('div', { class: 'progression-tags' }, tags.length ? tags.map(id => {
    const node = registries.nodes.find(node => node.id === id);
    const tag = pill({ label: node?.label || node?.name || id });
    tag.tabIndex = 0;
    progressionTip(tag, node?.description || node?.sense || id);
    return tag;
  }) : [statusText(t('progression.noTags'))]);
}

export function openFeatInspection({ registries, feat, opener }) {
  let shell;
  const back = button({ label: t('common.back') });
  back.addEventListener('click', () => shell.close());
  shell = openModal({ size: 'md', title: feat.name, eyebrow: t('progression.feat'), opener, showMenuButton: false,
    className: 'progression-inspection', secondary: [back], onClose: hideTooltip, body: el('div', { class: 'as-stack' }, [
      prose(feat.description), statusText(feat.owned ? t('progression.feat.acquired') + (feat.owned > 1 ? ` ×${feat.owned}` : '') : `Unlocks at skill level ${feat.minLevel || 1}`),
      titleS(t('progression.tags')), tagList(registries, feat.tags),
    ]) });
  return shell;
}

function featButtons(registries, run, feats) {
  return el('section', { class: 'progression-feats', 'aria-label': t('progression.feats') }, [
    el('div', { class: 'progression-feats-heading' }, [titleS(t('progression.feats')),
      el('span', { class: 'progression-feat-count', text: String(feats.length) })]),
    feats.length ? el('div', { class: 'progression-feat-list' }, feats.map(feat => {
      const status = feat.owned ? t('progression.feat.acquired') + (feat.owned > 1 ? ` ×${feat.owned}` : '')
        : t('progression.feat.unlock', { n: feat.minLevel || 1 });
      const node = el('button', { type: 'button', class: 'as-option progression-feat-card',
        'aria-haspopup': 'dialog', 'aria-label': t('deckEditor.inspectNamed', { name: feat.name }),
        dataset: { feat: feat.id, featOwned: String(!!feat.owned) } }, [
        el('span', { class: 'progression-feat-topline' }, [
          el('strong', { class: 'progression-feat-name', text: feat.name }),
          el('span', { class: 'progression-feat-state', text: status }),
        ]),
        el('span', { class: 'progression-feat-effect', text: feat.description }),
        el('span', { class: 'progression-feat-footer' }, [
          el('span', { class: 'progression-feat-tags' }, feat.tags.map(id => {
            const tag = registries.nodes.find(node => node.id === id);
            return el('span', { class: 'progression-feat-tag', text: tag?.label || tag?.name || id });
          })),
          el('span', { class: 'progression-feat-open', 'aria-hidden': 'true', text: '›' }),
        ]),
      ]);
      progressionTip(node, t('deckEditor.inspectNamed', { name: feat.name }));
      node.addEventListener('click', () => openFeatInspection({ registries, feat, opener: node }));
      return node;
    })) : el('div', { class: 'progression-feat-empty' }, [
      statusText(t('progression.noFeats')), prose(t('progression.feat.emptyHint')),
    ]),
  ]);
}

export function openSkillInspection({ registries, run, track, opener }) {
  registries = characterSheetRegistries(registries, run);
  const model = skillInspection(registries, run, track);
  const cards = el('div', { class: 'progression-associated-cards' }, model.cards.map(card => renderCard(registries, { cardId: card.id, upgraded: false,
    ...(Number.isInteger(card.abilityRank) ? { abilityRank: card.abilityRank } : {}),
    ...(card.legacyAbility ? { legacyAbility: true } : {}),
  })));
  let shell;
  const back = button({ label: t('common.back') });
  back.addEventListener('click', () => shell.close());
  shell = openModal({ size: 'xl', title: track.label, eyebrow: track.kind === 'class' ? t('progression.class') : t('progression.skill'),
    opener, showMenuButton: false, className: 'character-sheet progression-inspection', secondary: [back], onClose: hideTooltip,
    body: el('div', { class: 'as-stack progression-skill-detail' }, [
      titleS(t('progression.cards')),
      prose(model.requiresEquipment ? t('progression.cards.equip') : t('progression.cards.note')),
      model.cards.length ? cards : statusText(t('progression.emptyCards')),
      titleS(t('progression.tags')), tagList(registries, model.tags),
      titleS(t('progression.bonuses')), prose(cadenceLine(registries, track)), featButtons(registries, run, model.feats),
      titleS(t('progression.tree')), trackPane(registries, run, track),
    ]) });
  return shell;
}

export function skillTrackButton(registries, run, track, progress) {
  const node = el('button', { type: 'button', class: 'progression-skill-button', 'aria-haspopup': 'dialog',
    'aria-label': `${track.label}, level ${track.level}. Open progression`, dataset: { skill: track.id } }, [
    meter({ stack: true, tone: 'skill', label: `${track.kind === 'class' ? 'Class · ' : ''}${track.label} · Level ${track.level}`,
      value: progress.value, pct: progress.pct, cur: progress.capped ? null : progress.xp,
      max: progress.capped ? null : progress.xpToNext, ariaLabel: progress.sense }),
  ]);
  progressionTip(node, `Open ${track.label} progression`);
  node.addEventListener('click', () => openSkillInspection({ registries, run, track, opener: node }));
  return node;
}

// The track's cadence, read off its own ladder: a clause only for a reward
// some level of THIS track pays, at the first level that pays it, so armour
// never promises a rank-up and a track with no feats never promises one.
export function cadenceLine(registries, track) {
  if (track.kind === 'perception') return 'Run-only Perception advances automatically through correct predictions of wholly unknown actions and successful tactical responses. It improves intent reads and grants no drafts, card ranks, feats or attribute points.';
  const s = (registries.balance && registries.balance.skill) || {};
  const first = (kind) => { const row = track.rows.find((r) => r.grants.some((g) => g.kind === kind)); return row ? row.level : null; };
  const parts = [];
  if (track.kind === 'class') {
    parts.push(t('characterSheet.cadence.classPick'));
    if (track.expanded) {
      const xp = track.rows[0]?.grants.find(grant => grant.kind === 'skillXp');
      if (xp) parts.push(grantText(xp));
      const rewardKinds = [...new Set(track.rows.flatMap(row => row.grants.filter(grant => grant.kind === 'classMilestone').map(grant => grant.rewardKind)))];
      for (const kind of rewardKinds) {
        const levels = track.rows.filter(row => row.grants.some(grant => grant.kind === 'classMilestone' && grant.rewardKind === kind));
        parts.push(t('characterSheet.cadence.levels', { reward: grantText(levels[0].grants.find(grant => grant.kind === 'classMilestone' && grant.rewardKind === kind)), levels: levels.map(row => row.level).join(', ') }));
      }
      if (first('classTier') != null) parts.push(t('characterSheet.cadence.classTier'));
      return parts.join(' ');
    }
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

function skillsPane(registries, run, sheet, state) {
  const rows = skillProgressRows(registries, run, { includeUntouched: true });
  const tracks = sheet.tracks.filter(track => (track.kind === 'class') === (state.tab === 'class'));
  return el('div', { class: 'cs-pane progression-track-list' }, tracks.length ? tracks.map(track =>
    skillTrackButton(registries, run, track, rows.find(row => row.id === track.id))) : [prose(t('progression.emptyClass'))]);
}

/**
 * openCharacterSheet({ registries, run, offers, tab, track, opener, onClose })
 * → the modal shell. `offers` names which character-level rewards the
 * player's settings switch on (CharacterSheetModel DEFAULT_LEVEL_OFFERS).
 */
export function openCharacterSheet({ registries, run, offers = DEFAULT_LEVEL_OFFERS, tab = 'character', track = '', opener, onClose = null, settings = {}, onChange = null, onRewards = null, onRespec = null } = {}) {
  registries = characterSheetRegistries(registries, run);
  let bodyHost = null;
  const state = { tab, track, show: null, settings, onChange, onRewards, close: null };
  const render = () => {
    if (!bodyHost) return;
    const sheet = characterSheetModel(registries, run, { offers });
    bodyHost.replaceChildren(state.tab !== 'character' ? skillsPane(registries, run, sheet, state) : characterPane(registries, run, sheet, state));
    bodyHost.dataset.tab = state.tab;
  };
  state.show = (nextTab, nextTrack = state.track) => { state.tab = nextTab; state.track = nextTrack; render(); };
  const respecAction=onRespec?button({label:t('classRespec.title'),weight:'primary'}):null;
  const back = button({ label: t('common.back') });
  back.addEventListener('click', () => state.close());
  const shell = openModal({
    size: 'xl',
    className: 'character-sheet progression-hub',
    eyebrow: t('progression.title'), secondary: [back],
    tabs: [
      { id: 'character', label: t('progression.tab.character'), selected: tab === 'character' },
      { id: 'skills', label: t('progression.tab.skills'), selected: tab === 'skills' },
      { id: 'class', label: t('progression.tab.class'), selected: tab === 'class' },
    ],
    onTab: (id) => state.show(id),
    showMenuButton: false, // a read-only page has no menu to offer
    closeLabel: t('characterSheet.close'),
    body: (host) => { bodyHost = host; state.host = host; },
    bodyClassName: 'character-sheet-body',
    ...(opener ? { opener } : {}),
    onClose,
    ...(respecAction ? {primary:respecAction} : {}),
  });
  respecAction?.addEventListener('click',()=>{shell.close();onRespec();});
  state.close = shell.close;
  markUiComponent(shell.panel, UI.characterSheet);
  render();
  return shell;
}
