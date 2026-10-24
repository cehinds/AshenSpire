// Mobile file sharing when supported, otherwise a browser download. No network.
export async function saveTextFile(text, { filename = 'ashen-spire-console.txt', navigator: nav = globalThis.navigator, window: win = globalThis.window, document: doc = globalThis.document, File: FileType = globalThis.File } = {}) {
  if (FileType && typeof nav?.canShare === 'function' && typeof nav.share === 'function') {
    try {
      const file = new FileType([text], filename, { type: 'text/plain' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'AshenSpire console log' });
        return { ok: true, method: 'share' };
      }
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, method: 'cancelled' };
      // A rejected share still has the download door below.
    }
  }
  let url, anchor;
  try {
    if (!win?.URL?.createObjectURL || !doc?.body) return { ok: false, method: 'unavailable' };
    url = win.URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    anchor = doc.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.hidden = true;
    doc.body.appendChild(anchor);
    anchor.click();
    return { ok: true, method: 'download' };
  } catch { return { ok: false, method: 'unavailable' }; }
  finally {
    anchor?.remove();
    // Let mobile browsers consume the URL before releasing it.
    if (url) win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
  }
}
