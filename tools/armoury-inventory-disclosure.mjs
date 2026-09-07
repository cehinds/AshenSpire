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
  console.log('armoury-inventory-disclosure — dedicated tabs and Inventory item disclosure contract');
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
    const shotSettings = encodeURIComponent(JSON.stringify({ holdConfirm: 'normal' }));
    const appUrl = `http://localhost:${server.port}${SHIPPED ? '/dist/AshenSpire.html' : '/'}?shot=map&shotSettings=${shotSettings}`;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Page.navigate', { url: appUrl }, sessionId);
    await until("!!document.querySelector('#open-armoury')", 'map Armoury button');
    await evaluate("document.querySelector('#open-armoury').click()");
    await until("!!document.querySelector('.armoury')", 'Armoury');

    const arrival = await evaluate(`(() => ({
      tabs: [...document.querySelectorAll('[data-surface="armouryView"] [data-member]')].map(x => x.dataset.member),
      view: document.querySelector('.armoury')?.dataset.view,
      trays: document.querySelectorAll('.armoury .region-fold').length,
    }))()`);
    check(arrival.tabs.join('|') === 'grid|rack|hybrid|cards', 'Character, Equipment, Inventory and Cards have dedicated tabs');
    check(arrival.view === 'rack' && arrival.trays === 0, 'Equipment arrives without collapsible trays');
    await evaluate(`document.querySelector('[data-surface="armouryView"] [data-member="hybrid"]').click()`);
    await until("!!document.querySelector('.armoury-inventory .disc-face')", 'Inventory item cards');
    {
      const opened = await evaluate(`(() => {
        const region = document.querySelector('.armoury-inventory');
        const rows = [...region.querySelectorAll('[data-inventory-item]')];
        return {
          rows: rows.length,
          categories: [...new Set(rows.map(row => row.dataset.itemCategory))],
          expanded: region.querySelectorAll('.disc-face[aria-expanded="true"]').length,
          visibleActions: [...region.querySelectorAll('[data-act]')].filter(x => x.offsetParent !== null).length,
          selected: document.activeElement?.dataset.member,
        };
      })()`);
      check(opened.rows > 0, `Inventory draws item rows (${opened.rows})`);
      check(opened.expanded === 0 && opened.visibleActions === 0, 'Inventory item cards arrive folded with no visible actions');
      check(opened.selected === 'hybrid', 'Inventory tab retains keyboard focus after redraw');
      check(opened.categories.includes('Armour') && opened.categories.some(category => ['Weapon', 'Shield', 'Staff'].includes(category)) && opened.categories.includes('Relic'),
        `Inventory covers armour, armaments and relics (${opened.categories.join(', ')})`);
      const firstToggle = await evaluate(`(() => {
        const face = document.querySelector('.armoury-inventory .disc-face');
        if (!face) return null;
        const rect = face.getBoundingClientRect();
        const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
          bubbles: true, cancelable: true, pointerId: 315, pointerType: 'mouse', button: 0, detail: 1,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }));
        event('pointerdown'); event('pointerup'); event('click', MouseEvent);
        const reveal = document.querySelector('.armoury-inventory .disc-reveal:not([hidden])');
        const model = reveal?.querySelector('.inventory-model');
        const revealRect = reveal?.getBoundingClientRect();
        const modelRect = model?.getBoundingClientRect();
        return {
          open: face.getAttribute('aria-expanded'),
          panels: document.querySelectorAll('.armoury-inventory .disc-face[aria-expanded="true"]').length,
          model: !!model,
          information: !!document.querySelector('.armoury-inventory .inventory-information'),
          comparisonAnchor: !!reveal?.querySelector('.inventory-detail[data-component="armoury.comparisonTooltipAnchor"]'),
          modelShare: revealRect?.width && modelRect?.width ? modelRect.width / revealRect.width : null,
        };
      })()`);
      check(firstToggle?.open === 'true' && firstToggle.panels === 1 && firstToggle.model && firstToggle.information,
        'an Inventory item opens one model-and-information panel');
      check(firstToggle?.comparisonAnchor && firstToggle.modelShare <= 0.22,
        `expanded equipment Inventory exposes comparison and a narrow model (${firstToggle?.modelShare == null ? 'absent' : `${Math.round(firstToggle.modelShare * 100)}%`})`);
      await screenshot('desktop-inventory-expanded');
      const closed = await evaluate(`(() => {
        const face = document.querySelector('.armoury-inventory .disc-face');
        if (face) {
          const rect = face.getBoundingClientRect();
          const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
            bubbles: true, cancelable: true, pointerId: 316, pointerType: 'mouse', button: 0, detail: 1,
            clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          }));
          event('pointerdown'); event('pointerup'); event('click', MouseEvent);
        }
        return face?.getAttribute('aria-expanded') || null;
      })()`);
      check(closed === 'false', 'clicking the Inventory item title again refolds it');
    }

    await evaluate(`document.querySelector('[data-surface="armouryView"] [data-member="cards"]').click()`);
    const gallery = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.armoury-card-gallery > .card')];
      return { count: cards.length, page: document.querySelector('.armoury')?.dataset.view,
        noTray: !document.querySelector('.armoury .region-fold'),
        shaped: cards.every(x => { const r=x.getBoundingClientRect(); return Math.abs(r.width/r.height-5/7)<0.03; }) };
    })()`);
    check(gallery.page === 'cards' && gallery.count > 0 && gallery.noTray, 'Cards tab exposes the deck without opening a tray');
    check(gallery.shaped, 'deck cards preserve their portrait proportions');
    await screenshot('desktop-cards-tab');
    await evaluate(`document.querySelector('[data-surface="armouryView"] [data-member="rack"]').click()`);

    await evaluate(`(() => {
      document.querySelector('[data-slot-position="rightHand:0"] .armoury-position-action')?.click();
    })()`);
    await until("!!document.querySelector('.armoury-inventory .ep-list .disc-face')", 'filtered Inventory item cards');
    const collapsedCards = await evaluate(`(() => ({
      faces: document.querySelectorAll('.armoury-inventory .ep-list .disc-face').length,
      outsideActions: document.querySelectorAll('.armoury-inventory .ep-list > [data-act], .armoury-inventory .ep-list > .disc-faces > [data-act]').length,
      visibleActions: [...document.querySelectorAll('.armoury-inventory .ep-list [data-act]')].filter((element) => element.offsetParent !== null).length,
      inventoryPresent: !!document.querySelector('.armoury-inventory'),
      filteredFor: document.querySelector('.armoury-inventory .ep-list')?.dataset.filteredFor || null,
      sharedFaces: document.querySelectorAll('.armoury-inventory .inventory-face').length,
      legacyFaces: document.querySelectorAll('.armoury-inventory .equip-chip.as-face').length,
    }))()`);
    check(collapsedCards.faces > 0, `selected hand draws folded item cards (${collapsedCards.faces})`);
    check(collapsedCards.inventoryPresent && collapsedCards.filteredFor === 'rightHand:0',
      `Inventory remains available and filters for the selected socket (${collapsedCards.filteredFor || 'none'})`);
    check(collapsedCards.sharedFaces === collapsedCards.faces && collapsedCards.legacyFaces === 0,
      `slot selection reuses the Inventory card face (${collapsedCards.sharedFaces}/${collapsedCards.faces}, legacy ${collapsedCards.legacyFaces})`);
    check(collapsedCards.outsideActions === 0 && collapsedCards.visibleActions === 0,
      `collapsed item cards expose no action controls (outside ${collapsedCards.outsideActions}, visible ${collapsedCards.visibleActions})`);

    const expandedCard = await evaluate(`(() => {
      const face = document.querySelector('.armoury-inventory .ep-list .disc-face');
      const rect = face.getBoundingClientRect();
      const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
        bubbles: true, cancelable: true, pointerId: 317, pointerType: 'mouse', button: 0, detail: 1,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      }));
      event('pointerdown'); event('pointerup'); event('click', MouseEvent);
      const visible = [...document.querySelectorAll('.armoury-inventory .ep-list [data-act]')].filter((element) => element.offsetParent !== null);
      return {
        open: face.getAttribute('aria-expanded'),
        actions: visible.length,
        actionInsideReveal: visible.length === 1 && !!visible[0].closest('.disc-reveal'),
        instruction: document.querySelector('.armoury-inventory .inventory-detail')?.getAttribute('aria-label') || '',
        focusable: document.querySelector('.armoury-inventory .inventory-detail')?.dataset.focusable || '',
        role: document.querySelector('.armoury-inventory .inventory-detail')?.getAttribute('role') || '',
      };
    })()`);
    check(expandedCard.open === 'true' && expandedCard.actions === 1 && expandedCard.actionInsideReveal,
      `expanded item card reveals exactly one in-card action (${expandedCard.actions})`);
    check(/press and hold.+preview comparison/i.test(expandedCard.instruction)
      && !/hover or focus/i.test(expandedCard.instruction)
      && /(press and hold|activate this card) to (equip|unequip)/i.test(expandedCard.instruction),
    `an action-owning card distinguishes comparison access from its equipment action (${JSON.stringify(expandedCard.instruction)})`);
    check(expandedCard.focusable === 'true' && expandedCard.role === 'button',
      'the expanded whole-card action participates in the shared keyboard/gamepad focus cursor');
    const wholeCardFill = await evaluate(`(async () => {
      const source = document.querySelector('.armoury-inventory .inventory-detail');
      const reveal = source?.closest('.disc-reveal');
      const face = [...(source?.closest('.disc-faces')?.children || [])]
        .find((candidate) => candidate.dataset?.face === source?.dataset.inventoryItem)
        ?.querySelector('.inventory-face');
      const rect = source?.getBoundingClientRect();
      if (!source || !rect) return null;
      const pointer = (type) => source.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 320, pointerType: 'touch', button: 0,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      }));
      pointer('pointerdown');
      await new Promise((done) => setTimeout(done, 260));
      const result = {
        delegated: source.dataset.holdFeedback === 'delegated',
        faceProgress: Number(face?.dataset.holdProgress || 0),
        revealProgress: Number(reveal?.dataset.holdProgress || 0),
        faceFill: getComputedStyle(face).backgroundImage,
        revealFill: getComputedStyle(reveal).backgroundImage,
        actionTag: source.querySelector('[data-act]')?.tagName || '',
        actionButtons: source.querySelectorAll('button[data-act]').length,
        comparisonPreview: source.dataset.comparisonPreview || '',
        comparisonVisible: !!document.querySelector('#tooltip')
          && getComputedStyle(document.querySelector('#tooltip')).display !== 'none',
      };
      pointer('pointerup');
      await new Promise((done) => setTimeout(done, 0));
      result.comparisonAfterRelease = !!document.querySelector('#tooltip')
        && getComputedStyle(document.querySelector('#tooltip')).display !== 'none';
      return result;
    })()`);
    check(wholeCardFill?.delegated
      && wholeCardFill.faceProgress > 0 && wholeCardFill.revealProgress > 0
      && /linear-gradient/i.test(wholeCardFill.faceFill)
      && /linear-gradient/i.test(wholeCardFill.revealFill),
    `an expanded hold fills its title and reveal as one card (${JSON.stringify(wholeCardFill)})`);
    check(wholeCardFill?.actionTag === 'SPAN' && wholeCardFill.actionButtons === 0,
      `the expanded whole-card hold has one action surface, not a second button (${JSON.stringify(wholeCardFill)})`);
    check(wholeCardFill?.comparisonPreview === 'open' && wholeCardFill.comparisonVisible
      && !wholeCardFill.comparisonAfterRelease,
    `a sustained hold previews comparison and early release closes it (${JSON.stringify(wholeCardFill)})`);
    await evaluate(`document.querySelector('.armoury-inventory .inventory-detail')
      ?.dispatchEvent(new PointerEvent('pointerenter'))`);
    await wait(650);
    const comparisonTip = await evaluate(`(() => {
      const tip = document.querySelector('#tooltip[data-tooltip-variant="equipment-comparison"]');
      const comparison = tip?.querySelector('[data-ui-component="equipment-comparison"]');
      const rect = tip?.getBoundingClientRect();
      return { visible: !!tip && getComputedStyle(tip).display !== 'none', comparison: !!comparison, width: rect?.width || 0 };
    })()`);
    check(!comparisonTip.visible,
      'hover does not reveal the equipment comparison tooltip');
    const actionReach = await evaluate(`(() => {
      const action = document.querySelector('.armoury-inventory .ep-list [data-act]');
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
      const face = document.querySelector('.armoury-inventory .ep-list .disc-face');
      if (face) {
        const rect = face.getBoundingClientRect();
        const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
          bubbles: true, cancelable: true, pointerId: 318, pointerType: 'mouse', button: 0, detail: 1,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }));
        event('pointerdown'); event('pointerup'); event('click', MouseEvent);
      }
      return [...document.querySelectorAll('.armoury-inventory .ep-list [data-act]')].filter((element) => element.offsetParent !== null).length;
    })()`);
    check(afterRefold === 0, 'refolding the item hides its action again');

    // Separate Equipment and Inventory pages have no cross-page drop target.
    // The Change -> Inventory -> item action path is exercised below, including
    // the engine cost and atomic refusal receipts.

    if (TAKE_SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
      }, sessionId);
      await cdp.send('Page.navigate', { url: appUrl }, sessionId);
      await until("!!document.querySelector('#open-armoury')", 'phone map Armoury button');
      await evaluate("document.querySelector('#open-armoury').click()");
      await evaluate(`document.querySelector('[data-surface="armouryView"] [data-member="hybrid"]').click()`);
      await until("!!document.querySelector('.armoury-inventory')", 'phone Inventory');
      await evaluate(`(() => {
        const face = document.querySelector('.armoury-inventory .disc-face');
        if (face) {
          const rect = face.getBoundingClientRect();
          const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
            bubbles: true, cancelable: true, pointerId: 319, pointerType: 'touch', button: 0, detail: 1,
            clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          }));
          event('pointerdown'); event('pointerup'); event('click', MouseEvent);
        }
      })()`);
      const phone = await evaluate(`(() => {
        const panel = document.querySelector('.armoury');
        const inventory = document.querySelector('.armoury-inventory');
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
      // Keep the shared tooltip singletons mounted. Replacing body.innerHTML
      // disconnects the service's cached panel references and turns a real
      // open into an invisible detached node.
      for (const child of [...document.body.children]) {
        if (!child.matches('#tooltip, #tooltip-2')) child.remove();
      }
      const fixtureHost = document.createElement('main');
      fixtureHost.id = 'pr315-fixture';
      document.body.appendChild(fixtureHost);
      const fixture = { run, commits: 0 };
      window.__pr315Fixture = fixture;
      fixture.panel = mountEquipment(document.querySelector('#pr315-fixture'), {
        registries,
        run,
        meta: { settings: { holdConfirm: 'off' } },
        inCombat: false,
        onChange: () => { fixture.commits += 1; },
        onClose: () => {},
      });
    })()`);
    if (!SHIPPED) await until("!!document.querySelector('.armoury')", 'full-Inventory Armoury fixture');
    if (!SHIPPED) await evaluate(`(() => {
      document.querySelector('[data-slot-position="rightHand:0"] .armoury-position-action')?.click();
      const face = [...document.querySelectorAll('.ep-list .disc-face')]
        .find((element) => element.querySelector('.ec-name')?.textContent === 'Straight Sword');
      if (face) {
        const rect = face.getBoundingClientRect();
        const event = (type, EventType = PointerEvent) => face.dispatchEvent(new EventType(type, {
          bubbles: true, cancelable: true, pointerId: 321, pointerType: 'mouse', button: 0, detail: 1,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }));
        event('pointerdown'); event('pointerup'); event('click', MouseEvent);
      }
    })()`);
    const holdOffComparison = SHIPPED ? null : await evaluate(`(async () => {
      const source = document.querySelector('.ep-list .inventory-detail');
      const action = source?.querySelector('button[data-act]');
      const rect = source?.getBoundingClientRect();
      if (!source || !rect) return null;
      const pointer = (type) => source.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 322, pointerType: 'touch', button: 0,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      }));
      pointer('pointerdown');
      await new Promise((done) => setTimeout(done, 210));
      const tip = document.querySelector('#tooltip[data-tooltip-variant="equipment-comparison"]');
      const result = {
        actionButton: action?.tagName || '',
        holdMs: source.dataset.holdMs || '',
        preview: source.dataset.comparisonPreview || '',
        visible: !!tip && getComputedStyle(tip).display !== 'none',
      };
      pointer('pointerup');
      return result;
    })()`);
    if (holdOffComparison) {
      check(holdOffComparison.actionButton === 'BUTTON' && holdOffComparison.holdMs === '160'
        && holdOffComparison.preview === 'open' && holdOffComparison.visible,
      `hold-confirm off keeps an explicit action button and a deliberate comparison hold (${JSON.stringify(holdOffComparison)})`);
    }
    const refusal = SHIPPED ? null : await evaluate(`(() => {
      const fixture = window.__pr315Fixture;
      const before = JSON.stringify(fixture.run.loadout);
      const action = document.querySelector('.ep-list [data-act=unequip]');
      const commitsBefore = fixture.commits;
      action?.click();
      return {
        unchanged: JSON.stringify(fixture.run.loadout) === before,
        commits: fixture.commits - commitsBefore,
        refusal: action?.dataset.refusal || '',
      };
    })()`);
    if (refusal) {
      check(refusal.unchanged, 'a full Inventory keeps a refused Unequip atomic');
      check(refusal.commits === 0 && /inventory is full/i.test(refusal.refusal),
        `a refused Unequip skips success commit and explains the full Inventory (${JSON.stringify(refusal.refusal)})`);
    }
    const combatChange = SHIPPED ? null : await evaluate(`(async () => {
      window.__pr315Fixture?.panel?.close?.();
      const [{ contentBundle }, { createRegistries }, { createRunState }, { mountEquipment }, { createCombat, dispatch }, { createRng }] = await Promise.all([
        import('/src/content/index.js'),
        import('/src/model/registries.js'),
        import('/src/model/state.js'),
        import('/src/ui/screens/equipment.js'),
        import('/src/engine/combat.js'),
        import('/src/engine/rng.js'),
      ]);
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 0x316, classId: 'reaver', registries });
      run.loadout.storage = ['dagger'];
      const combat = createCombat({
        registries,
        rng: createRng(0x316),
        enemyIds: ['blightHound'],
        player: {
          classId: run.class, attributes: run.attributes,
          maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana,
          maxStamina: run.maxStamina, stamina: run.stamina,
          energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
          relicIds: run.relics, flasks: run.flasks, loadout: run.loadout,
          itemUpgradeLevels: run.itemUpgradeLevels,
          equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
          equipmentAttackSlotCount: run.equipmentAttackSlotCount,
          itemMounts: run.itemMounts,
        },
      });
      combat.player.energy = combat.player.energyMax;
      const before = JSON.stringify(combat.loadout);
      const energyBefore = combat.player.energy;
      const events = [];
      let error = '';
      const host = document.querySelector('#pr315-fixture');
      host.replaceChildren();
      mountEquipment(host, {
        registries, run,
        destination: 'equipment',
        meta: { settings: { holdConfirm: 'off', armouryArmamentView: 'list' } },
        inCombat: true,
        onClose: () => {},
        onSwap: () => {},
        onEquip: (slotId, setIndex, pieceId) => {
          try {
            const result = dispatch(combat, { type: 'changeEquipment', slotId, setIndex, pieceId });
            events.push(...result.events.map((event) => event.type));
            return '';
          } catch (caught) {
            error = caught.message;
            return error;
          }
        },
      });
      await new Promise((done) => setTimeout(done, 0));
      const positionAction = document.querySelector('[data-slot-position="rightHand:0"] .armoury-position-action');
      positionAction?.click();
      const daggerItem = document.querySelector('.ep-list [data-item-id="dagger"]');
      const daggerFace = daggerItem?.closest('.disc-face') || daggerItem?.querySelector('.disc-face') || daggerItem;
      daggerFace?.click();
      await new Promise((done) => setTimeout(done, 0));
      const action = document.querySelector('.ep-list .disc-reveal:not([hidden]) button[data-act]');
      const actionLabel = action?.textContent?.trim() || '';
      action?.click();
      return {
        foundFace: !!daggerFace,
        foundAction: !!action,
        foundPositionAction: !!positionAction,
        itemIds: [...document.querySelectorAll('.ep-list [data-item-id]')].map((face) => face.dataset.itemId),
        actionLabel,
        changed: JSON.stringify(combat.loadout) !== before,
        equipped: combat.loadout.sets.rightHand[0],
        storedOld: combat.loadout.storage.includes('straightSword'),
        energySpent: energyBefore - combat.player.energy,
        configuredCost: registries.balance.equipment.swapCost,
        events,
        error,
      };
    })()`);
    if (combatChange) {
      check(combatChange.foundFace && (combatChange.foundAction || combatChange.changed),
        `combat Armoury exposes a real Dagger action (${combatChange.foundAction ? JSON.stringify(combatChange.actionLabel) : 'selected-position card action'})`);
      check(combatChange.changed && combatChange.equipped === 'dagger' && combatChange.storedOld,
        `combat Armoury moves Dagger into RH1 and returns Straight Sword to storage (${JSON.stringify(combatChange)})`);
      check(combatChange.energySpent === combatChange.configuredCost && combatChange.events.includes('equipmentRearmed') && !combatChange.error,
        `combat Armoury pays the authored cost and emits the engine receipt (${JSON.stringify(combatChange)})`);
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
