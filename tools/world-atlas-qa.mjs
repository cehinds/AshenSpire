import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.env.ATLAS_QA_URL || "http://localhost:8210";
const out = resolve(process.env.ATLAS_QA_OUT || "docs/preview/world-atlas");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.ATLAS_QA_BROWSER || "msedge",
  headless: true,
});
const errors = [],
  results = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, name) => {
  if (!ok) throw Error(name);
  results.push(name);
};
const shot = async (name) => {
  await page.screenshot({ path: resolve(out, name + ".png"), fullPage: false });
};
const atlas = async () => {
  await page.goto(base + "/?shot=atlas");
  await page.locator(".world-atlas-screen").waitFor();
  await page.waitForTimeout(350);
};
const inspect = async () => {
  await page.locator("[data-atlas-inspect-current]").click();
  await page.locator("dialog.atlas-dialog[open]").waitFor();
};
try {
  await atlas();
  const initial = await page.evaluate(() => window.__worldJourney());
  check(
    initial.activeNodeIds.length === 20,
    "Real game generates 20 active nodes",
  );
  await shot("01-world-desktop");
  await page.locator(".atlas-core.current").hover();
  await shot("02-landmark-hover");
  await inspect();
  await page.locator('[data-local-point="crownfall/forge"]').click();
  await shot("03-city-blacksmith-desktop");
  await page.locator('[data-local-service="smith"]').click();
  await page.locator(".smith-upgrade-modal").waitFor();
  await shot("04-live-smith-interface");
  await page.locator(".smith-upgrade-modal .modal-close").click();
  await inspect();
  await page.locator('[data-local-point="crownfall/market"]').click();
  await page.locator('[data-local-service="shop"]').click();
  await page.locator("#leave-shop").waitFor();
  await shot("05-live-city-market");
  const stock = await page.locator("#shop-cards").innerText();
  await page.locator("#leave-shop").click();
  await page.locator("[data-atlas-close]").click();
  await inspect();
  await page.locator('[data-local-point="crownfall/market"]').click();
  await page.locator('[data-local-service="shop"]').click();
  check(
    stock === (await page.locator("#shop-cards").innerText()),
    "Market stock survives leaving and returning",
  );
  await page.locator("#leave-shop").click();
  await page.locator("[data-atlas-close]").click();
  await page.locator(".atlas-road-list [data-atlas-node]").first().click();
  check(
    (await page.evaluate(() => window.__worldJourney())).currentNodeId ===
      initial.currentNodeId,
    "Inspecting a road does not travel",
  );
  await page.locator("[data-atlas-travel]").click();
  await page.locator(".combat").waitFor();
  await page.waitForTimeout(900);
  await shot("06-live-regional-combat");
  const current = await page.evaluate(() => window.__worldJourney());
  check(
    current.currentNodeId !== initial.currentNodeId,
    "Explicit travel enters an authored encounter",
  );
  const region = await page
    .locator(".environment-backdrop")
    .getAttribute("data-region");
  check(
    current.currentNodeId.startsWith(region),
    "Combat scenery follows the traveled region",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await atlas();
  await shot("07-world-phone");
  await inspect();
  await page.locator('[data-local-point="crownfall/forge"]').click();
  await shot("08-city-phone");
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Phone has no page-level horizontal overflow",
  );
  check(
    await page
      .locator(".atlas-dialog")
      .evaluate((d) => d.getBoundingClientRect().right <= innerWidth + 1),
    "Phone dialog stays within viewport",
  );
  await page.keyboard.press("Escape");
  check(
    (await page.locator("dialog[open]").count()) === 0,
    "Escape closes location dialog",
  );
  check(
    await page.evaluate(() =>
      document.activeElement?.hasAttribute("data-atlas-inspect-current"),
    ),
    "Focus returns after dialog close",
  );
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto(base + "/world-atlas-preview.html");
  await page.locator(".world-atlas-screen").waitFor();
  await page.waitForTimeout(300);
  await shot("09-revealed-route-authoring");
  await page.locator("#preview-view").selectOption("catalog");
  await page.waitForTimeout(300);
  await shot("10-full-catalog-authoring");
  await page.locator("#preview-location").selectOption("dead-foundry");
  await page.locator('[data-local-point="dead-foundry/boss"]').click();
  await shot("11-foundry-local-authoring");
  await page.keyboard.press("Escape");
  await page.locator("#preview-location").selectOption("silent-monastery");
  await page.locator('[data-local-point="silent-monastery/junction"]').click();
  await shot("12-monastery-local-authoring");
  check(errors.length === 0, "No browser runtime errors");
  writeFileSync(
    resolve(out, "qa.json"),
    JSON.stringify(
      {
        base,
        browser: "Edge headless",
        viewports: ["1440x1080", "390x844"],
        results,
        errors,
        boundary:
          "Actual game new-run, service and combat entry checks. Revealed/all-node/interior pictures are labeled authoring previews; no combat-balance or full-run victory claim.",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS",
    results.length,
    "browser assertions;",
    12,
    "screenshots in",
    out,
  );
} finally {
  await browser.close();
}
