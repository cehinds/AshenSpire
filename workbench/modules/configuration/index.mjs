// Game Configuration: edit the two supported Ashen author profiles and validate
// each draft with the same resolver used by the game-config build.
const CORE_PATH = 'games/ashenspire/game.json';
const CURRENT_PATH = 'games/ashenspire/presets/current.json';
import { profileFiles, moduleFiles, moduleEntry, authorState, schemaFields, parseFieldValue, setModuleEnabled, setModuleSetting } from './model.mjs';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/configuration/configuration.css"><section class="gc">
      <header class="gc-head"><div><h2>Game Configuration</h2><p>Author JSON profiles, validate through the shared resolver, then preview either built-in selection.</p></div>
        <div class="gc-profiles" role="group" aria-label="Built-in profiles"><button type="button" class="btn" data-profile="core">Product core</button><button type="button" class="btn" data-profile="current">Current game</button></div>
      </header>
      <div class="gc-bar"><label class="gc-source">Editing <select aria-label="Profile file"><option value="${CORE_PATH}">Product core — ${CORE_PATH}</option><option value="${CURRENT_PATH}">Current game — ${CURRENT_PATH}</option></select></label>
        <div class="gc-actions"><button type="button" class="btn" data-action="load">Reload file</button><button type="button" class="btn" data-action="import">Import JSON</button><button type="button" class="btn" data-action="format">Format</button><button type="button" class="btn" data-action="validate">Validate</button><button type="button" class="btn btn-primary" data-action="save">Save</button><button type="button" class="btn" data-action="export">Export JSON</button></div>
        <input type="file" accept="application/json,.json" hidden>
      </div>
      <label class="gc-editor-label" for="gc-json">Author entry</label><textarea id="gc-json" spellcheck="false" aria-label="Game profile JSON"></textarea>
      <details class="gc-modules" open><summary>Modules <span class="gc-mod-count"></span></summary><div class="gc-mod-body"><p class="gc-muted">Loading modules…</p></div></details>
      <div class="gc-foot"><div class="gc-status" role="status" aria-live="polite">Loading profile…</div><div class="gc-preview"><button type="button" class="btn" data-preview="core">Preview product core</button><button type="button" class="btn" data-preview="current">Preview current game</button><button type="button" class="btn" data-preview="draft">Preview authored JSON</button></div></div>
      <section class="gc-report" aria-live="polite" hidden></section>
    </section>`;
    const $ = (selector) => el.querySelector(selector);
    const textarea = $('.gc textarea');
    const pathSelect = $('.gc-source select');
    const status = $('.gc-status');
    const report = $('.gc-report');
    let baseHash = null;
    let loadedPath = '';
    let loadedText = '';
    let validated = null;
    let busy = false;
    let files = profileFiles([CORE_PATH, CURRENT_PATH]);

    function fillPicker(selected) {
      const groups = [...new Set(files.map((f) => f.group))];
      pathSelect.innerHTML = groups.map((g) => `<optgroup label="${esc(g)}">${files.filter((f) => f.group === g).map((f) => `<option value="${esc(f.path)}">${esc(f.label)} — ${esc(f.path.replace('games/ashenspire/', ''))}</option>`).join('')}</optgroup>`).join('');
      if (selected && files.some((f) => f.path === selected)) pathSelect.value = selected;
    }
    async function loadFileList() {
      try {
        const list = await ctx.api('files/list?dir=games/ashenspire&ext=json');
        const found = profileFiles(list.files || []);
        if (found.length) files = found;
      } catch { /* the two built-in files stay on offer */ }
      fillPicker(pathSelect.value || CORE_PATH);
    }
    const isResolved = (path) => files.find((f) => f.path === path)?.resolves !== false;

    // ---------- the Modules panel ----------
    // Edits go to the textarea draft only; nothing is saved until Save. Each module's schema, defaults and guide are
    // read when its row is first opened. A shape the panel does not support is shown as read-only JSON.
    const modPanel = $('.gc-modules');
    const modBody = $('.gc-mod-body');
    let modules = [];            // [{ id, entry, files }]
    let modulesLoaded = false;
    const detail = new Map();    // id -> { fields, defaults, guide, error } once opened
    const openIds = new Set();
    let resolvedModules = null;  // the resolver's modules from the last silent resolve of the draft
    let resolveTimer = 0;

    async function readJson(path) { return JSON.parse((await ctx.api(`files/read?path=${encodeURIComponent(path)}`)).text); }
    async function loadModules() {
      try {
        const list = await ctx.api('files/list?dir=engine/modules&ext=json');
        const found = moduleFiles(list.files || []);
        modules = await Promise.all(found.map(async (files) => {
          let manifest = null, guide = '';
          try { manifest = await readJson(files.manifest); } catch { /* listed with its id only */ }
          try { guide = (await ctx.api(`files/read?path=${encodeURIComponent(files.guide)}`)).text; } catch { /* no guide */ }
          return { id: files.id, entry: moduleEntry(files.id, manifest, guide), files };
        }));
      } catch (error) { modBody.innerHTML = `<p class="gc-muted">Modules could not be listed: ${esc(error.message)}</p>`; return; }
      modulesLoaded = true;
      renderModules();
    }
    async function loadDetail(mod) {
      if (detail.has(mod.id)) return detail.get(mod.id);
      const info = { fields: [], guide: '', error: '' };
      try {
        let schema = null, defaults = null;
        try { schema = await readJson(mod.files.schema); } catch (e) { info.error = `settings.schema.json: ${e.message}`; }
        try { defaults = await readJson(mod.files.defaults); } catch { /* no defaults: no placeholders */ }
        info.fields = schemaFields(schema, defaults);
        info.defaults = defaults;
      } catch (e) { info.error = e.message; }
      try { info.guide = (await ctx.api(`files/read?path=${encodeURIComponent(mod.files.guide)}`)).text; } catch { /* no guide */ }
      detail.set(mod.id, info);
      return info;
    }
    function draftAuthor() { try { return parseDraft(); } catch { return null; } }
    function stateBadge(mod, author) {
      const a = authorState(author, mod.id);
      const resolved = resolvedModules ? (resolvedModules[mod.id] === false || resolvedModules[mod.id] === undefined ? 'disabled' : 'enabled') : '';
      const label = a.state === 'off' ? 'off in this file' : a.state === 'on' ? 'on in this file' : 'inherits the core';
      return `<span class="gc-mod-state" data-state="${a.state}">${esc(label)}</span>${resolved ? `<span class="gc-mod-resolved" data-resolved="${resolved}">resolved ${resolved}</span>` : ''}`;
    }
    function isOn(author, mod) {
      const a = authorState(author, mod.id);
      if (a.state === 'off') return false;
      if (a.state === 'on') return true;
      return resolvedModules ? resolvedModules[mod.id] !== false && resolvedModules[mod.id] !== undefined : true;
    }
    function fieldHtml(mod, field, settings, disabled) {
      const current = settings[field.key];
      const dflt = field.default === undefined ? '' : typeof field.default === 'object' ? JSON.stringify(field.default) : String(field.default);
      const id = `gcf-${mod.id}-${field.key}`;
      const label = `<label for="${esc(id)}"><code>${esc(field.key)}</code>${field.required ? ' *' : ''}</label>`;
      const attrs = `id="${esc(id)}" data-mod="${esc(mod.id)}" data-key="${esc(field.key)}"${disabled ? ' disabled' : ''}`;
      let control;
      if (field.kind === 'enum') {
        control = `<select ${attrs}><option value="">(default${dflt ? `: ${esc(dflt)}` : ''})</option>${field.options.map((o) => `<option value="${esc(o)}"${current !== undefined && String(current) === String(o) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      } else if (field.kind === 'boolean') {
        control = `<select ${attrs}><option value="">(default${dflt ? `: ${esc(dflt)}` : ''})</option><option value="true"${current === true ? ' selected' : ''}>true</option><option value="false"${current === false ? ' selected' : ''}>false</option></select>`;
      } else if (field.kind === 'number') {
        const bounds = `${typeof field.min === 'number' ? ` min="${field.min}"` : ''}${typeof field.max === 'number' ? ` max="${field.max}"` : ''}`;
        control = `<input type="number" ${attrs}${bounds} step="${field.integer ? 1 : 'any'}" value="${current === undefined ? '' : esc(current)}" placeholder="${esc(dflt)}">`;
      } else if (field.kind === 'string') {
        control = `<input type="text" ${attrs} value="${current === undefined ? '' : esc(current)}" placeholder="${esc(dflt)}">`;
      } else {
        const shown = current !== undefined ? current : field.default;
        control = `<pre class="gc-json" title="Edit this setting in the JSON above">${esc(shown === undefined ? '(no default)' : JSON.stringify(shown))}</pre>`;
      }
      return `<div class="gc-field">${label}${control}<small class="gc-field-error" aria-live="polite"></small>${field.description ? `<small class="gc-muted">${esc(field.description)}</small>` : ''}</div>`;
    }
    async function fillDetail(row) {
      const mod = modules.find((m) => m.id === row.dataset.id);
      const body = row.querySelector('.gc-mod-detail');
      if (!mod || !body) return;
      body.innerHTML = '<p class="gc-muted">Loading…</p>';
      const info = await loadDetail(mod);
      const author = draftAuthor();
      const a = authorState(author, mod.id);
      const disabled = !author || a.state === 'off';
      const form = info.fields.length ? `<div class="gc-fields">${info.fields.map((f) => fieldHtml(mod, f, a.settings, disabled)).join('')}</div>` : '<p class="gc-muted">This module has no settings the form can show.</p>';
      body.innerHTML = `${mod.entry.description ? `<p>${esc(mod.entry.description)}</p>` : ''}${info.error ? `<p class="gc-field-error">${esc(info.error)}</p>` : ''}${disabled ? `<p class="gc-muted">${author ? 'Switch the module on to edit its settings.' : 'Fix the JSON to edit settings.'}</p>` : ''}${form}${info.guide ? `<details class="gc-guide"><summary>Guide (${esc(mod.files.guide)})</summary><pre>${esc(info.guide)}</pre></details>` : ''}`;
    }
    function renderModules() {
      modPanel.hidden = !isResolved(pathSelect.value);
      if (modPanel.hidden || !modulesLoaded) return;
      const author = draftAuthor();
      $('.gc-mod-count').textContent = author ? `(${modules.filter((m) => isOn(author, m)).length} of ${modules.length} on)` : '';
      if (!author) { modBody.innerHTML = '<p class="gc-muted">The draft is not valid JSON; fix it to use the module controls.</p>'; return; }
      modBody.innerHTML = modules.length ? modules.map((mod) => `<details class="gc-mod" data-id="${esc(mod.id)}"${openIds.has(mod.id) ? ' open' : ''}><summary><span class="gc-toggle"><input type="checkbox" data-toggle="${esc(mod.id)}" aria-label="Enable ${esc(mod.id)}"${isOn(author, mod) ? ' checked' : ''}></span><code>${esc(mod.id)}</code><span class="gc-mod-name">${esc(mod.entry.name === mod.id ? mod.entry.description : mod.entry.name)}</span><span class="gc-mod-states">${stateBadge(mod, author)}</span></summary><div class="gc-mod-detail"></div></details>`).join('') : '<p class="gc-muted">No engine modules found.</p>';
      for (const row of modBody.querySelectorAll('details.gc-mod[open]')) fillDetail(row);
    }
    /** Update the state labels, switches and count in place: open rows keep their inputs and focus. */
    function refreshStates() {
      const author = draftAuthor();
      if (!author || !modulesLoaded) return;
      $('.gc-mod-count').textContent = `(${modules.filter((m) => isOn(author, m)).length} of ${modules.length} on)`;
      for (const row of modBody.querySelectorAll('details.gc-mod')) {
        const mod = modules.find((m) => m.id === row.dataset.id);
        if (!mod) continue;
        row.querySelector('.gc-mod-states').innerHTML = stateBadge(mod, author);
        row.querySelector('input[data-toggle]').checked = isOn(author, mod);
      }
    }
    function resolveSoon() {
      clearTimeout(resolveTimer);
      resolveTimer = setTimeout(async () => {
        const author = draftAuthor();
        if (!author || !isResolved(pathSelect.value)) { resolvedModules = null; renderModules(); return; }
        try { resolvedModules = (await ctx.api('game-profile/validate', { author })).modules || null; } catch { resolvedModules = null; }
        refreshStates();
      }, 350);
    }
    /** Put edited draft text into the textarea, as typing would. */
    function applyDraft(next) {
      textarea.value = next;
      validated = null;
      report.hidden = true;
      setStatus('Unsaved edits; validate before saving or previewing.');
      renderModules();
      resolveSoon();
    }
    modBody.addEventListener('toggle', (event) => {
      const row = event.target.closest?.('details.gc-mod');
      if (!row || event.target !== row) return;
      if (row.open) { openIds.add(row.dataset.id); fillDetail(row); } else openIds.delete(row.dataset.id);
    }, true);
    modBody.addEventListener('click', (event) => {
      const box = event.target.closest('input[data-toggle]');
      if (!box) return;
      event.stopPropagation(); // a click on the switch does not open or close the row
      try { applyDraft(setModuleEnabled(textarea.value, box.dataset.toggle, box.checked, pathSelect.value)); }
      catch (error) { box.checked = !box.checked; setStatus(error.message, 'error'); }
    });
    modBody.addEventListener('change', (event) => {
      const input = event.target.closest('[data-key]');
      if (!input) return;
      const mod = modules.find((m) => m.id === input.dataset.mod);
      const field = detail.get(input.dataset.mod)?.fields.find((f) => f.key === input.dataset.key);
      const msg = input.parentElement.querySelector('.gc-field-error');
      if (!mod || !field) return;
      const parsed = parseFieldValue(field, input.value);
      if (!parsed.ok) { msg.textContent = parsed.error; return; }
      msg.textContent = '';
      try {
        const next = setModuleSetting(textarea.value, mod.id, field.key, parsed.value);
        textarea.value = next; validated = null; report.hidden = true;
        setStatus('Unsaved edits; validate before saving or previewing.');
        // Only the state labels change; the open rows keep their inputs (and focus).
        refreshStates();
        resolveSoon();
      } catch (error) { msg.textContent = error.message; }
    });

    function setStatus(message, kind = '') {
      status.textContent = message;
      status.dataset.kind = kind;
    }
    function parseDraft() {
      const value = JSON.parse(textarea.value);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Profile JSON must be an object.');
      return value;
    }
    function reportHtml(profile) {
      const modules = Object.entries(profile.modules || {}).map(([id, settings]) => `<li><code>${esc(id)}</code><span>${settings === false ? 'off' : 'enabled'}</span></li>`).join('');
      return `<div class="gc-report-head"><strong>Valid profile</strong><code>${esc(profile.id || 'custom')}</code><span>Hash ${esc(profile.hash || 'unavailable')}</span></div><p>Resolved modules: ${Object.keys(profile.modules || {}).length}</p><ul>${modules || '<li>No module overrides</li>'}</ul>`;
    }
    async function load(path = pathSelect.value) {
      if (busy) return;
      if (textarea.value !== loadedText && !globalThis.confirm('Discard the unsaved profile edits?')) {
        if (loadedPath) pathSelect.value = loadedPath;
        return;
      }
      busy = true;
      setStatus('Loading…');
      report.hidden = true;
      try {
        const file = await ctx.api(`files/read?path=${encodeURIComponent(path)}`);
        textarea.value = file.text;
        loadedText = file.text;
        baseHash = file.hash;
        loadedPath = path;
        pathSelect.value = path;
        validated = null;
        setStatus(`Loaded ${path}`);
        renderModules();
        resolveSoon();
      } catch (error) {
        setStatus(error.message, 'error');
      } finally { busy = false; }
    }
    async function validate() {
      if (busy) return null;
      busy = true;
      setStatus('Resolving profile…');
      report.hidden = true;
      try {
        const author = parseDraft();
        if (!isResolved(pathSelect.value)) {
          validated = { bundle: true };
          report.innerHTML = '<strong>Valid JSON</strong><p>Bundles are checked for JSON syntax here; the profile resolver validates them when the game profile is built.</p>';
          report.hidden = false;
          setStatus('Valid JSON (bundle).', 'success');
          return validated;
        }
        const result = await ctx.api('game-profile/validate', { author });
        validated = result;
        resolvedModules = result.modules || resolvedModules;
        refreshStates();
        report.innerHTML = reportHtml(result);
        report.hidden = false;
        setStatus(`Valid · ${result.id} · ${result.hash}`, 'success');
        return result;
      } catch (error) {
        validated = null;
        const problems = error.body?.problems || [];
        report.innerHTML = problems.length
          ? `<strong>Profile needs changes</strong><ul>${problems.map((p) => `<li><code>${esc(p.path || 'profile')}</code> ${esc(p.message)}</li>`).join('')}</ul>`
          : `<strong>Profile needs changes</strong><p>${esc(error.message)}</p>`;
        report.hidden = false;
        setStatus('Validation failed; no files were changed.', 'error');
        return null;
      } finally { busy = false; }
    }
    async function save() {
      const profile = await validate();
      if (!profile || busy) return;
      busy = true;
      setStatus('Saving and rebuilding profile catalog…');
      const sentAt = Date.now();
      try {
        const path = pathSelect.value;
        if (loadedPath !== path || baseHash === null) {
          const current = await ctx.api(`files/read?path=${encodeURIComponent(path)}`);
          baseHash = current.hash;
          loadedPath = path;
        }
        const result = await ctx.api('files/save', { changes: [{ path, text: textarea.value, baseHash }] });
        baseHash = result.files[0]?.hash || baseHash;
        loadedPath = path;
        loadedText = textarea.value;
        setStatus(`Saved ${path}; rebuilding generated profile data…`, 'success');
        ctx.preview.reloadAfterBuild([path], sentAt);
      } catch (error) {
        const problems = error.body?.problems || [];
        setStatus(problems.length ? `Not saved: ${problems.map((p) => p.message).join(' · ')}` : `Not saved: ${error.message}`, 'error');
      } finally { busy = false; }
    }
    function download() {
      const blob = new Blob([textarea.value.endsWith('\n') ? textarea.value : `${textarea.value}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pathSelect.value.split('/').at(-1) || 'game-profile.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    async function importFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('JSON root must be an object.');
        textarea.value = `${JSON.stringify(parsed, null, 2)}\n`;
        validated = null;
        report.hidden = true;
        setStatus(`Imported ${file.name}; validate before saving or previewing.`);
        renderModules();
        resolveSoon();
      } catch (error) { setStatus(`Import failed: ${error.message}`, 'error'); }
      finally { $('.gc input[type=file]').value = ''; }
    }
    function preview(value) {
      ctx.preview.setOverride('gameProfile', value);
      ctx.preview.reload();
      ctx.toast({ kind: 'info', title: `Previewing ${value === 'core' ? 'product core' : value === 'current' ? 'current game' : 'authored JSON'}`, detail: 'A new run uses this profile; existing saves keep their locked profile.', record: false });
    }

    el.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.dataset.profile) {
        const profile = button.dataset.profile;
        await load(profile === 'core' ? CORE_PATH : CURRENT_PATH);
      } else if (button.dataset.preview) {
        const key = button.dataset.preview;
        if (key === 'draft') {
          if (!isResolved(pathSelect.value)) { setStatus('A bundle is not a game profile; pick game.json or a preset to preview.', 'error'); return; }
          const ok = await validate();
          if (ok) preview(JSON.stringify(parseDraft()));
        } else preview(key);
      } else if (button.dataset.action === 'load') await load();
      else if (button.dataset.action === 'validate') await validate();
      else if (button.dataset.action === 'save') await save();
      else if (button.dataset.action === 'format') {
        try { textarea.value = `${JSON.stringify(parseDraft(), null, 2)}\n`; setStatus('Formatted JSON; validate before saving.'); renderModules(); }
        catch (error) { setStatus(error.message, 'error'); }
      } else if (button.dataset.action === 'export') download();
      else if (button.dataset.action === 'import') $('.gc input[type=file]').click();
    });
    pathSelect.addEventListener('change', () => load(pathSelect.value));
    $('.gc input[type=file]').addEventListener('change', (event) => importFile(event.target.files?.[0]));
    textarea.addEventListener('input', () => { validated = null; report.hidden = true; setStatus('Unsaved edits; validate before saving or previewing.'); clearTimeout(resolveTimer); resolveTimer = setTimeout(() => { renderModules(); resolveSoon(); }, 400); });
    loadModules();
    loadFileList().then(() => load(pathSelect.value || CORE_PATH));
    return { onShow() {} };
  },
};
