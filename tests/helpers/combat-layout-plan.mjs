// Runs the real combat caller, wireCombatLayout, against a fake root element and
// returns the bands it writes. Tests use this to exercise the path a browser
// takes (data-form-factor on <html> -> wireCombatLayout -> allocateCombatBands)
// instead of calling allocateCombatBands with a hand-built argument list.
import { wireCombatLayout } from '../../src/ui/components/combatLayout.js';

const GLOBALS = ['document', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver'];

class InertObserver {
  constructor() { this.connected = false; }
  observe() { this.connected = true; }
  unobserve() {}
  disconnect() { this.connected = false; }
}

function withFakes(documentElement, fn) {
  const original = {};
  for (const key of GLOBALS) original[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  const define = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, value });
  define('document', { documentElement });
  define('getComputedStyle', () => ({ fontSize: '16px', paddingLeft: '0px', paddingRight: '0px' }));
  define('requestAnimationFrame', () => 0);
  define('cancelAnimationFrame', () => {});
  define('ResizeObserver', InertObserver);
  define('MutationObserver', InertObserver);
  try { return fn(); } finally {
    for (const key of GLOBALS) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
}

// `width` and `height` are local (pre-zoom) CSS px; the root's rendered width is
// width * zoom, so the caller measures the zoom the way a browser reports it.
export function planCombatLayout({ formFactor, width, height, zoom = 1 }) {
  const documentElement = { dataset: { formFactor } };
  return withFakes(documentElement, () => {
    const props = {};
    const combatEl = {
      isConnected: true,
      dataset: {},
      clientWidth: width,
      clientHeight: height,
      style: { setProperty(key, value) { props[key] = value; } },
      getBoundingClientRect: () => ({ width: width * zoom, height: height * zoom }),
      querySelector: () => null,
    };
    const layout = wireCombatLayout(combatEl);
    layout.release();
    const px = (key) => parseFloat(props[key]);
    const hud = px('--w4-band-hud');
    const hand = px('--w4-band-context');
    const footer = px('--w4-band-footer');
    return {
      hud, hand, footer,
      battlefield: height - hud - hand - footer,
      arrangement: combatEl.dataset.combatArrangement,
      supported: combatEl.dataset.combatGeometry === 'supported',
      formFactor: combatEl.dataset.formFactor,
    };
  });
}
