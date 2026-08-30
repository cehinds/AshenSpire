// src/ui/screens/customRun.js — Custom Climb setup (SPEC §10 ascension seam).
//
// Pick a class, an Ascension level (a preset that stacks difficulty rules), any
// individual difficulty/chaos toggles, a deck mode, and a seed — then hand the
// assembled { classId, seedString, custom } to the orchestrator. Custom runs
// are flagged and kept out of win-rate telemetry (see history.js).

import {
  DIFFICULTY_MODS, CHAOS_MODS, DECK_MODES, ASCENSION_ORDER, MAX_ASCENSION, activeMods,
} from '../../content/customMods.js';
import { MAP_SHAPE_LIMITS } from '../../content/mapconfig.js';
import { applyRunShape, minViableFloors, resolveFloorPlan } from '../../model/floorplan.js';
import { sampleActShape } from '../../engine/mapgen.js';
import { classGlyph } from '../assets.js';
import { esc } from '../components/tooltip.js';
import { createRunState } from '../../model/state.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';

/** How many seeds the live estimate averages. Named, because it is printed. */
const ESTIMATE_SEEDS = 24;

export function mountCustomRun(app, { registries, defaultSeedString, onBack, onStart }) {
  const state = {
    classId: registries.classes.all()[0].id,
    ascension: 0,
    mods: {}, // explicit toggles (on top of ascension-enabled rules)
    deckMode: 'standard',
  };

  // ---- the run shape: every bound below is DERIVED from the acts themselves --
  // Nothing about the three knobs is typed on this screen. `acts` is whatever
  // content authors; the floors slider's low end is what those acts' own floor
  // rules resolve at; the weight rows ARE the keys of `typeWeights`. Add a node
  // type to content/mapconfig.js and a slider appears here with no edit to this
  // file — that is the Law 0 falsifier for this feature, and it is why the loop
  // below reads the act instead of a list.
  const acts = Object.entries(registries.mapConfigs || {})
    .map(([act, cfg]) => ({ act: Number(act), cfg }))
    .sort((a, b) => a.act - b.act);
  const baseCfg = acts.length ? acts[0].cfg : null;
  const shapeable = !!(baseCfg && baseCfg.typeWeights);
  const floorsMax = shapeable ? Math.max(...acts.map((a) => a.cfg.floors)) : 0;
  const colsMax = shapeable ? Math.max(...acts.map((a) => a.cfg.columns)) : 0;
  // The shortest act every act's own rules survive — the strictest of them, so
  // a cap the slider offers cannot break act 3 while act 1 is fine.
  const floorsMin = shapeable
    ? acts.reduce((worst, a) => {
      const m = minViableFloors(a.cfg);
      return m.error ? Math.max(worst, floorsMax) : Math.max(worst, m.floors);
    }, 2)
    : 0;
  const weightKeys = shapeable ? Object.keys(baseCfg.typeWeights) : [];
  // Live knob positions start ON the authored values, so an untouched section
  // emits no shape at all and every existing seed replays byte for byte.
  const shape = {
    floors: floorsMax,
    columns: colsMax,
    weights: shapeable ? { ...baseCfg.typeWeights } : {},
  };

  /**
   * The entry this screen hands the orchestrator — ONLY what differs from the
   * authored act. A shape of `{}` is `null`: "he opened the panel and changed
   * nothing" and "he never opened it" must produce the same run.
   */
  function mapShapeEntry() {
    if (!shapeable) return null;
    const out = {};
    if (shape.floors < floorsMax) out.floors = shape.floors;
    if (shape.columns < colsMax) out.columns = shape.columns;
    const w = {};
    for (const k of weightKeys) if (shape.weights[k] !== baseCfg.typeWeights[k]) w[k] = shape.weights[k];
    if (Object.keys(w).length) out.typeWeights = w;
    return Object.keys(out).length ? out : null;
  }

  /** Every act resolved at the current shape — the one place the screen asks. */
  function resolveShape() {
    const entry = mapShapeEntry();
    return acts.map(({ act, cfg }) => ({ act, entry, ...applyRunShape(cfg, entry, MAP_SHAPE_LIMITS) }));
  }

  /**
   * The refusal sentence, or null. The SAME resolver the generator will run, so
   * a shape this screen accepts cannot throw at act build and a shape it refuses
   * names the same knob the engine would have named.
   */
  function shapeProblem() {
    for (const r of resolveShape()) {
      if (r.errors.length) return `Act ${r.act}: ${r.errors.map((e) => `${e.key} — ${e.msg}`).join(' · ')}`;
    }
    return null;
  }

  app.innerHTML = `
    <div class="screen customrun" style="justify-content:flex-start;overflow-y:auto;gap:16px;padding-top:26px">
      <h2 style="color:var(--gold);font-size:24px;letter-spacing:.2em">CUSTOM CLIMB</h2>
      <p class="subtitle">SHAPE YOUR OWN ASCENT — RESULTS ARE KEPT OUT OF WIN-RATE STATS</p>

      <div style="display:flex;flex-direction:column;gap:16px;max-width:680px;width:92%">
        <div><p class="cz-label">CLASS</p><div id="cr-classes" class="class-row" style="flex-wrap:wrap;justify-content:center"></div></div>

        <div>
          <p class="cz-label">ASCENSION <span id="cr-asc-val" style="color:var(--gold)">0</span> / ${MAX_ASCENSION}</p>
          <input id="cr-asc" type="range" min="0" max="${MAX_ASCENSION}" step="1" value="0" style="width:100%;accent-color:var(--gold)">
          <p class="set-note" id="cr-asc-note">No extra difficulty. Slide up to stack the rules below.</p>
        </div>

        <div><p class="cz-label">DIFFICULTY RULES</p><div id="cr-diff" class="mod-grid"></div></div>
        <div><p class="cz-label">CHAOS</p><div id="cr-chaos" class="mod-grid"></div></div>
        <div><p class="cz-label">STARTING DECK</p><div id="cr-deck" class="mod-grid"></div></div>

        ${shapeable ? `
        <div class="runshape" id="cr-shape">
          <button class="runshape-toggle" id="cr-shape-toggle" aria-expanded="false" aria-controls="cr-shape-body">
            <span class="rs-title">ADVANCED · DEBUG — RUN SHAPE</span>
            <span class="rs-state" id="cr-shape-state">off</span>
            <span class="rs-caret" aria-hidden="true">▾</span>
          </button>
          <div class="runshape-body" id="cr-shape-body" hidden>
            <p class="set-note rs-intro">Shorten the climb. Caps the act, and biases what the map rolls — for testing a full run in one sitting.</p>

            <div class="rs-readout">
              <b id="cr-shape-big">—</b>
              <span id="cr-shape-sub"></span>
              <span class="rs-boundary" id="cr-shape-bound"></span>
            </div>

            <div class="rs-knob">
              <label class="rs-knob-head" for="cr-shape-floors">
                <span>Floors per act</span><span class="rs-val" id="cr-shape-floors-val">${floorsMax}</span>
              </label>
              <input class="rs-slider" id="cr-shape-floors" type="range"
                     min="${floorsMin}" max="${floorsMax}" step="1" value="${floorsMax}">
              <p class="set-note rs-why" id="cr-shape-floors-why"></p>
            </div>

            <div class="rs-knob">
              <label class="rs-knob-head" for="cr-shape-cols">
                <span>Map width</span><span class="rs-val" id="cr-shape-cols-val">${colsMax}</span>
              </label>
              <input class="rs-slider" id="cr-shape-cols" type="range"
                     min="${MAP_SHAPE_LIMITS.minColumns}" max="${colsMax}" step="1" value="${colsMax}">
              <p class="set-note rs-why">Columns the walkers may spread across. Narrower is a shorter, straighter act.</p>
            </div>

            <div class="rs-knob rs-group">
              <p class="rs-group-head"><span>NODE ODDS</span><span class="rs-val" id="cr-shape-odds-val"></span></p>
              <div class="rs-weights" id="cr-shape-weights"></div>
              <p class="set-note rs-why" id="cr-shape-weights-why"></p>
            </div>

            <button class="subtle rs-reset" id="cr-shape-reset">Reset run shape</button>
          </div>
        </div>` : ''}

        <div class="seed-line">Seed <input id="cr-seed" type="text" value="${esc(defaultSeedString)}"></div>
      </div>

      <div style="display:flex;gap:14px;padding-bottom:24px">
        <button class="subtle" id="cr-back">Back</button>
        <button id="cr-start">BEGIN THE CLIMB</button>
      </div>
    </div>`;

  const $ = (s) => app.querySelector(s);

  // ---- class picks ----
  const classes = $('#cr-classes');
  for (const cls of registries.classes.all()) {
    const el = document.createElement('div');
    el.className = 'class-pick cr-class';
    el.dataset.classId = cls.id;
    // Derived HP from the run's own home (createRunState: class base +
    // attribute tiers + baseline kit), never bare cls.maxHp — a component
    // posing as a total, same defect Vega fixed on the customize chip (#175
    // rider). No profileMeta here and none needed: with no requested kit the
    // baseline resolves meta-free (startingKits.js: baseline is always
    // discovered), so this chip and the customize chip print the same number.
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><div class="cp-body"><h3>${esc(cls.name)}</h3><span class="chip">HP ${createRunState({ seed: 0, classId: cls.id, registries }).maxHp}</span></div>`;
    el.addEventListener('click', () => {
      state.classId = cls.id;
      classes.querySelectorAll('.cr-class').forEach((x) => x.classList.toggle('chosen', x === el));
    });
    classes.appendChild(el);
  }
  classes.querySelector('.cr-class').classList.add('chosen');

  // ---- ascension slider (enables the first N difficulty rules) ----
  const ascLabel = $('#cr-asc-val');
  const ascNote = $('#cr-asc-note');
  const asc = $('#cr-asc');
  asc.addEventListener('input', () => {
    state.ascension = Number(asc.value);
    ascLabel.textContent = state.ascension;
    const enabled = ASCENSION_ORDER.slice(0, state.ascension)
      .map((id) => DIFFICULTY_MODS.find((m) => m.id === id).label)
      .join(', ');
    ascNote.textContent = state.ascension ? `Enables: ${enabled}.` : 'No extra difficulty. Slide up to stack the rules below.';
    refreshModChips();
  });

  // ---- mod toggle grids ----
  function modChip(m) {
    const el = document.createElement('button');
    el.className = 'mod-chip';
    el.dataset.mod = m.id;
    el.innerHTML = `<b>${esc(m.label)}</b><span>${esc(m.desc)}</span>`;
    el.addEventListener('click', () => {
      if (el.classList.contains('forced')) return; // locked on by the ascension level
      state.mods[m.id] = !state.mods[m.id];
      refreshModChips();
    });
    return el;
  }
  const diffBox = $('#cr-diff');
  const chaosBox = $('#cr-chaos');
  DIFFICULTY_MODS.forEach((m) => diffBox.appendChild(modChip(m)));
  CHAOS_MODS.forEach((m) => chaosBox.appendChild(modChip(m)));

  // Reflect both explicit toggles and ascension-enabled rules; ascension-forced
  // rules show as "locked on" (can't be turned off below the slider level).
  function refreshModChips() {
    const eff = activeMods(state);
    const forced = new Set(ASCENSION_ORDER.slice(0, state.ascension));
    app.querySelectorAll('.mod-chip').forEach((el) => {
      const id = el.dataset.mod;
      el.classList.toggle('on', !!eff[id]);
      el.classList.toggle('forced', forced.has(id));
    });
  }

  // ---- deck mode ----
  const deckBox = $('#cr-deck');
  DECK_MODES.forEach((m, i) => {
    const el = document.createElement('button');
    el.className = `mod-chip${i === 0 ? ' on' : ''}`;
    el.dataset.deck = m.id;
    el.innerHTML = `<b>${esc(m.label)}</b><span>${esc(m.desc)}</span>`;
    el.addEventListener('click', () => {
      state.deckMode = m.id;
      deckBox.querySelectorAll('.mod-chip').forEach((x) => x.classList.toggle('on', x === el));
    });
    deckBox.appendChild(el);
  });

  // ---- the run shape: controls, and the number that answers the ask --------
  //
  // "I only have the patience for 30 min runs." NOBODY IN THIS TREE CAN MEASURE
  // MINUTES, and a knob handed over with a promise attached is the shape of
  // every feature this family has had to go back and check. What CAN be
  // measured is the thing that drives the length: how many nodes he has to stop
  // on. So the readout is the feature, and it moves while he drags — one live
  // sample, `sampleActShape`, the same function tools/mapplan.mjs prints from.
  let refreshShape = () => {};
  if (shapeable) {
    const weightsBox = $('#cr-shape-weights');
    const sliders = {};
    for (const key of weightKeys) {
      const row = document.createElement('div');
      row.className = 'rs-wrow';
      row.innerHTML = `<span class="rs-whead">`
        + `<span class="rs-wname">${esc(key)}</span>`
        + `<span class="rs-wpct" data-pct="${esc(key)}">—</span></span>`
        + `<input class="rs-slider" type="range" min="0" max="${MAP_SHAPE_LIMITS.maxWeight}" step="1"`
        + ` value="${baseCfg.typeWeights[key]}" data-weight="${esc(key)}"`
        + ` aria-label="${esc(key)} roll weight">`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        shape.weights[key] = Number(input.value);
        refreshShape();
      });
      sliders[key] = input;
      weightsBox.appendChild(row);
    }

    const floorsEl = $('#cr-shape-floors');
    const colsEl = $('#cr-shape-cols');
    floorsEl.addEventListener('input', () => { shape.floors = Number(floorsEl.value); refreshShape(); });
    colsEl.addEventListener('input', () => { shape.columns = Number(colsEl.value); refreshShape(); });

    const toggle = $('#cr-shape-toggle');
    const body = $('#cr-shape-body');
    toggle.addEventListener('click', () => {
      const open = body.hasAttribute('hidden');
      if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', String(open));
      $('#cr-shape').classList.toggle('open', open);
    });

    $('#cr-shape-reset').addEventListener('click', () => {
      shape.floors = floorsMax;
      shape.columns = colsMax;
      for (const k of weightKeys) shape.weights[k] = baseCfg.typeWeights[k];
      floorsEl.value = String(floorsMax);
      colsEl.value = String(colsMax);
      for (const k of weightKeys) sliders[k].value = String(baseCfg.typeWeights[k]);
      refreshShape();
    });

    // The DEFAULT climb, measured once at mount — the reference the shaped
    // number is read against. Measured, never typed: the day an act's shape
    // changes, this moves with it.
    const defaultTotal = acts.reduce(
      (sum, a) => sum + sampleActShape(a.cfg, ESTIMATE_SEEDS).nodes.mean, 0
    );

    refreshShape = () => {
      const resolved = resolveShape();
      const entry = mapShapeEntry();
      $('#cr-shape-floors-val').textContent = String(shape.floors);
      $('#cr-shape-cols-val').textContent = String(shape.columns);
      $('#cr-shape-state').textContent = entry ? 'on' : 'off';
      $('#cr-shape').classList.toggle('shaped', !!entry);

      // The derived share beside every weight — the "percent chance" he asked
      // for, computed from the weights rather than restated as one.
      const total = weightKeys.reduce((a, k) => a + shape.weights[k], 0);
      for (const key of weightKeys) {
        const cell = weightsBox.querySelector(`[data-pct="${key}"]`);
        cell.textContent = total > 0 ? `${Math.round((shape.weights[key] / total) * 100)}%` : '—';
        cell.classList.toggle('zero', shape.weights[key] === 0);
      }
      $('#cr-shape-odds-val').textContent = total > 0 ? `${total} total weight` : 'no weight';
      // THE CAVEATS ARE THE RESOLVER'S OWN SENTENCES, not this screen's. Every
      // way a weight can mean less than it looks — Monster's fallback, a type
      // the act force-places to keep a minimum — is written once, in
      // applyRunShape, and printed here. A second wording on the screen is a
      // second copy of a fact, and it would be the copy that goes stale.
      const notes = resolved.flatMap((r) => r.notes || []);
      $('#cr-shape-weights-why').textContent =
        ['Share of the roll, not of the finished map — floor rules and the no-repeat-neighbour ban still override it.']
          .concat([...new Set(notes)]).join(' ');

      const problem = resolved.find((r) => r.errors.length);
      const big = $('#cr-shape-big');
      const sub = $('#cr-shape-sub');
      const bound = $('#cr-shape-bound');
      if (problem) {
        big.textContent = '—';
        sub.textContent = `Act ${problem.act}: ${problem.errors[0].msg}`;
        bound.textContent = '';
      } else {
        const per = resolved.map((r) => sampleActShape(r.config, ESTIMATE_SEEDS));
        const climb = per.reduce((a, s) => a + s.nodes.mean, 0);
        const lo = per.reduce((a, s) => a + s.nodes.min, 0);
        const hi = per.reduce((a, s) => a + s.nodes.max, 0);
        big.textContent = `≈ ${Math.round(climb)} stops`;
        sub.textContent = `over ${per.length} act${per.length === 1 ? '' : 's'}`
          + ` · range ${lo}–${hi} · default is ≈ ${Math.round(defaultTotal)}`
          + (entry ? ` · ${Math.round((1 - climb / defaultTotal) * 100)}% shorter` : '');

        // A SHORT ACT CAN BREAK A PROMISE THE ACT MAKES TO ITSELF, and it does
        // so silently. `minElites: 2` is kept by force-placing into eligible
        // Monster nodes; squeeze the act to 4x2 and there are not enough of
        // them, so relaxPlace runs out and stops. Measured: 1.87 elites and
        // 0.54 merchants a map at floors=4 columns=2, against promises of 2 and
        // 1. That is not a reason to refuse the shape — a 20-stop climb is
        // exactly what he asked for — but it is a reason to SAY it. Derived by
        // sampling, because how many nodes a 4x2 act has is a distribution and
        // not a formula, so nothing can answer it from the config alone.
        const shortfalls = [];
        resolved.forEach((r, i) => {
          const minima = (resolveFloorPlan(r.config).plan || {}).minima || {};
          for (const [t, want] of Object.entries(minima)) {
            const got = per[i].byType[t] || 0;
            // TWO DECIMALS, and it is not fussiness: at one decimal a mean of
            // 1.99 prints "2.0 of 2", which reads as the promise being KEPT in
            // the sentence saying it is broken.
            if (want > 0 && got < want) shortfalls.push(`${t} ${got.toFixed(2)} of ${want}`);
          }
        });
        bound.textContent = shortfalls.length
          ? `nodes across ${ESTIMATE_SEEDS} seeds — the driver of run length, not minutes.`
            + ` This act is too small to keep its own guarantees: ${[...new Set(shortfalls)].join(', ')} per map.`
          : `nodes across ${ESTIMATE_SEEDS} seeds — the driver of run length, not minutes`;
        bound.classList.toggle('warn', shortfalls.length > 0);
      }

      seedRefusal();
    };
  }

  // Custom Climb is the screen Constantine asked for so a short run could be
  // REPEATED, and this field is what makes a run repeatable. Same component,
  // same sentence, same refusal as the ordinary new-run screen — the vocabulary
  // is not retyped here, and there is no second place for it to drift.
  const seed = attachSeedField($('#cr-seed'));
  // ONE reason function for the one button. The seed field and the run shape
  // both refuse here, and they refuse through the same component for the same
  // reason: a control a player can see and cannot use has to say why, where
  // they are looking. Two independent guards on one button would be two chances
  // to disagree about whether it is usable.
  const startProblem = () => seed.problem() || shapeProblem();
  const seedRefusal = refusesWhen($('#cr-start'), startProblem, () => {
    const cls = registries.classes.all().find((c) => c.id === state.classId);
    return `Begin the climb as <b>${esc(cls ? cls.name : state.classId)}</b>`
      + ` at <b>Ascension ${state.ascension}</b>.<br>Results are kept out of win-rate stats.`;
  });
  seed.onChange(() => seedRefusal());

  $('#cr-back').addEventListener('click', onBack);
  $('#cr-start').addEventListener('click', () => {
    if (startProblem()) return; // the refusal already said why, at the button
    const mapShape = mapShapeEntry();
    onStart({
      classId: state.classId,
      seedString: $('#cr-seed').value.trim(),
      custom: {
        ascension: state.ascension,
        mods: { ...state.mods },
        deckMode: state.deckMode,
        // Absent, not null, when untouched — `custom` keeps the exact shape it
        // has always had for an ordinary Custom Climb.
        ...(mapShape ? { mapShape } : {}),
      },
    });
  });

  refreshModChips();
  if (shapeable) {
    $('#cr-shape-floors-why').textContent =
      `${floorsMin} is the shortest act this content's own floor rules resolve at — below it two fixed ranks land on the same floor.`;
    refreshShape();
  }
}
