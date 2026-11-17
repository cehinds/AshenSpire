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

// A face that only reads: the chooser owns the pick.
const READ_ONLY_FACE_OPTIONS = Object.freeze({
    interactive: false,
    inspection: true,
    actionOwnsTouch: true,
    level: 'glance'
});

const isCardKind = (kind) => CARD_KINDS.includes(kind);
const isEquipmentKind = (kind) => EQUIPMENT_KINDS.includes(kind);
const READ_ONLY_REWARD_FACE_OPTIONS = Object.freeze({
    ...READ_ONLY_FACE_OPTIONS,
    surface: 'reward',
});

// With the name button hidden (modal.json), the card face is the radio.
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
        // Keys on a control inside the face (the info badge) stay that control's.
        if (event.target !== face || (event.key !== 'Enter' && event.key !== ' '))
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
                surface: 'reward',
                level: 'glance',
                actionOwnsTouch: true,
                // The selected card shows the same (i) badge as the combat hand; it opens the inspector.
                infoBadge: true,
                // Reading a reward never chooses it; the chooser owns that action.
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
    const collectibleLabel = option.kind === POTION_KIND ? 'Potion' : 'Relic';
    return renderCollectibleCard(
        registries,
        definition,
        collectibleLabel,
        READ_ONLY_FACE_OPTIONS,
    ).card;
}

// Presentation ownership stays outside the serializable run and offer data.
const rewardDoorOwners = new WeakMap();

/** The string keys for a reward door's aria label and note. */
export function RewardDoorCopy(offer, activeRun, settings)
{
    const offersCard = offer.options.some((option) => isCardKind(option.kind));
    // A door with no card on it (Elite spoils: relics only) must not talk about cards or the deck.
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

/** Mounts the reward chooser: option columns, explicit select then confirm; claims stay host-owned. */
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
    const copy = RewardDoorCopy(offer, activeRun, settings);
    const choiceStrip = buildElement('div', {
        class: 'reward-row reward-choice-grid',
        role: 'radiogroup',
        'aria-label': translate(copy.aria),
    });
    choiceStrip.style.setProperty('--choice-count', String(offer.options.length));
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
    // A bonus rank-up is an extra pick: card picks end after takeCount, the bonus when taken.
    const isOptionSpent = (index) =>
    {
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
    };
    let selectedIndex = null;
    let pending = false;
    let reviewing = false;
    let completed = false;
    let addToDeckMode = false;
    const choices = [];
    const faceIsRadio = !ModalModelFor('reward').showNameButton;
    const selectedKind = () => offer.options[selectedIndex]?.kind;
    const isCardPicked = () => selectedIndex !== null && isCardKind(selectedKind());
    // Confirm, Skip, Edit deck, Equip and Keep move together; Inspect has its own rules.
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
    // Shows every option column, or only the one at onlyIndex.
    function showChoiceColumns(onlyIndex = null)
    {
        for (const column of choiceStrip.children)
        {
            column.hidden = onlyIndex !== null && Number(column.dataset.pickId) !== onlyIndex;
        }
    }
    function selectOption(index)
    {
        if (pending || reviewing || completed || isOptionSpent(index))
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
        inspectButton.setAttribute('aria-label', translate('deckEditor.inspectNamed', {
            name: choices[index].control.textContent,
        }));
        status.textContent = '';
        syncCardActions();
    }
    // A selected card shows [Edit deck, Add to library, Add to deck] at once; other kinds keep Confirm / Inspect.
    function syncCardActions()
    {
        const cardMode = !!(onAddToDeck && isCardPicked());
        const changed = cardMode !== addToDeckMode;
        addToDeckMode = cardMode;
        inspectButton.hidden = cardMode;
        editDeckButton.hidden = !(cardMode && onEditDeck && canEditDeck);
        keepButton.hidden = !cardMode;
        confirmButton.textContent = translate(cardMode ? 'reward.configured.addToDeck' : CONFIRM_LABEL_KEY);
        const refusal = cardMode && addRefusal ? addRefusal(selectedIndex) : '';
        confirmButton.disabled = !!refusal;
        if (refusal)
        {
            status.textContent = refusalText(refusal);
        }
        // Selecting a card must not rebuild the door: only the footer's buttons change.
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
        const ownedClass = unavailable ? ' is-owned' : '';
        const column = buildElement('div', {
            class: `reward-choice-option${ownedClass}`,
            dataset: {
                pickId: String(index),
            },
        });
        const face = renderOptionFace(registries, activeRun, option, index, definition);
        face.classList.add('reward-choice-face');
        face.dataset.pickId = String(index);
        // First tap selects; a tap on the already-selected card face opens the inspector.
        if (!unavailable)
        {
            face.addEventListener('click', () =>
            {
                if (isCard && selectedIndex === index && !pending && !reviewing && !completed)
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
    const resetReview = () =>
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
    };
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
        const leaveOffer = () =>
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
        };
        // Leaving with a choice open and nothing taken asks once; otherwise it goes straight on.
        if (offer.claimed === null && !offer.taken.length && offer.options.length)
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
    // After a claim: leave when the offer is spent, else show the next pick. Also the way back from the deck editor.
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
    const claimIfOpen = (index) => offer.taken.includes(index) ? undefined : onTake(index);
    const refusalText = (code) => code === 'full'
        ? translate('reward.configured.deckFull', {
            max: deckMax ?? '',
        })
        : translate('reward.configured.deckLimit');
    confirmButton.addEventListener('click', () =>
    {
        if (pending || completed || selectedIndex === null || confirmButton.disabled)
        {
            return;
        }
        if (addToDeckMode)
        {
            return commitPick((index) => onAddToDeck(index));
        }
        // A relic or flask has nothing to review: Confirm takes it. Weapons and armour keep the review foot.
        if (!reviewing && !isCardPicked() && !isEquipmentKind(selectedKind()))
        {
            return commitPick(claimIfOpen);
        }
        if (!reviewing)
        {
            reviewing = true;
            // Keep the selected face's Information control available in review.
            for (const { control } of choices)
            {
                control.disabled = true;
            }
            showChoiceColumns(selectedIndex);
            skipButton.textContent = translate('common.back');
            confirmButton.textContent = translate('common.continue');
            const canEquipSelection = onEditEquipment && canEditEquipment
                && isEquipmentKind(selectedKind());
            equipButton.hidden = !canEquipSelection;
            mountDoor();
            return;
        }
        return commitPick(claimIfOpen);
    });
    keepButton.addEventListener('click', () => commitPick(claimIfOpen));
    const openEquipmentEditor = () => onEditEquipment(selectedIndex, proceed);
    const openDeckEditor = () => onEditDeck(selectedIndex, proceed);
    equipButton.addEventListener('click', () => commitPick(claimIfOpen, openEquipmentEditor));
    editDeckButton.addEventListener('click', () => commitPick(claimIfOpen, openDeckEditor));
    // The footer drops hidden buttons when built, so the door is rebuilt (same owner: in place) when the review changes them.
    const buildFooter = () => modalFooter({
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
    // Swap only the footer in the open door; falls back to a full mount when no door of this owner is open.
    function mountFoot()
    {
        if (!ReplaceRewardFoot(appRoot, presentation.owner, buildFooter()))
        {
            mountDoor();
        }
    }
    mountDoor();
}
