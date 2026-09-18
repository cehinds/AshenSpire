import { tableData, stringifyCSV } from './tables.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const leaf = value => value.split('/').at(-1);
const human = value => leaf(value).replace(/\.(csv|json|html|js|css)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ');
const paths = { overview:'m3 10 9-7 9 7v11H3z M9 21v-8h6v8', sprites:'M3 3h18v18H3z M3 16l5-5 4 4 4-6 5 7 M8 7h.01', tables:'M3 3h18v18H3z M3 9h18 M9 9v12 M15 9v12 M3 15h18', relations:'M12 3v5 M5 16l7-8 7 8 M9 3a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M2 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M16 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0', scripts:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h4', plugins:'M3 9h5V6a3 3 0 0 1 6 0v3h7v5h-3a3 3 0 0 0 0 6h3v1H3z', prompts:'M3 3h18v14H9l-6 4z', previews:'M9 7l8 5-8 5z M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0' };
const labels = { overview:'Overview', sprites:'Sprites', tables:'Tables', relations:'Relations', scripts:'Scripts', plugins:'Plugins', prompts:'Prompts', previews:'Previews' };
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"></path></svg>`;
const main = $('#main');
let token, inventory, route, revision = 0, spritePage = 0, selectedSprite, spriteQuery = '', spriteFolder = 'all', currentFile;
let promptCursor = 0, promptTimer, previewPath = 'index.html', animationTimer, toastTimer;
const files = new Map(), undo = [], redo = [];
const changed = () => [...files.values()].filter(file => file.text !== file.original);
const gameURL = name => `/game/${name.split('/').map(encodeURIComponent).join('/')}`;
const previewURL = name => `http://localhost:${location.port}${gameURL(name)}`;
async function api(url, data) {
  const response = await fetch(`/api/${url}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-studio-token': token || '', ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'The editor could not complete that action');
  return result;
}
function toast(text) { const el = $('#toast'); el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000); }
function report(error) { toast(error.message || String(error)); }
function on(selector, event, handler, root = document) { $(selector, root)?.addEventListener(event, e => Promise.resolve(handler(e)).catch(report)); }
function modal(content) { $('#dialog-body').innerHTML = content; if (!$('#dialog').open) $('#dialog').showModal(); }
function updateCount() {
  $('#count').textContent = changed().length;
  $('#status').textContent = changed().length ? `${changed().length} file${changed().length === 1 ? '' : 's'} with unsaved changes` : 'Changes are saved with backups';
  try { localStorage.setItem(`studio-drafts:${inventory.root}`, JSON.stringify(changed().map(({ path, text, original, hash }) => ({ path, text, original, hash })))); } catch { $('#status').textContent += ' · Browser draft storage is full'; }
}
async function openFile(name) {
  if (!files.has(name)) { const file = await api(`file?path=${encodeURIComponent(name)}`); files.set(name, { ...file, original: file.text }); }
  return files.get(name);
}
function stage(name, text) {
  const file = files.get(name);
  if (file.text === text) return;
  undo.push({ path: name, before: file.text, after: text }); if (undo.length > 200) undo.shift(); redo.length = 0;
  file.text = text; updateCount();
}
function newFile(name, text) { if (files.has(name)) throw Error('That file is already open'); files.set(name, { path: name, hash: null, text: '', original: '' }); stage(name, text); }
async function refresh() { inventory = await api('inventory'); $('#project').textContent = `Project: AshenSpire · ${inventory.branch}`; $('#project').title = inventory.root; $('#workspace-status').textContent = `${inventory.branch} · Local workspace`; }
function title(heading, description) { return `<h1>${heading}</h1><p class="sub">${description}</p>`; }
function fileOptions(names, selected) { return names.map(name => `<option value="${esc(name)}" ${selected === name ? 'selected' : ''}>${esc(human(name))} · ${esc(name.split('/').slice(0,-1).join('/'))}</option>`).join(''); }
function snapshotTable(file, table) { return table.format === 'csv' ? stringifyCSV(table) : JSON.stringify(table.document, null, 2) + '\n'; }
function setTableRows(table, rows) { table.rows = rows; if (table.format === 'json') { if (table.key) table.document[table.key] = rows; else table.document = rows; } }

$('#navigation').innerHTML = Object.entries(labels).map(([key, label]) => `<a href="#${key}" data-route="${key}">${icon(key)}${label}</a>`).join('') + '<div class="nav-bottom">Your game, within reach.<br><span class="shortcut">Ctrl+S · Review changes<br>Ctrl+Z · Undo<br>Ctrl+Shift+Z · Redo</span></div>';
async function render() {
  const own = ++revision;
  route = Object.hasOwn(labels, location.hash.slice(1)) ? location.hash.slice(1) : 'sprites';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  clearInterval(animationTimer); animationTimer = null; clearInterval(promptTimer);
  main.scrollTop = 0;
  try { await ({ overview: renderOverview, sprites: renderSprites, tables: renderTables, relations: renderRelations, scripts: renderScripts, plugins: renderPlugins, prompts: renderPrompts, previews: renderPreviews })[route](own); }
  catch (error) { if (revision === own) main.innerHTML = `${title('Could not open this view', esc(error.message))}<button id="retry">Try again</button>`; on('#retry', 'click', render); }
}
function renderOverview() {
  main.innerHTML = `<div class="welcome">${title('Make the game yours.', 'Art, content, relationships, and your tools. One local workspace.')}<div class="notice">Start with a sprite or a table. Changes stay in a draft until you review and save them. Compile content, then rebuild to see them in the game.</div><div class="feature-list">${[['sprites','Bring in your artwork','Drop images into your library, inspect frames, and assign artwork.'],['tables','Edit game content','Work with real CSV and JSON tables, with row forms and references.'],['relations','Connect your systems','Browse property connections and build source-to-target relations.'],['previews','See it in the game','Open card previews, combat galleries, and the live game.']].map(([id,h,p]) => `<a href="#${id}"><h2>${h}</h2><p>${p}</p></a>`).join('')}</div></div><div class="panel"><h2>Build & check</h2><div class="row"><button data-job="content">Compile content</button><button data-job="build">Build game</button><button data-job="validate">Check game</button><button id="backups">Save history</button></div><p class="muted">Build actions use saved files in this workspace. Game checks report their actual results below.</p><pre class="output" id="job-output">Choose an action to begin.</pre></div>`;
  bindJobs(); on('#backups','click', showBackups);
}
function bindJobs() { document.querySelectorAll('[data-job]').forEach(button => button.addEventListener('click', () => runJob(button.dataset.job).catch(report))); }
async function runJob(name) {
  if (changed().length) { toast('Review and save your pending changes before running a build.'); return reviewChanges(); }
  await api('job', { name }); toast('Started. The output below updates as the tool runs.');
  const poll = async () => { const job = await api('job'); if ($('#job-output')) $('#job-output').textContent = `${job.status.toUpperCase()}\n${job.output || ''}`; if (job.status === 'running') setTimeout(() => poll().catch(report), 1000); else toast(`${job.name}: ${job.status}`); }; await poll();
}
async function showBackups() {
  const backups = await api('backups');
  modal(`<h2>Save history</h2><p class="muted">Restore stages the previous content for review. Newly created files are retained.</p>${backups.length ? backups.map(b => `<div class="change"><h3>${esc(new Date(Number(b.id.split('-')[0])).toLocaleString())}</h3><p>${b.files.map(f => esc(f.path)).join('<br>')}</p><button data-backup="${b.id}">Stage previous content</button></div>`).join('') : '<p>No saves yet.</p>'}`);
  document.querySelectorAll('[data-backup]').forEach(button => button.addEventListener('click', async () => {
    try {
      if (changed().length) throw Error('Save or discard current drafts before restoring a backup');
      const result = await api('backup', { id: button.dataset.backup });
      for (const change of result.changes) { const disk = await api(`file?path=${encodeURIComponent(change.path)}`); if (disk.hash !== change.hash) throw Error(`${change.path} has newer changes; choose a newer backup`); }
      for (const change of result.changes) { files.delete(change.path); await openFile(change.path); stage(change.path, change.text); }
      reviewChanges();
    } catch (e) { report(e); }
  }));
}

function renderSprites() {
  selectedSprite ||= inventory.sprites[0];
  main.innerHTML = `<div class="split"><section>${title('Sprite library', 'Find your art. Drop it into the game.')}<div class="toolbar"><input id="sprite-search" type="search" aria-label="Search sprites" placeholder="Search sprites…" value="${esc(spriteQuery)}"><select id="sprite-folder" aria-label="Artwork folder"><option value="all">All artwork</option><option value="assets/">Game assets</option><option value="art/">Art & animation studies</option><option value="assets/imported/">Imported artwork</option></select><button class="primary" id="import">Import sprites</button></div><div id="sprite-grid" class="sprite-grid"></div><div class="toolbar"><button id="sprite-prev">Previous</button><button id="sprite-next">Next</button><span class="page-count" id="sprite-count"></span></div><div id="sprite-drop" class="drop-zone">Drop PNG, WebP, GIF or JPEG files here<br><small>Imported as new files. Existing artwork is kept.</small></div></section><aside class="inspector" id="inspector"><h2>Inspector</h2><p class="muted">Choose artwork to inspect or assign it.</p></aside></div>`;
  $('#sprite-folder').value = spriteFolder;
  on('#sprite-search','input', e => { spriteQuery = e.target.value; spritePage = 0; drawSprites(); });
  on('#sprite-folder','change',e => { spriteFolder = e.target.value; spritePage = 0; drawSprites(); });
  on('#sprite-prev','click',() => { spritePage--; drawSprites(); }); on('#sprite-next','click',() => { spritePage++; drawSprites(); });
  on('#import','click',() => $('#import-files').click());
  drop($('#sprite-drop'), async e => importSprites(e.dataTransfer.files));
  drawSprites(); if (selectedSprite) inspectSprite(selectedSprite);
}
function drawSprites() {
  const matches = inventory.sprites.filter(name => name.toLowerCase().includes(spriteQuery.toLowerCase()) && (spriteFolder === 'all' || name.startsWith(spriteFolder)));
  spritePage = Math.max(0, Math.min(spritePage, Math.ceil(matches.length / 6) - 1));
  const visible = matches.slice(spritePage * 6, spritePage * 6 + 6);
  $('#sprite-grid').innerHTML = visible.length ? visible.map(name => `<button class="sprite ${selectedSprite === name ? 'selected' : ''}" data-sprite="${esc(name)}" draggable="true" title="${esc(name)}"><img class="checker" src="${gameURL(name)}" alt="${esc(human(name))}" loading="lazy"><span class="caption">${esc(leaf(name))}<small>${esc(name.split('/').slice(0,-1).join('/'))}</small></span></button>`).join('') : '<p class="muted">No artwork matches this search.</p>';
  $('#sprite-count').textContent = `${matches.length} images · Page ${spritePage + 1} of ${Math.max(1, Math.ceil(matches.length / 6))}`;
  $('#sprite-prev').disabled = spritePage === 0; $('#sprite-next').disabled = (spritePage + 1) * 6 >= matches.length;
  document.querySelectorAll('[data-sprite]').forEach(button => { button.addEventListener('click', () => inspectSprite(button.dataset.sprite).catch(report)); button.addEventListener('dragstart', e => { selectedSprite = button.dataset.sprite; e.dataTransfer.setData('text/plain', selectedSprite); }); });
}
function drop(element, handler) {
  element.addEventListener('dragover', e => { e.preventDefault(); element.classList.add('over'); });
  element.addEventListener('dragleave', () => element.classList.remove('over'));
  element.addEventListener('drop', e => { e.preventDefault(); element.classList.remove('over'); Promise.resolve(handler(e)).catch(report); });
}
async function importSprites(list) {
  const imported = [], failures = [];
  for (const file of [...list]) {
    try {
      if (file.size > 20 * 1024 * 1024) throw Error('File exceeds 20 MB');
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(file); });
      const result = await api('import', { name: file.name, base64 }); imported.push(result.path);
    } catch (error) { failures.push(`${file.name}: ${error.message}`); }
  }
  await refresh(); if (imported.length) { selectedSprite = imported.at(-1); spriteFolder = 'assets/imported/'; spriteQuery = ''; spritePage = 0; await render(); }
  toast(`${imported.length} imported${failures.length ? ` · ${failures.join('; ')}` : '. Choose Assign artwork to connect it to content.'}`);
}
async function inspectSprite(name) {
  clearInterval(animationTimer); animationTimer = null; selectedSprite = name;
  document.querySelectorAll('[data-sprite]').forEach(b => b.classList.toggle('selected', b.dataset.sprite === name));
  $('#inspector').innerHTML = `<h2>Inspector</h2><img id="inspector-image" class="sprite-preview checker" src="${gameURL(name)}" alt="${esc(leaf(name))}"><p class="filename">${esc(leaf(name))}</p><div class="kv"><span>Dimensions</span><strong id="dimensions">Loading…</strong></div><p class="file-path">${esc(name)}</p><section><h3>Animation preview</h3><p class="muted">Select a filename group to play its frames.</p><label>Frame group<input id="frame-group" value="${esc(name.slice(0,name.lastIndexOf('/') + 1))}"></label><label>Frames per second<input id="fps" type="number" min="1" max="30" value="6"></label><button id="play-animation">Play matching frames</button><small id="frame-status"></small></section><section><h3>Assign artwork</h3><p class="muted">Link the image to a framework asset, or copy its path into a supported source field.</p><button id="assign-art" class="primary">Assign artwork</button><button id="copy-path" style="margin-top:10px">Copy path</button></section>`;
  const image = $('#inspector-image'); image.onload = () => { if ($('#dimensions')) $('#dimensions').textContent = `${image.naturalWidth} × ${image.naturalHeight}`; };
  on('#copy-path','click', async () => { await navigator.clipboard.writeText(name); toast('Artwork path copied'); });
  on('#assign-art','click',() => assignArtwork(name));
  on('#play-animation','click',() => {
    if (animationTimer) { clearInterval(animationTimer); animationTimer = null; $('#play-animation').textContent = 'Play matching frames'; return; }
    const group = $('#frame-group').value.trim();
    const frames = inventory.sprites.filter(p => p.startsWith(group)).sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
    if (!frames.length) throw Error('No frames match that path prefix');
    if (frames.length > 200) throw Error('Narrow the frame group to 200 images or fewer');
    const fps = Number($('#fps').value); if (!Number.isFinite(fps) || fps < 1 || fps > 30) throw Error('Choose 1–30 frames per second');
    let index = 0; $('#play-animation').textContent = 'Pause';
    animationTimer = setInterval(() => { image.src = gameURL(frames[index]); $('#frame-status').textContent = `${index + 1}/${frames.length} · ${leaf(frames[index])}`; index = (index + 1) % frames.length; }, 1000 / fps);
  });
}
async function assignArtwork(name) {
  const file = await openFile('content/framework/assets.json'); const data = JSON.parse(file.text);
  modal(`<h2>Assign artwork</h2><p>${esc(leaf(name))}</p><label>Asset<select id="asset-target">${data.assets.map(a => `<option value="${esc(a.id)}">${esc(a.id)}</option>`).join('')}<option value="new">Create a new asset…</option></select></label><label>New asset ID<input id="new-asset-id" placeholder="asset.myNewSprite"></label><label>Artwork kind<select id="asset-kind">${['CARD_ART','PORTRAIT','ICON','BACKGROUND'].map(k => `<option>${k}</option>`).join('')}</select></label><p class="notice">This stages a framework asset sourcePath. To use a new asset, reference its ID from an entity artId. Legacy weapon artKey uses a filename key rather than a path.</p><button class="primary" id="apply-art">Stage assignment</button>`);
  on('#apply-art','click',() => {
    const target = $('#asset-target').value;
    if (target === 'new') {
      const id = $('#new-asset-id').value.trim(); if (!/^asset\.[\w.-]+$/.test(id) || data.assets.some(a => a.id === id)) throw Error('Choose a unique asset.* ID');
      data.assets.push({ id, kind: $('#asset-kind').value, sourcePath:name, fallbackAssetId:'asset.system.missing' });
    } else data.assets.find(a => a.id === target).sourcePath = name;
    stage(file.path, JSON.stringify(data,null,2) + '\n'); $('#dialog').close(); toast('Artwork assignment staged. Review changes to save.');
  });
}

async function renderTables(own) {
  const name = inventory.tables.includes(currentFile) ? currentFile : 'content/source/weapons.csv';
  const file = await openFile(name); if (own !== revision) return; currentFile = name;
  let table; try { table = tableData(name, file.text); } catch { table = null; }
  main.innerHTML = `${title('Content tables', 'Change a value, add a row, or connect artwork. The source stays yours.')}<div class="toolbar"><select id="table-file" aria-label="Content table">${fileOptions(inventory.tables, name)}</select><button id="add-row" ${!table?.rows ? 'disabled' : ''}>Add row</button><button id="raw-toggle">${table?.rows ? 'Edit JSON / CSV source' : 'Source editor'}</button><button id="undo">Undo</button></div><p class="file-path">${esc(name)} · ${table?.rows?.length ?? 'Nested'} rows · Changes are staged</p><div class="toolbar"><input type="search" id="row-search" placeholder="Find a record…" aria-label="Search rows"><button id="reload-file">Reload from disk</button></div><div id="table-editor"></div><div class="notice">Click a row number for a full record form. Drop an artwork path onto a cell, or paste it. JSON arrays and objects remain typed values. Compile content after saving.</div>`;
  on('#table-file','change', async e => { currentFile = e.target.value; await render(); });
  on('#undo','click',() => applyUndo(false));
  on('#reload-file','click',() => confirmDiscard(file.path));
  on('#raw-toggle','click',() => rawEditor(file));
  if (!table?.rows) return rawEditor(file);
  function drawRows(filter = '') {
    const rows = table.rows.map((row,index) => ({ row,index })).filter(({row}) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()));
    $('#table-editor').innerHTML = `<div class="table-wrap"><table><thead><tr><th>#</th>${table.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(({row,index}) => `<tr><td><button class="row-number" data-record="${index}" aria-label="Edit record ${index + 1}">${index + 1}</button></td>${table.columns.map(column => `<td><input aria-label="${esc(column)} row ${index + 1}" data-row="${index}" data-column="${esc(column)}" value="${esc(typeof row[column] === 'object' ? JSON.stringify(row[column]) : row[column])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#table-editor').querySelectorAll('input').forEach(input => {
      const update = value => {
        const row = table.rows[Number(input.dataset.row)], column = input.dataset.column;
        const old = row[column];
        try { row[column] = parseValue(value, old, table.format); stage(name, snapshotTable(file, table)); input.setCustomValidity(''); }
        catch (error) { input.value = typeof old === 'object' ? JSON.stringify(old) : old ?? ''; report(error); }
      };
      input.addEventListener('input',() => {
        const old = table.rows[Number(input.dataset.row)][input.dataset.column];
        if (table.format === 'csv' || old === undefined || typeof old === 'string') update(input.value);
      });
      input.addEventListener('change',() => update(input.value));
      input.addEventListener('blur',() => update(input.value));
      drop(input, e => { input.value = e.dataTransfer.getData('text/plain'); update(input.value); });
    });
    $('#table-editor').querySelectorAll('[data-record]').forEach(button => button.addEventListener('click',() => recordForm(file, table, Number(button.dataset.record))));
  }
  drawRows(); on('#row-search','input', e => drawRows(e.target.value));
  on('#add-row','click',() => recordForm(file, table, -1));
}
function parseValue(value, old, format) {
  if (format === 'csv' || old === undefined || typeof old === 'string') return value;
  if (typeof old === 'number') { if (!value.trim() || !Number.isFinite(Number(value))) throw Error('Enter a valid number'); return Number(value); }
  if (typeof old === 'boolean') { if (!['true','false'].includes(value)) throw Error('Enter true or false'); return value === 'true'; }
  return JSON.parse(value);
}
function rawEditor(file) {
  $('#table-editor').innerHTML = `<label>Source<textarea class="code" id="raw-text" spellcheck="false">${esc(file.text)}</textarea></label><button id="stage-raw" class="primary" style="margin-top:14px">Stage source changes</button>`;
  on('#raw-text','input',e => stage(file.path,e.target.value));
  on('#stage-raw','click',() => { const text = $('#raw-text').value; tableData(file.path, text); stage(file.path,text); toast('Source changes staged'); });
}
function recordForm(file, table, index) {
  const source = index < 0 ? (table.format === 'json' && table.rows[0] ? { ...structuredClone(table.rows[0]), ...(table.columns.includes('id') ? {id:''} : {}) } : Object.fromEntries(table.columns.map(c => [c, '']))) : table.rows[index];
  modal(`<h2>${index < 0 ? 'Add a record' : 'Edit record'}</h2><p class="file-path">${esc(file.path)}</p><div class="feature-list">${table.columns.map(c => `<label style="margin-bottom:14px">${esc(c)}<input data-field="${esc(c)}" value="${esc(typeof source[c] === 'object' ? JSON.stringify(source[c]) : source[c])}"></label>`).join('')}</div><div class="row"><button id="record-save" class="primary">Stage record</button>${index >= 0 ? '<button id="record-duplicate">Duplicate record</button><button id="record-remove">Remove record…</button>' : ''}</div>`);
  const collect = () => Object.fromEntries([...document.querySelectorAll('[data-field]')].filter(input => !(table.format === 'json' && source[input.dataset.field] === undefined && input.value === '')).map(input => [input.dataset.field, parseValue(input.value, source[input.dataset.field] ?? table.rows.find(r => r[input.dataset.field] !== undefined)?.[input.dataset.field], table.format)]));
  const save = duplicate => { const row = collect(); if ((index < 0 || duplicate) && table.columns.includes('id') && table.rows.some(r => r.id === row.id)) throw Error('Give the new record a unique ID'); const rows = [...table.rows]; if (index < 0 || duplicate) rows.push(row); else rows[index] = row; setTableRows(table,rows); stage(file.path,snapshotTable(file,table)); $('#dialog').close(); render(); };
  on('#record-save','click',() => save(false)); on('#record-duplicate','click',() => save(true));
  on('#record-remove','click',() => {
    modal(`<h2>Remove this record?</h2><p>${esc(source.id || `Row ${index + 1}`)} will be removed from the draft. You can undo this before saving.</p><button id="confirm-remove">Stage removal</button>`);
    on('#confirm-remove','click',() => { setTableRows(table, table.rows.filter((_,i) => i !== index)); stage(file.path,snapshotTable(file,table)); $('#dialog').close(); render(); });
  });
}

async function renderRelations(own) {
  const relationFile = await openFile('content/framework/relations.json'), propertyFile = await openFile('content/framework/properties.json');
  if (own !== revision) return;
  const data = JSON.parse(relationFile.text), properties = JSON.parse(propertyFile.text).properties, ids = new Set(properties.map(p => p.id));
  const issues = data.relations.filter(r => !ids.has(r.sourcePropertyId) || !ids.has(r.targetPropertyId));
  main.innerHTML = `${title('Relationships', 'Connect properties with the rules the game already understands.')}<div class="notice">${data.relations.length} relations · ${properties.length} properties · ${issues.length ? `<span class="error">${issues.length} broken references</span>` : 'All property references resolve'}. Drag a property into a source or target slot, or choose it from the list.</div><div class="toolbar"><input id="property-search" type="search" placeholder="Find a property…" aria-label="Search properties"></div><div class="property-tray" id="property-tray"></div><div class="toolbar"><label>Source<select id="relation-source" class="relation-target">${properties.map(p => `<option>${esc(p.id)}</option>`).join('')}</select></label><label>Connection<select id="relation-type">${['REQUIRES','PERMITS','INHERITS','REPLACES','SUPPRESSES','CONFLICTS_WITH'].map(t => `<option>${t}</option>`).join('')}</select></label><label>Target<select id="relation-target" class="relation-target">${properties.map(p => `<option>${esc(p.id)}</option>`).join('')}</select></label><label>Precedence<input id="precedence" type="number" value="10" min="0"></label><button id="relation-add" class="primary">Connect</button></div><div class="toolbar"><input type="search" id="relation-search" placeholder="Filter connections…" aria-label="Search relations"><button id="table-map">Map table columns</button></div><div class="graph" id="relation-graph"></div>`;
  function tray(filter = '') { $('#property-tray').innerHTML = properties.filter(p => p.id.includes(filter)).map(p => `<button draggable="true" data-property="${esc(p.id)}">${esc(p.id)}</button>`).join(''); document.querySelectorAll('[data-property]').forEach(b => { b.addEventListener('dragstart',e => e.dataTransfer.setData('text/plain', b.dataset.property)); b.addEventListener('click',() => { $('#relation-source').value = b.dataset.property; toast('Source selected. Choose a target and Connect.'); }); }); }
  tray(); on('#property-search','input',e => tray(e.target.value));
  for (const key of ['source','target']) drop($(`#relation-${key}`),e => { const value = e.dataTransfer.getData('text/plain'); if (!ids.has(value)) throw Error('Drop a property from the tray'); $(`#relation-${key}`).value = value; });
  function graph(filter = '') { $('#relation-graph').innerHTML = data.relations.map((r,i) => ({r,i})).filter(({r}) => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())).map(({r,i}) => `<div class="relation-row"><div class="node ${ids.has(r.sourcePropertyId) ? '' : 'error'}">${esc(r.sourcePropertyId)}</div><div class="edge">${esc(r.relation)} →<br><small>precedence ${esc(r.precedence)}</small></div><div class="node ${ids.has(r.targetPropertyId) ? '' : 'error'}">${esc(r.targetPropertyId)}</div><button data-remove-relation="${i}" aria-label="Remove relation ${i + 1}">×</button></div>`).join('') || '<p>No connections match.</p>'; document.querySelectorAll('[data-remove-relation]').forEach(button => button.addEventListener('click',() => { data.relations.splice(Number(button.dataset.removeRelation),1); stage(relationFile.path,JSON.stringify(data,null,2)+'\n'); graph(); toast('Relation removal staged. Ctrl+Z to undo.'); })); }
  graph(); on('#relation-search','input',e => graph(e.target.value));
  on('#relation-add','click',() => {
    const row = { sourcePropertyId:$('#relation-source').value, relation:$('#relation-type').value, targetPropertyId:$('#relation-target').value, precedence:Number($('#precedence').value) };
    if (row.sourcePropertyId === row.targetPropertyId) throw Error('Choose two different properties');
    if (!Number.isFinite(row.precedence) || row.precedence < 0) throw Error('Choose a nonnegative precedence');
    if (data.relations.some(r => r.sourcePropertyId === row.sourcePropertyId && r.targetPropertyId === row.targetPropertyId && r.relation === row.relation)) throw Error('This connection already exists');
    data.relations.push(row); stage(relationFile.path,JSON.stringify(data,null,2)+'\n'); graph(); toast('Connection staged');
  }); on('#table-map','click',mapTables);
  const entityButton = document.createElement('button'); entityButton.textContent = 'Entity links'; $('#table-map').after(entityButton); entityButton.addEventListener('click',() => entityLinks().catch(report));
}
async function entityLinks() {
  const file = await openFile('content/framework/entities.json'), entityDocument = JSON.parse(file.text);
  const properties = JSON.parse((await openFile('content/framework/properties.json')).text).properties;
  const assets = JSON.parse((await openFile('content/framework/assets.json')).text).assets;
  modal(`<h2>Entity links</h2><p class="muted">Connect framework entities to artwork and properties. Existing property parameters are preserved.</p><label>Entity<select id="entity-choice">${entityDocument.entities.map(e => `<option>${esc(e.id)}</option>`).join('')}</select></label><div id="entity-fields"></div>`);
  function fields() {
    const entity = entityDocument.entities.find(e => e.id === $('#entity-choice').value);
    $('#entity-fields').innerHTML = `<h3 style="margin-top:22px">${esc(entity.kind)}</h3><label>Artwork asset<select id="entity-art"><option value="">No artwork</option>${assets.map(a => `<option value="${esc(a.id)}" ${entity.artId === a.id ? 'selected' : ''}>${esc(a.id)}</option>`).join('')}</select></label><h3 style="margin-top:22px">Properties</h3><div class="property-tray">${properties.map(p => `<label class="row"><input type="checkbox" data-entity-property="${esc(p.id)}" ${(entity.properties || []).some(v => v.propertyId === p.id) ? 'checked' : ''}>${esc(p.id)}</label>`).join('')}</div><button id="save-entity" class="primary" style="margin-top:20px">Stage entity links</button>`;
    on('#save-entity','click',() => {
      const existing = new Map((entity.properties || []).map(p => [p.propertyId,p]));
      entity.properties = [...window.document.querySelectorAll('[data-entity-property]:checked')].map(input => existing.get(input.dataset.entityProperty) || { propertyId:input.dataset.entityProperty, source:'AUTHORED' });
      const art = $('#entity-art').value; if (art) entity.artId = art; else delete entity.artId;
      stage(file.path,JSON.stringify(entityDocument,null,2)+'\n'); $('#dialog').close(); toast('Entity artwork and property links staged');
    });
  }
  fields(); on('#entity-choice','change',fields);
}
async function mapTables() {
  modal(`<h2>Map table columns</h2><p class="muted">Match a source column to a target column and check every source value. Mappings are editor annotations; game rules continue to come from source content.</p><div class="stack"><label>Source table<select id="map-source-file">${fileOptions(inventory.tables)}</select></label><label>Source column<select id="map-source-column"></select></label><label>Target table<select id="map-target-file">${fileOptions(inventory.tables)}</select></label><label>Target column<select id="map-target-column"></select></label></div><div class="toolbar"><button class="primary" id="check-map">Check references</button><button id="save-map">Save mapping</button></div><pre id="map-output" class="output">Choose two tables.</pre>`);
  const tables = {};
  async function load(side) { const name = $(`#map-${side}-file`).value; tables[side] = tableData(name,(await openFile(name)).text); $(`#map-${side}-column`).innerHTML = tables[side].columns.map(c => `<option>${esc(c)}</option>`).join(''); }
  await load('source'); await load('target'); for (const side of ['source','target']) on(`#map-${side}-file`,'change',() => load(side));
  on('#check-map','click',() => {
    const from = $('#map-source-column').value, to = $('#map-target-column').value;
    if (!from || !to || !tables.source.rows?.length || !tables.target.rows?.length) throw Error('Choose two nonempty tables and their columns before checking references');
    const targets = new Set((tables.target.rows || []).map(r => String(r[to]))), missing = [];
    for (const row of tables.source.rows || []) for (const value of String(row[from] ?? '').split('|').filter(Boolean)) if (!targets.has(value)) missing.push(`${row.id || 'record'} → ${value}`);
    $('#map-output').textContent = missing.length ? `${missing.length} unresolved references\n${missing.join('\n')}` : `${tables.source.rows?.length || 0} source rows checked. All nonempty references resolve.`;
  });
  on('#save-map','click',async () => {
    const name = 'editor/workspace/table-mappings.json'; let file;
    try { file = await openFile(name); } catch (e) { if (!e.message.includes('ENOENT')) throw e; newFile(name,'[]\n'); file = files.get(name); }
    const data = JSON.parse(file.text); data.push({ source:$('#map-source-file').value, sourceColumn:$('#map-source-column').value, target:$('#map-target-file').value, targetColumn:$('#map-target-column').value }); stage(name,JSON.stringify(data,null,2)+'\n'); toast('Mapping staged');
  });
}

async function renderScripts(own) {
  const name = inventory.scripts.includes(currentFile) ? currentFile : 'src/content/scripts.js';
  const file = await openFile(name); if (own !== revision) return; currentFile = name;
  main.innerHTML = `${title('Scripts & styles', 'Open the real source when you need more control.')}<div class="toolbar"><select id="script-file" aria-label="Source file">${fileOptions(inventory.scripts,name)}</select><button id="stage-script" class="primary">Stage changes</button><button id="new-script">New script</button><button id="reload-file">Reload from disk</button></div><p class="file-path">${esc(name)}</p><textarea id="script-text" class="code" aria-label="Script source" spellcheck="false">${esc(file.text)}</textarea><div class="notice">Source changes are syntax-checked on save. New workspace scripts are files you can import explicitly; they do not run automatically. New game mechanics still need a SPEC change.</div>`;
  on('#script-file','change', async e => { stage(name,$('#script-text').value); currentFile = e.target.value; await render(); });
  on('#stage-script','click',() => { stage(name,$('#script-text').value); toast('Script changes staged'); });
  on('#script-text','input',e => { stage(name,e.target.value); });
  on('#reload-file','click',() => confirmDiscard(name));
  on('#new-script','click',() => {
    modal('<h2>New workspace script</h2><label>Filename<input id="script-name" placeholder="my-tool.js"></label><p class="muted">Saved under editor/workspace. Add imports explicitly when integrating with the game.</p><button id="create-script" class="primary">Create script</button>');
    on('#create-script','click',() => { const value = $('#script-name').value; if (!/^[\w-]+\.js$/.test(value)) throw Error('Use a simple .js filename'); const target = `editor/workspace/${value}`; newFile(target,'// AshenSpire workspace script\nexport function run(context) {\n  return context;\n}\n'); inventory.scripts.push(target); currentFile = target; $('#dialog').close(); render(); });
  });
  $('#script-text').addEventListener('keydown',e => { if (e.key === 'Tab') { e.preventDefault(); const el = e.target; el.setRangeText('  ',el.selectionStart,el.selectionEnd,'end'); stage(name,el.value); } });
}

async function renderPlugins(own) {
  const name = 'editor/workspace/plugins.json'; let file;
  try { file = await openFile(name); } catch (e) { if (!e.message.includes('ENOENT')) throw e; }
  if (own !== revision) return;
  const plugins = file ? JSON.parse(file.text) : [];
  main.innerHTML = `${title('Plugins & tools', 'Bring your local tools into the same workspace.')}<div class="notice">Editor plugins are local preview tools registered by a JSON manifest. They run on the preview origin, separate from editor file access. Codex plugins stay managed by Codex.</div><div class="toolbar"><button id="add-plugin" class="primary">Add local tool</button><button id="import-plugin">Import manifest</button><input type="file" id="plugin-file" accept="application/json,.json" hidden></div><div class="plugin-list">${plugins.length ? plugins.map((p,i) => `<article class="plugin-card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.description)}</p><p class="file-path">${esc(p.path)}</p><div class="row"><button data-open-plugin="${i}">Open tool</button><button data-toggle-plugin="${i}">${p.enabled === false ? 'Enable' : 'Disable'}</button></div></article>`).join('') : '<p class="muted">No custom tools yet. Register an existing gallery, or add a local HTML tool.</p>'}</div><div class="panel" style="margin-top:24px"><h2>Already in your project</h2><p class="muted">The preview hub automatically finds your card galleries, component catalog, enemy poses, and combat animation studies.</p><a class="button" href="#previews">Browse existing tools</a></div>`;
  const save = async () => { if (!files.has(name)) newFile(name,'[]\n'); stage(name,JSON.stringify(plugins,null,2)+'\n'); toast('Plugin registration staged'); await render(); };
  document.querySelectorAll('[data-open-plugin]').forEach(b => b.addEventListener('click',() => { const p = plugins[Number(b.dataset.openPlugin)]; if (p.enabled === false) return toast('Enable this tool first'); previewPath = p.path; location.hash = 'previews'; }));
  document.querySelectorAll('[data-toggle-plugin]').forEach(b => b.addEventListener('click',() => { const p = plugins[Number(b.dataset.togglePlugin)]; p.enabled = p.enabled === false; save().catch(report); }));
  const add = async data => { if (typeof data.name !== 'string' || !data.name.trim() || !inventory.previews.includes(data.path)) throw Error('Choose a named HTML tool from this project'); if (plugins.some(p => p.path === data.path)) throw Error('That tool is already registered'); plugins.push({ name:data.name.slice(0,100), description:String(data.description || '').slice(0,400), path:data.path, enabled:true }); await save(); };
  on('#add-plugin','click',() => { modal(`<h2>Add a local tool</h2><div class="stack"><label>Name<input id="plugin-name" placeholder="My sprite workshop"></label><label>Description<input id="plugin-description" placeholder="What does this tool help you do?"></label><label>Tool page<select id="plugin-path">${fileOptions(inventory.previews)}</select></label></div><button class="primary" id="register-plugin" style="margin-top:18px">Register tool</button>`); on('#register-plugin','click',async () => { await add({ name:$('#plugin-name').value, description:$('#plugin-description').value, path:$('#plugin-path').value }); $('#dialog').close(); }); });
  on('#import-plugin','click',() => $('#plugin-file').click()); on('#plugin-file','change',async e => { const f = e.target.files[0]; if (f) await add(JSON.parse(await f.text())); });
}

async function renderPrompts() {
  main.innerHTML = `<div class="prompt-page">${title('Prompt your game', 'Plan a change with Codex, using your ChatGPT sign-in.')}<div class="panel"><div class="row"><strong id="account-status">Connect to check your account</strong><button id="connect-codex">Connect Codex</button><button id="login-codex">Sign in with ChatGPT</button><a class="button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a></div><p class="muted">No API key. Codex handles sign-in and account limits. This assistant can inspect and propose; apply changes through the editor or continue implementation in Codex.</p><div id="login-link"></div></div><div class="toolbar"><button data-prompt="Explain the selected content and suggest improvements without changing mechanics.">Explain content</button><button data-prompt="Inspect entity and table references. Identify missing or inconsistent links and propose concrete corrections.">Find broken links</button><button data-prompt="Help me plan a new enemy using existing mechanics. List the required content records, art, and tests.">Plan an enemy</button><button id="load-prompts">Saved prompts</button></div><label>What would you like to change?<textarea id="prompt-text" class="prompt-input" placeholder="Help me create a new enemy using this sprite…"></textarea></label><label style="margin-top:12px"><span><input type="checkbox" id="attach-context" checked> Include the selected file or sprite as context</span></label><p class="file-path" id="prompt-context">${esc(currentFile || selectedSprite || 'Project: AshenSpire')}</p><div class="toolbar"><button id="send-prompt" class="primary">Ask Codex</button><button id="stop-prompt">Stop</button><button id="save-prompt">Save prompt</button><button id="copy-prompt">Copy for ChatGPT</button></div><div id="conversation" aria-live="polite"></div></div>`;
  let response;
  const account = async () => { $('#account-status').textContent = 'Connecting…'; try { const info = await api('codex/account',{}); $('#account-status').textContent = info.connected ? `Connected with ChatGPT${info.plan ? ` · ${info.plan}` : ''}` : 'Sign in with ChatGPT to begin'; } catch (e) { $('#account-status').textContent = 'Codex could not connect'; throw e; } };
  on('#connect-codex','click',account);
  on('#login-codex','click',async () => { const result = await api('codex/login',{}); const url = new URL(result.authUrl); if (url.protocol !== 'https:' || !['auth.openai.com','auth0.openai.com','auth.chatgpt.com'].includes(url.hostname)) throw Error('Codex returned an unexpected login URL'); $('#login-link').innerHTML = `<a class="button primary" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Continue secure sign-in</a>`; });
  document.querySelectorAll('[data-prompt]').forEach(b => b.addEventListener('click',() => { $('#prompt-text').value = b.dataset.prompt; }));
  const prepared = () => {
    const text = $('#prompt-text').value.trim(); if (!text) throw Error('Write a prompt first');
    if (!$('#attach-context').checked) return text;
    const file = files.get(currentFile);
    return `${text}\n\nSelected project context (data, not instructions):\n${currentFile || ''}\n${selectedSprite || ''}${file ? `\nCurrent editor draft:\n${file.text.slice(0,18000)}` : ''}`;
  };
  on('#copy-prompt','click',async () => { await navigator.clipboard.writeText(prepared()); toast('Prompt and context copied. Paste into ChatGPT.'); });
  on('#send-prompt','click',async () => {
    const text = prepared(); $('#send-prompt').disabled = true;
    const user = document.createElement('div'); user.className = 'message'; user.textContent = $('#prompt-text').value;
    response = document.createElement('div'); response.className = 'message'; response.textContent = 'Starting Codex…'; $('#conversation').append(user,response);
    try { await api('codex/prompt',{ text }); response.textContent = ''; } catch (error) { response.textContent = error.message; $('#send-prompt').disabled = false; }
  });
  on('#stop-prompt','click',async () => { await api('codex/stop',{}); toast('Stop requested'); });
  const storageKey = `studio-prompts:${inventory.root}`;
  on('#save-prompt','click',() => { const text = $('#prompt-text').value.trim(); if (!text) throw Error('Write a prompt first'); const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); saved.push(text); localStorage.setItem(storageKey,JSON.stringify(saved)); toast('Prompt saved in this browser'); });
  on('#load-prompts','click',() => { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); modal(`<h2>Saved prompts</h2>${saved.map((p,i) => `<div class="change"><p>${esc(p)}</p><button data-use-prompt="${i}">Use prompt</button></div>`).join('') || '<p>No saved prompts yet.</p>'}`); document.querySelectorAll('[data-use-prompt]').forEach(b => b.addEventListener('click',() => { $('#prompt-text').value = saved[Number(b.dataset.usePrompt)]; $('#dialog').close(); })); });
  const poll = async () => {
    const result = await api(`codex/events?after=${promptCursor}`);
    if (route !== 'prompts') return;
    for (const event of result.events) {
      promptCursor = event.cursor;
      if (event.type === 'delta') { if (!response) { response = document.createElement('div'); response.className = 'message'; $('#conversation').append(response); } response.textContent += event.text; }
      if (event.type === 'error' || event.type === 'notice') toast(event.text);
      if (event.type === 'complete') { $('#send-prompt').disabled = false; if (event.error && response) response.textContent += `\n${event.error}`; }
      if (event.type === 'login' && event.success) { await account(); $('#login-link').textContent = ''; }
    }
    $('#send-prompt').disabled = result.active;
  };
  promptCursor = 0; await poll(); promptTimer = setInterval(() => poll().catch(report), 1500);
}

function renderPreviews() {
  main.innerHTML = `${title('Preview hub', 'Your game and the tools you have already built.')}<div class="toolbar"><input id="preview-search" type="search" placeholder="Find a gallery or tool…" aria-label="Search previews"><button id="desktop-preview">Desktop</button><button id="phone-preview">Phone · 390px</button><button id="refresh-preview">Reload preview</button><a id="open-preview" class="button" target="_blank" rel="noopener noreferrer">Open window</a></div><div class="preview-layout"><aside class="preview-list" id="preview-list"></aside><section><p id="preview-path" class="file-path"></p><div class="preview-stage" id="preview-stage"><iframe id="preview-frame" title="Game and tool preview" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"></iframe></div></section></div>`;
  const select = name => { previewPath = name; $('#preview-frame').src = previewURL(name); $('#preview-path').textContent = name; $('#open-preview').href = previewURL(name); document.querySelectorAll('[data-preview]').forEach(b => b.classList.toggle('active',b.dataset.preview === name)); };
  function list(filter = '') { $('#preview-list').innerHTML = inventory.previews.filter(p => p.toLowerCase().includes(filter.toLowerCase())).map(p => `<button data-preview="${esc(p)}" class="${p === previewPath ? 'active' : ''}">${esc(human(p))}<small class="file-path" style="display:block;margin-top:5px">${esc(p)}</small></button>`).join(''); document.querySelectorAll('[data-preview]').forEach(b => b.addEventListener('click',() => select(b.dataset.preview))); }
  list(); select(previewPath); on('#preview-search','input',e => list(e.target.value)); on('#desktop-preview','click',() => $('#preview-stage').classList.remove('phone')); on('#phone-preview','click',() => $('#preview-stage').classList.add('phone')); on('#refresh-preview','click',() => select(previewPath));
}

function confirmDiscard(name) {
  const file = files.get(name);
  modal(`<h2>Reload this file?</h2><p>${esc(name)}</p><p>Its unsaved draft will be replaced by the current file on disk.</p><button id="confirm-reload">Reload from disk</button>`);
  on('#confirm-reload','click',async () => { files.delete(name); try { await openFile(name); } catch (e) { files.set(name,file); throw e; } undo.length = 0; redo.length = 0; updateCount(); $('#dialog').close(); await render(); });
}
function applyUndo(forward) {
  const stack = forward ? redo : undo, destination = forward ? undo : redo, change = stack.pop();
  if (!change) return toast('No changes to undo');
  files.get(change.path).text = forward ? change.after : change.before; destination.push(change); updateCount(); render();
}
function reviewChanges() {
  const pending = changed();
  modal(`<h2>Review changes</h2><p class="muted">${pending.length} file${pending.length === 1 ? '' : 's'} will be saved to ${esc(inventory.root)}. Each save keeps a backup. Build the game after saving source changes.</p>${pending.map(file => `<div class="change"><h3>${esc(file.path)}</h3><div class="diff"><div><small>On disk when opened</small><pre>${esc(file.original || '(new file)')}</pre></div><div><small>Your draft</small><pre>${esc(file.text)}</pre></div></div></div>`).join('') || '<p>No pending changes.</p>'}<div class="toolbar"><button id="save-changes" class="primary" ${pending.length ? '' : 'disabled'}>Save ${pending.length} file${pending.length === 1 ? '' : 's'}</button></div><p id="save-result" role="status"></p>`);
  on('#save-changes','click',async () => {
    $('#save-changes').disabled = true;
    try { const saved = await api('save',{ changes:pending.map(({path,text,hash}) => ({path,text,hash})) }); for (const result of saved.files) { const file = files.get(result.path); file.hash = result.hash; file.original = file.text; } undo.length = 0; redo.length = 0; updateCount(); await refresh(); $('#dialog').close(); toast(`${saved.files.length} files saved with a backup`); await render(); }
    catch (error) { $('#save-result').textContent = error.message; $('#save-result').className = 'error'; $('#save-changes').disabled = false; }
  });
}
window.addEventListener('hashchange',render);
window.addEventListener('beforeunload',e => { if (changed().length) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown',e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === 's') { e.preventDefault(); reviewChanges(); }
  if (e.key.toLowerCase() === 'z' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); applyUndo(e.shiftKey); }
});
on('#review','click',reviewChanges); on('#preview-game','click',() => { previewPath = 'index.html'; location.hash = 'previews'; if (route === 'previews') render(); });
on('#import-files','change',async e => { await importSprites(e.target.files); e.target.value = ''; });
try {
  token = (await api('session')).token; await refresh();
  const drafts = JSON.parse(localStorage.getItem(`studio-drafts:${inventory.root}`) || '[]');
  for (const file of drafts) if (typeof file.path === 'string' && typeof file.text === 'string' && typeof file.original === 'string') files.set(file.path,file);
  updateCount(); await render(); if (drafts.length) toast(`Recovered ${drafts.length} unsaved drafts. Save checks for disk conflicts.`);
} catch (error) { main.innerHTML = title('Could not open the workspace',esc(error.message)); }
