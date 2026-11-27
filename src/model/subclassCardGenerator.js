// A deterministic, export-only catalog. Subclass membership is list metadata,
// never an unregistered combat tag. Every recipe uses the existing effect DSL.
import { GenerateCardWithTarget, SeededRandom } from './cardGenerator.js';
import { scoring as defaultScoring } from '../content/generated/scoring.js';
import { EffectiveTier, ElementUnlocked, StatusUnlocked, StatusStackCapAtTier, UpgradeKindUnlocked, NumericCeilingAtTier, ZeroCostUnlocked } from './tierUnlocks.js';
import { CardDefinitionToScoreFace } from './cardUpgradeCp.js';
import { ProjectCardMechanicalValues } from './cardMechanicalProjection.js';
import { ScoreCard, CombatPower, RankOf } from './combatPower.js';
import { computeTokenBindings } from './validate/tokenBindings.js';

const definitions = [
  ['bloodletter', 'reaver', 'Bloodletter', 'Bleed pressure, wound payoffs and recovery.', 'Serrated Cut|Open the Wound|Bloodied Guard|Scent of Iron|Cruel Twist|Raking Sweep|Clotbreaker|Red Pursuit|Butcher’s Rhythm|Wound Binding|Trail of Blood|Reopened Scar|Red Harvest|Many Wounds|Final Exsanguination'],
  ['bulwark', 'reaver', 'Bulwark', 'Block, preparation and guarded reprisals.', 'Shield Advance|Set the Rampart|Iron Reprisal|Hold Formation|Bastion Bash|Covering Sweep|Brace for Impact|Shield Hook|Unyielding Rhythm|Catch Your Breath|Punish the Reckless|Interlocking Guard|Fortress Within|Siegebreaker Charge|The Wall Answers'],
  ['breaker', 'reaver', 'Breaker', 'Poise pressure and prepared heavy attacks.', 'Hammerfall|Measure the Fault|Rooted Swing|Gather Momentum|Crack the Shell|Faultline Sweep|Follow the Fracture|Overhead Commitment|Changing Weight|Recover the Haft|Collapse the Guard|Aftershock|No Time to Rise|Ruinous Descent|Executioner’s Verdict'],
  ['assassin', 'rogue', 'Assassin', 'Prepared attacks, distractions and exposed-target payoffs.', 'Quiet Incision|False Opening|Fade Behind Cover|Patient Knife|Exploit the Gap|Distracting Throw|Cut the Signal|Blindside Step|Marked for Silence|Clean Withdrawal|Borrowed Distraction|Unseen Second Blade|No Witnesses|Vanishing Assault|The Last Opening'],
  ['venomist', 'rogue', 'Venomist', 'Venom application, measured consumption and recovery.', 'Venom Nick|Coat the Edge|Antidote Guard|Distiller’s Eye|Twist the Toxin|Contaminated Fan|Toxic Rupture|Lingering Formula|Measured Doses|Extract the Dose|Cross-Contamination|Reactive Compound|Harvest the Venom|Cascade of Venom|Terminal Mixture'],
  ['duelist', 'rogue', 'Duelist', 'Counter preparation, movement and alternating attacks.', 'Testing Thrust|Read the Shoulder|Slip Aside|Find the Rhythm|Needle Riposte|Passing Cut|Turn the Blade|Inside the Guard|Alternating Tempo|Breathing Room|Punish Overreach|Feint and Return|Perfect Footwork|Dance Between Blows|Flawless Exchange'],
  ['constellation', 'starseer', 'Constellation', 'Prior spell counts and distinct-spell combinations within a turn.', 'First Light|Trace the Pattern|Warding Star|Read the Constellation|Second Star|Forked Constellation|Cross the Lines|Echoing Glyph|Celestial Cadence|Return to Origin|Missing Star|Linked Horizons|Living Star Chart|Grand Alignment|Crown of Constellations'],
  ['gravitist', 'starseer', 'Gravitist', 'Earth and force pressure, positioning and disruption.', 'Gravitic Pebble|Anchor Sigil|Orbiting Ward|Calculate the Arc|Crushing Orbit|Convergence|Repulsion Wave|Falling Trajectory|Tidal Rhythm|Weightless Interval|Interrupted Descent|Collision Course|Center of Mass|Falling Firmament|Singularity'],
  ['reservoir', 'starseer', 'Reservoir', 'Retained cards, Mana recovery and next-spell discounts this turn; no separate stored-Mana pool.', 'Banked Spark|Gather Starlight|Sheltered Flame|Quiet Observation|Open the Reservoir|Divided Release|Seal the Vessel|Measured Expenditure|Waxing Reserve|Deep Replenishment|Protect the Embers|Overflow Channel|Widen the Vessel|Unbound Radiance|Last Star Ignition'],
  ['martyr', 'herald', 'Martyr', 'Printed nonlethal HP offerings and recovery; no additional Ashen Blight price.', 'Bloodlit Rebuke|Willing Offering|Scarred Sanctuary|Read the Scars|Reclaim the Offering|Communal Suffering|Pain into Purpose|Measured Penance|Cycle of Atonement|Borrowed Tomorrow|Shared Agony|Stitch the Covenant|Witness of Wounds|Great Blood Offering|The Debt Repaid'],
  ['plaguebearer', 'herald', 'Plaguebearer', 'Crimson and Necrotic Blight with afflicted-target payoffs.', 'Blight Seed|Prepare the Vessel|Fever Ward|Study the Symptoms|Deepening Blight|Breath of Contagion|Harvest the Afflicted|Dormant Infection|Contagion Cycle|Reclaim the Rot|Withering Burden|Carrier’s Passage|Garden of Decay|Bloom of Ruin|Final Harvest'],
  ['saint', 'herald', 'Saint', 'Healing, specified-status cleansing and protective wards.', 'Kindled Rebuke|Vow of Mercy|Sanctuary Seal|Quiet Benediction|Answering Light|Circle of Shelter|Cleanse the Ash|Merciful Restraint|Litany of Grace|Renewed Conviction|Absolve the Burden|Shelter into Strength|Consecrated Ground|Radiant Reckoning|Dawn’s Verdict'],
];

export const SUBCLASS_CATALOG = Object.freeze(definitions.map(([id, classId, name, description]) => Object.freeze({ id, classId, name, description })));
const namesBySubclass = Object.fromEntries(definitions.map(([id, , , , names]) => [id, names.split('|')]));
const slug = name => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const has = (status, of = 'target') => ({ p: 'hasStatus', of, status, snapshot: 'beforePlay' });
const metric = (name, n = 1, tag) => ({ p: 'turnMetric', metric: name, atLeast: n, ...(tag ? { tag } : {}) });
const guarded = { p: 'hasBlock', of: 'self', snapshot: 'beforePlay' };
const hurt = { p: 'hpBelowPct', of: 'self', pct: 50, snapshot: 'beforePlay' };
const priorSpell = metric('previousSpell');
const spells = (n = 1) => metric('tagPlays', n, 'source:spell');
const distinct = (n = 2) => metric('distinctTagPlays', n, 'source:spell');

function recipeFor(style, index, context) {
  const { primary, tier, scoring, adaptations } = context;
  const damage = (amount = primary, condition, target = 'enemy') => ({ op: 'damage', target, amount, ...(condition ? { if: condition } : {}) });
  const block = (amount = primary, condition) => ({ op: 'block', target: 'self', amount, ...(condition ? { if: condition } : {}) });
  const fx = (op, amount = 1, condition, target = op === 'poiseDamage' ? 'enemy' : 'self') => ({ op, target, amount, ...(condition ? { if: condition } : {}) });
  const status = (id, n = 1, target = 'enemy', condition) => {
    if (!StatusUnlocked(id, tier, scoring)) {
      const locked = id;
      id = 'prepared'; target = 'self';
      return { op: 'applyStatus', target, status: id, stacks: 1, ...(condition ? { if: condition } : {}), _adaptation: `${locked} is locked at effective tier ${tier}; use Prepared on self.` };
    }
    const stacks = Math.max(1, Math.min(n, StatusStackCapAtTier(id, tier, scoring)));
    return { op: 'applyStatus', target, status: id, stacks, ...(condition ? { if: condition } : {}) };
  };
  const charge = (field, n = 2, condition) => ({ op: 'grantCardCharge', target: 'self', key: `subclass.${style}.${index}`, ...(context.magic ? { abilityKind: 'spell' } : { cardType: 'attack' }), [field]: n, ...(condition ? { if: condition } : {}) });
  const remove = (id, target = 'self', amount = 1) => ({ op: 'removeStatus', target, status: id, amount });
  const move = (bands = -1) => ({ op: 'moveEngagement', target: 'enemy', bands });
  const pay = (n = 2) => ({ op: 'loseHp', target: 'self', amount: n, nonlethal: true, offering: true });
  const all = () => damage(primary, null, 'allEnemies');
  const lowPoise = (condition) => fx('poiseDamage', 2, condition, 'enemy');
  const counter = () => fx('gainCounterStacks', 1);
  const blood = has('bleed'), venom = has('venom'), rot = has('crimsonBlight');
  let rows;
  switch (style) {
    case 'bloodletter': rows = [
      [damage(), status('bleed')], [damage(), damage(3, blood)], [block(), fx('heal', 1, blood)],
      [fx('draw'), charge('damage', 2, blood)], [damage(), lowPoise(blood)], [all(), status('bleed', 1, 'allEnemies')],
      [damage(), lowPoise(blood), remove('bleed', 'enemy')], [damage(), move()], [damage(), charge('damage', 2, metric('attacksPlayed')), status('bleed')],
      [fx('heal', 2), remove('bleed')], [damage(), fx('draw', 1, blood)], [damage(), status('bleed', 2)],
      [block(), fx('heal', 2, has('bleed', 'allEnemies'))], [all(), status('bleed', 2, 'allEnemies'), lowPoise()],
      [damage(), damage(6, blood), remove('bleed', 'enemy', 2), lowPoise()],
    ]; break;
    case 'bulwark': rows = [
      [block(), move()], [block(), status('prepared', 1, 'self')], [damage(), block(3, guarded)],
      [block(), charge('block', 2), status('prepared', 1, 'self')], [damage(), lowPoise(guarded)], [all(), block(2)],
      [block(), status('barrier', 1, 'self')], [damage(), move()], [block(), fx('draw', 1, metric('cardsPlayed', 2))],
      [block(), fx('heal', 2)], [damage(), status('weak')], [block(), counter()],
      [block(), status('stoneskin', 1, 'self')], [damage(), lowPoise(), move()], [damage(), damage(6, guarded), block(3)],
    ]; break;
    case 'breaker': rows = [
      [damage(), lowPoise()], [damage(), status('weak')], [damage(), block(2)],
      [block(), charge('break', 2)], [damage(), status('vulnerable')], [all(), fx('poiseDamage', 1, null, 'allEnemies')],
      [damage(), lowPoise(has('vulnerable'))], [damage(), status('prepared', 1, 'self')], [damage(), charge('break', 2, metric('attacksPlayed')), fx('poiseDamage', 1)],
      [block(), fx('draw')], [damage(), fx('poiseDamage', 3), status('weak')], [damage(), fx('poiseDamage', 2), charge('damage')],
      [damage(), status('staggered')], [all(), fx('poiseDamage', 3, null, 'allEnemies')], [damage(), damage(6, has('staggered')), fx('poiseDamage', 3)],
    ]; break;
    case 'assassin': rows = [
      [damage(), damage(2, { p: 'firstAttackThisCombat' })], [damage(), status('weak')], [block(), status('decoy', 1, 'self')],
      [block(), charge('damage', 3)], [damage(), damage(4, has('weak'))], [all(), status('weak', 1, 'allEnemies')],
      [damage(), status('silenced')], [damage(), move()], [block(), charge('damage', 3, has('weak'))],
      [block(), move(1), remove('weak')], [damage(), fx('draw', 1, has('weak'))], [damage(), charge('damage', 3), status('prepared', 1, 'self')],
      [all(), damage(2, has('weak'), 'allEnemies'), status('weak', 1, 'allEnemies')], [damage(), status('decoy', 1, 'self'), move(1)], [damage(), damage(6, has('weak')), status('silenced')],
    ]; break;
    case 'venomist': rows = [
      [damage(), status('venom')], [block(), { ...charge('buildup', 1), buildupStatus: 'venom' }], [block(), remove('venom')],
      [fx('draw'), charge('damage', 2, venom)], [damage(), status('venom', 1, 'enemy', venom)], [all(), status('venom', 1, 'allEnemies')],
      [damage(), damage(4, venom), remove('venom', 'enemy')], [block(), status('venom', 2)], [damage(), fx('draw', 1, metric('attacksPlayed'))],
      [fx('heal', 2, venom), remove('venom', 'enemy')], [all(), status('venom', 1, 'allEnemies', has('venom', 'allEnemies'))],
      [damage(), status('weak', 1, 'enemy', venom)], [fx('heal', 3, venom), damage(3), remove('venom', 'enemy', 2)],
      [all(), status('venom', 2, 'allEnemies')], [damage(), damage(6, venom), status('venom', 2)],
    ]; break;
    case 'duelist': rows = [
      [damage(), block(2)], [block(), status('prepared', 1, 'self')], [block(), move(1)],
      [fx('draw'), charge('damage', 2)], [damage(), counter()], [damage(), move()],
      [block(), counter()], [damage(), damage(3, guarded)], [damage(), fx('draw', 1, metric('attacksPlayed'))],
      [block(), fx('restoreStamina')], [damage(), damage(3, has('weak')), status('weak')], [block(), charge('damage', 3), status('weak')],
      [block(), status('evade', 1, 'self')], [all(), status('evade', 1, 'self')], [damage(), counter(), block(3)],
    ]; break;
    case 'constellation': rows = [
      [damage(), status('prepared', 1, 'self')], [block(), charge('damage', 2)], [block(), status('ward', 1, 'self')],
      [fx('draw'), fx('draw', 1, priorSpell)], [damage(), damage(3, priorSpell)], [all(), damage(2, spells(), 'allEnemies')],
      [damage(), status('vulnerable', 1, 'enemy', distinct())], [damage(), charge('damage', 3, priorSpell)], [block(), fx('draw', 1, spells(2))],
      [block(), fx('restoreMana', 1, priorSpell)], [damage(), fx('draw', 1, distinct())], [block(), charge('block', 3, spells(2))],
      [fx('draw'), fx('draw', 1, distinct(3)), status('ward', 1, 'self')], [all(), damage(4, distinct(2), 'allEnemies')],
      [damage(), damage(6, distinct(3)), fx('restoreMana', 1, spells(3))],
    ]; break;
    case 'gravitist': rows = [
      [damage(), status('weak')], [block(), status('prepared', 1, 'self')], [block(), status('ward', 1, 'self')],
      [fx('draw'), charge('break', 2)], [damage(), lowPoise()], [all(), { op: 'pullEnemy', target: 'enemy' }],
      [damage(), move(1)], [damage(), damage(3, { p: 'atRange', of: 'target', range: 'melee' })], [block(), charge('damage', 2, priorSpell)],
      [block(), fx('restoreMana')], [damage(), status('silenced')], [damage(), move(), fx('poiseDamage', 2)],
      [block(), status('barrier', 2, 'self')], [all(), fx('poiseDamage', 2, null, 'allEnemies')], [all(), status('weak', 2, 'allEnemies'), { op: 'pullEnemy', target: 'enemy' }],
    ]; break;
    case 'reservoir': rows = [
      [damage(), charge('manaDiscount', 1)], [block(), fx('restoreMana')], [block(), status('ward', 1, 'self')],
      [fx('draw'), charge('manaDiscount', 1, priorSpell)], [damage(), damage(3, spells(2))], [all(), charge('damage', 2)],
      [block(), status('prepared', 2, 'self')], [damage(), fx('restoreMana', 1, priorSpell)], [block(), charge('manaDiscount', 2)],
      [block(), fx('restoreMana', 2)], [block(), charge('block', 3)], [damage(), fx('draw', 1, spells(2))],
      [fx('draw'), fx('restoreMana', 2)], [all(), charge('damage', 4)], [damage(), damage(6, spells(3)), fx('restoreMana')],
    ]; break;
    case 'martyr': rows = [
      [pay(), damage(), status('vulnerable')], [pay(), block(), charge('damage', 3)], [pay(), block(), fx('heal', 1, hurt)],
      [fx('draw'), fx('draw', 1, metric('hpLostSinceTurnStart'))], [damage(), fx('heal', 2, metric('offeringsPaid'))], [pay(), all(), status('weak', 1, 'allEnemies')],
      [pay(), damage(), fx('poiseDamage', 2)], [pay(1), block(), charge('heal', 2)], [damage(), fx('heal', 2, metric('offeringsPaid', 2))],
      [pay(), fx('restoreMana'), block(3)], [pay(), all(), fx('heal', 1)], [block(), remove('weak'), fx('heal', 2)],
      [block(), fx('heal', 3, hurt)], [pay(3), all(), status('vulnerable', 2, 'allEnemies')], [damage(), fx('heal', 4, metric('hpLostSinceTurnStart', 3))],
    ]; break;
    case 'plaguebearer': rows = [
      [damage(), status('crimsonBlight')], [block(), charge('buildup', 1)], [block(), status('ward', 1, 'self')],
      [fx('draw'), fx('draw', 1, rot)], [damage(), status('crimsonBlight', 1, 'enemy', rot)], [all(), status('crimsonBlight', 1, 'allEnemies')],
      [damage(), fx('heal', 2, rot)], [block(), status('necroticBlight')], [damage(), charge('damage', 3, rot), status('crimsonBlight')],
      [fx('heal', 3, rot), remove('crimsonBlight', 'enemy')], [damage(), status('weak', 1, 'enemy', rot)], [block(), move(1), remove('weak')],
      [block(), fx('heal', 2, has('crimsonBlight', 'allEnemies')), status('necroticBlight')], [all(), status('crimsonBlight', 2, 'allEnemies')],
      [damage(), damage(6, rot), fx('heal', 3, rot)],
    ]; rows = rows.map(row => row.map(e => e.op === 'grantCardCharge' && e.buildup ? { ...e, buildupStatus: 'crimsonBlight' } : e)); break;
    case 'saint': rows = [
      [damage(), fx('heal')], [block(), charge('heal', 2)], [block(), status('ward', 1, 'self')],
      [fx('heal', 2), fx('draw')], [damage(), fx('heal', 2, hurt)], [block(), status('barrier', 1, 'self')],
      [block(), remove('weak')], [damage(), status('weak')], [block(), charge('heal', 3, priorSpell)],
      [fx('heal', 2), fx('restoreMana')], [block(), remove('frail'), remove('venom')], [damage(), block(3, guarded)],
      [block(), status('regen', 1, 'self')], [all(), fx('heal', 3)], [damage(), fx('heal', 4), remove('weak')],
    ]; break;
    default: throw new Error(`Unknown subclass '${style}'`);
  }
  return rows[index].map(effect => {
    const { _adaptation, ...legalEffect } = effect;
    if (_adaptation) adaptations.push(_adaptation);
    return legalEffect;
  });
}

function conditionText(pred) {
  if (pred.p === 'hasStatus') return `${pred.of === 'self' ? 'you had' : pred.of === 'allEnemies' ? 'a living enemy had' : 'the target had'} ${pred.status} before play`;
  if (pred.p === 'hasBlock') return 'you had Block before play';
  if (pred.p === 'hpBelowPct') return 'you were at half HP or lower before play';
  if (pred.p === 'firstAttackThisCombat') return 'this is your first attack this fight';
  if (pred.p === 'atRange') return 'the target is in melee range';
  const n = pred.atLeast;
  const descriptions = {
    previousSpell: 'your previous card this turn was a spell',
    tagPlays: `you played at least ${n} earlier spell${n === 1 ? '' : 's'} this turn`,
    distinctTagPlays: `you played at least ${n} distinct earlier spells this turn`,
    attacksPlayed: `you played at least ${n} earlier attack${n === 1 ? '' : 's'} this turn`,
    cardsPlayed: `you played at least ${n} earlier cards this turn`,
    hpLostSinceTurnStart: `you lost at least ${n} HP since your turn began`,
    offeringsPaid: `you paid at least ${n} HP offering${n === 1 ? '' : 's'} this turn`,
  };
  return descriptions[pred.metric];
}

function textFor(effects, keywords) {
  const bindings = computeTokenBindings(effects);
  const token = (i, field = 'amount') => `{${bindings.find(b => b.index === i && b.field === field)?.token}}`;
  const words = effects.map((e, i) => {
    const amount = token(i), all = e.target === 'allEnemies' ? ' to all enemies' : '';
    let text;
    switch (e.op) {
      case 'damage': text = `Deal ${amount} damage${all}`; break;
      case 'block': text = `Gain ${amount} Block`; break;
      case 'poiseDamage': text = `Deal ${amount} Poise damage${all}`; break;
      case 'draw': text = `Draw ${amount} card`; break;
      case 'heal': text = `Heal ${amount} HP`; break;
      case 'restoreMana': text = `Restore ${amount} Mana`; break;
      case 'restoreStamina': text = `Restore ${amount} Stamina`; break;
      // This opcode is not part of the shared token vocabulary. Its authored
      // count is stated literally, and upgrades regenerate this sentence.
      case 'gainCounterStacks': text = `Gain ${e.amount} Counter stack`; break;
      case 'gainBarrier': text = `Gain ${amount} Bonus Poise`; break;
      case 'gainWard': text = `Gain ${amount} Ward`; break;
      case 'restorePoise': text = `Restore ${amount} Poise`; break;
      case 'applyReflect': text = `Gain ${amount} Reflect`; break;
      case 'applyStatus': text = `${e.target === 'self' ? 'Gain' : 'Apply'} ${token(i, 'stacks')} ${e.status}${all}`; break;
      case 'removeStatus': text = `Remove ${amount} ${e.status} ${e.target === 'self' ? 'from yourself' : 'from the target'}`; break;
      case 'moveEngagement': text = e.bands < 0 ? 'Close one band toward the target' : 'Push the target one band away'; break;
      case 'pullEnemy': text = 'Pull the selected enemy forward'; break;
      case 'loseHp': text = `Pay ${amount} HP nonlethally`; break;
      case 'grantCardCharge': {
        const field = ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup'].find(k => e[k] !== undefined);
        const value = token(i, field);
        const label = { damage: 'damage', manaDiscount: 'Mana discount', block: 'Block', heal: 'healing', break: 'Poise damage', buildup: `${e.buildupStatus} buildup` }[field];
        const subject = `Your next ${e.abilityKind === 'spell' ? 'spell' : 'attack'} this turn`;
        text = field === 'manaDiscount' ? `${subject} costs ${value} less Mana, minimum zero` : field === 'buildup' ? `${subject} applies ${value} additional ${label}` : `${subject} increases its existing ${label} by ${value} if it has that effect`;
        text += '; this charge does not stack with itself';
        break;
      }
      default: throw new Error(`Missing recipe text for ${e.op}`);
    }
    return (e.if ? `If ${conditionText(e.if)}, ${text[0].toLowerCase()}${text.slice(1)}` : text) + '.';
  });
  return [...words, ...keywords.map(k => `${k[0].toUpperCase()}${k.slice(1)}.`)].join(' ');
}

/** Rebuild semantic text after authoring an existing recipe's effect values. */
export const SubclassCardText = (effects, keywords = []) => textFor(effects, keywords);

// The authored first upgrade is an existing engine feature. Prefer the
// subclass's conditional or charge payload; otherwise improve a legal existing
// effect or add one draw. Never alter a condition or invent an upgrade opcode.
function withinMechanicalCeilings(projected, tier, scoring) {
  const totals = { damage: 0, block: 0 };
  for (const effect of projected.effects || []) {
    if (effect.op in totals) totals[effect.op] += (effect.amount || 0) * (effect.op === 'damage' ? Math.max(1, effect.hits || 1) : 1) * Math.max(1, effect.repeat || 1);
    if (effect.op === 'grantCardCharge') for (const op of ['damage', 'block']) totals[op] += effect[op] || 0;
    if (effect.op === 'applyStatus' && (!StatusUnlocked(effect.status, tier, scoring) || effect.stacks > StatusStackCapAtTier(effect.status, tier, scoring))) return false;
    if (effect.op === 'grantCardCharge' && effect.buildupStatus && effect.buildup > StatusStackCapAtTier(effect.buildupStatus, tier, scoring)) return false;
  }
  return Object.entries(totals).every(([op, value]) => value <= NumericCeilingAtTier(op, tier, scoring));
}

function signatureUpgrade(card, requestedRank, tier, scoring) {
  const baseline = ProjectCardMechanicalValues(card).card;
  const candidates = [];
  for (const [index, effect] of card.effects.entries()) {
    if (effect.op === 'grantCardCharge') {
      const field = ['damage', 'block', 'heal', 'break', 'buildup', 'manaDiscount'].find(key => effect[key] !== undefined);
      if (field) candidates.push({ index, field });
    } else if (effect.op === 'applyStatus') candidates.push({ index, field: 'stacks' });
    else if (['damage', 'block', 'poiseDamage', 'heal'].includes(effect.op) && Number.isFinite(effect.amount)) candidates.push({ index, field: 'amount' });
  }
  candidates.sort((a, b) => {
    const priority = candidate => card.effects[candidate.index].op === 'grantCardCharge' ? 0 : card.effects[candidate.index].if ? 1 : card.effects[candidate.index].op === 'applyStatus' ? 2 : 3;
    return priority(a) - priority(b);
  });
  const primaryKind = card.effects.find(effect => ['damage', 'block', 'heal'].includes(effect.op) && !effect.if)?.op;
  if (primaryKind) candidates.push({ index: card.effects.length, field: primaryKind, addCharge: true });
  if (UpgradeKindUnlocked('fx:draw', tier, scoring)) candidates.push({ index: card.effects.length, field: 'amount', addDraw: true });
  for (const candidate of candidates) for (let increase = 1; increase <= (candidate.addCharge || candidate.addDraw ? 1 : 32); increase++) {
    const effects = structuredClone(card.effects);
    if (candidate.addCharge) effects.push({ op: 'grantCardCharge', target: 'self', key: `${card.id}.signature`, ...(card.abilityKind === 'spell' ? { abilityKind: 'spell' } : { cardType: 'attack' }), [candidate.field]: 1 });
    else if (candidate.addDraw) effects.push({ op: 'draw', target: 'self', amount: 1 });
    else effects[candidate.index][candidate.field] += increase;
    const projected = ProjectCardMechanicalValues({ ...card, effects }).card;
    if (!withinMechanicalCeilings(projected, tier, scoring)) break;
    // An authored +1 can round to exactly the same displayed/mechanical value.
    // Advance to the first real improvement instead of offering a no-op upgrade.
    if (JSON.stringify(projected.effects) === JSON.stringify(baseline.effects)) continue;
    const raw = ScoreCard(CardDefinitionToScoreFace(projected, { scoring }), scoring).raw;
    const cp = CombatPower(raw, card.rarity, scoring);
    if (RankOf(cp, scoring) > requestedRank) break;
    return { upgrade: { name: `${card.name}+`, effects, textTemplate: textFor(effects, card.keywords) },
      detail: { effectIndex: candidate.index, field: candidate.field, increase, addedCharge: !!candidate.addCharge, addedDraw: !!candidate.addDraw, projectedRaw: raw, projectedCp: cp, projectedRank: RankOf(cp, scoring) } };
  }
  return null;
}

/** Rebase the authored upgrade after an editor changes the base definition. */
export function RefreshSubclassCard(card, { scoring = defaultScoring, requestedRank, rebuildText = true } = {}) {
  const next = structuredClone(card);
  if (!next.id?.startsWith('subclass.')) return next;
  const raw = ScoreCard(CardDefinitionToScoreFace(next, { scoring }), scoring).raw;
  const rank = requestedRank ?? Math.max(1, RankOf(CombatPower(raw, next.rarity, scoring), scoring));
  const tier = EffectiveTier(rank, next.rarity, scoring);
  if (rebuildText) next.textTemplate = textFor(next.effects, next.keywords || []);
  delete next.upgrade;
  const authored = signatureUpgrade(next, rank, tier, scoring);
  if (authored) next.upgrade = authored.upgrade;
  next.upgradeMenu = (next.upgradeMenu || []).filter(kind => UpgradeKindUnlocked(kind, tier, scoring));
  return next;
}

const skillIndexes = new Set([2, 3, 9, 12]);
const schoolFor = { constellation: 'frost', gravitist: 'earth', reservoir: 'frost', martyr: 'divine', plaguebearer: 'decay', saint: 'divine' };
const identityFor = {
  bloodletter: ['blood', 'theme:blood'], bulwark: ['guard', 'theme:stance'], breaker: ['heavy', 'theme:stance'],
  assassin: ['guile'], venomist: ['venom'], duelist: ['flourish', 'theme:stance'],
  constellation: ['starstone', 'theme:astral'], gravitist: ['starstone', 'theme:astral'], reservoir: ['starstone', 'theme:astral'],
  martyr: ['ritual', 'theme:blood'], plaguebearer: ['blight', 'theme:blight'], saint: ['oath', 'theme:oath'],
};
const upgradeKinds = ['dmg', 'blk', 'poise', 'stk', 'cost', 'fx:draw', 'fx:block', 'fx:heal', 'fx:cleanse', 'fx:retain'];

function makeCard(row, index, criteria, scoring) {
  const name = namesBySubclass[row.id][index];
  const rarity = index < 8 ? 'common' : index < 13 ? 'uncommon' : 'rare';
  const requestedRank = criteria.rank ?? (rarity === 'rare' ? 5 : rarity === 'uncommon' ? 3 : 2);
  const tier = EffectiveTier(requestedRank, rarity, scoring), adaptations = [];
  const magic = row.classId === 'starseer' || row.classId === 'herald';
  let school = schoolFor[row.id] || 'none';
  if (!ElementUnlocked(school, tier, scoring)) {
    adaptations.push(`${school} is locked at effective tier ${tier}; use an untyped spell.`);
    school = 'none';
  }
  const id = `subclass.${row.id}.${slug(name)}`;
  const rng = SeededRandom(`${criteria.seed ?? 1}|${id}`);
  const type = skillIndexes.has(index) ? 'skill' : 'attack';
  const generated = GenerateCardWithTarget({ cls: row.classId, rank: requestedRank, rarity, seed: `${criteria.seed ?? 1}.${row.id}.${index}`, camp: magic ? 'spell' : 'physical', type, school, sp: 1, mp: magic ? 1 : 0, riders: [], enforceTierUnlocks: true }, { scoring, applyNaming: false });
  const card = generated.card;
  card.id = id; card.name = name;
  delete card._cpMiss; delete card.flavor;
  card.abilityKind = magic ? 'spell' : 'maneuver';
  card.abilityFamily = id;
  if (magic) card.tags = card.tags.filter(tag => !tag.startsWith('tradition:')).concat(row.classId === 'herald' ? 'tradition:divine' : 'tradition:arcane');
  card.keywords = row.id === 'reservoir' && [0, 3, 6, 8, 10, 12].includes(index) && UpgradeKindUnlocked('fx:retain', tier, scoring) ? ['retain'] : [];
  if (row.id === 'reservoir' && [0, 3, 6, 8, 10, 12].includes(index) && !card.keywords.length) adaptations.push('Retain is locked; this version keeps its printed recovery or charge only.');
  card.effects = recipeFor(row.id, index, { primary: 2 + Math.floor(rng() * 3), tier, scoring, adaptations, magic });
  if (card.effects.some(effect => effect.target === 'allEnemies')) {
    if (UpgradeKindUnlocked('targeting', tier, scoring)) card.tags.push('targeting:area');
    else {
      for (const effect of card.effects) if (effect.target === 'allEnemies') effect.target = 'enemy';
      adaptations.push('Area targeting is locked; this version affects the selected enemy.');
    }
  }
  // A setup-only recipe retains its original setup and gains a scalable guard;
  // do not inflate card draw or Mana discounts just to fill a power budget.
  if (!card.effects.some(effect => ['damage', 'block', 'heal'].includes(effect.op) && !effect.if)) card.effects.unshift({ op: 'block', target: 'self', amount: 1 });
  card.type = card.effects.some(effect => effect.op === 'damage' && !effect.if) ? 'attack' : 'skill';
  card.icon = card.type === 'attack' ? 'attack' : 'shield';
  card.tags = card.tags.filter(tag => !tag.startsWith('classification.') && !tag.startsWith('maneuver:'))
    .concat(`classification.${card.type}`, magic ? 'maneuver:casting' : `maneuver:${card.type === 'attack' ? 'attack' : 'defend'}`, ...identityFor[row.id], ...(!magic ? ['source:weapon'] : []));
  if (card.effects.some(effect => effect.op === 'damage')) {
    card.damageSchool = magic ? 'magic' : 'physical';
    card.exposureBuildupPerHit = magic ? 5 : 0;
  }
  const primaryIndex = card.effects.findIndex(effect => ['damage', 'block', 'heal'].includes(effect.op) && !effect.if);
  // Search numeric power/cost only. The signature effects are never dropped to
  // meet a target. A miss is reported in metadata, not hidden with a score pin.
  // Leave room for the authored signature upgrade inside the same rank.
  const targetCp = (requestedRank - 1) * scoring.rank.width + 1 + Math.floor(rng() * Math.min(2, scoring.rank.width));
  let best, bestDistance = Infinity;
  const originalEffects = structuredClone(card.effects);
  for (let sp = 0; sp <= 3; sp++) for (let mp = 0; mp <= (magic ? 3 : 0); mp++) {
    if (sp === 0 && mp === 0 && !ZeroCostUnlocked(tier, scoring)) continue;
    card.cost = card.staminaCost = sp; card.manaCost = mp;
    // The authored amount is a model input, not displayed damage/Block. Search
    // a bounded raw range, enforcing ceilings only after mechanical projection.
    // Power is monotone in this one existing primary; binary search also finds
    // the lower edge of rounded plateaus without hundreds of engine projections.
    let lower = 1, upper = primaryIndex < 0 ? 1 : 240;
    while (lower <= upper) {
      const amount = Math.floor((lower + upper) / 2);
      if (primaryIndex >= 0) card.effects[primaryIndex].amount = amount;
      const projected = ProjectCardMechanicalValues(card).card;
      const legal = withinMechanicalCeilings(projected, tier, scoring);
      const raw = ScoreCard(CardDefinitionToScoreFace(projected, { scoring }), scoring).raw;
      const cp = CombatPower(raw, rarity, scoring), distance = Math.abs(cp - targetCp);
      if (legal && RankOf(cp, scoring) <= requestedRank && (distance < bestDistance || distance === bestDistance && best?.sp === sp && best?.mp === mp && amount < best.amount)) {
        bestDistance = distance; best = { sp, mp, amount, raw, cp };
      }
      if (!legal || cp >= targetCp) upper = amount - 1;
      else lower = amount + 1;
    }
    // When a cap prevents the exact target, the nearest CP can occupy several
    // rounded amounts. Keep its lowest input so an actual upgrade has headroom.
    if (best?.sp === sp && best?.mp === mp && primaryIndex >= 0) {
      let first = 1, last = best.amount;
      while (first <= last) {
        const amount = Math.floor((first + last) / 2);
        card.effects[primaryIndex].amount = amount;
        const projected = ProjectCardMechanicalValues(card).card;
        const raw = ScoreCard(CardDefinitionToScoreFace(projected, { scoring }), scoring).raw;
        const cp = CombatPower(raw, rarity, scoring);
        if (withinMechanicalCeilings(projected, tier, scoring) && cp === best.cp) { best = { ...best, amount, raw }; last = amount - 1; }
        else if (cp < best.cp) first = amount + 1;
        else last = amount - 1;
      }
    }
  }
  if (!best) throw new Error(`${name}: its signature cannot fit the rank ${requestedRank} ceilings; choose a higher rank or revise the scoring table.`);
  card.effects = originalEffects;
  if (primaryIndex >= 0) card.effects[primaryIndex].amount = best.amount;
  card.cost = card.staminaCost = best.sp; card.manaCost = best.mp;
  card.textTemplate = textFor(card.effects, card.keywords);
  delete card.faceTemplate;
  card.upgradeMenu = upgradeKinds.filter(kind => UpgradeKindUnlocked(kind, tier, scoring)
    && (kind !== 'dmg' || card.effects.some(e => e.op === 'damage' && !e.if))
    && (kind !== 'blk' || card.effects.some(e => e.op === 'block' && !e.if))
    && (kind !== 'poise' || card.effects.some(e => e.op === 'poiseDamage' && !e.if))
    && (kind !== 'stk' || card.effects.some(e => e.op === 'applyStatus'))
    && (kind !== 'fx:retain' || row.id === 'reservoir')
    && (!['fx:heal', 'fx:cleanse'].includes(kind) || ['bloodletter', 'martyr', 'plaguebearer', 'saint'].includes(row.id)));
  const authored = signatureUpgrade(card, requestedRank, tier, scoring);
  if (authored) card.upgrade = authored.upgrade;
  else adaptations.push(`No legal signature upgrade fits Rank ${requestedRank} and its mechanical tier ${tier} ceilings. Raise the requested rank or rarity to allow an upgrade.`);
  if (RankOf(best.cp, scoring) !== requestedRank) adaptations.push(`Requested Rank ${requestedRank} is infeasible for this signature at the selected rarity and mechanical ceilings; closest legal result is CP ${best.cp}, Rank ${RankOf(best.cp, scoring)}. Raise rank or rarity, or revise the signature.`);
  return { card, metadata: { cardId: id, requestedRank, effectiveTier: tier, targetCp, projectedRaw: best.raw, projectedCp: best.cp, projectedRank: RankOf(best.cp, scoring), miss: bestDistance !== 0, adaptations, upgradeMenu: [...card.upgradeMenu], ...(authored ? { signatureUpgrade: authored.detail } : {}) } };
}

/** Generate an exportable catalog; no source files, registries or reward pools are changed. */
export function GenerateSubclassCatalog(criteria = {}, { scoring = defaultScoring } = {}) {
  if (criteria.rank !== undefined && (!Number.isInteger(criteria.rank) || criteria.rank < 1 || criteria.rank > 5)) throw new Error('Subclass rank must be an integer from 1 to 5');
  const count = criteria.countPerSubclass ?? 15;
  if (!Number.isInteger(count) || count < 1 || count > 15) throw new Error('countPerSubclass must be an integer from 1 to 15');
  const requested = criteria.subclassIds ?? SUBCLASS_CATALOG.map(row => row.id);
  if (!Array.isArray(requested) || !requested.length || requested.some(id => !SUBCLASS_CATALOG.some(row => row.id === id))) throw new Error('subclassIds must name known subclasses');
  const selected = SUBCLASS_CATALOG.filter(row => requested.includes(row.id));
  const cards = [], lists = [], metadata = [];
  for (const row of selected) {
    const cardIds = [];
    for (let index = 0; index < count; index++) {
      const result = makeCard(row, index, criteria, scoring);
      cards.push(result.card); metadata.push(result.metadata); cardIds.push(result.card.id);
    }
    lists.push({ id: row.id, classId: row.classId, name: row.name, cardIds });
  }
  return { formatVersion: 1, kind: 'ashenspire.subclassCatalog', seed: criteria.seed ?? 1, cards, lists, metadata,
    summary: { cardCount: cards.length, subclassCount: lists.length, scoring: 'Projected with the shared definition scorer; conditions and next-card payoffs are estimates, not a combat guarantee. A capped recipe may score below its requested rank; metadata reports every target miss.', missCount: metadata.filter(row => row.miss).length } };
}
