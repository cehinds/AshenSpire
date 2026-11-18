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
import { OfferPicksLeft, IsBonusOption } from '../../model/gameProfileRewards.js';
import { armouryOpensDeckEditor, noncombatEditing } from '../../model/armouryRules.js';
import { ModalModelFor } from '../models/ModalModel.js';
import { ActivateOnKey, MarkSelected } from '../selection.js';

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
    ActivateOnKey(
        face,
        () => onPick(),
        {
            canActivate: (event) => event.target === face,
        },
    );
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

function buildCardOptionFace(registries, activeRun, option, optionIndex)
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

function buildOptionFace(registries, activeRun, option, optionIndex, definition)
{
    if (isCardKind(option.kind))
    {
        return buildCardOptionFace(registries, activeRun, option, optionIndex);
    }
    if (option.kind === RANK_UP_KIND)
    {
        return RenderRankUpOfferCard(registries, READ_ONLY_REWARD_FACE_OPTIONS).card;
    }
    if (isEquipmentKind(option.kind))
    {
        return renderEquipmentCard(registries, definition, READ_ONLY_REWARD_FACE_OPTIONS).card;
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
    initialStatus = '',
})
{
    if (isCardPickDoor(offer))
    {
        return mountCardPickDoor(appRoot, {
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
            initialStatus,
        });
    }
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
        if (IsBonusOption(offer.options[optionIndex]))
        {
            return false;
        }
        const offerWithoutBonus = {
            ...offer,
            options: offer.options.filter((option) => !IsBonusOption(option)),
            taken: offer.taken.filter((takenIndex) => !IsBonusOption(offer.options[takenIndex])),
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
            MarkSelected(
                face,
                isChosen,
                {
                    className: [
                        'reward-selected',
                        CHOSEN_CLASS,
                    ],
                    ariaAttribute: isFaceRadio
                        ? 'aria-checked'
                        : null,
                },
            );
            MarkSelected(
                control,
                isChosen,
                {
                    className: CHOSEN_CLASS,
                    ariaAttribute: 'aria-checked',
                },
            );
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

    function buildChoiceFace(option, optionIndex, definition)
    {
        const face = buildOptionFace(registries, activeRun, option, optionIndex, definition);
        face.classList.add('reward-choice-face');
        face.dataset.pickId = String(optionIndex);
        return face;
    }

    function appendChoice(option, optionIndex)
    {
        const definition = findOptionDefinition(registries, activeRun, option);
        const isSpent = isOptionSpent(optionIndex);
        const column = buildChoiceColumn(optionIndex, isSpent);
        const face = buildChoiceFace(option, optionIndex, definition);
        if (!isSpent)
        {
            face.addEventListener('click', () =>
            {
                selectOption(optionIndex);
            });
        }
        const choiceLabel = readChoiceLabel(option, definition);
        if (isFaceRadio)
        {
            applyRadioRole(face, choiceLabel, isSpent, () => selectOption(optionIndex));
        }
        const control = buildChoiceControl(choiceLabel, isSpent, optionIndex);
        control.addEventListener('click', () => selectOption(optionIndex));
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
        return onEditEquipment(selectedIndex, continueAfterClaim);
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

// Owner 2026-11-18: a door of cards (and, from a won fight, a "Rank up a card" service) is a multi-pick door.
// - The rank-up is never a tile in the strip; it is its own step (the rank-up card picker) after the cards are resolved.
//   An older saved offer that still lists it among the cards is filtered from the strip and routed to that step.
// - Up to N cards can be chosen (N = the card picks the offer still allows). A tap toggles the chosen class on the face in
//   place (the strip is never redrawn); the prompt line counts the picks left.
// - Continue is always live, neutral until all N are chosen, then primary. It opens a confirmation listing the cards.
//   One destination choice covers every chosen card: Add to deck by default, Add to library when the deck cannot take
//   them all right now (or the door has no deck route).
function isCardPickDoor(offer)
{
    return offer.options.length > 0
        && offer.options.every((option) =>
        {
            return isCardKind(option.kind)
                || option.kind === RANK_UP_KIND;
        });
}

function buildPickPrompt(picksLeft)
{
    return translate(
        picksLeft === 1
            ? 'reward.picks.prompt.one'
            : 'reward.picks.prompt.many',
        {
            count: picksLeft,
        },
    );
}

function buildDestinationButton(labelKey, destination)
{
    return button({
        label: translate(labelKey),
        className: 'reward-pick-destination',
        attrs: {
            role: 'radio',
            dataset: {
                destination,
            },
        },
    });
}

function buildPickConfirmDetails({
    names,
    unused,
    canDeck,
    toDeck,
    onDestination,
})
{
    const details = buildElement('div', {
        class: 'reward-pick-confirm',
    });
    if (names.length)
    {
        details.append(buildElement(
            'ul',
            {
                class: 'reward-pick-confirm-list',
            },
            names.map((name) => buildElement('li', {
                text: name,
            })),
        ));
    }
    else
    {
        details.append(buildElement('p', {
            text: translate('reward.picks.continue.none'),
        }));
    }
    if (unused > 0)
    {
        details.append(buildElement('p', {
            class: 'reward-pick-confirm-unused',
            text: translate(
                unused === 1
                    ? 'reward.picks.continue.unusedOne'
                    : 'reward.picks.continue.unusedMany',
                {
                    count: unused,
                },
            ),
        }));
    }
    if (!names.length)
    {
        return details;
    }
    const deckButton = buildDestinationButton('reward.configured.addToDeck', 'deck');
    deckButton.disabled = !canDeck;
    const libraryButton = buildDestinationButton('reward.configured.addToLibrary', 'library');
    const mark = (isDeck) =>
    {
        for (const [node, isChosen] of [[deckButton, isDeck], [libraryButton, !isDeck]])
        {
            node.classList.toggle(CHOSEN_CLASS, isChosen);
            node.setAttribute('aria-checked', String(isChosen));
        }
        onDestination(isDeck);
    };
    deckButton.addEventListener('click', () =>
    {
        if (!deckButton.disabled)
        {
            mark(true);
        }
    });
    libraryButton.addEventListener('click', () => mark(false));
    mark(toDeck);
    details.append(buildElement('div', {
        class: 'reward-pick-destinations',
        role: 'radiogroup',
        'aria-label': translate('reward.picks.destination.label'),
    }, [deckButton, libraryButton]));
    if (!canDeck)
    {
        details.append(buildElement('p', {
            class: 'reward-pick-confirm-unused',
            text: translate('reward.picks.destination.deckFull'),
        }));
    }
    return details;
}

function mountCardPickDoor(appRoot, doorArgs)
{
    const {
        registries,
        run: activeRun,
        title,
        onTake,
        onContinue,
        onAddToDeck,
        addRefusal,
        deckMax,
        spoils,
        initialStatus,
    } = doorArgs;
    let { offer } = doorArgs;
    clearSelection();
    const presentation = findOrCreateDoorPresentation(activeRun, offer.id);
    const cardIndexes = offer.options.flatMap((option, optionIndex) =>
    {
        return isCardKind(option.kind)
            ? [optionIndex]
            : [];
    });
    const takenCards = offer.taken.filter((takenIndex) => isCardKind(offer.options[takenIndex]?.kind)).length;
    const picksAllowed = offer.claimed !== null
        ? 0
        : Math.max(0, Math.min(offer.takeCount, cardIndexes.length) - takenCards);
    const choiceStrip = buildChoiceStrip('reward.picks.aria', cardIndexes.length);
    choiceStrip.setAttribute('role', 'group');
    const promptLine = buildElement('p', {
        class: 'reward-note reward-pick-prompt',
        'aria-live': 'polite',
    });
    const statusLine = buildStatusLine();
    statusLine.textContent = initialStatus || '';
    const continueButton = button({
        label: translate('common.continue'),
        id: 'reward-card-confirm',
        className: 'reward-confirm',
    });
    const skipButton = button({
        label: translate(SKIP_LABEL_KEY),
        id: 'reward-continue',
        className: 'danger',
    });
    const isFaceRadio = !ModalModelFor('reward').showNameButton;
    const choices = new Map();
    const selected = new Set();
    let isBusy = false;
    let isCompleted = false;
    let isRankUpDeclined = false;
    let areCardsClaimed = false;

    for (const optionIndex of cardIndexes)
    {
        appendCard(optionIndex);
    }
    skipButton.addEventListener('click', handleSkip);
    continueButton.addEventListener('click', handleContinue);
    MountRewardDoor(appRoot, {
        owner: presentation.owner,
        title,
        body: [
            spoils,
            promptLine,
            choiceStrip,
            statusLine,
        ],
        foot: modalFooter({
            secondary: [skipButton],
            primary: continueButton,
            className: 'reward-foot reward-chooser-foot',
            size: 'medium',
        }),
    });
    // After the mount: the footer marks its primary slot as primary, and Continue is neutral until every pick is made.
    refresh();
    if (picksAllowed < 1)
    {
        // Nothing left to pick (a reload after the cards, or an offer of only the rank-up): go on to the next step.
        queueMicrotask(afterCards);
    }

    function isSpent(optionIndex)
    {
        return offer.taken.includes(optionIndex)
            || offer.claimed !== null
            || picksAllowed < 1;
    }

    function appendCard(optionIndex)
    {
        const option = offer.options[optionIndex];
        const definition = findOptionDefinition(registries, activeRun, option);
        const spent = isSpent(optionIndex);
        const column = buildChoiceColumn(optionIndex, spent);
        const face = buildOptionFace(registries, activeRun, option, optionIndex, definition);
        face.classList.add('reward-choice-face');
        face.dataset.pickId = String(optionIndex);
        const label = readChoiceLabel(option, definition);
        const control = buildChoiceControl(label, spent, optionIndex);
        control.setAttribute('role', 'checkbox');
        if (isFaceRadio)
        {
            applyRadioRole(face, label, spent, () => toggle(optionIndex));
            face.setAttribute('role', 'checkbox');
        }
        if (!spent)
        {
            face.addEventListener('click', () => toggle(optionIndex));
            control.addEventListener('click', () => toggle(optionIndex));
        }
        column.append(face, control);
        choiceStrip.append(column);
        choices.set(optionIndex, {
            face,
            control,
        });
    }

    function toggle(optionIndex)
    {
        if (
            isBusy
            || isCompleted
            || isSpent(optionIndex)
        )
        {
            return;
        }
        statusLine.textContent = '';
        if (selected.has(optionIndex))
        {
            selected.delete(optionIndex);
        }
        else if (selected.size < picksAllowed)
        {
            selected.add(optionIndex);
        }
        else if (picksAllowed === 1)
        {
            // A single pick moves with the tap, like a radio.
            selected.clear();
            selected.add(optionIndex);
        }
        else
        {
            statusLine.textContent = translate('reward.picks.full', {
                count: picksAllowed,
            });
        }
        refresh();
    }

    function refresh()
    {
        for (const [optionIndex, { face, control }] of choices)
        {
            const isChosen = selected.has(optionIndex);
            MarkSelected(face, isChosen, {
                className: [
                    'reward-selected',
                    CHOSEN_CLASS,
                ],
                ariaAttribute: isFaceRadio
                    ? 'aria-checked'
                    : null,
            });
            MarkSelected(control, isChosen, {
                className: CHOSEN_CLASS,
                ariaAttribute: 'aria-checked',
            });
        }
        promptLine.textContent = buildPickPrompt(picksAllowed - selected.size);
        // Neutral until every pick is made, then the door's one green (primary) action.
        const isComplete = selected.size >= picksAllowed;
        continueButton.classList.toggle('primary', isComplete);
        continueButton.dataset.controlRole = isComplete
            ? 'primary'
            : 'utility';
    }

    function setBusy(isNowBusy)
    {
        isBusy = isNowBusy;
        continueButton.disabled = isNowBusy;
        skipButton.disabled = isNowBusy;
        choiceStrip.inert = isNowBusy;
    }

    function deckRoom()
    {
        return Number.isFinite(deckMax) && Array.isArray(activeRun.deck)
            ? deckMax - activeRun.deck.length
            : Infinity;
    }

    function canAllJoinDeck(picks)
    {
        return !!onAddToDeck
            && picks.length <= deckRoom()
            && picks.every((optionIndex) => !(addRefusal && addRefusal(optionIndex)));
    }

    function handleContinue()
    {
        if (
            isBusy
            || isCompleted
        )
        {
            return;
        }
        if (
            picksAllowed < 1
            || areCardsClaimed
        )
        {
            // Nothing left to claim (or the claim is done and only the exit is being retried).
            afterCards();
            return;
        }
        const picks = [...selected].sort((a, b) => a - b);
        const canDeck = canAllJoinDeck(picks);
        let toDeck = canDeck;
        OpenConfirmationModal({
            title: translate('reward.picks.continue.title'),
            message: picks.length
                ? translate('reward.picks.continue.message')
                : '',
            detailsNode: buildPickConfirmDetails({
                names: picks.map((optionIndex) =>
                {
                    return findOptionDefinition(registries, activeRun, offer.options[optionIndex])?.name
                        || offer.options[optionIndex].id;
                }),
                unused: picksAllowed - picks.length,
                canDeck,
                toDeck,
                onDestination: (isDeck) =>
                {
                    toDeck = isDeck;
                },
            }),
            confirmLabel: translate(CONFIRM_LABEL_KEY),
            cancelLabel: translate('common.back'),
            returnFocusElement: continueButton,
            onConfirm: () => claimChosen(picks, () => toDeck),
        });
    }

    function adoptOffer(result)
    {
        if (
            result?.id === offer.id
            && Array.isArray(result.taken)
        )
        {
            offer = result;
        }
    }

    async function claimOne(optionIndex, toDeck)
    {
        if (!toDeck)
        {
            return onTake(optionIndex);
        }
        try
        {
            return await onAddToDeck(optionIndex);
        }
        catch
        {
            // The deck refused this one after all: it stays in the library instead of stalling the claim.
            return onTake(optionIndex);
        }
    }

    async function claimChosen(picks, readToDeck)
    {
        setBusy(true);
        const toDeck = readToDeck();
        try
        {
            for (const optionIndex of picks)
            {
                if (!offer.taken.includes(optionIndex))
                {
                    adoptOffer(await claimOne(optionIndex, toDeck));
                }
            }
        }
        catch (error)
        {
            // Cards already claimed stay claimed: draw the door again from the saved offer, with the reason.
            MountGameProfileOffers(appRoot, {
                ...doorArgs,
                offer: activeRun.gameProfileRewardOffers?.[offer.id] || offer,
                initialStatus: error.message,
            });
            return;
        }
        areCardsClaimed = true;
        setBusy(false);
        afterCards();
    }

    function handleSkip()
    {
        if (
            isBusy
            || isCompleted
        )
        {
            return;
        }
        if (
            offer.taken.length
            || picksAllowed < 1
        )
        {
            afterCards();
            return;
        }
        OpenConfirmationModal({
            title: translate('reward.leave.question'),
            message: translate('reward.leave.message'),
            confirmLabel: translate('reward.leave.confirm'),
            cancelLabel: translate('reward.leave.take'),
            returnFocusElement: skipButton,
            onConfirm: afterCards,
        });
    }

    // The step after the cards: the rank-up card picker when a rank-up is still owed, else the door's own exit.
    function afterCards()
    {
        if (
            isBusy
            || isCompleted
        )
        {
            return;
        }
        const rankUpIndex = isRankUpDeclined
            ? -1
            : offer.options.findIndex((option, optionIndex) =>
            {
                return option.kind === RANK_UP_KIND
                    && !offer.taken.includes(optionIndex);
            });
        if (rankUpIndex < 0)
        {
            finish();
            return;
        }
        setBusy(true);
        Promise.resolve()
            .then(() => onTake(rankUpIndex))
            .then((result) =>
            {
                adoptOffer(result);
                setBusy(false);
                finish();
            }, (error) =>
            {
                setBusy(false);
                isRankUpDeclined = true;
                if (error?.message)
                {
                    statusLine.textContent = error.message;
                    return;
                }
                // The picker was closed without a card: the rank-up is declined and the chain goes on.
                finish();
            });
    }

    function finish()
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
}
