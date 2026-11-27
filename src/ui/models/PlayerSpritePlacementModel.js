import { PlayerSpriteCalibrationFor } from '../../content/playerSpriteCalibrations.js';

export function PlayerSpritePlacement(path, targetStageRoot)
{
  const calibration = PlayerSpriteCalibrationFor(path);

  if (!calibration)
  {
    return null;
  }

  if (!Number.isFinite(targetStageRoot?.x) || !Number.isFinite(targetStageRoot?.y))
  {
    throw new TypeError('Calibrated player placement requires a finite stage root.');
  }

  const family = calibration.family;
  const left = targetStageRoot.x - family.sourceRoot[0] * family.scale;
  const top = targetStageRoot.y - family.sourceRoot[1] * family.scale;

  return (
  {
    left,
    top,
    width: family.sourceSize[0] * family.scale,
    height: family.sourceSize[1] * family.scale,
    anchorX: targetStageRoot.x,
    body:
    {
      headY: top + calibration.body.headY * family.scale,
      feetY: top + calibration.body.feetY * family.scale,
      source: 'authored',
    },
  });
}
