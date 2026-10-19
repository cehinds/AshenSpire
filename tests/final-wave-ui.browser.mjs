// PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://localhost:4460/ FINAL_UI_ENTRY=index.html node tests/final-wave-ui.browser.mjs
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
  entry = process.env.FINAL_UI_ENTRY || "index.html",
  out = resolve(process.env.FINAL_UI_OUT || "/tmp/ashen-final-wave");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
const captures = [];
async function go(page, shot, profile, extra = "") {
  await page.goto(
    `${base}${entry}?shot=${shot}&gameProfile=${profile}&shotSeed=3${extra}`,
    { waitUntil: "domcontentloaded" },
  );
}
async function capture(page, name) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  const sourceDigest = await page.evaluate(
    () =>
      [...document.scripts]
        .map(
          (s) =>
            s.textContent.match(
              /BUILD_SOURCE_START[\s\S]{0,100}?const SOURCE = [\'"]([^\'"]+)/,
            )?.[1],
        )
        .find(Boolean) || null,
  );
  captures.push({ file: `${name}.png`, sourceDigest });
}
async function inventory(page) {
  return page.evaluate(() => {
    const s = window.__rewardStateForShot();
    const pick = (r) =>
      r
        ? {
            deckIDs: r.deckIDs,
            sideboardIDs: r.sideboardIDs,
            cinders: r.cinders,
            loadout: r.loadout,
            flasks: r.flasks,
            relics: r.relics,
            sigils: r.sigils,
            consumables: r.consumables,
          }
        : null;
    return { live: pick(s.live), saved: pick(s.saved) };
  });
}
async function tone(control, color) {
  await control.page().waitForTimeout(300);
  const rgb = await control.evaluate((n) =>
    getComputedStyle(n)
      .backgroundColor.match(/[\d.]+/g)
      ?.map(Number),
  );
  assert.ok(
    rgb && rgb[color === "green" ? 1 : 0] > rgb[color === "green" ? 0 : 1],
    `${color} action background: ${rgb}`,
  );
}
try {
  for (const profile of process.env.FINAL_UI_TITLE_ONLY
    ? []
    : (process.env.FINAL_UI_PROFILES || "core,current").split(","))
    for (const [width, height] of process.env.FINAL_UI_HOSTS === "desktop"
      ? [[1440, 900]]
      : [
          [1440, 900],
          [390, 844],
        ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: "no-preference",
      });
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const key = `${profile}-${width}`;
      if (
        !process.env.FINAL_UI_SKIP_REWARD &&
        !process.env.FINAL_UI_PREVIEW_ONLY
      ) {
        await go(
          page,
          "reward",
          profile,
          profile === "core" ? "&shotReward=configured" : "",
        );
        await page
          .locator('#reward-card-confirm,.reward-kind[data-kind="card"]')
          .first()
          .waitFor();
        if (!(await page.locator("#reward-card-confirm").count()))
          await page.locator('.reward-kind[data-kind="card"]').click();
        const confirm = page.locator("#reward-card-confirm"),
          back = page.locator("#reward-continue:visible, #reward-back:visible");
        assert.equal(await confirm.isDisabled(), true);
        assert.match(await back.innerText(), /Skip/i);
        await tone(back, "red");
        const before = await inventory(page);
        await page.locator(".reward-pick").first().click();
        assert.equal(await confirm.isDisabled(), false);
        await tone(confirm, "green");
        await capture(page, `${key}-reward-selected`);
        await confirm.click();
        if (await page.locator(".reward-choice-option").count())
          assert.equal(
            await page.locator(".reward-choice-option:visible").count(),
            1,
            "review shows only chosen reward",
          );
        assert.match(await confirm.innerText(), /Continue/i);
        assert.match(await back.innerText(), /Back/i);
        await tone(confirm, "green");
        await tone(back, "red");
        assert.deepEqual(
          await inventory(page),
          before,
          "Confirm review grants nothing",
        );
        await capture(page, `${key}-reward-review`);
        await back.click();
        assert.deepEqual(await inventory(page), before, "Back grants nothing");
        await page.locator(".reward-pick").first().click();
        await confirm.click();
        await confirm.click();
        if (profile === "core")
          await page.waitForFunction(() =>
            Object.values(window.__rewardStateForShot().live.offers || {}).some(
              (o) => o.taken.length === 1,
            ),
          );
        else
          await page.waitForFunction((n) => {
            const r = window.__rewardStateForShot().live;
            return r.deckIDs.length + r.sideboardIDs.length === n + 1;
          }, before.live.deckIDs.length + before.live.sideboardIDs.length);
        const after = await inventory(page);
        assert.notDeepEqual(
          after.live,
          before.live,
          "Continue applies actual selected reward",
        );
        if (profile === "core") {
          const offers = await page.evaluate(
            () => window.__rewardStateForShot().live.offers,
          );
          assert.equal(
            Object.values(offers).reduce((n, o) => n + o.taken.length, 0),
            1,
            "exactly one configured grant",
          );
        } else
          assert.equal(
            after.live.deckIDs.length + after.live.sideboardIDs.length,
            before.live.deckIDs.length + before.live.sideboardIDs.length + 1,
          );
        assert.deepEqual(
          after.live,
          after.saved,
          "Continue persists exactly one grant",
        );
        results.push({ profile, width, reward: { before, after } });
      }
      if (process.env.FINAL_UI_REWARD_ONLY) {
        await page.close();
        continue;
      }
      if (!process.env.FINAL_UI_PREVIEW_ONLY) {
        await go(page, "map", profile);
        await page.locator("[data-nodes-total]").waitFor();
        const fog = await page.locator("[data-nodes-total]").evaluate((n) => ({
          total: +n.dataset.nodesTotal,
          hidden: +n.dataset.nodesHidden,
          drawn: n.querySelectorAll(".map-node").length,
        }));
        assert.ok(
          fog.hidden === 0 && fog.drawn === fog.total,
          "fresh map defaults to path, fog off (owner, 2026-10-19)",
        );
        if (profile === "current")
          assert.equal(
            await page
              .locator(".shared-hud .hud-cinders-strip .hud-cinders")
              .isVisible(),
            true,
            "Current Cinders visible",
          );
        await capture(page, `${key}-map`);
        results.push({ profile, width, fog });
        await go(page, "combat", profile);
        await page.locator(".end-turn").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        const geometry = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          cards: [...document.querySelectorAll(".hand .card")].map((n) => {
            const r = n.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          }),
          footer: document.querySelector(".end-turn").getBoundingClientRect()
            .bottom,
          desktop: document.querySelector(".combat").dataset.desktopFooter,
        }));
        await capture(page, `${key}-combat-probe`);
        assert.ok(
          geometry.overflow <= 1 && geometry.footer <= height + 1,
          JSON.stringify({ profile, width, height, ...geometry }),
        );
        assert.ok(
          geometry.cards.every((r) => r.top >= 0 && r.bottom <= height + 1),
        );
        assert.equal(geometry.desktop === "true", width >= 1001);
        await capture(page, `${key}-combat`);
        await page.locator("#combat-menu").click();
        if (!(await page.locator("[data-settings-host]").count()))
          await page.locator('.qn-row[data-tab="settings"]').click();
        await page.locator("[data-general-select]").waitFor();
        await page.locator("[data-general-select]").selectOption("Combat");
        if (profile === "core")
          assert.equal(
            await page.locator('[data-key="askToUpcastAfterTarget"]').count(),
            0,
          );
        await capture(page, `${key}-settings`);
      }
      if (width === 1440) {
        await go(
          page,
          "rest",
          profile,
          "&shotSettings=" +
            encodeURIComponent(
              JSON.stringify({
                deckEditing: true,
                deckEditingWhere: "restOnly",
              }),
            ),
        );
        if (profile === "core") {
          const deck = await page.evaluate(
            () => window.__restStateForShot().live.deck,
          );
          assert.equal(deck.length, 10);
          assert.equal(
            deck.filter((c) => c.cardId === "core.defend").length,
            2,
          );
          assert.equal(
            deck.filter((c) => c.cardId === "core.counter").length,
            1,
          );
          assert.equal(deck.filter((c) => c.cardId === "base.draw").length, 1);
        }
        await page
          .locator(profile === "core" ? "#strategize-opt" : "#deck-opt")
          .click();
        const rows = page.locator('[data-pane="collection"] .deck-editor-main');
        await rows.first().click();
        const toggle = page.locator(
          'input[type="checkbox"][data-focus-key="preview:animation"]',
        );
        await toggle.check();
        await page
          .locator(".deck-editor-animation [data-animation-set]")
          .waitFor();
        const samples = [];
        for (const [label, expected] of [
          [/Defend|Weapon Guard/i, "defend|guard"],
          [
            profile === "core" ? /Sweep/i : /Strike/i,
            profile === "core" ? "sweep" : "attack|strike",
          ],
        ]) {
          await rows.filter({ hasText: label }).first().click();
          const poses = new Set();
          let sample;
          for (let i = 0; i < 35; i++) {
            await page.waitForTimeout(100);
            sample = await page
              .locator(".deck-editor-animation [data-animation-set]")
              .evaluate((n) => ({ ...n.dataset }));
            poses.add(sample.pose);
          }
          assert.match(
            sample.animationSet,
            /reaver/,
            "preview uses selected Reaver character",
          );
          assert.ok(
            [...poses].some((p) => new RegExp(expected, "i").test(p)),
            `selected action ${expected} appears across active loop: ${[...poses]}`,
          );
          samples.push({ ...sample, observedPoses: [...poses], expected });
        }
        if (profile === "core") {
          await rows
            .filter({ hasText: /Draw 2 cards/i })
            .first()
            .click();
          const detail = await page.locator(".deck-editor-rules").innerText();
          assert.match(detail, /Skill/i);
          assert.match(detail, /Prepare/i);
          await capture(page, `${key}-draw-skill-prepare`);
          results.push({ profile, width, drawClassification: detail });
        }
        await capture(page, `${key}-deck-preview`);
        results.push({ profile, width, animation: samples });
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${key}: reward, fog, battlefield, Settings passed`);
    }
  if (!process.env.FINAL_UI_REWARD_ONLY && !process.env.FINAL_UI_PREVIEW_ONLY)
    for (const profile of (
      process.env.FINAL_UI_PROFILES || "core,current"
    ).split(",")) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      page.setDefaultTimeout(12000);
      await page.goto(`${base}${entry}?gameProfile=${profile}`, {
        waitUntil: "domcontentloaded",
      });
      if (!(await page.locator("#settings").count()))
        await page.keyboard.press("Enter");
      await page.locator("#settings").click();
      await page.locator("[data-general-select]").selectOption("Combat");
      if (profile === "core")
        assert.equal(
          await page.locator('[data-key="askToUpcastAfterTarget"]').count(),
          0,
          "title Core hides inactive upcast",
        );
      const advanced = page.locator('[data-member="Advanced"]');
      let groups = [];
      if (await advanced.count()) {
        await advanced.click();
        groups = await page
          .locator("[data-advanced-group]")
          .evaluateAll((ns) => [
            ...new Set(ns.map((n) => n.dataset.advancedGroup)),
          ]);
        if (profile === "core") {
          for (const id of [
            "Opening",
            "Progression",
            "Combat",
            "Stats",
            "Recovery",
            "Rewards",
            "Shops",
            "Equipment",
            "World",
          ])
            assert.ok(!groups.includes(id), `Core hides ${id}`);
          const deck = page.locator('[data-advanced-group="Deck"]');
          if (await deck.count()) {
            if (await deck.isVisible()) await deck.click();
            else
              await page
                .getByLabel("Advanced section", { exact: true })
                .selectOption("Deck");
            const keys = await page
              .locator('[data-advanced-panel="Deck"] [data-key]')
              .evaluateAll((ns) => [...new Set(ns.map((n) => n.dataset.key))]);
            assert.deepEqual(keys, ["playInDeckOrder"]);
          }
        }
      }
      await capture(page, `${profile}-1440-title-settings`);
      results.push({ profile, titleSettingsGroups: groups });
      await page.close();
      console.log(`${profile}: title capability filters passed`);
    }
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ status: "passed", results, captures }, null, 2),
  );
} finally {
  await browser.close();
  await server?.close();
}
