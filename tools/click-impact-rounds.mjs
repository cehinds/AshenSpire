// tools/click-impact-rounds.mjs — the click-impact probe's judgement, apart from the drive.
//
// The probe measures the median click-to-contact and click-to-first-number over a few real
// plays. On a slow shared runner a median of three plays can land over its budget with the
// build unchanged (measured 2026-10-18: number medians 656-695 ms against 750, single plays
// up to 759). So a round that misses a budget is measured ONCE more on a fresh page (same
// seed, same plays) and the last round is the one judged. Both rounds are printed.
//
// `measure(round)` returns { samples, numbers } (arrays of ms) for one fresh page. Fewer
// than MIN_PLAYS samples is "could not measure". Exit codes are the probe's contract:
//   0  the judged round is within both budgets
//   1  the judged round is over a budget
//   2  the first round could not measure (never a pass). A re-measure that cannot measure
//      leaves the first round's verdict (1): a miss is never turned into a pass or a shrug.

export const MIN_PLAYS = 3;

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// One round's numbers against the budgets; pure.
export function judgeRound({ samples, numbers }, budgetMs, numberBudgetMs) {
  const contact = median(samples);
  const number = median(numbers);
  return { contact, number, contactOkay: contact <= budgetMs, numberOkay: number <= numberBudgetMs };
}

export async function judgeRounds(measure, { rounds = 2, budgetMs, numberBudgetMs, log = console.log, error = console.error }) {
  const total = Math.max(1, Math.floor(rounds) || 1);
  const summaries = [];
  let judged = null;
  for (let round = 1; round <= total; round += 1) {
    const got = await measure(round);
    if (got.samples.length < MIN_PLAYS) {
      error(`click-impact-probe: only ${got.samples.length} play(s) measured in round ${round}; need ${MIN_PLAYS}`);
      if (round === 1) return { exitCode: 2, judged: null };
      summaries.push(`round ${round}: could not measure`);
      break;
    }
    const j = judgeRound(got, budgetMs, numberBudgetMs);
    const label = total > 1 ? `round ${round}: ` : '';
    log(`  ${label}${j.contactOkay ? '✓' : '✗'} median click-to-contact ${j.contact} ms over ${got.samples.length} plays (budget ${budgetMs} ms; samples ${got.samples.join(', ')})`);
    log(`  ${label}${j.numberOkay ? '✓' : '✗'} median click-to-first-number ${j.number} ms over ${got.numbers.length} plays (budget ${numberBudgetMs} ms; samples ${got.numbers.join(', ')})`);
    judged = j;
    const verdict = j.contactOkay && j.numberOkay ? 'within budget' : 'over budget';
    summaries.push(`round ${round}: contact ${j.contact} ms, number ${j.number} ms, ${verdict}`);
    if (verdict === 'within budget') break;
    if (round < total) log(`  round ${round} over budget; measuring once more on a fresh page`);
  }
  if (summaries.length > 1) log(`  ${summaries.join('; ')}`);
  const passed = Number(judged.contactOkay) + Number(judged.numberOkay);
  log(`${passed} passed, ${2 - passed} failed`);
  return { exitCode: passed === 2 ? 0 : 1, judged };
}
