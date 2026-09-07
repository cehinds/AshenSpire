// Presentation only. Tag IDs are the live vocabulary in content/source/tags.csv.
// First matching row wins regardless of the incoming tag order. Bookkeeping
// tags (basic, extractable) deliberately do not imply an animation.
export const ACTION_ANIMATION_TAGS = Object.freeze([
  ['guard', 'guard'], ['ranged', 'projectile'], ['pierce', 'thrust'],
  ['starstone', 'spell'], ['ritual', 'spell'], ['gorefire', 'spell'],
  ['blight', 'spell'], ['oath', 'spell'], ['ash', 'spell'],
  ['heavy', 'strike'], ['blade', 'slash'], ['flourish', 'slash'],
  ['precision', 'thrust'], ['guile', 'dodge'], ['venom', 'spell'], ['blood', 'slash'],
].map(Object.freeze));
export const ACTION_ANIMATION_TYPES = Object.freeze({ attack: 'strike', block: 'guard', buff: 'spell', debuff: 'spell', power: 'spell' });
export const ACTION_ANIMATION_FAMILIES = Object.freeze({
  neutral: Object.freeze({ pose: 'idle', motion: 'settle' }),
  slash: Object.freeze({ pose: 'attack1', motion: 'sweep' }),
  thrust: Object.freeze({ pose: 'attack2', motion: 'lunge' }),
  strike: Object.freeze({ pose: 'attack3', motion: 'impact' }),
  projectile: Object.freeze({ pose: 'attack4', motion: 'release' }),
  spell: Object.freeze({ pose: 'guard', motion: 'cast' }),
  guard: Object.freeze({ pose: 'guard', motion: 'brace' }),
  // No dodge sprite exists in the shipped pose strip: use idle and let the
  // consuming presentation animate a sidestep rather than request a fake frame.
  dodge: Object.freeze({ pose: 'idle', motion: 'sidestep' }),
});
const player = (spriteClass, tempo, reach, attacks = {}) => Object.freeze({
  spriteClass, tempo, reach,
  actions: Object.freeze({ dodgeRoll: 'dodge', defend: 'guard', ...attacks }),
});
const enemy = (tempo, reach, actions) => Object.freeze({ spriteClass: null, tempo, reach, actions: Object.freeze(actions) });
export const ACTION_ANIMATION_ACTORS = Object.freeze({
  reaver: player('reaver', 1.12, 1.1, { strike: 'slash' }),
  rogue: player('rogue', 0.78, 1.15, { strike: 'thrust' }),
  starseer: player('starseer', 1.05, 0.75),
  herald: player('herald', 1.15, 0.8),
  wanderingSoldier: Object.freeze({ spriteClass: null, tempo: 1, reach: 0.9, actions: Object.freeze({ slash: 'slash', guard: 'guard', warcry: 'spell' }) }),
  blightHound: Object.freeze({ spriteClass: null, tempo: 0.72, reach: 1.25, actions: Object.freeze({ bite: 'strike', lunge: 'thrust' }) }),
  fellWarden: Object.freeze({ spriteClass: null, tempo: 1.3, reach: 1.15, actions: Object.freeze({ caneStrike: 'strike', hammerToss: 'projectile', heldBlade: 'slash', twinDaggers: 'thrust' }) }),
  lanternMoth: enemy(0.68, 0.55, { lanternDust: 'spell', wingSparks: 'projectile' }),
  briarHermit: enemy(1.18, 0.65, { rootShelter: 'guard', briarCast: 'projectile', sapMend: 'spell' }),
  chainScavenger: enemy(0.95, 1.25, { hookCast: 'projectile', chainSnare: 'spell', draggingBlow: 'strike' }),
  bellKeeper: enemy(1.4, 0.85, { bronzeToll: 'spell', clapperSwing: 'slash', muffledPrayer: 'guard', crackedPeal: 'spell' }),
  thornMatriarch: enemy(1.3, 0.8, { rootCrown: 'guard', thornNeedles: 'projectile', entwiningRoots: 'spell' }),
  mirrorScribe: enemy(0.9, 0.6, { silverScript: 'spell', shardVolley: 'projectile', polishedWard: 'guard' }),
  stitchCrab: enemy(0.75, 0.85, { shellFold: 'guard', seamShears: 'slash', scuttleRush: 'thrust' }),
  glassRegent: enemy(1.02, 1.2, { prismGuard: 'guard', crystalRapier: 'thrust', splinterRain: 'projectile', shatteredCourt: 'spell' }),
  marrowOrganist: enemy(1.35, 0.55, { bonePrelude: 'spell', ivoryKeys: 'projectile', funeralChord: 'spell', quietRefrain: 'spell' }),
  cinderMantis: enemy(0.7, 1.3, { scythePair: 'slash', emberPounce: 'thrust', foldedBlades: 'guard' }),
  eclipseCantor: enemy(1.1, 0.5, { darkHymn: 'spell', lunarRay: 'projectile', fadingEcho: 'spell' }),
  furnaceSaint: enemy(1.45, 1.05, { openFurnace: 'projectile', censerSweep: 'slash', coolingAsh: 'guard' }),
  hollowAstronomer: enemy(1.25, 0.7, { starChart: 'spell', orbitalShards: 'projectile', totalEclipse: 'spell', fallingHeavens: 'projectile' }),
  ashheartDragon: enemy(1.2, 1.4, { obsidianClaws: 'slash', tailBastion: 'guard', heartRumble: 'spell', ashBreath: 'projectile' }),
});
