export function retryArtStateExpression(selector) {
  const sel = JSON.stringify(selector);
  return `(() => { const sprites = [...document.querySelectorAll(${sel})];
    const visible = (node) => { const style = getComputedStyle(node); const box = node.getBoundingClientRect();
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && box.width > 0 && box.height > 0; };
    const visibleImage = (e) => [...e.querySelectorAll('img')].some((i) => i.complete && i.naturalWidth > 0 && visible(i));
    const visibleFallback = (e) => [...e.querySelectorAll('[role="img"]')].some(visible);
    return { n: sprites.length, placeholders: sprites.filter((e) => e.hasAttribute('data-art-placeholder') && visibleFallback(e) && !visibleImage(e)).length,
      drawn: sprites.filter((e) => [...e.querySelectorAll('img')].some((i) => i.complete && i.naturalWidth > 0 && (i.getAttribute('src') || '').includes('objects/') && visible(i))).length,
      hand: document.querySelectorAll('.combat .hand .card').length }; })()`;
}
