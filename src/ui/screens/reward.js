// src/ui/screens/reward.js — the Core reward door's shared screen (SPEC §6, §7.1; E11/#256)
//
// What Core mounts here, and nothing else: the VICTORY RECEIPT (`receiptOnly`: the fight's XP bars, any
// earned attribute points to spend, Continue) and the CARD RANK-UP door (`skillRankUps`: choose one owned card to
// raise, then a bonus). Core's reward offers themselves are the configured door (components/gameProfileOffers.js).
// The legacy menu — class milestones, skill/class drafts, level choices, flasks, armaments, relics, sigils, the
// per-level Level up claims — was removed with the legacy reward door (Core 2 is the only shipped game).
//
// WHAT the rows are, which are blocked and why, and what Continue means is model/rewardplan.js's one derivation;
// this screen draws rows and forwards taps. A row is applied when TAKEN, through one apply function per kind, and the
// take is saved with its Taken state (the checkpoint) so a reload cannot repeat it.
//
// PROGRESSION, BESIDE THE CLAIM. Combat banks character XP and pays skill tracks before this door opens. The
// receipt stores their XP and starting values; the green underlay moves to the new total, then the yellow overlay
// catches it.
//
// `saves` and `rng` are optional: stubs get a deterministic pick, never Math.random.

import { uiIconText } from '../../content/uiIcons.js';
import { StatAllocationSection } from '../components/statAllocation.js';
import { engravedIcon, engravedIconHtml } from '../components/engravedIcon.js';
import { mountRewardDoor } from '../components/rewardDoor.js';
import { renderCard } from '../components/card.js';
import { openBoundCardInspection } from '../components/cardInspection.js';
import { esc, attachTooltip, showTooltipFor } from '../components/tooltip.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { rewardPlan, rewardClaimStatus, rewardNotes, smithingStonesPaid, smithingStoneRowCopy } from '../../model/rewardplan.js';
import { orderedXpRows, xpFillDurations, scopeXpProgress } from '../../model/rewardXpPresentation.js';
import { rewardProgress } from '../../model/rewardprogress.js';
import { victoryXpFormula, victoryXpPresentation, victoryXpTiming } from '../../model/victoryXpPresentation.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { skillTracks, rankUpCandidates, raiseCardRank } from '../../model/skills.js';
import { el, modalFooter, button } from '../kit/index.js';
import { t, tFull, tTip } from '../strings.js';
import { reasonWhenDisabled } from '../components/refusal.js';
import { openConfirmationModal } from '../components/confirmationModal.js';
import { rankUpBonusOptions } from '../../model/rankUpBonus.js';
import { cardUpgradeChanges } from '../models/CardUpgradeModel.js';
import { projectGameCard } from '../../model/gameProfile.js';
import { resolveCard } from '../../model/registries.js';
import { clearSelection } from '../components/cardSelection.js';
import { ownedCopies } from '../../model/deckRules.js';

const KIND_GLYPHS = { smithingStone: 'smith', skillRankUp: 'progression' };
// Only the rank-ups are choices a player still owes on this screen; Continue never auto-takes them.
const isProgressionReward = (row) => row.kind === 'skillRankUp';

export function mountRewards(app, {
  registries, run, rewards, onDone, saves = null, rng = null,
  onPersist = null, checkpoint = null, onAllocateStat = null,
  receiptOnly = false,
}) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a page-wide store; meeting the same logical
  // id on a later surface must not hand it a card already one beat in.
  clearSelection();
  const plan = rewardPlan(rewards, { flaskSlotsFree: 0, armamentSlotsFree: 0 });
  // The Victory receipt (receiptOnly) draws the Character bar alone; the rank-up door draws all bars.
  const scoped = (value) => receiptOnly ? scopeXpProgress(value) : value;
  let progress = rewards.xpGains ? scoped(rewardProgress(registries, run, rewards.xpGains, { maxSkills: Infinity })) : null;
  const settings = (saves && saves.loadMeta && (saves.loadMeta().settings || {})) || {};
  // The Continue control's hold/key door. Each paint builds a new control, so the old one is disarmed first.
  let disarmContinue = null;
  let xpAnimationDone = !progress || !rewards.xpBefore || !orderedXpRows(progress).length || document.body.classList.contains('reduced-motion');
  const animatedTracks = new Set();
  const meta = (saves && saves.loadMeta && saves.loadMeta()) || {};
  let receiptContinued = false;
  const states = {
    ...(checkpoint?.states || {}),
    ...(smithingStonesPaid(rewards.smithingStoneReceipt) ? { smithingStone: 'taken' } : {}),
  }; // kind → 'taken'|'skipped' (absent = pending)
  // The rank-ups' picks (SPEC §13.4o), keyed by row key: the owned card raised.
  const chosenRankUps = { ...(checkpoint?.chosenRankUps || {}) };
  const pendingByKey = {}; // a chooser's unconfirmed selection, per row, so Back keeps it
  const pendingBonusByKey = {}; // a rank-up's unconfirmed bonus pick (index into its options), per row

  function persistProgress() {
    if (checkpoint) {
      checkpoint.states = { ...states };
      if (Object.keys(chosenRankUps).length || checkpoint.chosenRankUps !== undefined) checkpoint.chosenRankUps = { ...chosenRankUps };
    }
    if (onPersist && onPersist() === false) throw new Error('Reward save was refused.');
  }

  // ---- one apply function per kind ---------------------------------------
  const apply = {
    // Smithing Stones are granted and durably claimed at combat resolution, before this presentation can be
    // interrupted. This row is informational and begins in Taken state; reaching this function would be a contract bug.
    smithingStone() { return false; },
    // A rank-up (SPEC §13.4o): the chosen owned card rises one rank and the track's queued rank-up is spent; a card no
    // longer eligible lands nothing.
    skillRankUp(row) {
      const inst = raiseCardRank(registries, run, row.skillId, row.instanceId, row.bonusStep || null);
      if (!inst) return false;
      chosenRankUps[row.key] = inst.instanceId;
      return true;
    },
  };

  function take(row, viaKind) {
    if (states[row.key]) return false;
    const raised = row.kind === 'skillRankUp' ? ownedInstance(row.instanceId) : null;
    // A rank-up spends the ledger's queued rank-up; only a refused save puts it back.
    const before = row.kind === 'skillRankUp' ? {
      skills: structuredClone(run.skills || {}),
      rankUp: raised ? { inst: raised, rank: raised.rank, steps: raised.upgradeSteps, upgraded: raised.upgraded, chosen: { ...chosenRankUps } } : null,
      checkpoint: checkpoint ? structuredClone(checkpoint) : null,
    } : null;
    if (!apply[row.kind](row)) return false;
    states[row.key] = 'taken';
    // Reward state and the run mutation cross one save door, so a reload can tell an applied row from an untouched one.
    try {
      persistProgress();
    } catch (error) {
      if (before) {
        run.skills = before.skills;
        if (before.rankUp) {
          const { inst, rank, steps, upgraded, chosen } = before.rankUp;
          if (rank === undefined) delete inst.rank; else inst.rank = rank;
          if (steps === undefined) delete inst.upgradeSteps; else inst.upgradeSteps = steps;
          if (upgraded === undefined) delete inst.upgraded; else inst.upgraded = upgraded;
          for (const key of Object.keys(chosenRankUps)) delete chosenRankUps[key];
          Object.assign(chosenRankUps, chosen);
        }
        delete states[row.key];
        if (checkpoint) {
          for (const key of Object.keys(checkpoint)) delete checkpoint[key];
          Object.assign(checkpoint, before.checkpoint);
        }
      }
      throw error;
    }
    sfx.play(`rewardTake_${row.kind}`); // exact → family 'rewardTake' → default
    renderMenu(viaKind || row.key);
    return true;
  }

  // An owned card instance by id, in the deck or set aside.
  const ownedInstance = (instanceId) => [...run.deck, ...(run.sideboard || [])].find((inst) => inst && inst.instanceId === instanceId) || null;
  const instanceRank = (inst) => (Number.isInteger(inst?.rank) && inst.rank > 1 ? inst.rank : 1);

  // ---- row copy: what a kind says in each state ----------------------------
  function rowBody(row) {
    const state = states[row.key];
    switch (row.kind) {
      case 'skillRankUp': {
        const skill = skillTracks(registries).find((track) => track.id === row.skillId);
        const label = esc((skill && skill.label) || row.skillId);
        const title = t('reward.skillRankUp.title', { skill: label, level: row.level });
        if (state === 'taken') {
          const inst = ownedInstance(chosenRankUps[row.key]);
          const def = inst && registries.cards.get(inst.cardId);
          return { title, body: t('reward.skillRankUp.raised', { name: esc((def && def.name) || chosenRankUps[row.key] || ''), rank: instanceRank(inst) }) };
        }
        return { title, body: rankUpCandidates(registries, run, row.skillId).length ? t('reward.skillRankUp.body', { skill: label }) : t('reward.skillRankUp.none', { skill: label }) };
      }
      case 'smithingStone':
        // Ordinary stones, refined stones (SPEC §15.3), or both, on one row: title and body each name only the purse that was paid.
        return smithingStoneRowCopy(row, t);
      default:
        return { title: row.kind, body: '' };
    }
  }

  function statAllocationSection() {
    if (!receiptOnly) return null;
    return StatAllocationSection(registries, run, { settings, onAllocateStat, onChange: persistProgress });
  }

  async function playXpAnimation(host) {
    const active = () => host?.isConnected && app.querySelector('.reward-claim-layout') === host;
    if (host.xpAnimationRunning) return;
    host.xpAnimationRunning = true;
    // DOM order is Class, Character, then skills by their current level.
    const bars = [...host.querySelectorAll('.rp-layered-bar[data-animate="1"]')];
    const requested = Number(settings.victoryXpSeconds);
    const total = document.body.classList.contains('reduced-motion') ? 0
      : Math.max(0, Math.min(12000, (Number.isFinite(requested) ? requested : 3) * 1000));
    const durations = xpFillDurations(bars.map(bar => ({ from: Number(bar.dataset.old) / 100, to: Number(bar.dataset.target) / 100 })), total);
    for (const bar of bars) {
      const duration = durations[bars.indexOf(bar)];
      const green = bar.querySelector('.rp-under');
      const yellow = bar.querySelector('.rp-over');
      if (!green || !yellow) continue;
      const target = `${bar.dataset.target}%`;
      if (duration > 0) {
        bar.getBoundingClientRect(); // commit the reset before starting the transition
        green.style.transition = `width ${duration}ms linear`;
        yellow.style.transition = `width ${duration}ms linear`;
        green.style.width = target;
        yellow.style.width = target;
        await new Promise((resolve) => setTimeout(resolve, duration));
        if (!active()) return;
      } else {
        green.style.width = target;
        yellow.style.width = target;
      }
      animatedTracks.add(bar.dataset.track);
      // Full bars turn blue immediately, but stay plain progressbars until
      // the entire sequence has settled. Capped tracks never get a button.
      if (Number(bar.dataset.target) >= 100) bar.classList.add('rp-bar-ready');
    }
    if (!active()) return;
    host.xpAnimationRunning = false;
    xpAnimationDone = true;
    refreshProgressView();
  }

  // ---- THE DOOR: a decision modal OVER whatever stands beneath ---------------
  // Constantine: victory is a modal over the battlefield, and the cinders are
  // granted on arrival. Each view (menu, detail, chooser) is the same md door
  // rebuilt: kit head (Eyebrow + Title, no way out but a choice), a body, and
  // a foot on the button ladder. It lives inside `app`, so the next screen's
  // own mount clears it exactly as it cleared the old full-screen menu.
  //
  // ONE DOOR PER SCREEN, its CONTENTS swapped. The veil and the door fade in
  // when they are created (kit.css door-in), so building a new pair on every
  // render replayed that fade on each XP tick and level claim — the flash.
  // A later view reuses this mount's open door and replaces its head, body
  // and foot; only a door this mount did not open is replaced whole.
  // `doorView` counts the views, so a view's own timers can tell the door
  // they were bound to has moved on even though the element is the same.
  let doorView = 0;
  const doorOwner = {};
  function door(options) {
    doorView += 1;
    return mountRewardDoor(app, { owner: doorOwner, ...options });
  }

  function renderMenu(focusKind = null) {
    const notesHtml = rewardNotes(rewards).map((token) => `<p class="reward-note" data-note="${esc(token)}">${esc(t(`reward.note.${token}`))}</p>`).join('');
    const rowsHtml = plan.rows.map(rowHtml).join('');
    // The button is the verb; the FootNote says what the verb does here (the
    // E11 dial: auto-collect takes the rest, manual leaves it) and how to press.
    const cont = button({
      label: t('reward.continue'),
      weight: 'primary', id: 'reward-continue', disabled: !xpAnimationDone, attrs: {
        'aria-describedby': 'reward-hold-copy',
        'data-confirm-ready': String(xpAnimationDone),
      },
    });
    const foot = modalFooter({ note: holdNote(), primary: cont, className: 'reward-foot', size: 'medium' });
    const note = foot.querySelector('.modal-foot-note');
    note.id = 'reward-hold-copy';
    note.setAttribute('aria-live', 'polite');
    // W1t: the choices beside their claim status, and the count in the head.
    const claim = rewardClaimStatus(plan, states);
    door({
      eyebrow: plan.rows.length ? t('reward.eyebrow.claim') : t('reward.eyebrow.spoils'),
      title: rewards.title || t('reward.title.victory'),
      // No live region: the footer note already announces progress.
      status: plan.rows.length ? el('span', { class: 'as-status modal-head-status',
        text: t('reward.status.claimed', { claimed: claim.claimed, total: claim.total }) }) : null,
      body: el('div', { class: 'reward-claim-layout', 'aria-busy': String(!xpAnimationDone) }, [
        el('div', { class: 'class-row reward-menu', html: rowsHtml + notesHtml }),
        sideColumn(claim),
        receiptOnly ? statAllocationSection() : null,
      ]),
      foot,
    });
    app.querySelector('.reward-menu').inert = !xpAnimationDone;

    bindRows(app);
    for (const btn of app.querySelectorAll('[data-skip]')) {
      attachTooltip(btn, () => `<div class="tt-title">${esc(tTip('reward.skip'))}</div>${esc(tFull('reward.skip'))}`);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        states[btn.dataset.skip] = 'skipped';
        persistProgress();
        renderMenu(btn.dataset.skip);
      });
    }

    attachTooltip(cont, () => `<div class="tt-title">${esc(t('reward.continue'))}</div>${esc('Leave with your chosen loot. Unfinished level rewards are saved for later.')}`);
    // Continue only leaves: a rank-up is a choice the player owes, never auto-taken, and a skipped one stays queued.
    const finish = () => {
      if (!xpAnimationDone) return;
      onDone();
      disarmContinue?.(); disarmContinue = null;
    };
    // Continue commits on one tap (the rewardContinue row in model/secondbeat.js
    // says `tap: true`) and asks exactly once, in the shared confirmation modal,
    // while something claimable is still unclaimed. The row stays registered so
    // keyboard and pad presses enter the same door as pointer and touch.
    const leave = () => {
      if (!receiptOnly) return finish();
      if (receiptContinued || !xpAnimationDone) return;
      receiptContinued = true;
      try { finish(); }
      catch (error) {
        receiptContinued = false;
        note.textContent = error.message;
      }
    };
    disarmContinue?.();
    disarmContinue = beatArmer(meta, registries)(cont, 'rewardContinue', {
      onConfirm: () => {
        if (!hasUnclaimedReward()) return leave();
        openConfirmationModal({
          title: t('reward.leave.question'), message: t('reward.leave.message'),
          confirmLabel: t('reward.leave.confirm'), cancelLabel: t('reward.leave.take'),
          returnFocusElement: cont, onConfirm: leave,
        });
      },
    });

    followUp(app.querySelector('.reward-claim-layout'));
    if (isEngaged()) {
      setTimeout(() => (focusKind && focusFirst(`.reward-kind[data-key="${focusKind}"]`))
        || focusFirst('.reward-kind:not(.locked)') || focusFirst('#reward-continue'), 0);
    }
  }

  function rowHtml(row) {
    const state = states[row.key] || (row.blockedBy ? 'blocked' : 'pending');
    const { title, body } = rowBody(row);
    // A level's reward waiting to be opened stands lifted and blue; the one
    // a claim just unlocked plays its arrival once.
    const offer = state === 'pending' && isProgressionReward(row)
      ? ` reward-level-offer` : '';
    return `
      <div class="class-pick reward-kind${state === 'taken' || state === 'blocked' || state === 'skipped' ? ' locked' : ''}${offer}"
           data-kind="${esc(row.kind)}" data-key="${esc(row.key)}" data-state="${esc(state)}"
           data-blocked-by="${esc(row.blockedBy || '')}">
        <div class="glyph">${engravedIconHtml(KIND_GLYPHS[row.kind]) || esc(uiIconText(KIND_GLYPHS[row.kind] || '?'))}</div>
        <div class="cp-body">
          <h3>${esc(title)}</h3>
          <p>${body}</p>
          ${state === 'taken' ? `<span class="chip">${esc(t('reward.state.taken'))}</span>`
            : state === 'blocked' ? `<span class="chip">${esc(t('reward.state.blocked'))}</span>`
            : state === 'skipped' ? `<span class="chip">${esc(t('reward.state.skipped'))}</span>`
            : ''}
        </div>
        ${state === 'blocked' ? `<button class="subtle reward-skip" data-skip="${esc(row.key)}" data-focusable="true" aria-label="${esc(t('reward.skip.aria', { kind: title }))}">${esc(t('reward.skip'))}</button>` : ''}
      </div>`;
  }

  function bindRows(root) {
    for (const el of root.querySelectorAll('.reward-kind')) {
      const row = plan.rows.find((r) => r.key === el.dataset.key);
      const state = el.dataset.state;
      // Law 3 clause 4: a real tooltip, for hover AND the pad/keyboard focus
      // cursor. The blocked row's tooltip carries the REASON (blockedBy), so
      // the label switches on the model's token, never on a re-derivation.
      attachTooltip(el, () => {
        if (state === 'blocked') return `<div class="tt-title">${esc(tTip('reward.blocked.slots'))}</div>${esc(tFull('reward.blocked.slots'))}`;
        if (state === 'taken') return `<div class="tt-title">${esc(tTip('reward.state.taken'))}</div>`;
        const offer = row.kind === 'skillRankUp' ? (row.choice ? 'reward.card.choose' : 'reward.card.take') : 'reward.take';
        return `<div class="tt-title">${esc(tTip(offer))}</div>${esc(tFull(offer))}`;
      });
      if (state === 'taken' || state === 'blocked' || state === 'skipped') continue;
      el.addEventListener('click', () => {
        if (!xpAnimationDone) return;
        if (row.kind === 'skillRankUp') return renderChooser(row);
        take(row);
      });
    }
  }

  // A row the player could still take: not taken, not skipped, not blocked.
  const hasUnclaimedReward = () => plan.rows.some((row) => !states[row.key] && !row.blockedBy);

  // The menu's foot note: what Continue does from here.
  function holdNote() {
    if (receiptOnly) return "Experience earned in this battle.";
    const pending = plan.rows.filter((r) => !states[r.key] && !r.blockedBy);
    if (pending.some(isProgressionReward)) return 'Unfinished levels and level rewards are saved for later victories and Character.';
    if (plan.rows.every(row => states[row.key] === 'taken' || states[row.key] === 'skipped')) return t('reward.hold.complete');
    return t('reward.hold.leavesRest');
  }

  // What a drawn menu does next: the pending XP animation, else the next
  // bar's turn to fill. Both are bound to THIS layout, so a later render or mount
  // that replaces it strands the timer instead of being driven by it.
  function followUp(host) {
    if (!host) return;
    if (!xpAnimationDone && progress && rewards.xpBefore) {
      setTimeout(() => {
        if (host.isConnected && app.querySelector('.reward-claim-layout') === host) playXpAnimation(host);
      }, 0);

    }
  }

  function refreshProgressView() {
    const layout = app.querySelector('.reward-claim-layout');
    const panel = layout?.querySelector('.reward-progress');
    const next = panel ? progressPanel() : null;
    if (!next) { renderMenu(); return; }
    panel.after(next);
    panel.remove();
    const menu = layout.querySelector('.reward-menu');
    if (menu) menu.inert = !xpAnimationDone;
    layout.setAttribute('aria-busy', String(!xpAnimationDone));
    const cont = app.querySelector('#reward-continue');
    if (cont) {
      cont.disabled = !xpAnimationDone;
      cont.dataset.confirmReady = String(xpAnimationDone);
    }
    const note = app.querySelector('#reward-hold-copy');
    if (note) note.textContent = holdNote();
    // The pressed Level up went with the old panel; keep the cursor on its row.
    const focused = document.activeElement;
    if (isEngaged() && (!focused || focused === document.body || !focused.isConnected)) {
      focusFirst('.reward-kind:not(.locked)') || focusFirst('#reward-continue');
    }
    followUp(layout);
  }

  // The right-hand column: what the fight moved, then what is left to claim. One column so the two read as one
  // ledger; null when it would be empty (a preview scene's stub run with no offer and no ledgers).
  function sideColumn(claim) {
    const progression = progressPanel();
    const children = [progression, !progression && plan.rows.length ? claimStatusPanel(claim) : null].filter(Boolean);
    return children.length ? el('div', { class: 'reward-side' }, children) : null;
  }

  function progressRow(row, label) {
    // A CAP is the only thing that leaves a row without a next level — the
    // model drops a track whose curve will not read rather than handing one
    // here, so `capped` alone decides this and no re-derivation guesses.
    const next = el('span', {
      class: 'rp-next',
      text: row.capped ? t('reward.progress.capped') : row.kind === 'character' ? `Level ${row.level + 1}` : t('reward.progress.next', { level: row.level + 1 }),
    });
    const target = row.fraction * 100;
    const before = row.kind === 'character' ? rewards.xpBefore?.character : rewards.xpBefore?.tracks?.[row.id];
    const old = before && before.level === row.level && row.xpToNext
      ? Math.max(0, Math.min(100, before.xp / row.xpToNext * 100)) : 0;
    const animate = !xpAnimationDone && row.gained > 0 && !!before && !animatedTracks.has(row.id);
    const waitingInitial = !xpAnimationDone && row.gained > 0 && !!before && !animatedTracks.has(row.id);
    const under = el('span', { class: 'rp-under' });
    const over = el('span', { class: 'rp-over' });
    under.style.width = `${animate || waitingInitial ? old : target}%`;
    over.style.width = `${animate || waitingInitial ? old : target}%`;
    const bar = el('div', {
      class: `rp-bar rp-layered-bar${!animate && !waitingInitial && row.fraction >= 1 ? ' rp-bar-ready' : ''}`,
      role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(row.xpToNext || 0),
      'aria-valuenow': String(Math.min(row.xp, row.xpToNext || row.xp)),
      'aria-label': `${label}: ${Math.min(row.xp, row.xpToNext || row.xp)} / ${row.xpToNext || row.xp} XP`,
      dataset: { animate: animate ? '1' : '0', target: String(target), old: String(old), track: row.id, kind: row.kind },
    }, [under, over, el('span', { class: 'rp-bar-text', text: `${Math.min(row.xp, row.xpToNext || row.xp)} / ${row.xpToNext || row.xp}` })]);
    const node = el('li', {
      class: 'reward-progress-row',
      dataset: { kind: row.kind, track: row.id, gained: String(row.gained) },
    }, [
      el('span', { class: 'rp-name', text: label }),
      el('span', { class: 'rp-level', text: row.kind === 'character' ? `Level ${row.level}` : t('reward.progress.level', { level: row.level }) }),
      bar,
      next,
      row.gained ? el('span', { class: 'rp-gain', text: t('reward.progress.gained', { xp: row.gained }) }) : null,
      // The per-fight level cap threw some of it away (SPEC §15.2): say how much.
      row.discarded ? el('span', { class: 'rp-discarded', title: tFull('reward.progress.discarded', { xp: row.discarded }), text: t('reward.progress.discarded', { xp: row.discarded }) }) : null,
    ]);
    // The exact XP is the tooltip, not the row: the row carries the shape of
    // the climb and the gain; the numbers are for the player who asks.
    attachTooltip(node, () => `<div class="tt-title">${esc(label)}</div>${esc(row.capped
      ? tFull('reward.progress.capped')
      : tFull('reward.progress.xp', { xp: Math.min(row.xp, row.xpToNext), next: row.xpToNext, level: row.level + 1 }))}`);
    return node;
  }

  function progressPanel() {
    if (!progress || (!progress.character && !progress.skills.length)) return null;
    const rows = orderedXpRows(progress).map(row => progressRow(row,
      row.kind === 'character' ? t('reward.progress.character')
        : row.kind === 'class' ? t('reward.progress.classTrack', { class: row.label }) : row.label));
    return el('section', { class: 'reward-progress', 'aria-label': t('reward.progress.heading'), 'aria-busy': String(!xpAnimationDone) }, [
      el('h3', { class: 'as-eyebrow', text: t('reward.progress.heading') }),
      el('ul', { class: 'reward-progress-list' }, rows),
    ]);
  }

  function claimStatusPanel(claim) {
    const lines = claim.rows.map((entry) => el('li', { class: 'reward-claim-row', dataset: { kind: entry.kind, key: entry.key, state: entry.state } }, [
      el('span', { class: 'reward-claim-name', text: rowBody(plan.rows.find((row) => row.key === entry.key)).title }),
      el('span', { class: 'reward-claim-state', text: t(entry.state === 'blocked' ? 'reward.claim.blocked' : `reward.state.${entry.state}`) }),
    ]));
    const required = claim.requiredChoice ? el('p', { class: 'reward-claim-required', dataset: { required: claim.requiredChoice.kind } }, [
      el('span', { class: 'as-eyebrow', text: t('reward.claim.required') }),
      el('span', { text: t('reward.card.chooseOne', { count: claim.requiredChoice.count }) }),
    ]) : null;
    return el('aside', { class: 'reward-claim-status', 'aria-label': t('reward.claim.heading') }, [
      el('h3', { class: 'as-eyebrow', text: t('reward.claim.heading') }),
      el('ul', { class: 'reward-claim-list' }, lines),
      required,
    ]);
  }

  // ---- the rank-up chooser: select first, then explicitly confirm ----------
  // A rank-up (SPEC §13.4o) chooses among the run's OWN cards, each shown at the rank it would rise to; its pick is an
  // instance id, and a Core card with rank-up bonus options also takes the ONE option the player picked.
  function renderChooser(row) {
    const taken = () => states[row.key];
    const rankUpCards = rankUpCandidates(registries, run, row.skillId);
    const backButton = button({ label: t('common.skip'), id: 'reward-back', className: 'danger', attrs: { 'data-back': '' } });
    const confirmButton = button({
      label: t('reward.confirm'), weight: 'primary', id: 'reward-card-confirm', className: 'reward-confirm', disabled: true,
    });
    const inspectionFaces = new Map();
    const inspectButton = button({ label: t('deckEditor.inspectAction'), id: 'reward-inspect', disabled: true,
      attrs: { 'aria-label': t('deckEditor.inspectAction') } });
    inspectButton.addEventListener('click', () => {
      if (!confirming && !taken()) openBoundCardInspection(inspectionFaces.get(selectedCardId), inspectButton);
    });
    door({
      eyebrow: rowBody(row).title,
      title: rewards.title || t('reward.title.victory'),
      body: el('div', { class: 'reward-row', role: 'radiogroup', 'aria-label': t('reward.card.aria') }),
      foot: modalFooter({ secondary: [backButton, inspectButton], primary: confirmButton, className: 'reward-foot reward-chooser-foot', size: 'medium' }),
    });
    const strip = app.querySelector('.reward-row');
    let selectedCardId = pendingByKey[row.key] || null;
    let confirming = false;
    let reviewing = false;
    const message = el('p', { role: 'status', class: 'reward-confirm-status', hidden: true });
    strip.after(message);
    // Nothing chosen yet: the reason stands under Confirm as text (FINISH §6).
    // A press in flight is a beat, not a reason, so it stays quiet.
    const bonusOptionsOf = (instanceId) => (instanceId ? rankUpBonusOptions(registries, run, ownedInstance(instanceId)) : []);
    const needsBonus = () => !!selectedCardId && bonusOptionsOf(selectedCardId).length > 0 && !(pendingBonusByKey[row.key] >= 0);
    const confirmReason = reasonWhenDisabled(confirmButton, () => (!selectedCardId ? t('reward.confirm.reason') : needsBonus() ? t('reward.rankBonus.reason') : null));
    // The bonus choices under the strip: one button per option, saying what it changes on the card.
    const bonusPanel = el('div', { class: 'reward-rank-bonus', role: 'radiogroup', 'aria-label': t('reward.rankBonus.label'), hidden: true });
    strip.after(bonusPanel);
    const faceOf = (instance) => projectGameCard(run, instance) || resolveCard(registries, instance);
    function renderBonusPanel() {
      bonusPanel.replaceChildren();
      const options = bonusOptionsOf(selectedCardId);
      bonusPanel.hidden = !options.length;
      if (!options.length) return;
      const inst = ownedInstance(selectedCardId);
      const before = faceOf({ ...inst, rank: instanceRank(inst) + 1 });
      bonusPanel.appendChild(el('p', { class: 'reward-rank-bonus-title', text: t('reward.rankBonus.label') }));
      options.forEach((option, index) => {
        const changes = cardUpgradeChanges(registries, before, faceOf(option.after));
        const summary = changes.map((c) => `${c.label} ${c.before} \u2192 ${c.after}`).join(', ') || t('reward.rankBonus.option', { n: index + 1 });
        const chosen = pendingBonusByKey[row.key] === index;
        const choice = button({ label: summary, className: `class-pick reward-bonus-option${chosen ? ' is-chosen' : ''}`,
          attrs: { role: 'radio', 'aria-checked': String(chosen), 'aria-label': t('cardUpgrade.option.aria', { n: index + 1, total: options.length, summary }), dataset: { bonusIndex: String(index) } } });
        choice.addEventListener('click', () => selectBonus(index));
        bonusPanel.appendChild(choice);
      });
    }
    const selectBonus = (index) => {
      if (reviewing || confirming || taken() || !(index >= 0)) return;
      pendingBonusByKey[row.key] = index;
      const old = [...strip.children].find((node) => node.dataset?.pickId === selectedCardId);
      const inst = ownedInstance(selectedCardId);
      if (old && inst) old.replaceWith(rankUpFace(inst));
      renderBonusPanel();
      confirmButton.disabled = false;
      inspectButton.disabled = !inspectionFaces.has(selectedCardId);
      confirmReason();
    };
    // Choosing belongs to this screen; inspection only reads the selected face.
    const selectCard = (cardId) => {
      if (reviewing || confirming || taken()) return;
      const previous = selectedCardId;
      if (previous !== cardId) delete pendingBonusByKey[row.key]; // each card rolls its own bonuses
      selectedCardId = cardId;
      pendingByKey[row.key] = cardId;
      // Candidates are found by CLASS, not by attribute: the reward door's
      // test DOM (tests/helpers/reward-dom.mjs) keeps dataset as a plain
      // object, and a selector on a data attribute would find nothing there.
      for (const candidate of strip.querySelectorAll('.reward-pick')) {
        const selected = candidate.dataset.pickId === cardId;
        // Both, always together (#997): the lift and the shared ring.
        // A column's text button wears the green trim only: `reward-selected`
        // is the lift of the face above it, so one option reads as one lit card.
        if (!candidate.classList.contains('reward-choice-button')) candidate.classList.toggle('reward-selected', selected);
        candidate.classList.toggle('is-chosen', selected);
        candidate.setAttribute('aria-checked', String(selected));
      }
      // The chosen relic's card face wears the same green trim as its button.
      // A card face also takes the door's lift (`reward-selected`), as before.
      for (const face of strip.querySelectorAll('.reward-choice-face')) {
        const selected = face.dataset.pickId === cardId;
        face.classList.toggle('reward-selected', selected);
        face.classList.toggle('is-chosen', selected);
      }
      {
        // The face of the card just left goes back to plain rank-up; the new one waits for a bonus pick.
        const left = previous && previous !== cardId ? rankUpCards.find((inst) => inst.instanceId === previous) : null;
        const leftNode = left ? [...strip.children].find((n) => n.dataset?.pickId === previous) : null;
        if (leftNode) leftNode.replaceWith(rankUpFace(left));
        renderBonusPanel();
      }
      confirmButton.disabled = needsBonus();
      inspectButton.disabled = !inspectionFaces.has(selectedCardId);
      confirmReason();
      message.hidden = true;
    };
    // A rank-up also offers 2-3 bonus options once a card is picked (owner, 2026-11-01): the card shows at its
    // new rank, and with the chosen bonus applied once one is picked.
    const rankUpFace = (inst) => {
      const option = inst.instanceId === selectedCardId ? bonusOptionsOf(inst.instanceId)[pendingBonusByKey[row.key]] : null;
      const face = renderCard(registries, option ? option.after : { ...inst, rank: instanceRank(inst) + 1 }, {
        rules: run,
        owned: ownedCopies(run, inst.cardId),
        actionOwnsTouch: true,
        surface: 'reward',
        only: [],
      });
      face.dataset.cardId = inst.cardId;
      face.dataset.pickId = inst.instanceId;
      inspectionFaces.set(inst.instanceId, face);
      face.classList.add('reward-pick');
      face.setAttribute('role', 'radio');
      face.setAttribute('aria-checked', String(inst.instanceId === selectedCardId));
      face.classList.toggle('reward-selected', inst.instanceId === selectedCardId);
      face.classList.toggle('is-chosen', inst.instanceId === selectedCardId);
      face.addEventListener('click', () => selectCard(inst.instanceId));
      return face;
    };
    for (const inst of rankUpCards) strip.appendChild(rankUpFace(inst));
    renderBonusPanel();
    if (!rankUpCards.length) {
      const skill = skillTracks(registries).find((track) => track.id === row.skillId);
      strip.appendChild(el('p', { class: 'reward-rank-none', text: t('reward.skillRankUp.none', { skill: (skill && skill.label) || row.skillId }) }));
    }
    confirmButton.disabled = !selectedCardId || needsBonus();
    inspectButton.disabled = !inspectionFaces.has(selectedCardId);
    confirmReason();
    // Confirm stages a review only. Continue is the sole persistence door;
    // Back can change the selection without undoing inventory or class grants.
    const commitSelection = () => {
      if (!selectedCardId || confirming || taken()) return;
      confirming = true;
      inspectButton.disabled = true; strip.inert = true;
      confirmButton.disabled = true;
      try {
        const bonusStep = bonusOptionsOf(selectedCardId)[pendingBonusByKey[row.key]]?.step;
        if (take({ ...row, ...(bonusStep ? { bonusStep } : {}), instanceId: selectedCardId }, row.key)) return;
        message.textContent = t('reward.skillRankUp.spent');
      } catch {
        message.textContent = t('reward.card.saveFailed');
      }
      message.hidden = false;
      confirming = false;
      inspectButton.disabled = !inspectionFaces.has(selectedCardId); strip.inert = false;
      confirmButton.disabled = false;
    };
    confirmButton.addEventListener('click', () => {
      if (!selectedCardId || confirming || taken()) return;
      if (reviewing) return commitSelection();
      reviewing = true;
      confirmButton.textContent = t('common.continue');
      backButton.textContent = t('common.back');
      strip.setAttribute('aria-label', t('reward.confirm'));
      // Preserve the real selected face and its authored details for review.
      for (const option of strip.children) {
        option.hidden = !option.matches('.reward-selected') && !option.querySelector('.reward-selected')
          && option.dataset.pickId !== selectedCardId;
      }
      for (const control of strip.querySelectorAll('button.reward-pick')) control.disabled = true;
      for (const control of bonusPanel.querySelectorAll('button')) control.disabled = true;
    });
    backButton.addEventListener('click', () => {
      if (confirming || taken()) return;
      if (reviewing) return renderChooser(row);
      states[row.key] = 'skipped';
      try { persistProgress(); }
      catch {
        delete states[row.key];
        if (checkpoint) checkpoint.states = { ...states };
        message.textContent = t('reward.card.saveFailed');
        message.hidden = false;
        return;
      }
      renderMenu(row.key);
    });
    if (isEngaged()) setTimeout(() => focusFirst('.reward-row .reward-pick') || focusFirst('#reward-back'), 0);
  }


  function expandVictory() {
    if (checkpoint) checkpoint.expanded = true;
    persistProgress();
    renderMenu();
  }

  function renderCompactVictory() {
    const total = Math.max(0, Math.floor(Number(rewards.xpGains?.level) || 0));
    const savedRows = rewards.xpReceipt?.rows;
    // An older saved reward has no itemized receipt. Show its paid total as
    // one honest row; never reconstruct enemy levels from the resumed run.
    const rows = Array.isArray(savedRows) && savedRows.every((row) => Number.isSafeInteger(row.amount))
      && savedRows.reduce((sum, row) => sum + row.amount, 0) === total
      ? savedRows : [{ kind: 'legacy', amount: total }];
    const options = victoryXpPresentation(settings, document.body.classList.contains('reduced-motion'));
    const timing = victoryXpTiming(rows.length, options);
    const open = button({ label: t('common.continue'), weight: 'primary', id: 'reward-expand', className: 'reward-compact-continue', disabled: true });
    const formula = el('span', { class: 'reward-compact-formula' });
    const more = el('button', { class: 'reward-compact-more', type: 'button', text: '+…', 'aria-label': t('reward.xp.more.aria') });
    more.hidden = true;
    const arithmetic = el('span', { class: 'reward-compact-arithmetic' }, [formula, more]);
    const value = el('strong', { class: 'reward-compact-value', text: t('reward.xp.zero'), 'aria-live': 'polite' });
    const summary = el('div', { class: 'reward-compact-summary' }, [
      el('span', { class: 'reward-compact-heading', text: t('reward.xp.total') }), arithmetic, value,
    ]);
    const list = el('ol', { class: 'reward-compact-list', 'aria-label': t('reward.xp.list.aria') });
    list.style.setProperty('--receipt-rows', String(options.visibleRows));
    const body = el('div', { class: 'reward-compact-xp' }, [summary, list]);
    const modal = door({ eyebrow: '', title: rewards.title || t('reward.title.victory'),
      attrs: { dataset: { size: 'sm', victoryCompact: 'true' } }, body,
      foot: modalFooter({ primary: open, className: 'reward-foot', size: 'medium' }),
    });
    const fullCalculation = () => `<div class="tt-title">Full XP calculation</div><div>${esc(victoryXpFormula(rows, rows.length, options.formulaTerms).full)}</div>`;
    const tooltipPlacement = { intent: 'above', align: 'end', clear: modal, appearance: { maxWidthRem: 30, maxHeightRatio: 0.5 } };
    attachTooltip(more, fullCalculation, tooltipPlacement);
    more.addEventListener('click', () => showTooltipFor(more, fullCalculation(), tooltipPlacement));
    let ready = false;
    let shown = 0;
    const view = doorView;
    const active = () => modal.isConnected && doorView === view && app.querySelector('.reward-door') === modal;
    const updateFormula = () => {
      const expression = victoryXpFormula(rows, shown, options.formulaTerms);
      formula.textContent = expression.shown;
      more.hidden = !expression.collapsed;
    };
    const addRow = (row) => {
      const label = row.kind === 'power' ? 'Combat-power victory bonus'
        : row.kind === 'enemy' ? `${row.name || t('combat.log.role.enemy')} · Level ${row.level || 1}`
          : row.kind === 'bonus' ? 'Character XP bonus' : 'Battle XP';
      const amount = el('strong', { class: 'reward-compact-row-value', text: '+0' });
      const item = el('li', { class: 'reward-compact-row' }, [
        el('span', { class: 'reward-compact-row-label', text: label }), amount,
      ]);
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
      return amount;
    };
    const arm = () => {
      if (!active()) return;
      ready = true;
      open.disabled = false;
      open.classList.add('is-ready');
      if (settings.victorySummaryMode === 'auto') expandVictory();
    };
    const pause = (ms) => ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
    const count = (from, to, ms, render) => new Promise((resolve) => {
      if (ms <= 0) { render(to); resolve(); return; }
      const start = performance.now();
      const frame = (now) => {
        if (!active()) { resolve(); return; }
        const fraction = Math.min(1, (now - start) / ms);
        render(from + Math.round((to - from) * fraction));
        if (fraction >= 1) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const show = (row, running) => {
      const amount = addRow(row);
      return (next) => {
        amount.textContent = `${next < 0 ? '−' : '+'}${Math.abs(next)}`;
        value.textContent = `${running + next} XP`;
      };
    };
    if (options.totalMs === 0) {
      let running = 0;
      for (const row of rows) {
        show(row, running)(row.amount);
        running += row.amount;
        shown += 1;
      }
      updateFormula();
      if (options.readyMs === 0) arm();
      else setTimeout(arm, options.readyMs);
    } else {
      (async () => {
        let running = 0;
        for (const [index, row] of rows.entries()) {
          if (!active()) return;
          await count(0, row.amount, timing.tickMs, show(row, running));
          if (!active()) return;
          running += row.amount;
          shown = index + 1;
          updateFormula();
          if (index < rows.length - 1) await pause(timing.pauseMs);
        }
        await pause(options.readyMs);
        arm();
      })();
    }
    open.addEventListener('click', () => { if (ready) expandVictory(); });
    if (settings.victorySummaryMode === 'anywhere') {
      app.querySelector('.reward-veil')?.addEventListener('click', (event) => {
        if (ready && active() && event.target !== open && event.target !== more) expandVictory();
      });
    }
  }

  sfx.play('victory');
  if (receiptOnly) renderMenu();
  else if (checkpoint?.expanded) expandVictory();
  else if (!checkpoint?.source || !rewards.xpGains) renderMenu();
  else renderCompactVictory();
}
