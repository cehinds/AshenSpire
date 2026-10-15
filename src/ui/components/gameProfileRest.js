import { t } from '../strings.js';
// Presentation only. The run-owned transaction validates and consumes services.
export function mountGameProfileRest(app, { visit, smithCandidates, attributeIds, onStrategize, onCommit, onLeave }) {
  app.replaceChildren();
  const screen = document.createElement('section'); screen.className = 'screen rest-screen';
  screen.style.cssText = 'padding:2rem;max-width:48rem;margin:auto;display:flex;flex-direction:column;gap:1rem';
  const title = document.createElement('h1'); title.textContent = t('gameProfile.rest.copy1');
  const explanation = document.createElement('p');
  explanation.textContent = visit.service ? `This visit is complete: ${visit.service}.` : 'Choose one service. Every service fully restores HP, MP and SP and refills healing and MP flasks.';
  const status = document.createElement('p'); status.setAttribute('role', 'alert');
  const invoke = action => { try { action(); } catch (error) { status.textContent = error.message; } };
  const strategize = document.createElement('button'); strategize.textContent = t('gameProfile.rest.copy2');
  strategize.disabled = !!visit.service; strategize.onclick = () => invoke(onStrategize);
  const smithSelect = document.createElement('select'); smithSelect.setAttribute('aria-label', t('gameProfile.rest.copy6'));
  for (const row of smithCandidates) smithSelect.append(new Option(row.itemName || row.name || row.itemRef, row.itemRef));
  const smith = document.createElement('button'); smith.textContent = t('gameProfile.rest.copy3');
  smith.disabled = !!visit.service || !smithCandidates.length;
  smith.onclick = () => invoke(() => onCommit('smith', { itemRef: smithSelect.value }));
  const attribute = document.createElement('select'); attribute.setAttribute('aria-label', t('gameProfile.rest.copy7'));
  for (const id of attributeIds) attribute.append(new Option(id, id));
  const level = document.createElement('button'); level.textContent = t('gameProfile.rest.copy4');
  level.disabled = !!visit.service;
  level.onclick = () => invoke(() => onCommit('levelUp', { attributeId: attribute.value }));
  const leave = document.createElement('button'); leave.textContent = t('gameProfile.rest.copy5'); leave.onclick = onLeave;
  screen.append(title, explanation, strategize, smithSelect, smith, attribute, level, status, leave); app.append(screen);
}
