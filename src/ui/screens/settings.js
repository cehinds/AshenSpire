// src/ui/screens/settings.js — settings controls (SPEC §7)
//
// Rows are declarative and grouped into categories. `renderSettings` builds the
// controls into any container and wires change events, so the same controls
// back both the standalone modal (openSettings) and the in-run overlay's
// Settings tab. Each row declares its default so stored settings stay sparse.
// `onChange({key:value})` lets the orchestrator persist + apply immediately.

const ROWS = [
  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Display', key: 'animSpeed', type: 'choice', def: 'normal',
    choices: ['slow', 'normal', 'fast', 'instant'], label: 'Combat pacing',
    note: 'How deliberately actions play out — one actor at a time, or instant.' },
  { cat: 'Display', key: 'mapZoom', type: 'choice', def: '115',
    choices: ['100', '115', '130', '150'], label: 'Map zoom %',
    note: 'Default zoom when the act map opens. In-map + / − buttons override per view.' },
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },

  { cat: 'Audio', key: 'muteAudio', def: false, label: 'Mute all audio',
    note: 'Silence music and sound effects.' },
  { cat: 'Audio', key: 'musicVolume', type: 'range', def: 55, label: 'Music volume',
    note: 'Ambient score for the title, map, and battles.' },
  { cat: 'Audio', key: 'sfxVolume', type: 'range', def: 75, label: 'Sound effects',
    note: 'Hits, blocks, bleed bursts, UI.' },
  { cat: 'Audio', key: 'musicFolder', type: 'text', def: '', label: 'Music folder',
    placeholder: 'e.g. music/ or https://…',
    note: 'Folder/URL with a manifest.json mapping combat/boss/shop/rest/… to track files. Empty = built-in generated score.' },

  { cat: 'Accessibility', key: 'reducedMotion', def: false, label: 'Reduced motion',
    note: 'Calm ambient effects, drop the map pulse, and shorten animations.' },
];

const CATEGORIES = ['Display', 'Audio', 'Accessibility'];

// Resolve a stored value against its default (defaults keep settings sparse).
function valueOf(settings, row) {
  return row.def ? settings[row.key] !== false : settings[row.key] === true;
}

function rowHtml(settings, r) {
  if (r.type === 'text') {
    const val = typeof settings[r.key] === 'string' ? settings[r.key] : r.def;
    return `<div class="set-row set-row-wide">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <input type="text" class="set-text" spellcheck="false" data-key="${r.key}" value="${(val || '').replace(/"/g, '&quot;')}" placeholder="${r.placeholder || ''}">
      </div>`;
  }
  if (r.type === 'range') {
    const val = typeof settings[r.key] === 'number' ? settings[r.key] : r.def;
    return `<div class="set-row">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <div class="range-wrap">
          <input type="range" class="set-range" min="0" max="100" step="5" value="${val}" data-key="${r.key}">
          <span class="range-val" data-for="${r.key}">${val}</span>
        </div>
      </div>`;
  }
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
  // 'action' rows (e.g. fullscreen) render as a live toggle reflecting state.
  const on = r.type === 'action' ? isFullscreen() : valueOf(settings, r);
  return `<div class="set-row">
      <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
      <button class="toggle ${on ? 'on' : ''}" data-key="${r.key}"${r.type === 'action' ? ' data-action="1"' : ''} role="switch" aria-checked="${on}">
        <span class="knob"></span>
      </button>
    </div>`;
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (isFullscreen()) {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  }
}

/**
 * renderSettings(container, { settings, onChange, grouped })
 * Fills `container` with the settings controls and wires change events.
 * grouped=true adds category headers.
 */
export function renderSettings(container, { settings, onChange, grouped = true }) {
  let html = '';
  if (grouped) {
    for (const cat of CATEGORIES) {
      const rows = ROWS.filter((r) => r.cat === cat);
      html += `<h3 class="set-cat">${cat}</h3>` + rows.map((r) => rowHtml(settings, r)).join('');
    }
  } else {
    html = ROWS.map((r) => rowHtml(settings, r)).join('');
  }
  container.innerHTML = html;

  container.querySelectorAll('.set-text').forEach((input) => {
    // Commit on change/blur (not each keystroke) so we don't re-fetch a manifest
    // mid-type.
    const commit = () => {
      settings[input.dataset.key] = input.value.trim();
      onChange({ [input.dataset.key]: input.value.trim() });
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
  });

  container.querySelectorAll('.set-range').forEach((slider) => {
    slider.addEventListener('input', () => {
      const val = Number(slider.value);
      const out = container.querySelector(`.range-val[data-for="${slider.dataset.key}"]`);
      if (out) out.textContent = val;
      settings[slider.dataset.key] = val;
      onChange({ [slider.dataset.key]: val });
    });
  });

  container.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.choice').forEach((b) => b.classList.toggle('on', b === btn));
      settings[btn.dataset.key] = btn.dataset.val;
      onChange({ [btn.dataset.key]: btn.dataset.val });
    });
  });

  container.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action) {
        toggleFullscreen();
        // Reflect the new state shortly after the API resolves.
        setTimeout(() => {
          const on = isFullscreen();
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-checked', String(on));
        }, 60);
        return;
      }
      const now = !btn.classList.contains('on');
      btn.classList.toggle('on', now);
      btn.setAttribute('aria-checked', String(now));
      settings[btn.dataset.key] = now;
      onChange({ [btn.dataset.key]: now });
    });
  });
}

export function openSettings({ meta, onChange }) {
  const settings = meta.settings || (meta.settings = {});
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal settings-modal">
      <h2>Settings</h2>
      <div class="set-body"></div>
      <div class="set-actions"><button id="set-close">Done</button></div>
    </div>`;
  document.body.appendChild(veil);
  renderSettings(veil.querySelector('.set-body'), { settings, onChange });

  const close = () => veil.remove();
  veil.addEventListener('click', (e) => {
    if (e.target === veil) close();
  });
  veil.querySelector('#set-close').addEventListener('click', close);
}
