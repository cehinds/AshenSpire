const sourceSize = Object.freeze([1024, 1024]);
const sourceRoot = Object.freeze([520, 734]);
const evidenceDirectory = 'docs/planning/player-sprite-cleanup-2026-11-26/implementation/measurements/';
const sweepFamily = Object.freeze(
{
  id: 'reaver-sweep-sw09',
  sourceSize,
  sourceRoot,
  scale: 0.60,
  reference: 'assets-display/alternative/card-reaver-ready.webp',
  artRelease: 'ashenspire-hd-assets-v30',
  sourceBaseline: '49eca254d795d06266aa23941cb2b31fe77b27bf',
  sourcePackage: 'pose-studio/stances/update-stances/smash-sweep-examples/sweep/selected-sweep-sw09/SW09/',
  provenance: 'pose-studio/stances/update-stances/selected-sweep-sw09/production.json',
  evidence: evidenceDirectory + 'reaver-calibration-survey.json',
  confidence: 'manual anatomical comparison; approximately 10–15% uncertainty',
});

function calibratedFrame(headY, feetY, hashes)
{
  return Object.freeze(
  {
    family: sweepFamily,
    exportSha256: hashes.exportSha256,
    mobileExportSha256: hashes.mobileExportSha256,
    sourceSha256: hashes.sourceSha256,
    body: Object.freeze(
    {
      headY,
      feetY,
    }),
  });
}

// Source coordinates follow reviewed helmet crowns and supporting boot soles.
// The shared root comes from the selected family's existing logical anchor.
export const PlayerSpriteCalibrations = Object.freeze(
{
  'assets-display/alternative/reaver-greatsword-pilot-sweep.webp': calibratedFrame(406, 736,
  {
    exportSha256: '81d348d0382b9a99c1f72d5d23dab4975bbe648b3db979d8f725fc250d02db7c',
    mobileExportSha256: '20fd757bf9a39e06e6ba03bc265bc272d4eebd2734e1d24655000936a57bd601',
    sourceSha256: 'faf9d5f34285dc82b0b19426aafe6debe679bec33b2f45d095b0059c5b105ac1',
  }),
  'assets-display/alternative/reaver-greatsword-pilot-sweep-windup.webp': calibratedFrame(393, 732,
  {
    exportSha256: 'e42ea1976a0a162c78098cb7a13010cc1b855d5baf6f4fe0fe90e42cc9991f4d',
    mobileExportSha256: 'b6eeb8ecb140678365100c3f1d162c17e9852716b037283cbfb209e90f39de9c',
    sourceSha256: '259459c43d53d162dd6fe30132ebf6a1df00b3de62e8c3622b008dcaff875c7d',
  }),
  'assets-display/alternative/reaver-greatsword-pilot-sweep-contact.webp': calibratedFrame(405, 732,
  {
    exportSha256: '2f57d14e2f17a7366977829957514d0a97f64adf91cb24c26ede51a25e56bbb2',
    mobileExportSha256: '92efd91d23e37086a3d5d7c3e58b58b35dd48d10779dae34fd39696736abfe5f',
    sourceSha256: 'cc7af9a81181afce091957b100cf91f699f2e89fae8de4ba092224d20e768521',
  }),
  'assets-display/alternative/reaver-greatsword-pilot-sweep-finish.webp': calibratedFrame(493, 733,
  {
    exportSha256: '96a520910a6962ade28c268da0cc34fed5c747b309b6a60580a32ebdd58c429b',
    mobileExportSha256: '266b7ccba64d2413bb02fd1f2770578f04149fcacb3b0a77f72230c2b8d24d37',
    sourceSha256: 'edea5b2d8ad25ef6cd46a6de4543171fe263e050907f391a2fc293b02109dc6d',
  }),
});

export function PlayerSpriteCalibrationFor(path)
{
  return Object.hasOwn(PlayerSpriteCalibrations, path)
    ? PlayerSpriteCalibrations[path]
    : null;
}
