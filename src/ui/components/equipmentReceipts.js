import { esc } from './tooltip.js';

export function renderEquipmentRequirements(receipts) {
  const rows = receipts || [];
  return `<section class="equipment-requirements"><b>Requirements</b>${rows.length
    ? `<ul>${rows.map((piece) => `<li data-piece-id="${esc(piece.itemId)}"><span>${esc(piece.pieceName)}</span> ${piece.requirements.map((row) => `<em class="${row.actual != null && row.actual >= row.required ? 'met' : 'unmet'}">${esc(row.label)} ${row.actual == null ? '?' : row.actual}/${row.required}</em>`).join(' ')}</li>`).join('')}</ul>`
    : '<p>No attribute requirements.</p>'}</section>`;
}

export function renderPlayerPoise(receipt) {
  const sources = receipt.sources.length
    ? `<ul>${receipt.sources.map((source) => `<li data-source-kind="${esc(source.kind)}">${esc(source.id)} <strong>${source.value}</strong></li>`).join('')}</ul>`
    : '<p>No item or relic contribution.</p>';
  return `<section class="player-poise-receipt"><b>${esc(receipt.label)}</b>`
    + sources
    + `<span>Items ${receipt.equipment} + relics ${receipt.relic} = <strong>${receipt.value}</strong></span>`
    + `<small>${esc(receipt.note)}</small></section>`;
}

export function renderPlayerLoad(receipt) {
  const sources = receipt.sources.length
    ? `<ul>${receipt.sources.map((source) => `<li data-source-kind="${esc(source.kind)}">${esc(source.id)} <strong>${source.value}</strong></li>`).join('')}</ul>`
    : '<p>Nothing equipped weighs anything.</p>';
  return `<section class="player-load-receipt" data-weight-class="${esc(receipt.classId)}"><b>${esc(receipt.label)}</b>`
    + sources
    + `<span>Hands ${receipt.hands} + armour ${receipt.armour} = <strong>${receipt.load}</strong> of ${receipt.capacity} · <strong>${esc(receipt.word)}</strong></span>`
    + `<small>${esc(receipt.note)}</small></section>`;
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
  return `<section class="player-load-receipt" data-weight-class="${esc(load.afterClassId)}" data-class-change="${load.changesClass ? 'yes' : 'no'}"><b>Equip load</b>`
    + `<span>${load.before} (${load.beforePercent}%) → <strong>${load.after} (${load.afterPercent}%)</strong> of ${load.capacity} · ${word}</span>`
    + `<small>${esc(load.note)}</small></section>`;
}

export function renderRoleCopies(surface) {
  return surface.roles.map((row) => `<div data-role="${esc(row.role)}"><b>${esc(row.profile.displayName)} <em class="role-copy-count">x${row.copies}</em></b>`
    + `<span>${row.receipt.base} base + ${row.receipt.tier} tier x ${row.receipt.gainPerTier}`
    + ` + ${row.receipt.rarityBonus} rarity = <strong>${row.receipt.value}</strong></span>`
    + `<small>${esc(row.profile.damageSchool)} · ${(row.profile.tags || []).map(esc).join(' · ')}</small></div>`).join('');
}

export function renderCandidateComparison(candidate, { expanded = false } = {}) {
  const requirements = candidate.requirement ? renderEquipmentRequirements([candidate.requirement]) : renderEquipmentRequirements([]);
  const attackRows = (candidate.attackPackageChanges || []).map((row) => `<li data-role="attack" data-card-id="${esc(row.cardId)}"><b>${esc(row.name)}</b> <span>x${row.beforeCount} → <strong>x${row.afterCount}</strong></span>${row.sourceHands.length ? `<small>${esc(row.sourceHands.join(' + '))} hand package</small>` : ''}</li>`).join('');
  const roleRows = candidate.roles.map((row) => `<li data-role="${esc(row.role)}"><b>${esc(row.beforeName)} → ${esc(row.afterName)}</b> <span>${row.beforeValue} → <strong>${row.afterValue}</strong></span><small>${esc(row.afterSchool)}${row.afterTags.length ? ` · ${row.afterTags.map(esc).join(' · ')}` : ''}</small></li>`).join('');
  const effects = candidate.addedEffects.length
    ? candidate.addedEffects.map((row) => `<li class="equip-added-effect">${esc(row.label)}</li>`).join('')
    : '<li class="equip-added-effect none">No added effects.</li>';
  const resources = candidate.resourceChanges.length
    // `row.note` is the DECLINED gear delta — a price rule that ignores
    // talismans and relics says so on the row rather than showing an unmoved
    // number and letting the piece look broken (model/equipmentPresentation.js,
    // `swapPriceChanges`). Absent on every row that has nothing to decline.
    ? candidate.resourceChanges.map((row) => `<li class="equip-resource-change">${esc(row.label)} ${row.before} → <strong>${row.after}</strong>${row.note ? `<small>${esc(row.note)}</small>` : ''}</li>`).join('')
    : '<li class="equip-resource-change none">No resource changes.</li>';
  return `<details class="equip-candidate-comparison"${expanded ? ' open' : ''}><summary>Compare cards and receipts</summary>`
    + `<ul class="equip-card-changes">${attackRows}${roleRows}</ul>${requirements}`
    + `<section><b>Explicit added effects</b><ul>${effects}</ul></section>`
    + `<section><b>Resource changes</b><ul>${resources}</ul></section>`
    + `<section class="player-poise-receipt"><b>Poise threshold</b><span>${candidate.poise.before} → <strong>${candidate.poise.after}</strong></span><small>${esc(candidate.poise.note)}</small></section>`
    + renderCandidateLoad(candidate.load)
    + '</details>';
}
