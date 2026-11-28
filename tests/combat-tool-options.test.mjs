// Core's combat tools row: no Grid checkbox, no Reaction switch, overlay off (formation.gridOption,
// reactions.playerToggle). Cases are tests/fixtures/combat-tool-options.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withModalDom } from './helpers/dom.mjs';
import { mountCombatTools } from '../src/ui/components/combatTools.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import {
  FormationGridOptionEnabled,
  ReactionToggleEnabled,
} from '../src/model/combatToolOptions.js';

const FIXTURE = JSON.parse(readFileSync(
  new URL('./fixtures/combat-tool-options.json', import.meta.url),
  'utf8',
));
const CONTROL_SELECTORS = {
  grid: 'input[data-combat-tool="grid"]',
  reaction: '[data-combat-tool="reaction"]',
  auto: '[data-combat-tool="auto"]',
  log: '[data-combat-tool="log"]',
};
const OVERLAY_GATE = /\.combat\[data-formation-grid-option='off'\] \.formation-grid \{ display: none; \}/;

function subjectFor(entry)
{
  if (!entry.profile)
  {
    return {};
  }
  const profile = resolveGameProfile(entry.profile);
  const modules = { ...profile.modules };
  for (const [moduleId, overrides] of Object.entries(entry.moduleOverrides))
  {
    modules[moduleId] = {
      ...modules[moduleId],
      ...overrides,
    };
  }
  return { gameProfile: { ...profile, modules } };
}

function withToolsDom(fn)
{
  return withModalDom(dom =>
  {
    const saved = {
      ResizeObserver: globalThis.ResizeObserver,
      MutationObserver: globalThis.MutationObserver,
    };
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.MutationObserver = class { observe() {} disconnect() {} };
    try
    {
      return fn(dom);
    }
    finally
    {
      Object.assign(globalThis, saved);
    }
  });
}

function mountedControls(entry, settings, gridWrites)
{
  const subject = subjectFor(entry);
  return withToolsDom(dom =>
  {
    const formationGrid = String(presentationConfig(settings).showFormationGrid);
    dom.document.documentElement = { dataset: { formationGrid } };
    const combatEl = dom.document.createElement('section');
    dom.document.body.appendChild(combatEl);
    const tools = mountCombatTools(combatEl, {
      state: {},
      onViewChange() {},
      onToggle() {},
      onAutoToggle: async () => {},
      onGridToggle: enabled => gridWrites.push(enabled),
      gridOption: FormationGridOptionEnabled(subject),
      reactionToggle: ReactionToggleEnabled(subject),
    });
    const shown = Object.fromEntries(Object.entries(CONTROL_SELECTORS)
      .map(([name, selector]) => [name, !!combatEl.querySelector(selector)]));
    const gridOption = combatEl.dataset.formationGridOption;
    tools.release();
    return { ...shown, gridOption };
  });
}

for (const entry of FIXTURE.cases)
{
  test(entry.name, () =>
  {
    const settings = { [FIXTURE.settingKey]: entry.savedGridPreference };
    const before = structuredClone(settings);
    const gridWrites = [];
    assert.deepEqual(mountedControls(entry, settings, gridWrites), entry.expect);
    assert.deepEqual(settings, before, 'the saved grid preference is kept');
    assert.deepEqual(gridWrites, [], 'mounting writes no grid preference');
  });
}

test('combat.css keeps the overlay off while the grid option reads off', () =>
{
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, OVERLAY_GATE);
});
