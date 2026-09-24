// src/ui/services/saveJsonFile.js — the browser save door for JSON exports.
//
// Moved out of src/model/advancedConfig.js: the model builds the bytes
// (advancedConfigExport stays pure there) and this adapter owns the browser —
// the Save As picker, then the download-anchor fallback. The model layer keeps
// no DOM or storage references (tools/update-architecture.mjs checks it).
import { advancedConfigExport } from '../../model/advancedConfig.js';

export async function saveAdvancedConfigFile(settings, options = {}) {
  return saveJsonFile(advancedConfigExport(settings, options.build || {}, options.includeKeys || []), options);
}

/**
 * saveJsonFile(text, options) → the Save As door, then the download fallback.
 *
 * Extracted from `saveAdvancedConfigFile` when the opening grew a file of its
 * own: two exports, one set of browser quirks. The caller decides what the
 * bytes are and what the file is called; this only decides how it leaves.
 */
export async function saveJsonFile(text, options = {}) {
  const win = options.window || globalThis.window;
  const doc = options.document || globalThis.document;
  const filename = options.filename || 'ashen-spire-game-config.json';
  if (win && typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: options.description || 'Ashen Spire game configuration', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { ok: true, method: 'save-as', filename };
    } catch (error) {
      if (error?.name !== 'AbortError') console.warn('Game configuration Save As failed; using browser download.', error);
    }
  }
  if (!doc || !win?.URL) return { ok: false, method: 'unavailable', filename };
  const blob = new Blob([text], { type: 'application/json' });
  const url = win.URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  return { ok: true, method: 'download', filename };
}
