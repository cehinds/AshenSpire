import { hideOnError } from '../artFallback.js';
import { armamentIconAsset } from '../../model/equipmentArt.js';
// src/ui/screens/compendium.js — the Compendium: every armament the Spire keeps, mostly withheld.
//
// A locked entry gives you its shape and its rarity and nothing else: the cell, its tooltip and the
// detail pane all hold to that line. Sections are the armament kinds the table declares, in table
// order, so the grid never reflows as pieces are found; what changes is how much of it is lit.
// What is yours is ownership()'s answer (model/loadout.js), and how much a piece shows is
// pieceReveal()'s (model/unlocks.js); this screen authors neither.

import { esc, attachTooltip } from '../components/tooltip.js';
import { assetUrl } from '../assetmap.js';
import { pieceReveal } from '../../model/unlocks.js';
import { ownership, modEffectLine } from '../../model/loadout.js';
import { LOCK_COPY, armamentKindLabel } from '../uiContent.js';
import { t } from '../strings.js';
import { gameModule } from '../../model/gameProfile.js';
import { compendiumView, entryDetail } from '../models/CompendiumModel.js';
import { markCurrent } from '../components/w1Workspace.js';
import { MountKnowledgeDoor } from '../components/knowledgeDoor.js';
import {
    el,
    railed,
    railItem,
    categoryNav,
    pane,
    optionCard,
    artWell,
    statusText,
    detailCard,
    prose,
} from '../kit/index.js';

const DEFAULT_RARITY = 'common';

function modSummary(modFields, piece)
{
    return (piece.mods || []).map((raw) => modEffectLine(modFields, raw));
}

function showsProperties(registries)
{
    return gameModule(registries, 'effects')?.fixCoreVersion === 1;
}

function tooltipTagChip(tagId, tags)
{
    const tag = tags.find((row) => row.id === tagId);
    const tip = esc(tag?.blurb || tagId);
    const label = esc(tag?.label || tagId);
    return `<span class="inspection-tag" role="button" tabindex="0" data-tip="${tip}">${label}</span>`;
}

function heldTooltip(piece, mods, tagIds, tags)
{
    const heading = `<b>${esc(piece.name)}</b><br>${esc(piece.rarity)} · ${esc(piece.hand)} hand`;
    const modLine = mods.length ? `<p>${mods.map(esc).join(' · ')}</p>` : '';
    const chips = tagIds.map((tagId) => tooltipTagChip(tagId, tags)).join('');
    const tagLine = tagIds.length ? `<div class="inspection-tags">${chips}</div>` : '';
    return `${heading}${modLine}${tagLine}`;
}

// A withheld tooltip says only what the edge and the section already say, then why it is not yours.
function withheldTooltip(piece, isNamed, hint, gate)
{
    const head = isNamed ? `<b>${esc(piece.name)}</b><br>` : '';
    const reason = esc(hint || LOCK_COPY[gate] || '');
    return `${head}${esc(piece.rarity)} · ${esc(piece.hand)} hand<br><i>${reason}</i>`;
}

function cell(piece, { state, hint, gate }, modFields, tags = [], showProperties = false)
{
    const isHeld = state === 'held';
    const isNamed = isHeld || state === 'listed';
    const rarity = piece.rarity || DEFAULT_RARITY;
    const tagIds = [
        ...new Set([...(piece.tags || []), ...(showProperties ? piece.propertyTags || [] : [])]),
    ];
    const unknown = t('compendium.unknown', { kind: piece.kind });
    const card = optionCard({
        name: isNamed ? piece.name : unknown,
        meta: `${rarity} · ${piece.hand} hand`,
        arrow: false,
        className: `cp-cell rarity-${rarity} state-${state}${isHeld ? '' : ' is-ghost'}`,
        attrs: {
            'aria-label': isNamed ? piece.name : unknown,
            dataset: { member: piece.id, rarity, state },
        },
    });
    const art = artWell({ src: assetUrl(armamentIconAsset(piece)), alt: '', small: true });
    hideOnError(art.querySelector('img'));
    card.insertBefore(art, card.firstChild);

    attachTooltip(card, () => (isHeld
        ? heldTooltip(piece, modSummary(modFields, piece), tagIds, tags)
        : withheldTooltip(piece, isNamed, hint, gate)));
    return card;
}

function buildTagChips(tags)
{
    if (!tags.length)
    {
        return null;
    }
    return el(
        'div',
        { class: 'inspection-tags' },
        tags.map((tag) => el('span', {
            class: 'inspection-tag',
            role: 'button',
            tabindex: '0',
            dataset: { tip: tag.blurb },
            text: tag.label,
        })),
    );
}

function renderEntryDetail(registries, { piece, reveal }, detail)
{
    const equipment = registries.equipment || {};
    const facts = entryDetail(piece, reveal, {
        modLines: reveal.state === 'held' ? modSummary(equipment.modFields, piece) : [],
        tags: registries.tags || [],
        showProperties: showsProperties(registries),
        lockCopy: LOCK_COPY,
    });
    const art = artWell({ src: assetUrl(armamentIconAsset(piece)), alt: '' });
    hideOnError(art.querySelector('img'));
    detail.dataset.state = facts.state;
    detail.dataset.rarity = facts.rarity;
    return [
        art,
        detailCard({
            eyebrow: `${facts.rarity} · ${facts.hand} hand`,
            name: facts.named ? facts.name : t('compendium.unknown', { kind: facts.kind }),
            line: facts.hint,
            children: [
                ...facts.mods.map((line) => prose(line, { class: 'cp-mod' })),
                buildTagChips(facts.tags),
            ],
            attrs: { class: 'cp-detail-card' },
        }),
    ];
}

// A 'hidden' piece is absent and uncounted, so the count never outlines the hole.
function readDrawnEntries(registries, meta)
{
    const drops = registries.balance?.equipment?.drops || {};
    const owned = ownership(registries, { meta, loadout: null, profileWardrobe: true });
    const unlockById = new Map((registries.unlocks || []).map((unlock) => [unlock.id, unlock]));
    return (registries.equipment?.armaments || [])
        .map((piece) => ({ piece, reveal: pieceReveal(piece, { owned, unlockById, drops }) }))
        .filter(({ reveal }) => reveal.state !== 'hidden');
}

function buildKindItems(view)
{
    return view.categories.map((category) =>
    {
        const item = railItem({
            label: category.label,
            member: category.kind,
            id: `cp-kind-${category.kind}`,
            current: category.selected,
            className: 'with-status cp-kind',
            attrs: { 'aria-controls': 'cp-panel' },
        });
        item.appendChild(statusText(`${category.have}/${category.total}`));
        return item;
    });
}

/**
 * mountCompendium(app, { registries, meta, onBack })
 *
 * A profile surface reached from the title: `meta.found` is the whole of "yours".
 */
export function mountCompendium(app, { registries, meta = {}, onBack })
{
    const equipment = registries.equipment || {};
    const drawnEntries = readDrawnEntries(registries, meta);
    let view = compendiumView(drawnEntries, { labelOf: armamentKindLabel });
    let current = view.current;
    let door = null;
    let panel = null;

    function readSection()
    {
        view = compendiumView(drawnEntries, { current, labelOf: armamentKindLabel });
        current = view.current;
        markCurrent(items, current);
        return {
            entries: view.entries,
            selectedId: view.selected?.piece.id ?? null,
            listLabel: view.categories.find((category) => category.selected)?.label ?? '',
        };
    }

    function showSection(kind)
    {
        current = kind;
        const section = readSection();
        panel.setAttribute('aria-labelledby', `cp-kind-${current}`);
        door.update(section);
    }

    function frameWithKinds(split)
    {
        panel = pane({
            children: split,
            attrs: {
                class: 'cp-pane',
                id: 'cp-panel',
                role: 'tabpanel',
                'aria-labelledby': `cp-kind-${current}`,
            },
        });
        return railed(nav, panel);
    }

    const items = buildKindItems(view);
    const nav = categoryNav({ items, ariaLabel: t('compendium.kinds'), choose: showSection });
    const showProperties = showsProperties(registries);

    door = MountKnowledgeDoor(app, {
        screen: 'compendium',
        ...readSection(),
        readEntryId: (entry) => entry.piece.id,
        buildEntry: ({ piece, reveal }) =>
            cell(piece, reveal, equipment.modFields, registries.tags, showProperties),
        renderDetail: (entry, detail) => renderEntryDetail(registries, entry, detail),
        frameBody: frameWithKinds,
        textParams: { held: view.held, total: view.total },
        findLanding: () => nav.start(),
        onBack,
    });
    return door;
}
