import { contentBundle } from '../../content/index.js';
import { WIREFRAME_CHOICE_GROUPS } from './WireframeChoiceModel.js';

// Presentation only: every setting keeps its existing key and value semantics.
const words = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\./g, ' ').replace(/^./, c => c.toUpperCase());

// ONE MENU DRIVES STARTING STATS (owner, 2026-09-20). "Class defaults should
// be in Progression"; "changing class defaults and starting stats seem to be
// in multiple menus instead of having just one driver". So the Classes tab is
// gone and everything that decides the points a new character opens with —
// the creation pool, each class's table, level-up, the tier size — is filed
// under Progression, in that reading order.
//
// ONE HOME PER SETTING (owner, 2026-09-23). The model files each row
// (`advancedGroup`); the exceptions below are the presentation rows whose one
// model group, Interface, spans three tabs.
const BATTLEFIELD = /^gameConfig\.presentation\.(?!settings(Width|Height)Percent$)/;
export function advancedSection(row) {
  if (row.key === 'creationAutoAdvance') return 'Progression';
  if (/^gameConfig\.presentation\.settings(Width|Height)Percent$/.test(row.key) || row.key === 'uprightGate') return 'Wireframes';
  if (BATTLEFIELD.test(row.key)) return 'Battlefield';
  return row.advancedGroup || 'Interface';
}

// The subsections that hold every row whose quantity another row replaces
// while a switch is on. Named once: `statsSection` files into them and
// `advancedSubgroups` draws them after every row that is in force.
export const WITHOUT_RATINGS = 'Without ratings (legacy poise)';
export const DRAW_FALLBACK = 'Co-op & legacy fallback';

// ---- ONE TOPIC PER TRAIT (owner, 2026-09-21) --------------------------------
//
// "I'm editing the same thing in multiple locations … think 3NF but for the
// menus", and "stat conversion should be its own section under stats, and have
// sub sections for actions, draw, hp, stamina mana, etc, but it should include
// everything pertaining to that trait instead of in 5 different menus".
// Actions, Draw, HP, Stamina, Mana, Poise and Ward were spread over Hand &
// Draw, Stats & Defence, Progression → Stats & resources and the Combat
// constants. They are one Advanced → Stats tab: a topic per trait, each with
// every row that decides it, drawn in short subsections.
const DERIVED_TOPICS = Object.freeze({ energy: 'Actions', draw: 'Draw & hand', hp: 'HP', stamina: 'Stamina', mana: 'Mana', poise: 'Poise' });
const RATING_TOPICS = Object.freeze({ ar: 'Attack rating (AR)', dr: 'Defence rating (DR)', pr: 'Power rating (PR)', poise: 'Poise', ward: 'Ward' });

/** The Stats topics, in reading order: resources first, then the ratings, then the tables. */
export const STATS_TOPICS = Object.freeze([
  'Overview', 'Actions', 'Draw & hand', 'HP', 'Stamina', 'Mana', 'Poise', 'Ward',
  'Attack rating (AR)', 'Defence rating (DR)', 'Power rating (PR)',
  'Resistance', 'Impact', 'Breaks', 'Status resistance', 'Status bonuses',
]);

// Subsections inside a Stats topic, in the order they are drawn. A topic
// shows only the ones it has rows for.
const STATS_SECTIONS = Object.freeze([
  'Ratings', 'Rating formula', 'Formula', 'Level growth',
  'Starting hand', 'Turn draws', 'Hand capacity', 'Retention & discards', DRAW_FALLBACK,
  'Resistance & breaks', 'Mana cards', WITHOUT_RATINGS,
]);

const statsPath = (row) => row.key.replace(/^gameConfig\.(balance\.)?/, '');

function statsTopic(row) {
  const path = statsPath(row);
  if (row.derivedStatId) return DERIVED_TOPICS[row.derivedStatId] || words(row.derivedStatId);
  if (row.handTopic || path === 'handMax') return 'Draw & hand';
  if (/^(poise|stagger)\./.test(path)) return 'Poise';
  if (/^mana\./.test(path)) return 'Mana';
  const rating = /^combatRatings\.ratings\.(\w+)\./.exec(path);
  if (rating) return RATING_TOPICS[rating[1]] || words(rating[1]);
  if (/^combatRatings\.(resistance\.physicalK|breaks\.poiseActionLoss)$/.test(path)) return 'Poise';
  if (/^combatRatings\.(resistance\.magicalK|breaks\.wardActionLoss)$/.test(path)) return 'Ward';
  if (!row.statTopic || row.statTopic === 'General') return 'Overview';
  return row.statTopic;
}

/**
 * statsSection(row) → the subsection heading a Stats row is drawn under, or
 * null for a topic that is one flat list (the per-item tables).
 */
export function statsSection(row) {
  const path = statsPath(row);
  if (row.derivedStatId === 'poise' || /^(poise|stagger)\./.test(path)) return WITHOUT_RATINGS;
  if (row.derivedStatId === 'draw' || path === 'handMax') return DRAW_FALLBACK;
  if (row.settingSection) return row.settingSection;
  if (/^mana\./.test(path)) return 'Mana cards';
  if (/^combatRatings\.(enabled|multiplier)$/.test(path)) return 'Ratings';
  if (/^combatRatings\.ratings\./.test(path)) return 'Rating formula';
  if (/^combatRatings\.(resistance\.(physicalK|magicalK)|breaks\.(poise|ward)ActionLoss)$/.test(path)) return 'Resistance & breaks';
  return null;
}

// ---- ONE READING ORDER FOR THE WHOLE CLIMB (owner, 2026-09-21, #1253) -------
//
// "I want level up and starting stats to be together too": what a character
// opens with, then what a level adds, with nothing between them. What every
// point of every attribute is worth is a topic per trait under Stats, each
// with its own growth per level. The floors and the per-class tables follow,
// because they are bounded by the two above rather than read alongside them.
const PROGRESSION_TOPIC_ORDER = Object.freeze([
  'Assign points',
  'Level-up',
  'Equipment requirements',
]);

/**
 * The class topics, in the order the content bundle lists its classes.
 *
 * DERIVED, NOT TRANSCRIBED. `classTopic` on each row is `classDef.name`; four
 * names typed out here meant a renamed or added class kept its full label and
 * sorted after the named topics, with nothing failing. The naming rule is the
 * one `advancedConfigRows` uses for a class with no name.
 */
export const CLASS_TOPICS = Object.freeze((contentBundle.classes || [])
  .map((classDef) => classDef.name
    || String(classDef.id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())));

function relicTopic(path) {
  const effect = path.split('.').at(-1);
  if (/heal|restore/.test(effect)) return 'Relics · recovery';
  if (/block/.test(effect)) return 'Relics · defence';
  if (/draw|gainEnergy|^n$/.test(effect)) return 'Relics · resources';
  if (/strength|damage|poiseDamage/.test(effect)) return 'Relics · damage';
  return 'Relics · effects';
}

function talentTopic(path) {
  if (/ironFooting|bloodTempo|ashenReserve|grimHarvest|warlord|bulwarkKing/.test(path)) return 'Talents · Reaver';
  if (/attunedMind|starlitFocus|lodestarCap|arcaneDraw|conduit|reservoir/.test(path)) return 'Talents · Starseer';
  if (/warmth|vigil|sealOfPlenty|wakingRot|martyr|saint/.test(path)) return 'Talents · Herald';
  return 'Talents · Rogue';
}

function topic(row, section) {
  if (section === 'Stats') return statsTopic(row);
  const key = row.key;
  const path = key.replace(/^gameConfig\.(balance\.)?/, '');
  // A row that names its own topic is filed under it. The Wireframes rows are
  // generated from one catalogue (models/WireframeChoiceModel.js) whose groups
  // ARE the topics — Modals, Menus, Scenes — so a fourth family files itself.
  if (row.wireframeTopic) return row.wireframeTopic;
  if (row.cardSizeTopic) return 'Card size';
  if (row.debugTopic) return 'Diagnostics';
  if (row.statTopic) return row.statTopic;
  if (row.prologueTopic) return row.prologueTopic;
  if (row.handTopic) return row.handTopic;
  if (section === 'Progression') {
    if (row.classTopic) return row.classTopic;
    if (key === 'creationAutoAdvance') return 'General';
    if (/^skill\.xp\./.test(path)) return 'Skill xp';
    if (/^skill\.class\./.test(path)) return 'Skill class';
    if (/^skill\./.test(path)) return 'Skill unlocks';
    if (/^classTree\./.test(path)) return talentTopic(path);
    if (/levelUp|playerStartingLevel/.test(key)) return 'Level-up';
    return 'Experience';
  }
  if (section === 'Battlefield') {
    if (/movement|Activation|selectionColor/.test(key)) return 'Movement';
    if (/row[A-F]|front|back|formation|groundTilt|groundSkew|gridShape|showFormationGrid/.test(key)) return 'Formation layout';
    if (/Spawn|SpriteScale/.test(key)) return 'Characters';
    return 'Formation grid';
  }
  if (section === 'Wireframes') return 'Window';
  if (section === 'Export') return 'Configuration file';
  if (section === 'Interface') {
    if (/map|walked/.test(key)) return 'Map & HUD';
    if (/holdConfirm|rewardCollect|controlHints/.test(key)) return 'Controls';
    return 'Appearance';
  }
  if (section === 'Combat') {
    // Card values (#1247): what each card-value table pays per resource.
    if (/damage\.attackCards/.test(key)) return 'AR card values';
    if (/damage\.defenseCards/.test(key)) return 'DR card values';
    if (/damage\.potencyCards/.test(key)) return 'PR card values';
    if (/damage\.poiseCards/.test(key)) return 'Poise card values';
    if (/damage\.wardCards/.test(key)) return 'Ward card values';
    if (/^(arcaneE|e)xposure\./.test(path)) return 'Exposure';
    if (/^(deck\.|startingDeckSize)/.test(path)) return 'Deck';
    if (/^(costs|mana)\./.test(path)) return 'Actions & costs';
    return words(path.split('.')[0]);
  }
  if (section === 'World') {
    if (/^rest\.|shrineMultiUse/.test(path)) return 'Rest & shrines';
    if (/^(atlas|seatTiers)/.test(path)) return 'Atlas & seats';
    if (/^customMods/.test(path)) return 'Run modifiers';
    if (/^coop/.test(path)) return 'Co-op';
    return words(path.split('.')[0]);
  }
  if (section === 'Equipment') {
    if (key === 'swapCostRule') return 'Equipment swapping';
    if (/^powers\./.test(path)) return relicTopic(path);
    if (/drops.rarityWeights/.test(path)) return 'Drop rarity';
    if (/drops/.test(path)) return 'Equipment drops';
    if (/starting|roleCopies/.test(path)) return 'Starting equipment';
    if (/rarityBonuses|cardMounts|limits/.test(path)) return 'Equipment balance';
    if (/swap|allowChanges|restamp/.test(path)) return 'Equipment swapping';
    return 'Equipment general';
  }
  if (section === 'Rewards') {
    if (/^(flask|grace)|rewards.flask|useRestorativeFlasks/.test(path)) return 'Flasks';
    if (key === 'shopSell') return 'Shop stock & services';
    if (/^shop\./.test(path)) {
      if (/Cost/.test(path)) return `Shop · ${words(path.split('.')[1].replace('Cost', ' prices'))}`;
      return 'Shop stock & services';
    }
    if (/rarityWeightsByClass/.test(path)) return `Rarity · ${words(path.split('.')[2])}`;
    if (/rarityWeights/.test(path)) return 'Reward rarity';
    if (/^(rewards|startingCinders|progression\.rewardMultiplier)/.test(path)) return 'Combat rewards';
    return words(path.split('.')[0]);
  }
  return 'General';
}

export function advancedSubgroups(rows, section) {
  const groups = new Map();
  for (const row of rows.filter(row => advancedSection(row) === section)) {
    const label = topic(row, section);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  }
  const result = [...groups].map(([label, rows]) => ({ id: label, label, rows }));
  // A topic not named in an order keeps its discovered order, after the named
  // ones.
  const byOrder = (order) => {
    const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id));
    result.sort((a, b) => rank(a.id) - rank(b.id));
  };
  if (section === 'Stats') {
    byOrder(STATS_TOPICS);
    // Each subsection is one unbroken run of rows, so its heading is drawn
    // once, and the rows a switch turns off come after every row in force. A
    // stable sort keeps the authored order inside a subsection.
    const rank = (id) => (STATS_SECTIONS.indexOf(id) < 0 ? STATS_SECTIONS.length : STATS_SECTIONS.indexOf(id));
    for (const group of result) {
      group.rows = group.rows
        .map((row, index) => ({ row, index, at: rank(statsSection(row)) }))
        .sort((a, b) => a.at - b.at || a.index - b.index)
        .map(({ row }) => row);
    }
  }
  if (section === 'Battlefield') byOrder(['Formation layout', 'Formation grid', 'Characters', 'Movement']);
  // Modals, then Menus, then Scenes: outermost surface first, and the order the
  // catalogue itself is written in — discovered, not restated, so the two
  // cannot disagree about which family comes first. Cards and the settings
  // window follow.
  if (section === 'Wireframes') byOrder([...WIREFRAME_CHOICE_GROUPS.map((group) => group.label), 'Card size', 'Window']);
  if (section === 'Interface') byOrder(['Map & HUD', 'Appearance', 'Controls']);
  if (section === 'Export') byOrder(['Configuration file', 'Diagnostics']);
  if (section === 'Equipment') {
    byOrder(['Starting equipment', 'Equipment general', 'Equipment balance', 'Equipment swapping', 'Equipment drops', 'Drop rarity',
      'Relics · damage', 'Relics · defence', 'Relics · recovery', 'Relics · resources', 'Relics · effects']);
  }
  // What a fight pays, then what it is spent on, then what carries between.
  if (section === 'Rewards') {
    const shop = result.filter((group) => group.id.startsWith('Shop · ')).map((group) => group.id);
    byOrder(['Combat rewards', 'Reward rarity', ...result.filter((group) => group.id.startsWith('Rarity · ')).map((group) => group.id),
      'Shop stock & services', ...shop, 'Smithing', 'Flasks']);
  }
  if (section === 'Combat') {
    byOrder(['Actions & costs', 'AR card values', 'DR card values', 'PR card values', 'Poise card values', 'Ward card values',
      'Deck', 'Exposure']);
  }
  if (section === 'Progression') {
    // Assign points first: it is the driver, and every class table under it is
    // rescaled by it. Level-up next, because a level spends the same points on
    // the same rows (what those points turn into is under Stats); then the
    // equipment floor under all of it — the least a character can carry is
    // whatever the starting kits ask for — and only then the class tables they
    // bound. A topic not named here keeps its discovered order, after the
    // named ones.
    byOrder([...PROGRESSION_TOPIC_ORDER, ...CLASS_TOPICS, 'Experience',
      'Skill xp', 'Skill class', 'Skill unlocks', ...CLASS_TOPICS.map((name) => `Talents · ${name}`), 'General']);
  }
  return result;
}
