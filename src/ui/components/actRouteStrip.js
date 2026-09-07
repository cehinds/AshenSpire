// Map-only orientation component. It sits between the shared run HUD and the
// map board; Combat never mounts it and the shared HUD does not know it exists.
//
// IT IS A QUIET BAND (styles/kit.css `.as-band.quiet`): the act's name as a
// Title·S, and under it the route as a StatStrip of two ends with a rail
// between them — ENTRANCE on the left, BOSS on the right, the way the act runs.
// It is a receipt and not a control: `role="note"`, no pointer, nothing to tap.
// The hook names (`.act-route-strip`, `.map-entrance-orientation`, the two
// `data-role` ends and `.map-orientation-rail`) stay for the instruments that
// read the receipt off the page; kit.css draws nothing for them.
import { UI_COMPONENTS as UI } from './uiComponents.js';
import { html, band, titleS, eyebrow, el } from '../kit/index.js';

export function actRouteStripHtml({ title } = {}) {
  if (!title) return '';
  const strip = band({
    quiet: true,
    attrs: {
      class: 'act-route-strip map-entrance-orientation', 'data-composition': 'orientation-strip',
      role: 'note', 'aria-label': `${title} orientation: entrance to boss`,
    },
    children: [
      titleS(title, { tag: 'strong' }),
      el('span', { class: 'as-statstrip map-orientation-progress', 'aria-hidden': 'true' }, [
        eyebrow('Entrance', { tag: 'small', dataset: { role: 'start' } }),
        el('span', { class: 'map-orientation-rail' }),
        eyebrow('Boss', { tag: 'small', dataset: { role: 'boss' } }),
      ]),
    ],
  });
  strip.setAttribute('data-ui-component', UI.actRouteStrip);
  return html(strip);
}
