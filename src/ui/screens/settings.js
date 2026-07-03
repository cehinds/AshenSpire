// src/ui/screens/settings.js — settings modal (SPEC §7)
//
// A lightweight modal of toggles persisted in meta.settings. onChange lets the
// orchestrator persist (saveMeta) and apply the preference immediately.

export function openSettings({ meta, onChange }) {
  const settings = meta.settings || (meta.settings = {});
  const spritesOn = settings.useSprites !== false; // default on

  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal settings-modal">
      <h2>Settings</h2>
      <div class="set-row">
        <div>
          <b>Character sprites</b>
          <p class="set-note">Show a drawn class figure in combat instead of your chosen sigil.</p>
        </div>
        <button class="toggle ${spritesOn ? 'on' : ''}" id="set-sprites" role="switch" aria-checked="${spritesOn}">
          <span class="knob"></span>
        </button>
      </div>
      <div class="set-actions"><button id="set-close">Done</button></div>
    </div>`;
  document.body.appendChild(veil);

  const close = () => veil.remove();
  veil.addEventListener('click', (e) => {
    if (e.target === veil) close();
  });
  veil.querySelector('#set-close').addEventListener('click', close);

  const spritesBtn = veil.querySelector('#set-sprites');
  spritesBtn.addEventListener('click', () => {
    const now = !spritesBtn.classList.contains('on');
    spritesBtn.classList.toggle('on', now);
    spritesBtn.setAttribute('aria-checked', String(now));
    settings.useSprites = now;
    onChange({ useSprites: now });
  });
}
