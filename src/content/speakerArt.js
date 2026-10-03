// Speaker portraits that are not enemy identities. Edit these paths and rebuild
// when replacing a dialogue figure; enemy-backed speakers keep their poses.
const SPEAKER_PORTRAITS = Object.freeze({
  roadWarden: 'assets/portraits/roadWarden.webp',
});

export function speakerPortraitAsset(key) {
  return SPEAKER_PORTRAITS[key] || null;
}
