// src/ui/offlineZipFlow.js — what Download & saves does with the folder copy
// (docs/EXTERNAL-ASSETS-PLAN.md §5 B, step 7), apart from drawing it: which box
// shows for a build feed, the words for each failure, and one save from click
// to final status. No DOM here, so tests/offline-zip.test.mjs drives it in CI;
// src/ui/components/offlinePlay.js binds it to its controls.
//
// THE LIVE LINE (review of #1480): the status line is aria-live, and a zip is
// about 5,500 files, so while it is built the line is rewritten at most once
// every `offlinePlay.zip.statusEveryMs`; the progress bar takes every step,
// and the final saved, sent or failed state is always announced.

import { offlinePlay } from '../content/offlinePlay.js';
import { assembleZip, coalesceSink, releasedZip, ZipDownloadError } from '../model/offlineDownload.js';
import { t } from './strings.js';

export const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/**
 * zipOffer(feed, branch) → { plan, show, steps }. `show` is 'zip' (a
 * pack-shaped build: the box and its instruction lines), 'none' (a
 * single-file build: one line saying its Download is the whole game) or
 * 'hidden' (a pack feed too malformed to offer; the single file still stands).
 */
export function zipOffer(raw, selected) {
  let plan = null;
  try { plan = releasedZip(raw, selected.manifestUrl, selected.id); } catch { plan = null; }
  if (!plan) return { plan: null, show: raw?.shape === 'pack' ? 'hidden' : 'none', steps: [] };
  const sized = plan.bytes !== null;
  const steps = offlinePlay.zip.instructions.map((id) => t(id === 'offline.zip.step.save' && !sized ? 'offline.zip.step.saveUnsized' : id,
    { mb: sized ? megabytes(plan.bytes) : '', filename: plan.filename }));
  return { plan, show: 'zip', steps };
}

/**
 * The words for a failed folder copy. A refusal of the zip's own (by code), a
 * cancel, a full disk and a refused save location each have a row; anything
 * else is the generic row, and its raw text goes to the console only.
 */
export function zipFailureText(error, log = (...args) => console.warn(...args)) {
  if (error?.name === 'AbortError') return t('offline.zip.canceled');
  if (error instanceof ZipDownloadError) return t(`offline.zip.error.${error.code}`);
  log('Folder copy (zip) failed:', error);
  if (error?.name === 'QuotaExceededError') return t('offline.zip.error.disk');
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return t('offline.zip.error.picker');
  return t('offline.zip.error.generic');
}

const defaultPicker = () => (typeof globalThis.window?.showSaveFilePicker === 'function' ? (options) => globalThis.window.showSaveFilePicker(options) : null);

/**
 * createZipFlow({ saveBlob, onStatus, onProgress, onPrepared, signal, … }) →
 * { offer(feed, branch), reset(), run(), plan, prepared }. run() returns
 * 'none', 'saved' (through the save picker), 'sent' (a Blob handed to the
 * browser; the button becomes Save zip file), 'resaved' (that Blob again,
 * nothing rebuilt) or 'failed'. offer() and reset() forget a prepared Blob, so
 * a branch change never re-saves another build's zip.
 */
export function createZipFlow({ saveBlob, onStatus, onProgress = () => {}, onPrepared = () => {}, signal, assemble = assembleZip,
  picker = defaultPicker, now = () => Date.now(), statusEveryMs = offlinePlay.zip.statusEveryMs, log } = {}) {
  let plan = null, prepared = null;
  return {
    get plan() { return plan; },
    get prepared() { return prepared; },
    offer(raw, selected) { const view = zipOffer(raw, selected); plan = view.plan; prepared = null; return view; },
    reset() { plan = null; prepared = null; },
    async run() {
      if (!plan) return 'none';
      const p = plan;
      if (prepared) {
        saveBlob(prepared, p.filename);
        onStatus(t('offline.zip.sent', { mb: megabytes(prepared.size) }));
        return 'resaved';
      }
      let writer = null;
      const chunks = [];
      try {
        const pick = picker();
        if (pick) {
          onStatus(t('offline.zip.choose'));
          const handle = await pick({ suggestedName: p.filename, types: [{ description: t('offline.zip.heading'), accept: { 'application/zip': ['.zip'] } }] });
          signal?.throwIfAborted();
          writer = await handle.createWritable();
        }
        signal?.throwIfAborted();
        const out = writer ? coalesceSink((chunk) => writer.write(chunk)) : { sink: (chunk) => { chunks.push(chunk); }, flush: async () => {} };
        let last = -Infinity;
        const result = await assemble(p, { sink: out.sink, signal, onProgress: (done, total, bytes, totalBytes) => {
          onProgress(total ? Math.floor(done / total * 100) : 0);
          if (now() - last < statusEveryMs) return;
          last = now();
          onStatus(t('offline.zip.working', { done, total, mb: megabytes(bytes), totalMb: megabytes(totalBytes) }));
        } });
        await out.flush();
        signal?.throwIfAborted();
        onProgress(100);
        if (writer) {
          onStatus(t('offline.zip.finishing'));
          await writer.close(); writer = null;
          onStatus(t('offline.zip.saved', { files: result.count, mb: megabytes(result.bytes) }));
          return 'saved';
        }
        prepared = new Blob(chunks, { type: 'application/zip' });
        chunks.length = 0;
        saveBlob(prepared, p.filename);
        onPrepared();
        onStatus(t('offline.zip.sent', { mb: megabytes(result.bytes) }));
        return 'sent';
      } catch (error) {
        if (writer) await writer.abort().catch(() => {});
        onStatus(zipFailureText(error, log));
        return 'failed';
      }
    },
  };
}
