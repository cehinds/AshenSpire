import { renderCard } from './card.js';

export function mountGameProfileOffers(app, { registries, run, offer, title, onTake, onContinue }) {
  app.replaceChildren();
  const screen = document.createElement('section'); screen.className = 'screen game-profile-offers';
  screen.style.cssText = 'max-width:64rem;padding:2rem;margin:auto;display:flex;flex-direction:column;gap:1rem';
  const heading = document.createElement('h1'); heading.textContent = title;
  const explanation = document.createElement('p'); explanation.textContent = offer.source === 'shop'
    ? `${run.cinders} cinders · ${offer.price} per purchase` : `Choose ${offer.takeCount}. Cards join your collection; edit the active deck at Strategize.`;
  const choices = document.createElement('div'); choices.style.cssText = 'display:flex;flex-wrap:wrap;gap:1.25rem;align-items:flex-start';
  const status = document.createElement('p'); status.setAttribute('role', 'alert');
  for (const [index, option] of offer.options.entries()) {
    const row = document.createElement('article'); row.className = 'as-pane'; row.style.cssText = 'padding:1rem;max-width:18rem;display:flex;flex-direction:column;gap:.75rem';
    const isCard = ['combatCards', 'weaponArts'].includes(option.kind);
    if (isCard) row.append(renderCard(registries, { cardId: option.id, instanceId: `offer:${index}`, upgraded: false }, { level: 'focus' }));
    const definition = isCard ? registries.cards.get(option.id)
      : option.kind === 'relics' ? registries.relics.get(option.id)
      : option.kind === 'potions' ? registries.flasks.get(option.id)
      : option.kind === 'weapons' ? registries.equipment.armaments.find(item => item.id === option.id)
      : registries.equipment.armour.find(item => item.id === option.id && item.classId === run.class);
    const name = document.createElement('h3'); name.textContent = definition?.name || option.id;
    const kind = document.createElement('p'); kind.textContent = option.kind;
    const take = document.createElement('button'); take.className = 'as-btn';
    take.textContent = offer.taken.includes(index) ? 'Taken' : offer.source === 'shop' ? 'Buy' : 'Choose';
    take.disabled = offer.taken.includes(index) || offer.claimed !== null;
    take.onclick = () => { try { onTake(index); } catch (error) { status.textContent = error.message; } };
    row.append(name, kind, take); choices.append(row);
  }
  const next = document.createElement('button'); next.className = 'as-btn primary';
  next.textContent = offer.source === 'shop' ? 'Leave shop' : 'Continue'; next.onclick = onContinue;
  screen.append(heading, explanation, choices, status, next); app.append(screen);
}
