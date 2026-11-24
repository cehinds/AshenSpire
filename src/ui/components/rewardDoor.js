import { el as buildElement, modalHead } from '../kit/index.js';
import { t as translate } from '../strings.js';
import { ModalModelFor } from '../models/ModalModel.js';

const OPEN_DOOR_SELECTOR = '.reward-veil .reward-door';
const VIEW_DATASET_KEYS = Object.freeze([
    'rewardDetail',
    'victoryCompact',
    'rewardLevel',
]);

function toKebabCase(camelCaseKey)
{
    return camelCaseKey.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
    );
}

function findOwnedDoor(appRoot, owner)
{
    const openDoor = appRoot.querySelector(OPEN_DOOR_SELECTOR);
    const isOwned = openDoor
        && openDoor.rewardDoorOwner === owner;
    return isOwned
        ? openDoor
        : null;
}

function buildDoorContent({
    eyebrow,
    title,
    body,
    foot,
    status,
})
{
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
    return [
        head,
        bodyElement,
        foot,
    ];
}

function clearViewDataset(door)
{
    for (const key of VIEW_DATASET_KEYS)
    {
        door.removeAttribute(`data-${toKebabCase(key)}`);
        delete door.dataset[key];
    }
}

function applyDoorAttributes(door, attrs)
{
    const {
        dataset = {},
        ...otherAttributes
    } = attrs;
    Object.assign(
        door.dataset,
        {
            size: 'md',
        },
        dataset,
    );
    for (const [name, attributeValue] of Object.entries(otherAttributes))
    {
        door.setAttribute(name, attributeValue);
    }
}

function refreshOwnedDoor(
    ownedDoor,
    {
        attrs,
        title,
        doorContent,
        modalModel,
    },
)
{
    clearViewDataset(ownedDoor);
    applyDoorAttributes(ownedDoor, attrs);
    ownedDoor.setAttribute('aria-label', title);
    const presentContent = doorContent.filter(Boolean);
    ownedDoor.replaceChildren(...presentContent);
    modalModel.apply(ownedDoor);
    return ownedDoor;
}

function ensureBackdrop(appRoot)
{
    if (!appRoot.firstElementChild)
    {
        const backdrop = buildElement('div', {
            class: 'screen reward-backdrop',
        });
        appRoot.appendChild(backdrop);
    }
}

function mountNewDoor(
    appRoot,
    {
        owner,
        attrs,
        title,
        doorContent,
        modalModel,
    },
)
{
    appRoot.querySelector('.reward-veil')?.remove();
    ensureBackdrop(appRoot);
    const door = buildElement(
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
        doorContent,
    );
    door.rewardDoorOwner = owner;
    modalModel.apply(door);
    const veil = buildElement(
        'div',
        {
            class: 'modal-veil reward-veil',
        },
        door,
    );
    appRoot.appendChild(veil);
    return door;
}

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
    const modalModel = ModalModelFor(kind);
    const doorContent = buildDoorContent({
        eyebrow,
        title,
        body,
        foot,
        status,
    });
    const ownedDoor = findOwnedDoor(appRoot, owner);
    const doorParts = {
        owner,
        attrs,
        title,
        doorContent,
        modalModel,
    };

    if (ownedDoor)
    {
        return refreshOwnedDoor(ownedDoor, doorParts);
    }

    return mountNewDoor(appRoot, doorParts);
}

export function ReplaceRewardFoot(appRoot, owner, foot)
{
    const ownedDoor = findOwnedDoor(appRoot, owner);
    if (!ownedDoor)
    {
        return false;
    }
    const oldFooter = [...ownedDoor.children].find(
        (child) => child.tagName === 'FOOTER',
    );
    if (!oldFooter)
    {
        return false;
    }
    oldFooter.replaceWith(foot);
    return true;
}
