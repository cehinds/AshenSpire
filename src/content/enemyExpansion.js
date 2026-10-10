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
    "idleWidth": 347,
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
export const enemyExpansion = Object.freeze(Object.fromEntries(Object.entries(sizes).map(([id, size]) => [id, Object.freeze({ ...size, actions, poses })])));
