// A deliberately isolated playtest using the shipped combat screen and engine.
// main.js enters through ?shot=combat-test, whose storage is memory-only.
import { prototypeBuilds, prototypeScenarios, prototypeInput } from '../../content/prototypes/combatBuilds.js';
import { prototypeEquipment, prototypeEquipmentRules } from '../../content/prototypes/combatEquipment.js';
import { prototypeRegistries } from '../../content/prototypes/combatBuilds.js';
import { combatRules } from '../../content/combatRules.js';
import { createCombat } from '../../engine/combat.js';
import { createRunState } from '../../model/state.js';
import { createLoadout } from '../../model/loadout.js';
import { weaponImpact } from '../../model/combatRules.js';
import { mountCombat } from './combat.js';
import { openModal } from '../kit/index.js';
import { esc, configureTooltipSettings } from '../components/tooltip.js';
import { openSettings } from './settings.js';
import { BUILD_VERSION } from '../../buildversion.js';

export function mountCombatTest(app, { params, meta }) {
  document.body.classList.add('combat-test');
  document.title = `AshenSpire ${BUILD_VERSION} — Combat test build`;
  const choice = { build: Object.hasOwn(prototypeBuilds, params.get('build')) ? params.get('build') : 'heavy',
    encounter: Object.hasOwn(prototypeScenarios, params.get('encounter')) ? params.get('encounter') : 'gauntlet', seed: 1, pressure: 1,
    equipment: { armor: '', grip: '', rune: '' } };
  let route = [], stage = 0, pools = {}, results = [];
  // This mode has no durable profile or save actions. Settings stay in memory.
  const testMeta = { ...meta, settings: { ...meta.settings, seenTutorial: true, holdConfirm: 'normal' } };
  const changeSettings = patch => { Object.assign(testMeta.settings, patch); configureTooltipSettings(testMeta.settings); };
  function setup() {
    app.innerHTML = `<section class="combat-test-setup"><p class="test-eyebrow">ASHENSPIRE ${esc(BUILD_VERSION)} · TEST BUILD</p>
      <h1>Choose your way through.</h1><p class="test-lead">Play the new combat rules on the game's battlefield. Break Poise with a heavy weapon, build Bleed with quick hits, or save rare mana for a decisive spell.</p>
      <form id="combat-test-form"><fieldset><legend>Your build</legend><div class="test-build-grid">${Object.entries(prototypeBuilds).map(([id, b]) => `<label class="test-build-choice"><input type="radio" name="build" value="${id}" ${choice.build === id ? 'checked' : ''}><strong>${esc(b.name)}</strong><span>${id === 'heavy' ? 'Greatsword · strong impact · blue guard' : id === 'bleed' ? 'Dagger · Bleed on contact · light Dodge' : 'Staff · low impact · powerful mana spells'}</span><span>${b.maxStamina} stamina · ${b.maxMana} mana</span></label>`).join('')}</div></fieldset>
      <div class="test-options"><label>Challenge<select name="encounter"><option value="gauntlet">Three-fight route</option>${Object.entries(prototypeScenarios).map(([id, s]) => `<option value="${id}" ${choice.encounter === id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label>Enemy strength<select name="pressure"><option value="1">Standard</option><option value="0.5">Practice — half damage</option><option value="2">Hard — double damage</option></select></label>
      <label>Seed<input name="seed" type="number" min="1" max="2147483647" step="1" value="${choice.seed}" required></label></div>
      <fieldset><legend>Try different equipment</legend><div class="test-options">
      <label>Armor<select name="armor"><option value="">Build default</option>${Object.entries(prototypeEquipmentRules.armor).map(([id, item]) => `<option value="${id}">${esc(item.name)} · ${item.armor} defense · ${item.weight} weight</option>`).join('')}</select></label>
      <label>Grip<select name="grip"><option value="">Build default</option><option value="oneHand">One handed</option><option value="twoHand">Two handed</option></select></label>
      <label>Blood Rune<select name="rune"><option value="">Build default</option><option value="on">Install · +${prototypeEquipmentRules.bloodRune.buildup[0].amount} Bleed per contact</option><option value="off">Remove</option></select></label></div>
      <p id="equipment-preview" aria-live="polite"></p></fieldset>
      <button class="test-start" type="submit">Begin test run</button><p id="test-error" role="alert"></p></form>
      <details class="test-help"><summary>What to try</summary><ul><li>Enter a stance, then end your turn. The stance and its glow stay active.</li><li>Keep Dodge Roll in hand or spend stamina to Evade the next hit this turn. It costs no actions.</li><li>Use heavy attacks to stagger; land quick hits to build Bleed.</li><li>Stamina recovers each turn. Mana does not. The route carries all three pools between fights.</li></ul><p>Select a card, then its target. Select a self-targeted card and confirm it on your character. Press E to end your turn.</p></details>
      <p class="test-note">Equipment experiment. Armor ratings and load bands are prototype tuning; resource caps are fixed for comparison. Gear changes apply when a fight starts. This uses existing class artwork. Full rune inventory, loot, affinities, and expanded reward decks are still in development. This test does not change your saved runs.</p></section>`;
    app.querySelector('[name=pressure]').value = String(choice.pressure);
    for (const key of ['armor', 'grip', 'rune']) app.querySelector(`[name=${key}]`).value = choice.equipment[key];
    const readEquipment = (form) => ({ armor: form.get('armor') || undefined, grip: form.get('grip') || undefined,
      ...(form.get('rune') ? { bloodRune: form.get('rune') === 'on' } : {}) });
    const updateEquipment = () => {
      const form = new FormData(app.querySelector('form'));
      try {
        const { profile } = prototypeEquipment(prototypeRegistries(), prototypeBuilds[form.get('build')], readEquipment(form));
        const source = profile.sources.mainHand;
        const receipt = profile.equipmentReceipt;
        const impact = weaponImpact(combatRules, source, { magical: source.sourceType === 'spell' });
        const requirement = receipt.items[0].requirements;
        app.querySelector('#equipment-preview').textContent = `${source.name}: ${receipt.items[0].nativeHands}H native, ${source.grip === 'twoHand' ? 'two-handed' : 'one-handed'} grip. ${impact} base impact. ${Object.entries(requirement).map(([key, value]) => `${value} ${key}`).join(', ') || 'No attribute minimum'}. Total weight ${receipt.weight} (${profile.weightClass}); armor ${profile.armor}; Dodge ${combatRules.dodge.stamina[profile.weightClass]} stamina. ${source.buildup.length ? `+${source.buildup.reduce((sum, effect) => sum + effect.amount, 0)} Bleed on each landed weapon hit.` : 'No rune Bleed.'} Weapon value ${receipt.items[0].value} cinders.`;
        app.querySelector('#test-error').textContent = ''; app.querySelector('.test-start').disabled = false;
      } catch (error) {
        app.querySelector('#equipment-preview').textContent = '';
        app.querySelector('#test-error').textContent = error.message; app.querySelector('.test-start').disabled = true;
      }
    };
    app.querySelector('form').addEventListener('change', updateEquipment);
    updateEquipment();
    app.querySelector('form').onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      choice.build = form.get('build'); choice.encounter = form.get('encounter'); choice.seed = Number(form.get('seed')); choice.pressure = Number(form.get('pressure'));
      for (const key of ['armor', 'grip', 'rune']) choice.equipment[key] = form.get(key);
      route = choice.encounter === 'gauntlet' ? ['basic', 'armored', 'boss'] : [choice.encounter]; stage = 0; pools = {}; results = [];
      try { fight(); } catch (error) { setup(); app.querySelector('#test-error').textContent = error.message; }
    };
  }
  function fight() {
    const input = prototypeInput(choice.build, route[stage], choice.seed, { ...pools, pressure: choice.pressure,
      equipmentOptions: { armor: choice.equipment.armor || undefined, grip: choice.equipment.grip || undefined,
        ...(choice.equipment.rune ? { bloodRune: choice.equipment.rune === 'on' } : {}) } });
    const build = prototypeBuilds[choice.build], registries = input.registries;
    const combat = createCombat(input);
    const run = createRunState({ seed: choice.seed, classId: build.classId, registries });
    // Display the same source weapon as the resolver; swapping would invalidate
    // the controlled profile, so the Armoury door presents the loadout receipt.
    run.loadout = createLoadout(registries, build.classId, { rightHand: build.itemId, leftHand: null });
    Object.assign(run, input.player, { class: build.classId, seedString: `TEST ${choice.seed} · ${stage + 1}/${route.length}`, floor: stage + 1,
      actNumber: 1, mapGraph: { floors: route.length }, relics: [], deck: input.player.deck, stats: { fightsWon: stage, damageDealt: 0, damageTaken: 0 } });
    const info = () => openModal({ title: 'Combat test build', size: 'sm', bodyClassName: 'as-pane', body: (host) => {
      const source = input.combatProfiles.player.sources.mainHand;
      const item = registries.equipment.armaments.find((row) => row.id === build.itemId);
      const profile = input.combatProfiles.player;
      host.innerHTML = `<p><strong>${esc(build.name)}</strong> · Fight ${stage + 1} of ${route.length}</p><p>${esc(item.name)} · ${esc(source.grip === 'twoHand' ? 'Two handed' : 'One handed')} · ${source.weight} weight · ${weaponImpact(input.ruleset, source, { magical: source.sourceType === 'spell' })} base impact</p>
        <p>Armor: ${profile.armor}. Total weight: ${profile.equipmentReceipt.weight} (${profile.weightClass}). Dodge: ${input.ruleset.dodge.stamina[profile.weightClass]} stamina, no actions. Stamina recovery: ${input.ruleset.recovery.staminaPerTurn}/turn. Mana recovery: ${input.ruleset.recovery.manaPerTurn}/turn.</p>
        <ul>${profile.equipmentReceipt.items.map(row => `<li>${esc(row.name)} · ${esc(row.quality)} · ${row.weight} weight · ${row.value} cinders${row.runes.length ? ` · ${row.runes.map(rune => esc(rune.name)).join(', ')}` : ''}</li>`).join('')}</ul>
        <p>Current health ${combat.player.hp}/${combat.player.maxHp}, stamina ${combat.player.stamina}/${combat.player.maxStamina}, mana ${combat.player.mana}/${combat.player.maxMana}.</p>
        <p>Equipment is locked for this route. Change armor, grip, or the rune in build selection to compare. Select a card, then confirm its target. Hold a card to inspect it. E ends your turn.</p><button class="test-exit" type="button">Return to build selection</button>`;
      host.querySelector('button').onclick = () => { const url = new URL(location.href); url.search = '?shot=combat-test'; location.href = url.href; };
      const settings = document.createElement('button'); settings.className = 'test-settings'; settings.textContent = 'Settings';
      settings.onclick = () => openSettings({ meta: testMeta, onChange: changeSettings });
      host.appendChild(settings);
    } });
    const appearance = { basic: 'wanderingSoldier', armored: 'livingArmor', group: 'chainScavenger', resistant: 'huskBrute', boss: 'fellWarden' };
    mountCombat(app, { registries, run, combat, meta: testMeta, showTutorial: false, onMenu: info, onSettings: info, onArmoury: info,
      enemyAppearance: { [`prototype_${route[stage]}`]: appearance[route[stage]] },
      onSettingsChange: changeSettings, onEnd: (result, ended) => {
        pools = Object.fromEntries(['hp', 'stamina', 'mana'].map((key) => [key, ended.player[key]]));
        results.push({ result, name: prototypeScenarios[route[stage]].name, turn: ended.turn, ...pools });
        finish(result);
      } });
  }
  function finish(result) {
    const more = result === 'victory' && stage + 1 < route.length;
    app.innerHTML = `<section class="combat-test-setup"><p class="test-eyebrow">ASHENSPIRE · TEST RUN</p><h1>${result !== 'victory' ? 'Your climb ends here.' : more ? 'One fight closer.' : 'Challenge complete.'}</h1>
      <p class="test-lead">${more ? 'Your remaining health, stamina, and mana carry into the next fight. No automatic refill.' : 'Try a different build or repeat the same seed to compare your choices.'}</p>
      <ul class="test-results">${results.map((r) => `<li><strong>${esc(r.name)}</strong> · ${r.result === 'victory' ? 'Victory' : 'Defeat'} in ${r.turn} turns<br>${Math.max(0, r.hp)} health · ${r.stamina} stamina · ${r.mana} mana remaining</li>`).join('')}</ul>
      ${more ? '<button class="test-start" id="test-next">Continue to next fight</button>' : ''}<button id="test-again">Choose a build</button></section>`;
    app.querySelector('#test-next')?.addEventListener('click', () => { stage++; fight(); });
    app.querySelector('#test-again').onclick = setup;
    app.querySelector('h1').tabIndex = -1; app.querySelector('h1').focus();
  }
  setup();
}
