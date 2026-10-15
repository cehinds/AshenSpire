// Web renderer for the foundation's game-neutral fallback geometry.
// No asset fetch, equipment dependency or gameplay state mutation.
export function foundationStandin({ enemy = false, width = 150, height = 190 } = {}) {
  const figure = document.createElement('div');
  figure.className = 'class-sprite foundation-standin';
  figure.setAttribute('aria-label', enemy ? 'Enemy stand-in' : 'Hero stand-in');
  figure.style.cssText = `width:${width}px;height:${height}px;position:relative;display:flex;align-items:flex-end;justify-content:center;flex:0 0 auto`;
  const color = enemy ? '#977e91' : '#b8a17a';
  figure.innerHTML = `<svg viewBox="0 0 150 190" width="100%" height="100%" role="img" aria-hidden="true"><ellipse cx="75" cy="181" rx="48" ry="7" fill="#161519"/><path d="M53 77 42 131 61 139 67 91M97 77 108 131 90 139 83 91" fill="${color}"/><path d="M57 128 53 177 70 177 76 133 82 177 99 177 94 126" fill="#514c56"/><path d="M47 77 72 62 102 78 93 134 57 134" fill="${color}"/><path d="M72 62 102 78 93 134 74 116" fill="#726572"/><path d="M58 32 77 23 94 35 90 59 75 70 59 57" fill="${color}"/><path d="M77 23 94 35 90 59 75 70 75 42" fill="#6b616e"/><path d="M55 92 74 116 57 134" fill="#d0b991"/></svg>`;
  return figure;
}
