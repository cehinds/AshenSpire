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
    const domain = typeof value === 'number' ? numberDomain(value) : {};
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
  { key: 'playerSpriteScale', label: 'Player sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale the player figure without changing its combat footprint.' },
  { key: 'enemySpriteScale', label: 'Enemy sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale enemy figures without changing targeting or combat rules.' },
  { key: 'settingsWidthPercent', label: 'Settings window width', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
  { key: 'settingsHeightPercent', label: 'Settings window height', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
]);

function presentationRows() {
  return [
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
      note: `Global formation row: A is top, B is middle, C is bottom. This changes placement, not combat targeting.`,
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
      key: `${ADVANCED_CONFIG_PREFIX}progression.levelCostMultiplier`,
      label: 'Level cost multiplier',
      note: 'Multiply the first level cost and every later cost step. 1 keeps authored costs. Applies to a new run.',
      specialKey: 'levelCostMultiplier', searchPath: 'progression experience required cost multiplier',
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
  const entries = Object.entries(settings).filter(([key]) => key.startsWith(ADVANCED_CONFIG_PREFIX));
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
  for (const [key, raw] of Object.entries(settings)) {
    const row = byKey.get(key);
    if (!row?.configPath) continue;
    const value = typeof row.def === 'boolean' ? raw === true : Number(raw);
    if (typeof row.def !== 'boolean' && !Number.isFinite(value)) continue;
    const root = row.configPath[0] === 'classesById'
      ? { classesById }
      : configured;
    setPath(root, row.configPath, value);
  }
  const levelCostMultiplier = Number(settings[`${ADVANCED_CONFIG_PREFIX}progression.levelCostMultiplier`]);
  if (Number.isFinite(levelCostMultiplier)) {
    configured.balance.levelUp.firstCost = Math.max(0, Math.round(configured.balance.levelUp.firstCost * levelCostMultiplier));
    configured.balance.levelUp.costStep = Math.max(0, Math.round(configured.balance.levelUp.costStep * levelCostMultiplier));
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
