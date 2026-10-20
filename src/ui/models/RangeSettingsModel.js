import { RANGE_SETTING_KEYS, snapshotRangePolicy } from '../../model/combatEngagement.js';
import { t, tFull } from '../strings.js';
import { readNewGameProfile } from '../components/gameProfileSelector.js';
import { fixCoreMechanics } from '../../content/generated/fixCoreMechanics.js';

// These preferences feed the next run's immutable policy, never a live fight.
// Read the same authored policy and fallback as the engine; zero is a value.
export function rangeSettingsRows(authored = fixCoreMechanics.range) {
  const policy = snapshotRangePolicy(authored);
  const common = { cat: 'Combat', coreOnly: true, rangeSetting: true, nextRunOnly: true };
  // A panel reads four fields from one immutable selected author. Retain only
  // the latest author, not a history of imported profiles.
  let cachedAuthor, cachedPolicy;
  const policyFor = settings => {
    const author = settings?.newGameProfile;
    if (!cachedPolicy || cachedAuthor !== author) {
      cachedPolicy = snapshotRangePolicy(readNewGameProfile(settings).fixCoreRules?.range ?? authored);
      cachedAuthor = author;
    }
    return cachedPolicy;
  };
  const defaultFor = field => settings => policyFor(settings)[field];
  return [
    { ...common, key: RANGE_SETTING_KEYS.enabled, type: 'toggle', def: policy.enabled,
      defaultFor: defaultFor('enabled'), resolve: (settings = {}) => typeof settings[RANGE_SETTING_KEYS.enabled] === 'boolean' ? settings[RANGE_SETTING_KEYS.enabled] : defaultFor('enabled')(settings),
      label: t('settings.range.enabled'), note: tFull('settings.range.enabled') },
    ...['advanceSpPerBand', 'reachPrecisionBonus', 'throwPrecisionPenalty'].map(field => ({
      ...common, key: RANGE_SETTING_KEYS[field], type: 'number', def: policy[field], defaultFor: defaultFor(field),
      min: 0, max: Number.MAX_SAFE_INTEGER, integer: true, step: 1,
      label: t(`settings.range.${field}`), note: tFull(`settings.range.${field}`),
    })),
  ];
}
