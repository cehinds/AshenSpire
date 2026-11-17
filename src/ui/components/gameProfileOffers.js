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

const rewardDoorOwners = new WeakMap();

function isCardKind(kind)
{
    return CARD_KINDS.includes(kind);
}

function isEquipmentKind(kind)
{
    return EQUIPMENT_KINDS.includes(kind);
}

function faceAsRadio(face, label, disabled, onPick)
{
    face.setAttribute('role', 'radio');
    face.setAttribute('aria-checked', 'false');
    face.setAttribute('aria-label', label);
    if (disabled)
    {
        face.setAttribute('aria-disabled', 'true');
        return;
    }
    face.tabIndex = 0;
    face.addEventListener('keydown', (event) =>
    {
        // Keys on the info badge inside the face stay the badge's.
        const isPickKey = event.key === 'Enter' || event.key === ' ';
        if (event.target !== face || !isPickKey)
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
            return registries.equipment.armaments.find((item) => item.id === option.id);
        default:
            return registries.equipment.armour.find((item) =>
            {
                return item.id === option.id && item.classId === activeRun.class;
            });
    }
}

function renderOptionFace(registries, activeRun, option, index, definition)
{
    if (isCardKind(option.kind))
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
                instanceId: `offer:${index}`,
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
    if (option.kind === RANK_UP_KIND)
    {
        return RenderRankUpOfferCard(registries, READ_ONLY_REWARD_FACE_OPTIONS).card;
    }
    if (isEquipmentKind(option.kind))
    {
        return renderEquipmentCard(registries, definition, READ_ONLY_REWARD_FACE_OPTIONS).card;
    }
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

export function RewardDoorCopy(offer, activeRun, settings)
{
    const offersCard = offer.options.some((option) => isCardKind(option.kind));
    const note = !offersCard
        ? 'reward.configured.noteItems'
        : !noncombatEditing(activeRun)
        ? 'reward.configured.note'
        : armouryOpensDeckEditor(activeRun, settings)
        ? 'reward.configured.noteArmoury'
        : 'reward.configured.noteNoEditor';
    return {
        aria: offersCard ? 'reward.card.aria' : 'reward.choice.aria',
        note,
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
    let presentation = rewardDoorOwners.get(activeRun);
    if (!presentation || presentation.offerId !== offer.id)
    {
        presentation = {
            offerId: offer.id,
            owner: {},
        };
        rewardDoorOwners.set(activeRun, presentation);
    }
    const copy = RewardDoorCopy(
        offer,
        activeRun,
        settings,
    );
    const choiceStrip = buildElement('div', {
        class: 'reward-row reward-choice-grid',
        role: 'radiogroup',
        'aria-label': translate(copy.aria),
    });
    choiceStrip.style.setProperty(
        '--choice-count',
        String(offer.options.length),
    );
    const hasBonus = offer.options.some((option) => option.bonus);
    const noteKey = hasBonus ? 'reward.configured.noteBonus' : copy.note;
    const note = buildElement('p', {
        class: 'reward-note',
        text: translate(noteKey, {
            count: offer.takeCount,
        }),
    });
    const status = buildElement('p', {
        class: 'reward-confirm-status',
        role: 'alert',
    });
    const confirmButton = button({
        label: translate(CONFIRM_LABEL_KEY),
        weight: 'primary',
        id: 'reward-card-confirm',
        className: 'reward-confirm',
        disabled: true,
    });
    const inspectButton = button({
        label: translate('deckEditor.inspectAction'),
        id: 'reward-inspect',
        disabled: true,
    });
    inspectButton.addEventListener('click', () =>
    {
        if (!pending && !completed && selectedIndex !== null)
        {
            openBoundCardInspection(choices[selectedIndex].face, inspectButton);
        }
    });
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
    function isOptionSpent(index)
    {
        // A bonus rank-up is an extra pick, spent only when taken.
        if (offer.taken.includes(index) || offer.claimed !== null)
        {
            return true;
        }
        if (offer.options[index]?.bonus)
        {
            return false;
        }
        const offerWithoutBonus = {
            ...offer,
            options: offer.options.filter((candidate) => !candidate.bonus),
            taken: offer.taken.filter((takenIndex) => !offer.options[takenIndex]?.bonus),
        };
        return OfferPicksLeft(offerWithoutBonus) < 1;
    }

    let selectedIndex = null;
    let pending = false;
    let reviewing = false;
    let completed = false;
    let addToDeckMode = false;
    const choices = [];
    const faceIsRadio = !ModalModelFor('reward').showNameButton;

    function selectedKind()
    {
        return offer.options[selectedIndex]?.kind;
    }

    function isCardPicked()
    {
        return selectedIndex !== null && isCardKind(selectedKind());
    }

    function setFooterButtonsDisabled(disabled)
    {
        confirmButton.disabled = disabled;
        skipButton.disabled = disabled;
        editDeckButton.disabled = disabled;
        equipButton.disabled = disabled;
        keepButton.disabled = disabled;
    }
    function lockForClaim()
    {
        inspectButton.disabled = true;
        choiceStrip.inert = true;
        pending = true;
        setFooterButtonsDisabled(true);
    }
    function recoverFromFailure(error)
    {
        pending = false;
        inspectButton.disabled = completed;
        choiceStrip.inert = completed;
        status.textContent = error.message;
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
    function selectOption(index)
    {
        if (
            pending
            || reviewing
            || completed
            || isOptionSpent(index)
        )
        {
            return;
        }

        selectedIndex = index;
        for (const [choiceIndex, { face, control }] of choices.entries())
        {
            const chosen = choiceIndex === selectedIndex;
            face.classList.toggle('reward-selected', chosen);
            face.classList.toggle(CHOSEN_CLASS, chosen);
            control.classList.toggle(CHOSEN_CLASS, chosen);
            control.setAttribute('aria-checked', String(chosen));
            if (faceIsRadio)
            {
                face.setAttribute('aria-checked', String(chosen));
            }
        }
        confirmButton.disabled = false;
        inspectButton.disabled = false;
        const inspectLabel = translate('deckEditor.inspectNamed', {
            name: choices[index].control.textContent,
        });
        inspectButton.setAttribute('aria-label', inspectLabel);
        status.textContent = '';
        syncCardActions();
    }
    function syncCardActions()
    {
        const cardMode = !!(onAddToDeck && isCardPicked());
        const changed = cardMode !== addToDeckMode;
        addToDeckMode = cardMode;
        inspectButton.hidden = cardMode;
        editDeckButton.hidden = !(cardMode && onEditDeck && canEditDeck);
        keepButton.hidden = !cardMode;
        const confirmKey = cardMode
            ? 'reward.configured.addToDeck'
            : CONFIRM_LABEL_KEY;
        confirmButton.textContent = translate(confirmKey);
        const refusal = cardMode && addRefusal
            ? addRefusal(selectedIndex)
            : '';
        confirmButton.disabled = !!refusal;
        if (refusal)
        {
            status.textContent = refusalText(refusal);
        }
        // Selecting a card must not rebuild the door: only the footer changes.
        if (changed)
        {
            mountFoot();
        }
    }
    for (const [index, option] of offer.options.entries())
    {
        const isCard = isCardKind(option.kind);
        const definition = findOptionDefinition(registries, activeRun, option);
        const unavailable = isOptionSpent(index);
        const ownedClass = unavailable
            ? ' is-owned'
            : '';
        const column = buildElement('div', {
            class: `reward-choice-option${ownedClass}`,
            dataset: {
                pickId: String(index),
            },
        });
        const face = renderOptionFace(registries, activeRun, option, index, definition);
        face.classList.add('reward-choice-face');
        face.dataset.pickId = String(index);
        if (!unavailable)
        {
            face.addEventListener('click', () =>
            {
                const canInspect = isCard
                    && selectedIndex === index
                    && !pending
                    && !reviewing
                    && !completed;
                if (canInspect)
                {
                    openBoundCardInspection(face, face);
                }
                else
                {
                    selectOption(index);
                }
            });
        }
        const label = option.bonus
            ? translate('rankUp.bonusLabel', {
                name: definition.name,
            })
            : definition.name;
        if (faceIsRadio)
        {
            faceAsRadio(face, label, unavailable, () => selectOption(index));
        }
        const control = button({
            label,
            disabled: unavailable,
            className: 'class-pick reward-node reward-pick reward-choice-button',
            attrs: {
                type: 'button',
                role: 'radio',
                'aria-checked': 'false',
                dataset: {
                    pickId: String(index),
                },
            },
        });
        control.addEventListener('click', () => selectOption(index));
        column.append(face, control);
        choiceStrip.append(column);
        choices.push({
            face,
            control,
        });
    }
    function resetReview()
    {
        reviewing = false;
        addToDeckMode = false;
        for (const [index, { control }] of choices.entries())
        {
            control.disabled = isOptionSpent(index);
        }
        equipButton.hidden = true;
        status.textContent = '';
        confirmButton.disabled = selectedIndex === null;
        mountDoor();
    }

    skipButton.addEventListener('click', () =>
    {
        if (pending || completed)
        {
            return;
        }
        if (reviewing)
        {
            resetReview();
            showChoiceColumns();
            confirmButton.textContent = translate(CONFIRM_LABEL_KEY);
            skipButton.textContent = translate(SKIP_LABEL_KEY);
            return;
        }

        function leaveOffer()
        {
            try
            {
                onContinue();
                completed = true;
            }
            catch (error)
            {
                status.textContent = error.message;
            }
        }

        const isLeavingWithChoiceOpen = offer.claimed === null
            && !offer.taken.length
            && offer.options.length;
        if (isLeavingWithChoiceOpen)
        {
            OpenConfirmationModal({
                title: translate('reward.leave.question'),
                message: translate('reward.leave.message'),
                confirmLabel: translate('reward.leave.confirm'),
                cancelLabel: translate('reward.leave.take'),
                returnFocusElement: skipButton,
                onConfirm: leaveOffer,
            });
            return;
        }
        leaveOffer();
    });
    function proceed()
    {
        try
        {
            if (offer.claimed !== null || OfferPicksLeft(offer) < 1)
            {
                onContinue();
                completed = true;
            }
            else
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
        }
        catch (error)
        {
            recoverFromFailure(error);
        }
    }
    async function commitPick(claimOption, afterClaim = proceed)
    {
        if (pending || completed || selectedIndex === null)
        {
            return;
        }
        lockForClaim();
        try
        {
            const updated = await claimOption(selectedIndex);
            if (updated?.id === offer.id)
            {
                offer = updated;
            }
            afterClaim();
        }
        catch (error)
        {
            recoverFromFailure(error);
        }
        finally
        {
            if (!completed && afterClaim === proceed)
            {
                pending = false;
            }
        }
    }

    function claimIfOpen(index)
    {
        return offer.taken.includes(index)
            ? undefined
            : onTake(index);
    }

    function refusalText(code)
    {
        return code === 'full'
            ? translate('reward.configured.deckFull', {
                max: deckMax ?? '',
            })
            : translate('reward.configured.deckLimit');
    }

    confirmButton.addEventListener('click', () =>
    {
        if (
            pending
            || completed
            || selectedIndex === null
            || confirmButton.disabled
        )
        {
            return;
        }

        if (addToDeckMode)
        {
            return commitPick((index) => onAddToDeck(index));
        }

        const hasNothingToReview = !reviewing
            && !isCardPicked()
            && !isEquipmentKind(selectedKind());
        if (hasNothingToReview)
        {
            return commitPick(claimIfOpen);
        }

        if (!reviewing)
        {
            reviewing = true;
            for (const { control } of choices)
            {
                control.disabled = true;
            }
            showChoiceColumns(selectedIndex);
            skipButton.textContent = translate('common.back');
            confirmButton.textContent = translate('common.continue');
            const canEquipSelection = onEditEquipment
                && canEditEquipment
                && isEquipmentKind(selectedKind());
            equipButton.hidden = !canEquipSelection;
            mountDoor();
            return;
        }
        return commitPick(claimIfOpen);
    });
    keepButton.addEventListener('click', () => commitPick(claimIfOpen));

    function openEquipmentEditor()
    {
        return onEditEquipment(selectedIndex, proceed);
    }

    function openDeckEditor()
    {
        return onEditDeck(selectedIndex, proceed);
    }

    equipButton.addEventListener('click', () => commitPick(claimIfOpen, openEquipmentEditor));
    editDeckButton.addEventListener('click', () => commitPick(claimIfOpen, openDeckEditor));

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

    function mountDoor()
    {
        MountRewardDoor(appRoot, {
            owner: presentation.owner,
            title,
            body: [
                spoils,
                note,
                choiceStrip,
                status,
            ],
            foot: buildFooter(),
        });
    }
    function mountFoot()
    {
        const footer = buildFooter();
        const wasReplaced = ReplaceRewardFoot(
            appRoot,
            presentation.owner,
            footer,
        );
        if (!wasReplaced)
        {
            mountDoor();
        }
    }
    mountDoor();
}
