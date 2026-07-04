// src/ui/screens/settings.js — settings modal (SPEC §7)
//
// A lightweight modal of toggles persisted in meta.settings. onChange lets the
// orchestrator persist (saveMeta) and apply each preference immediately. Each
// row declares its default so the stored value can stay sparse.

const ROWS = [
  {
    key: 'useSprites',
    def: true,
    label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.',
  },
  {
    key: 'reducedMotion',
    def: false,
    label: 'Reduced motion',
    note: 'Calm the ambient title effects and shorten animations.',
  },
  {
    key: 'animSpeed',
    type: 'choice',
    def: 'normal',
    choices: ['slow', 'normal', 'fast', 'instant'],
    label: 'Combat pacing',
    note: 'How deliberately actions play out — one actor at a time, or instant.',
  },
];

// Resolve a stored value against its default (defaults keep meta.settings sparse).
function valueOf(settings, row) {
  return row.def ? settings[row.key] !== false : settings[row.key] === true;
}

export function openSettings({ meta, onChange }) {
  const settings = meta.settings || (meta.settings = {});

  const rowsHtml = ROWS.map((r) => {
    if (r.type === 'choice') {
      const cur = r.choices.includes(settings[r.key]) ? settings[r.key] : r.def;
      const opts = r.choices
        .map((c) => `<button class="choice${c === cur ? ' on' : ''}" data-key="${r.key}" data-val="${c}">${c.toUpperCase()}</button>`)
        .join('');
      return `<div class="set-row">
          <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
          <div class="choice-group">${opts}</div>
        </div>`;
    }
    const on = valueOf(settings, r);
    return `<div class="set-row">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <button class="toggle ${on ? 'on' : ''}" data-key="${r.key}" role="switch" aria-checked="${on}">
          <span class="knob"></span>
        </button>
      </div>`;
  }).join('');

  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal settings-modal">
      <h2>Settings</h2>
      ${rowsHtml}
      <div class="set-actions"><button id="set-close">Done</button></div>
    </div>`;
  document.body.appendChild(veil);

  const close = () => veil.remove();
  veil.addEventListener('click', (e) => {
    if (e.target === veil) close();
  });
  veil.querySelector('#set-close').addEventListener('click', close);

  veil.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      group.querySelectorAll('.choice').forEach((b) => b.classList.toggle('on', b === btn));
      settings[btn.dataset.key] = btn.dataset.val;
      onChange({ [btn.dataset.key]: btn.dataset.val });
    });
  });

  veil.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const now = !btn.classList.contains('on');
      btn.classList.toggle('on', now);
      btn.setAttribute('aria-checked', String(now));
      settings[btn.dataset.key] = now;
      onChange({ [btn.dataset.key]: now });
    });
  });
}
