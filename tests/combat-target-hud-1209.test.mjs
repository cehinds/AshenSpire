import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
// HUD layout geometry tokens unset (rootStyle and getComputedStyle → {}): every offset is 0.
import {hudGeometry,offsetPlacement} from '../src/ui/models/HudLayoutOffsetModel.js';
import { combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';
import { playerDetailsPlacement } from '../src/ui/models/PlayerDetailsPlacementModel.js';
import { packCombatTargetsWithHud, combatTargetHudFootprints, combatPlayerActionRect } from '../src/ui/components/battlefieldStage.js';

// The details-panel placement these tests pinned (obstacle avoidance, tools ceiling, per-frame follow) was removed on purpose: the player HUD is fixed right of the figure (owner, 2026-11-06). tests/player-hud-fixed-right.test.mjs holds the new contract.
