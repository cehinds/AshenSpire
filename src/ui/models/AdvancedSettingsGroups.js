import { contentBundle } from '../../content/index.js';
import { WIREFRAME_CHOICE_GROUPS } from './WireframeChoiceModel.js';
import { memberOfOwnKey } from '../../model/settingOverrides.js';

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
  // An override switch files with the row it governs.
  row = row.own ? { ...row, key: memberOfOwnKey(row.key) } : row;
  if (['creationAutoAdvance', 'statTierSize'].includes(row.key)) return 'Progression';
  if (/^gameConfig\.presentation\.settings(Width|Height)Percent$/.test(row.key) || row.key === 'uprightGate') return 'Wireframes';
  if (BATTLEFIELD.test(row.key)) return 'Battlefield';
  // The legacy draw and poise conversions share their quantity with a whole
  // tab each; they are filed beside the rows that win (see `topic`).
  if (/^gameConfig\.derivedStatRules\.rules\.draw\./.test(row.key)) return 'Hand & Draw';
  if (/^gameConfig\.derivedStatRules\.rules\.poise\./.test(row.key)) return 'Ratings & Resistance';
  return row.advancedGroup || 'Interface';
}

// The topic that holds every row whose quantity another row replaces while a
// switch is on. Named once: `topic` files into it and `advancedSubgroups`
// sorts it last.
export const WITHOUT_RATINGS = 'Without ratings (legacy poise)';
export const DRAW_FALLBACK = 'Co-op & legacy fallback';

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
  const key = row.own ? memberOfOwnKey(row.key) : row.key;
  const path = key.replace(/^gameConfig\.(balance\.)?/, '');
  // Rows that share a quantity with another tab's rows are filed together,
  // before any row's own topic is consulted.
  if (section === 'Hand & Draw' && (path === 'handMax' || /^derivedStatRules\.rules\.draw\./.test(path))) return DRAW_FALLBACK;
  if (section === 'Ratings & Resistance' && (/^(poise|stagger)\./.test(path) || /^derivedStatRules\.rules\.poise\./.test(path))) return WITHOUT_RATINGS;
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
    // The every-stat number replaces a stat's own "points per increase" while
    // it is off its default, so it leads the rows it overrides rather than
    // sitting a topic away from them.
    if (key === 'statTierSize') return 'Stat conversions';
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
  // An override switch sits directly above the first row it governs, wherever
  // generation put it, so the switch and its number read as one control.
  for (const group of result) {
    for (const toggle of group.rows.filter((row) => row.own)) {
      const member = memberOfOwnKey(toggle.key);
      const rest = group.rows.filter((row) => row !== toggle);
      const at = rest.findIndex((row) => row.key === member || row.key.startsWith(`${member}.`));
      if (at >= 0) group.rows = [...rest.slice(0, at), toggle, ...rest.slice(at)];
    }
  }
  // The tier dial leads the per-stat rows it overrides.
  for (const group of result) {
    // The general switch, then the dial it governs, then the per-stat rows.
    const lead = (row) => (row.key === 'gameConfig.derivedStatRules.sharedPointsPerIncrease' ? 2 : row.key === 'statTierSize' ? 1 : 0);
    if (group.id === 'Stat conversions') group.rows.sort((a, b) => lead(b) - lead(a));
  }
  // A topic not named in an order keeps its discovered order, after the named
  // ones.
  const byOrder = (order) => {
    const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id));
    result.sort((a, b) => rank(a.id) - rank(b.id));
  };
  if (section === 'Hand & Draw') byOrder(['Starting hand', 'Turn draws', 'Hand capacity', 'Retention & discards', DRAW_FALLBACK]);
  if (section === 'Battlefield') byOrder(['Formation layout', 'Formation grid', 'Characters', 'Movement']);
  // The rows a switch turns off go last, after every row that is in force.
  if (section === 'Ratings & Resistance') result.sort((a, b) => Number(a.id === WITHOUT_RATINGS) - Number(b.id === WITHOUT_RATINGS));
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
    // rescaled by it. Equipment requirements come second because they are the
    // FLOOR under it — the least a character can carry is whatever the starting
    // kits ask for — so the two are read together, and only then the class
    // tables they bound. A topic not named here keeps its discovered order,
    // after the named ones.
    byOrder(['Assign points', 'Equipment requirements', ...CLASS_TOPICS, 'Level-up', 'Experience', 'Stat conversions',
      'Skill xp', 'Skill class', 'Skill unlocks', ...CLASS_TOPICS.map((name) => `Talents · ${name}`), 'General']);
  }
  return result;
}
