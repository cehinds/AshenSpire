// src/content/settingsDefaults.js — THE OWNER'S PROMOTED SETTINGS DEFAULTS.
//
// WRITTEN BY tools/settings-defaults.mjs, never by hand: that tool reads a
// settings profile (Settings → Advanced → Defaults & sync, or any Export
// configuration file), checks it through the same import door a player's
// file goes through, and writes the values below.
//
// What the game does with them (src/model/settingsDefaults.js):
//   · a key the player has never set starts at this value;
//   · a key still at the value an earlier promotion gave it follows a new one;
//   · a key the player changed is theirs and is never touched;
//   · Reset puts a key back to this value, not to the row's code default.
// Empty values mean the code defaults stand, exactly as before this file.
export const SETTINGS_DEFAULTS = Object.freeze({
  digest: '06146a8ffb',
  values: Object.freeze({
    "gameConfig.balance.level.xp.growth": 1.5,
    "gameConfig.balance.rewards.cardChoices": 0,
    "gameConfig.balance.rewards.cardRewards.chancePct.normal": 24,
    "gameConfig.presentation.backLayer": 200,
    "gameConfig.presentation.backOffsetX": 0,
    "gameConfig.presentation.backOffsetY": 0,
    "gameConfig.presentation.enemySpriteScale": 1.5,
    "gameConfig.presentation.formationColumns": 2,
    "gameConfig.presentation.formationDepth": 60,
    "gameConfig.presentation.formationGap": 12,
    "gameConfig.presentation.formationPreset": "straight",
    "gameConfig.presentation.formationRows": 2,
    "gameConfig.presentation.formationWidth": 80,
    "gameConfig.presentation.frontLayer": 0,
    "gameConfig.presentation.frontOffsetX": 0,
    "gameConfig.presentation.frontOffsetY": 0,
    "gameConfig.presentation.gridShape": "wide-rhombus",
    "gameConfig.presentation.groundSkew": 15,
    "gameConfig.presentation.groundTilt": 35,
    "gameConfig.presentation.playerSpawnColumn": "1",
    "gameConfig.presentation.rowALayer": 0,
    "gameConfig.presentation.rowAScale": 1,
    "gameConfig.presentation.rowBLayer": 0,
    "gameConfig.presentation.rowBScale": 2,
    "gameConfig.presentation.rowCLayer": 0,
    "gameConfig.presentation.rowCScale": 1,
    "gameConfig.presentation.rowDLayer": 0,
    "gameConfig.presentation.rowDScale": 1,
    "gameConfig.presentation.rowELayer": 0,
    "gameConfig.presentation.rowEScale": 1,
    "gameConfig.presentation.rowFLayer": 0,
    "gameConfig.presentation.rowFScale": 1,
    "gameConfig.presentation.showFormationGrid": false,
    "gameConfig.prologue.scenes.extraA.character": false,
    "gameConfig.prologue.scenes.step.actor.desktop.height": 40,
    "gameConfig.prologue.scenes.step.actor.desktop.layer": "behindWash",
    "gameConfig.prologue.scenes.step.actor.desktop.rotation": 0,
    "gameConfig.prologue.scenes.step.actor.desktop.y": 96
  }),
});
