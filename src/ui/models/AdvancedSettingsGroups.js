// Presentation only: every setting keeps its existing key and value semantics.
const words = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\./g, ' ').replace(/^./, c => c.toUpperCase());

export function advancedSection(row) {
  if (['creationAutoAdvance', 'statTierSize'].includes(row.key)) return 'Classes';
  return row.advancedGroup || 'Gameplay';
}

function topic(row, section) {
  if (row.prologueTopic) return row.prologueTopic;
  const key = row.key;
  const path = key.replace(/^gameConfig\.(balance\.)?/, '');
  if (section === 'Classes') {
    if (key === 'creationAutoAdvance') return 'General';
    if (key === 'statTierSize') return 'Assign points';
    return words(key.match(/\.(reaver|starseer|rogue|herald)\./)?.[1] || 'General');
  }
  if (section === 'Progression') {
    if (/enemyScaling/.test(key)) return 'Enemy scaling';
    if (/levelUp|statTier/.test(key)) return 'Level-up';
    if (/xp|Multiplier/.test(key)) return 'Experience & rewards';
    return 'Starting values';
  }
  if (section === 'Interface') {
    if (/movement|Activation|selectionColor/.test(key)) return 'Movement';
    if (/row[A-F]|front|back|formation|groundTilt|groundSkew|gridShape|showFormationGrid/.test(key)) return 'Formation layout';
    if (/Spawn|SpriteScale|useSprites/.test(key)) return 'Characters';
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
  if (section === 'Interface') result.sort((a, b) => Number(b.id === 'Formation layout') - Number(a.id === 'Formation layout'));
  if (section === 'Classes') {
    const order = ['General', 'Assign points', 'Reaver', 'Starseer', 'Rogue', 'Herald'];
    result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  return result;
}
