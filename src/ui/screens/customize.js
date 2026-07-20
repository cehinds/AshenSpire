// src/ui/screens/customize.js — character creation: class selection, name,
// sigil + tint (cosmetic), keepsake (starting boon), seed.
//
// Everything chosen here lands on run.customization (cosmetics), the class id,
// and one keepsake whose run-level effects apply at run start (content/keepsakes.js).

import { LOCKED_CLASSES } from '../../content/index.js';
import { KEEPSAKES } from '../../content/keepsakes.js';
import { PORTRAIT_GLYPHS, PORTRAIT_TINTS, SPRITE_STYLES, tintCss, classGlyph, classSprite, spritesAreEnabled } from '../assets.js';
import { esc } from '../components/tooltip.js';

export function mountCustomize(app, { registries, defaultSeedString, onBack, onStart }) {
  const state = {
    classId: 'reaver',
    name: 'Forsaken',
    glyph: PORTRAIT_GLYPHS[0],
    tint: PORTRAIT_TINTS[0].id,
    spriteStyle: 'rendered',
    keepsakeId: 'none',
  };

  app.innerHTML = `
    <div class="screen customize" style="justify-content:flex-start;overflow-y:auto;gap:16px;padding-top:26px">
      <h2 style="color:var(--gold);font-size:24px;letter-spacing:.2em">PREPARE YOUR FORSAKEN</h2>

      <div style="display:flex;gap:34px;align-items:flex-start">
        <div class="preview-pane" style="display:flex;flex-direction:column;align-items:center;gap:10px">
          <div id="cz-portrait" class="cz-portrait"></div>
          <input id="cz-name" maxlength="16" spellcheck="false" value="Forsaken"
            style="background:var(--panel);border:1px solid var(--line);color:var(--parchment);border-radius:8px;padding:6px 10px;width:150px;text-align:center;font-family:var(--font-display);letter-spacing:.08em">
          <div class="seed-line">Seed <input id="seed-input" maxlength="10" spellcheck="false" value="${esc(defaultSeedString)}"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;max-width:560px">
          <div><p class="cz-label">CLASS</p><div id="cz-classes" class="class-row"></div></div>
          <div><p class="cz-label">SIGIL</p><div id="cz-glyphs" class="cz-opts"></div></div>
          <div><p class="cz-label">TINT</p><div id="cz-tints" class="cz-opts"></div></div>
          <div><p class="cz-label">SPRITE</p><div id="cz-styles" class="cz-opts"></div></div>
          <div><p class="cz-label">KEEPSAKE</p><div id="cz-keepsakes" class="cz-keepsakes"></div></div>
        </div>
      </div>

      <div style="display:flex;gap:14px">
        <button class="subtle" id="cz-back">Back</button>
        <button id="cz-start">BEGIN THE CLIMB</button>
      </div>
    </div>`;

  const $ = (s) => app.querySelector(s);

  function renderPortrait() {
    const p = $('#cz-portrait');
    p.style.borderColor = tintCss(state.tint);
    p.style.boxShadow = `0 0 34px color-mix(in srgb, ${tintCss(state.tint)} 35%, transparent)`;
    p.innerHTML = '';
    // With sprites on, preview the class figure you'll actually play; otherwise
    // the chosen sigil (which is what combat shows when sprites are off).
    const sprite = spritesAreEnabled() && state.spriteStyle !== 'glyph'
      ? classSprite(state.classId, tintCss(state.tint), state.glyph, state.tint, state.spriteStyle)
      : null;
    if (sprite) p.appendChild(sprite);
    else p.textContent = state.glyph;
  }

  // ---- class row (real classes + locked M3 silhouettes) ----
  const classes = $('#cz-classes');
  for (const cls of registries.classes.all()) {
    const el = document.createElement('div');
    el.className = 'class-pick cz-class';
    el.dataset.classId = cls.id;
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><h3>${esc(cls.name)}</h3><p>${esc(cls.description || '')}</p><span class="chip">HP ${cls.maxHp} · ${cls.startingDeck.length} cards</span>`;
    el.addEventListener('click', () => {
      state.classId = cls.id;
      classes.querySelectorAll('.cz-class').forEach((x) => x.classList.toggle('chosen', x === el));
      renderPortrait();
    });
    classes.appendChild(el);
  }
  for (const cls of LOCKED_CLASSES) {
    const el = document.createElement('div');
    el.className = 'class-pick locked';
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><h3>${esc(cls.name)}</h3><p>${esc(cls.description)}</p><span class="chip">ARRIVES IN ${esc(cls.milestone)}</span>`;
    classes.appendChild(el);
  }
  classes.querySelector('.cz-class').classList.add('chosen');

  // ---- sigil + tint pickers ----
  const glyphBox = $('#cz-glyphs');
  PORTRAIT_GLYPHS.forEach((g, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt${i === 0 ? ' chosen' : ''}`;
    b.textContent = g;
    b.addEventListener('click', () => {
      state.glyph = g;
      glyphBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    glyphBox.appendChild(b);
  });
  const tintBox = $('#cz-tints');
  PORTRAIT_TINTS.forEach((t, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt tint${i === 0 ? ' chosen' : ''}`;
    b.style.background = t.css;
    b.title = t.name;
    b.addEventListener('click', () => {
      state.tint = t.id;
      tintBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    tintBox.appendChild(b);
  });

  // ---- sprite style (rendered art / classic silhouette / sigil glyph) ----
  const styleBox = $('#cz-styles');
  SPRITE_STYLES.forEach((st, i) => {
    const b = document.createElement('div');
    b.className = `cz-opt style${i === 0 ? ' chosen' : ''}`;
    b.textContent = st.name;
    b.style.cssText = 'width:auto;padding:0 12px;font-size:12px;letter-spacing:.08em;';
    b.addEventListener('click', () => {
      state.spriteStyle = st.id;
      styleBox.querySelectorAll('.cz-opt').forEach((x) => x.classList.toggle('chosen', x === b));
      renderPortrait();
    });
    styleBox.appendChild(b);
  });

  // ---- keepsakes ----
  const ksBox = $('#cz-keepsakes');
  KEEPSAKES.forEach((ks, i) => {
    const el = document.createElement('div');
    el.className = `cz-keepsake${i === 0 ? ' chosen' : ''}`;
    el.innerHTML = `<span class="ks-icon">${esc(ks.icon)}</span><div><b>${esc(ks.name)}</b><p>${esc(ks.desc)}</p></div>`;
    el.addEventListener('click', () => {
      state.keepsakeId = ks.id;
      ksBox.querySelectorAll('.cz-keepsake').forEach((x) => x.classList.toggle('chosen', x === el));
    });
    ksBox.appendChild(el);
  });

  $('#cz-name').addEventListener('input', (ev) => {
    state.name = ev.target.value.trim() || 'Forsaken';
  });
  $('#cz-back').addEventListener('click', onBack);
  $('#cz-start').addEventListener('click', () => {
    onStart({
      classId: state.classId,
      seedString: $('#seed-input').value.trim(),
      customization: { name: state.name, glyph: state.glyph, tint: state.tint, spriteStyle: state.spriteStyle },
      keepsakeId: state.keepsakeId,
    });
  });

  renderPortrait();
}
