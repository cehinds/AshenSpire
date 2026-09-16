import { statusTooltipText } from '../uiContent.js';
import { registerTooltipDecorator } from './tooltip.js';
import { terms as frameworkTerms } from '../../framework/data/terms.js';

const dictionaries = new WeakMap();
let decorate = () => {};

/** Active bundle vocabulary, including resolved status numbers; no copied mechanics. */
export function configureTooltipGlossary(registries) {
  if (!registries) return;
  if (!dictionaries.has(registries)) {
    const terms = new Map();
    const add = (name, explanation) => {
      if (name && explanation && !terms.has(name.toLowerCase())) terms.set(name.toLowerCase(), explanation);
    };
    const vocabulary = new Map(frameworkTerms.terms.map(row => [row.id, row]));
    for (const row of frameworkTerms.terms) {
      if (!row.id.startsWith('term.tooltip.')) continue;
      const name = vocabulary.get(row.id.replace('term.tooltip.', 'term.'));
      if (name) { add(name.canonicalText, row.canonicalText); add(name.pluralText, row.canonicalText); }
    }
    for (const kind of ['statuses', 'stances']) for (const row of registries[kind]?.all?.() || []) {
      const words = kind === 'statuses' ? registries.frameworkTerms?.withStatusWords?.(row) : registries.frameworkTerms?.withStanceWords?.(row);
      const def = words || row;
      // Bundle-specific status mechanics take precedence over generic terms.
      if (def.name && def.tooltip) terms.set(def.name.toLowerCase(), statusTooltipText(def));
    }
    for (const row of registries.keywords?.all?.() || []) {
      const def = registries.framework?.keywordDisplay?.(row.id) || row;
      add(def.name, def.tooltip);
    }
    // Classification tags explain themselves where rendered. Matching their
    // ordinary words in prose ("decay", "heavy") would invent unrelated links.
    add('Block', 'Absorbs attack damage. Expires at the start of its owner’s turn unless an effect preserves it.');
    add('Poise', 'Poise damage builds toward an enemy’s Stagger threshold.');
    const names = [...terms.keys()].sort((a, b) => b.length - a.length);
    const pattern = names.length ? new RegExp(`\\b(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi') : null;
    dictionaries.set(registries, root => {
      if (!pattern) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.parentElement.closest('[data-tip], [data-tip-attached], button, summary, a, input, textarea, script, style, .tt-title, .epc-name, .cname, h1, h2, h3')) continue;
        const text = node.textContent;
        pattern.lastIndex = 0;
        const matches = [...text.matchAll(pattern)];
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let at = 0;
        for (const match of matches) {
          fragment.append(text.slice(at, match.index));
          const term = document.createElement('span');
          term.className = 'tooltip-keyword'; term.tabIndex = 0;
          term.setAttribute('role', 'button');
          term.setAttribute('aria-label', `Explain ${match[0]}`);
          term.dataset.tip = terms.get(match[0].toLowerCase());
          term.textContent = match[0];
          fragment.append(term); at = match.index + match[0].length;
        }
        fragment.append(text.slice(at)); node.replaceWith(fragment);
      }
    });
  }
  decorate = dictionaries.get(registries);
  registerTooltipDecorator(decorate);
}

export function decorateKeywords(root) { decorate(root); return root; }

export function inspectionTag(label, explanation) {
  const tag = document.createElement('span');
  tag.className = 'inspection-tag'; tag.tabIndex = 0;
  tag.setAttribute('role', 'button'); tag.setAttribute('aria-label', `Explain ${label}`);
  tag.textContent = label; tag.dataset.tip = explanation || label;
  return tag;
}
