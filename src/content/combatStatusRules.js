// Combat expansion v2: every threshold, recovery profile and control cost has
// one authored home. Camp chooses protection; profile chooses recovery stats.
export const combatStatusRules = {
  version: 2,
  recovery: { base: 30, minimum: 5, maximum: 80, stackPenalty: 10, pendingRemoval: 0.25 },
  profiles: {
    bodily: { constitution: 1, wisdom: 0, intelligence: 0 },
    elemental: { constitution: 0.5, wisdom: 0, intelligence: 0.5 },
    mental: { constitution: 0, wisdom: 0.75, intelligence: 0.25 },
    curse: { constitution: 0, wisdom: 0.5, intelligence: 0.5 },
  },
  statuses: {
    bleed: { camp: 'physical', profile: 'bodily', activeStatus: 'bleeding', initialThreshold: 7, activeThreshold: 7, cap: 3, chanceRecovery: true },
    venom: { camp: 'physical', profile: 'bodily', activeStatus: 'venom', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
    frost: { camp: 'spell', profile: 'elemental', activeStatus: 'frozen', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true, grants: { chilled: 1 } },
    burn: { camp: 'spell', profile: 'elemental', activeStatus: 'burn', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
    crimsonBlight: { camp: 'spell', profile: 'curse', activeStatus: 'crimsonBlight', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
    paralysis: { camp: 'spell', profile: 'elemental', activeStatus: 'paralysis', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true, lock: true, recoveryCost: 3 },
    sleep: { camp: 'spell', profile: 'mental', activeStatus: 'sleep', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true, lock: true, recoveryCost: 2 },
    dazed: { camp: 'physical', profile: 'bodily', activeStatus: 'dazed', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true, lock: true, recoveryCost: 1 },
    weak: { camp: 'physical', profile: 'bodily', activeStatus: 'weak', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
    vulnerable: { camp: 'physical', profile: 'bodily', activeStatus: 'vulnerable', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
    offBalance: { camp: 'physical', profile: 'bodily', activeStatus: 'offBalance', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true },
  },
  sleep: { status: 'sleep', hpPerStack: 2, hpCombatCap: 6, wardCombatCap: 1, damagePercentPerStack: 10 },
  prone: { status: 'prone', contactPercent: 25, rangedSinglePercent: -25, nearEvade: 2, farEvade: 4, standCost: 1 },
  frozen: { status: 'frozen', actionLoss: 1 },
  interactions: { frostGauge: 'frost', frozen: 'frozen', chilled: 'chilled', grounded: 'grounded', paralysis: 'paralysis', offBalance: 'offBalance', decoy: 'decoy', concealment: 'concealed', chilledBluntPercent: 25 },
  restoration: { alterationCombatCap: 1 },
};

// Existing Burn/Crimson Blight hooks continue to own their ongoing damage.
// Bleeding is v2's active ailment; legacy Bleed remains its v1 threshold proc.
export const expansionStatuses = [
  { id: 'bleeding', name: 'Bleeding', icon: '🩸', stackMode: 'add', decay: 'none', hooks: [{ on: 'ownerTurnStart', do: [{ op: 'loseHp', target: 'owner', amount: { f: 'stacks', status: 'bleeding', of: 'owner' } }] }], tooltip: 'Lose 1 HP per stack at turn start. Bodily Chance Recovery.' },
  { id: 'frozen', name: 'Frozen', icon: '❄', stackMode: 'add', decay: 'none', tooltip: 'One stack denies one Action. Fire thaws; Blunt shatters. Elemental Chance Recovery.' },
  { id: 'chilled', name: 'Chilled', icon: '❅', stackMode: 'refresh', decay: 'onConsume', tooltip: 'The next connected Blunt action deals 25% more damage. Fire thaws.' },
  { id: 'sleep', name: 'Sleep', icon: '☾', stackMode: 'add', decay: 'none', tooltip: 'Locks ordinary cards, Counter and card Evade. Rest restores up to 6 HP and 1 Ward per combat. +10% direct damage received per active stack. Break Sleep: 2 SP per stack.' },
  { id: 'paralysis', name: 'Paralysis', icon: 'ϟ', stackMode: 'add', decay: 'none', tooltip: 'Locks ordinary cards, Counter and card Evade. Break Paralysis: 3 SP per stack. Grounding clears its pressure.' },
  { id: 'dazed', name: 'Dazed', icon: '✦', stackMode: 'add', decay: 'none', tooltip: 'Locks ordinary cards, Counter and card Evade. Clear Dazed: 1 SP per stack.' },
  { id: 'offBalance', name: 'Off Balance', icon: '↯', stackMode: 'add', decay: 'perTurnEnd', tooltip: 'Disadvantage on bodily recovery. One stack expires at turn end.' },
  { id: 'prone', name: 'Prone', icon: '↓', stackMode: 'unique', decay: 'none', tooltip: '+25% Contact damage, −25% Single Near/Far damage. +2/+4 Evade against Near/Far Martial weapons. Stand Up: 1 SP after hand locks clear.' },
  { id: 'grounded', name: 'Grounded', icon: '⏚', stackMode: 'refresh', decay: { duration: 2 }, tooltip: 'Prevents electrical conductivity and backlash; grants Advantage on Paralysis recovery.' },
  { id: 'invulnerability', name: 'Invulnerability', icon: '◈', stackMode: 'add', decay: 'none', tooltip: 'Consume one stack to avoid the next direct damaging action, including all its hits. Status buildup still applies; no Counter return. Damage over time does not consume it.' },
  { id: 'decoy', name: 'Decoy', icon: '◇', stackMode: 'add', decay: 'none', tooltip: 'Consume one stack to avoid a Single Near/Far damaging action. Status buildup still applies. Sweep and Holy revelation clear it.' },
  { id: 'concealed', name: 'Concealed', icon: '◌', stackMode: 'refresh', decay: { duration: 2 }, tooltip: 'Concealment. Sweep and Holy revelation clear it.' },
];
