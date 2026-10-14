// One budget owner for the simulator and its outer test-suite wrapper.
export const RUNSIM_PLANTS = Object.freeze(['fight-throw', 'combat-stall', 'map-cycle']);
export const RUNSIM_PLANT_TIMEOUT_MS = 60_000;
export const RUNSIM_FLEET_TIMEOUT_MS = 120_000;
// Every child can consume its full budget, plus one minute for startup/reporting.
export const RUNSIM_SELFTEST_TIMEOUT_MS = RUNSIM_PLANTS.length * RUNSIM_PLANT_TIMEOUT_MS
  + 2 * RUNSIM_FLEET_TIMEOUT_MS + 60_000;

export function completedFleet(result) {
  if (result.error || result.status !== 0) return false;
  const reports = String(result.stdout || '').match(/^RESULT: (.*)$/gm) || [];
  return reports.length === 1 && /^RESULT: (?!FAILED).+\.$/.test(reports[0]);
}

export function repeatedCompleteFleets(first, second) {
  return completedFleet(first) && completedFleet(second) && first.stdout === second.stdout;
}
