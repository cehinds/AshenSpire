import { renderCard } from './card.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { renderCollectibleCard } from './collectibleCard.js';
import { RenderRankUpOfferCard } from './rankUpOfferCard.js';
import { MountRewardDoor, ReplaceRewardFoot } from './rewardDoor.js';
import { clearSelection } from './cardSelection.js';
import { openBoundCardInspection } from './cardInspection.js';
import { el as buildElement, button, modalFooter } from '../kit/index.js';
import { t as translate } from '../strings.js';
import { OpenConfirmationModal } from './confirmationModal.js';
import { OfferPicksLeft } from '../../model/gameProfileRewards.js';
import { armouryOpensDeckEditor, noncombatEditing } from '../../model/armouryRules.js';
import { ModalModelFor } from '../models/ModalModel.js';

const CARD_KINDS = Object.freeze([
    'combatCards',
    'weaponArts',
]);
const EQUIPMENT_KINDS = Object.freeze([
    'weapons',
    'armor',
]);
const WEAPON_KIND = 'weapons';
const RANK_UP_KIND = 'rankUps';
const RELIC_KIND = 'relics';
const POTION_KIND = 'potions';

const CONFIRM_LABEL_KEY = 'common.confirm';
const SKIP_LABEL_KEY = 'common.skip';
const CHOSEN_CLASS = 'is-chosen';
const REWARD_SURFACE = 'reward';
const GLANCE_LEVEL = 'glance';

const READ_ONLY_FACE_OPTIONS = Object.freeze({
    interactive: false,
    inspection: true,
    actionOwnsTouch: true,
    level: GLANCE_LEVEL,
});
const READ_ONLY_REWARD_FACE_OPTIONS = Object.freeze({
    ...READ_ONLY_FACE_OPTIONS,
    surface: REWARD_SURFACE,
});

const doorPresentationByRun = new WeakMap();

function isCardKind(kind)
{
    return CARD_KINDS.includes(kind);
}

function isEquipmentKind(kind)
{
    return EQUIPMENT_KINDS.includes(kind);
}

function applyRadioRole(face, label, isDisabled, onPick)
{
    face.setAttribute('role', 'radio');
    face.setAttribute('aria-checked', 'false');
    face.setAttribute('aria-label', label);
    if (isDisabled)
    {
        face.setAttribute('aria-disabled', 'true');
        return;
    }
    face.tabIndex = 0;
    face.addEventListener('keydown', (event) =>
    {
        const isPickKey = event.key === 'Enter'
            || event.key === ' ';
        if (
            event.target !== face
            || !isPickKey
        )
        {
            return;
        }
        event.preventDefault();
        onPick();
    });
}

function findOptionDefinition(registries, activeRun, option)
{
    if (isCardKind(option.kind))
    {
        return registries.cards.get(option.id);
    }
    switch (option.kind)
    {
        case RANK_UP_KIND:
            return { name: translate('rankUp.name') };
        case RELIC_KIND:
            return registries.relics.get(option.id);
        case POTION_KIND:
            return registries.flasks.get(option.id);
        case WEAPON_KIND:
            return registries.equipment.armaments.find((armament) => armament.id === option.id);
        default:
            return registries.equipment.armour.find((armour) =>
            {
                return armour.id === option.id
                    && armour.classId === activeRun.class;
            });
    }
}

function buildCardOptionFace(registries, activeRun, option, optionIndex, inspectionOptions = {})
{
    const rankFields = option.rank > 1
        ? {
            rank: option.rank,
        }
        : {};
    return renderCard(
        registries,
        {
            cardId: option.id,
            instanceId: `offer:${optionIndex}`,
            upgraded: false,
            ...rankFields,
        },
        {
            rules: activeRun,
            surface: REWARD_SURFACE,
            level: GLANCE_LEVEL,
            actionOwnsTouch: true,
            infoBadge: true,
            only: [],
            ...inspectionOptions,
        },
    );
}

function buildCollectibleOptionFace(registries, option, definition)
{
    const collectibleLabel = option.kind === POTION_KIND
        ? 'Potion'
        : 'Relic';
    return renderCollectibleCard(
        registries,
        definition,
        collectibleLabel,
        READ_ONLY_FACE_OPTIONS,
    ).card;
}

function buildOptionFace(registries, activeRun, option, optionIndex, definition, inspectionOptions = {})
{
    if (isCardKind(option.kind))
    {
        return buildCardOptionFace(registries, activeRun, option, optionIndex, inspectionOptions);
    }
    if (option.kind === RANK_UP_KIND)
    {
        return RenderRankUpOfferCard(registries, READ_ONLY_REWARD_FACE_OPTIONS).card;
    }
    if (isEquipmentKind(option.kind))
    {
        return renderEquipmentCard(registries, definition, { ...READ_ONLY_REWARD_FACE_OPTIONS, ...inspectionOptions }).card;
    }
    return buildCollectibleOptionFace(registries, option, definition);
}

function findOrCreateDoorPresentation(activeRun, offerId)
{
    let presentation = doorPresentationByRun.get(activeRun);
    if (
        !presentation
        || presentation.offerId !== offerId
    )
    {
        presentation = {
            offerId,
            owner: {},
        };
        doorPresentationByRun.set(activeRun, presentation);
    }
    return presentation;
}

function buildChoiceStrip(ariaKey, choiceCount)
{
    const choiceStrip = buildElement('div', {
        class: 'reward-row reward-choice-grid',
        role: 'radiogroup',
        'aria-label': translate(ariaKey),
    });
    choiceStrip.style.setProperty(
        '--choice-count',
        String(choiceCount),
    );
    return choiceStrip;
}

function buildRewardNote(offer, defaultNoteKey)
{
    const hasBonus = offer.options.some((option) => option.bonus);
    const noteKey = hasBonus ? 'reward.configured.noteBonus' : defaultNoteKey;
    return buildElement('p', {
        class: 'reward-note',
        text: translate(noteKey, {
            count: offer.takeCount,
        }),
    });
}

function buildStatusLine()
{
    return buildElement('p', {
        class: 'reward-confirm-status',
        role: 'alert',
    });
}

function buildConfirmButton()
{
    return button({
        label: translate(CONFIRM_LABEL_KEY),
        weight: 'primary',
        id: 'reward-card-confirm',
        className: 'reward-confirm',
        disabled: true,
    });
}

function buildInspectButton()
{
    return button({
        label: translate('deckEditor.inspectAction'),
        id: 'reward-inspect',
        disabled: true,
    });
}

function buildSecondaryButtons()
{
    const editDeckButton = button({
        label: translate('reward.configured.editDeck'),
        id: 'reward-edit-deck',
        className: 'reward-edit-deck',
    });
    const equipButton = button({
        label: translate('reward.configured.equipNow'),
        id: 'reward-equip-now',
        className: 'reward-equip-now',
    });
    equipButton.hidden = true;
    const keepButton = button({
        label: translate('reward.configured.addToLibrary'),
        id: 'reward-keep',
        className: 'reward-keep',
    });
    editDeckButton.hidden = true;
    keepButton.hidden = true;
    const skipButton = button({
        label: translate(SKIP_LABEL_KEY),
        id: 'reward-continue',
        className: 'danger',
    });
    return {
        editDeckButton,
        equipButton,
        keepButton,
        skipButton,
    };
}

function buildChoiceColumn(optionIndex, isSpent)
{
    const ownedClass = isSpent
        ? ' is-owned'
        : '';
    return buildElement('div', {
        class: `reward-choice-option${ownedClass}`,
        dataset: {
            pickId: String(optionIndex),
        },
    });
}

function readChoiceLabel(option, definition)
{
    return option.bonus
        ? translate('rankUp.bonusLabel', {
            name: definition.name,
        })
        : definition.name;
}

function buildChoiceControl(choiceLabel, isSpent, optionIndex)
{
    return button({
        label: choiceLabel,
        disabled: isSpent,
        className: 'class-pick reward-node reward-pick reward-choice-button',
        attrs: {
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            dataset: {
                pickId: String(optionIndex),
            },
        },
    });
}

export function RewardDoorCopy(offer, activeRun, settings)
{
    const offersCard = offer.options.some((option) => isCardKind(option.kind));
    const noteKey = !offersCard
        ? 'reward.configured.noteItems'
        : !noncombatEditing(activeRun)
        ? 'reward.configured.note'
        : armouryOpensDeckEditor(activeRun, settings)
        ? 'reward.configured.noteArmoury'
        : 'reward.configured.noteNoEditor';
    return {
        aria: offersCard ? 'reward.card.aria' : 'reward.choice.aria',
        note: noteKey,
    };
}

export function MountGameProfileOffers(appRoot, {
    registries,
    run: activeRun,
    offer,
    title,
    onTake,
    onContinue,
    settings,
    onAddToDeck = null,
    addRefusal = null,
    onEditDeck = null,
    canEditDeck = false,
    deckMax = null,
    onEditEquipment = null,
    canEditEquipment = false,
    spoils = null,
})
{
    clearSelection();
    const presentation = findOrCreateDoorPresentation(activeRun, offer.id);
    const doorCopy = RewardDoorCopy(
        offer,
        activeRun,
        settings,
    );
    const choiceStrip = buildChoiceStrip(doorCopy.aria, offer.options.length);
    const rewardNote = buildRewardNote(offer, doorCopy.note);
    const statusLine = buildStatusLine();
    const confirmButton = buildConfirmButton();
    const inspectButton = buildInspectButton();
    inspectButton.addEventListener('click', inspectSelectedChoice);
    const {
        editDeckButton,
        equipButton,
        keepButton,
        skipButton,
    } = buildSecondaryButtons();

    let selectedIndex = null;
    let isClaimPending = false;
    let isReviewing = false;
    let isCompleted = false;
    let isAddToDeckMode = false;
    const choices = [];
    const isFaceRadio = !ModalModelFor('reward').showNameButton;

    appendChoices();
    skipButton.addEventListener('click', handleSkipClick);
    confirmButton.addEventListener('click', handleConfirmClick);
    keepButton.addEventListener('click', () => commitPick(takeOptionIfUntaken));
    equipButton.addEventListener('click', () =>
    {
        return commitPick(takeOptionIfUntaken, openEquipmentEditor);
    });
    editDeckButton.addEventListener('click', () =>
    {
        return commitPick(takeOptionIfUntaken, openDeckEditor);
    });
    renderDoor();

    function inspectSelectedChoice()
    {
        if (
            !isClaimPending
            && !isCompleted
            && selectedIndex !== null
        )
        {
            openBoundCardInspection(choices[selectedIndex].face, inspectButton);
        }
    }

    function isOptionSpent(optionIndex)
    {
        if (
            offer.taken.includes(optionIndex)
            || offer.claimed !== null
        )
        {
            return true;
        }
        if (offer.options[optionIndex]?.bonus)
        {
            return false;
        }
        const offerWithoutBonus = {
            ...offer,
            options: offer.options.filter((option) => !option.bonus),
            taken: offer.taken.filter((takenIndex) => !offer.options[takenIndex]?.bonus),
        };
        return OfferPicksLeft(offerWithoutBonus) < 1;
    }

    function readSelectedKind()
    {
        return offer.options[selectedIndex]?.kind;
    }

    function isCardPicked()
    {
        return selectedIndex !== null
            && isCardKind(readSelectedKind());
    }

    function setFooterButtonsDisabled(isDisabled)
    {
        confirmButton.disabled = isDisabled;
        skipButton.disabled = isDisabled;
        editDeckButton.disabled = isDisabled;
        equipButton.disabled = isDisabled;
        keepButton.disabled = isDisabled;
    }

    function lockForClaim()
    {
        inspectButton.disabled = true;
        choiceStrip.inert = true;
        isClaimPending = true;
        setFooterButtonsDisabled(true);
    }

    function recoverFromClaimFailure(error)
    {
        isClaimPending = false;
        inspectButton.disabled = isCompleted;
        choiceStrip.inert = isCompleted;
        statusLine.textContent = error.message;
        setFooterButtonsDisabled(false);
    }

    function showChoiceColumns(onlyIndex = null)
    {
        for (const column of choiceStrip.children)
        {
            column.hidden = onlyIndex !== null
                && Number(column.dataset.pickId) !== onlyIndex;
        }
    }

    function markChosenChoice()
    {
        for (const [choiceIndex, { face, control }] of choices.entries())
        {
            const isChosen = choiceIndex === selectedIndex;
            face.classList.toggle('reward-selected', isChosen);
            face.classList.toggle(CHOSEN_CLASS, isChosen);
            control.classList.toggle(CHOSEN_CLASS, isChosen);
            control.setAttribute('aria-checked', String(isChosen));
            if (isFaceRadio)
            {
                face.setAttribute('aria-checked', String(isChosen));
            }
        }
    }

    function selectOption(optionIndex)
    {
        if (
            isClaimPending
            || isReviewing
            || isCompleted
            || isOptionSpent(optionIndex)
        )
        {
            return;
        }

        selectedIndex = optionIndex;
        markChosenChoice();
        confirmButton.disabled = false;
        inspectButton.disabled = false;
        const inspectLabel = translate('deckEditor.inspectNamed', {
            name: choices[optionIndex].control.textContent,
        });
        inspectButton.setAttribute('aria-label', inspectLabel);
        statusLine.textContent = '';
        updateCardActions();
    }

    function updateCardActions()
    {
        const isCardMode = !!(
            onAddToDeck
            && isCardPicked()
        );
        const hasModeChanged = isCardMode !== isAddToDeckMode;
        isAddToDeckMode = isCardMode;
        inspectButton.hidden = isCardMode;
        editDeckButton.hidden = !(
            isCardMode
            && onEditDeck
            && canEditDeck
        );
        keepButton.hidden = !isCardMode;
        const confirmLabelKey = isCardMode
            ? 'reward.configured.addToDeck'
            : CONFIRM_LABEL_KEY;
        confirmButton.textContent = translate(confirmLabelKey);
        const canBeRefused = isCardMode
            && addRefusal;
        const refusalCode = canBeRefused
            ? addRefusal(selectedIndex)
            : '';
        confirmButton.disabled = !!refusalCode;
        if (refusalCode)
        {
            statusLine.textContent = describeRefusal(refusalCode);
        }
        if (hasModeChanged)
        {
            renderFoot();
        }
    }

    function handleFaceClick(face, optionIndex, isCardOption)
    {
        // The acquisition door owns the choice and the commit. A face press
        // only selects and reads; its explicit action takes exactly one offer.
        if (onAddToDeck && (isCardOption || isEquipmentKind(offer.options[optionIndex].kind)))
        {
            if (isClaimPending || isCompleted || isReviewing || isOptionSpent(optionIndex)) return;
            selectOption(optionIndex);
            openBoundCardInspection(face, face);
            return;
        }
        const canInspect = isCardOption
            && selectedIndex === optionIndex
            && !isClaimPending
            && !isReviewing
            && !isCompleted;
        if (canInspect)
        {
            openBoundCardInspection(face, face);
        }
        else
        {
            selectOption(optionIndex);
        }
    }

    function buildChoiceFace(option, optionIndex, definition)
    {
        const isAcquisition = !!onAddToDeck && (isCardKind(option.kind) || isEquipmentKind(option.kind));
        const inspectionOptions = isAcquisition ? {
            infoBadge: false,
            inspectionActions: () => {
                const canTake = !isClaimPending && !isCompleted && !isReviewing && !isOptionSpent(optionIndex);
                if (!isCardKind(option.kind)) return [{ id: 'take', verb: translate(CONFIRM_LABEL_KEY), enabled: canTake, reason: '' }];
                const refusal = addRefusal?.(optionIndex);
                return [
                    { id: 'addToDeck', verb: translate('reward.configured.addToDeck'), enabled: canTake && !refusal, reason: refusal ? describeRefusal(refusal) : '' },
                    { id: 'addToLibrary', verb: translate('reward.configured.addToLibrary'), enabled: canTake, reason: '' },
                ];
            },
            commands: {
                addToDeck: () => { selectOption(optionIndex); return commitPick(index => onAddToDeck(index)); },
                addToLibrary: () => { selectOption(optionIndex); return commitPick(takeOptionIfUntaken); },
                take: () => { selectOption(optionIndex); return commitPick(takeOptionIfUntaken); },
            },
        } : {};
        const face = buildOptionFace(registries, activeRun, option, optionIndex, definition, inspectionOptions);
        face.classList.add('reward-choice-face');
        face.dataset.pickId = String(optionIndex);
        return face;
    }

    function appendChoice(option, optionIndex)
    {
        const isCardOption = isCardKind(option.kind);
        const definition = findOptionDefinition(registries, activeRun, option);
        const isSpent = isOptionSpent(optionIndex);
        const column = buildChoiceColumn(optionIndex, isSpent);
        const face = buildChoiceFace(option, optionIndex, definition);
        if (!isSpent)
        {
            face.addEventListener('click', () =>
            {
                handleFaceClick(face, optionIndex, isCardOption);
            });
        }
        const choiceLabel = readChoiceLabel(option, definition);
        if (isFaceRadio)
        {
            applyRadioRole(face, choiceLabel, isSpent, () => handleFaceClick(face, optionIndex, isCardOption));
        }
        const control = buildChoiceControl(choiceLabel, isSpent, optionIndex);
        control.addEventListener('click', () => onAddToDeck && (isCardOption || isEquipmentKind(option.kind))
            ? handleFaceClick(face, optionIndex, isCardOption) : selectOption(optionIndex));
        column.append(face, control);
        choiceStrip.append(column);
        choices.push({
            face,
            control,
        });
    }

    function appendChoices()
    {
        for (const [optionIndex, option] of offer.options.entries())
        {
            appendChoice(option, optionIndex);
        }
    }

    function resetReviewState()
    {
        isReviewing = false;
        isAddToDeckMode = false;
        for (const [optionIndex, { control }] of choices.entries())
        {
            control.disabled = isOptionSpent(optionIndex);
        }
        equipButton.hidden = true;
        statusLine.textContent = '';
        confirmButton.disabled = selectedIndex === null;
        renderDoor();
    }

    function returnFromReview()
    {
        resetReviewState();
        showChoiceColumns();
        confirmButton.textContent = translate(CONFIRM_LABEL_KEY);
        skipButton.textContent = translate(SKIP_LABEL_KEY);
    }

    function leaveOffer()
    {
        try
        {
            onContinue();
            isCompleted = true;
        }
        catch (error)
        {
            statusLine.textContent = error.message;
        }
    }

    function confirmLeavingWithoutReward()
    {
        OpenConfirmationModal({
            title: translate('reward.leave.question'),
            message: translate('reward.leave.message'),
            confirmLabel: translate('reward.leave.confirm'),
            cancelLabel: translate('reward.leave.take'),
            returnFocusElement: skipButton,
            onConfirm: leaveOffer,
        });
    }

    function handleSkipClick()
    {
        if (
            isClaimPending
            || isCompleted
        )
        {
            return;
        }
        if (isReviewing)
        {
            returnFromReview();
            return;
        }

        const isLeavingWithChoiceOpen = offer.claimed === null
            && !offer.taken.length
            && offer.options.length;
        if (isLeavingWithChoiceOpen)
        {
            confirmLeavingWithoutReward();
            return;
        }
        leaveOffer();
    }

    function remountWithLatestOffer()
    {
        MountGameProfileOffers(appRoot, {
            registries,
            run: activeRun,
            offer,
            title,
            onTake,
            onContinue,
            settings,
            onAddToDeck,
            addRefusal,
            onEditDeck,
            canEditDeck,
            deckMax,
            onEditEquipment,
            canEditEquipment,
            spoils,
        });
    }

    function continueAfterClaim()
    {
        try
        {
            if (
                offer.claimed !== null
                || OfferPicksLeft(offer) < 1
            )
            {
                onContinue();
                isCompleted = true;
            }
            else
            {
                remountWithLatestOffer();
            }
        }
        catch (error)
        {
            recoverFromClaimFailure(error);
        }
    }

    async function commitPick(claimOption, afterClaim = continueAfterClaim)
    {
        if (
            isClaimPending
            || isCompleted
            || selectedIndex === null
        )
        {
            return;
        }
        lockForClaim();
        try
        {
            const updatedOffer = await claimOption(selectedIndex);
            if (updatedOffer?.id === offer.id)
            {
                offer = updatedOffer;
            }
            afterClaim();
        }
        catch (error)
        {
            recoverFromClaimFailure(error);
        }
        finally
        {
            if (
                !isCompleted
                && afterClaim === continueAfterClaim
            )
            {
                isClaimPending = false;
            }
        }
    }

    function takeOptionIfUntaken(optionIndex)
    {
        return offer.taken.includes(optionIndex)
            ? undefined
            : onTake(optionIndex);
    }

    function describeRefusal(refusalCode)
    {
        return refusalCode === 'full'
            ? translate('reward.configured.deckFull', {
                max: deckMax ?? '',
            })
            : translate('reward.configured.deckLimit');
    }

    function startReview()
    {
        isReviewing = true;
        for (const { control } of choices)
        {
            control.disabled = true;
        }
        showChoiceColumns(selectedIndex);
        skipButton.textContent = translate('common.back');
        confirmButton.textContent = translate('common.continue');
        const canEquipSelection = onEditEquipment
            && canEditEquipment
            && isEquipmentKind(readSelectedKind());
        equipButton.hidden = !canEquipSelection;
        renderDoor();
    }

    function handleConfirmClick()
    {
        if (
            isClaimPending
            || isCompleted
            || selectedIndex === null
            || confirmButton.disabled
        )
        {
            return;
        }

        if (isAddToDeckMode)
        {
            return commitPick((optionIndex) => onAddToDeck(optionIndex));
        }

        const hasNothingToReview = !isReviewing
            && !isCardPicked()
            && !isEquipmentKind(readSelectedKind());
        if (hasNothingToReview)
        {
            return commitPick(takeOptionIfUntaken);
        }

        if (!isReviewing)
        {
            startReview();
            return;
        }
        return commitPick(takeOptionIfUntaken);
    }

    function openEquipmentEditor()
    {
        return onEditEquipment(selectedIndex, equipped =>
        {
            if (equipped) return continueAfterClaim();
            // The reward is already owned; cancelling its equip must leave
            // Equip and Continue available without claiming another copy.
            isClaimPending = false;
            setFooterButtonsDisabled(false);
            renderFoot();
        });
    }

    function openDeckEditor()
    {
        return onEditDeck(selectedIndex, continueAfterClaim);
    }

    function buildFooter()
    {
        return modalFooter({
            secondary: [
                skipButton,
                inspectButton,
                equipButton,
                editDeckButton,
                keepButton,
            ],
            primary: confirmButton,
            className: 'reward-foot reward-chooser-foot',
            size: 'medium',
        });
    }

    function renderDoor()
    {
        MountRewardDoor(appRoot, {
            owner: presentation.owner,
            title,
            body: [
                spoils,
                rewardNote,
                choiceStrip,
                statusLine,
            ],
            foot: buildFooter(),
        });
    }

    function renderFoot()
    {
        const footer = buildFooter();
        const wasReplaced = ReplaceRewardFoot(
            appRoot,
            presentation.owner,
            footer,
        );
        if (!wasReplaced)
        {
            renderDoor();
        }
    }
}
