import { battlefieldBackdropConfig } from './SceneLayerModel.js';
import { wireframeUi } from '../../content/wireframeUi.js';

// The combat backdrop is one fixed picture per screen (owner, 2026-11-20): its fit
// depends on the combat box, the zoom, the device and the scene, never on the
// enemies, how many there are, or who is alive. The formation plan supplies only
// the empty grid's lines, which every cell has whether occupied or not.
// Lengths in are real px (the scaled plan, the combat and field boxes); out are
// the fitters' local px.
export function CombatBackdropInputs({ combatWidth, combatHeight, fieldTop, fieldHeight, zoom, narrow, plan, config = wireframeUi.scene })
{
  const width = combatWidth / zoom;
  const height = combatHeight / zoom;
  const fieldTopLocal = fieldTop / zoom;
  const fieldHeightLocal = fieldHeight / zoom;
  const backRankTop = plan.visualBands?.[0]?.top;
  const sceneHeight = fieldTopLocal + fieldHeightLocal;
  return {
    alternative: {
      width,
      height: fieldHeightLocal,
      fieldTop: fieldTopLocal,
      narrow,
      coverFloor: true,
      zoom,
      floorTop: Number.isFinite(backRankTop) ? fieldTopLocal + backRankTop / zoom : undefined,
    },
    environment: {
      height,
      zoom,
      windowTop: 0,
      windowHeight: sceneHeight,
      // Owner 2026-11-13: the floor's top stands at a fixed share of the whole combat screen.
      groundY: height * (1 - config.floorFraction),
      config: battlefieldBackdropConfig({
        height: sceneHeight,
        fieldTop: fieldTopLocal,
        fieldHeight: fieldHeightLocal,
        formation: { cells: plan.cells.map(cell => ({ ground: cell.ground / zoom })) },
      }, config),
    },
  };
}
