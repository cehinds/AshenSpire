// Core's combat tools row: no Grid checkbox, no Reaction switch, overlay off (formation.gridOption,
// reactions.playerToggle). Cases are tests/fixtures/combat-tool-options.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withModalDom } from './helpers/dom.mjs';
import { mountCombatTools } from '../src/ui/components/combatTools.js';
import {
  resolveGameProfile,
  applyGameProfileToContent,
  bindGameProfileRegistries,
} from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import {
  FormationGridOptionEnabled,
  ReactionToggleEnabled,
  ForgetHiddenReactionSwitch,
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
const OVERLAY_GATE =
  /\.combat\[data-formation-grid-option='off'\] \.formation-grid \{ display: none; \}/;

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

const RESUME_SEED = 511;
const RESUME_CLASS = 'reaver';
const RESUME_ENEMY = 'fellWarden';
const CORE_SPEC = FIXTURE.toolsOnProfile;

function resumedReactionSwitch(playerToggle)
{
  const profile = resolveGameProfile({
    ...CORE_SPEC,
    modules: { reactions: { playerToggle } },
  });
  const content = applyGameProfileToContent(contentBundle, profile);
  const registries = bindGameProfileRegistries(createRegistries(content), profile);
  const run = createRunState({ registries, classId: RESUME_CLASS, seed: RESUME_SEED });
  const combat = createRunCombat({
    registries,
    run,
    rng: createRng(RESUME_SEED),
    enemyIds: [RESUME_ENEMY],
  });
  combat.player.reactionsEnabled = false;
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(RESUME_SEED), snapshot });
  ForgetHiddenReactionSwitch(restored);
  return restored.player.reactionsEnabled;
}

for (const entry of FIXTURE.resumedReactionsOff)
{
  test(entry.name, () =>
  {
    const stored = resumedReactionSwitch(entry.playerToggle);
    assert.equal(stored ?? null, entry.expect.reactionsEnabled);
    assert.equal(stored !== false, entry.expect.toolsEnabled, 'reactions read as on');
  });
}
