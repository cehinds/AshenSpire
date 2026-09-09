import { prototypeBuilds, prototypeScenarios, prototypeInput } from '../src/content/prototypes/combatBuilds.js';
import { combatRules } from '../src/content/combatRules.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { prototypeOptions } from '../src/engine/combatPrototype.js';
import { foundationCosts } from '../src/engine/combatRules.js';
const $ = (id) => document.getElementById(id);
for (const [id, b] of Object.entries(prototypeBuilds)) $('build').add(new Option(b.name, id));
for (const [id, s] of Object.entries(prototypeScenarios)) $('scenario').add(new Option(s.name, id));
$('rules').value = JSON.stringify(combatRules, null, 2);
let combat, activeBuild = 'heavy', targetId = 'e1';
const element = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
function start() {
  try {
    const input = prototypeInput($('build').value, $('scenario').value, Number($('seed').value));
    input.ruleset = JSON.parse($('rules').value);
    combat = createCombat(input); activeBuild = $('build').value; targetId = 'e1'; $('error').textContent = ''; $('receipt').textContent = 'Choose an enemy, then play a card.'; render();
  } catch (e) { $('error').textContent = e.message; }
}
function act(intent) {
  try {
    const { events } = dispatch(combat, intent);
    const lines = events.flatMap((e) => {
      if (e.type === 'damageDealt') return [`${e.targetId === 'player' ? 'You' : e.targetId}: ${e.amount} damage (${e.blocked} blocked).`];
      if (e.type === 'impactDealt') return [`${e.amount} impact.`];
      if (e.type === 'attackEvaded') return ['One hit evaded.'];
      if (e.type === 'evadeGained') return ['Evade ready until your next turn.'];
      if (e.type === 'procBurst') return [`${e.status} burst: ${e.amount}.`];
      return [];
    });
    $('receipt').textContent = lines.join(' ') || 'Action resolved.'; $('error').textContent = ''; render();
  } catch (e) { $('error').textContent = e.message; }
}
function render() {
  const b = prototypeBuilds[activeBuild], p = combat.player;
  $('arena').replaceChildren();
  const actor = element('div', '', `actor${p.stanceId ? ' active' : ''}`);
  actor.style.setProperty('--glow', activeBuild === 'bleed' ? '#d94848' : activeBuild === 'caster' ? '#b4a1ff' : '#5abaff');
  const img = document.createElement('img'); img.src = `../art/poses/${b.classId}_${p.stanceId ? 'guard' : 'idle'}_gold.webp`; img.alt = b.name; actor.append(img);
  const info = element('div', ''); info.append(element('h2', b.name));
  const stats = element('div', '', 'stats');
  for (const text of [`HP ${p.hp}/${p.maxHp}`, `Actions ${p.energy}`, `Stamina ${p.stamina}/${p.maxStamina}`, `Mana ${p.mana}/${p.maxMana}`, `Block ${p.block}`, `Evade ${p.evade || 0}`]) stats.append(element('span', text, 'stat'));
  info.append(stats, element('p', p.stanceId ? combat.registries.stances.get(p.stanceId).name : 'No active stance')); actor.append(info); $('arena').append(actor);
  if (!combat.enemies.some((e) => e.id === targetId && e.alive)) targetId = combat.enemies.find((e) => e.alive)?.id;
  const enemies = element('div', '', 'enemies');
  for (const enemy of combat.enemies) {
    const button = element('button', '', `enemy${enemy.id === targetId ? ' selected' : ''}${enemy.alive ? '' : ' dead'}`);
    button.type = 'button'; button.disabled = !enemy.alive; button.setAttribute('aria-pressed', String(enemy.id === targetId));
    button.append(element('b', `${combat.registries.enemies.get(enemy.enemyId).name} · ${enemy.id}`), element('span', `HP ${Math.max(0, enemy.hp)}/${enemy.maxHp}`), element('span', `Poise ${enemy.poiseMeter.value}/${enemy.poiseMeter.max}`), element('span', enemy.skipNextTurn ? 'Staggered' : `Intent: ${enemy.intent?.damage || 0} damage`));
    button.onclick = () => { targetId = enemy.id; render(); }; enemies.append(button);
  }
  $('arena').append(enemies); $('turn').textContent = combat.result ? `Encounter: ${combat.result}` : `Turn ${combat.turn}`;
  $('hand').replaceChildren();
  for (const card of combat.piles.hand) {
    const def = combat.registries.cards.get(card.cardId), preview = previewCard(combat, card.instanceId, targetId);
    const costs = foundationCosts(combat, def, { id: b.weightClass }, { action: def.cost, stamina: def.staminaCost || 0, mana: def.manaCost || 0 });
    const button = element('button', '', 'card'); button.type = 'button'; button.dataset.cardId = card.cardId;
    button.disabled = !!combat.result || p.energy < costs.action || p.stamina < costs.stamina || p.mana < costs.mana;
    const cost = [`${costs.action} action${costs.action === 1 ? '' : 's'}`, ...(costs.stamina ? [`${costs.stamina} stamina`] : []), ...(costs.mana ? [`${costs.mana} mana`] : [])].join(' · ');
    const text = card.cardId === 'dodgeRoll' ? 'Evade the next hit before your next turn. Once per turn.' : def.textTemplate.replace(/\{([^}]+)\}/g, (match, token) => preview.tokens[token] ?? match);
    button.append(element('span', cost, 'cost'), element('strong', def.name), element('span', text, 'effect'));
    if (card.cardId === 'dodgeRoll') button.append(element('span', 'RETAIN · Evade the next hit', 'retain'));
    button.onclick = () => act({ type: 'playCard', cardInstanceId: card.instanceId, targetId }); $('hand').append(button);
  }
  $('end').disabled = $('suggest').disabled = !!combat.result;
  $('log').replaceChildren(...combat.eventLog.slice(-60).map((e) => element('li', JSON.stringify(e))));
}
$('setup').onsubmit = (event) => { event.preventDefault(); start(); };
$('end').onclick = () => act({ type: 'endTurn' });
$('suggest').onclick = () => { const option = prototypeOptions(combat)[0]; act(option ? option.intent : { type: 'endTurn' }); };
$('defaults').onclick = () => { $('rules').value = JSON.stringify(combatRules, null, 2); };
start();
