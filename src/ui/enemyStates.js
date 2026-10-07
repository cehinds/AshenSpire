// Presentation only: active buffs color the silhouette; buildup is not a debuff.
export const ENEMY_STATE_POSES = ['buff', 'wounded', 'afflicted', 'projectile', 'guard', 'guardHit', 'hurt'];
const negative = new Set(['weak', 'vulnerable', 'frail', 'frostExposed', 'insanityExposed', 'crimsonBlight', 'burn', 'madness', 'staggered', 'venom', 'magicVulnerable']);
const themes = {
  strength: ['strength', 'rallyingStandard', 'rallyingStandardUp', 'prepared', 'deadlyTempo', 'opportunist', 'glassCannon', 'zealotry'],
  defense: ['dexterity', 'unbreakable', 'unbreakableUp', 'ironVow', 'bulwarkEcho', 'moonlitShield', 'astralArmor'],
  healing: ['regen', 'communion'],
  blood: ['bleedResist', 'goreblood', 'sanguinePact', 'lifeTithe', 'stigmata', 'bloodUnction'],
  frost: ['frostResist'],
  arcane: ['insanityResist', 'starstoneCharge', 'stargazer', 'constellation', 'azureCoil', 'waxingMoon', 'astromancer'],
  nature: ['thornHalo', 'harbingerOfBlight', 'envenom'],
  fire: ['emberTide'],
  evasion: ['afterimage'],
};
const ENEMY_AURA_COLORS = Object.freeze({ strength: '#efbb4e', defense: '#67b5ff', healing: '#79e89d', blood: '#ee6473', frost: '#a3edff', arcane: '#b393ff', nature: '#a3cd59', fire: '#ff9454', evasion: '#d6e8f2' });
const themeByStatus = new Map(Object.entries(themes).flatMap(([theme, ids]) => ids.map(id => [id, theme])));
export function enemyPresentation(entity = {}) {
  if (entity.alive === false || entity.hp === 0) return { rest: 'defeated', buffs: [], auraThemes: [] };
  const active = Object.entries(entity.statuses || {}).filter(([, value]) => !value.meter && Number(value.stacks) > 0).map(([id]) => id);
  const buffs = active.filter(id => themeByStatus.has(id));
  const auraThemes = [...new Set(buffs.map(id => themeByStatus.get(id)))];
  const rest = entity.block > 0 ? 'guard' : active.some(id => negative.has(id)) ? 'afflicted'
    : entity.hp > 0 && entity.maxHp > 0 && entity.hp / entity.maxHp <= .35 ? 'wounded' : 'idle';
  return { rest, buffs, auraThemes };
}
export function enemyAuraFilter(themes = []) {
  return themes.map((theme, i) => `drop-shadow(0 0 ${3 + i * 3}px ${ENEMY_AURA_COLORS[theme]})`).join(' ') || 'none';
}
