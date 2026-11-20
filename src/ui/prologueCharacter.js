// The traveller and ground shadow are one transparent layer. The extra canvas
// area preserves the shadow when the layer is moved, scaled, or exported.
export const CHARACTER_LAYER_HEIGHT = 1.32;
const CHARACTER_DIMENSIONS = new WeakMap();

export function prologueCharacterDimensions(canvas) {
  return CHARACTER_DIMENSIONS.get(canvas);
}

// Canvas `ctx.filter` does not exist in Safari (iOS 15 included), where assigning it is
// silently ignored: the ground shadow would be drawn as a coloured reflection of the
// figure and the figure would not be dimmed. Stand in for the two filters with a scratch
// canvas: `darken` is the black laid over the figure's own pixels (1 = brightness(0),
// .21 = brightness(79%)), `scale` < 1 draws it small so scaling it back up softens it
// (the shadow's blur). The result is a canvas the caller draws in place of the image.
function silhouetteWithoutFilter(canvas, image, darken, scale) {
  const doc = canvas.ownerDocument || globalThis.document;
  const w = Math.max(1, Math.round(image.naturalWidth * scale)), h = Math.max(1, Math.round(image.naturalHeight * scale));
  const scratch = doc.createElement('canvas');
  scratch.width = w; scratch.height = h;
  const g = scratch.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(0,0,0,${darken || 1})`;
  g.fillRect(0, 0, w, h);
  return scratch;
}

export function paintPrologueCharacter(canvas, image, strength = .7) {
  const w = image.naturalWidth, h = image.naturalHeight, pad = Math.ceil(h * .6);
  canvas.width = w + pad * 2;
  canvas.height = Math.ceil(h * CHARACTER_LAYER_HEIGHT);
  // Keep the source geometry: canvas rounding cannot reconstruct it later.
  CHARACTER_DIMENSIONS.set(canvas, Object.freeze({ width:w, height:h, padding:pad }));
  const ctx = canvas.getContext('2d');
  const footX = pad + w * .6, footY = h * .98;
  ctx.save();
  ctx.globalAlpha = strength * .48;
  const filtered = ctx.filter !== undefined;
  if (filtered) ctx.filter = `brightness(0) blur(${h * .009}px)`;
  ctx.translate(footX, footY);
  ctx.transform(1, 0, .5, -.23, 0, 0);
  ctx.drawImage(filtered ? image : silhouetteWithoutFilter(canvas, image, 0, .25), -w * .6, -h * .98, w, h);
  ctx.restore();
  // A tighter contact patch joins the soles to uneven ground, with a softer
  // outer falloff instead of a floating drop shadow around the whole figure.
  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(w * .38, h * .045);
  const contact = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  contact.addColorStop(0, `rgba(0,0,0,${strength})`);
  contact.addColorStop(.4, `rgba(0,0,0,${strength * .7})`);
  contact.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = contact;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  if (filtered) ctx.filter = 'brightness(79%)';
  ctx.drawImage(filtered ? image : silhouetteWithoutFilter(canvas, image, .21, 1), pad, 0, w, h);
  if (filtered) ctx.filter = 'none';
  return canvas;
}

export function placePrologueCharacter(canvas, position) {
  Object.assign(canvas.style, {
    left: `${position.x}%`,
    bottom: `${100 - position.y - position.height * (CHARACTER_LAYER_HEIGHT - 1)}%`,
    height: `${position.height * CHARACTER_LAYER_HEIGHT}%`,
    transform: `translateX(-50%) rotate(${Number(position.rotation) || 0}deg)`,
    transformOrigin: `50% ${100 / CHARACTER_LAYER_HEIGHT}%`,
    zIndex: position.layer === 'front' ? '2' : '0',
  });
}

// DOM bounds include rotation; the traveller's size controls must not. Recover
// the canvas origin from its rotated bounds, then enclose only the painted
// figure (not the transparent padding or its ground shadow).
export function prologueTravellerGeometry({ canvasWidth, canvasHeight, source, renderedWidth, renderedHeight, rotation = 0, bounds }) {
  const { width:sourceWidth, height:sourceHeight, padding:pad } = source;
  const scaleX = renderedWidth / canvasWidth, scaleY = renderedHeight / canvasHeight;
  const origin = { x: renderedWidth / 2, y: renderedHeight / CHARACTER_LAYER_HEIGHT };
  const radians = rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const rotate = (x, y) => ({ x: origin.x + (x-origin.x)*cos - (y-origin.y)*sin,
    y: origin.y + (x-origin.x)*sin + (y-origin.y)*cos });
  const enclose = points => ({ left: Math.min(...points.map(p=>p.x)), top: Math.min(...points.map(p=>p.y)),
    right: Math.max(...points.map(p=>p.x)), bottom: Math.max(...points.map(p=>p.y)) });
  const canvas = enclose([[0,0],[renderedWidth,0],[0,renderedHeight],[renderedWidth,renderedHeight]].map(([x,y])=>rotate(x,y)));
  const figure = enclose([[pad*scaleX,0],[(pad+sourceWidth)*scaleX,0],
    [pad*scaleX,sourceHeight*scaleY],[(pad+sourceWidth)*scaleX,sourceHeight*scaleY]].map(([x,y])=>rotate(x,y)));
  const left = bounds.left-canvas.left, top = bounds.top-canvas.top;
  return { left:left+figure.left, top:top+figure.top, width:figure.right-figure.left, height:figure.bottom-figure.top,
    intrinsicWidth:sourceWidth*scaleX, intrinsicHeight:sourceHeight*scaleY,
    anchor:{ x:left+origin.x, y:top+origin.y } };
}

export function prologueTravellerHeightForWidth(height, desiredWidth, currentWidth) {
  return Math.max(10, Math.min(100, Math.round(height * desiredWidth / currentWidth)));
}

// Corner handles surround the rotated screen-space box. Their deltas scale
// that box; numeric width controls separately use the unrotated figure size.
export function prologueTravellerResizeScale(figure, dx, dy, corner) {
  const horizontal = dx * (corner.includes('e') ? 1 : -1) / Math.max(1, figure.width);
  const vertical = dy * (corner.includes('s') ? 1 : -1) / Math.max(1, figure.height);
  return 1 + (Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical);
}
