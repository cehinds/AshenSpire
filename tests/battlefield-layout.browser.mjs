// PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://localhost:4460/ BATTLEFIELD_ENTRY=AshenSpire.html node tests/battlefield-layout.browser.mjs
// Uses actual shot-initialized combat and real input; never freezes DOM or mutates simulation state.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "../tools/serve.mjs";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const external = process.env.BASE_URL || process.env.BATTLEFIELD_BASE;
const server = external
  ? null
  : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = external || server.url;
const entry = process.env.BATTLEFIELD_ENTRY || "index.html";
const output = resolve(process.env.BATTLEFIELD_OUT || "/tmp/ashen-battlefield");
mkdirSync(output, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const metrics = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [1024, 768],
    [390, 844],
  ]) {
    let reference;
    for (const hand of [3, 5]) {
      const p = await b.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      p.setDefaultTimeout(10000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        `${base}${entry}?shot=combat&gameProfile=core&shotHand=${hand}`,
        { waitUntil: "domcontentloaded" },
      );
      await p.locator(".combatant.player .sprite").waitFor();
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(500);
      const m = await p.evaluate(() => {
        const rect = (n) => {
          const r = n.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const many = (s) =>
          [...document.querySelectorAll(s)]
            .filter((n) => n.getClientRects().length)
            .map(rect);
        return {
          width: innerWidth,
          height: innerHeight,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          player: many(".combatant.player .sprite")[0],
          playerHud: many(".combatant.player .combatant-mini-hud")[0],
          enemies: many(".combatant:not(.player) .sprite"),
          enemyMeters: many(".combatant.enemy .meters"),
          shadows: [...document.querySelectorAll(".combatant .sprite")].map(
            (n) => ({
              eid: n.closest("[data-eid]").dataset.eid,
              relativeWidth: getComputedStyle(n).getPropertyValue(
                "--floor-shadow-width",
              ),
            }),
          ),
          hud: many(".combatant-mini-hud"),
          cards: many(".hand .card"),
          footer: many(".end-turn"),
          tools: many('[data-combat-tool="log"],[data-combat-tool="reaction"]'),
          hand: many(".hand-overlay")[0],
        };
      });
      assert.ok(m.overflow <= 1, JSON.stringify(m));
      if (width === 1440 && hand === 5) {
        assert.ok(
          Math.abs(m.player.width / 141.8 - 1.5) < 0.04,
          "player artwork grows1.5×",
        );
        assert.ok(
          Math.abs(m.playerHud.width / 134.4 - 1.5) < 0.04,
          "player miniHUD grows independently1.5×",
        );
        for (const enemy of m.enemies)
          assert.ok(
            Math.abs(enemy.width - 151.7) < 4,
            "default enemy artwork preserves approved size",
          );
        for (const meter of m.enemyMeters)
          assert.ok(
            Math.abs(meter.width / 104 - 1.5) < 0.04,
            "enemy miniHUD grows1.5×",
          );
      }
      assert.ok(m.cards.length, "real hand rendered");
      for (const card of m.cards)
        assert.ok(
          card.y >= 0 && card.bottom <= height + 1,
          "full card inside viewport",
        );
      assert.equal(m.footer.length, 1, "End Turn rendered");
      for (const r of m.footer)
        assert.ok(r.bottom <= height + 1, "footer visible");
      for (const r of m.tools)
        assert.ok(r.y >= 0 && r.bottom <= height + 1, "tools reachable");
      assert.ok(
        m.playerHud.bottom <= m.player.y + 2,
        "player HUD above artwork",
      );
      for (const e of m.enemies) assert.ok(m.player.x < e.x, "player leftmost");
      for (const h of m.hud)
        assert.ok(
          h.bottom <= m.hand.y + 1 || h.y >= m.hand.bottom,
          "HUD does not overlap hand",
        );
      if (reference) {
        for (let i = 0; i < m.tools.length; i++) {
          assert.ok(
            Math.abs(m.tools[i].y - reference.tools[i].y) <= 1,
            "tool vertical placement independent of hand count",
          );
          assert.ok(
            Math.abs(m.tools[i].x - reference.tools[i].x) <= 1,
            "tool horizontal placement independent of hand count",
          );
        }
      } else reference = m;
      // Real controls: log opens its production panel; reaction toggles and restores.
      await p.locator('[data-combat-tool="log"]').click();
      assert.equal(await p.locator("#combat-log").isVisible(), true);
      await p.locator('[data-combat-tool="log"]').click();
      const reaction = p.locator('[data-combat-tool="reaction"]');
      const checked = await reaction.getAttribute("aria-checked");
      await reaction.click();
      assert.notEqual(await reaction.getAttribute("aria-checked"), checked);
      await reaction.click();
      assert.deepEqual(errors, []);
      if (hand === 5) {
        await p.mouse.move(0, 0);
        await p.screenshot({ path: resolve(output, `${width}-combat.png`) });
      }
      console.log(`layout ${width}x${height} hand${hand} passed`);
      metrics.push({ viewport: `${width}x${height}`, handCount: hand, ...m });
      await p.close();
    }
  }
  for (const profile of ["core", "current"]) {
    for (const width of profile === "current" ? [1440, 390] : [1440]) {
      const p = await b.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        reducedMotion: "reduce",
      });
      p.setDefaultTimeout(10000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const kit =
        profile === "current" ? "&shotKit=1&shotMainHand=straightSword" : "";
      await p.goto(
        `${base}${entry}?shot=combat&shotEnemyCount=7&gameProfile=${profile}${kit}`,
        { waitUntil: "domcontentloaded" },
      );
      await p.locator(".combatant.enemy").first().waitFor();
      const state = await p.evaluate(() => ({
        count: window.__combat.enemies.length,
        bands: [...document.querySelectorAll(".combatant.enemy")].map(
          (n) => n.dataset.visualBand,
        ),
        cells: window.__combat.enemies.map((e) => e.formationCell),
        policy: window.__combat.formationPolicy,
      }));
      assert.equal(state.count, 7);
      assert.equal(
        state.bands.includes("C"),
        profile === "current",
        "only enabled profile uses visual C band",
      );
      await p.mouse.move(0, 0);
      await p.screenshot({
        path: resolve(output, `${profile}-seven-${width}.png`),
      });
      if (profile === "current") {
        const actor = p.locator('.combatant.enemy[data-visual-band="C"]');
        const clickArt = async () => {
          const r = await actor.locator(".sprite").boundingBox();
          await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        };
        await clickArt();
        assert.equal(await actor.getAttribute("aria-pressed"), "true");
        await actor.locator(".nm-inspect").click();
        await p.locator(".combatant-inspector-body").waitFor();
        await p.keyboard.press("Escape");
        const before = await p.evaluate(() =>
          window.__combat.enemies.map((e) => ({ id: e.id, hp: e.hp })),
        );
        const strike = p.locator('.hand .card[data-card-id="strike"]').first();
        const r = await strike.boundingBox();
        await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
        await p.mouse.down();
        await p.waitForTimeout(750);
        await p.mouse.up();
        await p.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        await clickArt();
        await p.waitForFunction(
          (hp) => window.__combat.enemies.find((e) => e.id === "e7").hp < hp,
          before.find((e) => e.id === "e7").hp,
        );
        const after = await p.evaluate(() =>
          window.__combat.enemies.map((e) => ({ id: e.id, hp: e.hp })),
        );
        assert.ok(
          after.find((e) => e.id === "e7").hp <
            before.find((e) => e.id === "e7").hp,
          "real attack hits C actor",
        );
        assert.deepEqual(
          after.filter((e) => e.id !== "e7"),
          before.filter((e) => e.id !== "e7"),
          "other actors unchanged",
        );
      }
      assert.deepEqual(errors, []);
      console.log(`${profile} seven ${width} passed`);
      metrics.push({ profile, width, seven: state });
      await p.close();
    }
  }
  writeFileSync(
    resolve(output, "summary.json"),
    JSON.stringify({ status: "passed", metrics }, null, 2),
  );
  console.log(`Battlefield browser checks passed; evidence ${output}`);
} finally {
  await b.close();
  await server?.close();
}
