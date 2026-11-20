import { battlefieldBackdropConfig } from './SceneLayerModel.js';
import { wireframeUi } from '../../content/wireframeUi.js';

// The combat backdrop is one fixed picture per screen (owner, 2026-11-20): its fit
// depends on the combat box, the zoom, the device and the scene, never on the
// enemies, how many there are, who is alive, or the hand. The formation plan
// supplies only the empty grid's lines, taken once per screen.

// The grid lines a plan drew, in local px from the field's top. `screenKey` names
// the screen the plan was made for.
export function BackdropGridLines({ plan, zoom, narrow, screenKey })
{
  const backRankTop = plan.visualBands?.[0]?.top;
  return {
    screenKey,
    narrow,
    backRankTop: Number.isFinite(backRankTop) ? backRankTop / zoom : undefined,
    cellGrounds: plan.cells.map(cell => cell.ground / zoom),
  };
}

// The lines held for the fight, stored only by a formation pass, from its own plan
// and the screen measured in that pass. A pass on the screen that already holds
// lines keeps them: a later plan there (a death after the hand changed size, which
// moves the grid a little) never replaces them. A pass on a new screen stores its own.
// A fit without a pass uses the held lines as they are, even on a screen still
// waiting for its pass, and stores nothing.
export function HeldBackdropGrid(held, passLines)
{
  return held?.screenKey === passLines.screenKey ? held : passLines;
}

// Lengths in are real px (the combat and field boxes); the grid is local px; out
// are the fitters' local px.
export function CombatBackdropInputs({ combatWidth, combatHeight, fieldTop, fieldHeight, zoom, grid, config = wireframeUi.scene })
{
  const width = combatWidth / zoom;
  const height = combatHeight / zoom;
  const fieldTopLocal = fieldTop / zoom;
  const fieldHeightLocal = fieldHeight / zoom;
  const sceneHeight = fieldTopLocal + fieldHeightLocal;
  return {
    alternative: {
      width,
      height: fieldHeightLocal,
      fieldTop: fieldTopLocal,
      narrow: grid.narrow,
      coverFloor: true,
      zoom,
      floorTop: Number.isFinite(grid.backRankTop) ? fieldTopLocal + grid.backRankTop : undefined,
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
        formation: { cells: grid.cellGrounds.map(ground => ({ ground })) },
      }, config),
    },
  };
}
