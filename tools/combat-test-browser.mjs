import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const out = resolve('artifacts/combat-test'); mkdirSync(out, { recursive: true });
const server = await serve({ root: resolve('.'), port: 8625, open: false });
const browser = await launchBrowser({ prefix: 'combat-foundations-', browser: resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) });
const ws = new WebSocket(browser.wsUrl), pending = new Map(), errors = []; let serial = 0;
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    const message = msg.params.args.map((a) => a.value || a.description).join(' ');
    // The normal victory timeline deliberately renders an inert snapshot of
    // the killing card after the engine removes it from all piles.
    if (!message.startsWith('[combat] hand card not previewable (stale snapshot):')) errors.push(message);
    console.log('BROWSER', msg.params.type, message);
  }
  const pair = pending.get(msg.id); if (!pair) return;
  pending.delete(msg.id); if (msg.error) pair.reject(new Error(msg.error.message)); else pair.resolve(msg.result);
});
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let checks = 0;
const check = (ok, text) => { if (!ok) throw new Error(text); checks++; console.log(`PASS ${text}`); };
try {
  for (const shape of [{ name: 'desktop', width: 1365, height: 1000, mobile: false }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, mobile: shape.mobile, deviceScaleFactor: 1 }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const until = async (expression) => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timed out: ${expression}; ${await evaluate('document.body.innerText')}`); };
    const click = async (selector) => {
      const point = await evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const b=el.getBoundingClientRect();for(const fy of [.3,.15,.5,.7,.9])for(const fx of [.5,.1,.2,.3,.7,.9]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(el.contains(document.elementFromPoint(x,y)))return{x,y};}throw new Error('No reachable point '+${JSON.stringify(selector)});})()`);
      if (shape.mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] }, sessionId); if (selector === '.end-turn') await wait(900); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId); }
      else { await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, sessionId); if (selector === '.end-turn') await wait(900); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, sessionId); }
      await wait(150);
    };
    const capture = async (name) => { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId); writeFileSync(resolve(out, `${shape.name}-${name}.png`), Buffer.from(shot.data, 'base64')); };
    const page = process.argv.includes('--source') ? 'index.html' : 'AshenSpire.html';
    for (const build of ['heavy', 'bleed', 'caster']) {
      await send('Page.navigate', { url: `${server.url}${page}?shot=combat-test&build=${build}` }, sessionId);
      await until('!!document.querySelector("#combat-test-form")');
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}/${build}: setup fits viewport`);
      if (build === 'heavy') await capture('setup');
      const storage = await evaluate('JSON.stringify({...localStorage})');
      await click('.test-start');
      await until('!!window.__combat?.foundation && document.querySelectorAll(".hand .card").length===5');
      check(await evaluate('!!document.querySelector(".enemy-row img")'), `${shape.name}/${build}: authored enemy sprite displayed`);
      const stance = build === 'caster' ? 'prototypeCasterStance' : 'prototypePhysicalStance';
      await click(`[data-card-id="${stance}"]`); await click('.combatant.player');
      await until('!!window.__combat.player.stanceId && !document.querySelector(".end-turn").disabled');
      await wait(600);
      check(await evaluate('!!document.querySelector(".combat-pose-aura")?.dataset.motif'), `${shape.name}/${build}: persistent stance aura`);
      // A returned stance card must be visibly unavailable while already active.
      // Temporarily expose a copy, then remove it before continuing the fight.
      await evaluate(`(()=>{const c=window.__combat;const card=c.piles.discard.find(x=>x.cardId===${JSON.stringify(stance)});c.piles.hand.push({...card,instanceId:'test-active-stance'});window.__renderCombatForShot();})()`);
      check(await evaluate('document.querySelector("[data-instance-id=test-active-stance]").classList.contains("unaffordable")'), `${shape.name}/${build}: already-active stance is visibly unavailable`);
      await evaluate('window.__combat.piles.hand=window.__combat.piles.hand.filter(c=>c.instanceId!=="test-active-stance");window.__renderCombatForShot()');
      await click('.end-turn'); await until('window.__combat.turn===2 && !document.querySelector(".end-turn").disabled');
      await wait(600);
      check(await evaluate('window.__combat.piles.hand.some(c=>c.cardId==="dodgeRoll") && !!window.__combat.player.stanceId'), `${shape.name}/${build}: Dodge retained and stance persists`);
      await click('[data-card-id="dodgeRoll"]'); await click('.combatant.player');
      await until('window.__combat.player.evade===1 && !document.querySelector(".end-turn").disabled'); await wait(500);
      check(await evaluate('!!document.querySelector(".foundation-evade")'), `${shape.name}/${build}: Evade visible in real HUD`);
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}/${build}: battlefield fits viewport`);
      if (build === 'heavy') {
        const tipOpen = 'document.querySelector("#tooltip")?.dataset.open==="true"';
        const hover = async (selector, expected, screenshot, reset = true) => {
          if (reset) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, sessionId); await wait(650); }
          const point = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing hover target '+${JSON.stringify(selector)});const b=el.getBoundingClientRect();for(const fy of [.5,.2,.8])for(const fx of [.5,.15,.85]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(el.contains(document.elementFromPoint(x,y)))return{x,y};}throw new Error('Unreachable hover target '+${JSON.stringify(selector)});})()`);
          await evaluate('window.__hoverAt=performance.now();window.__openedAfter=0;window.__hoverObserver?.disconnect();window.__hoverObserver=new MutationObserver(()=>{if(document.querySelector("#tooltip")?.dataset.open==="true"&&!window.__openedAfter)window.__openedAfter=performance.now()-window.__hoverAt;});window.__hoverObserver.observe(document.body,{subtree:true,attributes:true});');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, sessionId);
          await until(`${tipOpen} && document.querySelector(${JSON.stringify(selector)}).closest('[data-tip-attached]')?.hasAttribute('data-tip-open') && document.querySelector('#tooltip').textContent.includes(${JSON.stringify(expected)})`);
          check(await evaluate('window.__openedAfter>=450 && window.__openedAfter<1500'), `hover ${selector}: explains after half a second`);
          check(await evaluate('(()=>{const b=document.querySelector("#tooltip").getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1})()'), `hover ${selector}: explanation fits viewport`);
          if (screenshot) await capture(screenshot);
        };
        if (!shape.mobile) {
          for (const [selector, expected, screenshot] of [
            ['.hud-class', 'Class'], ['.hud-cinders', 'Currency'], ['.hud-act', 'region'], ['.hud-floor', 'current step'],
            ['.topbar [data-res=hp]', 'Health remaining', 'health-hover'], ['.topbar [data-res=mana]', 'Mana pays', 'mana-hover'], ['.topbar [data-res=stamina]', 'Stamina pays'],
            ['#combat-armoury', 'fixed weapon'], ['#combat-menu', 'Menu'], ['.hud-mode-grip', 'HUD'], ['.turn-ribbon', 'Turn'],
            ['.combatant.player [data-res=hp]', 'Health remaining'], ['.combatant.player .block-badge', 'Absorbs'],
            ['.stance-chip', 'Gain 3 Block'], ['.foundation-evade', 'charge'],
            ['.combatant.enemy [data-res=hp]', 'Health remaining'], ['.combatant.enemy .intent', 'Intent:', 'intent-hover'],
            ['.combatant.enemy .nm', 'HP'], ['.energy-orb', 'Actions'], ['.pile.draw', 'Draw pile'], ['.pile.spent', 'Discard'], ['.combat-potions', 'Potions'], ['.end-turn', 'End Turn'],
            ['.hand .card .cost', 'cost'], ['.hand .card .stamina-cost', 'cost'], ['.hand .card .ctag', ''],
          ]) await hover(selector, expected, screenshot);
          for (const selector of ['.combatant.enemy [data-res=poise]', '.arcane-exposure-meter']) {
            if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) await hover(selector, selector.includes('poise') ? 'Stagger' : '/', 'buildup-hover');
          }
          await hover('.hand .card .cost', 'cost');
          const cardName = await evaluate('document.querySelector(".hand .card .cname").textContent');
          await hover('.hand .card .cname', cardName, null, false);
          await hover('.hand .card .cost', 'cost', 'card-cost-hover', false);
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, sessionId); await wait(650);
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
          await evaluate('document.querySelector(".hud-class").focus()');
          await until(`${tipOpen} && document.querySelector('#tooltip').textContent.includes('Class')`);
          check(true, 'keyboard focus explains HUD identity');
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
          check(!(await evaluate(tipOpen)), 'Escape dismisses HUD help');
          await evaluate('document.activeElement.blur()');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 3, y: 3 }, sessionId); await wait(650);
          const point = await evaluate(`(()=>{const el=document.querySelector('.foundation-evade');const b=el.getBoundingClientRect();window.__abilityHoverStart=0;window.__abilityHoverDelay=0;el.addEventListener('pointerenter',()=>{window.__abilityHoverStart=performance.now();},{once:true});const observer=new MutationObserver(()=>{const tip=document.querySelector('#tooltip');if(tip?.dataset.open==='true'&&tip.textContent.includes('charge')){window.__abilityHoverDelay=performance.now()-window.__abilityHoverStart;observer.disconnect();}});observer.observe(document.body,{subtree:true,attributes:true,childList:true});return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, sessionId);
          await until(`${tipOpen} && document.querySelector('#tooltip').textContent.includes('dodgeable attack hit')`);
          check(await evaluate('window.__abilityHoverDelay>=450'), 'desktop: Evade uses the shared half-second hover delay');
          check(await evaluate('document.querySelector("#tooltip").textContent.includes("start of your next turn")'), 'desktop: Evade explains consumption and expiry');
          await capture('evade-tooltip');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 3, y: 3 }, sessionId); await wait(650);
          check(!(await evaluate(tipOpen)), 'desktop: Evade tooltip closes after leaving');
        }
        await evaluate('window.__combat.player.statuses.strength={stacks:2};window.__renderCombatForShot()');
        await click('[data-card-id="prototypeGuard"]');
        const beforeInspect = await evaluate('JSON.stringify({energy:window.__combat.player.energy,stamina:window.__combat.player.stamina,evade:window.__combat.player.evade,hand:window.__combat.piles.hand})');
        await click('.foundation-evade'); await until('!!document.querySelector(".combatant-abilities")');
        check(await evaluate('document.querySelectorAll(".combatant-ability").length===3'), `${shape.name}: badge opens all active abilities and effects`);
        check(await evaluate('document.querySelector("[data-ability-id=prototypeGuardStance]").textContent.includes("Gain 3 Block when entering. Gain 2 Block")'), `${shape.name}: stance explains its actual mechanics`);
        check(await evaluate('document.querySelector("[data-ability-id=evade]").textContent.includes("Unused charges expire") && document.querySelector("[data-ability-id=strength]").textContent.includes("2")'), `${shape.name}: Evade and live status stacks are inspectable`);
        check(!(await evaluate('document.querySelector(".combatant-abilities > summary .tooltip-keyword")')), `${shape.name}: section heading is a disclosure rather than an accidental glossary link`);
        await capture('active-abilities');
        if (!shape.mobile) {
          await hover('.combatant-inspector-resource[data-res=hp]', 'Health remaining');
          await hover('.combatant-inspector-resource[data-res=block]', 'Absorbs');
          await hover('.combatant-abilities > summary', 'active entries');
          await hover('[data-ability-id=evade] > summary', 'charge', 'inspector-hover');
          await hover('.combatant-door .modal-close', 'Close');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, sessionId); await wait(650);
        }
        await click('.combatant-abilities > summary');
        check(!(await evaluate('document.querySelector(".combatant-abilities").open')), `${shape.name}: active skills heading collapses the list`);
        await click('.combatant-abilities > summary');
        await click('[data-ability-id=evade] > summary');
        check(!(await evaluate('document.querySelector("[data-ability-id=evade]").open')), `${shape.name}: an ability supports detail disclosure`);
        await click('[data-ability-id=evade] > summary');
        await click('.combatant-door .modal-foot button'); await until('!document.querySelector(".combatant-door")');
        check(true, `${shape.name}: inspector footer closes after tooltip interaction`);
        await click('.stance-chip'); await until('!!document.querySelector(".combatant-abilities")');
        check(await evaluate('document.querySelectorAll(".combatant-ability").length===3'), `${shape.name}: stance badge also opens the complete list`);
        await click('.combatant-door .modal-close'); await until('!document.querySelector(".combatant-door")');
        check(await evaluate('JSON.stringify({energy:window.__combat.player.energy,stamina:window.__combat.player.stamina,evade:window.__combat.player.evade,hand:window.__combat.piles.hand})') === beforeInspect, `${shape.name}: inspection never plays the armed self-target card`);
        if (!shape.mobile) {
          await evaluate('document.querySelector(".foundation-evade").focus()');
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, sessionId);
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, sessionId);
          await until('!!document.querySelector(".combatant-abilities")');
          check(true, 'desktop: keyboard activates badge inspection');
          await click('.combatant-door .modal-close'); await until('!document.querySelector(".combatant-door")');
        }
        const openHelpSettings = async () => {
          await click('#combat-armoury'); await click('.test-settings');
          await click('.set-tab[data-member="Accessibility"]');
        };
        const closeHelpSettings = async () => { await click('#set-close'); await click('.modal-veil .modal-close'); };
        await openHelpSettings();
        await click('[data-key="tooltipDelay"][data-val="1s"]');
        await click('[data-key="tooltipCloseDelay"][data-val="0.25s"]');
        check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}: tooltip settings fit viewport`);
        await evaluate('document.querySelector(".set-panel").scrollTop=0');
        await capture('tooltip-settings');
        await closeHelpSettings();
        if (!shape.mobile) {
          await hover('.hud-class', 'Class');
          check(await evaluate('window.__openedAfter>=950'), 'existing HUD target uses newly selected one-second delay');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, sessionId); await wait(400);
          check(!(await evaluate(tipOpen)), 'tooltip uses newly selected quarter-second closing delay');
        }
        await openHelpSettings();
        check(await evaluate(`document.querySelector('[data-key="tooltipDelay"].on')?.dataset.val === '1s'`), `${shape.name}: reopening settings retains selected delay`);
        await click('.toggle[data-key="hoverTooltips"]');
        await closeHelpSettings();
        if (!shape.mobile) {
          const point = await evaluate('(()=>{const b=document.querySelector(".hud-class").getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()');
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, sessionId); await wait(1150);
          check(!(await evaluate(tipOpen)), 'disabled hover remains silent');
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
          await evaluate('document.querySelector(".hud-class").focus()');
          await until(`${tipOpen} && document.querySelector('#tooltip').textContent.includes('Class')`);
          check(true, 'keyboard help works while pointer hover is disabled');
        }
        await click('.foundation-evade'); await until('!!document.querySelector(".combatant-abilities")');
        check(true, `${shape.name}: explicit inspection works with hover disabled`);
        await click('.combatant-door .modal-close');
        await openHelpSettings();
        await click('.toggle[data-key="hoverTooltips"]');
        await click('[data-key="tooltipDelay"][data-val="0.5s"]');
        await click('[data-key="tooltipCloseDelay"][data-val="0.5s"]');
        await closeHelpSettings();
        await evaluate('delete window.__combat.player.statuses.strength;window.__renderCombatForShot()');
      }
      await capture(build);
      await click('.end-turn'); await until('window.__combat.turn===3 && !document.querySelector(".end-turn").disabled');
      check(await evaluate('window.__combat.eventLog.some(e=>e.type==="attackEvaded")'), `${shape.name}/${build}: incoming hit consumes Evade`);
      if (build === 'heavy') {
        check(!(await evaluate('document.querySelector(".foundation-evade")')), `${shape.name}: spent Evade badge disappears`);
        await click('.stance-chip'); await until('!!document.querySelector(".combatant-abilities")');
        check(!(await evaluate('document.querySelector("[data-ability-id=evade], [data-ability-id=strength]")')), `${shape.name}: inspector removes consumed and expired effects`);
        await click('.combatant-door .modal-close'); await until('!document.querySelector(".combatant-door")');
      }
      check(await evaluate('JSON.stringify({...localStorage})') === storage, `${shape.name}/${build}: durable storage unchanged`);
      // Exercise actual victory/continuation controls with a near-death enemy
      // fixture. Combat and damage still commit through the normal hand input.
      if (build === 'heavy') {
        await evaluate('window.__combat.enemies[0].hp=1');
        const attack = await evaluate('window.__combat.piles.hand.find(c=>window.__combat.registries.cards.get(c.cardId).effects.some(e=>e.op==="damage"))?.cardId');
        if (!attack) throw new Error('Expected a drawn attack for continuation fixture');
        await click(`[data-card-id="${attack}"]`); await click('.combatant.enemy');
        await until('!!document.querySelector("#test-next")');
        const carry = await evaluate('({hp:window.__combat.player.hp,stamina:window.__combat.player.stamina,mana:window.__combat.player.mana})');
        await click('#test-next'); await until('!!document.querySelector(".combat") && window.__combat.enemies[0].enemyId==="prototype_armored"');
        check(await evaluate(`['hp','stamina','mana'].every(k=>window.__combat.player[k]===${JSON.stringify(carry)}[k])`), `${shape.name}: next real battlefield preserves all resource pools`);
      }
    }
    await send('Target.closeTarget', { targetId });
  }
  check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
} finally {
  await Promise.race([send('Browser.close').catch(() => {}), wait(1200)]); ws.close(); await browser.close();
  server.server.closeAllConnections?.(); await new Promise((done) => server.server.close(done));
}
console.log(`${checks} game test-build browser checks passed. Route continuation uses an explicit low-HP fixture; this is not a full-run balance test.`);
