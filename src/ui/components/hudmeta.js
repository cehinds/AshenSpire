// Shared map/combat HUD shell. Screens supply state and wire the controls; this
// component owns the row order and every placement hook so the two surfaces
// cannot drift into different HUDs again.
import { esc } from './tooltip.js';
import { buildStampHtml } from './buildstamp.js';

function progressText(value, total, label) {
  return total == null ? `${label} ${value}` : `${label} ${value} / ${total}`;
}

export function hudShellHtml({
  place,
  headerClass = '',
  cinders,
  act,
  actTotal = null,
  floor,
  floorTotal = null,
  seed,
  identity,
  controls,
  overlayHtml = '',
} = {}) {
  const actText = progressText(act, actTotal, 'ACT');
  const floorText = progressText(floor, floorTotal, 'FLOOR');
  const context = identity.context
    ? `<span class="hud-context">${esc(identity.context)}</span>`
    : '';
  return `<header class="topbar combat-hud shared-hud${headerClass ? ` ${esc(headerClass)}` : ''}">
    <div class="hud-top">
      <div class="hud-info-row">
        <div class="hud-identity">
          <div class="portrait" style="border-color:${esc(identity.tint)}">${esc(identity.glyph)}</div>
          <div class="hud-identity-copy">
            <span class="nm">${esc(identity.name)} · ${esc(identity.classLabel)}</span>
            ${context}
          </div>
        </div>
        <div class="hud-center" role="status" aria-label="${esc(`${cinders} cinders`)}">
          <span class="hud-cinders">⛁ ${esc(cinders)}</span>
        </div>
        <div class="hud-run-meta">
          <span class="hud-act">${esc(actText)}</span>
          <span class="hud-floor">${esc(floorText)}</span>
          <span class="hud-seed mh-seed" title="Run seed">SEED ${esc(seed)}</span>
          ${buildStampHtml(place)}
        </div>
      </div>
      <div class="hud-resource-row">
        <div class="hud-left-stack">
          <div class="resbars-host"></div>
          <div class="relics hud-relics" aria-label="Relics"></div>
        </div>
        <div class="hud-control-grid">
          <div class="hud-actions">
            <button class="topbar-btn" id="${esc(controls.armouryId)}" title="Armoury">⚒</button>
            <button class="topbar-btn" id="${esc(controls.menuId)}" data-action-hint="menu"
              title="${esc(controls.menuHint)}" aria-label="${esc(controls.menuHint)}">☰</button>
          </div>
          <div class="flasks hud-charge-flasks" aria-label="Healing and mana flasks"></div>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="hud-potions${place === 'map' ? ' mh-flasks' : ''}" aria-label="Potions"></div>
      </div>
    </div>
    ${overlayHtml}
  </header>`;
}
