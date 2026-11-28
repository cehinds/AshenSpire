// tools/gate-scenario.mjs — play a JSON gate scenario through a startup-gate page.

import { readFileSync } from 'node:fs';

const CASE_INSENSITIVE = 'i';
const SIZE_PRECISION = 10;

// Runs inside the page: reads each named field the scenario declares.
function readFieldsInPage(fieldSpecs, sizePrecision)
{
  const round = (value) => Math.round(value * sizePrecision) / sizePrecision;
  const readers = {
    exists: (element) => !!element,
    enabled: (element) => element?.disabled === false,
    text: (element) => element?.textContent.trim() || '',
    rawText: (element) => element?.textContent ?? '',
    data: (element, key) => element?.dataset[key] || null,
    property: (element, key) => element?.[key] || '',
    attribute: (element, key) => element?.getAttribute(key) || '',
    size: (element) =>
    {
      if (!element)
      {
        return null;
      }
      const box = element.getBoundingClientRect();
      return {
        width: round(box.width),
        height: round(box.height),
      };
    },
  };
  const values = {};
  for (const [name, spec] of Object.entries(fieldSpecs))
  {
    const element = document.querySelector(spec.selector);
    values[name] = readers[spec.read](element, spec.key);
  }
  return values;
}

function readFields(page, fieldSpecs)
{
  const source = readFieldsInPage.toString();
  const specs = JSON.stringify(fieldSpecs);
  return page.ev(`(${source})(${specs}, ${SIZE_PRECISION})`);
}

function pick(values, names)
{
  return Object.fromEntries(names.map((name) =>
  {
    return [
      name,
      values[name],
    ];
  }));
}

function namesOf(step)
{
  const names = [
    ...Object.keys(step.expect || {}),
    ...Object.keys(step.match || {}),
    ...(step.matchAny?.fields || []),
    ...(step.fields || []),
  ];
  return [...new Set(names)];
}

function checkHolds(step, values)
{
  const expected = Object.entries(step.expect || {}).every(([name, value]) =>
  {
    return values[name] === value;
  });
  const matched = Object.entries(step.match || {}).every(([name, pattern]) =>
  {
    return new RegExp(pattern, CASE_INSENSITIVE).test(values[name]);
  });
  const anyPattern = step.matchAny
    ? new RegExp(step.matchAny.pattern, CASE_INSENSITIVE)
    : null;
  const anyText = (step.matchAny?.fields || []).map((name) => values[name]).join(' ');
  const matchedAny = !anyPattern || anyPattern.test(anyText);
  return expected && matched && matchedAny;
}

function clearsFloor(step, values)
{
  return step.fields.every((name) =>
  {
    const box = values[name];
    return box && box.width >= step.minPx && box.height >= step.minPx;
  });
}

async function runCheck(context, step, holds)
{
  const values = await readFields(context.page, context.fields);
  const passed = holds(step, values);
  const shown = JSON.stringify(pick(values, namesOf(step)));
  const code = step.check || step.tapFloor;
  context.verdict(
    passed,
    code,
    `${step.label} (${shown})`,
  );
}

async function pressKey(page, key)
{
  const release = await page.key(key);
  await release();
}

async function pressPad(context, step)
{
  await context.page.ev(`window.__startupPad.set(${step.padPress},true)`);
  await context.wait(step.holdMs);
  await context.page.ev(`window.__startupPad.set(${step.padPress},false)`);
  await context.wait(step.settleMs);
}

async function connectPad(context, step)
{
  await context.page.ev('window.__startupPad.connect()');
  await context.wait(step.settleMs);
}

async function saveScreenshot(context, step)
{
  if (context.captureShots)
  {
    await context.page.screenshot(step.screenshot);
  }
}

const STEP_RUNNERS = Object.freeze({
  until: (context, step) => context.page.until(
    `!!document.querySelector(${JSON.stringify(context.selectors[step.until])})`,
    step.label,
  ),
  click: (context, step) => context.page.click(context.selectors[step.click]),
  key: (context, step) => pressKey(context.page, step.key),
  hold: (context, step) => context.page.hold(
    context.selectors[step.hold],
    step.ms,
    { touch: step.touch },
  ),
  padConnect: connectPad,
  padPress: pressPad,
  check: (context, step) => runCheck(context, step, checkHolds),
  tapFloor: (context, step) => runCheck(context, step, clearsFloor),
  screenshot: saveScreenshot,
});

function stepKind(step)
{
  const kind = Object.keys(STEP_RUNNERS).find((name) => name in step);
  if (!kind)
  {
    throw new Error(`gate scenario: unknown step ${JSON.stringify(step)}`);
  }
  return kind;
}

/**
 * Plays every session of a JSON scenario, each on a fresh page.
 * `openPage(options)` opens a page; `verdict(passed, code, detail)` records a check.
 */
export async function RunGateScenario(scenarioPath, hooks)
{
  const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));
  for (const session of scenario.sessions)
  {
    const page = await hooks.openPage(scenario.pages[session.page]);
    const context = {
      ...hooks,
      page,
      fields: scenario.fields,
      selectors: scenario.selectors,
    };
    for (const step of session.steps)
    {
      await STEP_RUNNERS[stepKind(step)](context, step);
    }
    await page.close();
  }
}
