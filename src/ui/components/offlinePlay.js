import { offlinePlay } from '../../content/offlinePlay.js';
import { BUILD_VERSION } from '../../buildversion.js';
import { releasedDownload } from '../../model/offlineDownload.js';
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
  const release = el('p', { class: 'set-note', text: 'Check for a released download when you have internet.' });
  const download = button({ label: offlinePlay.downloadLabel, id: 'offline-download' });
  download.disabled = true;
  const check = button({ label: 'Check for updates', id: 'offline-check' });
  const exportSave = button({ label: 'Export saves', id: 'offline-export' });
  const importSave = button({ label: 'Import saves', id: 'offline-import' });
  const recovery = button({ label: 'Export previous-save backup', id: 'offline-recovery' });
  const reload = button({ label: 'Reload game', id: 'offline-reload' }); reload.hidden = true;
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const done = button({ label: 'Done', weight: 'primary' });
  let manifest = null, busy = false;
  const controller = new AbortController();
  const request = async url => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(offlinePlay.requestTimeoutMs)]) });
    if (!response.ok) throw new Error('The released download is unavailable. Try again when online.');
    return response;
  };
  const door = openModal({ title: offlinePlay.title, size: 'md', className: 'offline-play-modal',
    onClose: () => controller.abort(), body: host => {
      host.append(el('p', { text: `Your game: ${BUILD_VERSION}` }),
        el('ul', {}, offlinePlay.instructions.map(text => el('li', { text }))), release,
        el('div', { class: 'offline-actions' }, [check, download]),
        el('h3', { text: 'Move your saves' }),
        el('p', { class: 'set-note', text: `A backup includes your profile and all ${transfer.slotCount} save slots. Import replaces them in this browser. Existing archives stay here. Import from the title screen.` }),
        el('div', { class: 'offline-actions' }, [exportSave, importSave, recovery, reload]), file, status);
    }, primary: done });
  done.addEventListener('click', door.close);
  recovery.hidden = !transfer.previous();
  check.addEventListener('click', async () => {
    if (busy) return; busy = true; check.disabled = true; download.disabled = true;
    try {
      const data = releasedDownload(await (await request(offlinePlay.manifestUrl)).json());
      manifest = data;
      release.textContent = `Released game: ${data.version} · ${(data.bytes / 1024 / 1024).toFixed(1)} MB. ${data.version === BUILD_VERSION ? 'You have this version.' : 'Export your saves before switching versions.'}`;
      download.disabled = false; status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; check.disabled = false; }
  });
  download.addEventListener('click', async () => {
    if (busy || !manifest) return; busy = true; download.disabled = true;
    status.textContent = 'Downloading the game… keep this panel open.';
    try {
      // Pin the numbered build so a release changing mid-download cannot mix versions.
      const bytes = await (await request(manifest.url)).arrayBuffer();
      if (bytes.byteLength !== manifest.bytes) throw new Error('Download was incomplete. Please try again.');
      saveFile(new Blob([bytes], { type: 'text/html' }), manifest.filename);
      status.textContent = 'Download ready. Open the HTML file from your Downloads folder.';
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; download.disabled = false; }
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
}
