// Artwork can move inward when a narrow field gives it half the stage. Keep
// its readable overhead at the reserved formation anchor, independently of
// that art clamp, while reserving the measured control's complete screen box.
export function combatOverheadAnchorX({ width, x, controlWidth, inset = 6 }) {
  const half = Math.min(Math.max(0, controlWidth) / 2, Math.max(0, width / 2 - inset));
  return Math.min(Math.max(x, inset + half), width - inset - half);
}

// SPEC §7: the physical height of an enemy/player tap area in screen px. Both
// the packed spacing below and the painted `--enemy-hit-height` derive from
// this one value, so two packed targets' hit areas can never overlap.
export const COMBAT_TARGET_HIT_PX = 44;

// Pack spacing for the context-selected footers: at least the real hit-area
// height, even when the compact visual footer (#1787) is shorter.
export function combatTargetPackSize(footerHeights = []) {
  return Math.max(COMBAT_TARGET_HIT_PX, ...footerHeights.filter(Number.isFinite));
}

// Tap areas follow the measured feet until final sprite fitting brings two
// formation rows together. Space only these targets, inside the stage, so a
// neighbouring figure cannot take the owner's complete tap area.
export function combatTargetAnchors({ width, height, targets, size = COMBAT_TARGET_HIT_PX, obstacles = [], lockX = false,
  maxShiftX = 0, packWithinBounds = false }) {
  const half = size / 2;
  const controls = targets.map(target => ({ ...target, side: 'target', width: Math.max(size, target.width || 0),
    y: Math.min(Math.max(target.y, half), Math.max(half, height - half)) }));
  const intersects = (control, x, obstacle) => (obstacle.ownerId == null || obstacle.ownerId !== control.id)
    && x - control.width / 2 < obstacle.right
    && x + control.width / 2 > obstacle.left
    && control.y - half < obstacle.bottom && control.y + half > obstacle.top;
  if (packWithinBounds) {
    const preferred = combatTargetAnchors({ width, height, targets, size, obstacles: [], lockX });
    const rect = anchor => ({ left: anchor.x - anchor.width / 2, right: anchor.x + anchor.width / 2,
      top: anchor.y - half, bottom: anchor.y + half });
    const clear = (a, b) => a.right + 2 <= b.left || a.left >= b.right + 2
      || a.bottom + 2 <= b.top || a.top >= b.bottom + 2;
    const starts = preferred.map(anchor => ({ ...controls.find(control => control.id === anchor.id), ...anchor }));
    const edges = [...obstacles, ...starts.map(rect)];
    const unique = values => [...new Map(values.map(value => [Math.round(value * 64), value])).values()];
    const options = starts.map(start => {
      const xs = lockX ? [start.x] : unique([start.x, start.width / 2, width - start.width / 2,
        ...edges.flatMap(box => [box.left - start.width / 2 - 2, box.right + start.width / 2 + 2])]);
      const ys = unique([start.y, half, height - half,
        ...edges.flatMap(box => [box.top - half - 2, box.bottom + half + 2])]);
      return xs.flatMap(x => ys.map(y => ({ ...start, x, y })))
        .filter(anchor => {
          const box = rect(anchor);
          return box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height && anchor.y >= (start.minY ?? 0)
            && obstacles.every(obstacle => obstacle.ownerId != null && obstacle.ownerId === anchor.id || clear(box, obstacle));
        })
        .sort((a, b) => (a.x - start.x) ** 2 + (a.y - start.y) ** 2
          - ((b.x - start.x) ** 2 + (b.y - start.y) ** 2));
    });
    // Search the small fighter group together: a greedy first footer can use
    // the only clear slot available to a later, wider plate.
    let visits = 0;
    const place = (index, placed) => {
      if (index === options.length) return placed;
      if (++visits > 20000) return null;
      for (const candidate of options[index]) {
        if (!placed.every(other => clear(rect(candidate), rect(other)))) continue;
        if (!placed.every(other => Math.abs(candidate.y - other.y) >= size + 2
          || (candidate.x - other.x) * (starts[index].x - starts.find(start => start.id === other.id).x) >= 0)) continue;
        const result = place(index + 1, [...placed, candidate]);
        if (result) return result;
      }
      return null;
    };
    return place(0, []) || starts.map(anchor => ({ ...anchor, obstructed: true }));
  }
  if (lockX) {
    // Option C shares one vertical center line with the combatant and intent.
    // Resolve crowded footer rows vertically without detaching the plate.
    const shiftLimit = Math.min(size, Math.max(0, maxShiftX));
    const place = (source, x, blockers) => {
      const control = { ...source, x };
      // A body-bottom floor is expressed in the same bounded stage space as
      // the target center. A body below the stage retains the ordinary edge
      // clamp, while an in-stage floor forbids the upward fallback from
      // placing the visible footer back over its owner.
      const floor = Math.min(height - half, Math.max(half, source.minY ?? half));
      let bottomExhausted = false;
      for (let pass=0;pass<=blockers.length;pass++) {
        const covered=blockers.filter(o => intersects(control,control.x,o));
        if (!covered.length) break;
        const nextY=Math.max(...covered.map(o => o.bottom+half+2));
        if (nextY>height-half) { bottomExhausted = true; break; }
        control.y=nextY;
      }
      if (bottomExhausted) {
        // Crowded feet can already be at the field floor. Search upward from
        // the desired anchor rather than retain the earlier plate collision.
        control.y = source.y;
        for (let pass=0;pass<=blockers.length;pass++) {
          const covered=blockers.filter(o => intersects(control,control.x,o));
          if (!covered.length) break;
          const nextY=Math.min(...covered.map(o => o.top-half-2));
          if (nextY<floor) break;
          control.y=nextY;
        }
      }
      return { ...control, obstructed:blockers.some(o => intersects(control,control.x,o)) };
    };
    const distance = (control, source) => Math.abs(control.y-source.y)+Math.abs(control.x-source.x);
    const better = (candidate, current, source) => Number(candidate.obstructed)<Number(current.obstructed)
      || candidate.obstructed===current.obstructed
        && (Math.abs(candidate.y-source.y)<Math.abs(current.y-source.y)
          || Math.abs(candidate.y-source.y)===Math.abs(current.y-source.y)
            && distance(candidate,source)<distance(current,source));
    const pack = (ordered, allowShift = false, seed = null) => {
      const placed = [];
      for (const source of ordered) {
        const blockers = [...obstacles.filter(obstacle => obstacle.ownerId == null || obstacle.ownerId !== source.id), ...placed.map(p => ({ left:p.x-p.width/2,
          right:p.x+p.width/2, top:p.y-half, bottom:p.y+half }))];
        const seeded = seed?.id===source.id;
        let control = place(source, seeded ? seed.x : source.x, blockers);
        if (allowShift && !seeded) {
          // Only the independent plate/footer can move. Try the nearest full
          // rectangle edges, including the visible HUD, within one tap width.
          // Each candidate reuses the bounded vertical search above.
          const xs = [...new Set([source.x-shiftLimit,source.x+shiftLimit,
            source.width/2,width-source.width/2,
            ...blockers.flatMap(o => [o.left-source.width/2-2,o.right+source.width/2+2])])]
            .filter(x => Math.abs(x-source.x)<=shiftLimit && x-source.width/2>=0
              && x+source.width/2<=width)
            .toSorted((a,b) => Math.abs(a-source.x)-Math.abs(b-source.x) || a-b);
          for (const x of xs) {
            const candidate = place(source,x,blockers);
            if (better(candidate,control,source)) control = candidate;
          }
        }
        placed.push(control);
      }
      return placed;
    };
    const ascending = pack(controls.toSorted((a,b) => a.y-b.y));
    const blocked = result => result.filter(control => control.obstructed).length;
    const shift = result => result.reduce((sum, control) => sum
      + Math.abs(control.y-controls.find(source => source.id===control.id).y),0);
    const displaced = ascending.some(control => Math.abs(control.y
      - controls.find(source => source.id===control.id).y)>2*size);
    if (!blocked(ascending) && !displaced) return ascending;
    // A first footer near the floor can consume the only downward slot for
    // another fighter in the same column. Retry from the floor only when the
    // usual placement fails or separates a cue far from its feet. Wide plates
    // get a tied floor slot before narrow targets; ordinary clear layouts keep
    // their exact anchors. Prefer fewer collisions, then less total movement.
    const descending = pack(controls.toSorted((a,b) => b.y-a.y || b.width-a.width));
    const original = blocked(descending) < blocked(ascending)
      || blocked(descending)===blocked(ascending) && shift(descending)<shift(ascending)
      ? descending : ascending;
    if (!shiftLimit || !blocked(original) && !original.some(control => Math.abs(control.y
      - controls.find(source => source.id===control.id).y)>2*size)) return original;
    const movement = result => result.reduce((sum,control) => sum
      + distance(control,controls.find(source => source.id===control.id)),0);
    const detached = result => result.filter(control => Math.abs(control.y
      - controls.find(source => source.id===control.id).y)>2*size).length;
    let result = original;
    const orders = [controls.toSorted((a,b)=>a.y-b.y),
      controls.toSorted((a,b)=>b.y-a.y||b.width-a.width)];
    const consider = repaired => {
      if (blocked(repaired)<blocked(result) || blocked(repaired)===blocked(result)
        && (detached(repaired)<detached(result) || detached(repaired)===detached(result)
          && movement(repaired)<movement(result))) result = repaired;
    };
    for (const ordered of orders) consider(pack(ordered,true));
    if (blocked(result) || detached(result)) {
      // A locally nearest plate can consume a later fighter's only slot.
      // Retain at most two alternatives per actor, then reuse the same bounded
      // searches for all others. This cannot evade an impossible-space flag.
      for (const source of controls) for (const x of [source.x-shiftLimit,source.x+shiftLimit]) {
        if (x-source.width/2<0 || x+source.width/2>width) continue;
        for (const ordered of orders) consider(pack(ordered,true,{id:source.id,x}));
      }
    }
    return result;
  }
  let anchors;
  // A translated target can join another footer band; repack those final
  // bounds before checking the fixed, already placed intent/Inspect controls.
  // Each target moves below each obstacle at most once, so this is bounded.
  for (let pass = 0; pass <= controls.length * obstacles.length; pass++) {
    anchors = combatOverheadAnchors({ width, inset: 0, gap: 2,
      controls: controls.map(target => ({ ...target, top: target.y - half, bottom: target.y + half })) });
    let changed = false;
    for (const control of controls) {
      const x = anchors.find(anchor => anchor.id === control.id).x;
      const covered = obstacles.filter(obstacle => intersects(control, x, obstacle));
      if (!covered.length) continue;
      const nextY = Math.max(...covered.map(obstacle => obstacle.bottom + half + 2));
      if (nextY > height - half) continue; // No in-stage downward slot: report it below.
      control.y = nextY; changed = true;
    }
    if (!changed) break;
  }
  return anchors.map(anchor => {
    const control = controls.find(target => target.id === anchor.id);
    const obstructed = obstacles.some(obstacle => intersects(control, anchor.x, obstacle));
    return { ...anchor, y: control.y, ...(obstructed ? { obstructed: true } : {}) };
  });
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

export function combatOverheadAnchors({ width, controls, inset = 6, gap = 6, ribbon = null, ribbonClearance = 14 }) {
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
        const shift = combatOverheadRibbonShift({ ...control, x, ribbon, clearance: ribbonClearance });
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
