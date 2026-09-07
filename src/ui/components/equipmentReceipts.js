// src/ui/components/equipmentReceipts.js — the equipment receipts, on the kit.
//
// String builders (their callers build markup as strings), every piece a kit
// class: an Eyebrow heads each receipt, a StatRow carries a name and its
// numbers, a delta is the kit's `→` pair, a note is Flavour. The `.equip-*` /
// `.player-*-receipt` / `data-*` names are the hooks the tools and tests read.
import { esc } from './tooltip.js';
import { FOLD_GLYPH } from './foldGlyph.js';

const eyebrowHtml = (text) => `<span class="as-eyebrow">${esc(text)}</span>`;
const flavourHtml = (text) => `<span class="as-flavor">${esc(text)}</span>`;
const pairHtml = (key, valueHtml, className = '') => `<span class="as-statpair${className ? ` ${className}` : ''}"><span class="sp-k">${esc(key)}</span><span class="sp-v">${valueHtml}</span></span>`;
/** The kit's delta: from → to, coloured by direction. `fromText`/`toText` dress the numbers (x2 → x3). */
function deltaHtml(from, to, { fromText = null, toText = null } = {}) {
  const dir = to > from ? 'up' : to < from ? 'down' : 'flat';
  return `<span class="as-delta" data-dir="${dir}"><span class="d-from">${esc(fromText ?? from)}</span><span class="d-arrow">→</span><span class="d-to">${esc(toText ?? to)}</span></span>`;
}
function statRowHtml({ nameHtml, hintHtml = '', valuesHtml = '', attrs = '', className = '' }) {
  return `<div class="as-statrow flat${className ? ` ${className}` : ''}"${attrs}><span class="sr-id"><span class="sr-name">${nameHtml}</span>${hintHtml ? `<span class="sr-hint">${hintHtml}</span>` : ''}</span>${valuesHtml ? `<span class="sr-vals">${valuesHtml}</span>` : ''}</div>`;
}

export function renderEquipmentRequirements(receipts) {
  const rows = receipts || [];
  return `<section class="equipment-requirements">${eyebrowHtml('Requirements')}${rows.length
    ? `<ul class="equip-receipt-list">${rows.map((piece) => `<li data-piece-id="${esc(piece.itemId)}">${statRowHtml({
      nameHtml: esc(piece.pieceName),
      valuesHtml: piece.requirements.map((row) => pairHtml(row.label, `${row.actual == null ? '?' : row.actual}/${row.required}`, row.actual != null && row.actual >= row.required ? 'met' : 'unmet')).join(''),
    })}</li>`).join('')}</ul>`
    : flavourHtml('No attribute requirements.')}</section>`;
}

const sourcesHtml = (sources, empty) => (sources.length
  ? `<span class="as-kitline">${sources.map((source) => `<span class="ki" data-source-kind="${esc(source.kind)}"><span class="kn">${esc(source.id)}</span> <b>${source.value}</b></span>`).join('')}</span>`
  : flavourHtml(empty));

export function renderPlayerPoise(receipt) {
  return `<section class="player-poise-receipt">${eyebrowHtml(receipt.label)}`
    + sourcesHtml(receipt.sources, 'No item or relic contribution.')
    + pairHtml(`Items ${receipt.equipment} + relics ${receipt.relic}`, `<strong>${receipt.value}</strong>`)
    + flavourHtml(receipt.note) + '</section>';
}

export function renderPlayerLoad(receipt) {
  return `<section class="player-load-receipt" data-weight-class="${esc(receipt.classId)}">${eyebrowHtml(receipt.label)}`
    + sourcesHtml(receipt.sources, 'Nothing equipped weighs anything.')
    + pairHtml(`Hands ${receipt.hands} + armour ${receipt.armour}`, `<strong>${receipt.load}</strong> of ${receipt.capacity} · <strong>${esc(receipt.word)}</strong>`)
    + flavourHtml(receipt.note) + '</section>';
}

// The swap's load row: before → after out of the (unmoving) capacity, each
// with its percent (the number the class thresholds are stated in — SPEC's
// `.player-load-receipt` carries percent), and the Weight Class word on both
// sides so a swap that crosses a boundary reads as the class change it is,
// not as a number the player has to divide themselves.
// `data-weight-class` carries the AFTER class, matching renderPlayerLoad's
// attribute on the standing readout; `data-class-change` marks a crossing.
function renderCandidateLoad(load) {
  if (!load) return '';
  const word = load.changesClass
    ? `${esc(load.beforeWord)} → <strong>${esc(load.afterWord)}</strong>`
    : `<strong>${esc(load.afterWord)}</strong>`;
  return `<section class="player-load-receipt" data-weight-class="${esc(load.afterClassId)}" data-class-change="${load.changesClass ? 'yes' : 'no'}">${eyebrowHtml('Equip load')}`
    + `<span class="dc-line">${load.before} (${load.beforePercent}%) → <strong>${load.after} (${load.afterPercent}%)</strong> of ${load.capacity} · ${word}</span>`
    + flavourHtml(load.note) + '</section>';
}

export function renderRoleCopies(surface) {
  return surface.roles.map((row) => statRowHtml({
    attrs: ` data-role="${esc(row.role)}"`,
    nameHtml: `${esc(row.profile.displayName)} <em class="as-pill role-copy-count">x${row.copies}</em>`,
    hintHtml: `${esc(row.profile.damageSchool)} · ${(row.profile.tags || []).map(esc).join(' · ')}`,
    valuesHtml: pairHtml(`${row.receipt.base} base + ${row.receipt.tier} tier x ${row.receipt.gainPerTier} + ${row.receipt.rarityBonus} rarity =`, `<strong>${row.receipt.value}</strong>`),
  })).join('');
}

export function renderCandidateComparison(candidate, { expanded = false } = {}) {
  const requirements = candidate.requirement ? renderEquipmentRequirements([candidate.requirement]) : renderEquipmentRequirements([]);
  const attackRows = (candidate.attackPackageChanges || []).map((row) => `<li data-role="attack" data-card-id="${esc(row.cardId)}">${statRowHtml({
    nameHtml: esc(row.name),
    hintHtml: row.sourceHands.length ? `${esc(row.sourceHands.join(' + '))} hand package` : '',
    valuesHtml: deltaHtml(row.beforeCount, row.afterCount, { fromText: `x${row.beforeCount}`, toText: `x${row.afterCount}` }),
  })}</li>`).join('');
  const roleRows = candidate.roles.map((row) => `<li data-role="${esc(row.role)}">${statRowHtml({
    nameHtml: `${esc(row.beforeName)} → ${esc(row.afterName)}`,
    hintHtml: `${esc(row.afterSchool)}${row.afterTags.length ? ` · ${row.afterTags.map(esc).join(' · ')}` : ''}`,
    valuesHtml: deltaHtml(row.beforeValue, row.afterValue),
  })}</li>`).join('');
  const effects = candidate.addedEffects.length
    ? candidate.addedEffects.map((row) => `<li class="equip-added-effect">${esc(row.label)}</li>`).join('')
    : '<li class="equip-added-effect none">No added effects.</li>';
  const resources = candidate.resourceChanges.length
    // `row.note` is the DECLINED gear delta — a price rule that ignores
    // talismans and relics says so on the row rather than showing an unmoved
    // number and letting the piece look broken (model/equipmentPresentation.js,
    // `swapPriceChanges`). Absent on every row that has nothing to decline.
    ? candidate.resourceChanges.map((row) => `<li class="equip-resource-change">${esc(row.label)} ${deltaHtml(row.before, row.after)}${row.note ? flavourHtml(row.note) : ''}</li>`).join('')
    : '<li class="equip-resource-change none">No resource changes.</li>';
  return `<details class="equip-candidate-comparison"${expanded ? ' open' : ''}><summary><span class="as-glyph caret" aria-hidden="true">${FOLD_GLYPH.collapsed}</span>${eyebrowHtml('Compare cards and receipts')}</summary>`
    + `<ul class="equip-card-changes">${attackRows}${roleRows}</ul>${requirements}`
    + `<section>${eyebrowHtml('Explicit added effects')}<ul class="equip-receipt-list">${effects}</ul></section>`
    + `<section>${eyebrowHtml('Resource changes')}<ul class="equip-receipt-list">${resources}</ul></section>`
    + `<section class="player-poise-receipt">${eyebrowHtml('Poise threshold')}${deltaHtml(candidate.poise.before, candidate.poise.after)}${flavourHtml(candidate.poise.note)}</section>`
    + renderCandidateLoad(candidate.load)
    + '</details>';
}
