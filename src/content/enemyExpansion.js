// Generated from the 2026-10-09 enemy package. Canvas 512; floor 480.
const actions = {
  "attack": [
    {
      "pose": "attack-01",
      "duration": 70
    },
    {
      "pose": "attack-02",
      "duration": 60
    },
    {
      "pose": "attack-03",
      "duration": 60
    },
    {
      "pose": "attack-04",
      "duration": 70
    }
  ],
  "counterattack": [
    {
      "pose": "counterattack-01",
      "duration": 70
    },
    {
      "pose": "counterattack-02",
      "duration": 60
    },
    {
      "pose": "counterattack-03",
      "duration": 60
    },
    {
      "pose": "counterattack-04",
      "duration": 70
    }
  ],
  "magicAttack": [
    {
      "pose": "magic-01",
      "duration": 90
    },
    {
      "pose": "magic-02",
      "duration": 80
    },
    {
      "pose": "magic-03",
      "duration": 90
    }
  ],
  "rangedWeaponAttack": [
    {
      "pose": "ranged-01",
      "duration": 130
    },
    {
      "pose": "ranged-02",
      "duration": 130
    }
  ],
  "sweep": [
    {
      "pose": "sweep-01",
      "duration": 70
    },
    {
      "pose": "sweep-02",
      "duration": 60
    },
    {
      "pose": "sweep-03",
      "duration": 60
    },
    {
      "pose": "sweep-04",
      "duration": 70
    }
  ],
  "block": [
    {
      "pose": "block-01",
      "duration": 130
    },
    {
      "pose": "block-02",
      "duration": 130
    }
  ]
};
const poses = ["attack-01","attack-02","attack-03","attack-04","block-01","block-02","counterattack-01","counterattack-02","counterattack-03","counterattack-04","defeated","hit","idle","magic-01","magic-02","magic-03","preparing","ranged-01","ranged-02","sweep-01","sweep-02","sweep-03","sweep-04","wounded"];
const sizes = {
  "wanderingSoldier": {
    "idleWidth": 235,
    "idleHeight": 332
  },
  "blightHound": {
    "idleWidth": 302,
    "idleHeight": 363
  },
  "huskBrute": {
    "idleWidth": 297,
    "idleHeight": 295
  },
  "graveWisp": {
    "idleWidth": 277,
    "idleHeight": 348
  },
  "wyrmAspirant": {
    "idleWidth": 284,
    "idleHeight": 387
  },
  "fellWarden": {
    "idleWidth": 317,
    "idleHeight": 297
  },
  "lanternMoth": {
    "idleWidth": 328,
    "idleHeight": 354
  },
  "briarHermit": {
    "idleWidth": 259,
    "idleHeight": 354
  },
  "chainScavenger": {
    "idleWidth": 285,
    "idleHeight": 338
  },
  "bellKeeper": {
    "idleWidth": 226,
    "idleHeight": 332
  },
  "thornMatriarch": {
    "idleWidth": 280,
    "idleHeight": 391
  },
  "gildedKnight": {
    "idleWidth": 301,
    "idleHeight": 344
  },
  "courtSurgeon": {
    "idleWidth": 244,
    "idleHeight": 360
  },
  "stitchedHound": {
    "idleWidth": 329,
    "idleHeight": 343
  },
  "courtMarionette": {
    "idleWidth": 204,
    "idleHeight": 400
  },
  "livingArmor": {
    "idleWidth": 299,
    "idleHeight": 366
  },
  "courtDuelist": {
    "idleWidth": 318,
    "idleHeight": 361
  },
  "stitchedKing": {
    "idleWidth": 235,
    "idleHeight": 325
  },
  "mirrorScribe": {
    "idleWidth": 262,
    "idleHeight": 375
  },
  "stitchCrab": {
    "idleWidth": 326,
    "idleHeight": 305
  },
  "glassRegent": {
    "idleWidth": 311,
    "idleHeight": 356
  },
  "marrowOrganist": {
    "idleWidth": 283,
    "idleHeight": 353
  },
  "ashRevenant": {
    "idleWidth": 255,
    "idleHeight": 379
  },
  "emberStarvedPilgrim": {
    "idleWidth": 206,
    "idleHeight": 361
  },
  "valkyrieShade": {
    "idleWidth": 248,
    "idleHeight": 338
  },
  "charredColossus": {
    "idleWidth": 244,
    "idleHeight": 290
  },
  "wyrmLord": {
    "idleWidth": 308,
    "idleHeight": 374
  },
  "blightedValkyrie": {
    "idleWidth": 261,
    "idleHeight": 311
  },
  "cinderMantis": {
    "idleWidth": 305,
    "idleHeight": 351
  },
  "eclipseCantor": {
    "idleWidth": 349,
    "idleHeight": 389
  },
  "furnaceSaint": {
    "idleWidth": 268,
    "idleHeight": 335
  },
  "hollowAstronomer": {
    "idleWidth": 249,
    "idleHeight": 348
  },
  "ashheartDragon": {
    "idleWidth": 343,
    "idleHeight": 409
  }
};
// Codex concept enemies (2026-11-18, asset-data/enemy-concepts): committed frames are idle, attack-01/02, react-01/02,
// defend-01/02 and downed; the six held stances (stance-*) are additive and live in enemyStanceSprites.js. The art has one
// attack clip, so every attacking action plays it; hit, wounded and defeated name their frames through actions.
const conceptPoses = ["idle", "attack-01", "attack-02", "react-01", "react-02", "defend-01", "defend-02", "downed"];
const clip = (...frames) => frames.map(pose => ({ pose, duration: 260 / frames.length }));
const conceptActions = {
  "attack": clip("attack-01", "attack-02"),
  "counterattack": clip("attack-02", "attack-01"),
  "magicAttack": clip("attack-01", "attack-02"),
  "rangedWeaponAttack": clip("attack-01", "attack-02"),
  "sweep": clip("attack-01", "attack-02"),
  "block": clip("defend-01", "defend-02"),
  "hit": clip("react-01", "react-02"),
  "wounded": clip("react-02"),
  "defeated": clip("downed")
};
const conceptSizes = {
  "brackenTusker": {
    "idleWidth": 444,
    "idleHeight": 334
  },
  "fenwickToad": {
    "idleWidth": 462,
    "idleHeight": 340
  },
  "reedpipePoacher": {
    "idleWidth": 320,
    "idleHeight": 382
  },
  "wickerTitheman": {
    "idleWidth": 186,
    "idleHeight": 382
  },
  "quarryRam": {
    "idleWidth": 422,
    "idleHeight": 342
  },
  "tollgateHookman": {
    "idleWidth": 220,
    "idleHeight": 364
  },
  "waxsealBailiff": {
    "idleWidth": 332,
    "idleHeight": 342
  },
  "kilnshellTortoise": {
    "idleWidth": 462,
    "idleHeight": 358
  },
  "slagtongImp": {
    "idleWidth": 346,
    "idleHeight": 338
  },
  "sootwingBat": {
    "idleWidth": 462,
    "idleHeight": 292
  },
  "siltCrownNewt": {
    "idleWidth": 378,
    "idleHeight": 278
  },
  "wickerHind": {
    "idleWidth": 230,
    "idleHeight": 302
  },
  "blackrushStork": {
    "idleWidth": 218,
    "idleHeight": 276
  },
  "pearlbackSnail": {
    "idleWidth": 346,
    "idleHeight": 314
  },
  "alderMaskHarvester": {
    "idleWidth": 154,
    "idleHeight": 266
  },
  "pallidOathCamel": {
    "idleWidth": 250,
    "idleHeight": 270
  },
  "inkveilNautilus": {
    "idleWidth": 316,
    "idleHeight": 310
  },
  "mirrorFanAbbess": {
    "idleWidth": 206,
    "idleHeight": 362
  },
  "saltChoirWalrus": {
    "idleWidth": 318,
    "idleHeight": 250
  },
  "rimewheelPenitent": {
    "idleWidth": 344,
    "idleHeight": 396
  },
  "brassThroatIbex": {
    "idleWidth": 292,
    "idleHeight": 364
  },
  "kilnbackTerrapin": {
    "idleWidth": 382,
    "idleHeight": 308
  },
  "slagwingHeron": {
    "idleWidth": 198,
    "idleHeight": 298
  },
  "ashSilkWeaver": {
    "idleWidth": 276,
    "idleHeight": 238
  },
  "ferrumVotary": {
    "idleWidth": 274,
    "idleHeight": 264
  },
  "woundwoodTusker": {
    "idleWidth": 426,
    "idleHeight": 398
  },
  "mireProcessional": {
    "idleWidth": 412,
    "idleHeight": 414
  },
  "veiledJusticiar": {
    "idleWidth": 376,
    "idleHeight": 402
  },
  "sixleggedHearse": {
    "idleWidth": 376,
    "idleHeight": 346
  },
  "crucibleNewt": {
    "idleWidth": 464,
    "idleHeight": 212
  },
  "carrionHeadsman": {
    "idleWidth": 408,
    "idleHeight": 320
  },
  "knellcapSentinel": {
    "idleWidth": 460,
    "idleHeight": 294
  }
};
export const conceptEnemyIds = Object.freeze(Object.keys(conceptSizes));
export const enemyExpansion = Object.freeze({
  ...Object.fromEntries(Object.entries(sizes).map(([id, size]) => [id, Object.freeze({ ...size, actions, poses })])),
  ...Object.fromEntries(Object.entries(conceptSizes).map(([id, size]) => [id, Object.freeze({ ...size, actions: conceptActions, poses: conceptPoses })])),
});
