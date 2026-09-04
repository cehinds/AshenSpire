// src/ui/screens/customRun.js — Custom Climb setup (SPEC §10 ascension seam).
//
// Pick a class, an Ascension level (a preset that stacks difficulty rules), any
// individual difficulty/chaos toggles, a deck mode, and a seed — then hand the
// assembled { classId, seedString, custom } to the orchestrator. Custom runs
// are flagged and kept out of win-rate telemetry (see history.js).
//
// ON THE KIT. A page door (head, scrolling body, the foot's Back / Begin on
// the button ladder). The class is a list of OptionCards; Ascension is a
// Row·setting with a range; every difficulty and chaos rule is a Row·setting
// with a LabelStack and a Toggle (a StatePill when the ascension level holds
// it on); the deck mode is a Segmented; the run shape is the D26 fold over
// Rows·setting with ranges and a DetailCard for the readout; the seed is the
// shared seed field in a Row·setting; and a DetailCard sums the climb up.

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
import { mountDisclosure } from '../components/disclosure.js';
import {
  el, eyebrow, titleS, subtitle, flavour, hairline, statusText, options, optionCard, row, labelStack,
  toggle, segmented, pill, chip, statStrip, detailCard, button, buttonRow, modalHead, modalFooter,
} from '../kit/index.js';

/** How many seeds the live estimate averages. Named, because it is printed. */
const ESTIMATE_SEEDS = 24;

/** A section's head: Eyebrow + Title·S. */
const sectionHead = (kicker, title) => el('div', { class: 'set-section-head' }, [eyebrow(kicker), titleS(title, { tag: 'h3' })]);

/** A section: its head, a hairline, its rows. */
const section = (kicker, title, children, attrs = {}) => el('section', { ...attrs, class: `as-pane flush${attrs.class ? ` ${attrs.class}` : ''}` }, [
  sectionHead(kicker, title), hairline(), ...(Array.isArray(children) ? children : [children]),
]);

/** A range in a Row·setting: label + note on the left, the value and the track on the right. */
function rangeRow({ id, label, hint, min, max, value, valueId, attrs = {} }) {
  const input = el('input', { ...attrs, id, type: 'range', min: String(min), max: String(max), step: '1', value: String(value), 'aria-label': label });
  const readout = statusText(String(value), { class: 'range-val', id: valueId });
  return {
    node: row({ tag: 'div', setting: true, labelNode: labelStack({ label, hint }), status: '', trail: [readout, input], attrs: { dataset: { range: id } } }),
    input, readout,
  };
}

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

  // ---- the page door --------------------------------------------------------
  const classes = options([], { id: 'cr-classes' });
  const asc = el('input', { id: 'cr-asc', type: 'range', min: '0', max: String(MAX_ASCENSION), step: '1', value: '0', 'aria-label': 'Ascension' });
  const ascValue = statusText('0', { class: 'range-val', id: 'cr-asc-val' });
  const ascNote = flavour('No extra difficulty. Slide up to stack the rules below.', { id: 'cr-asc-note' });
  const ascRow = row({ tag: 'div', setting: true, labelNode: labelStack({ label: `Ascension · up to ${MAX_ASCENSION}` }), trail: [ascValue, asc] });
  const diffBox = el('div', { id: 'cr-diff', class: 'as-stack tight' });
  const chaosBox = el('div', { id: 'cr-chaos', class: 'as-stack tight' });
  const deckBox = el('div', { id: 'cr-deck' });
  const seedInput = el('input', { id: 'cr-seed', type: 'text', value: defaultSeedString });
  const seedRow = row({ tag: 'div', setting: true, className: 'seed-line', labelNode: labelStack({ label: 'Seed', hint: 'The same seed produces the same climb.' }), trail: seedInput });
  const summary = detailCard({ eyebrow: 'Your climb', name: '—', line: '—', meta: '—', attrs: { id: 'cr-summary' } });

  // The run shape: a fold (the one fold renderer) over a readout and knobs.
  let shapeHost = null;
  let shapeBody = null;
  let floorsKnob = null;
  let colsKnob = null;
  const weightRows = new Map();
  let readout = null;
  let oddsValue = null;
  let weightsWhy = null;
  let stateMark = null;
  let resetShape = null;
  if (shapeable) {
    readout = detailCard({ eyebrow: 'Estimated length', name: '—', line: '—', meta: '—', attrs: { id: 'cr-shape-readout' } });
    readout.querySelector('.dc-name').id = 'cr-shape-big';
    readout.querySelector('.dc-line').id = 'cr-shape-sub';
    readout.querySelector('.dc-meta').id = 'cr-shape-bound';
    floorsKnob = rangeRow({ id: 'cr-shape-floors', label: 'Floors per act', hint: '…', min: floorsMin, max: floorsMax, value: floorsMax, valueId: 'cr-shape-floors-val' });
    floorsKnob.node.querySelector('.ls-hint').id = 'cr-shape-floors-why';
    colsKnob = rangeRow({
      id: 'cr-shape-cols', label: 'Map width', hint: 'Columns the walkers may spread across. Narrower is a shorter, straighter act.',
      min: MAP_SHAPE_LIMITS.minColumns, max: colsMax, value: colsMax, valueId: 'cr-shape-cols-val',
    });
    oddsValue = statusText('', { id: 'cr-shape-odds-val' });
    weightsWhy = flavour('', { id: 'cr-shape-weights-why' });
    const weightsBox = el('div', { id: 'cr-shape-weights', class: 'as-stack tight' });
    for (const key of weightKeys) {
      const knob = rangeRow({
        id: `cr-shape-weight-${key}`, label: key, hint: '', min: 0, max: MAP_SHAPE_LIMITS.maxWeight,
        value: baseCfg.typeWeights[key], valueId: `cr-shape-weight-${key}-val`, attrs: { dataset: { weight: key }, 'aria-label': `${key} roll weight` },
      });
      knob.readout.dataset.pct = key;
      weightRows.set(key, knob);
      weightsBox.appendChild(knob.node);
    }
    resetShape = button({ label: 'Reset run shape', id: 'cr-shape-reset' });
    shapeBody = el('div', { id: 'cr-shape-body', class: 'as-pane flush as-stack' }, [
      flavour('Shorten the climb. Caps the act, and biases what the map rolls — for testing a full run in one sitting.'),
      readout,
      el('div', { class: 'as-stack tight' }, [floorsKnob.node, colsKnob.node]),
      el('div', { class: 'as-stack tight' }, [
        el('div', { class: 'as-pane-head' }, [eyebrow('Node odds'), oddsValue]),
        weightsBox,
        weightsWhy,
      ]),
      buttonRow({ size: 'long', buttons: [resetShape] }),
    ]);
    stateMark = pill({ label: 'off', on: false, attrs: { id: 'cr-shape-state' } });
    shapeHost = el('div', { id: 'cr-shape', class: 'cz-disc' }, shapeBody);
  }

  const head = modalHead({ eyebrow: 'Custom climb', title: 'Shape your own ascent', closeLabel: 'Back' });
  head.querySelector('.modal-close').hidden = true; // the way back is Back, in the foot
  const back = button({ label: 'Back', id: 'cr-back' });
  const start = button({ label: 'Begin the climb', id: 'cr-start', weight: 'primary' });
  const foot = modalFooter({ note: 'Results are kept out of win-rate stats.', secondary: [back], primary: start, size: 'medium' });
  const body = el('div', { class: 'modal-body' }, [
    subtitle('Results are kept out of win-rate stats.'),
    section('Choose', 'Class', classes),
    section('Difficulty', 'Ascension', [ascRow, ascNote]),
    section('Rules', 'Difficulty rules', diffBox),
    section('Rules', 'Chaos', chaosBox),
    section('Deck', 'Starting deck', deckBox),
    shapeable ? section('Advanced · debug', 'Run shape', shapeHost, { id: 'cr-shape-section' }) : null,
    section('Seed', 'Seed', seedRow),
    summary,
  ]);
  const door = el('section', { class: 'modal as-page-door', dataset: { size: 'xl' }, role: 'region', 'aria-label': 'Custom climb' }, [head, body, foot]);
  app.replaceChildren(el('div', { class: 'screen customrun as-page' }, door));

  const $ = (s) => app.querySelector(s);

  // ---- class picks ----
  const classCards = new Map();
  for (const cls of registries.classes.all()) {
    // Derived HP from the run's own home (createRunState: class base +
    // attribute tiers + baseline kit), never bare cls.maxHp — a component
    // posing as a total, same defect Vega fixed on the customize chip (#175
    // rider). No profileMeta here and none needed: with no requested kit the
    // baseline resolves meta-free (startingKits.js: baseline is always
    // discovered), so this chip and the customize chip print the same number.
    const hp = createRunState({ seed: 0, classId: cls.id, registries }).maxHp;
    const card = optionCard({
      glyph: classGlyph(cls.id), name: cls.name, selected: cls.id === state.classId,
      body: statStrip([chip({ key: 'HP', value: hp })]),
      className: `class-pick cr-class${cls.id === state.classId ? ' chosen' : ''}`,
      attrs: { dataset: { classId: cls.id } },
    });
    card.addEventListener('click', () => {
      state.classId = cls.id;
      for (const [id, node] of classCards) {
        const on = id === cls.id;
        node.classList.toggle('chosen', on);
        node.classList.toggle('is-selected', on);
        node.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      refreshSummary();
    });
    classCards.set(cls.id, card);
    classes.appendChild(card);
  }

  // ---- ascension slider (enables the first N difficulty rules) ----
  asc.addEventListener('input', () => {
    state.ascension = Number(asc.value);
    ascValue.textContent = String(state.ascension);
    const enabled = ASCENSION_ORDER.slice(0, state.ascension)
      .map((id) => DIFFICULTY_MODS.find((m) => m.id === id).label)
      .join(', ');
    ascNote.textContent = state.ascension ? `Enables: ${enabled}.` : 'No extra difficulty. Slide up to stack the rules below.';
    refreshModChips();
  });

  // ---- mod toggle rows ----
  const modRows = new Map();
  function modRow(m) {
    const control = toggle({ on: false, className: 'mod-chip', attrs: { dataset: { mod: m.id }, 'aria-label': m.label } });
    const held = pill({ label: 'Ascension', on: true });
    held.hidden = true;
    const line = row({ tag: 'div', setting: true, labelNode: labelStack({ label: m.label, hint: m.desc }), trail: [held, control], attrs: { dataset: { modRow: m.id } } });
    control.addEventListener('click', () => {
      if (control.classList.contains('forced')) return; // locked on by the ascension level
      state.mods[m.id] = !state.mods[m.id];
      refreshModChips();
    });
    modRows.set(m.id, { line, control, held });
    return line;
  }
  DIFFICULTY_MODS.forEach((m) => diffBox.appendChild(modRow(m)));
  CHAOS_MODS.forEach((m) => chaosBox.appendChild(modRow(m)));

  // Reflect both explicit toggles and ascension-enabled rules; ascension-forced
  // rules show as "locked on" (can't be turned off below the slider level).
  function refreshModChips() {
    const eff = activeMods(state);
    const forced = new Set(ASCENSION_ORDER.slice(0, state.ascension));
    for (const [id, { control, held }] of modRows) {
      const on = !!eff[id];
      control.classList.toggle('on', on);
      control.setAttribute('aria-checked', on ? 'true' : 'false');
      control.classList.toggle('forced', forced.has(id));
      control.disabled = forced.has(id);
      held.hidden = !forced.has(id);
    }
    refreshSummary();
  }

  // ---- deck mode: a Segmented ----
  const deckSeg = segmented({
    options: DECK_MODES.map((m, i) => ({ label: m.label, value: m.id, pressed: i === 0, attrs: { dataset: { deck: m.id }, 'aria-label': `${m.label} — ${m.desc}` } })),
    attrs: { role: 'group', 'aria-label': 'Starting deck' },
  });
  const deckNote = flavour(DECK_MODES[0].desc, { id: 'cr-deck-note' });
  deckBox.appendChild(row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Deck mode' }), trail: deckSeg }));
  deckBox.appendChild(deckNote);
  for (const control of deckSeg.querySelectorAll('button')) {
    control.addEventListener('click', () => {
      state.deckMode = control.dataset.deck;
      for (const other of deckSeg.querySelectorAll('button')) {
        const on = other === control;
        other.classList.toggle('on', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      deckNote.textContent = DECK_MODES.find((m) => m.id === state.deckMode)?.desc || '';
      refreshSummary();
    });
  }

  // ---- the run shape: controls, and the number that answers the ask --------
  //
  // "I only have the patience for 30 min runs." NOBODY IN THIS TREE CAN MEASURE
  // MINUTES, and a knob handed over with a promise attached is the shape of
  // every feature this family has had to go back and check. What CAN be
  // measured is the thing that drives the length: how many nodes he has to stop
  // on. So the readout is the feature, and it moves while he drags — one live
  // sample, `sampleActShape`, the same function tools/mapplan.mjs prints from.
  let refreshShape = () => {};
  let shapeFold = null;
  if (shapeable) {
    for (const [key, knob] of weightRows) {
      knob.input.addEventListener('input', () => {
        shape.weights[key] = Number(knob.input.value);
        refreshShape();
      });
    }
    floorsKnob.input.addEventListener('input', () => { shape.floors = Number(floorsKnob.input.value); refreshShape(); });
    colsKnob.input.addEventListener('input', () => { shape.columns = Number(colsKnob.input.value); refreshShape(); });

    // The fold: one face (the D26 renderer), the knobs behind it, shut on
    // arrival. `#cr-shape-toggle` is the face; `#cr-shape-body` is what opens.
    shapeFold = mountDisclosure(shapeHost, [{
      key: 'shape', kind: 'pick', disclosure: 'face',
      face: { label: 'Run shape', value: 'off' },
      reveal: { node: shapeBody, sense: 'Shorten the climb: cap the act and bias what the map rolls.' },
    }]);
    const face = shapeHost.querySelector('[data-face="shape"]');
    face.id = 'cr-shape-toggle';
    face.appendChild(stateMark);
    face.querySelector('.disc-value')?.remove();

    resetShape.addEventListener('click', () => {
      shape.floors = floorsMax;
      shape.columns = colsMax;
      for (const k of weightKeys) shape.weights[k] = baseCfg.typeWeights[k];
      floorsKnob.input.value = String(floorsMax);
      colsKnob.input.value = String(colsMax);
      for (const k of weightKeys) weightRows.get(k).input.value = String(baseCfg.typeWeights[k]);
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
      floorsKnob.readout.textContent = String(shape.floors);
      colsKnob.readout.textContent = String(shape.columns);
      stateMark.textContent = entry ? 'on' : 'off';
      stateMark.dataset.on = entry ? 'true' : 'false';
      shapeHost.classList.toggle('shaped', !!entry);

      // The derived share beside every weight — the "percent chance" he asked
      // for, computed from the weights rather than restated as one.
      const total = weightKeys.reduce((a, k) => a + shape.weights[k], 0);
      for (const key of weightKeys) {
        const cell = weightRows.get(key).readout;
        cell.textContent = total > 0 ? `${Math.round((shape.weights[key] / total) * 100)}%` : '—';
        cell.classList.toggle('zero', shape.weights[key] === 0);
      }
      oddsValue.textContent = total > 0 ? `${total} total weight` : 'no weight';
      // THE CAVEATS ARE THE RESOLVER'S OWN SENTENCES, not this screen's. Every
      // way a weight can mean less than it looks — Monster's fallback, a type
      // the act force-places to keep a minimum — is written once, in
      // applyRunShape, and printed here. A second wording on the screen is a
      // second copy of a fact, and it would be the copy that goes stale.
      const notes = resolved.flatMap((r) => r.notes || []);
      weightsWhy.textContent =
        ['Share of the roll, not of the finished map — floor rules and the no-repeat-neighbour ban still override it.']
          .concat([...new Set(notes)]).join(' ');

      const problem = resolved.find((r) => r.errors.length);
      const big = readout.querySelector('#cr-shape-big');
      const sub = readout.querySelector('#cr-shape-sub');
      const bound = readout.querySelector('#cr-shape-bound');
      if (problem) {
        big.textContent = '—';
        sub.textContent = `Act ${problem.act}: ${problem.errors[0].msg}`;
        bound.textContent = '';
        readout.classList.add('muted');
      } else {
        readout.classList.remove('muted');
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
      refreshSummary();
    };
  }

  // ---- the summary: what the climb is, in one DetailCard ----
  function refreshSummary() {
    const cls = registries.classes.all().find((c) => c.id === state.classId);
    const rules = Object.entries(activeMods(state)).filter(([, on]) => on).length;
    const deck = DECK_MODES.find((m) => m.id === state.deckMode)?.label || state.deckMode;
    summary.querySelector('.dc-name').textContent = cls ? cls.name : state.classId;
    summary.querySelector('.dc-line').textContent = `Ascension ${state.ascension} · ${deck} deck · ${rules} rule${rules === 1 ? '' : 's'} on`;
    const big = readout?.querySelector('#cr-shape-big')?.textContent;
    summary.querySelector('.dc-meta').textContent = `Seed ${seedInput.value.trim() || '—'}${big && big !== '—' ? ` · ${big}` : ''}`;
  }

  // Custom Climb is the screen Constantine asked for so a short run could be
  // REPEATED, and this field is what makes a run repeatable. Same component,
  // same sentence, same refusal as the ordinary new-run screen — the vocabulary
  // is not retyped here, and there is no second place for it to drift.
  const seed = attachSeedField(seedInput);
  // ONE reason function for the one button. The seed field and the run shape
  // both refuse here, and they refuse through the same component for the same
  // reason: a control a player can see and cannot use has to say why, where
  // they are looking. Two independent guards on one button would be two chances
  // to disagree about whether it is usable.
  const startProblem = () => seed.problem() || shapeProblem();
  const seedRefusal = refusesWhen(start, startProblem, () => {
    const cls = registries.classes.all().find((c) => c.id === state.classId);
    return `Begin the climb as <b>${esc(cls ? cls.name : state.classId)}</b>`
      + ` at <b>Ascension ${state.ascension}</b>.<br>Results are kept out of win-rate stats.`;
  });
  seed.onChange(() => { seedRefusal(); refreshSummary(); });

  back.addEventListener('click', onBack);
  start.addEventListener('click', () => {
    if (startProblem()) return; // the refusal already said why, at the button
    const mapShape = mapShapeEntry();
    onStart({
      classId: state.classId,
      seedString: seedInput.value.trim(),
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
    floorsKnob.node.querySelector('#cr-shape-floors-why').textContent =
      `${floorsMin} is the shortest act this content's own floor rules resolve at — below it two fixed ranks land on the same floor.`;
    refreshShape();
  }
  refreshSummary();
  void $;
}
