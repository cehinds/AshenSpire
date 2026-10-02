import { offlinePlay } from '../../content/offlinePlay.js';
import { BUILD_VERSION } from '../../buildversion.js';
import { releasedDownload, receiveDownload } from '../../model/offlineDownload.js';
import { createZipFlow } from '../offlineZipFlow.js';
import { t } from '../strings.js';
import { makeAvailableOffline, offlineState, offlineSupport, removeOfflineCopy } from '../offlineInstall.js';
import { button, el, openModal } from '../kit/index.js';
import { openConfirmationModal } from './confirmationModal.js';

function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), offlinePlay.revokeDelayMs);
}

const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

// "MAKE AVAILABLE OFFLINE" (docs/EXTERNAL-ASSETS-PLAN.md §5 A, step 6b). Only a
// pack-shaped build says anything here: a single file already plays offline
// by itself. On the hosted site the buttons keep or remove this build in the
// browser through the site's service worker (src/ui/offlineInstall.js);
// anywhere else one line says why it cannot.
function keepOffline(signal) {
  const words = offlinePlay.keep;
  const support = offlineSupport();
  if (!support.ok && support.reason === 'single') return null;
  const heading = el('h3', { text: words.heading });
  if (!support.ok) return el('div', { class: 'offline-keep' }, [heading, el('p', { class: 'set-note', text: words.unavailable[support.reason] || words.unavailable.unsupported })]);
  const status = el('p', { role: 'status', 'aria-live': 'polite', class: 'set-note', id: 'offline-keep-status' });
  const progress = el('progress', { id: 'offline-keep-progress', max: 100, hidden: true, 'aria-label': words.button });
  const keepButton = button({ label: words.button, id: 'offline-keep' });
  const removeButton = button({ label: words.remove, id: 'offline-keep-remove' }); removeButton.hidden = true;
  const high = el('input', { type: 'checkbox', id: 'offline-keep-high' });
  const highRow = support.high ? [el('label', { for: 'offline-keep-high', class: 'set-note' }, [high, ` ${words.includeHigh}`])] : [];
  const kept = () => { keepButton.textContent = words.again; removeButton.hidden = false; };
  // "Kept" is this build's own copy, not the site-wide worker (Codex, #1456):
  // another build kept offline registers the same worker.
  void offlineState().then((state) => {
    if (state.kept) { kept(); if (!status.textContent) status.textContent = words.kept; }
  });
  keepButton.addEventListener('click', async () => {
    keepButton.disabled = true; removeButton.disabled = true; progress.hidden = false; progress.removeAttribute('value');
    try {
      const result = await makeAvailableOffline({ includeHigh: support.high && high.checked, signal,
        onProgress: (done, total) => {
          progress.value = total ? Math.floor(done / total * 100) : 100;
          status.textContent = fill(words.working, { done, total });
        } });
      if (result.kept) kept();
      progress.value = 100;
      status.textContent = fill(result.failed ? words.partial : words.done, { done: result.objects - result.failed, total: result.objects, failed: result.failed })
        + (result.persisted ? '' : ` ${words.notPersisted}`);
    } catch (error) {
      if (error?.name !== 'AbortError') status.textContent = error.message;
    } finally { keepButton.disabled = false; removeButton.disabled = false; }
  });
  removeButton.addEventListener('click', async () => {
    keepButton.disabled = true; removeButton.disabled = true;
    try {
      const result = await removeOfflineCopy();
      keepButton.textContent = words.button; removeButton.hidden = true; progress.hidden = true;
      status.textContent = result.scope === 'all' ? words.removed : fill(words.removedBuild, { others: result.others });
    } catch (error) { status.textContent = error.message; }
    finally { keepButton.disabled = false; removeButton.disabled = false; }
  });
  return el('div', { class: 'offline-keep' }, [heading, el('p', { class: 'set-note', text: words.note }), ...highRow,
    el('div', { class: 'offline-actions' }, [keepButton, removeButton]), progress, status]);
}

export function openOfflinePlay({ transfer, assertImportAllowed = () => {}, onImported = () => location.reload() }) {
  const status = el('p', { role: 'status', 'aria-live': 'polite', class: 'set-note' });
  const release = el('p', { class: 'set-note', text: 'Checking for the selected build…' });
  const branch = el('select', { id: 'offline-branch' }, offlinePlay.branches.map(item => el('option', { value: item.id, text: item.label })));
  branch.value = offlinePlay.releaseBranch;
  const progress = el('progress', { id: 'offline-progress', max: 100, 'aria-label': 'Game download progress' });
  const progressText = el('p', { class: 'set-note', text: '' });
  const progressGroup = el('div', { hidden: true }, [progress, progressText]);
  const download = button({ label: offlinePlay.downloadLabel, id: 'offline-download' });
  download.disabled = true;
  // THE PLAIN LINK, AND WHY IT SITS NEXT TO THE BUTTON.
  //
  // The button above fetches the build, keeps it in a Blob and clicks a
  // synthetic anchor. That is what gives progress and a save-location dialog on
  // a desktop — and it is exactly what fails on a phone: a multi-megabyte Blob
  // in a memory-tight tab, and a save that has to happen inside a user-
  // activation window the network wait already spent. This anchor points
  // straight at the same static file on the published site, so the browser
  // downloads it itself with no script running and nothing buffered in the
  // page. It is hidden until a manifest names a real file — a download link
  // that goes nowhere is worse than none.
  //
  // WHICH TARGET, AND WHY IT DEPENDS ON WHERE THIS COPY IS RUNNING. `download`
  // is honoured only for a SAME-ORIGIN target: a browser ignores it on a
  // cross-origin http(s) link unless the response carries an attachment
  // disposition, and the published build is served inline on purpose so the
  // same URL can also be played. So a downloaded copy (`file:`) or a locally
  // hosted one would have followed this link INTO the hosted game instead of
  // saving it — the exact offline case the label advertises. Same-origin, the
  // link saves the file; otherwise it goes to that branch's page on the
  // published site, where the artifact link IS same-origin, and says so.
  const direct = el('a', { class: 'set-note offline-direct', id: 'offline-direct', hidden: true,
    text: offlinePlay.directLabel });
  // THE FOLDER COPY (docs/EXTERNAL-ASSETS-PLAN.md §5 B, step 7): a zip the game
  // assembles from the selected build's page, light and common packs and their
  // objects. Drawn only when that build is pack-shaped: an older build is one
  // whole file, and this says so in one line instead of offering a zip of it.
  const zipButton = button({ label: t('offline.zip.button'), id: 'offline-zip' });
  zipButton.disabled = true;
  const zipSteps = el('ul', { class: 'offline-zip-steps' });
  const zipProgress = el('progress', { id: 'offline-zip-progress', max: 100, hidden: true, 'aria-label': t('offline.zip.heading') });
  // Polite, but not role=status: the screen's own status line (the saves) stays the first one in the panel.
  const zipStatus = el('p', { 'aria-live': 'polite', class: 'set-note', id: 'offline-zip-status' });
  const zipNone = el('p', { class: 'set-note', id: 'offline-zip-none', hidden: true, text: t('offline.zip.unavailable') });
  const zipBox = el('div', { class: 'offline-zip', id: 'offline-zip-box', hidden: true }, [el('h3', { text: t('offline.zip.heading') }), zipSteps,
    el('div', { class: 'offline-actions' }, [zipButton]), zipProgress, zipStatus]);
  const check = button({ label: 'Check for updates', id: 'offline-check' });
  const exportSave = button({ label: 'Export saves', id: 'offline-export' });
  const importSave = button({ label: 'Import saves', id: 'offline-import' });
  const recovery = button({ label: 'Export previous-save backup', id: 'offline-recovery' });
  const reload = button({ label: 'Reload game', id: 'offline-reload' }); reload.hidden = true;
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const done = button({ label: 'Done', weight: 'primary' });
  let manifest = null, prepared = null, busy = false;
  const controller = new AbortController();
  const request = async url => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(offlinePlay.requestTimeoutMs)]) });
    if (!response.ok) throw new Error('This branch download is unavailable. Try another branch or check again when online.');
    return response;
  };
  const keep = keepOffline(controller.signal);
  // The folder copy's logic (which box, the words, one save) is src/ui/offlineZipFlow.js.
  const zip = createZipFlow({ signal: controller.signal, saveBlob: saveFile,
    onStatus: (text) => { zipStatus.textContent = text; },
    onProgress: (percent) => { zipProgress.value = percent; },
    onPrepared: () => { zipButton.textContent = t('offline.zip.save'); } });
  const door = openModal({ title: offlinePlay.title, size: 'md', className: 'offline-play-modal',
    onClose: () => { controller.abort(); prepared = null; }, body: host => {
      host.append(el('p', { text: `Your game: ${BUILD_VERSION}` }),
        el('ul', {}, offlinePlay.instructions.map(text => el('li', { text }))),
        el('label', { for: 'offline-branch', text: 'Build branch' }), branch, release,
        el('div', { class: 'offline-actions' }, [check, download]), progressGroup, direct,
        el('p', { class: 'set-note', text: typeof window.showSaveFilePicker === 'function'
          ? 'Download opens a save-location dialog, then saves the game there.'
          : 'Your browser controls the save location. Enable “Ask where to save” in its download settings to choose a folder.' }),
        zipBox, zipNone,
        ...(keep ? [keep] : []),
        el('h3', { text: 'Move your saves' }),
        el('p', { class: 'set-note', text: `A backup includes your profile and all ${transfer.slotCount} save slots. Import replaces them in this browser. Existing archives stay here. Import from the title screen.` }),
        el('div', { class: 'offline-actions' }, [exportSave, importSave, recovery, reload]), file, status);
    }, primary: done });
  done.addEventListener('click', door.close);
  recovery.hidden = !transfer.previous();
  const showRelease = data => {
    const size = data.bytes === null ? 'Size available after preparation' : `${(data.bytes / 1024 / 1024).toFixed(1)} MB`;
    release.textContent = `${offlinePlay.branches.find(item => item.id === branch.value).label} build: ${data.version} · ${size}. ${data.version === BUILD_VERSION ? 'You have this version.' : 'Export your saves before switching versions.'}`;
  };
  const refreshRelease = async () => {
    if (busy) return; busy = true; check.disabled = true; download.disabled = true; branch.disabled = true; zipButton.disabled = true;
    zip.reset(); zipBox.hidden = true; zipNone.hidden = true; zipProgress.hidden = true; zipStatus.textContent = '';
    zipButton.textContent = t('offline.zip.button');
    manifest = null; progressGroup.hidden = true; direct.hidden = true; direct.removeAttribute('href');
    direct.removeAttribute('download'); direct.removeAttribute('target'); direct.removeAttribute('rel');
    prepared = null; download.textContent = offlinePlay.downloadLabel;
    try {
      const selected = offlinePlay.branches.find(item => item.id === branch.value);
      const raw = await (await request(selected.manifestUrl)).json();
      const data = releasedDownload(raw, selected.manifestUrl, selected.id);
      manifest = data;
      showZip(raw, selected);
      const sameOrigin = new URL(data.url, location.href).origin === location.origin;
      if (sameOrigin) { direct.href = data.url; direct.download = data.filename; direct.textContent = offlinePlay.directLabel; }
      else {
        direct.href = new URL('../', selected.manifestUrl).href;
        direct.target = '_blank'; direct.rel = 'noopener';
        direct.textContent = offlinePlay.directPageLabel;
      }
      direct.hidden = false;
      showRelease(data);
      download.disabled = false; status.textContent = '';
    } catch (error) { release.textContent = 'Could not check the release. Connect to the internet and try Check for updates.'; status.textContent = error.message; }
    finally { busy = false; check.disabled = false; branch.disabled = false; zipButton.disabled = !zip.plan; }
  };
  // The zip is offered for a pack-shaped build only; a build.json that names
  // one badly hides it (and the single-file download above still stands).
  function showZip(raw, selected) {
    const view = zip.offer(raw, selected);
    zipNone.hidden = view.show !== 'none';
    if (view.show !== 'zip') return;
    zipSteps.replaceChildren(...view.steps.map(text => el('li', { text })));
    zipBox.hidden = false;
  }
  zipButton.addEventListener('click', async () => {
    if (busy || !zip.plan) return;
    busy = true; zipButton.disabled = true; download.disabled = true; check.disabled = true; branch.disabled = true;
    try {
      if (!zip.prepared) { zipProgress.hidden = false; zipProgress.removeAttribute('value'); }
      if (await zip.run() === 'failed') zipProgress.hidden = true;
    } finally { busy = false; zipButton.disabled = !zip.plan; download.disabled = !manifest; check.disabled = false; branch.disabled = false; }
  });
  check.addEventListener('click', refreshRelease);
  branch.addEventListener('change', refreshRelease);
  download.addEventListener('click', async () => {
    if (busy || !manifest) return;
    if (prepared) {
      // Saving stays within a fresh click, even when fetching a large build
      // took longer than the browser's transient user-activation window.
      saveFile(prepared, manifest.filename);
      status.textContent = 'Save requested. Open the HTML file from your Downloads folder.';
      return;
    }
    busy = true; download.disabled = true; check.disabled = true; branch.disabled = true; zipButton.disabled = true;
    progressGroup.hidden = true;
    let writer = null;
    try {
      // Ask during the click's activation window, before waiting for any network I/O.
      if (typeof window.showSaveFilePicker === 'function') {
        status.textContent = 'Choose where to save the game…';
        const handle = await window.showSaveFilePicker({ suggestedName: manifest.filename,
          types: [{ description: 'HTML game', accept: { 'text/html': ['.html'] } }] });
        controller.signal.throwIfAborted();
        writer = await handle.createWritable();
      }
      controller.signal.throwIfAborted();
      status.textContent = 'Downloading the game… keep this panel open.';
      progressGroup.hidden = false; progress.removeAttribute('value'); progressText.textContent = 'Connecting…';
      const result = await receiveDownload(await request(manifest.url), { bytes: manifest.bytes, sha256: manifest.sha256, writer,
        onProgress: (received, total) => {
          controller.signal.throwIfAborted();
          const amount = (received / 1024 / 1024).toFixed(1);
          if (total !== null) {
            progress.value = Math.min(100, received / total * 100);
            progressText.textContent = `${Math.floor(progress.value)}% · ${amount} / ${(total / 1024 / 1024).toFixed(1)} MB`;
          } else { progress.removeAttribute('value'); progressText.textContent = `${amount} MB downloaded · total size unknown`; }
        } });
      controller.signal.throwIfAborted();
      if (writer) { status.textContent = 'Finishing file save…'; await writer.close(); writer = null; }
      else { prepared = result.blob; saveFile(prepared, manifest.filename); download.textContent = offlinePlay.saveDownloadLabel; }
      manifest.bytes = result.bytes; showRelease(manifest); progress.value = 100;
      progressText.textContent = `100% · ${(result.bytes / 1024 / 1024).toFixed(1)} MB downloaded`;
      status.textContent = prepared ? 'Download sent to your browser. If it did not save, choose Save game file to retry.' : 'Game saved to your chosen location. Open the HTML file to play.';
    } catch (error) {
      if (writer) await writer.abort().catch(() => {});
      status.textContent = error.name === 'AbortError' ? 'Download canceled. No completed game file was saved.' : error.message;
    }
    finally { busy = false; download.disabled = false; check.disabled = false; branch.disabled = false; zipButton.disabled = !zip.plan; }
  });
  const exportText = (text, name) => saveFile(new Blob([text], { type: 'application/json' }), name);
  exportSave.addEventListener('click', () => { try { exportText(transfer.createBackup(), 'AshenSpire-saves.json'); status.textContent = 'Save backup downloaded.'; } catch (error) { status.textContent = error.message; } });
  recovery.addEventListener('click', () => { try { exportText(transfer.previous(), 'AshenSpire-previous-saves.json'); } catch (error) { status.textContent = error.message; } });
  importSave.addEventListener('click', () => {
    try { assertImportAllowed(); file.value = ''; file.click(); }
    catch (error) { status.textContent = error.message; }
  });
  file.addEventListener('change', async () => {
    const selected = file.files?.[0]; if (!selected) return;
    try {
      if (selected.size > offlinePlay.maxSaveBytes) throw new Error('Save file is too large.');
      const text = await selected.text(); const preview = transfer.inspect(text);
      const count = preview.slots.filter(slot => slot.summary).length;
      openConfirmationModal({ title: 'Replace this browser’s saves?',
        message: `This backup contains ${count} saved run${count === 1 ? '' : 's'}${preview.hasProfile ? ' and a profile' : ' and no profile'}.`,
        consequence: `All ${preview.slots.length} slots and the profile will be replaced. A previous-save backup is kept first. The game reloads after import.`,
        confirmLabel: 'Import saves', onConfirm: () => {
          try {
            assertImportAllowed();
            transfer.restore(text); status.textContent = 'Saves imported. Reload the game to use them.';
            reload.hidden = false; importSave.disabled = true; reload.focus();
            onImported();
          } catch (error) { status.textContent = error.message; }
          recovery.hidden = !transfer.previous();
        } });
    } catch (error) { status.textContent = error.message; }
  });
  reload.addEventListener('click', onImported);
  void refreshRelease();
}
