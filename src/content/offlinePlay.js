export const offlinePlay = {
  title: 'Download & saves',
  manifestUrl: 'https://cehinds.github.io/AshenSpire/main/latest/build.json',
  releaseBranch: 'main',
  branches: [
    { id: 'release', label: 'Release', manifestUrl: 'https://cehinds.github.io/AshenSpire/release/latest/build.json' },
    { id: 'test', label: 'Test', manifestUrl: 'https://cehinds.github.io/AshenSpire/test/latest/build.json' },
    { id: 'dev', label: 'Dev', manifestUrl: 'https://cehinds.github.io/AshenSpire/dev/latest/build.json' },
    { id: 'main', label: 'Main', manifestUrl: 'https://cehinds.github.io/AshenSpire/main/latest/build.json' },
  ],
  downloadLabel: 'Download game',
  saveDownloadLabel: 'Save game file',
  directLabel: 'Direct download link (use this on phones and tablets)',
  directPageLabel: 'Open this branch’s download page (use this on phones and tablets)',
  instructions: [
    'Download the HTML file on your computer, then double-click it to play in your browser.',
    'Solo play works without internet. Offline maps use simpler artwork; online multiplayer needs a connection.',
    'Keep the game in the same folder and browser. Export your saves before moving it or downloading an update.',
    'On a phone or tablet, use the link below the button — it saves the file through the browser instead of holding it in the page. From a downloaded copy it opens the build page on the site, where the download saves.',
    'Online and downloaded copies keep separate saves. Use Export and Import to move your progress. Phone file-opening support varies.',
  ],
  // "Make available offline" (docs/EXTERNAL-ASSETS-PLAN.md §5 A, step 6b):
  // shown on the hosted web edition only. `{done}`, `{total}`, `{failed}` and
  // `{mb}` are filled by the component.
  keep: {
    heading: 'Play offline in this browser',
    note: 'Keeps this build and its art in this browser, so it opens at this same address without internet. Saves are the site’s own, online or offline. Detailed map tiles and recorded music still need a connection; offline the map uses simpler artwork and the music is synthesized.',
    button: 'Make available offline',
    again: 'Update offline copy',
    remove: 'Remove this build’s offline copy',
    includeHigh: 'Include high-resolution art (much larger)',
    working: 'Keeping the game for offline play… {done} of {total} files',
    done: 'Ready offline: {total} files kept. Open this page again without internet to play.',
    partial: 'Fetched {done} of {total} files; {failed} could not be fetched, so this build is not kept offline yet. Check your connection and choose Make available offline again.',
    notPersisted: 'Your browser may clear this copy if it runs low on space or the site goes unused for a long time; keep a downloaded file as well if you rely on it.',
    removed: 'Offline copy removed. No build is kept offline in this browser now.',
    removedBuild: 'This build’s offline copy is removed. {others} other kept build(s) stay, with the art they share.',
    kept: 'This build is kept for offline play in this browser.',
    unavailable: {
      protocol: 'Offline play in the browser is available on the hosted site; a downloaded file already plays offline.',
      unsupported: 'This browser cannot keep the game offline. Use the download above instead.',
      art: 'The game’s art did not load, so it cannot be kept offline. Reload the page and try again.',
      loading: 'The game’s art is still loading. Close this panel and open it again in a moment to keep the game offline.',
    },
  },
  // THE FOLDER COPY (docs/EXTERNAL-ASSETS-PLAN.md §5 B, step 7): a zip the
  // game assembles from a pack-shaped build's page, its light and common packs
  // and their objects (src/model/offlineDownload.js assembleZip). Offered only
  // when the selected branch's build is pack-shaped; an older build's
  // Download is already one whole file. The words are uiStrings rows
  // (content/source/uiStrings.csv, `offline.zip.*`); `instructions` names the
  // rows shown, in order, under the zip's heading.
  zip: {
    packs: ['light', 'common'],
    concurrency: 6,
    // Each request waits this long for its headers, then fails if no body
    // chunk arrives for idleTimeoutMs (an idle deadline, so a slow but moving
    // connection still finishes the ~10 MB page); it is tried twice.
    headerTimeoutMs: 60000,
    idleTimeoutMs: 30000,
    // The polite status line is rewritten at most this often while the zip is
    // built (about 5,500 files), and always for the final state.
    statusEveryMs: 2000,
    instructions: ['offline.zip.step.save', 'offline.zip.step.unzip', 'offline.zip.step.open', 'offline.zip.step.limits'],
  },
  saveFormat: 'ashenspire-save-transfer',
  saveVersion: 1,
  maxSaveBytes: 20 * 1024 * 1024,
  requestTimeoutMs: 120000,
  revokeDelayMs: 60000,
};
