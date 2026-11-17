// @ts-check
// Compiled only. Each implementation must satisfy its contract; each expected error proves a
// non-conforming implementation fails the check.
/**
 * @import {
 *     FeedbackChannel,
 *     KeyActivator,
 *     Modal,
 *     ModalPresentation,
 *     MountEffectLayers,
 *     Picker,
 *     PlayEffectLayers,
 *     Pressable,
 *     RailItem,
 *     RovingNavigator,
 *     Screen,
 *     SelectionMarker,
 * } from '../../../src/ui/contracts.js'
 */
import { sfx } from '../../../src/ui/sfx.js';
import { haptic } from '../../../src/ui/haptics.js';
import { CreateCueChannel } from '../../../src/ui/cueChannel.js';
import { optionRowList, markOptionRows } from '../../../src/ui/components/optionRowList.js';
import { OpenModal } from '../../../src/ui/components/modalShell.js';
import { ModalModel, ModalModelFor } from '../../../src/ui/models/ModalModel.js';
import { armouryRailItems } from '../../../src/ui/models/ArmouryWorkspaceModel.js';
import { creationRailItems } from '../../../src/ui/models/CreationWorkspaceModel.js';
import { mountCardEffectLayers, playCardEffectLayers } from '../../../src/ui/cardEffectLayers.js';
import { ActivateOnKey, MarkSelected, RovingList } from '../../../src/ui/selection.js';
import { ArmLongPress, GuardOnce } from '../../../src/ui/pressable.js';
import { mountCombatantEffectLayers } from '../../../src/ui/combatantEffectLayers.js';
import { MountKnowledgeDoor } from '../../../src/ui/components/knowledgeDoor.js';

/** @type {FeedbackChannel[]} */
export const feedbackChannels = [sfx, haptic, CreateCueChannel()];

/** @type {Picker} */
export const rowPicker = { render: optionRowList, mark: markOptionRows };

/** @type {Modal} */
export const shellModal = OpenModal({ title: 'Contract' });

/** @type {ModalPresentation[]} */
export const modalPresentations = [ModalModelFor('base'), new ModalModel('base', {})];

/** @type {ReadonlyArray<RailItem>[]} */
export const railLists = [
    armouryRailItems(),
    creationRailItems({ categories: [], current: '' }),
];

/** @type {MountEffectLayers[]} */
export const effectLayerMounts = [mountCardEffectLayers, mountCombatantEffectLayers];

/** @type {PlayEffectLayers} */
export const cardEffectPlay = playCardEffectLayers;

/** @type {FeedbackChannel} */
// @ts-expect-error A feedback channel keeps the recent cue ids.
export const channelWithoutRecent = { sink: null, play() {} };

/** @type {FeedbackChannel} */
export const channelWithNumericCues = {
    sink: null,
    recent: [],
    // @ts-expect-error Cue ids are text.
    play(/** @type {number} */ cueId) { void cueId; },
};

/** @type {Picker} */
// @ts-expect-error A picker marks its selected rows.
export const pickerWithoutMark = { render: optionRowList };

/** @type {Modal} */
// @ts-expect-error A modal can be closed.
export const modalWithoutClose = { update() {} };

/** @implements {ModalPresentation} */
export class PresentationWithNumericProperties
{
    kind = 'base';
    /** @type {Record<string, unknown>} */
    config = {};
    // @ts-expect-error CSS custom properties map names to text values.
    cssProperties() { return { '--modal-gap': 4 }; }
    apply(/** @type {HTMLElement} */ panel) { return panel; }
}

/** @type {SelectionMarker} */
export const selectionMarker = MarkSelected;

/** @type {KeyActivator} */
export const keyActivator = ActivateOnKey;

/** @type {RovingNavigator} */
export const rovingNavigator = RovingList;

/** @type {SelectionMarker} */
// @ts-expect-error A selection marker takes its options as an object.
export const markerWithTextOptions = (nodes, isSelected, /** @type {string} */ options) => void options;

/** @type {KeyActivator} */
// @ts-expect-error A key activator returns its disarm.
export const activatorWithoutDisarm = () => undefined;

/** @type {RovingNavigator} */
export const navigatorWithBadOrientation = (listElement) =>
{
    // @ts-expect-error Orientation is vertical, horizontal or both.
    return RovingList(listElement, { orientation: 'diagonal' });
};

/** @type {Pressable} */
export const pressable = {
    armLongPress: ArmLongPress,
    guardOnce: GuardOnce,
};

/** @type {Pressable} */
export const pressableWithTextHold = {
    ...pressable,
    // @ts-expect-error A long press is timed in milliseconds.
    armLongPress: (element, /** @type {{ holdMs: string }} */ options) => () => void [element, options],
};

/** @type {Screen} */
export const knowledgeDoorScreen = MountKnowledgeDoor;

/** @type {Screen} */
// @ts-expect-error A screen mounts into its host element.
export const screenWithTextHost = (/** @type {string} */ host) => void host;

/** @type {Screen} */
// @ts-expect-error A screen's teardown is a function.
export const screenWithTextDispose = () => ({ dispose: 'now' });
