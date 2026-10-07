// src/ui/sceneConfig.js — the one seam the W4 screens read their scene
// configs through: w4Parent() is uiConfig.scenes.w4 and w4cLayout() is
// uiConfig.scenes.w4c, authored in content/config/ui/scenes/*.json and
// compiled by tools/config-build.mjs into src/config/generated/ui.js. The
// models take these objects as parameters and read no config of their own.
// Edit the JSON, never this file: tests/ui-config.test.mjs holds it to handing
// out the uiConfig objects themselves and authoring no number, and holds
// those objects equal to what #1106 shipped here before the tree was on dev.
import { uiConfig } from '../config/generated/ui.js';

export const w4Parent = () => uiConfig.scenes.w4;
export const w4cLayout = () => uiConfig.scenes.w4c;
