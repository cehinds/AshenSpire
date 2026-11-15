// The Core rest content as it shipped before the one-pick rest (servicesPerVisit 'all', Level Up a service, full recovery on every
// service). A run pins its profile, so a run saved before the change keeps this; tests that exercise Level Up at a rest, or the
// old all-services visit, pin the run to it with `pinLegacyRests(run)` before `beginGameProfileRest`.
export const LEGACY_RESTS = Object.freeze({ servicesPerVisit: 'all', services: ['smith', 'levelUp', 'upgradeCard'],
  recovery: { hp: 'full', sp: 'full', mp: 'full', healingFlasks: 'full', mpFlasks: 'full' }, smith: { free: true, tiersPerService: 1 } });
export function pinLegacyRests(run) {
  run.gameProfile.content.rests = structuredClone(LEGACY_RESTS);
  return run;
}
