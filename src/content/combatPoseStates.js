// Presentation only: these IDs never add statuses, costs, or durations.
export const BLOOD_RITE_STATUSES = Object.freeze([
  'thornHalo', 'communion', 'lifeTithe', 'stigmata', 'zealotry',
  'emberTide', 'harbingerOfBlight',
]);
export const COMBAT_POSE_STATES = Object.freeze({
  prepared: { name: 'Prepared', frame: 'prepared', fallback: 'guard', color: '#ccbaff', motif: 'diamond' },
  starstoneCharge: { name: 'Starstone Charge', frame: 'starstoneCharge', fallback: 'guard', color: '#929fff', motif: 'constellation' },
  bloodRite: { name: 'Blood Rite', frame: 'bloodRite', fallback: 'guard', color: '#df6274', motif: 'halo' },
  gorefire: { name: 'Gorefire Stance', frame: 'attack1', fallback: 'guard', color: '#ef794b', motif: 'halo' },
  bulwark: { name: 'Bulwark Stance', frame: 'shieldGuard3', fallback: 'guard', color: '#8dc9ed', motif: 'diamond' },
});
