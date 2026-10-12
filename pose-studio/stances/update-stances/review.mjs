// Art-review presentation only. No runtime imports, gameplay commands or remote services.
const families = [
  {
    id: 'smash', title: 'Smash stance', description: 'Ten heavy loading poses. Read compression, planted force and a believable two-hand grip before the strike.',
    sheets: ['greatsword-smash/sheet-a.png', 'greatsword-smash/sheet-b.png'],
    notes: { 6: 'Poised step or stomp; stability as a held stance needs review.' },
    names: ['Deep high-guard squat', 'Long rear-loaded diagonal', 'Cross-body waist coil', 'Low rising load', 'Behind-head sledge load', 'High unilateral weight shift', 'Broad lateral shoulder load', 'Compact chest-high crushing load', 'Heel-lift rotational coil', 'Upright rear-hip pendulum'],
  },
  {
    id: 'guard-break', title: 'Guard break', description: 'Ten reactions for the defending fighter after the guard gives way. Explore loss of balance, grounded support and an exposed silhouette.',
    sheets: ['guard-break/reaver-greatsword-guard-break-sheet-a.png', 'guard-break/reaver-greatsword-guard-break-sheet-b.png'],
    notes: { 8: 'May read as tired or resting; needs a clearer broken-guard cue.' },
    revisions: { 4: 'Longer blade intersects option 05’s rear boot. Isolate or repaint before export and review greatsword length.' },
    names: ['Collapsed sword-point support', 'Ground drag + thigh catch', 'Palm catch + rear drag', 'Sideways open guard / crossing blade', 'Dropped greatsword / slack arms', 'Thigh-clutch / chest blow', 'Recoiled hanging blade', 'Slumped shoulder carry', 'Hanging rear drag', 'Backward heel collapse / floor drag'],
  },
];
const STORAGE_KEY = 'ashenspire.update-stances.review.v1';
const selections = new Set();
const sheetStates = new Map();
const cards = new Map();
const allOptions = families.flatMap(family => family.names.map((name, index) => ({
  id: `reaver-greatsword-${family.id}-${String(index + 1).padStart(2, '0')}`,
  family: family.id, class: 'reaver', weapon: 'greatsword', number: index + 1, name,
  sheet: family.sheets[Math.floor(index / 5)], cell: index % 5, revision: family.revisions?.[index + 1] || null, note: family.notes?.[index + 1] || null,
})));
const validIds = new Set(allOptions.map(option => option.id));
const status = document.querySelector('#review-status');
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(saved)) for (const id of saved) if (validIds.has(id)) selections.add(id);
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
function updateChoices() {
  document.querySelector('#choice-count').textContent = selections.size;
  document.querySelector('#copy-choices').disabled = !selections.size;
  document.querySelector('#clear-choices').disabled = !selections.size;
  for (const [id, card] of cards) card.setAttribute('aria-pressed', String(selections.has(id)));
}
function makeCard(option) {
  const card = node('button', 'concept-card');
  card.type = 'button'; card.disabled = true;
  card.dataset.optionId = option.id;
  card.setAttribute('aria-pressed', String(selections.has(option.id)));
  card.setAttribute('aria-label', `${option.number}. ${option.name}, Reaver, greatsword, ${option.family}. ${option.revision ? 'Needs revision. ' + option.revision : 'Select favorite.'}`);
  const label = node('span', 'concept-label');
  label.append(node('span', 'concept-number', String(option.number).padStart(2, '0')), node('span', 'concept-name', option.name));
  card.append(label, node('span', 'pick-mark', '✓'));
  if (option.note) card.append(node('span', 'concept-note', option.note));
  if (option.revision) { card.classList.add('needs-revision'); card.append(node('span', 'revision-note', 'Needs revision · ' + option.revision)); }
  card.addEventListener('click', () => {
    selections.has(option.id) ? selections.delete(option.id) : selections.add(option.id);
    saveChoices(); updateChoices();
    announce(`${selections.size} favorite${selections.size === 1 ? '' : 's'} selected.${storageAvailable ? ' Saved in this browser.' : ' Browser storage is unavailable; copy your choices before leaving.'}`);
  });
  cards.set(option.id, card);
  return card;
}
function openSheet(family, index, opener) {
  const path = family.sheets[index];
  if (!sheetStates.get(path)?.loaded) return;
  const dialog = document.querySelector('#sheet-dialog');
  document.querySelector('#sheet-title').textContent = `${family.title} · Sheet ${index === 0 ? 'A' : 'B'}`;
  const image = document.querySelector('#sheet-image');
  image.src = path; image.alt = `Original Reaver greatsword ${family.title.toLowerCase()} source: five concepts, numbered ${index * 5 + 1} to ${index * 5 + 5} in reading order, bottom-right cell empty.`;
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
      row.append(node('strong', '', `Sheet ${index === 0 ? 'A' : 'B'} · Options ${index * 5 + 1}–${index * 5 + 5}`));
      const fullSheet = node('button', '', 'View full sheet'); fullSheet.type = 'button'; fullSheet.disabled = true;
      fullSheet.setAttribute('aria-label', `View ${family.title} sheet ${index === 0 ? 'A' : 'B'} in full`);
      fullSheet.addEventListener('click', () => openSheet(family, index, fullSheet));
      const loadStatus = node('span', 'sheet-status', 'Source artwork is being prepared');
      row.append(fullSheet, loadStatus); section.append(row);
      const sheetView = node('div', 'source-sheet');
      const placeholder = node('p', 'source-placeholder', 'Source artwork is being prepared.');
      sheetView.append(placeholder); section.append(sheetView);
      const grid = node('div', 'concept-grid');
      allOptions.filter(option => option.sheet === path).forEach(option => grid.append(makeCard(option)));
      section.append(grid);
      sheetStates.set(path, { ready: false, loaded: false, button: fullSheet, status: loadStatus, view: sheetView, reviewStatus: family.reviewStatuses?.[index] || 'candidate', family: family.title, sheetIndex: index });
    });
    host.append(section);
  }
  updateChoices();
}
function loadSheets() {
  for (const [path, state] of sheetStates) {
    const image = new Image();
    image.onload = () => {
      state.loaded = true; state.ready = state.reviewStatus !== 'needs-review';
      state.button.disabled = false;
      state.status.textContent = state.ready ? 'Concept candidate · not registered or cropped' : 'Candidate awaiting art review · selection paused';
      image.alt = `Reaver greatsword ${state.family.toLowerCase()}, options ${state.sheetIndex * 5 + 1}–${state.sheetIndex * 5 + 5} in reading order. Full unchanged source sheet.`;
      image.className = 'source-image'; state.view.replaceChildren(image);
      for (const option of allOptions.filter(option => option.sheet === path)) {
        cards.get(option.id).disabled = !state.ready || !!option.revision;
        if (option.revision) selections.delete(option.id);
      }
      saveChoices(); updateChoices();
      document.querySelector('#ready-count').textContent = [...cards.values()].filter(card => !card.disabled).length;
    };
    image.onerror = () => {
      state.status.textContent = 'Source not available yet · reload after generation';
      state.view.querySelector('.source-placeholder').textContent = 'Source artwork is not available yet. These numbered slots are planned concepts.';
    };
    image.src = path;
  }
}
for (const filter of document.querySelectorAll('.filters select')) filter.addEventListener('change', () => {
  const family = document.querySelector('#family-filter').value;
  for (const section of document.querySelectorAll('.family')) section.hidden = family !== 'all' && section.dataset.family !== family;
});
document.querySelector('#clear-choices').addEventListener('click', () => {
  selections.clear(); saveChoices(); updateChoices(); announce('Favorites cleared.');
});
document.querySelector('#copy-choices').addEventListener('click', async () => {
  const payload = JSON.stringify({ review: 'update-stances', stage: 'pose-exploration', choices: allOptions.filter(option => selections.has(option.id)).map(option => ({ ...option, sourceStatus: option.revision ? 'needs-revision' : sheetStates.get(option.sheet)?.ready ? 'concept-candidate' : 'unavailable-or-awaiting-review' })) }, null, 2);
  let copyTimeout;
  try {
    await Promise.race([navigator.clipboard.writeText(payload), new Promise((_, reject) => { copyTimeout = setTimeout(() => reject(new Error('Clipboard did not respond')), 1500); })]);
    announce(`${selections.size} choice${selections.size === 1 ? '' : 's'} copied.`);
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
render(); loadSheets();
if (!storageAvailable) announce('Browser storage is unavailable; copy your choices before leaving.');
