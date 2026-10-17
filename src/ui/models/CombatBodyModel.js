// Semantic landmarks are source-raster pixels, independently of alpha bounds.
// Weapons, spell effects and transparent canvas never define the head or feet.
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
