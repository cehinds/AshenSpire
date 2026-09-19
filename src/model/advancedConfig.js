// Advanced game configuration is a sparse overlay on authored content.
// The authored bundle remains the default; only keys present in profile
// settings are projected into a fresh bundle for a new run.

export const ADVANCED_CONFIG_PREFIX = 'gameConfig.';
export const ADVANCED_CONFIG_SCHEMA_VERSION = 1;

const PRESENTATION_DEFAULTS = Object.freeze({
  playerSpriteScale: 0.9,
  enemySpriteScale: 0.9,
  playerSpawnRow: 'C',
  enemySpawnRow: 'C',
  playerSpawnColumn: '2',
  enemySpawnColumn: '3',
  showFormationGrid: false,
  movementEnabled: false, movementNeedsSelection: true, movementCostsAction: true,
  tileActivation: 'hold', moveActivation: 'hold', selectionColor: '#59bd75',
  rowAScale: 1, rowBScale: 1, rowCScale: 1,
  frontOffsetX: 0, frontOffsetY: 0, backOffsetX: 0, backOffsetY: 0,
  frontLayer: 0, backLayer: 200,
  rowALayer: 0, rowBLayer: 0, rowCLayer: 0,
  gridShape: 'wide-rhombus', gridLayer: 'behind',
  playerGridColor: '#d5cc63', enemyGridColor: '#e1a679',
  settingsWidthPercent: 100,
  settingsHeightPercent: 100,
});

const word = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function numberDomain(value) {
  const integer = Number.isInteger(value);
  const magnitude = Math.max(1, Math.abs(value));
  return {
    integer,
    step: integer ? 1 : (magnitude < 1 ? 0.01 : 0.1),
    min: value < 0 ? -Math.max(100, Math.ceil(magnitude * 10)) : 0,
    max: Math.max(integer ? 20 : 10, Math.ceil(magnitude * 10)),
  };
}

// A generated row's domain is read off its shipped value (numberDomain), which
// knows nothing of what validate.js will accept. These paths do: a percent
// that validation caps at 100, a cap that must be positive. The row says so,
// so a value the editor accepts is a value a run can start on.
const PERCENT = Object.freeze({ integer: true, step: 1, min: 0, max: 100 });
const BALANCE_DOMAINS = Object.freeze({
  'rest.hpSmallPct': PERCENT,
  'rest.hpPartialPct': PERCENT,
  'rest.mana.floorPct': PERCENT,
  'atlas.townsPerActMax': Object.freeze({ min: 1 }),
});

// A balance path this build renamed keeps its stored override: the old key is
// read as the new one wherever settings are read (the configured bundle, the
// snapshot, an imported file), and the new key wins when both are present.
// `shrine.healPct` became `rest.hpPartialPct` (plan phase 7, SPEC §13.4j).
const LEGACY_BALANCE_KEYS = Object.freeze({
  [`${ADVANCED_CONFIG_PREFIX}balance.shrine.healPct`]: `${ADVANCED_CONFIG_PREFIX}balance.rest.hpPartialPct`,
});

export function currentAdvancedKey(key) {
  return LEGACY_BALANCE_KEYS[key] ?? key;
}

function withoutSupersededLegacy(entries) {
  const present = new Set(entries.map(([key]) => key));
  return entries
    .filter(([key]) => !(key in LEGACY_BALANCE_KEYS) || !present.has(LEGACY_BALANCE_KEYS[key]))
    .map(([key, value]) => [currentAdvancedKey(key), value]);
}

function balanceGroup(path) {
  if (/^(level|starting|energy$|draw$|handMax$)/.test(path)) return 'Progression';
  if (/^(rewards|shop|smith|equipment|customMods|graceRefill|flask)/.test(path)) return 'Rewards';
  if (/^(map|floors|act|seat|event|treasure|journey|node)/.test(path)) return 'World';
  if (/^(combat|poise|enemy|boss|status|exposure|arcane|damage|block|guard|proc)/.test(path)) return 'Combat';
  return 'Rules';
}

function leafRows(value, path = [], rows = []) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    const joined = path.join('.');
    const domain = typeof value === 'number' ? { ...numberDomain(value), ...(BALANCE_DOMAINS[joined] || {}) } : {};
    rows.push({
      cat: 'Advanced',
      advancedGroup: balanceGroup(joined),
      key: `${ADVANCED_CONFIG_PREFIX}balance.${joined}`,
      type: typeof value === 'number' ? 'number' : undefined,
      def: value,
      ...domain,
      label: word(path[path.length - 1]),
      note: `Authored balance value: ${joined}. Applies to a new run.`,
      configPath: ['balance', ...path],
      searchPath: joined,
    });
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  for (const [key, child] of Object.entries(value)) leafRows(child, [...path, key], rows);
  return rows;
}

function explicitRows(bundle) {
  const rows = [];
  const tuned = bundle.attributeRules?.presets?.[bundle.attributeRules?.defaultMode || 'tuned'] || {};
  for (const classDef of bundle.classes || []) {
    const classLabel = classDef.name || word(classDef.id);
    for (const attribute of bundle.attributes || []) {
      const def = tuned[classDef.id]?.[attribute.id];
      if (!Number.isFinite(def)) continue;
      rows.push({
        cat: 'Advanced', advancedGroup: 'Classes', type: 'number', integer: true, step: 1,
        min: 1, max: 99, def,
        key: `${ADVANCED_CONFIG_PREFIX}attributeRules.presets.${bundle.attributeRules.defaultMode}.${classDef.id}.${attribute.id}`,
        label: `${classLabel} — ${attribute.label}`,
        note: `Starting ${attribute.label.toLowerCase()} for ${classLabel} in the default ${bundle.attributeRules.defaultMode} mode. Applies to a new run.`,
        configPath: ['attributeRules', 'presets', bundle.attributeRules.defaultMode, classDef.id, attribute.id],
        searchPath: `class ${classDef.id} starting ${attribute.id}`,
      });
    }
    rows.push({
      cat: 'Advanced', advancedGroup: 'Classes', type: 'number', integer: true, step: 1,
      min: 1, max: 999, def: classDef.maxHp,
      key: `${ADVANCED_CONFIG_PREFIX}classes.${classDef.id}.maxHp`,
      label: `${classLabel} — base HP`, note: `Base HP for ${classLabel}. Applies to a new run.`,
      configPath: ['classesById', classDef.id, 'maxHp'], searchPath: `class ${classDef.id} max hp`,
    });
    for (const kind of ['hp', 'mana']) {
      const def = classDef.startingFlaskAllocation?.[kind];
      if (!Number.isFinite(def)) continue;
      rows.push({
        cat: 'Advanced', advancedGroup: 'Classes', type: 'number', integer: true, step: 1,
        min: 0, max: 20, def,
        key: `${ADVANCED_CONFIG_PREFIX}classes.${classDef.id}.startingFlaskAllocation.${kind}`,
        label: `${classLabel} — ${kind.toUpperCase()} flasks`, note: `Starting ${kind.toUpperCase()} flask allocation for ${classLabel}. Applies to a new run.`,
        configPath: ['classesById', classDef.id, 'startingFlaskAllocation', kind], searchPath: `class ${classDef.id} flask ${kind}`,
      });
    }
  }
  return rows;
}

const PRESENTATION_ROWS = Object.freeze([
  ...['A', 'B', 'C'].flatMap(row => [
    { key: `row${row}Scale`, label: `Row ${row} character scale multiplier`, min: 0.25, max: 3, step: 0.05, integer: false, note: 'Multiplies the character size for this row. Feet remain anchored to their tile.' },
    { key: `row${row}Layer`, label: `Row ${row} layer adjustment`, min: -500, max: 500, step: 1, integer: true, note: 'Added to the front/back character layer. Higher numbers draw above lower numbers.' },
  ]),
  ...['front', 'back'].flatMap(column => [
    { key: `${column}OffsetX`, label: `${word(column)} column horizontal offset`, min: -150, max: 150, step: 1, integer: true, note: 'Screen pixels; positive moves inward toward the opponent, negative moves outward. Applies to both sides and their tiles; limited at battlefield edges.' },
    { key: `${column}OffsetY`, label: `${word(column)} column vertical offset`, min: -100, max: 100, step: 1, integer: true, note: 'Screen pixels; positive moves down, negative moves up. Moves characters and their tiles together.' },
    { key: `${column}Layer`, label: `${word(column)} column character layer`, min: 0, max: 500, step: 1, integer: true, note: 'Higher layers draw above lower layers. Row layer adjustments are added to this value.' },
  ]),
  { key: 'playerSpriteScale', label: 'Player sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale the player figure without changing its combat footprint.' },
  { key: 'enemySpriteScale', label: 'Enemy sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale enemy figures without changing targeting or combat rules.' },
  { key: 'settingsWidthPercent', label: 'Settings window width', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
  { key: 'settingsHeightPercent', label: 'Settings window height', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
]);

function presentationRows() {
  return [
    ...[
      ['movementEnabled', 'Enable formation movement', 'Make empty player-side tiles interactive in combat.'],
      ['movementNeedsSelection', 'Select a tile before moving', 'In tap mode, select a destination, then use Move. When off, tapping moves immediately. Hold mode always moves on completion or opens Move / Cancel on early release.'],
      ['movementCostsAction', 'Movement costs an action', 'Spend one action per move. When off, movement is free.'],
    ].map(([key, label, note]) => ({ cat: 'Advanced', advancedGroup: 'Interface', key: `${ADVANCED_CONFIG_PREFIX}presentation.${key}`, presentationKey: key, def: PRESENTATION_DEFAULTS[key], label, note })),
    ...[['tileActivation', 'Tile activation'], ['moveActivation', 'Move button activation']].map(([key, label]) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice', key: `${ADVANCED_CONFIG_PREFIX}presentation.${key}`, presentationKey: key,
      def: PRESENTATION_DEFAULTS[key], choices: ['tap', 'hold'], label,
      note: 'Hold uses the shared loading delay and moves directly when complete; releasing early opens Move / Cancel. Tap uses the selection-step preference.',
    })),
    { cat: 'Advanced', advancedGroup: 'Interface', type: 'color', key: `${ADVANCED_CONFIG_PREFIX}presentation.selectionColor`, presentationKey: 'selectionColor',
      def: PRESENTATION_DEFAULTS.selectionColor, label: 'Shared selection color', note: 'Highlight selected tiles, cards, characters and selected menu choices with this color.' },
    {
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.gridShape`, presentationKey: 'gridShape',
      def: 'wide-rhombus', choices: ['square', 'rectangle', 'rhombus', 'wide-rhombus', 'circle', 'ellipse'],
      choiceLabels: { 'wide-rhombus': 'rectangular rhombus' },
      label: 'Formation tile shape', note: 'Changes the tile outline while keeping its placement anchor fixed.', slider: true,
    },
    {
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.gridLayer`, presentationKey: 'gridLayer',
      def: 'behind', choices: ['behind', 'above'], label: 'Formation grid layer',
      note: 'Draw the grid behind characters or above them for checking positions. The grid never blocks clicks.',
    },
    ...['player', 'enemy'].map(side => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'color',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}GridColor`, presentationKey: `${side}GridColor`,
      def: PRESENTATION_DEFAULTS[`${side}GridColor`], label: `${word(side)} tile color`,
      note: 'Outline and highlight color for this side of the formation grid.',
    })),
    {
      cat: 'Advanced', advancedGroup: 'Interface',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.showFormationGrid`,
      presentationKey: 'showFormationGrid', def: false,
      label: 'Show formation grid',
      note: 'Overlay A1–C4 reference cells in combat to check visible positions. Columns 1–2 are your side; 3–4 are the enemy side.',
    },
    ...PRESENTATION_ROWS.map((row) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'number',
      ...row, def: PRESENTATION_DEFAULTS[row.key],
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${row.key}`,
      presentationKey: row.key,
    })),
    ...['player', 'enemy'].map((side) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}SpawnRow`,
      presentationKey: `${side}SpawnRow`, def: 'C', choices: ['A', 'B', 'C'],
      choiceLabels: { A: 'A · top', B: 'B · middle', C: 'C · bottom' },
      legacyChoices: side === 'player'
        ? { front: 'A', middle: 'B', back: 'C' }
        : { front: 'C', middle: 'B', back: 'A' },
      label: `${word(side)} default row (A–C)`,
      note: `First character's row: A is top, B is middle, C is bottom. Additional characters fill the other column, then earlier rows. Updates the current battle immediately; combat range rules are unchanged.`,
    })),
    ...['player', 'enemy'].map((side) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}SpawnColumn`,
      presentationKey: `${side}SpawnColumn`,
      def: side === 'player' ? '2' : '3',
      choices: side === 'player' ? ['1', '2'] : ['3', '4'],
      choiceLabels: side === 'player'
        ? { 1: '1 · back', 2: '2 · front' }
        : { 3: '3 · front', 4: '4 · back' },
      legacyChoices: side === 'player'
        ? { left: '1', center: '2', right: '2' }
        : { left: '3', center: '3', right: '4' },
      label: `${word(side)} default column (${side === 'player' ? '1–2' : '3–4'})`,
      note: `${word(side)} side uses only columns ${side === 'player' ? '1–2' : '3–4'}; front is nearer the arena center and back is nearer the outer edge.`,
    })),
  ];
}

function progressionRows(bundle) {
  return [
    {
      cat: 'Advanced', advancedGroup: 'Progression', type: 'number', integer: false, step: 0.05,
      min: 0.05, max: 20, def: 1,
      key: `${ADVANCED_CONFIG_PREFIX}progression.xpMultiplier`,
      label: 'Experience gain multiplier',
      note: 'Multiply the XP a won fight, a kill and a quest pay toward your character level. 1 keeps authored awards. Applies to a new run.',
      specialKey: 'xpMultiplier', searchPath: 'progression experience exp level gain multiplier',
    },
    {
      cat: 'Advanced', advancedGroup: 'Progression', type: 'number', integer: false, step: 0.05,
      min: 0, max: 20, def: 1,
      key: `${ADVANCED_CONFIG_PREFIX}progression.rewardMultiplier`,
      label: 'Cinder / experience gain multiplier',
      note: 'Multiply Cinders earned from combat rewards. 1 keeps authored rewards. Applies to a new run.',
      specialKey: 'rewardMultiplier', searchPath: 'progression experience exp cinder reward gain multiplier',
    },
  ];
}

const LEGACY_BALANCE_PATHS = new Set([
  'levelUp.pointsPerLevel',
]);

export function advancedConfigRows(bundle) {
  const generated = leafRows(bundle.balance || {}).filter((row) => !row.searchPath.startsWith('ui.') && !LEGACY_BALANCE_PATHS.has(row.searchPath));
  return [...progressionRows(bundle), ...explicitRows(bundle), ...presentationRows(), ...generated];
}

export function advancedConfigSettings(settings = {}, additionalKeys = []) {
  const entries = withoutSupersededLegacy(Object.entries(settings).filter(([key]) => key.startsWith(ADVANCED_CONFIG_PREFIX)));
  if (settings.levelUpValue !== undefined) entries.push([`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`, settings.levelUpValue]);
  if (settings.statTierSize !== undefined) entries.push([`${ADVANCED_CONFIG_PREFIX}derivedStatRules.defaults.pointsPerTier`, settings.statTierSize]);
  for (const key of additionalKeys) {
    if (key === 'levelUpValue' || key === 'statTierSize' || settings[key] === undefined) continue;
    entries.push([`settings.${key}`, settings[key]]);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function advancedConfigSnapshot(settings = {}) {
  return Object.freeze({
    schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    overrides: advancedConfigSettings(settings),
  });
}

function cloneConfigurableBundle(bundle) {
  return {
    ...bundle,
    balance: structuredClone(bundle.balance),
    classes: bundle.classes.map((row) => structuredClone(row)),
    attributeRules: structuredClone(bundle.attributeRules),
    derivedStatRules: structuredClone(bundle.derivedStatRules),
  };
}

function setPath(target, path, value) {
  let cursor = target;
  for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
  cursor[path[path.length - 1]] = value;
}

export function configuredContentBundle(bundle, settingsOrSnapshot = {}) {
  const settings = settingsOrSnapshot?.overrides || settingsOrSnapshot || {};
  const configured = cloneConfigurableBundle(bundle);
  const rows = advancedConfigRows(bundle);
  const byKey = new Map(rows.filter((row) => row.configPath).map((row) => [row.key, row]));
  const classesById = Object.fromEntries(configured.classes.map((row) => [row.id, row]));
  for (const [key, raw] of withoutSupersededLegacy(Object.entries(settings))) {
    const row = byKey.get(key);
    if (!row?.configPath) continue;
    const value = typeof row.def === 'boolean' ? raw === true : Number(raw);
    if (typeof row.def !== 'boolean' && !Number.isFinite(value)) continue;
    const root = row.configPath[0] === 'classesById'
      ? { classesById }
      : configured;
    setPath(root, row.configPath, value);
  }
  const xpMultiplier = Number(settings[`${ADVANCED_CONFIG_PREFIX}progression.xpMultiplier`]);
  if (Number.isFinite(xpMultiplier) && configured.balance.xp) {
    const xp = configured.balance.xp;
    for (const key of ['combatWin', 'quest']) if (Number.isFinite(xp[key])) xp[key] = Math.max(0, Math.round(xp[key] * xpMultiplier));
    for (const key of Object.keys(xp.kill || {})) xp.kill[key] = Math.max(0, Math.round(xp.kill[key] * xpMultiplier));
  }
  const rewardMultiplier = Number(settings[`${ADVANCED_CONFIG_PREFIX}progression.rewardMultiplier`]);
  if (Number.isFinite(rewardMultiplier) && configured.balance.rewards?.cinders) {
    for (const range of Object.values(configured.balance.rewards.cinders)) {
      if (!Array.isArray(range)) continue;
      for (let index = 0; index < range.length; index += 1) range[index] = Math.max(0, Math.round(range[index] * rewardMultiplier));
    }
  }
  const pointsPerLevel = Number(settings[`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`] ?? settings.levelUpValue);
  if (Number.isInteger(pointsPerLevel) && pointsPerLevel > 0) configured.balance.levelUp.pointsPerLevel = pointsPerLevel;
  const pointsPerTier = Number(settings[`${ADVANCED_CONFIG_PREFIX}derivedStatRules.defaults.pointsPerTier`] ?? settings.statTierSize);
  if (Number.isInteger(pointsPerTier) && pointsPerTier > 0) configured.derivedStatRules.defaults.pointsPerTier = pointsPerTier;
  const mode = configured.creationModes.find((row) => row.id === configured.attributeRules.defaultMode);
  if (mode) {
    const expected = mode.baseline * configured.attributes.length + mode.bonusPool;
    const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
    for (const classDef of configured.classes) {
      const preset = configured.attributeRules.presets[mode.id]?.[classDef.id];
      const values = configured.attributes.map((attribute) => preset?.[attribute.id]);
      const valid = values.every((value) => Number.isInteger(value) && value >= floor && value <= mode.maximum)
        && values.reduce((sum, value) => sum + value, 0) === expected;
      if (!valid) configured.attributeRules.presets[mode.id][classDef.id] = structuredClone(bundle.attributeRules.presets[mode.id][classDef.id]);
    }
  }
  return configured;
}

export function advancedConfigProblems(bundle, settings = {}) {
  const problems = [];
  const modeId = bundle.attributeRules.defaultMode;
  const mode = bundle.creationModes.find((row) => row.id === modeId);
  if (!mode) return problems;
  const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
  const expected = mode.baseline * bundle.attributes.length + mode.bonusPool;
  for (const classDef of bundle.classes) {
    const values = bundle.attributes.map((attribute) => {
      const key = `${ADVANCED_CONFIG_PREFIX}attributeRules.presets.${modeId}.${classDef.id}.${attribute.id}`;
      return Number(settings[key] ?? bundle.attributeRules.presets[modeId][classDef.id][attribute.id]);
    });
    const badCell = values.some((value) => !Number.isInteger(value) || value < floor || value > mode.maximum);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (badCell || total !== expected) {
      problems.push(`${classDef.name}: starting attributes must each be ${floor}–${mode.maximum} and total ${expected}; current total ${total}. Authored defaults stay active until the set is valid.`);
    }
  }
  return [...problems, ...advancedConfigStructuralProblems(bundle, settings)];
}

export function advancedConfigStructuralProblems(bundle, settings = {}) {
  const configured = configuredContentBundle(bundle, settings);
  const problems = [];
  const walk = (value, path = []) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      if (value.length === 2 && value.every(Number.isFinite) && value[0] > value[1]) {
        problems.push(`${path.join('.')} must keep its first value at or below its second value.`);
      }
      value.forEach((child, index) => walk(child, [...path, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith('Min')) {
        const maxKey = `${key.slice(0, -3)}Max`;
        if (Number.isFinite(child) && Number.isFinite(value[maxKey]) && child > value[maxKey]) {
          problems.push(`${[...path, key].join('.')} must stay at or below ${[...path, maxKey].join('.')}.`);
        }
      }
      walk(child, [...path, key]);
    }
  };
  walk(configured.balance, ['balance']);
  return problems;
}

export function presentationConfig(settings = {}) {
  const values = { ...PRESENTATION_DEFAULTS };
  for (const row of presentationRows()) {
    if (!(row.key in settings)) continue;
    const raw = settings[row.key];
    if (row.type === 'choice') {
      const normalized = row.legacyChoices?.[raw] ?? raw;
      if (row.choices.includes(normalized)) values[row.presentationKey] = normalized;
    } else if (row.type === 'color') {
      if (typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)) values[row.presentationKey] = raw;
    } else if (typeof row.def === 'boolean') {
      values[row.presentationKey] = raw === true;
    } else {
      const number = Number(raw);
      if (Number.isFinite(number)) values[row.presentationKey] = Math.min(row.max, Math.max(row.min, number));
    }
  }
  return values;
}

export function advancedConfigExport(settings = {}, build = {}, additionalKeys = []) {
  return JSON.stringify({
    schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    game: 'Ashen Spire',
    build,
    overrides: advancedConfigSettings(settings, additionalKeys),
  }, null, 2) + '\n';
}

export function parseAdvancedConfigFile(text, bundle, current = {}, additionalRows = []) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('Choose a settings JSON file smaller than 1 MB.');
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  if (!file || file.game !== 'Ashen Spire' || file.schemaVersion !== ADVANCED_CONFIG_SCHEMA_VERSION
    || !file.overrides || typeof file.overrides !== 'object' || Array.isArray(file.overrides)) {
    throw new Error('Choose an Ashen Spire configuration exported by this version.');
  }
  const rows = new Map(advancedConfigRows(bundle).map(row => [row.key, row]));
  for (const row of additionalRows) {
    if (!['button', 'action'].includes(row.type)) rows.set(`settings.${row.key}`, row);
    if (row.key === 'levelUpValue') rows.set('gameConfig.balance.levelUp.pointsPerLevel', row);
    if (row.key === 'statTierSize') rows.set('gameConfig.derivedStatRules.defaults.pointsPerTier', row);
  }
  const changes = {};
  for (const [key, raw] of withoutSupersededLegacy(Object.entries(file.overrides))) {
    const row = rows.get(key);
    if (!row) throw new Error(`Unknown setting: ${key}. Nothing was imported.`);
    const value = row.type === 'choice' && Object.hasOwn(row.legacyChoices || {}, raw) ? row.legacyChoices[raw] : raw;
    let valid = false;
    if (row.type === 'choice') valid = row.choices.includes(value);
    else if (row.type === 'color') valid = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    else if (typeof row.def === 'boolean') valid = typeof value === 'boolean';
    else if (['number', 'range'].includes(row.type) || typeof row.def === 'number') {
      valid = typeof value === 'number' && Number.isFinite(value)
        && value >= (row.min ?? 0) && value <= (row.max ?? 100)
        && (!row.integer || Number.isInteger(value));
    } else if (typeof row.def === 'string') valid = typeof value === 'string' && value.length <= 1000;
    if (!valid) throw new Error(`Invalid value for ${row.label || key}. Nothing was imported.`);
    changes[row.key] = value;
  }
  const problems = advancedConfigProblems(bundle, { ...current, ...changes });
  if (problems.length) throw new Error(`Nothing was imported. ${problems[0]}`);
  return changes;
}

export async function saveAdvancedConfigFile(settings, options = {}) {
  const win = options.window || globalThis.window;
  const doc = options.document || globalThis.document;
  const text = advancedConfigExport(settings, options.build || {}, options.includeKeys || []);
  const filename = options.filename || 'ashen-spire-game-config.json';
  if (win && typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Ashen Spire game configuration', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { ok: true, method: 'save-as', filename };
    } catch (error) {
      if (error?.name !== 'AbortError') console.warn('Game configuration Save As failed; using browser download.', error);
    }
  }
  if (!doc || !win?.URL) return { ok: false, method: 'unavailable', filename };
  const blob = new Blob([text], { type: 'application/json' });
  const url = win.URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  return { ok: true, method: 'download', filename };
}
