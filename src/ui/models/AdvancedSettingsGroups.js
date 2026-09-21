import { contentBundle } from '../../content/index.js';

// Presentation only: every setting keeps its existing key and value semantics.
const words = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\./g, ' ').replace(/^./, c => c.toUpperCase());

// ONE MENU DRIVES STARTING STATS (owner, 2026-09-20). "Class defaults should
// be in Progression"; "changing class defaults and starting stats seem to be
// in multiple menus instead of having just one driver". So the Classes tab is
// gone and everything that decides the points a new character opens with —
// the creation pool, each class's table, level-up, the tier size — is filed
// under Progression, in that reading order.
export function advancedSection(row) {
  if (['creationAutoAdvance', 'statTierSize'].includes(row.key)) return 'Progression';
  return row.advancedGroup || 'Gameplay';
}

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

function topic(row, section) {
  if (row.statTopic) return row.statTopic;
  if (row.prologueTopic) return row.prologueTopic;
  if (row.handTopic) return row.handTopic;
  const key = row.key;
  const path = key.replace(/^gameConfig\.(balance\.)?/, '');
  if (section === 'Progression') {
    if (row.classTopic) return row.classTopic;
    // His words, verbatim: "the assign points should be about how many points
    // should be available and the total amount of points on a character, not
    // how many stat points per tier. That should be under General."
    if (['statTierSize', 'creationAutoAdvance'].includes(key)) return 'General';
    if (/enemyScaling/.test(key)) return 'Enemy scaling';
    // The tier size's own bounds go where the tier size went. Leaving them
    // under Level-up would put one dial and its limits in two tabs, which is
    // the complaint this whole change answers.
    if (/tierSize/.test(key)) return 'General';
    if (/levelUp/.test(key)) return 'Level-up';
    if (/xp|Multiplier/.test(key)) return 'Experience & rewards';
    return 'Starting values';
  }
  if (section === 'Interface') {
    if (/movement|Activation|selectionColor/.test(key)) return 'Movement';
    if (/row[A-F]|front|back|formation|groundTilt|groundSkew|gridShape|showFormationGrid/.test(key)) return 'Formation layout';
    if (/Spawn|SpriteScale/.test(key)) return 'Characters';
    if (/Grid|grid/.test(key)) return 'Formation grid';
    if (/map|walked/.test(key)) return 'Map & HUD';
    if (/settings.*Percent|uprightGate/.test(key)) return 'Window';
    return 'Appearance';
  }
  if (section === 'Combat') return /poise/.test(key) ? 'Poise' : 'Exposure';
  if (section === 'Rewards') {
    if (/^(flask|grace)|rewards.flask/.test(path)) return 'Flasks';
    if (/^shop\./.test(path)) {
      if (/Cost/.test(path)) return `Shop · ${words(path.split('.')[1].replace('Cost', ' prices'))}`;
      return 'Shop stock & services';
    }
    if (/^equipment\./.test(path)) {
      if (/drops.rarityWeights/.test(path)) return 'Drop rarity';
      if (/drops/.test(path)) return 'Equipment drops';
      if (/starting|roleCopies/.test(path)) return 'Starting equipment';
      if (/rarityBonuses|cardMounts|limits/.test(path)) return 'Equipment balance';
      if (/swap|allowChanges|restamp/.test(path)) return 'Equipment swapping';
      return 'Equipment general';
    }
    if (/rarityWeightsByClass/.test(path)) return `Rarity · ${words(path.split('.')[2])}`;
    if (/rarityWeights/.test(path)) return 'Reward rarity';
    if (/^rewards/.test(path)) return 'Combat rewards';
    if (/customMods/.test(path)) return 'Run modifiers';
    return words(path.split('.')[0]);
  }
  if (section === 'Rules' && path.startsWith('powers.')) {
    const effect = path.split('.').at(-1);
    if (/heal|restore/.test(effect)) return 'Relics · recovery';
    if (/block/.test(effect)) return 'Relics · defence';
    if (/draw|gainEnergy|^n$/.test(effect)) return 'Relics · resources';
    if (/strength|damage|poiseDamage/.test(effect)) return 'Relics · damage';
    return 'Relics · effects';
  }
  if (section === 'Rewards' || section === 'Rules') {
    const parts = path.split('.');
    if (['equipment', 'rewards', 'shop', 'skill', 'classTree'].includes(parts[0])) {
      if (parts[0] === 'classTree') {
        if (/ironFooting|bloodTempo|ashenReserve|grimHarvest|warlord|bulwarkKing/.test(path)) return 'Talents · Reaver';
        if (/attunedMind|starlitFocus|lodestarCap|arcaneDraw|conduit|reservoir/.test(path)) return 'Talents · Starseer';
        if (/warmth|vigil|sealOfPlenty|wakingRot|martyr|saint/.test(path)) return 'Talents · Herald';
        return 'Talents · Rogue';
      }
      if (parts[0] === 'skill' && !['xp', 'class'].includes(parts[1])) return 'Skill unlocks';
      if (parts[0] === 'shop') return /Cost|armamentCost|remove/.test(path) ? 'Shop prices' : 'Shop stock';
      return words(parts.slice(0, 2).join('.'));
    }
    return words(parts[0]);
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
  if (section === 'Hand & Draw') {
    const order = ['Starting hand', 'Turn draws', 'Hand capacity', 'Retention & discards'];
    result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  if (section === 'Interface') result.sort((a, b) => Number(b.id === 'Formation layout') - Number(a.id === 'Formation layout'));
  if (section === 'Progression') {
    // Assign points first: it is the driver, and every class table under it is
    // rescaled by it. Equipment requirements come second because they are the
    // FLOOR under it — the least a character can carry is whatever the starting
    // kits ask for — so the two are read together, and only then the class
    // tables they bound. A topic not named here keeps its discovered order,
    // after the named ones.
    const order = ['Assign points', 'Equipment requirements', ...CLASS_TOPICS, 'Level-up', 'General', 'Stat conversions'];
    const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id));
    result.sort((a, b) => rank(a.id) - rank(b.id));
  }
  return result;
}
