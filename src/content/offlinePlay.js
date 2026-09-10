export const offlinePlay = {
  title: 'Download & saves',
  manifestUrl: 'https://cehinds.github.io/AshenSpire/main/latest/build.json',
  releaseBranch: 'main',
  downloadLabel: 'Download released game',
  saveDownloadLabel: 'Save game file',
  instructions: [
    'Download the HTML file on your computer, then double-click it to play in your browser.',
    'Solo play works without internet. Offline maps use simpler artwork; online multiplayer needs a connection.',
    'Keep the game in the same folder and browser. Export your saves before moving it or downloading an update.',
    'Online and downloaded copies keep separate saves. Use Export and Import to move your progress. Phone file-opening support varies.',
  ],
  saveFormat: 'ashenspire-save-transfer',
  saveVersion: 1,
  maxSaveBytes: 20 * 1024 * 1024,
  requestTimeoutMs: 120000,
  revokeDelayMs: 60000,
};
