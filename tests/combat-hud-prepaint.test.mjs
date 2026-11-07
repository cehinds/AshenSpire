import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// These source-slice fixtures exercise the expanded/co-op HUD path.
// Alternative native body-head placement has its own real-pose browser tests.
// HUD layout geometry tokens unset (getComputedStyle → {}): every offset is 0.
import {hudGeometry,offsetPlacement} from '../src/ui/models/HudLayoutOffsetModel.js';
import {combatPlayerInfoRect,combatPlayerActionRect,combatTargetHudFootprints,visibleCombatPanelRect} from '../src/ui/components/battlefieldStage.js';
import {playerDetailsPlacement} from '../src/ui/models/PlayerDetailsPlacementModel.js';

// The details-panel placement these tests pinned (obstacle avoidance, tools ceiling, per-frame follow) was removed on purpose: the player HUD is fixed right of the figure (owner, 2026-11-06). tests/player-hud-fixed-right.test.mjs holds the new contract.
