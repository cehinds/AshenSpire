// Game Configuration: edit the two supported Ashen author profiles and validate
// each draft with the same resolver used by the game-config build.
const CORE_PATH = 'games/ashenspire/game.json';
const CURRENT_PATH = 'games/ashenspire/presets/current.json';
const DEFAULT_PROFILE = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: {} };
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
    let validated = null;
    let busy = false;

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
      busy = true;
      setStatus('Loading…');
      report.hidden = true;
      try {
        const file = await ctx.api(`files/read?path=${encodeURIComponent(path)}`);
        textarea.value = file.text;
        baseHash = file.hash;
        loadedPath = path;
        pathSelect.value = path;
        validated = null;
        setStatus(`Loaded ${path}`);
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
        const result = await ctx.api('game-profile/validate', { author });
        validated = result;
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
      } catch (error) { setStatus(`Import failed: ${error.message}`, 'error'); }
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
          const ok = await validate();
          if (ok) preview(JSON.stringify(parseDraft()));
        } else preview(key);
      } else if (button.dataset.action === 'load') await load();
      else if (button.dataset.action === 'validate') await validate();
      else if (button.dataset.action === 'save') await save();
      else if (button.dataset.action === 'format') {
        try { textarea.value = `${JSON.stringify(parseDraft(), null, 2)}\n`; setStatus('Formatted JSON; validate before saving.'); }
        catch (error) { setStatus(error.message, 'error'); }
      } else if (button.dataset.action === 'export') download();
      else if (button.dataset.action === 'import') $('.gc input[type=file]').click();
    });
    pathSelect.addEventListener('change', () => load(pathSelect.value));
    $('.gc input[type=file]').addEventListener('change', (event) => importFile(event.target.files?.[0]));
    textarea.addEventListener('input', () => { validated = null; report.hidden = true; setStatus('Unsaved edits; validate before saving or previewing.'); });
    load();
    return { onShow() {} };
  },
};
