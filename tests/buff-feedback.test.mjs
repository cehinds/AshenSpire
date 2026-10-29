import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUFF_STATUS_IDS, buffGainFor, buffPopupFor } from '../src/ui/buffFeedback.js';
import { playTimeline, setAnimSpeed, setBeatOrder, clearCallouts, statusPopupFor } from '../src/ui/fx.js';
import { statuses } from '../src/content/statuses.js';
import { flushMeasureJobs } from '../src/ui/frameMeasure.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const definitions = new Map(statuses.map(row => [row.id, row]));
const grant = (status = 'precision', overrides = {}) => ({ type: 'statusApplied', sourceId: 'player', targetId: 'player',
  status, stacks: 3, previousTotal: 2, total: 5, ...overrides });

test('positive feedback catalog resolves authored definitions and covers powers, protection and direct buffs', () => {
  for (const id of BUFF_STATUS_IDS) {
    assert.ok(definitions.has(id), `${id} is authored`);
    assert.equal(buffPopupFor(grant(id), definitions.get(id)).word, `+3 ${definitions.get(id).name}`);
    assert.equal(statusPopupFor(grant(id)), null, `${id} has one positive channel`);
  }
  const ally = buffPopupFor(grant('strength', { sourceId: 'ally', targetId: 'recipient' }), { name: 'Might', tint: 'var(--gold)' });
  assert.deepEqual(ally, { kind: 'buff:strength', targetId: 'recipient', word: '+3 Might', tone: 'gold', colour: 'var(--gold)' });
});

test('only actual positive gains earn floats; meters, bookkeeping and hostile effects do not', () => {
  for (const overrides of [{ stacks: 0 }, { stacks: -1 }, { total: 2 }, { total: 1 }, { targetId: null },
    { previousTotal: undefined }, { total: Infinity }, { type: 'statusPressure' }, { status: 'stanceShifted' },
    { status: 'burn' }, { status: 'unknown' }, { status: 'bleed' }]) {
    assert.equal(buffGainFor(grant('precision', overrides)), 0, JSON.stringify(overrides));
  }
  for (const definition of [undefined, { name: '' }, { name: 'Precision', meter: {} }, { name: 'Precision', proc: {} }])
    assert.equal(buffPopupFor(grant(), definition), null);
  assert.equal(buffPopupFor(grant('precision', { stacks: 99, previousTotal: 4, total: 5 }), definitions.get('precision')).word, '+1 Precision');
  assert.equal(buffPopupFor(grant('prepared', { stacks: 99, previousTotal: 0, total: 1 }), definitions.get('prepared')).word, '+1 Prepared');
});

function playback(t, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  withKitDom(dom => {
    setAnimSpeed('normal'); setBeatOrder('sequential');
    const run = (events, options = {}) => {
      const layer = dom.document.createElement('div'), shown = [], stages = [];
      const anchors = Object.fromEntries(['player', 'e1', 'ally'].map(id => [id, dom.document.createElement('div')]));
      const append = layer.appendChild.bind(layer);
      let peakVisibleBuffs = 0;
      const visibleBuffCount = () => [...layer.children].filter(node =>
        node.dataset?.calloutKind?.startsWith('buff:') && node.style.visibility !== 'hidden').length;
      layer.appendChild = node => {
        shown.push({ node, at: Date.now() });
        const result = append(node);
        if (node.dataset?.calloutKind?.startsWith('buff:')) {
          let visibility = node.style.visibility;
          Object.defineProperty(node.style, 'visibility', { configurable: true,
            get: () => visibility,
            set: value => { visibility = value; peakVisibleBuffs = Math.max(peakVisibleBuffs, visibleBuffCount()); },
          });
          peakVisibleBuffs = Math.max(peakVisibleBuffs, visibleBuffCount());
        }
        return result;
      };
      let completions = 0, endedAt;
      const handle = playTimeline(events, { layer, anchorFor: id => anchors[id], figureAnimations: false,
        statusInfo: id => definitions.get(id),
        animateActor: () => ({ impactMs: 100, totalMs: 300, cancel() {} }),
        onStage: name => stages.push({ name, at: Date.now() }), ...options }, () => { completions++; endedAt = Date.now(); });
      return { layer, shown, stages, handle, peakVisibleBuffs: () => peakVisibleBuffs, finish() {
        for (let i = 0; i < 20000 && !completions; i++) t.mock.timers.tick(1);
        assert.equal(completions, 1); return endedAt;
      } };
    };
    try { fn({ dom, run }); }
    finally { setAnimSpeed('normal'); setBeatOrder('sequential'); dom.document.body.classList.remove('reduced-motion'); }
  });
}

for (const mode of ['normal', 'instant', 'reduced-motion']) test(`${mode}: buff floats share the numbers stage and add no presentation waits`, t => {
  playback(t, ({ dom, run }) => {
    if (mode === 'instant') setAnimSpeed('instant');
    if (mode === 'reduced-motion') dom.document.body.classList.add('reduced-motion');
    const events = [{ type: 'cardPlayed', cardType: 'skill', cardId: 'setup', targetId: 'player' }, grant()];
    const start = Date.now();
    const baseline = run(events.map(e => e.type === 'statusApplied' ? { ...e, previousTotal: e.total } : e));
    const baselineDuration = baseline.finish() - start;
    clearCallouts(baseline.layer);
    const gainStart = Date.now(), result = run(events);
    assert.equal(result.finish() - gainStart, baselineDuration, 'the same action keeps its existing duration');
    const buffs = result.shown.filter(({ node }) => node.dataset.calloutKind === 'buff:precision');
    assert.equal(buffs.length, 1);
    assert.equal(buffs[0].node.textContent, '+3 Precision');
    assert.equal(buffs[0].node.dataset.calloutFor, 'player');
    assert.equal(buffs[0].at, result.stages.find(stage => stage.name === 'damage').at, 'gain lands in numbers after reaction');
    assert.deepEqual(result.stages.filter(stage => ['action', 'sprite', 'result', 'reaction', 'damage'].includes(stage.name)).map(stage => stage.name),
      ['action', 'sprite', 'result', 'reaction', 'damage']);
  });
});

test('normal sequential playback batches multiple positive status receipts into one damage stage', t => {
  playback(t, ({ run }) => {
    const gains = ['precision', 'strength', 'regen', 'evade'].map((status, index) => grant(status, {
      stacks: index + 2, previousTotal: index, total: (index * 2) + 2,
    }));
    assert.ok(gains.every(event => buffGainFor(event) > 0), 'each receipt carries an actual positive total delta');
    const events = [{ type: 'cardPlayed', cardType: 'skill', cardId: 'setup', targetId: 'player' }, ...gains];
    const baselineStart = Date.now();
    const baseline = run(events.map(event => event.type === 'statusApplied' ? { ...event, previousTotal: event.total } : event));
    const baselineDuration = baseline.finish() - baselineStart;
    clearCallouts(baseline.layer);

    const gainStart = Date.now();
    const result = run(events);
    assert.equal(result.finish() - gainStart, baselineDuration, 'multiple labels do not add timeline waits');
    const buffs = result.shown.filter(({ node }) => node.dataset.calloutKind?.startsWith('buff:'));
    const damageStages = result.stages.filter(stage => stage.name === 'damage');
    assert.equal(buffs.length, gains.length);
    assert.equal(damageStages.length, 1, 'the action uses one shared numbers stage');
    assert.ok(buffs.every(row => row.at === damageStages[0].at), 'all gains are submitted together in that stage');
    assert.deepEqual(buffs.map(row => row.node.textContent), ['+2 Precision', '+3 Strength', '+4 Regen', '+5 Evade']);
  });
});

test('reduced-motion buff gains stay readable, start in queued lanes and clear on skip', t => {
  playback(t, ({ dom, run }) => {
    setAnimSpeed('instant');
    dom.document.body.classList.add('reduced-motion');
    const result = run(['precision', 'precision', 'regen', 'evade', 'decoy', 'concealed', 'strength'].map(status => grant(status)));
    result.finish();
    const buffs = result.shown.filter(({ node }) => node.dataset.calloutKind?.startsWith('buff:')).map(row => row.node);
    assert.equal(buffs.length, 7, 'equal repeated gains are separate committed outcomes');
    const starts = buffs.map(node => Number.parseInt(node.style.animationDelay || '0', 10));
    assert.deepEqual(starts, [0, 150, 300, 500, 650, 800, 1000]);
    assert.equal(buffs[0].style.visibility, '', 'the first lane is visible immediately');
    assert.ok(buffs.slice(1).every(node => node.style.visibility === 'hidden'), 'future lane words stay hidden until scheduled');
    flushMeasureJobs(); // placement is measured at the end of the task
    assert.equal(new Set(buffs.slice(0, 3).map(node => node.dataset.calloutSlot)).size, 3);

    // The second lane starts within its planned 150 ms offset and keeps the
    // existing 500 ms life, even when the timeline itself uses a short step.
    let waitedForStart = 0;
    while (buffs[1].style.visibility === 'hidden' && waitedForStart <= starts[1]) {
      t.mock.timers.tick(1);
      waitedForStart++;
    }
    assert.ok(waitedForStart > 0 && waitedForStart <= starts[1], 'the queued timer reveals the word by its planned start');
    assert.equal(buffs[1].style.visibility, '');
    t.mock.timers.tick(499);
    assert.ok(result.layer.children.includes(buffs[1]), 'the word stays readable for its selected lifetime');
    t.mock.timers.tick(1);
    assert.ok(!result.layer.children.includes(buffs[1]), 'the lane word clears at the end of its lifetime');
    t.mock.timers.tick(500);
    assert.ok(result.peakVisibleBuffs() <= 3, 'a later lane never appears before its expired predecessor leaves the DOM');
    clearCallouts(result.layer);
    assert.ok(buffs.every(node => !result.layer.children.includes(node)));
    t.mock.timers.tick(5000);
    assert.equal(result.layer.children.length, 0, 'pending queue timers cannot resurrect a gain');
  });
});

test('buff callouts stay static under manual and operating-system reduced motion', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const properties = String.raw`\{\s*animation: none !important; opacity: 1; transform: none; filter: none;\s*\}`;
  assert.match(css, new RegExp(String.raw`\.reduced-motion \.fx-callout\[data-callout-kind\^='buff:'\] ${properties}`),
    'manual reduced motion leaves buff words static and visible');
  assert.match(css, new RegExp(String.raw`@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.fx-callout\[data-callout-kind\^='buff:'\] ${properties}`),
    'OS reduced motion leaves buff words static and visible');
});

test('legacy impact playback keeps buff gains in its callout-only step and duration', t => {
  playback(t, ({ run }) => {
    const statusGains = ['precision', 'precision', 'regen', 'evade'].map(status => grant(status));
    const events = [{ type: 'cardPlayed', cardType: 'skill', cardId: 'setup', targetId: 'player' }, ...statusGains];
    const baselineStart = Date.now();
    const baseline = run(events.map(event => event.type === 'statusApplied' ? { ...event, previousTotal: event.total } : event), { beatOrder: 'impact' });
    const baselineDuration = baseline.finish() - baselineStart;
    clearCallouts(baseline.layer);

    const resultStart = Date.now();
    const result = run(events, { beatOrder: 'impact' });
    const duration = result.finish() - resultStart;
    const buffs = result.shown.filter(({ node }) => node.dataset.calloutKind?.startsWith('buff:'));
    assert.equal(duration, baselineDuration, 'a positive gain adds no extra legacy impact steps');
    assert.equal(buffs.length, statusGains.length);
    assert.equal(new Set(buffs.map(row => row.at)).size, 1, 'the callout-only gains appear together in their existing beat');
  });
});

test('missing status context safely omits gains while hostile words, heal and Block each keep one channel', t => {
  playback(t, ({ run }) => {
    setAnimSpeed('instant');
    const missing = run([grant()], { statusInfo: undefined }); missing.finish();
    assert.equal(missing.shown.length, 0);
    const result = run([grant(), grant('sleep'), { type: 'healed', targetId: 'player', amount: 2 }, { type: 'blockGained', targetId: 'player', amount: 4 }]);
    result.finish();
    assert.deepEqual(result.shown.map(({ node }) => node.textContent), ['ASLEEP', '+3 Precision', '+2', '+4']);
  });
});

