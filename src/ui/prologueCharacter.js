// The traveller and ground shadow are one transparent layer. The extra canvas
// area preserves the shadow when the layer is moved, scaled, or exported.
export const CHARACTER_LAYER_HEIGHT = 1.32;

export function paintPrologueCharacter(canvas, image, strength = .7) {
  const w = image.naturalWidth, h = image.naturalHeight, pad = Math.ceil(h * .6);
  canvas.width = w + pad * 2;
  canvas.height = Math.ceil(h * CHARACTER_LAYER_HEIGHT);
  const ctx = canvas.getContext('2d');
  const footX = pad + w * .6, footY = h * .98;
  ctx.save();
  ctx.globalAlpha = strength * .48;
  ctx.filter = `brightness(0) blur(${h * .009}px)`;
  ctx.translate(footX, footY);
  ctx.transform(1, 0, .5, -.23, 0, 0);
  ctx.drawImage(image, -w * .6, -h * .98);
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
  ctx.filter = 'brightness(79%)';
  ctx.drawImage(image, pad, 0);
  ctx.filter = 'none';
  return canvas;
}

export function placePrologueCharacter(canvas, position) {
  Object.assign(canvas.style, {
    left: `${position.x}%`,
    bottom: `${100 - position.y - position.height * (CHARACTER_LAYER_HEIGHT - 1)}%`,
    height: `${position.height * CHARACTER_LAYER_HEIGHT}%`,
  });
}
