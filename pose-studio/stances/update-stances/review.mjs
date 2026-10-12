// Art-review presentation only. No runtime imports, gameplay commands or remote services.
const LANDSCAPE_LAYOUT = Object.freeze({ columns: 3, rows: 2, orientation: 'landscape', emptyCell: 5 });
const PORTRAIT_LAYOUT = Object.freeze({ columns: 2, rows: 3, orientation: 'portrait', emptyCell: 5 });
const families = [
  {
    numberOffset: 0, layout: LANDSCAPE_LAYOUT,
    id: 'smash', title: 'Smash stance', description: 'Ten heavy loading poses. Read compression, planted force and a believable two-hand grip before the strike.',
    sheets: ['greatsword-smash/sheet-a.png', 'greatsword-smash/sheet-b.png'],
    notes: { 6: 'Poised step or stomp; stability as a held stance needs review.' },
    names: ['Deep high-guard squat', 'Long rear-loaded diagonal', 'Cross-body waist coil', 'Low rising load', 'Behind-head sledge load', 'High unilateral weight shift', 'Broad lateral shoulder load', 'Compact chest-high crushing load', 'Heel-lift rotational coil', 'Upright rear-hip pendulum'],
  },
  {
    numberOffset: 0, layout: LANDSCAPE_LAYOUT,
    id: 'guard-break', title: 'Guard break', description: 'Ten reactions for the defending fighter after the guard gives way. Explore loss of balance, grounded support and an exposed silhouette.',
    sheets: ['guard-break/reaver-greatsword-guard-break-sheet-a.png', 'guard-break/reaver-greatsword-guard-break-sheet-b.png'],
    notes: { 8: 'May read as tired or resting; needs a clearer broken-guard cue.' },
    revisions: { 4: 'Longer blade intersects option 05’s rear boot. Isolate or repaint before export and review greatsword length.' },
    names: ['Collapsed sword-point support', 'Ground drag + thigh catch', 'Palm catch + rear drag', 'Sideways open guard / crossing blade', 'Dropped greatsword / slack arms', 'Thigh-clutch / chest blow', 'Recoiled hanging blade', 'Slumped shoulder carry', 'Hanging rear drag', 'Backward heel collapse / floor drag'],
  },
  {
    id: 'sweep', title: 'Sweep follow-up', description: "Ten generated lateral or rising readiness concepts, numbered 11–20. Sweep17 uses an approved standalone high diagonal side-coil replacement; the original board figure is superseded.",
    numberOffset: 10, layout: PORTRAIT_LAYOUT, followup: true,
    sheets: ['greatsword-sweep/sheet-a.png', 'greatsword-sweep/sheet-b.png'],
    reviewStatuses: ['candidate', 'candidate'],
    replacements: { 17: {
      imagePath: 'greatsword-sweep/sw17-replacement.png', name: 'Two-hand high diagonal side coil', reviewStatus: 'candidate',
      sha256: '36e1eaea0b21ef33fd2f02e926c5d1819b779443bd11c964ff31665d0387b18a',
      supersededReason: 'The original board17 has a cropped right boot and lifted rear heel. This approved single-figure source replaces only option17.',
    } },
    names: ["Upright forward-horizontal side coil", "Shoulder-height lateral coil", "Forward-extended downward gate", "Upright low-side trail", "Wide lateral hip transfer", "Low forward downward hold", "Shoulder-high coil / lifted rear heel", "Compact low-waist cross coil", "Very wide low-forward sweep", "High-arc extended lunge"],
  },
  {
    id: 'counter', title: 'Counter follow-up', description: "Ten generated interception-and-reply readiness concepts, numbered 11–20. Counter15 now uses an approved standalone two-hand replacement; the original board depiction is superseded.",
    numberOffset: 10, layout: PORTRAIT_LAYOUT, followup: true,
    sheets: ['greatsword-counter/sheet-a.png', 'greatsword-counter/sheet-b.png'],
    reviewStatuses: ['candidate', 'candidate'],
    replacements: { 15: {
      imagePath: 'greatsword-counter/ct15-replacement.png', name: 'Two-hand low hanging cover', reviewStatus: 'candidate',
      sha256: '7a332139be986d3642ec72a2f99b51cc075ed8f41e926ea050c7c4188aae66ea',
      supersededReason: 'The original board15 grip remains unclear. This approved single-figure source replaces only option15.',
    } },
    names: ["High hanging, down-right blade", "Low forward plough, up-right blade", "High point-forward horizontal side cover", "Lower wide chest-centered inclined barrier", "Rear-weighted low hanging", "Compact crown roof, horizontal blade", "Forward outside hanging cover, withdrawn torso", "Withdrawn point-on-line, sternum hilt", "Lower wide high hanging cover", "Outside diagonal cut-ready cover"],
  },
  {
    id: 'evade', title: 'Evade follow-up', description: "Ten generated escape-readiness or recovery concepts, numbered 11–20. Evade20 now uses an approved standalone two-hand replacement; the original board depiction is superseded.",
    numberOffset: 10, layout: PORTRAIT_LAYOUT, followup: true,
    sheets: ['greatsword-evade/sheet-a.png', 'greatsword-evade/sheet-b.png'],
    reviewStatuses: ['candidate', 'candidate'],
    replacements: { 20: {
      imagePath: 'greatsword-evade/ev20-replacement.png', name: 'Upright two-hand recovery carry', reviewStatus: 'candidate',
      sha256: '0c48fafcd4069a16dfe2e2794681bcd4c1751bd3ad4565932f1e9c8054a22243',
      supersededReason: 'The original board20 grip remains unclear. This approved single-figure source replaces only option20.',
    } },
    names: ["Rear-weighted low blade", "Deep planted landing with upright blade", "Tall wide low carry", "Long lateral high carry", "Deep forward duck", "Deep planted landing with upright blade", "Narrow upright collected recovery", "Wide planted low trailing carry, repaired hip grip", "Compact forward horizontal carry", "Upright low forward carry"],
  },
];
// Historical delivered decisions persist in the repository; browser favorites do not replace them.
const confirmedRoles = new Map([
  ['reaver-greatsword-smash-04', 'Sweep'],
  ['reaver-greatsword-smash-06', 'Counter'],
  ['reaver-greatsword-guard-break-06', 'Guard-break'],
  ['reaver-greatsword-smash-08', 'Evade'],
  ['reaver-greatsword-smash-05', 'Smash'],
]);
const STORAGE_KEY = 'ashenspire.update-stances.review.v1';
const selections = new Set(confirmedRoles.keys());
const sheetStates = new Map();
const replacementStates = new Map();
const cards = new Map();
const allOptions = families.flatMap(family => family.names.map((name, index) => {
  const number = family.numberOffset + index + 1;
  const cell = index % 5;
  const replacement = family.replacements?.[number] || null;
  return {
    id: `reaver-greatsword-${family.id}-${String(number).padStart(2, '0')}`,
    family: family.id, class: 'reaver', weapon: 'greatsword', number, name: replacement?.name || name,
    sheet: family.sheets[Math.floor(index / 5)], cell,
    column: cell % family.layout.columns, row: Math.floor(cell / family.layout.columns),
    layout: family.layout, followup: !!family.followup,
    reviewStatus: replacement?.reviewStatus || family.reviewStatuses?.[Math.floor(index / 5)] || 'candidate',
    replacement, imagePath: replacement?.imagePath || family.sheets[Math.floor(index / 5)],
    revision: family.revisions?.[number] || null, note: family.notes?.[number] || null,
  };
}));
const validIds = new Set(allOptions.filter(option => option.reviewStatus === 'candidate' && !option.revision).map(option => option.id));
const status = document.querySelector('#review-status');
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (Array.isArray(saved)) {
    selections.clear();
    for (const id of saved) if (validIds.has(id)) selections.add(id);
  }
} catch { storageAvailable = false; }

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function announce(message) { status.textContent = message; }
function saveChoices() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...selections])); }
  catch { storageAvailable = false; }
}
function optionSourceState(option) {
  return option.replacement ? replacementStates.get(option.id) : sheetStates.get(option.sheet);
}
function optionReady(option) { return !!optionSourceState(option)?.ready && !option.revision; }
function availableFavorites() {
  return allOptions.filter(option => selections.has(option.id) && optionReady(option));
}
function updateOptionAvailability(option) {
  const card = cards.get(option.id), ready = optionReady(option);
  card.disabled = !ready;
  const label = card.querySelector('.followup-state');
  if (label) label.textContent = option.replacement
    ? ready ? 'Director-approved replacement concept' : 'Replacement unavailable · selection paused'
    : optionSourceState(option)?.ready ? 'Director-reviewed follow-up' : 'NEEDS REVIEW · source unavailable or unreviewed';
  if (option.replacement) {
    card.classList.toggle('needs-revision', !ready);
    card.setAttribute('aria-label', `${option.number}. ${option.name}, Reaver, greatsword, ${option.family}. ${ready ? 'Approved replacement concept. Toggle browser favorite.' : 'Replacement unavailable. Selection paused.'}`);
  }
}

function followupCoverage() {
  const states = [...sheetStates.values()].filter(state => state.followup);
  return {
    plannedConcepts: 30,
    sourceSheetsAvailable: states.filter(state => state.loaded).length,
    sourceSheetsPlanned: states.length,
    directorReviewedConcepts: allOptions.filter(option => option.followup && option.reviewStatus === 'candidate' && optionSourceState(option)?.loaded).length,
    replacementImagesAvailable: [...replacementStates.values()].filter(state => state.loaded).length,
    replacementImagesPlanned: replacementStates.size,
    selectableConcepts: allOptions.filter(option => option.followup && !cards.get(option.id)?.disabled).length,
  };
}
function updateChoices() {
  const count = availableFavorites().length;
  document.querySelector('#choice-count').textContent = count;
  document.querySelector('#copy-choices').disabled = !count;
  document.querySelector('#clear-choices').disabled = !selections.size;
  for (const [id, card] of cards) card.setAttribute('aria-pressed', String(selections.has(id) && !card.disabled));
  document.querySelector('#ready-count').textContent = [...cards.values()].filter(card => !card.disabled).length;
  const followup = followupCoverage();
  document.querySelector('#followup-summary').textContent = `${followup.plannedConcepts} follow-up concepts planned · ${followup.sourceSheetsAvailable}/${followup.sourceSheetsPlanned} source sheets available · ${followup.selectableConcepts} selectable after director review.`;
}
function makeCard(option) {
  const card = node('button', 'concept-card');
  card.type = 'button'; card.disabled = true;
  card.dataset.optionId = option.id;
  card.setAttribute('aria-pressed', String(selections.has(option.id)));
  const confirmedRole = confirmedRoles.get(option.id);
  if (confirmedRole) card.dataset.confirmedRole = confirmedRole.toLowerCase();
  card.setAttribute('aria-label', `${option.number}. ${option.name}, Reaver, greatsword, ${option.family}. ${confirmedRole ? 'Delivered in PR #1890 for ' + confirmedRole + '. ' : ''}${option.revision ? 'Needs revision. ' + option.revision : option.reviewStatus === 'needs-review' ? 'Planned follow-up; artwork and director review pending.' : 'Toggle browser favorite.'}`);
  const label = node('span', 'concept-label');
  label.append(node('span', 'concept-number', String(option.number).padStart(2, '0')), node('span', 'concept-name', option.name));
  card.append(label, node('span', 'pick-mark', '✓'));
  if (option.followup) card.append(node('span', 'concept-note followup-state', option.replacement ? 'Replacement loading · selection paused' : 'Planned follow-up · NEEDS REVIEW'));
  if (option.replacement) card.classList.add('needs-revision');
  if (confirmedRole) card.append(node('span', 'concept-note', 'Delivered in PR #1890 for ' + confirmedRole));
  if (option.note) card.append(node('span', 'concept-note', option.note));
  if (option.revision) { card.classList.add('needs-revision'); card.append(node('span', 'revision-note', 'Needs revision · ' + option.revision)); }
  card.addEventListener('click', () => {
    if (card.disabled) return;
    selections.has(option.id) ? selections.delete(option.id) : selections.add(option.id);
    saveChoices(); updateChoices();
    const count = availableFavorites().length;
    announce(`${count} favorite${count === 1 ? '' : 's'} selected.${storageAvailable ? ' Saved in this browser.' : ' Browser storage is unavailable; copy your choices before leaving.'}`);
  });
  cards.set(option.id, card);
  return card;
}
function sheetRange(family, index) {
  const first = family.numberOffset + index * 5 + 1;
  return `${first}–${first + 4}`;
}
function sheetDescription(family, index) {
  return `Reaver greatsword ${family.title.toLowerCase()}, options ${sheetRange(family, index)} in reading order; ${family.layout.columns} columns by ${family.layout.rows} rows, bottom-right cell empty. Full unchanged source sheet.`;
}
function openSheet(family, index, opener) {
  const path = family.sheets[index];
  if (!sheetStates.get(path)?.loaded) return;
  const dialog = document.querySelector('#sheet-dialog');
  document.querySelector('#sheet-title').textContent = `${family.title} · Sheet ${index === 0 ? 'A' : 'B'}`;
  const image = document.querySelector('#sheet-image');
  image.src = path; image.alt = sheetDescription(family, index);
  document.querySelector('.sheet-scroll').dataset.orientation = family.layout.orientation;
  document.querySelector('#sheet-description').textContent = image.alt + ' Gallery numbers are outside the painting. The source image is unchanged.';
  document.querySelector('#sheet-link').href = path;
  dialog.showModal();
  dialog.addEventListener('close', () => opener.focus(), { once: true });
}
function render() {
  const host = document.querySelector('#options');
  for (const family of families) {
    const section = node('section', 'family'); section.dataset.family = family.id;
    const header = node('div', 'family-header');
    const copy = node('div'); const heading = node('h2', '', family.title); heading.id = `heading-${family.id}`;
    section.setAttribute('aria-labelledby', heading.id);
    copy.append(heading, node('p', 'family-description', family.description));
    const tags = node('div', 'tags');
    for (const text of ['Greatsword', 'Reaver', 'Rear view', 'Pose exploration']) tags.append(node('span', 'tag', text));
    header.append(copy, tags); section.append(header);
    family.sheets.forEach((path, index) => {
      const row = node('div', 'sheet-row');
      row.append(node('strong', '', `Sheet ${index === 0 ? 'A' : 'B'} · Options ${sheetRange(family, index)} · ${family.layout.columns} × ${family.layout.rows}`));
      const fullSheet = node('button', '', 'View full sheet'); fullSheet.type = 'button'; fullSheet.disabled = true;
      fullSheet.setAttribute('aria-label', `View ${family.title} sheet ${index === 0 ? 'A' : 'B'} in full`);
      fullSheet.addEventListener('click', () => openSheet(family, index, fullSheet));
      const loadStatus = node('span', 'sheet-status', family.followup ? 'Planned · artwork and review pending' : 'Source artwork is loading');
      row.append(fullSheet, loadStatus); section.append(row);
      const sheetView = node('div', 'source-sheet');
      sheetView.dataset.orientation = family.layout.orientation;
      const placeholder = node('p', 'source-placeholder', family.followup ? 'Source board not integrated yet · generation in progress.' : 'Source artwork is loading.');
      sheetView.append(placeholder); section.append(sheetView);
      for (const option of allOptions.filter(option => option.sheet === path && option.replacement)) {
        section.append(node('p', 'superseded-note', `Original board option${option.number} is superseded. ${option.replacement.supersededReason}`));
        const figure = node('figure', 'replacement-source');
        const view = node('div', 'source-sheet'); view.dataset.orientation = 'portrait';
        view.append(node('p', 'source-placeholder', 'Approved replacement is loading. Selection remains paused.'));
        const caption = node('figcaption', '', `Option${option.number} replacement · ${option.name}. Full unchanged source figure; same option ID.`);
        const link = node('a', '', 'Open replacement original'); link.href = option.replacement.imagePath; link.target = '_blank'; link.rel = 'noopener';
        caption.append(document.createTextNode(' '), link);
        const sourceStatus = node('p', 'sheet-status', 'Replacement loading · selection paused');
        figure.append(view, caption, sourceStatus); section.append(figure);
        replacementStates.set(option.id, { loaded: false, ready: false, view, status: sourceStatus });
      }
      const grid = node('div', 'concept-grid');
      grid.dataset.columns = family.layout.columns;
      allOptions.filter(option => option.sheet === path).forEach(option => grid.append(makeCard(option)));
      section.append(grid);
      sheetStates.set(path, { ready: false, loaded: false, button: fullSheet, status: loadStatus, view: sheetView, reviewStatus: family.reviewStatuses?.[index] || 'candidate', family, sheetIndex: index, followup: !!family.followup });
    });
    host.append(section);
  }
  updateChoices();
}
function loadSheets() {
  for (const [path, state] of sheetStates) {
    const image = new Image();
    image.onload = () => {
      state.loaded = true; state.ready = state.reviewStatus === 'candidate';
      state.button.disabled = false;
      state.status.textContent = state.ready ? 'Director-reviewed concepts · selected delivery evidence tracked separately' : 'NEEDS REVIEW · source available; selection paused';
      image.alt = sheetDescription(state.family, state.sheetIndex);
      image.className = 'source-image'; state.view.replaceChildren(image);
      for (const option of allOptions.filter(option => option.sheet === path)) {
        updateOptionAvailability(option);
        if (!option.replacement && (option.revision || !state.ready)) selections.delete(option.id);
      }
      saveChoices(); updateChoices();

    };
    image.onerror = () => {
      state.loaded = false; state.ready = false;
      state.status.textContent = 'Planned · no source artwork yet';
      state.view.querySelector('.source-placeholder').textContent = 'Artwork is pending. These numbered slots are planned concepts.';
      for (const option of allOptions.filter(option => option.sheet === path)) {
        updateOptionAvailability(option);
        if (!option.replacement) selections.delete(option.id);
      }
      saveChoices(); updateChoices();
    };
    image.src = path;
  }
}
function loadReplacements() {
  for (const option of allOptions.filter(option => option.replacement)) {
    const state = replacementStates.get(option.id), image = new Image();
    image.onload = () => {
      state.loaded = true; state.ready = option.replacement.reviewStatus === 'candidate';
      image.className = 'source-image'; image.alt = `${option.name}, option${option.number}. Approved replacement for the superseded board figure.`;
      state.view.replaceChildren(image);
      state.status.textContent = state.ready ? 'Director-approved replacement concept · original board figure superseded' : 'Replacement source available · director review pending';
      updateOptionAvailability(option);
      if (!state.ready) selections.delete(option.id);
      saveChoices(); updateChoices();
    };
    image.onerror = () => {
      state.loaded = false; state.ready = false;
      state.status.textContent = 'Replacement source unavailable · selection paused';
      state.view.querySelector('.source-placeholder').textContent = 'The approved replacement could not load. Original board depiction remains superseded.';
      updateOptionAvailability(option); selections.delete(option.id); saveChoices(); updateChoices();
    };
    image.src = option.replacement.imagePath;
  }
}
for (const filter of document.querySelectorAll('.filters select')) filter.addEventListener('change', () => {
  const family = document.querySelector('#family-filter').value;
  for (const section of document.querySelectorAll('.family')) section.hidden = family !== 'all' && section.dataset.family !== family;
});
document.querySelector('#clear-choices').addEventListener('click', () => {
  selections.clear(); saveChoices(); updateChoices(); announce('Browser favorites cleared. The five original delivered role selections remain recorded.');
});
document.querySelector('#copy-choices').addEventListener('click', async () => {
  const payload = JSON.stringify({ review: 'update-stances', stage: 'merged-selected-pilot-and-followup-concept-review', followup: followupCoverage(), confirmedRoleScope: 'Historical original five, delivered in PR #1890; latest sequence sources are in sequence-review/sequences.json', confirmedRoleSelections: [...confirmedRoles].map(([sourceId, targetRole]) => ({ sourceId, targetRole })), selectionManifest: 'selections.json', browserFavorites: availableFavorites().map(option => ({ ...option, sourceStatus: option.replacement ? 'director-approved-replacement-concept' : 'concept-candidate', sourceLayout: option.replacement ? 'standalone-figure; sheet/cell fields describe superseded context only' : 'five-concept-board' })) }, null, 2);
  let copyTimeout;
  try {
    await Promise.race([navigator.clipboard.writeText(payload), new Promise((_, reject) => { copyTimeout = setTimeout(() => reject(new Error('Clipboard did not respond')), 1500); })]);
    const count = availableFavorites().length;
    announce(`${count} browser favorite${count === 1 ? '' : 's'} and the five original delivered roles copied. Follow-up availability and pending review are included.`);
  }
  catch {
    const fallback = document.querySelector('#copy-fallback'); fallback.hidden = false;
    const textarea = document.querySelector('#choices-text'); textarea.value = payload; textarea.focus(); textarea.select();
    announce('Copy is restricted in this browser. Selected choices are ready to copy below.');
  } finally { clearTimeout(copyTimeout); }
});
document.querySelector('#close-copy').addEventListener('click', () => {
  document.querySelector('#copy-fallback').hidden = true; document.querySelector('#copy-choices').focus();
});
document.querySelector('#close-sheet').addEventListener('click', () => document.querySelector('#sheet-dialog').close());
document.querySelector('#sheet-dialog').addEventListener('click', event => {
  if (event.target !== event.currentTarget) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
});
render(); loadSheets(); loadReplacements();
if (!storageAvailable) announce('Browser storage is unavailable; copy your choices before leaving.');
