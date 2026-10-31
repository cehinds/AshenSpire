// PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://localhost:4460/ GRID_ENTRY=AshenSpire.html node tests/formation-grid.browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "../tools/serve.mjs";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const server = process.env.BASE_URL
  ? null
  : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url,
  entry = process.env.GRID_ENTRY || "index.html",
  out = resolve(process.env.GRID_OUT || "/tmp/ashen-formation-grid");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
const captures = [];
async function capture(page, file) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: resolve(out, file) });
  const sourceDigest = await page.evaluate(
    () =>
      [...document.scripts]
        .map(
          (s) =>
            s.textContent.match(
              /BUILD_SOURCE_START[\s\S]{0,100}?const SOURCE = ['"]([^'"]+)/,
            )?.[1],
        )
        .find(Boolean) || null,
  );
  captures.push({ file, sourceDigest });
}
async function isOn(control) {
  // A settings switch is a checkbox (role=switch); the combat tools are buttons with aria-checked.
  return (await control.getAttribute("aria-checked")) === "true" || await control.evaluate((node) => node instanceof HTMLInputElement && node.checked);
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function openSettings(page, { title = false } = {}) {
  if (title) {
    if (!(await page.locator("#settings").count()))
      await page.keyboard.press("Enter");
    await page.locator("#settings").click();
  } else {
    await page.locator("#combat-menu").click();
    if (!(await page.locator("[data-settings-host]").count()))
      await page.locator('.qn-row[data-tab="settings"]').click();
  }
  await page.locator("[data-general-select]").selectOption("Display");
  // Navigate the ordinary topic selector if the checkbox is in a folded topic.
  let box = page.getByRole("switch", {
    name: "Show battlefield grid",
    exact: true,
  });
  if (!(await box.isVisible())) {
    const topics = page.locator("[data-general-topic]");
    if (await topics.count()) {
      for (const value of await topics
        .locator("option")
        .evaluateAll((ns) => ns.map((n) => n.value))) {
        await topics.selectOption(value);
        if (await box.isVisible()) break;
      }
    }
  }
  await box.waitFor({ state: "visible" });
  return box;
}
async function closeSettings(page, { title = false } = {}) {
  if (title) {
    await page
      .getByRole("button", { name: "Done and Save", exact: true })
      .click();
    const later = page.getByRole("button", { name: "Not now", exact: true });
    if (await later.isVisible()) await later.click();
  } else await page.locator("#ov-close").click();
  await settle(page);
}
async function actors(page) {
  return page.locator(".combatant .sprite").evaluateAll((ns) =>
    ns.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        id: n.closest("[data-eid]").dataset.eid,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    }),
  );
}
function sameActors(before, after) {
  assert.equal(before.length, after.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(before[i].id, after[i].id);
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(before[i][key] - after[i][key]) <= 1,
        `grid visibility changes no actor ${key}`,
      );
  }
}
async function grid(page) {
  return page.locator(".formation-grid").evaluate((n) => {
    const style = getComputedStyle(n);
    return {
      display: style.display,
      opacity: +style.opacity,
      pointerEvents: style.pointerEvents,
      rect: n.getBoundingClientRect().toJSON(),
      markup: n.outerHTML.slice(0, 1000),
      outline: (() => {
        const p = n.querySelector("[data-perspective-outline]");
        if (!p) return null;
        const c = getComputedStyle(p);
        return {
          stroke: c.stroke,
          strokeWidth: parseFloat(c.strokeWidth),
          fill: c.fill,
        };
      })(),
      visualOnlyC: n.querySelectorAll(
        '[data-visual-band="C"][data-visual-only="true"]',
      ).length,
    };
  });
}
try {
  for (const profile of (process.env.GRID_PROFILES || "core,current").split(
    ",",
  )) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}${entry}?shot=combat&gameProfile=${profile}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".combatant.player .sprite").waitFor();
    await settle(page);
    const before = await actors(page),
      initial = await grid(page);
    assert.notEqual(initial.display, "none", "grid visible by default");
    assert.equal(initial.outline.fill, "none");
    assert.ok(
      initial.outline.strokeWidth > 0 && initial.outline.strokeWidth <= 1.5,
    );
    const channels = initial.outline.stroke.match(/[\d.]+/g).map(Number);
    assert.ok(
      channels.at(-1) > 0 && channels.at(-1) < 0.5,
      "thin translucent outlines",
    );
    const live = page.getByRole("checkbox", {
      name: "Show battlefield grid",
      exact: true,
    });
    assert.equal(await live.isChecked(), true);
    const tools = async () =>
      page
        .locator('[data-combat-tool="log"],[data-combat-tool="reaction"]')
        .evaluateAll((ns) =>
          ns.map((n) => {
            const r = n.getBoundingClientRect();
            return {
              id: n.dataset.combatTool,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
            };
          }),
        );
    const toolBefore = await tools(),
      control = await live.boundingBox();
    assert.ok(
      control.y + control.height <= toolBefore[0].y + 1,
      "grid checkbox sits above Combat Log",
    );
    await page.mouse.move(0, 0);
    await capture(page, `${profile}-1440.png`);
    await live.uncheck();
    await settle(page);
    sameActors(before, await actors(page));
    sameActors(toolBefore, await tools());
    const hidden = await grid(page);
    assert.ok(
      hidden.display === "none" || hidden.opacity === 0,
      "off hides grid",
    );
    await capture(page, `${profile}-1440-off.png`);
    const box = await openSettings(page);
    assert.equal(await isOn(box), false, "live checkbox synchronizes Settings");
    await capture(page, `${profile}-1440-settings.png`);
    await box.click();
    await closeSettings(page);
    assert.equal(
      await live.isChecked(),
      true,
      "Settings synchronizes live checkbox",
    );
    sameActors(before, await actors(page));
    sameActors(toolBefore, await tools());
    const reopened = await openSettings(page);
    assert.equal(await isOn(reopened), true, "reopen preserves on");
    await closeSettings(page);
    const shown = await grid(page);
    assert.notEqual(shown.display, "none");
    assert.ok(shown.opacity > 0);
    assert.equal(
      shown.pointerEvents,
      "none",
      "grid does not intercept pointer input",
    );
    const enemy = page.locator(".combatant.enemy").first(),
      art = await enemy.locator(".sprite").boundingBox();
    const point = { x: art.x + art.width / 2, y: art.y + art.height / 2 };
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-eid]")?.dataset.eid,
      point,
    );
    assert.equal(hit, await enemy.getAttribute("data-eid"));
    await page.mouse.click(point.x, point.y);
    assert.equal(
      await enemy.getAttribute("aria-pressed"),
      "true",
      "artwork remains selectable through grid",
    );
    if (profile === "core") {
      assert.ok(
        initial.visualOnlyC > 0,
        "Core C outlines are presentation only",
      );
      assert.equal(
        await page.locator('.combatant.enemy[data-visual-band="C"]').count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => window.__combat.formationPolicy.extraRow.enabled,
        ),
        false,
        "presentation grid does not enable Core extra row",
      );
    }
    await page.mouse.move(0, 0);
    assert.deepEqual(errors, []);
    results.push({
      profile,
      combat: {
        initial,
        hidden,
        shown,
        actorsBefore: before,
        toolBounds: toolBefore,
      },
    });
    await page.close();
    // Shots deliberately use memory storage. Reload persistence is checked through
    // the same real control in an ordinary durable title session instead.
    const title = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    title.setDefaultTimeout(12000);
    await title.goto(`${base}${entry}?gameProfile=${profile}`, {
      waitUntil: "domcontentloaded",
    });
    let toggle = await openSettings(title, { title: true });
    assert.equal(await isOn(toggle), true);
    await toggle.click();
    await closeSettings(title, { title: true });
    await title.reload({ waitUntil: "domcontentloaded" });
    toggle = await openSettings(title, { title: true });
    assert.equal(await isOn(toggle), false, "off survives durable reload");
    await toggle.click();
    await closeSettings(title, { title: true });
    await title.reload({ waitUntil: "domcontentloaded" });
    toggle = await openSettings(title, { title: true });
    assert.equal(await isOn(toggle), true, "on survives durable reload");
    await title.close();
    results.push({ profile, persistence: "off and on survive normal reload" });
    console.log(`${profile}: toggle, geometry, hitbox and persistence passed`);
  }
  for (const [width, height] of process.env.GRID_SMOKE_ONLY
    ? []
    : [
        [1920, 1080],
        [1024, 768],
        [390, 844],
      ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await page.goto(`${base}${entry}?shot=combat&gameProfile=core`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".combatant.player .sprite").waitFor();
    await settle(page);
    const shown = await grid(page);
    assert.notEqual(shown.display, "none");
    assert.equal(shown.pointerEvents, "none");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await capture(page, `core-${width}.png`);
    results.push({ width, height, grid: shown });
    await page.close();
  }
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ status: "passed", results, captures }, null, 2),
  );
} finally {
  await browser.close();
  await server?.close();
}
