// Dedicated run corruption; ordinary Crimson Blight never uses this meter.
export const ASHEN_BLIGHT_RULES = Object.freeze({
  version: 1, maximum: 100, thresholdLossPct: 90, encounterLossPct: 5,
  convertedActionDiscount: 1, convertedPrintedBonusPct: 25,
  milestones: Object.freeze([25, 50, 75]),
});

export const ASHEN_BLIGHT_PATHS = Object.freeze(['martial', 'spell', 'survivor']);
const names = { martial: 'Volcanic Sinew', spell: 'Cinder Sight', survivor: 'Ashen Heart' };
const stages = ['Singed', 'Kindled', 'Infernal'];

export const ashenBlightFeats = Object.freeze(ASHEN_BLIGHT_RULES.milestones.flatMap((threshold, index) => {
  const tier = index + 1;
  return ASHEN_BLIGHT_PATHS.map(path => Object.freeze({
    id: `${path}Blight${tier}`, path, threshold, tier, stage: stages[index], name: names[path],
    buffs: Object.freeze(path === 'martial'
      ? [`+${tier} STR.`, `First eligible Martial attack or Counter each owner cycle: +${tier} authored Poise damage.`]
      : path === 'spell'
        ? [`+${tier} INT.`, 'First eligible elemental spell each owner cycle: +1 to one authored Burn, Frost, or Paralysis buildup.']
        : [`+${tier} CON.`, `First positive HP or Ward restoration attempt each owner cycle: +${[10, 15, 20][index]}%.`]),
    drawbacks: Object.freeze(path === 'martial'
      ? [`Persistent Ward restoration −${[10, 15, 20][index]}%.`]
      : path === 'spell' ? [`Maximum Stamina −${tier}.`] : ['Opening hand −1 card, minimum 1.']),
  }));
}));

export function ashenBlightFeatChoices(threshold) {
  return ashenBlightFeats.filter(feat => feat.threshold === threshold);
}

export function ashenBlightFeat(threshold, path) {
  return ashenBlightFeats.find(feat => feat.threshold === threshold && feat.path === path) || null;
}
