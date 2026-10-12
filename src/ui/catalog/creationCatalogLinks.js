// The live catalog uses the production specimens; these links only name them.
export function creationCatalogHref(componentId) {
  return `index.html?shot=components#folio-${encodeURIComponent(componentId)}`;
}

export function linkCreationCatalogFolios(host, fragment = globalThis.location?.hash || '') {
  const folios = [...host.querySelectorAll('[data-catalog-component]')];
  for (const folio of folios) {
    const componentId = folio.dataset.catalogComponent;
    folio.id = `folio-${componentId}`;
    folio.setAttribute('tabindex', '-1');
    const heading = folio.querySelector('h3');
    if (heading && !heading.querySelector('[data-catalog-link]')) {
      const link = document.createElement('a');
      link.href = `#${folio.id}`;
      link.dataset.catalogLink = componentId;
      link.textContent = heading.textContent;
      heading.replaceChildren(link);
    }
  }
  let id;
  try { id = decodeURIComponent(fragment.replace(/^#/, '')); } catch { return null; }
  const selected = folios.find(folio => folio.id === id);
  if (!selected) return null;
  selected.scrollIntoView?.({ block: 'start' });
  selected.focus({ preventScroll: true });
  return selected;
}
