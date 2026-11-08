// src/model/validate/uiHolds.js — the hold-gesture dials: holdConfirm, titleLoadHold, holdBeat, inspectHold, handLayout.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

export function uiHoldProblems(b, err, ctx) {
  // balance.ui.holdConfirm — THE DIAL THAT DISABLES A SAFETY FEATURE WHEN IT IS
  // WRONG, so it is the last thing that may fail quiet. Vira's finding: it
  // validated against NOTHING. `steps: { normal: 'abc' }` reaches
  // `Number('abc') || 0` in ui/components/holdconfirm.js, resolves to 0 ms, and
  // the hold silently does not exist — while `validateContent` returns ok:true
  // with zero errors naming it. Law 1 clause 5 failing quiet, on the one control
  // whose failure is invisible by construction: nothing on the screen looks
  // different, the bars just commit on a tap again.
  //
  // Meaning, not shape, which is why it is here and not in SCHEMAS: whether
  // `def` names a step that EXISTS needs two fields to ask.
  if (b.balance && b.balance.ui && b.balance.ui.holdConfirm != null) {
    const hc = b.balance.ui.holdConfirm;
    if (typeof hc !== 'object' || Array.isArray(hc)) {
      err('balance.ui.holdConfirm', 'must be an object { def, steps }');
    } else {
      const steps = hc.steps;
      if (typeof steps !== 'object' || steps == null || Array.isArray(steps)) {
        err('balance.ui.holdConfirm.steps', 'must be an object of name -> milliseconds');
      } else {
        const names = Object.keys(steps);
        if (!names.length) err('balance.ui.holdConfirm.steps', 'must offer at least one position');
        for (const k of names) {
          const v = steps[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            err(`balance.ui.holdConfirm.steps.${k}`, `must be a non-negative number of milliseconds — got ${JSON.stringify(v)}. `
              + `A value the code cannot read resolves to 0 ms, which silently turns the confirm step OFF.`);
          }
        }
        if (!Object.hasOwn(steps, hc.def)) {
          err('balance.ui.holdConfirm.def', `${JSON.stringify(hc.def)} is not one of the steps offered (${names.join(', ')}) — `
            + `the default position must exist, or every player starts on a setting the row cannot show.`);
        }
      }
    }
  }
  // balance.ui.titleLoadHold — the title slot's quick-load gesture. A malformed
  // value would otherwise fall back inside the view and make the authored row
  // decorative rather than authoritative, so fail by the row's own name.
  if (b.balance && b.balance.ui && b.balance.ui.titleLoadHold != null) {
    const lh = b.balance.ui.titleLoadHold;
    if (typeof lh !== 'object' || Array.isArray(lh)) {
      err('balance.ui.titleLoadHold', 'must be an object { ms }');
    } else if (typeof lh.ms !== 'number' || !Number.isFinite(lh.ms) || lh.ms <= 0) {
      err('balance.ui.titleLoadHold.ms', `must be a positive number of milliseconds — got ${JSON.stringify(lh.ms)}. `
        + `The title quick-load gesture needs a real hold boundary distinct from an ordinary tap.`);
    }
  }
  // balance.ui.holdBeat — THE SAME FAILURE SHAPE AS holdConfirm, one control
  // over. The beat is the only feedback a held control has once a thumb is on
  // top of the fill, and every way this row can be wrong is SILENT: a fraction
  // of 1.4 never arrives, a NaN compares false against every progress value, a
  // descending list fires the late tick first and then never again, and a
  // duplicate fires two ticks in one frame that a player hears as one. In all
  // four the screen is unchanged and the sound simply is not there — which is
  // the exact state the beat exists to distinguish from a tap that missed.
  //
  // An EMPTY array is legal and means "no ticks, commit only": turning the
  // train off is a tuning decision, and refusing it here would make the row a
  // lie about what one edit can do.
  if (b.balance && b.balance.ui && b.balance.ui.holdBeat != null) {
    const hb = b.balance.ui.holdBeat;
    if (typeof hb !== 'object' || Array.isArray(hb)) {
      err('balance.ui.holdBeat', 'must be an object { at: [fractions] }');
    } else if (!Array.isArray(hb.at)) {
      err('balance.ui.holdBeat.at', `must be an array of fractions of the fill (0 <= f < 1) — got ${JSON.stringify(hb.at)}. `
        + `A value the beat cannot read fires no ticks, and a hold with no ticks is the defect this row exists for.`);
    } else {
      let prev = -1;
      hb.at.forEach((f, i) => {
        if (typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f >= 1) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be a number in [0, 1) — got ${JSON.stringify(f)}. `
            + `1.0 is not a tick: the arrival is the 'holdCommit' recipe, and putting it here would give the landing two homes.`);
        } else if (f <= prev) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be strictly greater than at[${i - 1}] (${prev}) — got ${f}. `
            + `The fill only ever runs forward, so an out-of-order or duplicated fraction is a tick that fires twice in one frame or never fires at all.`);
        } else {
          prev = f;
        }
      });
    }
  }
  // balance.ui.inspectHold — the reading hold on the hand. The consumer is
  // `Number(...) || 0` shaped like holdConfirm's, so a typo'd row would resolve
  // to 0 and silently REMOVE the gesture: nothing on screen looks different, a
  // held card simply never expands — the same silent-plausible failure as the
  // rows above (Law 0 clause 5). `ms: 0` on purpose is legal and means off; a
  // row that cannot be READ is not a zero, it is a mistake, and it fails here
  // by name.
  if (b.balance && b.balance.ui && b.balance.ui.inspectHold != null) {
    const ih = b.balance.ui.inspectHold;
    if (typeof ih !== 'object' || Array.isArray(ih)) {
      err('balance.ui.inspectHold', 'must be an object { ms }');
    } else if (typeof ih.ms !== 'number' || !Number.isFinite(ih.ms) || ih.ms < 0) {
      err('balance.ui.inspectHold.ms', `must be a non-negative number of milliseconds — got ${JSON.stringify(ih.ms)}. `
        + `The consumer resolves an unreadable value to 0, which takes the inspect gesture off every card with nothing on the screen looking different.`);
    }
  }
  // balance.ui.handLayout — the hand-layout word (C2: overlap AND paging, one
  // knob). The consumer guards a stored player setting against the modes list
  // and falls back to THIS row — so if this row itself is garbage, the
  // fallback is garbage and the narrow hand silently renders in whatever the
  // CSS default happens to be, with nothing on screen saying a mode was ever
  // chosen (Law 0 clause 5, again). Loud, by name, at boot.
  if (b.balance && b.balance.ui && (b.balance.ui.handLayout != null || b.balance.ui.handLayoutModes != null)) {
    const modes = b.balance.ui.handLayoutModes;
    if (!Array.isArray(modes) || modes.length === 0 || modes.some((m) => typeof m !== 'string' || !m)) {
      err('balance.ui.handLayoutModes', `must be a non-empty array of mode names — got ${JSON.stringify(modes)}. `
        + `It is the closed set the settings guard checks a stored value against; unreadable, every stored choice would land on the default without the player ever being told why.`);
    } else if (typeof b.balance.ui.handLayout !== 'string' || !modes.includes(b.balance.ui.handLayout)) {
      err('balance.ui.handLayout', `must be one of ${modes.join(' | ')} — got ${JSON.stringify(b.balance.ui.handLayout)}. `
        + `This row is the fallback every garbage stored setting lands on; a fallback outside the closed set leaves the hand with no layout word at all.`);
    }
  }
}
