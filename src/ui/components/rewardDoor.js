import { el as buildElement, modalHead } from '../kit/index.js';
import { t as translate } from '../strings.js';
import { ModalModelFor } from '../models/ModalModel.js';

const OPEN_DOOR_SELECTOR = '.reward-veil .reward-door';
// Dataset flags a previous view may have left on a door that is reused in place.
const VIEW_DATASET_KEYS = Object.freeze([
    'rewardDetail',
    'victoryCompact',
    'rewardLevel',
]);

function toKebabCase(camelCaseKey)
{
    return camelCaseKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// The open door, only when this owner mounted it.
function findOwnedDoor(appRoot, owner)
{
    const openDoor = appRoot.querySelector(OPEN_DOOR_SELECTOR);
    return openDoor && openDoor.rewardDoorOwner === owner ? openDoor : null;
}

// Shared reward modal: keeps the open door across views and owns no reward policy.
export function MountRewardDoor(
    appRoot,
    {
        owner,
        eyebrow = '',
        title,
        body,
        foot,
        attrs = {},
        status = null,
        kind = 'reward',
    },
)
{
    const model = ModalModelFor(kind);
    const head = modalHead({
        eyebrow,
        title,
        closeLabel: translate('reward.close'),
        extras: status,
    });
    head.querySelector('.modal-close').hidden = true;
    const bodyElement = buildElement(
        'div',
        {
            class: 'modal-body reward-body',
        },
        body,
    );
    const content = [
        head,
        bodyElement,
        foot,
    ];
    const ownedDoor = findOwnedDoor(appRoot, owner);
    if (ownedDoor)
    {
        for (const key of VIEW_DATASET_KEYS)
        {
            ownedDoor.removeAttribute(`data-${toKebabCase(key)}`);
            delete ownedDoor.dataset[key];
        }
        const {
            dataset = {},
            ...otherAttributes
        } = attrs;
        Object.assign(
            ownedDoor.dataset,
            {
                size: 'md',
            },
            dataset,
        );
        for (const [name, value] of Object.entries(otherAttributes))
        {
            ownedDoor.setAttribute(name, value);
        }
        ownedDoor.setAttribute('aria-label', title);
        ownedDoor.replaceChildren(...content.filter(Boolean));
        model.apply(ownedDoor);
        return ownedDoor;
    }
    appRoot.querySelector('.reward-veil')?.remove();
    if (!appRoot.firstElementChild)
    {
        const backdrop = buildElement('div', {
            class: 'screen reward-backdrop',
        });
        appRoot.appendChild(backdrop);
    }
    const modal = buildElement(
        'section',
        {
            class: 'modal reward-door',
            dataset: {
                size: 'md',
            },
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': title,
            ...attrs,
        },
        content,
    );
    modal.rewardDoorOwner = owner;
    model.apply(modal);
    const veil = buildElement(
        'div',
        {
            class: 'modal-veil reward-veil',
        },
        modal,
    );
    appRoot.appendChild(veil);
    return modal;
}

/** Swaps only the footer of the owner's open door; true when it took the new footer. */
export function ReplaceRewardFoot(appRoot, owner, foot)
{
    const ownedDoor = findOwnedDoor(appRoot, owner);
    if (!ownedDoor)
    {
        return false;
    }
    const oldFooter = [...ownedDoor.children].find((child) => child.tagName === 'FOOTER');
    if (!oldFooter)
    {
        return false;
    }
    oldFooter.replaceWith(foot);
    return true;
}
