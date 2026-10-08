// Co-op reuses the selected-card control surface from solo. A selecting click
// must be observed before shared inspection lights the card in its bubble phase.
export function wireCoopUpcastControl(card, { label = 'Upcast', disabled = false, selectBeforePlay = false, onOpen, onPlay }) {
  const controls = document.createElement('div');
  controls.className = 'card-upcast-controls';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card-upcast';
  button.textContent = label;
  button.disabled = disabled;
  controls.appendChild(button);
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
    controls.addEventListener(type, event => event.stopPropagation());
  }
  button.addEventListener('click', () => onOpen(button));
  card.appendChild(controls);
  let selectingClick = false;
  card.addEventListener('click', event => {
    if (controls.contains(event.target)) return;
    selectingClick = selectBeforePlay && !card.classList.contains('selected') && !card.classList.contains('inspection-selected');
  }, true);
  card.addEventListener('click', () => { if (!selectingClick) onPlay(); });
  return controls;
}
