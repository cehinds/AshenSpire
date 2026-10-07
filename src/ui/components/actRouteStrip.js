// Map-only orientation component. It sits between the shared run HUD and the
// map board; Combat never mounts it and the shared HUD does not know it exists.
//
// A quiet, single-row band: act title, Entrance, evenly spaced route receipts,
// then Boss. Unvisited positions remain empty; visited ones reuse map glyphs.
// It is a receipt and not a control: `role="note"`, no pointer, nothing to tap.
// The hook names (`.act-route-strip`, `.map-entrance-orientation`, the two
// `data-role` ends and `.map-orientation-rail`) stay for the instruments that
// read the receipt off the page; kit.css draws nothing for them.
import { UI_COMPONENTS as UI } from './uiComponents.js';
import { html, band, titleS, eyebrow, el } from '../kit/index.js';
import { nodeIcon, nodeName } from '../uiContent.js';
import { actRouteModel } from '../models/ActRouteModel.js';

export function actRouteStripHtml({ title, graph, path, current } = {}) {
  if (!title) return '';
  const route = actRouteModel({ graph, path, current });
  const history = route.steps.map((step) => `${step.floor}: ${step.type ? nodeName(step.type) : '—'}${step.current ? ' (current)' : ''}`).join(', ');
  const strip = band({
    quiet: true,
    attrs: {
      class: 'act-route-strip map-entrance-orientation', 'data-composition': 'orientation-strip',
      role: 'note', 'aria-label': `${title} orientation: entrance to boss. ${history}${route.bossVisited ? '. Boss reached' : ''}`,
    },
    children: [
      titleS(title, { tag: 'strong' }),
      el('span', { class: 'as-statstrip map-orientation-progress', 'aria-hidden': 'true' }, [
        eyebrow('Entrance', { tag: 'small', dataset: { role: 'start' } }),
        el('span', { class: 'map-orientation-rail' }, route.steps.map((step) =>
          el('span', { class: 'map-route-slot' }, [el('span', {
            class: `map-route-node${step.type ? ' is-visited' : ''}${step.current ? ' is-current' : ''}`,
            dataset: { floor: step.floor, nodeId: step.id || '', type: step.type || '' },
            text: step.type ? nodeIcon(step.type) : '',
          })]))),
        eyebrow('Boss', { tag: 'small', dataset: { role: 'boss', visited: String(route.bossVisited) } }),
      ]),
    ],
  });
  strip.setAttribute('data-ui-component', UI.actRouteStrip);
  return html(strip);
}
