import { offlinePlay } from '../../content/offlinePlay.js';
import { BUILD_VERSION } from '../../buildversion.js';
import { releasedDownload, receiveDownload } from '../../model/offlineDownload.js';
import { button, el, openModal } from '../kit/index.js';
import { openConfirmationModal } from './confirmationModal.js';

function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), offlinePlay.revokeDelayMs);
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
  const door = openModal({ title: offlinePlay.title, size: 'md', className: 'offline-play-modal',
    onClose: () => { controller.abort(); prepared = null; }, body: host => {
      host.append(el('p', { text: `Your game: ${BUILD_VERSION}` }),
        el('ul', {}, offlinePlay.instructions.map(text => el('li', { text }))),
        el('label', { for: 'offline-branch', text: 'Build branch' }), branch, release,
        el('div', { class: 'offline-actions' }, [check, download]), progressGroup, direct,
        el('p', { class: 'set-note', text: typeof window.showSaveFilePicker === 'function'
          ? 'Download opens a save-location dialog, then saves the game there.'
          : 'Your browser controls the save location. Enable “Ask where to save” in its download settings to choose a folder.' }),
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
    if (busy) return; busy = true; check.disabled = true; download.disabled = true; branch.disabled = true;
    manifest = null; progressGroup.hidden = true; direct.hidden = true; direct.removeAttribute('href');
    direct.removeAttribute('download'); direct.removeAttribute('target'); direct.removeAttribute('rel');
    prepared = null; download.textContent = offlinePlay.downloadLabel;
    try {
      const selected = offlinePlay.branches.find(item => item.id === branch.value);
      const data = releasedDownload(await (await request(selected.manifestUrl)).json(), selected.manifestUrl, selected.id);
      manifest = data;
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
    finally { busy = false; check.disabled = false; branch.disabled = false; }
  };
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
    busy = true; download.disabled = true; check.disabled = true; branch.disabled = true;
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
      const result = await receiveDownload(await request(manifest.url), { bytes: manifest.bytes, writer,
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
    finally { busy = false; download.disabled = false; check.disabled = false; branch.disabled = false; }
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
