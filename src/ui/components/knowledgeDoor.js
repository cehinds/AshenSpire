// @ts-check
/** @import { ScreenHandle } from '../contracts.js' */
import { uiConfig } from '../../config/generated/ui.js';
import { el, button, pane, options, statusText, pageDoor } from '../kit/index.js';
import { workspaceFrame, land } from './w1Workspace.js';
import { MarkSelected } from '../selection.js';
import { t } from '../strings.js';

/** @type {Record<string, Record<string, any>>} */
const DOOR_TABLE = uiConfig.screens.knowledgeDoor.components;
const ROOT_DOOR = 'base';
const COMPACT_ROWS_PROPERTY = '--knowledge-compact-rows';

/**
 * @typedef {object} KnowledgeDoorConfig
 * @property {string} surface
 * @property {string} screenClassName
 * @property {string} titleSize
 * @property {string} footSize
 * @property {string} bodyClassName
 * @property {string} backId
 * @property {string} listClassName
 * @property {string} detailClassName
 * @property {string} detailId
 * @property {string} detailLive
 * @property {string} eyebrowKey
 * @property {string} titleKey
 * @property {string} closeLabelKey
 * @property {string} [listLabelKey]
 * @property {string} [listEmptyKey]
 * @property {string} [detailLabelKey]
 * @property {string} [detailEmptyKey]
 * @property {number} compactListShare
 * @property {number} compactDetailShare
 */

/**
 * @typedef {object} KnowledgeDoorEntries
 * @property {ReadonlyArray<any>} entries
 * @property {string | null} [selectedId]
 * @property {string | null} [listLabel]
 */

/**
 * @typedef {object} KnowledgeDoorOptions
 * @property {string} screen
 * @property {ReadonlyArray<any>} [entries]
 * @property {string | null} [selectedId]
 * @property {string | null} [listLabel]
 * @property {(entry: any) => string} [readEntryId]
 * @property {(entry: any) => HTMLElement} buildEntry
 * @property {(entry: any, detail: HTMLElement) => ReadonlyArray<Node | null>} renderDetail
 * @property {(split: HTMLElement) => HTMLElement} [frameBody]
 * @property {Record<string, unknown>} [textParams]
 * @property {() => HTMLElement | null} [findLanding]
 * @property {() => void} [onBack]
 */

/**
 * @typedef {ScreenHandle & {
 *     update: (model: KnowledgeDoorEntries) => void,
 *     dispose: () => void,
 *     select: (entryId: string) => void,
 * }} KnowledgeDoor
 */

/**
 * @param {string} screen
 * @returns {KnowledgeDoorConfig}
 */
export function ResolveKnowledgeDoorConfig(screen)
{
    if (screen === ROOT_DOOR || !Object.hasOwn(DOOR_TABLE, screen))
    {
        throw new Error(`unknown knowledge door "${screen}"`);
    }

    const lineage = [];
    for (let doorName = screen; doorName !== undefined; doorName = DOOR_TABLE[doorName].extends)
    {
        lineage.unshift(DOOR_TABLE[doorName]);
    }

    const merged = Object.assign({}, ...lineage);
    delete merged.extends;
    return merged;
}

function readOwnId(entry)
{
    return entry.id;
}

function frameInPane(split)
{
    return pane({ children: split });
}

function compactRows(config)
{
    return [
        `minmax(0, ${config.compactListShare}fr)`,
        `minmax(0, ${config.compactDetailShare}fr)`,
    ].join(' ');
}

function buildList(config)
{
    return options(
        [],
        {
            class: config.listClassName,
            'aria-label': config.listLabelKey ? t(config.listLabelKey) : null,
        },
    );
}

function buildDetail(config)
{
    const isLabelled = Boolean(config.detailLabelKey);
    return el(
        'div',
        {
            class: config.detailClassName,
            id: config.detailId,
            role: isLabelled ? 'region' : null,
            'aria-label': isLabelled ? t(config.detailLabelKey) : null,
            'aria-live': config.detailLive,
        },
    );
}

function buildBack(config)
{
    /** @type {any} The kit's button options are inferred from untyped defaults. */
    const backOptions = {
        label: t('common.back'),
        role: 'exit',
        id: config.backId,
        attrs: { 'data-back': '' },
    };
    return button(backOptions);
}

function buildDoor(config, { body, back, textParams, onClose })
{
    return workspaceFrame(pageDoor({
        eyebrow: t(config.eyebrowKey, textParams),
        title: t(config.titleKey),
        size: config.titleSize,
        body,
        bodyClassName: config.bodyClassName,
        primary: back,
        footSize: config.footSize,
        onClose,
        closeLabel: t(config.closeLabelKey),
    }));
}

function buildScreen(config, door)
{
    const screen = el(
        'div',
        {
            class: config.screenClassName,
            dataset: { surface: config.surface },
        },
        door,
    );
    screen.style.setProperty(COMPACT_ROWS_PROPERTY, compactRows(config));
    return screen;
}

/**
 * A knowledge door: a page door with an entry list beside the selected entry's detail.
 * Picking an entry repaints only the detail and the selection mark; `update` replaces the list.
 *
 * @param {HTMLElement} app
 * @param {KnowledgeDoorOptions} options
 * @returns {KnowledgeDoor}
 */
export function MountKnowledgeDoor(
    app,
    {
        screen,
        entries = [],
        selectedId = null,
        listLabel = null,
        readEntryId = readOwnId,
        buildEntry,
        renderDetail,
        frameBody = frameInPane,
        textParams = {},
        findLanding = () => null,
        onBack = () =>
        {},
    },
)
{
    const config = ResolveKnowledgeDoorConfig(screen);
    const list = buildList(config);
    const detail = buildDetail(config);
    const back = buildBack(config);
    let shownEntries = [];
    let entryControls = [];
    let currentId = null;
    let isClosed = false;

    function leave()
    {
        if (isClosed)
        {
            return;
        }
        isClosed = true;
        onBack();
    }

    function findEntry(entryId)
    {
        return shownEntries.find((entry) => readEntryId(entry) === entryId) || null;
    }

    function paintDetail()
    {
        const entry = findEntry(currentId);
        MarkSelected(
            entryControls,
            (control, index) => readEntryId(shownEntries[index]) === currentId,
        );

        if (entry)
        {
            detail.replaceChildren(...renderDetail(entry, detail).filter(Boolean));
            return;
        }
        detail.replaceChildren(
            ...(config.detailEmptyKey ? [statusText(t(config.detailEmptyKey))] : []),
        );
    }

    function select(entryId)
    {
        currentId = entryId;
        paintDetail();
    }

    function buildEntryControl(entry)
    {
        const control = buildEntry(entry);
        control.setAttribute('aria-controls', config.detailId);
        control.addEventListener('click', () => select(readEntryId(entry)));
        return control;
    }

    /** @param {KnowledgeDoorEntries} model */
    function update(
        { entries: nextEntries, selectedId: nextId = null, listLabel: nextLabel = null },
    )
    {
        shownEntries = [...nextEntries];
        currentId = findEntry(nextId)
            ? nextId
            : (shownEntries[0] ? readEntryId(shownEntries[0]) : null);
        entryControls = shownEntries.map(buildEntryControl);
        if (nextLabel !== null)
        {
            list.setAttribute('aria-label', nextLabel);
        }
        list.replaceChildren(...entryControls);
        if (!shownEntries.length && config.listEmptyKey)
        {
            list.append(statusText(t(config.listEmptyKey)));
        }
        paintDetail();
    }

    function dispose()
    {
        isClosed = true;
    }

    const split = el(
        'div',
        { class: 'w1-split' },
        [el('div', { class: 'cp-list' }, list), detail],
    );
    const door = buildDoor(config, {
        body: frameBody(split),
        back,
        textParams,
        onClose: leave,
    });

    update({ entries, selectedId, listLabel });
    app.replaceChildren(buildScreen(config, door));
    back.addEventListener('click', leave);
    land(findLanding() || entryControls[0] || back);

    return { update, select, dispose };
}
