import { OwnCardRank } from '../../model/cardRank.js';
import { uiIconText } from '../../content/uiIcons.js';
import { LevelUpPointsButton } from '../components/progressionCards.js';
import { engravedIconHtml } from '../components/engravedIcon.js';
import { MountRewardDoor } from '../components/rewardDoor.js';
import { renderCard } from '../components/card.js';
import { openBoundCardInspection } from '../components/cardInspection.js';
import { esc as escapeHtml, attachTooltip, showTooltipFor } from '../components/tooltip.js';
import { sfx } from '../sfx.js';
import { MarkSelected } from '../selection.js';
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
import { cardUpgradeChanges, RankUpUpgradeModel } from '../models/CardUpgradeModel.js';
import { MountCardUpgradeModal } from '../components/cardUpgradeModal.js';
import { projectGameCard } from '../../model/gameProfile.js';
import { resolveCard } from '../../model/registries.js';
import { clearSelection } from '../components/cardSelection.js';
import { ownedCopies } from '../../model/deckRules.js';

const DEFAULT_XP_SECONDS = 3;
const MAX_XP_MILLISECONDS = 12000;

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
const PROGRESS_PANEL_SELECTOR = '.reward-progress';
const ANIMATED_BAR_SELECTOR = '.rp-layered-bar[data-animate="1"]';
const UNDER_FILL_SELECTOR = '.rp-under';
const OVER_FILL_SELECTOR = '.rp-over';
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

// The card's own rank, 0 when unranked, so a rank-up preview shows what skills.raiseCardRank commits (owner, 2026-11-23).
function readCardRank(instance)
{
    return OwnCardRank(instance);
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

function readVictoryTitle(rewards)
{
    return rewards.title || translate(TITLE_VICTORY_ID);
}

function rewardNoteHtml(token)
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

function formatLevel(level)
{
    return `Level ${level}`;
}

function setOrDeleteKey(target, key, value)
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

function replaceObjectContents(target, source)
{
    for (const key of Object.keys(target))
    {
        delete target[key];
    }
    Object.assign(target, source);
}

function readProgressLabel(row)
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

function readCompactRowLabel(row)
{
    if (row.kind === 'power')
    {
        return POWER_ROW_LABEL;
    }
    if (row.kind === 'enemy')
    {
        const enemyName = row.name || translate('combat.log.role.enemy');
        return `${enemyName} · ${formatLevel(row.level || 1)}`;
    }
    return row.kind === 'bonus'
        ? BONUS_ROW_LABEL
        : BATTLE_ROW_LABEL;
}

function readOfferCopyId(row)
{
    if (row.kind !== SKILL_RANK_UP)
    {
        return 'reward.take';
    }
    return row.choice
        ? 'reward.card.choose'
        : 'reward.card.take';
}

function setBarWidths(bar, width)
{
    bar.querySelector(UNDER_FILL_SELECTOR).style.width = width;
    bar.querySelector(OVER_FILL_SELECTOR).style.width = width;
}

function hasBothFills(bar)
{
    return Boolean(bar.querySelector(UNDER_FILL_SELECTOR))
        && Boolean(bar.querySelector(OVER_FILL_SELECTOR));
}

function startBarFill(bar, duration, targetWidth)
{
    const transition = `width ${duration}ms linear`;
    bar.getBoundingClientRect();
    bar.querySelector(UNDER_FILL_SELECTOR).style.transition = transition;
    bar.querySelector(OVER_FILL_SELECTOR).style.transition = transition;
    setBarWidths(bar, targetWidth);
}

function readBarDurations(bars, totalMilliseconds)
{
    return xpFillDurations(
        bars.map((bar) => ({
            from: Number(bar.dataset.old) / 100,
            to: Number(bar.dataset.target) / 100,
        })),
        totalMilliseconds,
    );
}

function readStartPercent(row, xpBefore)
{
    const startsOnThisLevel = xpBefore
        && xpBefore.level === row.level
        && row.xpToNext;
    return startsOnThisLevel
        ? Math.max(0, Math.min(100, xpBefore.xp / row.xpToNext * 100))
        : 0;
}

function buildNextLevelLabel(row)
{
    let nextText = translate('reward.progress.next', { level: row.level + 1 });
    if (row.capped)
    {
        nextText = translate('reward.progress.capped');
    }
    else if (row.kind === 'character')
    {
        nextText = formatLevel(row.level + 1);
    }
    return buildElement('span', {
        class: 'rp-next',
        text: nextText,
    });
}

function buildProgressBar(row, label, fill)
{
    const under = buildElement('span', { class: 'rp-under' });
    const over = buildElement('span', { class: 'rp-over' });
    const shownPercent = fill.animate
        ? fill.startPercent
        : fill.targetPercent;
    under.style.width = `${shownPercent}%`;
    over.style.width = `${shownPercent}%`;
    const xpTotal = row.xpToNext || row.xp;
    const xpShown = Math.min(row.xp, xpTotal);
    const isFullAtRest = !fill.animate
        && row.fraction >= 1;
    const readyClass = isFullAtRest
        ? ' rp-bar-ready'
        : '';
    return buildElement(
        'div',
        {
            class: `rp-bar rp-layered-bar${readyClass}`,
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': String(row.xpToNext || 0),
            'aria-valuenow': String(xpShown),
            'aria-label': `${label}: ${xpShown} / ${xpTotal} XP`,
            dataset: {
                animate: fill.animate ? '1' : '0',
                target: String(fill.targetPercent),
                old: String(fill.startPercent),
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
}

function readLevelNowText(row)
{
    return row.kind === 'character'
        ? formatLevel(row.level)
        : translate('reward.progress.level', { level: row.level });
}

function buildGainedNode(row)
{
    return row.gained
        ? buildElement('span', {
            class: 'rp-gain',
            text: translate('reward.progress.gained', { xp: row.gained }),
        })
        : null;
}

function buildDiscardedNode(row)
{
    return row.discarded
        ? buildElement('span', {
            class: 'rp-discarded',
            title: translateFull('reward.progress.discarded', { xp: row.discarded }),
            text: translate('reward.progress.discarded', { xp: row.discarded }),
        })
        : null;
}

function attachProgressTooltip(rowNode, row, label)
{
    attachTooltip(rowNode, () =>
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
}

function buildRequiredChoice(claim)
{
    if (!claim.requiredChoice)
    {
        return null;
    }
    return buildElement(
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
    );
}

function buildChooserBackButton()
{
    return button({
        label: translate('common.skip'),
        className: 'danger',
        id: 'reward-back',
        attrs: { 'data-back': '' },
    });
}

function buildChooserConfirmButton()
{
    return button({
        label: translate('reward.confirm'),
        weight: 'primary',
        id: CONFIRM_BUTTON_ID,
        className: 'reward-confirm',
        disabled: true,
    });
}

function buildInspectButton()
{
    return button({
        label: translate(INSPECT_LABEL_ID),
        id: INSPECT_BUTTON_ID,
        disabled: true,
        attrs: { 'aria-label': translate(INSPECT_LABEL_ID) },
    });
}

function buildConfirmStatusMessage()
{
    return buildElement('p', {
        role: 'status',
        class: 'reward-confirm-status',
        hidden: true,
    });
}

function buildRankBonusPanel()
{
    return buildElement('div', {
        class: 'reward-rank-bonus',
        role: 'radiogroup',
        'aria-label': translate('reward.rankBonus.label'),
        hidden: true,
    });
}

function describeBonusChanges(changes)
{
    return changes
        .map((change) => `${change.label} ${change.before}${ARROW}${change.after}`)
        .join(', ');
}

function buildCompactReceiptView(presentation)
{
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
    const totalValue = buildElement('strong', {
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
        totalValue,
    ]);
    const rowList = buildElement('ol', {
        class: 'reward-compact-list',
        'aria-label': translate('reward.xp.list.aria'),
    });
    rowList.style.setProperty('--receipt-rows', String(presentation.visibleRows));
    return {
        openButton,
        formula,
        moreButton,
        totalValue,
        summary,
        rowList,
    };
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
    const xpProgress = readXpProgress();
    const canLoadMeta = Boolean(saves?.loadMeta);
    const settings = readSavedSettings();
    const meta = readSavedMeta();
    let disarmContinue = null;
    let xpAnimationDone = !xpProgress
        || !rewards.xpBefore
        || !orderedXpRows(xpProgress).length
        || isReducedMotion();
    const animatedTracks = new Set();
    let receiptContinued = false;
    const stonesPaid = smithingStonesPaid(rewards.smithingStoneReceipt);
    const paidStoneStates = stonesPaid
        ? { smithingStone: STATE_TAKEN }
        : {};
    const states = {
        ...(checkpoint?.states || {}),
        ...paidStoneStates,
    };
    const chosenRankUps = { ...(checkpoint?.chosenRankUps || {}) };
    const pendingCardIdByKey = {};
    const pendingBonusIndexByKey = {};
    let doorOpenCount = 0;
    const doorOwner = {};
    const applyRewardByKind = {
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
    const hasUnclaimedReward = () =>
        plan.rows.some((row) =>
            !states[row.key]
            && !row.blockedBy
        );

    playVictoryAndOpenFirstScreen();

    function readXpProgress()
    {
        if (!rewards.xpGains)
        {
            return null;
        }
        const gains = rewardProgress(registries, run, rewards.xpGains, { maxSkills: Infinity });
        return receiptOnly
            ? scopeXpProgress(gains)
            : gains;
    }

    function readSavedSettings()
    {
        if (!canLoadMeta)
        {
            return {};
        }
        return saves.loadMeta().settings || {};
    }

    function readSavedMeta()
    {
        if (!canLoadMeta)
        {
            return {};
        }
        return saves.loadMeta() || {};
    }

    function playVictoryAndOpenFirstScreen()
    {
        sfx.play('victory');
        if (receiptOnly)
        {
            renderMenu();
        }
        else if (checkpoint?.expanded)
        {
            expandVictory();
        }
        else if (
            !checkpoint?.source
            || !rewards.xpGains
        )
        {
            renderMenu();
        }
        else
        {
            renderCompactVictory();
        }
    }

    function openDoor(doorOptions)
    {
        doorOpenCount += 1;
        return MountRewardDoor(appRoot, {
            owner: doorOwner,
            ...doorOptions,
        });
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

    function persistProgress()
    {
        if (checkpoint)
        {
            checkpoint.states = { ...states };
            if (
                Object.keys(chosenRankUps).length
                || checkpoint.chosenRankUps !== undefined
            )
            {
                checkpoint.chosenRankUps = { ...chosenRankUps };
            }
        }
        if (
            onPersist
            && onPersist() === false
        )
        {
            throw new Error('Reward save was refused.');
        }
    }

    function findOwnedInstance(instanceId)
    {
        const owned = [...run.deck, ...(run.sideboard || [])];
        return owned.find((instance) =>
            instance
            && instance.instanceId === instanceId
        ) || null;
    }

    function readSkillLabel(skillId)
    {
        const skill = skillTracks(registries).find((track) => track.id === skillId);
        return skill?.label || skillId;
    }

    function snapshotBeforeTaking(row)
    {
        if (row.kind !== SKILL_RANK_UP)
        {
            return null;
        }
        const raised = findOwnedInstance(row.instanceId);
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
            setOrDeleteKey(instance, 'rank', rank);
            setOrDeleteKey(instance, 'upgradeSteps', steps);
            setOrDeleteKey(instance, 'upgraded', upgraded);
            replaceObjectContents(chosenRankUps, chosen);
        }
        delete states[row.key];
        if (checkpoint)
        {
            replaceObjectContents(checkpoint, snapshot.checkpoint);
        }
    }

    function takeRewardRow(row, focusKey)
    {
        if (states[row.key])
        {
            return false;
        }
        const snapshot = snapshotBeforeTaking(row);
        if (!applyRewardByKind[row.kind](row))
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

    function renderMenu(focusKind = null)
    {
        const notesHtml = rewardNotes(rewards).map(rewardNoteHtml).join('');
        const rowsHtml = plan.rows.map(rewardRowHtml).join('');
        const {
            continueButton,
            foot,
            note,
        } = buildMenuFoot();
        const claim = rewardClaimStatus(plan, states);
        const claimedStatus = buildClaimedStatus(claim);
        const cindersLine = buildCindersLine();
        openDoor({
            eyebrow: translate(readMenuEyebrowId()),
            title: readVictoryTitle(rewards),
            status: claimedStatus,
            body: buildClaimLayout(rowsHtml + notesHtml, claim, cindersLine),
            foot,
        });
        appRoot.querySelector(MENU_SELECTOR).inert = !xpAnimationDone;

        bindMenuControls(continueButton, note);

        scheduleXpAnimation(appRoot.querySelector(CLAIM_LAYOUT_SELECTOR));
        if (isEngaged())
        {
            setTimeout(() => focusRewardTarget(focusKind), 0);
        }
    }

    function readMenuEyebrowId()
    {
        return plan.rows.length > 0
            ? 'reward.eyebrow.claim'
            : 'reward.eyebrow.spoils';
    }

    function buildClaimedStatus(claim)
    {
        if (!(plan.rows.length > 0))
        {
            return null;
        }
        return buildElement('span', {
            class: 'as-status modal-head-status',
            text: translate('reward.status.claimed', {
                claimed: claim.claimed,
                total: claim.total,
            }),
        });
    }

    function buildCindersLine()
    {
        if (
            !receiptOnly
            || !rewards.cinders
        )
        {
            return null;
        }
        return buildElement('p', {
            class: 'spoils-line spoils-cinders',
            text: translate('reward.spoils.cinders', {
                gained: rewards.cinders.gained,
                total: rewards.cinders.total,
            }),
        });
    }

    function buildClaimLayout(menuHtml, claim, cindersLine)
    {
        return buildElement(
            'div',
            {
                class: 'reward-claim-layout',
                'aria-busy': String(!xpAnimationDone),
            },
            [
                buildElement('div', {
                    class: 'class-row reward-menu',
                    html: menuHtml,
                }),
                buildSideColumn(claim),
                buildStatAllocationSection(),
                cindersLine,
            ],
        );
    }

    function buildStatAllocationSection()
    {
        if (!receiptOnly)
        {
            return null;
        }
        // Earned attribute points open the level-up modal (owner, 2026-11-17), never an inline panel.
        if (!onAllocateStat || !(run.level?.unspentPoints > 0))
        {
            return null;
        }
        const host = buildElement('div', { class: 'spoils-points reward-stat-points' });
        const draw = () =>
        {
            const points = LevelUpPointsButton(registries, run, {
                settings,
                onAllocateStat,
                id: 'reward-stat-points',
                onChange: () =>
                {
                    persistProgress();
                    draw();
                },
            });
            host.replaceChildren(...(points ? [points] : []));
        };
        draw();
        return host;
    }

    function bindMenuControls(continueButton, note)
    {
        bindRewardRows(appRoot);
        bindSkipButtons();
        attachTooltip(continueButton, () =>
            tooltipHtml(
                translate('reward.continue'),
                LEAVE_TOOLTIP_COPY,
            ));
        armContinue(continueButton, note);
    }

    function buildMenuFoot()
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
            note: readHoldNote(),
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

    function readHoldNote()
    {
        if (receiptOnly)
        {
            return RECEIPT_HOLD_COPY;
        }
        const pendingRows = plan.rows.filter((row) =>
            !states[row.key]
            && !row.blockedBy
        );
        if (pendingRows.some(isProgressionReward))
        {
            return UNFINISHED_HOLD_COPY;
        }
        const allResolved = plan.rows.every((row) =>
            states[row.key] === STATE_TAKEN
            || states[row.key] === STATE_SKIPPED
        );
        return translate(allResolved ? 'reward.hold.complete' : 'reward.hold.leavesRest');
    }

    function focusRewardTarget(focusKind)
    {
        const focusedKind = focusKind
            && focusFirst(`.reward-kind[data-key="${focusKind}"]`);
        return focusedKind
            || focusFirst(UNLOCKED_ROW_SELECTOR)
            || focusFirst(CONTINUE_SELECTOR);
    }

    function describeRewardRow(row)
    {
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
        const label = escapeHtml(readSkillLabel(row.skillId));
        const title = translate('reward.skillRankUp.title', {
            skill: label,
            level: row.level,
        });
        if (states[row.key] === STATE_TAKEN)
        {
            return {
                title,
                body: describeRaisedCard(row),
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

    function describeRaisedCard(row)
    {
        const instance = findOwnedInstance(chosenRankUps[row.key]);
        const definition = instance
            && registries.cards.get(instance.cardId);
        const cardName = definition?.name
            || chosenRankUps[row.key]
            || '';
        return translate('reward.skillRankUp.raised', {
            name: escapeHtml(cardName),
            rank: readCardRank(instance),
        });
    }

    function readRowState(row)
    {
        return states[row.key] || (row.blockedBy ? STATE_BLOCKED : STATE_PENDING);
    }

    function rewardRowHtml(row)
    {
        const rowState = readRowState(row);
        const { title, body } = describeRewardRow(row);
        const isOffer = rowState === STATE_PENDING
            && isProgressionReward(row);
        const lockedClass = LOCKED_STATES.has(rowState) ? ' locked' : '';
        const offerClass = isOffer ? ' reward-level-offer' : '';
        const chipId = STATE_COPY_IDS[rowState];
        const chip = chipId
            ? `<span class="chip">${escapeHtml(translate(chipId))}</span>`
            : '';
        const skipHtml = rowState === STATE_BLOCKED
            ? skipButtonHtml(row, title)
            : '';
        const glyph = engravedIconHtml(KIND_GLYPHS[row.kind])
            || escapeHtml(uiIconText(KIND_GLYPHS[row.kind] || '?'));
        return `
      <div class="class-pick reward-kind${lockedClass}${offerClass}"
           data-kind="${escapeHtml(row.kind)}" data-key="${escapeHtml(row.key)}"
           data-state="${escapeHtml(rowState)}"
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

    function bindRewardRows(root)
    {
        for (const rowElement of root.querySelectorAll('.reward-kind'))
        {
            const row = plan.rows.find((candidate) => candidate.key === rowElement.dataset.key);
            const rowState = rowElement.dataset.state;
            attachTooltip(rowElement, () => readRowTooltip(row, rowState));
            if (LOCKED_STATES.has(rowState))
            {
                continue;
            }
            rowElement.addEventListener('click', () => chooseRewardRow(row));
        }
    }

    function readRowTooltip(row, rowState)
    {
        if (rowState === STATE_BLOCKED)
        {
            return tooltipHtml(
                translateTip('reward.blocked.slots'),
                translateFull('reward.blocked.slots'),
            );
        }
        if (rowState === STATE_TAKEN)
        {
            return tooltipHtml(translateTip('reward.state.taken'));
        }
        const offerId = readOfferCopyId(row);
        return tooltipHtml(translateTip(offerId), translateFull(offerId));
    }

    function chooseRewardRow(row)
    {
        if (!xpAnimationDone)
        {
            return;
        }
        if (row.kind === SKILL_RANK_UP)
        {
            return rankUpCandidates(registries, run, row.skillId).length
                ? openRankUpPicker(row)
                : renderRankUpChooser(row);
        }
        takeRewardRow(row);
    }

    // Playtest 2026-11-17 item 45a: a skill's rank-up is a card upgrade, so it uses the Blacksmith's card-upgrade
    // picker (cardUpgradeModal.js): choose the card, its bonus options open under it, Rank up commits. Back closes the
    // picker and leaves the row as it was, to take now or leave queued.
    function openRankUpPicker(row)
    {
        if (states[row.key])
        {
            return;
        }
        let selection = null;
        const faceOf = (instance) => projectGameCard(run, instance) || resolveCard(registries, instance);
        const readModel = () => RankUpUpgradeModel(registries, run, row.skillId, selection, { faceOf });
        const opener = [...appRoot.querySelectorAll('.reward-kind')].find((node) => node.dataset.key === row.key) || null;
        const picker = MountCardUpgradeModal(appRoot, readModel(), {
            registries,
            meta,
            title: describeRewardRow(row).title,
            backLabel: translate('common.back'),
            confirmLabel: translate('rankUp.pick.confirm'),
            returnFocusElement: opener,
            onSelect: (instanceId) =>
            {
                selection = instanceId;
                picker.update(readModel());
            },
            onBack: () => {},
            onConfirm: (instanceId, plan) =>
            {
                const taking = {
                    ...row,
                    instanceId,
                    ...(plan?.step ? { bonusStep: plan.step } : {}),
                };
                try
                {
                    return takeRewardRow(taking, row.key);
                }
                catch
                {
                    renderMenu(row.key);
                    return false;
                }
            },
        });
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
                skipBlockedRow(skipButton.dataset.skip);
            });
        }
    }

    function skipBlockedRow(rowKey)
    {
        states[rowKey] = STATE_SKIPPED;
        persistProgress();
        renderMenu(rowKey);
    }

    function armContinue(continueButton, note)
    {
        function finishRewards()
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
                return finishRewards();
            }
            if (
                receiptContinued
                || !xpAnimationDone
            )
            {
                return;
            }
            receiptContinued = true;
            try
            {
                finishRewards();
            }
            catch (error)
            {
                receiptContinued = false;
                note.textContent = error.message;
            }
        }

        function confirmLeaving()
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
        }

        disarmContinue?.();
        disarmContinue = beatArmer(meta, registries)(continueButton, 'rewardContinue', {
            onConfirm: confirmLeaving,
        });
    }

    function buildSideColumn(claim)
    {
        const progressionPanel = buildProgressPanel();
        const showsClaimPanel = !progressionPanel
            && plan.rows.length;
        const claimPanel = showsClaimPanel
            ? buildClaimStatusPanel(claim)
            : null;
        const panels = [progressionPanel, claimPanel].filter(Boolean);
        return panels.length
            ? buildElement('div', { class: 'reward-side' }, panels)
            : null;
    }

    function buildClaimStatusPanel(claim)
    {
        const claimLines = claim.rows.map(buildClaimLine);
        const requiredChoice = buildRequiredChoice(claim);
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
                buildElement('ul', { class: 'reward-claim-list' }, claimLines),
                requiredChoice,
            ],
        );
    }

    function buildClaimLine(claimRow)
    {
        const stateId = claimRow.state === STATE_BLOCKED
            ? 'reward.claim.blocked'
            : `reward.state.${claimRow.state}`;
        const planRow = plan.rows.find((row) => row.key === claimRow.key);
        return buildElement(
            'li',
            {
                class: 'reward-claim-row',
                dataset: {
                    kind: claimRow.kind,
                    key: claimRow.key,
                    state: claimRow.state,
                },
            },
            [
                buildElement('span', {
                    class: 'reward-claim-name',
                    text: describeRewardRow(planRow).title,
                }),
                buildElement('span', {
                    class: 'reward-claim-state',
                    text: translate(stateId),
                }),
            ],
        );
    }

    function buildProgressPanel()
    {
        const hasNoProgress = !xpProgress
            || (
                !xpProgress.character
                && !xpProgress.skills.length
            );
        if (hasNoProgress)
        {
            return null;
        }
        const progressRows = orderedXpRows(xpProgress)
            .map((row) => buildProgressRow(row, readProgressLabel(row)));
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
                buildElement('ul', { class: 'reward-progress-list' }, progressRows),
            ],
        );
    }

    function buildProgressRow(row, label)
    {
        const nextLevel = buildNextLevelLabel(row);
        const targetPercent = row.fraction * 100;
        const xpBefore = readXpBefore(row);
        const startPercent = readStartPercent(row, xpBefore);
        const animate = shouldAnimateBar(row, xpBefore);
        const bar = buildProgressBar(row, label, {
            animate,
            startPercent,
            targetPercent,
        });
        const levelNow = readLevelNowText(row);
        const gainedNode = buildGainedNode(row);
        const discardedNode = buildDiscardedNode(row);
        const rowNode = buildElement(
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
        attachProgressTooltip(rowNode, row, label);
        return rowNode;
    }

    function readXpBefore(row)
    {
        return row.kind === 'character'
            ? rewards.xpBefore?.character
            : rewards.xpBefore?.tracks?.[row.id];
    }

    function shouldAnimateBar(row, xpBefore)
    {
        return !xpAnimationDone
            && row.gained > 0
            && !!xpBefore
            && !animatedTracks.has(row.id);
    }

    function isCurrentLayout(host)
    {
        return host?.isConnected
            && appRoot.querySelector(CLAIM_LAYOUT_SELECTOR) === host;
    }

    function scheduleXpAnimation(host)
    {
        if (
            !host
            || xpAnimationDone
            || !xpProgress
            || !rewards.xpBefore
        )
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

    function readXpFillMilliseconds()
    {
        const requested = Number(settings.victoryXpSeconds);
        const seconds = Number.isFinite(requested) ? requested : DEFAULT_XP_SECONDS;
        return isReducedMotion()
            ? 0
            : Math.max(0, Math.min(MAX_XP_MILLISECONDS, seconds * 1000));
    }

    async function playXpAnimation(host)
    {
        if (host.xpAnimationRunning)
        {
            return;
        }
        host.xpAnimationRunning = true;
        const bars = [...host.querySelectorAll(ANIMATED_BAR_SELECTOR)];
        const durations = readBarDurations(bars, readXpFillMilliseconds());
        for (const [barIndex, bar] of bars.entries())
        {
            const duration = durations[barIndex];
            if (!hasBothFills(bar))
            {
                continue;
            }
            const targetWidth = `${bar.dataset.target}%`;
            if (duration > 0)
            {
                startBarFill(bar, duration, targetWidth);
                await pauseFor(duration);
                if (!isCurrentLayout(host))
                {
                    return;
                }
            }
            else
            {
                setBarWidths(bar, targetWidth);
            }
            markBarFilled(bar);
        }
        if (!isCurrentLayout(host))
        {
            return;
        }
        host.xpAnimationRunning = false;
        xpAnimationDone = true;
        refreshProgressView();
    }

    function markBarFilled(bar)
    {
        animatedTracks.add(bar.dataset.track);
        if (Number(bar.dataset.target) >= 100)
        {
            bar.classList.add('rp-bar-ready');
        }
    }

    function refreshProgressView()
    {
        const layout = appRoot.querySelector(CLAIM_LAYOUT_SELECTOR);
        const panel = layout?.querySelector(PROGRESS_PANEL_SELECTOR);
        const nextPanel = panel ? buildProgressPanel() : null;
        if (!nextPanel)
        {
            renderMenu();
            return;
        }
        panel.after(nextPanel);
        panel.remove();
        syncLayoutToXpAnimation(layout);
        refocusWhenFocusLost();
        scheduleXpAnimation(layout);
    }

    function syncLayoutToXpAnimation(layout)
    {
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
            note.textContent = readHoldNote();
        }
    }

    function refocusWhenFocusLost()
    {
        const focused = document.activeElement;
        const hasLostFocus = !focused
            || focused === document.body
            || !focused.isConnected;
        if (
            isEngaged()
            && hasLostFocus
        )
        {
            focusRewardTarget(null);
        }
    }

    function renderRankUpChooser(row)
    {
        const isTaken = () => states[row.key];
        const rankUpCards = rankUpCandidates(registries, run, row.skillId);
        let selectedCardId = pendingCardIdByKey[row.key] || null;
        let confirming = false;
        let reviewing = false;
        const inspectionFaces = new Map();
        const backButton = buildChooserBackButton();
        const confirmButton = buildChooserConfirmButton();
        const inspectButton = buildInspectButton();
        inspectButton.addEventListener('click', inspectSelectedCard);
        openChooserDoor();
        const strip = appRoot.querySelector(CHOOSER_STRIP_SELECTOR);
        const message = buildConfirmStatusMessage();
        strip.after(message);
        const confirmReason = reasonWhenDisabled(confirmButton, readConfirmDisabledReason);
        const bonusPanel = buildRankBonusPanel();
        strip.after(bonusPanel);

        fillCandidateStrip();
        confirmButton.disabled = !selectedCardId
            || needsBonus();
        syncActionButtons();

        confirmButton.addEventListener('click', pressConfirm);
        backButton.addEventListener('click', pressBack);
        focusChooserWhenEngaged();

        function inspectSelectedCard()
        {
            if (
                !confirming
                && !isTaken()
            )
            {
                openBoundCardInspection(inspectionFaces.get(selectedCardId), inspectButton);
            }
        }

        function openChooserDoor()
        {
            openDoor({
                eyebrow: describeRewardRow(row).title,
                title: readVictoryTitle(rewards),
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
        }

        function readConfirmDisabledReason()
        {
            if (!selectedCardId)
            {
                return translate('reward.confirm.reason');
            }
            return needsBonus() ? translate('reward.rankBonus.reason') : null;
        }

        function fillCandidateStrip()
        {
            for (const instance of rankUpCards)
            {
                strip.appendChild(buildRankUpFace(instance));
            }
            renderBonusPanel();
            if (!rankUpCards.length)
            {
                strip.appendChild(buildElement('p', {
                    class: 'reward-rank-none',
                    text: translate(NONE_ID, { skill: readSkillLabel(row.skillId) }),
                }));
            }
        }

        function focusChooserWhenEngaged()
        {
            if (isEngaged())
            {
                setTimeout(
                    () => focusFirst('.reward-row .reward-pick') || focusFirst('#reward-back'),
                    0,
                );
            }
        }

        function bonusOptionsOf(instanceId)
        {
            if (!instanceId)
            {
                return [];
            }
            return rankUpBonusOptions(registries, run, findOwnedInstance(instanceId));
        }

        function needsBonus()
        {
            return !!selectedCardId
                && bonusOptionsOf(selectedCardId).length > 0
                && !(pendingBonusIndexByKey[row.key] >= 0);
        }

        function faceOf(instance)
        {
            return projectGameCard(run, instance) || resolveCard(registries, instance);
        }

        function findStripFace(instanceId)
        {
            return [...strip.children].find((face) => face.dataset?.pickId === instanceId);
        }

        function syncActionButtons()
        {
            inspectButton.disabled = !inspectionFaces.has(selectedCardId);
            confirmReason();
        }

        function renderBonusPanel()
        {
            bonusPanel.replaceChildren();
            const bonusOptions = bonusOptionsOf(selectedCardId);
            bonusPanel.hidden = !bonusOptions.length;
            if (!bonusOptions.length)
            {
                return;
            }
            const instance = findOwnedInstance(selectedCardId);
            const rankedFace = faceOf({
                ...instance,
                rank: readCardRank(instance) + 1,
            });
            bonusPanel.appendChild(buildElement('p', {
                class: 'reward-rank-bonus-title',
                text: translate('reward.rankBonus.label'),
            }));
            bonusOptions.forEach((bonusOption, optionIndex) =>
            {
                bonusPanel.appendChild(buildBonusChoice(
                    bonusOption,
                    optionIndex,
                    bonusOptions.length,
                    rankedFace,
                ));
            });
        }

        function buildBonusChoice(bonusOption, optionIndex, optionCount, rankedFace)
        {
            const changes = cardUpgradeChanges(registries, rankedFace, faceOf(bonusOption.after));
            const summary = describeBonusChanges(changes)
                || translate('reward.rankBonus.option', {
                    n: optionIndex + 1,
                });
            const isChosen = pendingBonusIndexByKey[row.key] === optionIndex;
            const chosenClass = isChosen
                ? ` ${CHOSEN_CLASS}`
                : '';
            const choice = button({
                label: summary,
                className: `class-pick reward-bonus-option${chosenClass}`,
                attrs: {
                    role: 'radio',
                    'aria-checked': String(isChosen),
                    'aria-label': translate('cardUpgrade.option.aria', {
                        n: optionIndex + 1,
                        total: optionCount,
                        summary,
                    }),
                    dataset: {
                        bonusIndex: String(optionIndex),
                    },
                },
            });
            choice.addEventListener('click', () => selectBonus(optionIndex));
            return choice;
        }

        function selectBonus(optionIndex)
        {
            if (
                reviewing
                || confirming
                || isTaken()
                || !(optionIndex >= 0)
            )
            {
                return;
            }
            pendingBonusIndexByKey[row.key] = optionIndex;
            const selectedFace = findStripFace(selectedCardId);
            const instance = findOwnedInstance(selectedCardId);
            if (
                selectedFace
                && instance
            )
            {
                selectedFace.replaceWith(buildRankUpFace(instance));
            }
            renderBonusPanel();
            confirmButton.disabled = false;
            syncActionButtons();
        }

        function markPicks(cardId)
        {
            for (const pick of strip.querySelectorAll('.reward-pick'))
            {
                const isSelected = pick.dataset.pickId === cardId;
                if (!pick.classList.contains('reward-choice-button'))
                {
                    pick.classList.toggle(SELECTED_CLASS, isSelected);
                }
                MarkSelected(
                    pick,
                    isSelected,
                    {
                        className: CHOSEN_CLASS,
                        ariaAttribute: 'aria-checked',
                    },
                );
            }
            MarkSelected(
                strip.querySelectorAll('.reward-choice-face'),
                face => face.dataset.pickId === cardId,
                {
                    className: [
                        SELECTED_CLASS,
                        CHOSEN_CLASS,
                    ],
                    ariaAttribute: null,
                },
            );
        }

        function selectCard(cardId)
        {
            if (
                reviewing
                || confirming
                || isTaken()
            )
            {
                return;
            }
            const previousCardId = selectedCardId;
            if (previousCardId !== cardId)
            {
                delete pendingBonusIndexByKey[row.key];
            }
            selectedCardId = cardId;
            pendingCardIdByKey[row.key] = cardId;
            markPicks(cardId);
            restoreDeselectedFace(previousCardId, cardId);
            renderBonusPanel();
            confirmButton.disabled = needsBonus();
            syncActionButtons();
            message.hidden = true;
        }

        function restoreDeselectedFace(previousCardId, cardId)
        {
            const hasLeftCard = previousCardId
                && previousCardId !== cardId;
            const leftCard = hasLeftCard
                ? rankUpCards.find((instance) => instance.instanceId === previousCardId)
                : null;
            const leftFace = leftCard
                ? findStripFace(previousCardId)
                : null;
            if (leftFace)
            {
                leftFace.replaceWith(buildRankUpFace(leftCard));
            }
        }

        function readShownRankUp(instance, isSelected)
        {
            const bonusOption = isSelected
                ? bonusOptionsOf(instance.instanceId)[pendingBonusIndexByKey[row.key]]
                : null;
            return bonusOption
                ? bonusOption.after
                : {
                    ...instance,
                    rank: readCardRank(instance) + 1,
                };
        }

        function buildRankUpFace(instance)
        {
            const isSelected = instance.instanceId === selectedCardId;
            const face = renderCard(
                registries,
                readShownRankUp(instance, isSelected),
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
            MarkSelected(
                face,
                isSelected,
                {
                    className: [
                        SELECTED_CLASS,
                        CHOSEN_CLASS,
                    ],
                    ariaAttribute: 'aria-checked',
                },
            );
            face.addEventListener('click', () => selectCard(instance.instanceId));
            return face;
        }

        function buildTakingRow()
        {
            const bonusStep = bonusOptionsOf(selectedCardId)[pendingBonusIndexByKey[row.key]]?.step;
            return {
                ...row,
                ...(bonusStep ? { bonusStep } : {}),
                instanceId: selectedCardId,
            };
        }

        function lockChooserForCommit()
        {
            confirming = true;
            inspectButton.disabled = true;
            strip.inert = true;
            confirmButton.disabled = true;
        }

        function unlockChooserAfterFailure()
        {
            message.hidden = false;
            confirming = false;
            inspectButton.disabled = !inspectionFaces.has(selectedCardId);
            strip.inert = false;
            confirmButton.disabled = false;
        }

        function commitSelection()
        {
            if (
                !selectedCardId
                || confirming
                || isTaken()
            )
            {
                return;
            }
            lockChooserForCommit();
            try
            {
                if (takeRewardRow(buildTakingRow(), row.key))
                {
                    return;
                }
                message.textContent = translate('reward.skillRankUp.spent');
            }
            catch
            {
                message.textContent = translate(SAVE_FAILED_ID);
            }
            unlockChooserAfterFailure();
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

        function pressConfirm()
        {
            if (
                !selectedCardId
                || confirming
                || isTaken()
            )
            {
                return;
            }
            if (reviewing)
            {
                return commitSelection();
            }
            enterReview();
        }

        function pressBack()
        {
            if (
                confirming
                || isTaken()
            )
            {
                return;
            }
            if (reviewing)
            {
                return renderRankUpChooser(row);
            }
            skipRankUp();
        }

        function skipRankUp()
        {
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
        }
    }

    function readCompactReceiptRows()
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
        const receiptRows = readCompactReceiptRows();
        const presentation = victoryXpPresentation(settings, isReducedMotion());
        const timing = victoryXpTiming(receiptRows.length, presentation);
        const {
            openButton,
            formula,
            moreButton,
            totalValue,
            summary,
            rowList,
        } = buildCompactReceiptView(presentation);
        const modal = openCompactDoor();
        const tooltipPlacement = {
            intent: 'above',
            align: 'end',
            clear: modal,
            appearance: {
                maxWidthRem: 30,
                maxHeightRatio: 0.5,
            },
        };
        bindFullCalculation();
        let isExpandReady = false;
        let shownRowCount = 0;
        const doorCountAtMount = doorOpenCount;

        if (presentation.totalMs === 0)
        {
            showAllRowsAtOnce();
        }
        else
        {
            playReceiptRows();
        }
        bindExpandControls();

        function openCompactDoor()
        {
            return openDoor({
                eyebrow: '',
                title: readVictoryTitle(rewards),
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
        }

        function readFullCalculation()
        {
            const { full } = victoryXpFormula(
                receiptRows,
                receiptRows.length,
                presentation.formulaTerms,
            );
            return `<div class="tt-title">${FULL_CALCULATION_TITLE}</div>`
                + `<div>${escapeHtml(full)}</div>`;
        }

        function bindFullCalculation()
        {
            attachTooltip(moreButton, readFullCalculation, tooltipPlacement);
            moreButton.addEventListener('click', () =>
            {
                showTooltipFor(moreButton, readFullCalculation(), tooltipPlacement);
            });
        }

        function isCompactDoorShown()
        {
            return modal.isConnected
                && doorOpenCount === doorCountAtMount
                && appRoot.querySelector('.reward-door') === modal;
        }

        function updateFormula()
        {
            const expression = victoryXpFormula(
                receiptRows,
                shownRowCount,
                presentation.formulaTerms,
            );
            formula.textContent = expression.shown;
            moreButton.hidden = !expression.collapsed;
        }

        function appendReceiptRow(receiptRow)
        {
            const amount = buildElement('strong', {
                class: 'reward-compact-row-value',
                text: '+0',
            });
            const rowItem = buildElement('li', { class: 'reward-compact-row' }, [
                buildElement('span', {
                    class: 'reward-compact-row-label',
                    text: readCompactRowLabel(receiptRow),
                }),
                amount,
            ]);
            rowList.appendChild(rowItem);
            rowList.scrollTop = rowList.scrollHeight;
            return amount;
        }

        function appendRowCounter(receiptRow, runningTotal)
        {
            const amount = appendReceiptRow(receiptRow);
            return (rowAmount) =>
            {
                const sign = rowAmount < 0
                    ? MINUS
                    : '+';
                amount.textContent = `${sign}${Math.abs(rowAmount)}`;
                totalValue.textContent = `${runningTotal + rowAmount} XP`;
            };
        }

        function armExpandButton()
        {
            if (!isCompactDoorShown())
            {
                return;
            }
            isExpandReady = true;
            openButton.disabled = false;
            openButton.classList.add('is-ready');
            if (settings.victorySummaryMode === 'auto')
            {
                expandVictory();
            }
        }

        function countUp(from, to, milliseconds, renderCount)
        {
            return new Promise((resolve) =>
            {
                if (milliseconds <= 0)
                {
                    renderCount(to);
                    resolve();
                    return;
                }
                const start = performance.now();
                const paintFrame = (now) =>
                {
                    if (!isCompactDoorShown())
                    {
                        resolve();
                        return;
                    }
                    const fraction = Math.min(1, (now - start) / milliseconds);
                    renderCount(from + Math.round((to - from) * fraction));
                    if (fraction >= 1)
                    {
                        resolve();
                    }
                    else
                    {
                        requestAnimationFrame(paintFrame);
                    }
                };
                requestAnimationFrame(paintFrame);
            });
        }

        async function playReceiptRows()
        {
            let runningTotal = 0;
            for (const [rowIndex, receiptRow] of receiptRows.entries())
            {
                if (!isCompactDoorShown())
                {
                    return;
                }
                await countUp(
                    0,
                    receiptRow.amount,
                    timing.tickMs,
                    appendRowCounter(receiptRow, runningTotal),
                );
                if (!isCompactDoorShown())
                {
                    return;
                }
                runningTotal += receiptRow.amount;
                shownRowCount = rowIndex + 1;
                updateFormula();
                if (rowIndex < receiptRows.length - 1)
                {
                    await pauseFor(timing.pauseMs);
                }
            }
            await pauseFor(presentation.readyMs);
            armExpandButton();
        }

        function showAllRowsAtOnce()
        {
            let runningTotal = 0;
            for (const receiptRow of receiptRows)
            {
                appendRowCounter(receiptRow, runningTotal)(receiptRow.amount);
                runningTotal += receiptRow.amount;
                shownRowCount += 1;
            }
            updateFormula();
            if (presentation.readyMs === 0)
            {
                armExpandButton();
            }
            else
            {
                setTimeout(armExpandButton, presentation.readyMs);
            }
        }

        function bindExpandControls()
        {
            openButton.addEventListener('click', () =>
            {
                if (isExpandReady)
                {
                    expandVictory();
                }
            });
            if (settings.victorySummaryMode === 'anywhere')
            {
                appRoot.querySelector('.reward-veil')?.addEventListener('click', (event) =>
                {
                    const isOnControl = event.target === openButton
                        || event.target === moreButton;
                    if (
                        isExpandReady
                        && isCompactDoorShown()
                        && !isOnControl
                    )
                    {
                        expandVictory();
                    }
                });
            }
        }
    }
}
