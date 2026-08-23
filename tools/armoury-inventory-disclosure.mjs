#!/usr/bin/env node
// Focused door for Constantine's 2026-08-23 Armoury disclosure correction.
// Source tree, one real headless Chromium, DOM clicks at 1200x730.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TAKE_SHOTS = process.argv.includes('--shots');
const SHIPPED = process.argv.includes('--shipped');
const SHOT_DIR = resolve(ROOT, 'scratch', 'pr315-playtest');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let checks = 0;
let failures = 0;

function check(ok, message) {
  checks += 1;
  console.log(`    ${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) failures += 1;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady);
      ws.addEventListener('error', rejectReady);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveResult, reject) => {
        pending.set(id, { resolve: resolveResult, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function main() {
  console.log('armoury-inventory-disclosure — corrected collapsed-card and unified Inventory contract');
  const server = await serve({ root: ROOT, port: 8531, open: false });
  const browser = await launchBrowser({ prefix: 'arminv-', timeoutMs: 20000 });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label) => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`timed out waiting for ${label}`);
  };
  const screenshot = async (name) => {
    if (!TAKE_SHOTS) return;
    mkdirSync(SHOT_DIR, { recursive: true });
    const png = await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    }, sessionId);
    writeFileSync(resolve(SHOT_DIR, `${name}.png`), Buffer.from(png.data, 'base64'));
  };

  try {
    const appUrl = `http://localhost:${server.port}${SHIPPED ? '/dist/AshenSpire.html' : '/'}?shot=map`;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Page.navigate', { url: appUrl }, sessionId);
    await until("!!document.querySelector('#open-armoury')", 'map Armoury button');
    await evaluate("document.querySelector('#open-armoury').click()");
    await until("!!document.querySelector('.armoury')", 'Armoury');

    const arrival = await evaluate(`(() => {
      const inventory = document.querySelector('[data-region="inventory"]');
      const cards = document.querySelector('[data-region="cards"]');
      const inventoryButton = document.querySelector('[data-fold="inventory"]');
      const cardsButton = document.querySelector('[data-fold="cards"]');
      const rect = (element) => element ? element.getBoundingClientRect() : null;
      return {
        inventory: !!inventory,
        inventoryCollapsed: inventory?.dataset.collapsed || null,
        inventoryExpanded: inventoryButton?.getAttribute('aria-expanded') || null,
        inventoryText: inventoryButton?.innerText.replace(/\\s+/g, ' ').trim() || '',
        cards: !!cards,
        cardsCollapsed: cards?.dataset.collapsed || null,
        order: inventoryButton && cardsButton ? rect(inventoryButton).top < rect(cardsButton).top : false,
      };
    })()`);
    check(arrival.inventory, 'no-selection Armoury has an Inventory region');
    check(arrival.inventoryCollapsed === '1' && arrival.inventoryExpanded === 'false', 'Inventory arrives folded');
    check(/INVENTORY\s+\d+\s+items?/i.test(arrival.inventoryText), `Inventory header reports its item count (${JSON.stringify(arrival.inventoryText)})`);
    check(arrival.cards && arrival.cardsCollapsed === '1', 'Cards still arrive folded');
    check(arrival.order, 'Inventory is stacked directly above Cards');
    await screenshot('desktop-collapsed');

    if (arrival.inventory) {
      await evaluate(`(() => {
        const fold = document.querySelector('[data-fold=inventory]');
        fold.focus();
        fold.click();
      })()`);
      const opened = await evaluate(`(() => {
        const region = document.querySelector('[data-region="inventory"]');
        const rows = [...region.querySelectorAll('[data-inventory-item]')];
        return {
          countLabel: Number(region.querySelector('.rf-count')?.textContent.match(/\\d+/)?.[0] || -1),
          quantity: rows.reduce((sum, row) => sum + Number(row.dataset.itemCount || 0), 0),
          rows: rows.length,
          categories: [...new Set(rows.map((row) => row.dataset.itemCategory))],
          expanded: region.querySelectorAll('.disc-face[aria-expanded="true"]').length,
          visibleActions: [...region.querySelectorAll('[data-act]')].filter((element) => element.offsetParent !== null).length,
          focusedFold: document.activeElement?.dataset.fold || null,
        };
      })()`);
      check(opened.rows > 0, `expanded Inventory draws item rows (${opened.rows})`);
      check(opened.countLabel === opened.quantity, `Inventory header count equals summed quantities (${opened.countLabel})`);
      check(opened.expanded === 0 && opened.visibleActions === 0, 'Inventory item cards arrive folded with no visible actions');
      check(opened.focusedFold === 'inventory', 'Inventory keeps keyboard focus after its redraw');
      check(opened.categories.includes('Armour') && opened.categories.some((category) => ['Weapon', 'Shield', 'Staff'].includes(category)) && opened.categories.includes('Relic'),
        `starting Inventory covers armour, armaments, and relics (${opened.categories.join(', ')})`);
      const firstToggle = await evaluate(`(() => {
        const face = document.querySelector('[data-region="inventory"] .disc-face');
        if (!face) return null;
        face.click();
        const reveal = document.querySelector('[data-region="inventory"] .disc-reveal:not([hidden])');
        const model = reveal?.querySelector('.inventory-model');
        const revealRect = reveal?.getBoundingClientRect();
        const modelRect = model?.getBoundingClientRect();
        return {
          open: face.getAttribute('aria-expanded'),
          panels: document.querySelectorAll('[data-region="inventory"] .disc-face[aria-expanded="true"]').length,
          model: !!model,
          information: !!document.querySelector('[data-region="inventory"] .inventory-information'),
          comparison: !!reveal?.querySelector('.equip-candidate-comparison'),
          modelShare: revealRect?.width && modelRect?.width ? modelRect.width / revealRect.width : null,
        };
      })()`);
      check(firstToggle?.open === 'true' && firstToggle.panels === 1 && firstToggle.model && firstToggle.information,
        'an Inventory item opens one model-and-information panel');
      check(firstToggle?.comparison && firstToggle.modelShare <= 0.22,
        `expanded equipment Inventory matches selector data with a narrow model (${firstToggle?.modelShare == null ? 'absent' : `${Math.round(firstToggle.modelShare * 100)}%`})`);
      await screenshot('desktop-inventory-expanded');
      const closed = await evaluate(`(() => {
        const face = document.querySelector('[data-region="inventory"] .disc-face');
        face?.click();
        return face?.getAttribute('aria-expanded') || null;
      })()`);
      check(closed === 'false', 'clicking the Inventory item title again refolds it');
    }

    await evaluate(`(() => {
      const slot = [...document.querySelectorAll('.equip-slot')].find((element) => element.querySelector('.es-label')?.textContent === 'Right Hand');
      slot?.querySelector('.es-cell.on')?.click();
    })()`);
    await until("!!document.querySelector('.equip-picker .ep-list .disc-face')", 'hand item cards');
    const collapsedCards = await evaluate(`(() => ({
      faces: document.querySelectorAll('.equip-picker .ep-list .disc-face').length,
      outsideActions: document.querySelectorAll('.equip-picker .ep-list > [data-act], .equip-picker .ep-list > .disc-faces > [data-act]').length,
      visibleActions: [...document.querySelectorAll('.equip-picker .ep-list [data-act]')].filter((element) => element.offsetParent !== null).length,
      inventoryPresent: !!document.querySelector('[data-region="inventory"]'),
      sharedFaces: document.querySelectorAll('.equip-picker .inventory-face').length,
      legacyFaces: document.querySelectorAll('.equip-picker .equip-chip.as-face').length,
    }))()`);
    check(collapsedCards.faces > 0, `selected hand draws folded item cards (${collapsedCards.faces})`);
    check(collapsedCards.inventoryPresent, 'Inventory remains available while a slot is selected');
    check(collapsedCards.sharedFaces === collapsedCards.faces && collapsedCards.legacyFaces === 0,
      `slot selection reuses the Inventory card face (${collapsedCards.sharedFaces}/${collapsedCards.faces}, legacy ${collapsedCards.legacyFaces})`);
    check(collapsedCards.outsideActions === 0 && collapsedCards.visibleActions === 0,
      `collapsed item cards expose no action controls (outside ${collapsedCards.outsideActions}, visible ${collapsedCards.visibleActions})`);

    const expandedCard = await evaluate(`(() => {
      const face = document.querySelector('.equip-picker .ep-list .disc-face');
      face.click();
      const visible = [...document.querySelectorAll('.equip-picker .ep-list [data-act]')].filter((element) => element.offsetParent !== null);
      return {
        open: face.getAttribute('aria-expanded'),
        actions: visible.length,
        actionInsideReveal: visible.length === 1 && !!visible[0].closest('.disc-reveal'),
        attackAfter: Number(visible[0]?.closest('.disc-reveal')?.querySelector('[data-role=attack] strong')?.textContent || NaN),
      };
    })()`);
    check(expandedCard.open === 'true' && expandedCard.actions === 1 && expandedCard.actionInsideReveal,
      `expanded item card reveals exactly one in-card action (${expandedCard.actions})`);
    check(expandedCard.attackAfter === 5,
      `an equipped card previews its Unequip result (${expandedCard.attackAfter}, expected unarmed attack 5)`);
    const actionReach = await evaluate(`(() => {
      const action = document.querySelector('.equip-picker .ep-list [data-act]');
      action?.scrollIntoView({ block: 'center' });
      const rect = action?.getBoundingClientRect();
      return {
        insideReveal: !!action?.closest('.disc-reveal'),
        inViewport: !!rect && rect.top >= 0 && rect.bottom <= innerHeight,
      };
    })()`);
    check(actionReach.insideReveal && actionReach.inViewport,
      'the expanded card action can be scrolled into the viewport without leaving its reveal');
    await screenshot('desktop-card-expanded');
    const afterRefold = await evaluate(`(() => {
      document.querySelector('.equip-picker .ep-list .disc-face')?.click();
      return [...document.querySelectorAll('.equip-picker .ep-list [data-act]')].filter((element) => element.offsetParent !== null).length;
    })()`);
    check(afterRefold === 0, 'refolding the item hides its action again');

    const drag = await evaluate(`(() => {
      const fold = document.querySelector('[data-fold=inventory]');
      if (fold?.getAttribute('aria-expanded') === 'false') fold.click();
      const dragItem = (id, label) => {
        const source = [...document.querySelectorAll('[data-region=inventory] [data-inventory-item]')]
          .find((element) => element.dataset.itemId === id);
        const slot = [...document.querySelectorAll('.equip-slot')]
          .find((element) => element.querySelector('.es-label')?.textContent === label);
        const target = slot?.querySelector('.es-cell.on');
        if (!source || !target) return false;
        const data = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: data }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
        return true;
      };
      const swordMoved = dragItem('straightSword', 'Left Hand');
      const shieldMoved = dragItem('roundShield', 'Right Hand');
      const slotTitle = (label) => [...document.querySelectorAll('.equip-slot')]
        .find((element) => element.querySelector('.es-label')?.textContent === label)
        ?.querySelector('.es-cell.on')?.title || null;
      const layers = [...document.querySelectorAll('.armoury-figure .equipped-figure > img')]
        .map((element) => ({
          z: element.style.zIndex || '',
          transform: element.style.transform || 'none',
        }));
      return {
        draggable: !!document.querySelector('[data-region=inventory] [data-inventory-item]')?.draggable,
        swordMoved,
        shieldMoved,
        left: slotTitle('Left Hand'),
        right: slotTitle('Right Hand'),
        swordMirror: layers.find((layer) => layer.z === '2')?.transform || null,
        shieldMirror: layers.find((layer) => layer.z === '3')?.transform || null,
      };
    })()`);
    check(drag?.draggable, 'equipment Inventory rows publish a native drag source');
    check(drag?.swordMoved && drag?.shieldMoved && drag?.left === 'Straight Sword' && drag?.right === 'Round Shield',
      `dragging Inventory swaps the exact slot occupants (${drag?.left || 'no left'} / ${drag?.right || 'no right'})`);
    check(drag?.swordMirror === 'scaleX(-1)' && drag?.shieldMirror === 'scaleX(-1)',
      `swapped armaments mirror per socket instead of following type (${drag?.swordMirror || 'none'} / ${drag?.shieldMirror || 'none'})`);

    if (TAKE_SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
      }, sessionId);
      await cdp.send('Page.navigate', { url: appUrl }, sessionId);
      await until("!!document.querySelector('#open-armoury')", 'phone map Armoury button');
      await evaluate("document.querySelector('#open-armoury').click()");
      await until("!!document.querySelector('[data-region=inventory]')", 'phone Inventory');
      await evaluate(`(() => {
        const fold = document.querySelector('[data-fold=inventory]');
        if (fold?.getAttribute('aria-expanded') === 'false') fold.click();
        document.querySelector('[data-region=inventory] .disc-face')?.click();
      })()`);
      const phone = await evaluate(`(() => {
        const panel = document.querySelector('.armoury');
        const inventory = document.querySelector('[data-region=inventory]');
        const reveal = inventory?.querySelector('.disc-reveal:not([hidden])');
        const rect = reveal?.getBoundingClientRect();
        return {
          noHorizontalOverflow: panel ? panel.scrollWidth <= panel.clientWidth + 1 : false,
          revealVisible: !!rect && rect.width > 0 && rect.height > 0,
          model: !!reveal?.querySelector('.inventory-model'),
          information: !!reveal?.querySelector('.inventory-information'),
        };
      })()`);
      check(phone.noHorizontalOverflow, 'phone Armoury has no horizontal overflow');
      check(phone.revealVisible && phone.model && phone.information,
        'phone item disclosure keeps its model and information visible');
      await screenshot('phone-inventory-expanded');
      console.log(`    SHOTS ${SHOT_DIR}`);
    }

    if (!SHIPPED) await evaluate(`(async () => {
      const [{ contentBundle }, { createRegistries }, { createRunState }, { mountEquipment }] = await Promise.all([
        import('/src/content/index.js'),
        import('/src/model/registries.js'),
        import('/src/model/state.js'),
        import('/src/ui/screens/equipment.js'),
      ]);
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 0x315, classId: 'reaver', registries });
      const equipped = new Set(Object.values(run.loadout.sets).flat().filter(Boolean));
      const cap = registries.balance.equipment.storageSlots;
      run.loadout.storage = registries.equipment.armaments
        .map((piece) => piece.id)
        .filter((id) => !equipped.has(id))
        .slice(0, cap);
      document.body.innerHTML = '<main id="pr315-fixture"></main>';
      const fixture = { run, commits: 0 };
      window.__pr315Fixture = fixture;
      mountEquipment(document.querySelector('#pr315-fixture'), {
        registries,
        run,
        meta: {},
        inCombat: false,
        onChange: () => { fixture.commits += 1; },
        onClose: () => {},
      });
    })()`);
    if (!SHIPPED) await until("!!document.querySelector('.armoury')", 'full-Inventory Armoury fixture');
    if (!SHIPPED) await evaluate(`(() => {
      const slot = [...document.querySelectorAll('.equip-slot')]
        .find((element) => element.querySelector('.es-label')?.textContent === 'Right Hand');
      slot?.querySelector('.es-cell.on')?.click();
      const face = [...document.querySelectorAll('.ep-list .disc-face')]
        .find((element) => element.querySelector('.ec-name')?.textContent === 'Straight Sword');
      face?.click();
    })()`);
    const refusal = SHIPPED ? null : await evaluate(`(() => {
      const fixture = window.__pr315Fixture;
      const before = JSON.stringify(fixture.run.loadout);
      const action = document.querySelector('.ep-list [data-act=unequip]');
      action?.click();
      return {
        unchanged: JSON.stringify(fixture.run.loadout) === before,
        commits: fixture.commits,
        refusal: action?.dataset.refusal || '',
      };
    })()`);
    if (refusal) {
      check(refusal.unchanged, 'a full Inventory keeps a refused Unequip atomic');
      check(refusal.commits === 0 && /inventory is full/i.test(refusal.refusal),
        `a refused Unequip skips success commit and explains the full Inventory (${JSON.stringify(refusal.refusal)})`);
    }
  } finally {
    cdp.close();
    await browser.close();
    await (server.close ? server.close() : server.stop ? server.stop() : Promise.resolve());
  }

  console.log('');
  console.log(`  ${checks - failures} passed, ${failures} failed`);
  console.log(`  BOUNDARY: ${SHIPPED ? 'dist/AshenSpire.html' : 'source tree'}, real Chromium DOM clicks at 1200x730${TAKE_SHOTS ? ' plus a 390x844 screenshot/geometry pass' : ''}. Model tests cover synthesized potion and duplicate-count rows.`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
