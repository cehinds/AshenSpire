import { battlefieldBackdropConfig } from './SceneLayerModel.js';
import { wireframeUi } from '../../content/wireframeUi.js';

// The combat backdrop is one fixed picture per screen (owner, 2026-11-20): its fit
// depends on the combat box, the zoom, the device and the scene, never on the
// enemies, how many there are, who is alive, or the hand. The formation plan
// supplies only the empty grid's lines, taken once per screen.

// The field box and the grid lines a pass drew, in local px (the lines from the
// field's top). The field's height follows the hand (a phone's controls reserve),
// so the backdrop takes it from here, not live. `screenKey` names the screen.
// Lengths in are real px.
export function BackdropGridLines({ plan, zoom, narrow, screenKey, fieldTop, fieldHeight })
{
  const backRankTop = plan.visualBands?.[0]?.top;
  return {
    screenKey,
    narrow,
    fieldTop: fieldTop / zoom,
    fieldHeight: fieldHeight / zoom,
    backRankTop: Number.isFinite(backRankTop) ? backRankTop / zoom : undefined,
    cellGrounds: plan.cells.map(cell => cell.ground / zoom),
  };
}

// The box and lines held for the fight, stored only by a formation pass, from its
// own plan and field. A pass on the screen that already holds them keeps them: a
// later pass there (a death after the hand changed size, which moves the grid and
// the field a little) never replaces them. A pass on a new screen stores its own.
// A fit without a pass uses what is held, even on a screen still waiting for its
// pass, and stores nothing.
export function HeldBackdropGrid(held, passLines)
{
  return held?.screenKey === passLines.screenKey ? held : passLines;
}

// The combat box is real px and live; the field box and lines are the held grid's
// local px; out are the fitters' local px.
export function CombatBackdropInputs({ combatWidth, combatHeight, zoom, grid, config = wireframeUi.scene })
{
  const width = combatWidth / zoom;
  const height = combatHeight / zoom;
  const fieldTopLocal = grid.fieldTop;
  const fieldHeightLocal = grid.fieldHeight;
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
