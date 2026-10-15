// One uniform transform for every authored layer. Combat can let the near
// floor continue behind the hand while keeping the standing area under feet;
// dialogue retains its explicitly supplied ground line.
export function alternativeBackdropFit(device, { width, height, fieldTop, ground, standGround, coverFloor = false }) {
  const scale = Math.max(width / device.width, (height + (coverFloor ? fieldTop : 0)) / device.height);
  const canvasWidth = device.width * scale, canvasHeight = device.height * scale;
  const standingTop = device.standingArea?.y ?? device.groundAnchor;
  const framed = Number.isFinite(standGround)
    ? Math.min(ground, standGround + (device.groundAnchor - standingTop) * canvasHeight) : ground;
  const cameraGround = coverFloor && Number.isFinite(standGround)
    ? standGround + (device.groundAnchor - standingTop) * canvasHeight : framed;
  const anchoredTop = fieldTop + cameraGround - device.groundAnchor * canvasHeight;
  const top = coverFloor
    ? Math.max(fieldTop + height - canvasHeight, Math.min(0, anchoredTop)) : anchoredTop;
  return { scale, width: canvasWidth, height: canvasHeight, left: (width - canvasWidth) / 2, top };
}
