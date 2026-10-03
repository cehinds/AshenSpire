// Approved SP Atelier layout, October 3, 2026. Coordinates use its 900px canvas.
// Source masters and the portable editor layout live in AshenSpire-art.
export const staminaOrb = {
  radius: 37.5,
  gemSize: 16,
  rotation: 0,
  aspectRatios: { frame: 519 / 512, orb: 515 / 512, sigil: 449 / 512, diamond: 361 / 512, spent: 347 / 512 },
  layers: {
    frame: { visible: true, size: 90, x: 0, y: 0, opacity: 100, hue: 0 },
    orb: { visible: true, size: 66, x: 0, y: 0, opacity: 100, hue: 0 },
    sigil: { visible: false, size: 17, x: 0, y: -18, opacity: 100, hue: 0 },
    diamond: { visible: true, size: 130, x: 0, y: 0, opacity: 100, hue: 0 },
    spent: { visible: true, size: 60, x: 0, y: 0, opacity: 100, hue: 0 },
    number: { visible: true, size: 150, x: 0, y: 0, opacity: 100, hue: 0 },
    label: { visible: true, size: 100, x: 0, y: 14, opacity: 100, hue: 0 },
  },
  assets: Object.fromEntries(['frame', 'orb', 'sigil', 'diamond', 'spent'].map(id => [id, `assets/ui/stamina-orb/${id}.webp`])),
};
