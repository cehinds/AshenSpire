import { ENEMY_POSES } from './enemyArt.js';

// One held frame per planned action category, selected per enemy after contact-sheet
// review. Counter is additive and never replaces the executed counterattack clip.
export const ENEMY_STANCE_FAMILIES = Object.freeze(['smash', 'attack', 'counter', 'sweep', 'defend', 'preparing']);
const selections = {
  "wanderingSoldier": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "preparing"
  },
  "blightHound": {
    "smash": "stance-smash",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "huskBrute": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "graveWisp": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "wyrmAspirant": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "fellWarden": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "lanternMoth": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "briarHermit": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "preparing"
  },
  "chainScavenger": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "bellKeeper": {
    "smash": "attack-01",
    "attack": "counterattack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "thornMatriarch": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "gildedKnight": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "courtSurgeon": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "stitchedHound": {
    "smash": "stance-smash",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "stance-sweep",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "courtMarionette": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "livingArmor": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "preparing"
  },
  "courtDuelist": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "stitchedKing": {
    "smash": "attack-01",
    "attack": "counterattack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "mirrorScribe": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "stitchCrab": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "glassRegent": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "marrowOrganist": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "ashRevenant": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "emberStarvedPilgrim": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "valkyrieShade": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "charredColossus": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "wyrmLord": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "blightedValkyrie": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "cinderMantis": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "eclipseCantor": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "preparing"
  },
  "furnaceSaint": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "hollowAstronomer": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  },
  "ashheartDragon": {
    "smash": "attack-01",
    "attack": "attack-02",
    "counter": "stance-counter",
    "sweep": "sweep-01",
    "defend": "block-01",
    "preparing": "magic-01"
  }
};
export const enemyStanceSprites = Object.freeze(Object.fromEntries(ENEMY_POSES.map(id => [id, Object.freeze(selections[id])])));
export const enemyStanceAssets = Object.freeze(Object.fromEntries(ENEMY_POSES.map(id => [id,
  Object.freeze(Object.fromEntries(Object.entries(enemyStanceSprites[id]).map(([category, pose]) =>
    [category, `assets/enemy-poses/expansion/${id}/${pose}.webp`])))])));
