#!/usr/bin/env node
// Rendered regression: a retained defeated frame cannot consume targeting.
// node tools/defeated-targets.mjs [--shots DIRECTORY]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Install Playwright or set PLAYWRIGHT_MODULE to its module URL. Optional
// BROWSER_CHANNEL selects an installed browser (defaults to msedge on Windows).
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import { serve } from "./serve.mjs";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2),
  at = args.indexOf("--shots"),
  shots = at < 0 ? null : resolve(args[at + 1]);
async function main() {
  if (shots) mkdirSync(shots, { recursive: true });
  const served = await serve({ root: ROOT, port: 0, open: false });
  let browser;
  const runtimeErrors = [],
    warnings = [];
  let failures = 0,
    checks = 0;
  const check = (held, label) => {
    checks++;
    if (!held) failures++;
    console.log(`${held ? "PASS" : "FAIL"} ${label}`);
  };
  try {
    browser = await chromium.launch({
      headless: true,
      channel:
        process.env.BROWSER_CHANNEL ||
        (process.platform === "win32" ? "msedge" : undefined),
    });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    cdp.on("Runtime.exceptionThrown", (p) =>
      runtimeErrors.push(p.exceptionDetails),
    );
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "warning") warnings.push(JSON.stringify(p.args));
    });
    const send = (method, params = {}) => cdp.send(method, params);
    await send("Page.enable");
    await send("Runtime.enable");
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails)
        throw Error(
          r.exceptionDetails.exception?.description || "Evaluation failed",
        );
      return r.result.value;
    };
    const wait = async (expression) => {
      const end = Date.now() + 180000;
      while (Date.now() < end) {
        if (await evaluate(expression)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error(`Timeout: ${expression}`);
    };
    const settle = () =>
      evaluate("new Promise(resolve=>setTimeout(resolve,1000))");
    const shot = async (name) => {
      if (shots) {
        await settle();
        const r = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(
          resolve(shots, name + ".png"),
          Buffer.from(r.data, "base64"),
        );
      }
    };
    for (const [shape, width] of [
      ["desktop", 1440],
      ["phone", 390],
    ]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: shape === "phone",
      });
      await page.goto(
        `http://localhost:${served.server.address().port}/index.html?shot=combat`,
        { waitUntil: "domcontentloaded", timeout: 180000 },
      );
      await wait(
        "!!window.__combat && !!document.querySelector('.hand .card')",
      );
      await evaluate(`(async()=>{
    window.deadTargetErrors=[];window.addEventListener('error',e=>deadTargetErrors.push(e.message));
    const {mountCombat}=await import('/src/ui/screens/combat.js'),{createRunState}=await import('/src/model/state.js');
    const c=window.__combat,r=c.registries,run=createRunState({seed:671,classId:'reaver',registries:r});
    c.enemies=c.enemies.slice(0,2);if(c.enemies.length!==2)throw Error('Fixture needs two enemies');
    c.enemies[0].hp=1;c.enemies[0].block=0;c.enemies[1].hp=c.enemies[1].maxHp=300;
    c.player.energy=c.player.stamina=c.player.mana=20;c.player.flasks=[{flaskId:'blightCoating'}];run.flasks=[{flaskId:'blightCoating'}];
    c.piles.hand=[{instanceId:'qa-kill',cardId:'strike',upgraded:false},{instanceId:'qa-next',cardId:'strike',upgraded:false}];
    mountCombat(document.querySelector('#app'),{registries:r,run,combat:c,meta:{settings:{animationSpeed:'instant',holdConfirm:'off'}},onEnd(){}});
    window.deadFrame=document.querySelector('.enemy');window.liveFrame=document.querySelectorAll('.enemy')[1];
    window.armNext=()=>{const card=document.querySelector('[data-instance-id="qa-next"]');if(!card.classList.contains('selected'))card.click();};
   })()`);
      await settle();
      await evaluate(
        `document.querySelector('[data-instance-id="qa-kill"]').click();deadFrame.classList.add('gp-focus','hover-target','aiming','aim-enemy');const silhouette=document.createElement('span');silhouette.className='aim-silho';deadFrame.append(silhouette);deadFrame.tabIndex=0;deadFrame.focus();deadFrame.click();`,
      );
      await wait("!__combat.enemies[0].alive");
      await settle();
      check(
        await evaluate('deadFrame===document.querySelector(".enemy.dead")'),
        shape + " retains exact frame through a real killing play",
      );
      check(
        await evaluate(
          `deadFrame.inert && deadFrame.getAttribute('aria-disabled')==='true' && !deadFrame.hasAttribute('tabindex') && !deadFrame.hasAttribute('data-focusable') && !deadFrame.matches('.gp-focus,.hover-target,.aiming,.targetable') && !deadFrame.querySelector('.aim-silho') && !deadFrame.contains(document.activeElement)`,
        ),
        shape + " death clears stale aim and native/gamepad focus",
      );
      for (const method of ["body", "name", "Enter", " "]) {
        const result =
          await evaluate(`(()=>{armNext();const name=deadFrame.querySelector('.nm');deadFrame.dispatchEvent(new PointerEvent('pointerenter'));
     const hover=deadFrame.matches('.hover-target,.targetable,.aiming')||!!deadFrame.querySelector('.aim-silho');const before=JSON.stringify([__combat.player.energy,__combat.player.hp,__combat.enemies.map(e=>e.hp),__combat.piles.hand]);deadFrame.focus();name.focus();const nativeFocus=deadFrame.contains(document.activeElement);
     if(${JSON.stringify(method)}==='body')deadFrame.click();else if(${JSON.stringify(method)}==='name')name.click();else name.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(method)},bubbles:true}));
     return {unchanged:before===JSON.stringify([__combat.player.energy,__combat.player.hp,__combat.enemies.map(e=>e.hp),__combat.piles.hand]),nativeFocus,selected:document.querySelector('[data-instance-id="qa-next"]').classList.contains('selected'),hand:__combat.piles.hand.some(c=>c.instanceId==='qa-next'),hover,focus:name.tabIndex>=0&&name.getAttribute('aria-disabled')!=='true',warning:/invalid target/i.test(document.body.innerText)};})()`);
        check(
          result.unchanged &&
            !result.nativeFocus &&
            result.selected &&
            result.hand &&
            !result.hover &&
            !result.focus &&
            !result.warning,
          shape +
            " dead " +
            method +
            " preserves card aim without hover/focus/warning " +
            JSON.stringify(result),
        );
      }
      await evaluate(
        "armNext();window.nativeBefore=JSON.stringify([__combat.player.energy,__combat.player.hp,__combat.enemies.map(e=>e.hp),__combat.piles.hand])",
      );
      const namePoint = await evaluate(
        '(()=>{const r=deadFrame.querySelector(".nm").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
      );
      if (shape === "phone") {
        await send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [namePoint],
        });
        await send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          ...namePoint,
          button: "left",
          clickCount: 1,
        });
        await send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          ...namePoint,
          button: "left",
          clickCount: 1,
        });
      }
      check(
        await evaluate(
          'nativeBefore===JSON.stringify([__combat.player.energy,__combat.player.hp,__combat.enemies.map(e=>e.hp),__combat.piles.hand]) && !deadFrame.matches(".context-selected,.targetable,.aiming,.hover-target,.gp-focus") && !deadFrame.contains(document.activeElement)',
        ),
        shape + " native dead-name click/tap cannot target or spend",
      );
      await shot(shape + "-dead-card");
      await evaluate("armNext();liveFrame.click()");
      await wait("!__combat.piles.hand.some(c=>c.instanceId==='qa-next')");
      await settle();
      check(
        await evaluate("__combat.enemies[1].hp<300"),
        shape + " living enemy still accepts card",
      );
      await evaluate(`document.querySelector('.combat-potions').click()`);
      await settle();
      await evaluate(
        `(()=>{const row=[...document.querySelectorAll('.potion-fold')].find(e=>e.textContent.includes('Blight Coating'));if(!row)throw Error('Missing targeted potion');row.open=true;row.querySelector('button').click();})()`,
      );
      await settle();
      await page
        .getByRole("button", { name: "USE", exact: true })
        .click({ delay: 900 });
      await settle();
      check(
        await evaluate('liveFrame.classList.contains("targetable")'),
        shape + " targeted flask armed through confirmation",
      );
      for (const method of ["body", "name", "Enter"]) {
        const result = await evaluate(
          `(()=>{const name=deadFrame.querySelector('.nm');deadFrame.dispatchEvent(new PointerEvent('pointerenter'));if(${JSON.stringify(method)}==='body')deadFrame.click();else if(${JSON.stringify(method)}==='name')name.click();else name.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return {count:__combat.player.flasks.length,aim:liveFrame.classList.contains('targetable'),hover:deadFrame.classList.contains('hover-target'),warning:/invalid target/i.test(document.body.innerText)};})()`,
        );
        check(
          result.count === 1 && result.aim && !result.hover && !result.warning,
          shape +
            " dead " +
            method +
            " preserves flask aim " +
            JSON.stringify(result),
        );
      }
      await shot(shape + "-dead-flask");
      await evaluate("liveFrame.click()");
      await settle();
      check(
        await evaluate("__combat.player.flasks.length===0"),
        shape + " living enemy accepts targeted flask",
      );
      check(
        runtimeErrors.length === 0 &&
          (await evaluate("deadTargetErrors.length===0")),
        shape + " zero page errors including boot",
      );
      check(
        !warnings.some((w) => /invalid target/i.test(w)),
        shape + " no invalid-target console warning",
      );
      await shot(shape + "-living-played");
    }
  } finally {
    await browser?.close();
    served.server.closeAllConnections();
    served.server.close();
  }
  console.log(`defeated-targets: ${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
