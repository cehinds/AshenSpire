// Semantic landmarks are source-raster pixels, independently of alpha bounds.
// Weapons, spell effects and transparent canvas never define the head or feet.
// The one pose-invariant size factor: it brings a frame's measured body
// (head to feet) to the idle body's height, so a figure is the same size in
// every pose. 1 when either body is unmeasured.
export function bodyScaleFactor(referenceHeight, landmarks) {
  const body = landmarks ? landmarks.feetY - landmarks.headY : 0;
  return referenceHeight > 0 && body > 0 ? referenceHeight / body : 1;
}

// Like bodyPlacement but only resizes about the frame's own feet, keeping the
// authored travel (a jump's lift, a lunge's reach).
export function bodyResize(placement, landmarks, referenceHeight) {
  if (!landmarks || !(landmarks.feetY > landmarks.headY) || !(landmarks.height > 0)) return { ...placement };
  const sourceScale = placement.height / landmarks.height;
  const feet = placement.top + landmarks.feetY * sourceScale;
  const head = placement.top + landmarks.headY * sourceScale;
  const factor = referenceHeight / (feet - head);
  const anchorX = placement.anchorX ?? placement.left + placement.width / 2;
  return { ...placement,
    left: anchorX + (placement.left - anchorX) * factor,
    top: feet + (placement.top - feet) * factor,
    width: placement.width * factor, height: placement.height * factor,
    body: { headY: feet - referenceHeight, feetY: feet, source: 'authored' },
  };
}

export function bodyPlacement(placement, landmarks, referenceHeight, targetFeet) {
  if (!landmarks || !(landmarks.feetY > landmarks.headY) || !(landmarks.height > 0)) return { ...placement };
  const sourceScale = placement.height / landmarks.height;
  const head = placement.top + landmarks.headY * sourceScale;
  const feet = placement.top + landmarks.feetY * sourceScale;
  const factor = referenceHeight / (feet - head);
  const anchorX = placement.anchorX ?? placement.left + placement.width / 2;
  return { ...placement,
    left: anchorX + (placement.left - anchorX) * factor,
    top: targetFeet + (placement.top - feet) * factor,
    width: placement.width * factor, height: placement.height * factor,
    body: { headY: targetFeet - referenceHeight, feetY: targetFeet, source: 'authored' },
  };
}

export function projectBodyBounds(body, canvasRect, canvasWidth, canvasHeight) {
  if (!body) return null;
  const headY = canvasRect.top + body.headY * canvasRect.height / canvasHeight;
  const feetY = canvasRect.top + body.feetY * canvasRect.height / canvasHeight;
  return { top: headY, bottom: feetY, headY, feetY, bodyHeight: feetY - headY,
    left: canvasRect.left, right: canvasRect.right, source: body.source };
}
