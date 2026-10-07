// Artwork can move inward when a narrow field gives it half the stage. Keep
// its readable overhead at the reserved formation anchor, independently of
// that art clamp, while reserving the measured control's complete screen box.
export function combatOverheadAnchorX({ width, x, controlWidth, inset = 6 }) {
  const half = Math.min(Math.max(0, controlWidth) / 2, Math.max(0, width / 2 - inset));
  return Math.min(Math.max(x, inset + half), width - inset - half);
}

// Edge clamping consumes the gap between neighbouring reserved slots. Pack
// controls sharing a side and measured vertical band, leaving their artwork
// and ground anchors alone. Fitted grounds can put separate formation rows in
// the same physical band. Prefer the reserved position; shift an inner control
// only as far as the measured outer control needs for a readable gap.
export function combatOverheadRibbonShift({ x, width, top, bottom, ribbon, clearance = 14 }) {
  if (!ribbon || !Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  const intersects = x - width / 2 < ribbon.right && x + width / 2 > ribbon.left
    && top < ribbon.bottom && bottom > ribbon.top;
  return intersects ? Math.max(0, ribbon.bottom + clearance - top) : 0;
}

export function combatOverheadAnchors({ width, controls, inset = 6, gap = 6, ribbon = null }) {
  if (ribbon) {
    const adjusted = controls.map(control => ({ ...control, offsetY: 0 }));
    let anchors;
    // Moving a control below the ribbon can join another formation row's
    // physical band. Pack those final bounds again; each control shifts at
    // most once, so this remains bounded without moving any artwork.
    for (let pass = 0; pass <= controls.length; pass++) {
      anchors = combatOverheadAnchors({ width, controls: adjusted, inset, gap });
      let changed = false;
      for (const control of adjusted) {
        const x = anchors.find(anchor => anchor.id === control.id).x;
        const shift = combatOverheadRibbonShift({ ...control, x, ribbon });
        if (!shift) continue;
        control.top += shift; control.bottom += shift; control.offsetY += shift;
        changed = true;
      }
      if (!changed) break;
    }
    return anchors.map(anchor => ({ ...anchor, offsetY: adjusted.find(control => control.id === anchor.id).offsetY }));
  }
  const groups = new Map();
  for (const control of controls) {
    const measured = Number.isFinite(control.top) && Number.isFinite(control.bottom);
    const key = `${control.side}:${measured ? 'measured' : control.row}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...control, reservedX: control.x, x: combatOverheadAnchorX({ width,
      x: control.x, controlWidth: control.width, inset }) });
  }
  const positioned = [];
  for (const group of groups.values()) {
    // Actors of different stature can have unrelated overhead bands.
    // Only vertically intersecting controls need horizontal clearance.
    const bands = [];
    for (const control of group.toSorted((a, b) => (a.top ?? 0) - (b.top ?? 0))) {
      let band = bands.at(-1);
      if (!band || (control.top ?? -Infinity) >= band.bottom) {
        band = { controls: [], bottom: control.bottom ?? Infinity }; bands.push(band);
      }
      band.controls.push(control);
      band.bottom = Math.max(band.bottom, control.bottom ?? Infinity);
    }
    for (const { controls: band } of bands) {
      band.sort((a, b) => a.reservedX - b.reservedX);
      // A physically wider-than-field band cannot be repaired with horizontal
      // offsets alone. Retain its edge clamps rather than push controls out.
      if (band.reduce((sum, control) => sum + control.width, 0) + gap * (band.length - 1) <= width - inset * 2) {
        for (let i = band.length - 2; i >= 0; i--) {
          band[i].x = Math.min(band[i].x,
            band[i + 1].x - (band[i].width + band[i + 1].width) / 2 - gap);
        }
        for (let i = 0; i < band.length; i++) {
          band[i].x = Math.max(band[i].x, inset + band[i].width / 2,
            i ? band[i - 1].x + (band[i - 1].width + band[i].width) / 2 + gap : -Infinity);
        }
      }
      positioned.push(...band.map(({ id, x }) => ({ id, x })));
    }
  }
  return positioned;
}
