// The Core reward door: victory receipt and rank-up chooser.

import { uiIconText } from '../../content/uiIcons.js';
import { StatAllocationSection } from '../components/statAllocation.js';
import { engravedIconHtml } from '../components/engravedIcon.js';
import { MountRewardDoor } from '../components/rewardDoor.js';
import { renderCard } from '../components/card.js';
import { openBoundCardInspection } from '../components/cardInspection.js';
import { esc as escapeHtml, attachTooltip, showTooltipFor } from '../components/tooltip.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import {
    rewardPlan,
    rewardClaimStatus,
    rewardNotes,
    smithingStonesPaid,
    smithingStoneRowCopy,
} from '../../model/rewardplan.js';
import {
    orderedXpRows,
    xpFillDurations,
    scopeXpProgress,
} from '../../model/rewardXpPresentation.js';
import { rewardProgress } from '../../model/rewardprogress.js';
import {
    victoryXpFormula,
    victoryXpPresentation,
    victoryXpTiming,
} from '../../model/victoryXpPresentation.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { skillTracks, rankUpCandidates, raiseCardRank } from '../../model/skills.js';
import { el as buildElement, modalFooter, button } from '../kit/index.js';
import { t as translate, tFull as translateFull, tTip as translateTip } from '../strings.js';
import { reasonWhenDisabled } from '../components/refusal.js';
import { OpenConfirmationModal } from '../components/confirmationModal.js';
import { rankUpBonusOptions } from '../../model/rankUpBonus.js';
import { cardUpgradeChanges } from '../models/CardUpgradeModel.js';
import { projectGameCard } from '../../model/gameProfile.js';
import { resolveCard } from '../../model/registries.js';
import { clearSelection } from '../components/cardSelection.js';
import { ownedCopies } from '../../model/deckRules.js';

const SKILL_RANK_UP = 'skillRankUp';
const SMITHING_STONE = 'smithingStone';
const KIND_GLYPHS = {
    smithingStone: 'smith',
    skillRankUp: 'progression',
};

const STATE_PENDING = 'pending';
const STATE_TAKEN = 'taken';
const STATE_SKIPPED = 'skipped';
const STATE_BLOCKED = 'blocked';
const LOCKED_STATES = new Set([
    STATE_TAKEN,
    STATE_BLOCKED,
    STATE_SKIPPED,
]);
const STATE_COPY_IDS = {
    taken: 'reward.state.taken',
    blocked: 'reward.state.blocked',
    skipped: 'reward.state.skipped',
};

const CLAIM_LAYOUT_SELECTOR = '.reward-claim-layout';
const MENU_SELECTOR = '.reward-menu';
const CONTINUE_ID = 'reward-continue';
const CONTINUE_SELECTOR = `#${CONTINUE_ID}`;
const CONFIRM_BUTTON_ID = 'reward-card-confirm';
const INSPECT_BUTTON_ID = 'reward-inspect';
const CHOSEN_CLASS = 'is-chosen';
const SELECTED_CLASS = 'reward-selected';
const CONTINUE_LABEL_ID = 'common.continue';
const INSPECT_LABEL_ID = 'deckEditor.inspectAction';
const HOLD_NOTE_ID = 'reward-hold-copy';
const UNLOCKED_ROW_SELECTOR = '.reward-kind:not(.locked)';
const CHOOSER_STRIP_SELECTOR = '.reward-row';
const FOOT_SIZE = 'medium';
const TITLE_VICTORY_ID = 'reward.title.victory';
const SAVE_FAILED_ID = 'reward.card.saveFailed';
const NONE_ID = 'reward.skillRankUp.none';
const REDUCED_MOTION_CLASS = 'reduced-motion';

const DEFAULT_XP_SECONDS = 3;
const MAX_XP_MILLISECONDS = 12000;
const MORE_LABEL = '+…';
const ARROW = ' → ';
const MINUS = '−';

const RECEIPT_HOLD_COPY = 'Experience earned in this battle.';
const UNFINISHED_HOLD_COPY =
    'Unfinished levels and level rewards are saved for later victories and Character.';
const LEAVE_TOOLTIP_COPY =
    'Leave with your chosen loot. Unfinished level rewards are saved for later.';
const FULL_CALCULATION_TITLE = 'Full XP calculation';
const POWER_ROW_LABEL = 'Combat-power victory bonus';
const BONUS_ROW_LABEL = 'Character XP bonus';
const BATTLE_ROW_LABEL = 'Battle XP';

function isProgressionReward(row)
{
    return row.kind === SKILL_RANK_UP;
}

function cardRank(instance)
{
    const hasRank = Number.isInteger(instance?.rank) && instance.rank > 1;
    return hasRank
        ? instance.rank
        : 1;
}

function isReducedMotion()
{
    return document.body.classList.contains(REDUCED_MOTION_CLASS);
}

function pauseFor(milliseconds)
{
    return milliseconds > 0
        ? new Promise((resolve) => setTimeout(resolve, milliseconds))
        : Promise.resolve();
}

function victoryTitle(rewards)
{
    return rewards.title || translate(TITLE_VICTORY_ID);
}

function noteHtml(token)
{
    const text = escapeHtml(translate(`reward.note.${token}`));
    return `<p class="reward-note" data-note="${escapeHtml(token)}">${text}</p>`;
}

function skipButtonHtml(row, title)
{
    const label = escapeHtml(translate('reward.skip'));
    const aria = escapeHtml(translate('reward.skip.aria', { kind: title }));
    return `<button class="subtle reward-skip" data-skip="${escapeHtml(row.key)}"`
        + ` data-focusable="true" aria-label="${aria}">${label}</button>`;
}

function tooltipHtml(title, body = '')
{
    return `<div class="tt-title">${escapeHtml(title)}</div>${escapeHtml(body)}`;
}

function levelText(level)
{
    return `Level ${level}`;
}

function setOrDelete(target, key, value)
{
    if (value === undefined)
    {
        delete target[key];
    }
    else
    {
        target[key] = value;
    }
}

function replaceContents(target, source)
{
    for (const key of Object.keys(target))
    {
        delete target[key];
    }
    Object.assign(target, source);
}

function progressLabel(row)
{
    if (row.kind === 'character')
    {
        return translate('reward.progress.character');
    }
    if (row.kind === 'class')
    {
        return translate('reward.progress.classTrack', {
            class: row.label,
        });
    }
    return row.label;
}

function compactRowLabel(row)
{
    if (row.kind === 'power')
    {
        return POWER_ROW_LABEL;
    }
    if (row.kind === 'enemy')
    {
        const enemyName = row.name || translate('combat.log.role.enemy');
        return `${enemyName} · ${levelText(row.level || 1)}`;
    }
    return row.kind === 'bonus'
        ? BONUS_ROW_LABEL
        : BATTLE_ROW_LABEL;
}

export function MountRewards(appRoot, {
    registries,
    run,
    rewards,
    onDone,
    saves = null,
    rng = null,
    onPersist = null,
    checkpoint = null,
    onAllocateStat = null,
    receiptOnly = false,
})
{
    clearSelection();
    const plan = rewardPlan(rewards, {
        flaskSlotsFree: 0,
        armamentSlotsFree: 0,
    });

    function scopeProgress(value)
    {
        return receiptOnly
            ? scopeXpProgress(value)
            : value;
    }

    let progress = null;
    if (rewards.xpGains)
    {
        const gains = rewardProgress(registries, run, rewards.xpGains, { maxSkills: Infinity });
        progress = scopeProgress(gains);
    }
    const canLoadMeta = Boolean(saves && saves.loadMeta);
    const loadedSettings = canLoadMeta && (saves.loadMeta().settings || {});
    const settings = loadedSettings || {};
    const loadedMeta = canLoadMeta && saves.loadMeta();
    const meta = loadedMeta || {};
    let disarmContinue = null;
    let xpAnimationDone = !progress
        || !rewards.xpBefore
        || !orderedXpRows(progress).length
        || isReducedMotion();
    const animatedTracks = new Set();
    let receiptContinued = false;
    const stonesPaid = smithingStonesPaid(rewards.smithingStoneReceipt);
    const stoneStates = stonesPaid
        ? { smithingStone: STATE_TAKEN }
        : {};
    const states = {
        ...(checkpoint?.states || {}),
        ...stoneStates,
    };
    const chosenRankUps = { ...(checkpoint?.chosenRankUps || {}) };
    const pendingByKey = {};
    const pendingBonusByKey = {};
    let doorView = 0;
    const doorOwner = {};

    function persistProgress()
    {
        if (checkpoint)
        {
            checkpoint.states = { ...states };
            if (Object.keys(chosenRankUps).length || checkpoint.chosenRankUps !== undefined)
            {
                checkpoint.chosenRankUps = { ...chosenRankUps };
            }
        }
        if (onPersist && onPersist() === false)
        {
            throw new Error('Reward save was refused.');
        }
    }

    const applyByKind = {
        // Stones start Taken, so reaching this is a bug.
        smithingStone()
        {
            return false;
        },
        skillRankUp(row)
        {
            const instance = raiseCardRank(
                registries,
                run,
                row.skillId,
                row.instanceId,
                row.bonusStep || null,
            );
            if (!instance)
            {
                return false;
            }
            chosenRankUps[row.key] = instance.instanceId;
            return true;
        },
    };

    function ownedInstance(instanceId)
    {
        const owned = [...run.deck, ...(run.sideboard || [])];
        return owned.find((instance) => instance && instance.instanceId === instanceId) || null;
    }

    function skillLabel(skillId)
    {
        const skill = skillTracks(registries).find((track) => track.id === skillId);
        return (skill && skill.label) || skillId;
    }

    function snapshotBeforeTake(row)
    {
        if (row.kind !== SKILL_RANK_UP)
        {
            return null;
        }
        const raised = ownedInstance(row.instanceId);
        return {
            skills: structuredClone(run.skills || {}),
            rankUp: raised
                ? {
                    instance: raised,
                    rank: raised.rank,
                    steps: raised.upgradeSteps,
                    upgraded: raised.upgraded,
                    chosen: { ...chosenRankUps },
                }
                : null,
            checkpoint: checkpoint ? structuredClone(checkpoint) : null,
        };
    }

    function restoreSnapshot(row, snapshot)
    {
        run.skills = snapshot.skills;
        if (snapshot.rankUp)
        {
            const {
                instance,
                rank,
                steps,
                upgraded,
                chosen,
            } = snapshot.rankUp;
            setOrDelete(instance, 'rank', rank);
            setOrDelete(instance, 'upgradeSteps', steps);
            setOrDelete(instance, 'upgraded', upgraded);
            replaceContents(chosenRankUps, chosen);
        }
        delete states[row.key];
        if (checkpoint)
        {
            replaceContents(checkpoint, snapshot.checkpoint);
        }
    }

    function takeRow(row, focusKey)
    {
        if (states[row.key])
        {
            return false;
        }
        const snapshot = snapshotBeforeTake(row);
        if (!applyByKind[row.kind](row))
        {
            return false;
        }
        states[row.key] = STATE_TAKEN;
        try
        {
            persistProgress();
        }
        catch (error)
        {
            if (snapshot)
            {
                restoreSnapshot(row, snapshot);
            }
            throw error;
        }
        sfx.play(`rewardTake_${row.kind}`);
        renderMenu(focusKey || row.key);
        return true;
    }

    function rowBody(row)
    {
        const state = states[row.key];
        if (row.kind === SMITHING_STONE)
        {
            return smithingStoneRowCopy(row, translate);
        }
        if (row.kind !== SKILL_RANK_UP)
        {
            return {
                title: row.kind,
                body: '',
            };
        }
        const label = escapeHtml(skillLabel(row.skillId));
        const title = translate('reward.skillRankUp.title', {
            skill: label,
            level: row.level,
        });
        if (state === STATE_TAKEN)
        {
            const instance = ownedInstance(chosenRankUps[row.key]);
            const definition = instance && registries.cards.get(instance.cardId);
            const cardName = (definition && definition.name)
                || chosenRankUps[row.key]
                || '';
            return {
                title,
                body: translate('reward.skillRankUp.raised', {
                    name: escapeHtml(cardName),
                    rank: cardRank(instance),
                }),
            };
        }
        const hasCandidates = rankUpCandidates(registries, run, row.skillId).length > 0;
        const bodyId = hasCandidates
            ? 'reward.skillRankUp.body'
            : NONE_ID;
        return {
            title,
            body: translate(bodyId, { skill: label }),
        };
    }

    function statAllocationSection()
    {
        if (!receiptOnly)
        {
            return null;
        }
        return StatAllocationSection(registries, run, {
            settings,
            onAllocateStat,
            onChange: persistProgress,
        });
    }

    function isCurrentLayout(host)
    {
        return host?.isConnected && appRoot.querySelector(CLAIM_LAYOUT_SELECTOR) === host;
    }

    function setBarWidths(bar, width)
    {
        bar.querySelector('.rp-under').style.width = width;
        bar.querySelector('.rp-over').style.width = width;
    }

    async function playXpAnimation(host)
    {
        if (host.xpAnimationRunning)
        {
            return;
        }
        host.xpAnimationRunning = true;
        const bars = [...host.querySelectorAll('.rp-layered-bar[data-animate="1"]')];
        const requested = Number(settings.victoryXpSeconds);
        const seconds = Number.isFinite(requested) ? requested : DEFAULT_XP_SECONDS;
        const totalMilliseconds = isReducedMotion()
            ? 0
            : Math.max(0, Math.min(MAX_XP_MILLISECONDS, seconds * 1000));
        const durations = xpFillDurations(
            bars.map((bar) => ({
                from: Number(bar.dataset.old) / 100,
                to: Number(bar.dataset.target) / 100,
            })),
            totalMilliseconds,
        );
        for (const [index, bar] of bars.entries())
        {
            const duration = durations[index];
            const green = bar.querySelector('.rp-under');
            const yellow = bar.querySelector('.rp-over');
            if (!green || !yellow)
            {
                continue;
            }
            const target = `${bar.dataset.target}%`;
            if (duration > 0)
            {
                const transition = `width ${duration}ms linear`;
                bar.getBoundingClientRect();
                green.style.transition = transition;
                yellow.style.transition = transition;
                setBarWidths(bar, target);
                await pauseFor(duration);
                if (!isCurrentLayout(host))
                {
                    return;
                }
            }
            else
            {
                setBarWidths(bar, target);
            }
            animatedTracks.add(bar.dataset.track);
            if (Number(bar.dataset.target) >= 100)
            {
                bar.classList.add('rp-bar-ready');
            }
        }
        if (!isCurrentLayout(host))
        {
            return;
        }
        host.xpAnimationRunning = false;
        xpAnimationDone = true;
        refreshProgressView();
    }

    function openDoor(options)
    {
        doorView += 1;
        return MountRewardDoor(appRoot, {
            owner: doorOwner,
            ...options,
        });
    }

    function focusRewardTarget(focusKind)
    {
        return (focusKind && focusFirst(`.reward-kind[data-key="${focusKind}"]`))
            || focusFirst(UNLOCKED_ROW_SELECTOR)
            || focusFirst(CONTINUE_SELECTOR);
    }

    function buildFoot()
    {
        const continueButton = button({
            label: translate('reward.continue'),
            weight: 'primary',
            id: CONTINUE_ID,
            disabled: !xpAnimationDone,
            attrs: {
                'aria-describedby': HOLD_NOTE_ID,
                'data-confirm-ready': String(xpAnimationDone),
            },
        });
        const foot = modalFooter({
            note: holdNote(),
            primary: continueButton,
            className: 'reward-foot',
            size: FOOT_SIZE,
        });
        const note = foot.querySelector('.modal-foot-note');
        note.id = HOLD_NOTE_ID;
        note.setAttribute('aria-live', 'polite');
        return {
            continueButton,
            foot,
            note,
        };
    }

    function bindSkipButtons()
    {
        for (const skipButton of appRoot.querySelectorAll('[data-skip]'))
        {
            attachTooltip(skipButton, () =>
                tooltipHtml(
                    translateTip('reward.skip'),
                    translateFull('reward.skip'),
                ));
            skipButton.addEventListener('click', (event) =>
            {
                event.stopPropagation();
                states[skipButton.dataset.skip] = STATE_SKIPPED;
                persistProgress();
                renderMenu(skipButton.dataset.skip);
            });
        }
    }

    function armContinue(continueButton, note)
    {
        // Continue only leaves: a rank-up is owed by the player, never auto-taken.
        function finish()
        {
            if (!xpAnimationDone)
            {
                return;
            }
            onDone();
            disarmContinue?.();
            disarmContinue = null;
        }

        function leave()
        {
            if (!receiptOnly)
            {
                return finish();
            }
            if (receiptContinued || !xpAnimationDone)
            {
                return;
            }
            receiptContinued = true;
            try
            {
                finish();
            }
            catch (error)
            {
                receiptContinued = false;
                note.textContent = error.message;
            }
        }

        disarmContinue?.();
        disarmContinue = beatArmer(meta, registries)(continueButton, 'rewardContinue', {
            onConfirm: () =>
            {
                if (!hasUnclaimedReward())
                {
                    return leave();
                }
                OpenConfirmationModal({
                    title: translate('reward.leave.question'),
                    message: translate('reward.leave.message'),
                    confirmLabel: translate('reward.leave.confirm'),
                    cancelLabel: translate('reward.leave.take'),
                    returnFocusElement: continueButton,
                    onConfirm: leave,
                });
            },
        });
    }

    function renderMenu(focusKind = null)
    {
        const notesHtml = rewardNotes(rewards).map(noteHtml).join('');
        const rowsHtml = plan.rows.map(rowHtml).join('');
        const {
            continueButton,
            foot,
            note,
        } = buildFoot();
        const claim = rewardClaimStatus(plan, states);
        const hasRows = plan.rows.length > 0;
        const claimedStatus = hasRows
            ? buildElement('span', {
                class: 'as-status modal-head-status',
                text: translate('reward.status.claimed', {
                    claimed: claim.claimed,
                    total: claim.total,
                }),
            })
            : null;
        const cindersLine = receiptOnly && rewards.cinders
            ? buildElement('p', {
                class: 'spoils-line spoils-cinders',
                text: translate('reward.spoils.cinders', {
                    gained: rewards.cinders.gained,
                    total: rewards.cinders.total,
                }),
            })
            : null;
        const eyebrowId = hasRows
            ? 'reward.eyebrow.claim'
            : 'reward.eyebrow.spoils';
        openDoor({
            eyebrow: translate(eyebrowId),
            title: victoryTitle(rewards),
            status: claimedStatus,
            body: buildElement(
                'div',
                {
                    class: 'reward-claim-layout',
                    'aria-busy': String(!xpAnimationDone),
                },
                [
                    buildElement('div', {
                        class: 'class-row reward-menu',
                        html: rowsHtml + notesHtml,
                    }),
                    sideColumn(claim),
                    statAllocationSection(),
                    cindersLine,
                ],
            ),
            foot,
        });
        appRoot.querySelector(MENU_SELECTOR).inert = !xpAnimationDone;

        bindRows(appRoot);
        bindSkipButtons();
        attachTooltip(continueButton, () =>
            tooltipHtml(
                translate('reward.continue'),
                LEAVE_TOOLTIP_COPY,
            ));
        armContinue(continueButton, note);

        followUp(appRoot.querySelector(CLAIM_LAYOUT_SELECTOR));
        if (isEngaged())
        {
            setTimeout(() => focusRewardTarget(focusKind), 0);
        }
    }

    function rowHtml(row)
    {
        const state = states[row.key] || (row.blockedBy ? STATE_BLOCKED : STATE_PENDING);
        const { title, body } = rowBody(row);
        const isOffer = state === STATE_PENDING && isProgressionReward(row);
        const lockedClass = LOCKED_STATES.has(state) ? ' locked' : '';
        const offerClass = isOffer ? ' reward-level-offer' : '';
        const chipId = STATE_COPY_IDS[state];
        const chip = chipId
            ? `<span class="chip">${escapeHtml(translate(chipId))}</span>`
            : '';
        const skipHtml = state === STATE_BLOCKED
            ? skipButtonHtml(row, title)
            : '';
        const glyph = engravedIconHtml(KIND_GLYPHS[row.kind])
            || escapeHtml(uiIconText(KIND_GLYPHS[row.kind] || '?'));
        return `
      <div class="class-pick reward-kind${lockedClass}${offerClass}"
           data-kind="${escapeHtml(row.kind)}" data-key="${escapeHtml(row.key)}"
           data-state="${escapeHtml(state)}"
           data-blocked-by="${escapeHtml(row.blockedBy || '')}">
        <div class="glyph">${glyph}</div>
        <div class="cp-body">
          <h3>${escapeHtml(title)}</h3>
          <p>${body}</p>
          ${chip}
        </div>
        ${skipHtml}
      </div>`;
    }

    function bindRows(root)
    {
        for (const rowElement of root.querySelectorAll('.reward-kind'))
        {
            const row = plan.rows.find((candidate) => candidate.key === rowElement.dataset.key);
            const state = rowElement.dataset.state;
            attachTooltip(rowElement, () =>
            {
                if (state === STATE_BLOCKED)
                {
                    return tooltipHtml(
                        translateTip('reward.blocked.slots'),
                        translateFull('reward.blocked.slots'),
                    );
                }
                if (state === STATE_TAKEN)
                {
                    return tooltipHtml(translateTip('reward.state.taken'));
                }
                let offerId = 'reward.take';
                if (row.kind === SKILL_RANK_UP)
                {
                    offerId = row.choice ? 'reward.card.choose' : 'reward.card.take';
                }
                return tooltipHtml(translateTip(offerId), translateFull(offerId));
            });
            if (LOCKED_STATES.has(state))
            {
                continue;
            }
            rowElement.addEventListener('click', () =>
            {
                if (!xpAnimationDone)
                {
                    return;
                }
                if (row.kind === SKILL_RANK_UP)
                {
                    return renderChooser(row);
                }
                takeRow(row);
            });
        }
    }

    const hasUnclaimedReward = () => plan.rows.some((row) => !states[row.key] && !row.blockedBy);

    function holdNote()
    {
        if (receiptOnly)
        {
            return RECEIPT_HOLD_COPY;
        }
        const pendingRows = plan.rows.filter((row) => !states[row.key] && !row.blockedBy);
        if (pendingRows.some(isProgressionReward))
        {
            return UNFINISHED_HOLD_COPY;
        }
        const allResolved = plan.rows.every(
            (row) => states[row.key] === STATE_TAKEN || states[row.key] === STATE_SKIPPED,
        );
        return translate(allResolved ? 'reward.hold.complete' : 'reward.hold.leavesRest');
    }

    // The timer is bound to THIS layout: a render that replaces it strands the timer.
    function followUp(host)
    {
        if (!host || xpAnimationDone || !progress || !rewards.xpBefore)
        {
            return;
        }
        setTimeout(() =>
        {
            if (isCurrentLayout(host))
            {
                playXpAnimation(host);
            }
        }, 0);
    }

    function refreshProgressView()
    {
        const layout = appRoot.querySelector(CLAIM_LAYOUT_SELECTOR);
        const panel = layout?.querySelector('.reward-progress');
        const next = panel ? progressPanel() : null;
        if (!next)
        {
            renderMenu();
            return;
        }
        panel.after(next);
        panel.remove();
        const menu = layout.querySelector(MENU_SELECTOR);
        if (menu)
        {
            menu.inert = !xpAnimationDone;
        }
        layout.setAttribute('aria-busy', String(!xpAnimationDone));
        const continueButton = appRoot.querySelector(CONTINUE_SELECTOR);
        if (continueButton)
        {
            continueButton.disabled = !xpAnimationDone;
            continueButton.dataset.confirmReady = String(xpAnimationDone);
        }
        const note = appRoot.querySelector(`#${HOLD_NOTE_ID}`);
        if (note)
        {
            note.textContent = holdNote();
        }
        const focused = document.activeElement;
        if (isEngaged() && (!focused || focused === document.body || !focused.isConnected))
        {
            focusRewardTarget(null);
        }
        followUp(layout);
    }

    function sideColumn(claim)
    {
        const progression = progressPanel();
        const claimPanel = !progression && plan.rows.length
            ? claimStatusPanel(claim)
            : null;
        const children = [progression, claimPanel].filter(Boolean);
        return children.length
            ? buildElement('div', { class: 'reward-side' }, children)
            : null;
    }

    function progressRow(row, label)
    {
        let nextText = translate('reward.progress.next', { level: row.level + 1 });
        if (row.capped)
        {
            nextText = translate('reward.progress.capped');
        }
        else if (row.kind === 'character')
        {
            nextText = levelText(row.level + 1);
        }
        const nextLevel = buildElement('span', {
            class: 'rp-next',
            text: nextText,
        });
        const targetPercent = row.fraction * 100;
        const before = row.kind === 'character'
            ? rewards.xpBefore?.character
            : rewards.xpBefore?.tracks?.[row.id];
        const startPercent = before && before.level === row.level && row.xpToNext
            ? Math.max(0, Math.min(100, before.xp / row.xpToNext * 100))
            : 0;
        const animate = !xpAnimationDone
            && row.gained > 0
            && !!before
            && !animatedTracks.has(row.id);
        const under = buildElement('span', { class: 'rp-under' });
        const over = buildElement('span', { class: 'rp-over' });
        const shownPercent = animate
            ? startPercent
            : targetPercent;
        under.style.width = `${shownPercent}%`;
        over.style.width = `${shownPercent}%`;
        const xpTotal = row.xpToNext || row.xp;
        const xpShown = Math.min(row.xp, xpTotal);
        const readyClass = !animate && row.fraction >= 1
            ? ' rp-bar-ready'
            : '';
        const bar = buildElement(
            'div',
            {
                class: `rp-bar rp-layered-bar${readyClass}`,
                role: 'progressbar',
                'aria-valuemin': '0',
                'aria-valuemax': String(row.xpToNext || 0),
                'aria-valuenow': String(xpShown),
                'aria-label': `${label}: ${xpShown} / ${xpTotal} XP`,
                dataset: {
                    animate: animate ? '1' : '0',
                    target: String(targetPercent),
                    old: String(startPercent),
                    track: row.id,
                    kind: row.kind,
                },
            },
            [
                under,
                over,
                buildElement('span', {
                    class: 'rp-bar-text',
                    text: `${xpShown} / ${xpTotal}`,
                }),
            ],
        );
        const levelNow = row.kind === 'character'
            ? levelText(row.level)
            : translate('reward.progress.level', { level: row.level });
        const gainedNode = row.gained
            ? buildElement('span', {
                class: 'rp-gain',
                text: translate('reward.progress.gained', { xp: row.gained }),
            })
            : null;
        const discardedNode = row.discarded
            ? buildElement('span', {
                class: 'rp-discarded',
                title: translateFull('reward.progress.discarded', { xp: row.discarded }),
                text: translate('reward.progress.discarded', { xp: row.discarded }),
            })
            : null;
        const node = buildElement(
            'li',
            {
                class: 'reward-progress-row',
                dataset: {
                    kind: row.kind,
                    track: row.id,
                    gained: String(row.gained),
                },
            },
            [
                buildElement('span', {
                    class: 'rp-name',
                    text: label,
                }),
                buildElement('span', {
                    class: 'rp-level',
                    text: levelNow,
                }),
                bar,
                nextLevel,
                gainedNode,
                discardedNode,
            ],
        );
        attachTooltip(node, () =>
        {
            const detail = row.capped
                ? translateFull('reward.progress.capped')
                : translateFull('reward.progress.xp', {
                    xp: Math.min(row.xp, row.xpToNext),
                    next: row.xpToNext,
                    level: row.level + 1,
                });
            return tooltipHtml(label, detail);
        });
        return node;
    }

    function progressPanel()
    {
        if (!progress || (!progress.character && !progress.skills.length))
        {
            return null;
        }
        const rows = orderedXpRows(progress).map((row) => progressRow(row, progressLabel(row)));
        return buildElement(
            'section',
            {
                class: 'reward-progress',
                'aria-label': translate('reward.progress.heading'),
                'aria-busy': String(!xpAnimationDone),
            },
            [
                buildElement('h3', {
                    class: 'as-eyebrow',
                    text: translate('reward.progress.heading'),
                }),
                buildElement('ul', { class: 'reward-progress-list' }, rows),
            ],
        );
    }

    function claimStatusPanel(claim)
    {
        const lines = claim.rows.map((entry) =>
        {
            const stateId = entry.state === STATE_BLOCKED
                ? 'reward.claim.blocked'
                : `reward.state.${entry.state}`;
            const entryRow = plan.rows.find((row) => row.key === entry.key);
            return buildElement(
                'li',
                {
                    class: 'reward-claim-row',
                    dataset: {
                        kind: entry.kind,
                        key: entry.key,
                        state: entry.state,
                    },
                },
                [
                    buildElement('span', {
                        class: 'reward-claim-name',
                        text: rowBody(entryRow).title,
                    }),
                    buildElement('span', {
                        class: 'reward-claim-state',
                        text: translate(stateId),
                    }),
                ],
            );
        });
        const required = claim.requiredChoice
            ? buildElement(
                'p',
                {
                    class: 'reward-claim-required',
                    dataset: { required: claim.requiredChoice.kind },
                },
                [
                    buildElement('span', {
                        class: 'as-eyebrow',
                        text: translate('reward.claim.required'),
                    }),
                    buildElement('span', {
                        text: translate('reward.card.chooseOne', {
                            count: claim.requiredChoice.count,
                        }),
                    }),
                ],
            )
            : null;
        return buildElement(
            'aside',
            {
                class: 'reward-claim-status',
                'aria-label': translate('reward.claim.heading'),
            },
            [
                buildElement('h3', {
                    class: 'as-eyebrow',
                    text: translate('reward.claim.heading'),
                }),
                buildElement('ul', { class: 'reward-claim-list' }, lines),
                required,
            ],
        );
    }

    function renderChooser(row)
    {
        const isTaken = () => states[row.key];
        const rankUpCards = rankUpCandidates(registries, run, row.skillId);
        let selectedCardId = pendingByKey[row.key] || null;
        let confirming = false;
        let reviewing = false;
        const inspectionFaces = new Map();
        const backButton = button({
            label: translate('common.skip'),
            className: 'danger',
            id: 'reward-back',
            attrs: { 'data-back': '' },
        });
        const confirmButton = button({
            label: translate('reward.confirm'),
            weight: 'primary',
            id: CONFIRM_BUTTON_ID,
            className: 'reward-confirm',
            disabled: true,
        });
        const inspectButton = button({
            label: translate(INSPECT_LABEL_ID),
            id: INSPECT_BUTTON_ID,
            disabled: true,
            attrs: { 'aria-label': translate(INSPECT_LABEL_ID) },
        });
        inspectButton.addEventListener('click', () =>
        {
            if (!confirming && !isTaken())
            {
                openBoundCardInspection(inspectionFaces.get(selectedCardId), inspectButton);
            }
        });
        openDoor({
            eyebrow: rowBody(row).title,
            title: victoryTitle(rewards),
            body: buildElement('div', {
                class: 'reward-row',
                role: 'radiogroup',
                'aria-label': translate('reward.card.aria'),
            }),
            foot: modalFooter({
                secondary: [backButton, inspectButton],
                primary: confirmButton,
                className: 'reward-foot reward-chooser-foot',
                size: FOOT_SIZE,
            }),
        });
        const strip = appRoot.querySelector(CHOOSER_STRIP_SELECTOR);
        const message = buildElement('p', {
            role: 'status',
            class: 'reward-confirm-status',
            hidden: true,
        });
        strip.after(message);

        function bonusOptionsOf(instanceId)
        {
            if (!instanceId)
            {
                return [];
            }
            return rankUpBonusOptions(registries, run, ownedInstance(instanceId));
        }

        function needsBonus()
        {
            return !!selectedCardId
                && bonusOptionsOf(selectedCardId).length > 0
                && !(pendingBonusByKey[row.key] >= 0);
        }

        // A press in flight is a beat, not a reason, so it stays quiet.
        const confirmReason = reasonWhenDisabled(confirmButton, () =>
        {
            if (!selectedCardId)
            {
                return translate('reward.confirm.reason');
            }
            return needsBonus() ? translate('reward.rankBonus.reason') : null;
        });
        const bonusPanel = buildElement('div', {
            class: 'reward-rank-bonus',
            role: 'radiogroup',
            'aria-label': translate('reward.rankBonus.label'),
            hidden: true,
        });
        strip.after(bonusPanel);

        function faceOf(instance)
        {
            return projectGameCard(run, instance) || resolveCard(registries, instance);
        }

        function syncActionButtons()
        {
            inspectButton.disabled = !inspectionFaces.has(selectedCardId);
            confirmReason();
        }

        function renderBonusPanel()
        {
            bonusPanel.replaceChildren();
            const options = bonusOptionsOf(selectedCardId);
            bonusPanel.hidden = !options.length;
            if (!options.length)
            {
                return;
            }
            const instance = ownedInstance(selectedCardId);
            const risenInstance = {
                ...instance,
                rank: cardRank(instance) + 1,
            };
            const before = faceOf(risenInstance);
            bonusPanel.appendChild(buildElement('p', {
                class: 'reward-rank-bonus-title',
                text: translate('reward.rankBonus.label'),
            }));
            options.forEach((option, index) =>
            {
                const changes = cardUpgradeChanges(registries, before, faceOf(option.after));
                const changeText = changes
                    .map((change) => `${change.label} ${change.before}${ARROW}${change.after}`)
                    .join(', ');
                const summary = changeText || translate('reward.rankBonus.option', {
                    n: index + 1,
                });
                const chosen = pendingBonusByKey[row.key] === index;
                const chosenClass = chosen
                    ? ` ${CHOSEN_CLASS}`
                    : '';
                const choice = button({
                    label: summary,
                    className: `class-pick reward-bonus-option${chosenClass}`,
                    attrs: {
                        role: 'radio',
                        'aria-checked': String(chosen),
                        'aria-label': translate('cardUpgrade.option.aria', {
                            n: index + 1,
                            total: options.length,
                            summary,
                        }),
                        dataset: {
                            bonusIndex: String(index),
                        },
                    },
                });
                choice.addEventListener('click', () => selectBonus(index));
                bonusPanel.appendChild(choice);
            });
        }

        function selectBonus(index)
        {
            if (reviewing || confirming || isTaken() || !(index >= 0))
            {
                return;
            }
            pendingBonusByKey[row.key] = index;
            const previousNode = [...strip.children]
                .find((node) => node.dataset?.pickId === selectedCardId);
            const instance = ownedInstance(selectedCardId);
            if (previousNode && instance)
            {
                previousNode.replaceWith(rankUpFace(instance));
            }
            renderBonusPanel();
            confirmButton.disabled = false;
            syncActionButtons();
        }

        function markPicks(cardId)
        {
            // Found by class, not attribute: the test DOM keeps dataset as a plain object.
            for (const candidate of strip.querySelectorAll('.reward-pick'))
            {
                const selected = candidate.dataset.pickId === cardId;
                // A text button wears the green trim only, so one option reads as one lit card.
                if (!candidate.classList.contains('reward-choice-button'))
                {
                    candidate.classList.toggle(SELECTED_CLASS, selected);
                }
                candidate.classList.toggle(CHOSEN_CLASS, selected);
                candidate.setAttribute('aria-checked', String(selected));
            }
            for (const face of strip.querySelectorAll('.reward-choice-face'))
            {
                const selected = face.dataset.pickId === cardId;
                face.classList.toggle(SELECTED_CLASS, selected);
                face.classList.toggle(CHOSEN_CLASS, selected);
            }
        }

        function selectCard(cardId)
        {
            if (reviewing || confirming || isTaken())
            {
                return;
            }
            const previous = selectedCardId;
            if (previous !== cardId)
            {
                delete pendingBonusByKey[row.key];
            }
            selectedCardId = cardId;
            pendingByKey[row.key] = cardId;
            markPicks(cardId);
            // The card just left goes back to plain rank-up; the new one waits for a bonus pick.
            const left = previous && previous !== cardId
                ? rankUpCards.find((instance) => instance.instanceId === previous)
                : null;
            const leftNode = left
                ? [...strip.children].find((node) => node.dataset?.pickId === previous)
                : null;
            if (leftNode)
            {
                leftNode.replaceWith(rankUpFace(left));
            }
            renderBonusPanel();
            confirmButton.disabled = needsBonus();
            syncActionButtons();
            message.hidden = true;
        }

        function rankUpFace(instance)
        {
            const isSelected = instance.instanceId === selectedCardId;
            const option = isSelected
                ? bonusOptionsOf(instance.instanceId)[pendingBonusByKey[row.key]]
                : null;
            const shown = option
                ? option.after
                : {
                    ...instance,
                    rank: cardRank(instance) + 1,
                };
            const face = renderCard(
                registries,
                shown,
                {
                    rules: run,
                    owned: ownedCopies(run, instance.cardId),
                    actionOwnsTouch: true,
                    surface: 'reward',
                    only: [],
                },
            );
            face.dataset.cardId = instance.cardId;
            face.dataset.pickId = instance.instanceId;
            inspectionFaces.set(instance.instanceId, face);
            face.classList.add('reward-pick');
            face.setAttribute('role', 'radio');
            face.setAttribute('aria-checked', String(isSelected));
            face.classList.toggle(SELECTED_CLASS, isSelected);
            face.classList.toggle(CHOSEN_CLASS, isSelected);
            face.addEventListener('click', () => selectCard(instance.instanceId));
            return face;
        }

        for (const instance of rankUpCards)
        {
            strip.appendChild(rankUpFace(instance));
        }
        renderBonusPanel();
        if (!rankUpCards.length)
        {
            strip.appendChild(buildElement('p', {
                class: 'reward-rank-none',
                text: translate(NONE_ID, { skill: skillLabel(row.skillId) }),
            }));
        }
        confirmButton.disabled = !selectedCardId || needsBonus();
        syncActionButtons();

        // Confirm stages a review only; Continue is the sole persistence door.
        function commitSelection()
        {
            if (!selectedCardId || confirming || isTaken())
            {
                return;
            }
            confirming = true;
            inspectButton.disabled = true;
            strip.inert = true;
            confirmButton.disabled = true;
            try
            {
                const bonusStep = bonusOptionsOf(selectedCardId)[pendingBonusByKey[row.key]]?.step;
                const taking = {
                    ...row,
                    ...(bonusStep ? { bonusStep } : {}),
                    instanceId: selectedCardId,
                };
                if (takeRow(taking, row.key))
                {
                    return;
                }
                message.textContent = translate('reward.skillRankUp.spent');
            }
            catch
            {
                message.textContent = translate(SAVE_FAILED_ID);
            }
            message.hidden = false;
            confirming = false;
            inspectButton.disabled = !inspectionFaces.has(selectedCardId);
            strip.inert = false;
            confirmButton.disabled = false;
        }

        function enterReview()
        {
            reviewing = true;
            confirmButton.textContent = translate(CONTINUE_LABEL_ID);
            backButton.textContent = translate('common.back');
            strip.setAttribute('aria-label', translate('reward.confirm'));
            for (const option of strip.children)
            {
                option.hidden = !option.matches(`.${SELECTED_CLASS}`)
                    && !option.querySelector(`.${SELECTED_CLASS}`)
                    && option.dataset.pickId !== selectedCardId;
            }
            for (const control of strip.querySelectorAll('button.reward-pick'))
            {
                control.disabled = true;
            }
            for (const control of bonusPanel.querySelectorAll('button'))
            {
                control.disabled = true;
            }
        }

        confirmButton.addEventListener('click', () =>
        {
            if (!selectedCardId || confirming || isTaken())
            {
                return;
            }
            if (reviewing)
            {
                return commitSelection();
            }
            enterReview();
        });
        backButton.addEventListener('click', () =>
        {
            if (confirming || isTaken())
            {
                return;
            }
            if (reviewing)
            {
                return renderChooser(row);
            }
            states[row.key] = STATE_SKIPPED;
            try
            {
                persistProgress();
            }
            catch
            {
                delete states[row.key];
                if (checkpoint)
                {
                    checkpoint.states = { ...states };
                }
                message.textContent = translate(SAVE_FAILED_ID);
                message.hidden = false;
                return;
            }
            renderMenu(row.key);
        });
        if (isEngaged())
        {
            setTimeout(
                () => focusFirst('.reward-row .reward-pick') || focusFirst('#reward-back'),
                0,
            );
        }
    }

    function expandVictory()
    {
        if (checkpoint)
        {
            checkpoint.expanded = true;
        }
        persistProgress();
        renderMenu();
    }

    function compactReceiptRows()
    {
        const paidLevel = Number(rewards.xpGains?.level) || 0;
        const total = Math.max(0, Math.floor(paidLevel));
        const savedRows = rewards.xpReceipt?.rows;
        const isItemized = Array.isArray(savedRows)
            && savedRows.every((row) => Number.isSafeInteger(row.amount))
            && savedRows.reduce((sum, row) => sum + row.amount, 0) === total;
        return isItemized
            ? savedRows
            : [
                {
                    kind: 'legacy',
                    amount: total,
                },
            ];
    }

    function renderCompactVictory()
    {
        const rows = compactReceiptRows();
        const options = victoryXpPresentation(settings, isReducedMotion());
        const timing = victoryXpTiming(rows.length, options);
        const openButton = button({
            label: translate(CONTINUE_LABEL_ID),
            weight: 'primary',
            id: 'reward-expand',
            className: 'reward-compact-continue',
            disabled: true,
        });
        const formula = buildElement('span', { class: 'reward-compact-formula' });
        const moreButton = buildElement('button', {
            class: 'reward-compact-more',
            type: 'button',
            text: MORE_LABEL,
            'aria-label': translate('reward.xp.more.aria'),
        });
        moreButton.hidden = true;
        const arithmetic = buildElement(
            'span',
            { class: 'reward-compact-arithmetic' },
            [
                formula,
                moreButton,
            ],
        );
        const value = buildElement('strong', {
            class: 'reward-compact-value',
            text: translate('reward.xp.zero'),
            'aria-live': 'polite',
        });
        const summary = buildElement('div', { class: 'reward-compact-summary' }, [
            buildElement('span', {
                class: 'reward-compact-heading',
                text: translate('reward.xp.total'),
            }),
            arithmetic,
            value,
        ]);
        const rowList = buildElement('ol', {
            class: 'reward-compact-list',
            'aria-label': translate('reward.xp.list.aria'),
        });
        rowList.style.setProperty('--receipt-rows', String(options.visibleRows));
        const modal = openDoor({
            eyebrow: '',
            title: victoryTitle(rewards),
            attrs: {
                dataset: {
                    size: 'sm',
                    victoryCompact: 'true',
                },
            },
            body: buildElement('div', { class: 'reward-compact-xp' }, [summary, rowList]),
            foot: modalFooter({
                primary: openButton,
                className: 'reward-foot',
                size: FOOT_SIZE,
            }),
        });

        function fullCalculation()
        {
            const { full } = victoryXpFormula(rows, rows.length, options.formulaTerms);
            return `<div class="tt-title">${FULL_CALCULATION_TITLE}</div>`
                + `<div>${escapeHtml(full)}</div>`;
        }

        const tooltipPlacement = {
            intent: 'above',
            align: 'end',
            clear: modal,
            appearance: {
                maxWidthRem: 30,
                maxHeightRatio: 0.5,
            },
        };
        attachTooltip(moreButton, fullCalculation, tooltipPlacement);
        moreButton.addEventListener('click', () =>
        {
            showTooltipFor(moreButton, fullCalculation(), tooltipPlacement);
        });
        let ready = false;
        let shown = 0;
        const viewAtMount = doorView;

        function isActive()
        {
            return modal.isConnected
                && doorView === viewAtMount
                && appRoot.querySelector('.reward-door') === modal;
        }

        function updateFormula()
        {
            const expression = victoryXpFormula(rows, shown, options.formulaTerms);
            formula.textContent = expression.shown;
            moreButton.hidden = !expression.collapsed;
        }

        function addRow(row)
        {
            const amount = buildElement('strong', {
                class: 'reward-compact-row-value',
                text: '+0',
            });
            const item = buildElement('li', { class: 'reward-compact-row' }, [
                buildElement('span', {
                    class: 'reward-compact-row-label',
                    text: compactRowLabel(row),
                }),
                amount,
            ]);
            rowList.appendChild(item);
            rowList.scrollTop = rowList.scrollHeight;
            return amount;
        }

        function armExpand()
        {
            if (!isActive())
            {
                return;
            }
            ready = true;
            openButton.disabled = false;
            openButton.classList.add('is-ready');
            if (settings.victorySummaryMode === 'auto')
            {
                expandVictory();
            }
        }

        function countUp(from, to, milliseconds, renderValue)
        {
            return new Promise((resolve) =>
            {
                if (milliseconds <= 0)
                {
                    renderValue(to);
                    resolve();
                    return;
                }
                const start = performance.now();
                const frame = (now) =>
                {
                    if (!isActive())
                    {
                        resolve();
                        return;
                    }
                    const fraction = Math.min(1, (now - start) / milliseconds);
                    renderValue(from + Math.round((to - from) * fraction));
                    if (fraction >= 1)
                    {
                        resolve();
                    }
                    else
                    {
                        requestAnimationFrame(frame);
                    }
                };
                requestAnimationFrame(frame);
            });
        }

        function showRow(row, running)
        {
            const amount = addRow(row);
            return (next) =>
            {
                const sign = next < 0
                    ? MINUS
                    : '+';
                amount.textContent = `${sign}${Math.abs(next)}`;
                value.textContent = `${running + next} XP`;
            };
        }

        async function playRows()
        {
            let running = 0;
            for (const [index, row] of rows.entries())
            {
                if (!isActive())
                {
                    return;
                }
                await countUp(0, row.amount, timing.tickMs, showRow(row, running));
                if (!isActive())
                {
                    return;
                }
                running += row.amount;
                shown = index + 1;
                updateFormula();
                if (index < rows.length - 1)
                {
                    await pauseFor(timing.pauseMs);
                }
            }
            await pauseFor(options.readyMs);
            armExpand();
        }

        if (options.totalMs === 0)
        {
            let running = 0;
            for (const row of rows)
            {
                showRow(row, running)(row.amount);
                running += row.amount;
                shown += 1;
            }
            updateFormula();
            if (options.readyMs === 0)
            {
                armExpand();
            }
            else
            {
                setTimeout(armExpand, options.readyMs);
            }
        }
        else
        {
            playRows();
        }
        openButton.addEventListener('click', () =>
        {
            if (ready)
            {
                expandVictory();
            }
        });
        if (settings.victorySummaryMode === 'anywhere')
        {
            appRoot.querySelector('.reward-veil')?.addEventListener('click', (event) =>
            {
                const onControl = event.target === openButton
                    || event.target === moreButton;
                if (ready && isActive() && !onControl)
                {
                    expandVictory();
                }
            });
        }
    }

    sfx.play('victory');
    if (receiptOnly)
    {
        renderMenu();
    }
    else if (checkpoint?.expanded)
    {
        expandVictory();
    }
    else if (!checkpoint?.source || !rewards.xpGains)
    {
        renderMenu();
    }
    else
    {
        renderCompactVictory();
    }
}
