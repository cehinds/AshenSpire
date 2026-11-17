// @ts-check
// Compiled only. Each implementation must satisfy its contract; each expected error proves a
// non-conforming implementation fails the check.
/**
 * @import {
 *     FeedbackChannel,
 *     Modal,
 *     ModalPresentation,
 *     MountEffectLayers,
 *     Picker,
 *     PlayEffectLayers,
 *     RailItem,
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
import { mountCombatantEffectLayers } from '../../../src/ui/combatantEffectLayers.js';

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
