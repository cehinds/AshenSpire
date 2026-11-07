// tools/qa-sandbox.mjs — pre-PR browser QA sandbox (owner, 2026-11-07: "using your
// browser, have a simulated sandbox environment to test changes before the pr and
// comparing to the request, and have a list of what failure looks like and what
// success looks like (acceptance criteria)").
//
//   node tools/qa-sandbox.mjs <acceptance.json> [--out <dir>] [--base <ref>]
//
// Serves the working tree, opens each viewport x scene of the acceptance spec in
// Chromium, runs the scene's actions, screenshots it and evaluates the checks.
// `success` checks must hold; each `failure` check describes what failure looks
// like and must NOT hold. --base <ref> also runs every scene on a throwaway
// `git worktree` of that ref so the report shows before/after side by side.
// Writes report.md, report.json and the PNGs to --out (default qa-sandbox-out/).
// Exit 1 when any check fails. See docs/qa/SANDBOX-QA.md.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, rmSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const CHECK_KINDS = ['visible', 'hidden', 'count', 'text', 'within', 'noOverlap', 'style', 'consoleErrors'];
export const ACTION_KINDS = ['click', 'tap', 'hold', 'key', 'wait'];

// ---------- pure: spec validation ----------

const isStr = (v) => typeof v === 'string' && v.trim() !== '';

/** Returns a list of problems (empty = valid). */
export function validateCheck(check, where) {
  const errs = [];
  if (!check || typeof check !== 'object') return [`${where}: not an object`];
  if (!CHECK_KINDS.includes(check.kind)) return [`${where}: unknown check kind ${JSON.stringify(check.kind)} (one of ${CHECK_KINDS.join(', ')})`];
  if (!isStr(check.label)) errs.push(`${where}: missing label`);
  const need = (...keys) => { for (const k of keys) if (!isStr(check[k])) errs.push(`${where}: ${check.kind} needs a ${k}`); };
  switch (check.kind) {
    case 'visible': case 'hidden': need('selector'); break;
    case 'count':
      need('selector');
      if (!['min', 'max', 'eq'].some((k) => Number.isFinite(check[k]))) errs.push(`${where}: count needs min, max or eq`);
      break;
    case 'text':
      need('selector');
      if (!isStr(check.includes) && !isStr(check.matches)) errs.push(`${where}: text needs includes or matches`);
      if (isStr(check.matches)) { try { new RegExp(check.matches); } catch { errs.push(`${where}: matches is not a valid regex`); } }
      break;
    case 'within': need('selector', 'container'); break;
    case 'noOverlap': need('a', 'b'); break;
    case 'style': need('selector', 'prop'); if (typeof check.equals !== 'string') errs.push(`${where}: style needs equals`); break;
    case 'consoleErrors': if (check.max != null && !Number.isFinite(check.max)) errs.push(`${where}: max must be a number`); break;
  }
  return errs;
}

export function validateAction(action, where) {
  if (!action || typeof action !== 'object') return [`${where}: not an object`];
  const kind = Object.keys(action).find((k) => ACTION_KINDS.includes(k));
  if (!kind) return [`${where}: unknown action (one of ${ACTION_KINDS.join(', ')})`];
  const v = action[kind];
  if ((kind === 'click' || kind === 'tap' || kind === 'key') && !isStr(v)) return [`${where}: ${kind} needs a string`];
  if (kind === 'wait' && !(v && Number.isFinite(v.ms))) return [`${where}: wait needs {ms}`];
  if (kind === 'hold' && !(v && isStr(v.selector) && Number.isFinite(v.ms))) return [`${where}: hold needs {selector, ms}`];
  return [];
}

export function validateSpec(spec) {
  const errs = [];
  if (!spec || typeof spec !== 'object') return ['spec is not an object'];
  if (!isStr(spec.request)) errs.push('missing request (the owner\'s exact words)');
  if (!Array.isArray(spec.viewports) || !spec.viewports.length) errs.push('viewports must be a non-empty array');
  else spec.viewports.forEach((v, i) => {
    if (!isStr(v?.name) || !(v.width > 0) || !(v.height > 0)) errs.push(`viewports[${i}]: needs name, width, height`);
  });
  if (!Array.isArray(spec.scenes) || !spec.scenes.length) errs.push('scenes must be a non-empty array');
  else spec.scenes.forEach((s, i) => {
    const w = `scenes[${i}]`;
    if (!isStr(s?.name)) errs.push(`${w}: missing name`);
    if (!isStr(s?.url)) errs.push(`${w}: missing url`);
    if (s?.ready != null && !isStr(s.ready)) errs.push(`${w}: ready must be a selector string`);
    (s?.actions || []).forEach((a, j) => errs.push(...validateAction(a, `${w}.actions[${j}]`)));
    for (const group of ['success', 'failure']) {
      if (s?.[group] != null && !Array.isArray(s[group])) { errs.push(`${w}.${group} must be an array`); continue; }
      (s?.[group] || []).forEach((c, j) => errs.push(...validateCheck(c, `${w}.${group}[${j}]`)));
    }
    if (!(s?.success || []).length) errs.push(`${w}: needs at least one success check`);
  });
  return errs;
}

// ---------- pure: check evaluation ----------

const within = (b, c, tol = 0.5) => b.x >= c.x - tol && b.y >= c.y - tol && b.x + b.width <= c.x + c.width + tol && b.y + b.height <= c.y + c.height + tol;
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Does the check HOLD, given the facts the page probe collected for it?
 * Returns { holds, detail }. Pure: no DOM, no browser.
 */
export function evaluateCheck(check, facts) {
  switch (check.kind) {
    case 'visible': return { holds: !!facts.visible, detail: facts.visible ? 'visible' : (facts.count ? 'present but not visible' : 'not found') };
    case 'hidden': return { holds: !facts.visible, detail: facts.visible ? 'is visible' : 'hidden or absent' };
    case 'count': {
      const n = facts.count;
      const ok = (check.eq == null || n === check.eq) && (check.min == null || n >= check.min) && (check.max == null || n <= check.max);
      return { holds: ok, detail: `count ${n}` };
    }
    case 'text': {
      const texts = facts.texts || [];
      if (!texts.length) return { holds: false, detail: 'not found' };
      const ok = texts.some((t) => (check.includes != null ? t.includes(check.includes) : new RegExp(check.matches).test(t)));
      return { holds: ok, detail: `text ${JSON.stringify(texts[0].slice(0, 60))}` };
    }
    case 'within': {
      if (!facts.box) return { holds: false, detail: `${check.selector} not found` };
      if (!facts.container) return { holds: false, detail: `${check.container} not found` };
      const ok = within(facts.box, facts.container);
      return { holds: ok, detail: ok ? 'inside' : `outside by box ${fmt(facts.box)} vs ${fmt(facts.container)}` };
    }
    case 'noOverlap': {
      if (!facts.a || !facts.b) return { holds: false, detail: `${!facts.a ? check.a : check.b} not found` };
      const hit = overlaps(facts.a, facts.b);
      return { holds: !hit, detail: hit ? `overlap ${fmt(facts.a)} / ${fmt(facts.b)}` : 'apart' };
    }
    case 'style': return { holds: facts.value === check.equals, detail: `${check.prop} = ${JSON.stringify(facts.value)}` };
    case 'consoleErrors': {
      const n = (facts.errors || []).length, max = check.max ?? 0;
      return { holds: n <= max, detail: n ? `${n} error(s): ${facts.errors[0].slice(0, 80)}` : 'none' };
    }
    default: return { holds: false, detail: `unknown kind ${check.kind}` };
  }
}
const fmt = (b) => `[${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}]`;

/**
 * A success check passes when it holds. A failure check ("what failure looks
 * like") passes when it does NOT hold; one that holds is a FAIL.
 */
export function verdict(group, evaluated) {
  const pass = group === 'success' ? evaluated.holds : !evaluated.holds;
  return { pass, detail: group === 'failure' ? (evaluated.holds ? `FAILURE PRESENT: ${evaluated.detail}` : `absent (${evaluated.detail})`) : evaluated.detail };
}

// ---------- report ----------

export function renderReport(report) {
  const L = [];
  L.push('# QA sandbox report', '', '## Request', '', `> ${report.request}`, '');
  const t = report.totals;
  L.push(`**Result: ${t.fail ? 'FAIL' : 'PASS'}** (${t.pass} passed, ${t.fail} failed)${report.base ? `; before = \`${report.base}\`` : ''}`, '');
  for (const run of report.runs) {
    L.push(`## ${run.viewport} / ${run.scene}`, '');
    if (run.error) L.push(`Scene error: ${run.error}`, '');
    L.push('| Group | Check | After (this tree) |' + (report.base ? ' Before (base) |' : ''), '| --- | --- | --- |' + (report.base ? ' --- |' : ''));
    run.after.checks.forEach((c, i) => {
      const cell = (r) => (r ? `${r.pass ? 'PASS' : 'FAIL'} ${r.detail}`.replace(/\|/g, '/') : '-');
      L.push(`| ${c.group} | ${c.label.replace(/\|/g, '/')} | ${cell(c)} |` + (report.base ? ` ${cell(run.before?.checks[i])} |` : ''));
    });
    L.push('', 'Screenshots:', '', `- after: \`${run.after.screenshot}\``);
    if (run.before) L.push(`- before: \`${run.before.screenshot}\``);
    L.push('', `![after](${run.after.screenshot})`);
    if (run.before) L.push(`![before](${run.before.screenshot})`);
    L.push('');
  }
  return L.join('\n');
}

// ---------- browser side ----------

async function collectFacts(page, check, consoleErrors) {
  if (check.kind === 'consoleErrors') return { errors: consoleErrors };
  return page.evaluate(({ check }) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0;
    };
    const all = (sel) => [...document.querySelectorAll(sel)];
    const first = (sel) => all(sel).find(vis) || all(sel)[0] || null;
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    switch (check.kind) {
      case 'visible': case 'hidden': { const els = all(check.selector); return { count: els.length, visible: els.some(vis) }; }
      case 'count': return { count: all(check.selector).filter(vis).length };
      case 'text': return { texts: all(check.selector).map((e) => (e.textContent || '').trim()) };
      case 'within': return { box: box(first(check.selector)), container: box(first(check.container)) };
      case 'noOverlap': return { a: box(first(check.a)), b: box(first(check.b)) };
      case 'style': { const e = first(check.selector); return { value: e ? getComputedStyle(e)[check.prop] ?? getComputedStyle(e).getPropertyValue(check.prop) : null }; }
    }
    return {};
  }, { check });
}

async function runActions(page, actions) {
  for (const a of actions || []) {
    if (a.click) await page.click(a.click, { timeout: 5000 });
    else if (a.tap) await page.tap(a.tap, { timeout: 5000 }).catch(() => page.click(a.tap, { timeout: 5000 }));
    else if (a.hold) {
      const box = await (await page.waitForSelector(a.hold.selector, { timeout: 5000 })).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(a.hold.ms); await page.mouse.up();
    } else if (a.key) await page.keyboard.press(a.key);
    else if (a.wait) await page.waitForTimeout(a.wait.ms);
  }
}

async function runScene(browser, baseUrl, viewport, scene, shotPath) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
  let error = null;
  try {
    await page.goto(`${baseUrl}/index.html${scene.url}`, { waitUntil: 'networkidle', timeout: 60000 });
    if (scene.ready) await page.waitForSelector(scene.ready, { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(scene.settleMs ?? 1200);
    await runActions(page, scene.actions);
    await page.waitForTimeout(300);
  } catch (e) { error = String(e.message || e).split('\n')[0]; }
  mkdirSync(dirname(shotPath), { recursive: true });
  await page.screenshot({ path: shotPath }).catch(() => {});
  const checks = [];
  for (const group of ['success', 'failure']) {
    for (const check of scene[group] || []) {
      let v;
      try { v = verdict(group, evaluateCheck(check, await collectFacts(page, check, consoleErrors))); }
      catch (e) { v = { pass: false, detail: `probe error: ${String(e.message).split('\n')[0]}` }; }
      checks.push({ group, label: check.label, kind: check.kind, ...v });
    }
  }
  await ctx.close();
  return { error, checks, screenshot: null };
}

// ---------- main ----------

function parseArgs(argv) {
  const o = { spec: null, out: 'qa-sandbox-out', base: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') o.out = argv[++i];
    else if (argv[i] === '--base') o.base = argv[++i];
    else if (!o.spec) o.spec = argv[i];
    else throw new Error(`unexpected argument ${argv[i]}`);
  }
  if (!o.spec) throw new Error('usage: node tools/qa-sandbox.mjs <acceptance.json> [--out <dir>] [--base <ref>]');
  return o;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function main(argv) {
  const opts = parseArgs(argv);
  const spec = JSON.parse(readFileSync(resolve(opts.spec), 'utf8'));
  const problems = validateSpec(spec);
  if (problems.length) { console.error('qa-sandbox: invalid acceptance spec:\n  ' + problems.join('\n  ')); return 2; }

  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  const { serve } = await import('./serve.mjs');
  const require = createRequire(import.meta.url);
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright/index.js')); }

  let browser = null, after = null, before = null, worktree = null, tmpRoot = null;
  try {
    if (opts.base) {
      tmpRoot = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'qa-base-'));
      worktree = join(tmpRoot, 'tree');
      execFileSync('git', ['worktree', 'add', '--detach', worktree, opts.base], { cwd: ROOT, stdio: 'pipe' });
      // the art packs live in the untracked .art-cache; share it so the base tree draws the same art
      if (existsSync(join(ROOT, '.art-cache'))) symlinkSync(join(ROOT, '.art-cache'), join(worktree, '.art-cache'));
      before = await serve({ root: worktree, port: 0, open: false, quiet: true });
    }
    after = await serve({ root: ROOT, port: 0, open: false, quiet: true });
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
    const urlOf = (s) => s.url.replace(/\/$/, '');
    const runs = [];
    for (const vp of spec.viewports) {
      for (const scene of spec.scenes) {
        const stem = `${slug(vp.name)}-${slug(scene.name)}`;
        const run = { viewport: vp.name, scene: scene.name, error: null };
        const a = await runScene(browser, urlOf(after), vp, scene, join(outDir, `${stem}-after.png`));
        a.screenshot = `${stem}-after.png`; run.after = a; run.error = a.error;
        if (before) {
          const b = await runScene(browser, urlOf(before), vp, scene, join(outDir, `${stem}-before.png`));
          b.screenshot = `${stem}-before.png`; run.before = b;
        }
        runs.push(run);
      }
    }
    const all = runs.flatMap((r) => r.after.checks);
    const report = {
      request: spec.request, base: opts.base, generatedAt: new Date().toISOString(),
      totals: { pass: all.filter((c) => c.pass).length, fail: all.filter((c) => !c.pass).length },
      runs: runs.map((r) => ({ ...r, after: r.after, before: r.before })),
    };
    // a scene that could not run (timeout) fails even if all its checks happened to hold
    for (const r of runs) if (r.error) { report.totals.fail += 1; }
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    writeFileSync(join(outDir, 'report.md'), renderReport(report));
    console.log(`qa-sandbox: ${report.totals.pass} passed, ${report.totals.fail} failed; report at ${relative(process.cwd(), join(outDir, 'report.md')) || 'report.md'}`);
    return report.totals.fail ? 1 : 0;
  } finally {
    try { await browser?.close(); } catch { /* closing */ }
    for (const s of [after, before]) { try { s?.server?.close(); } catch { /* closing */ } }
    if (worktree) {
      try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: ROOT, stdio: 'pipe' }); } catch { /* removed below */ }
      try { execFileSync('git', ['worktree', 'prune'], { cwd: ROOT, stdio: 'pipe' }); } catch { /* best effort */ }
    }
    if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`qa-sandbox: ${e.message}`); process.exit(2); });
}
