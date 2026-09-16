// src/framework/presentation/components.js — the shared presentation system
// (framework contract: Shared presentation system).
//
// Screens supply models, permitted slots, and policies; they do not invent new
// modal, tooltip, typography, or confirmation behavior. Each factory returns a
// plain component description {tag, role, accessibleName, className, children,
// slots} that the DOM adapter renders — pure data, so node tests can assert
// accessibility and structure without a browser.
//
// Every interactive component requires an accessible name at construction;
// omitting one throws here, which is what makes the validation assertion
// (assertEveryInteractiveComponentHasAccessibleName) enforceable at build time.

export class ComponentError extends Error {
  constructor(component, message) {
    super(`${component}: ${message}`);
    this.name = 'ComponentError';
  }
}

function requireAccessibleName(component, name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ComponentError(component, 'interactive component requires an accessible name');
  }
  return name;
}

function node(tag, props, children = []) {
  return Object.freeze({ tag, ...props, children: Object.freeze(children) });
}

export function SharedShell({ header, navigation, content, accessibleName }) {
  return node('div', { role: 'application', className: 'fw-shell', accessibleName: requireAccessibleName('SharedShell', accessibleName) },
    [header, navigation, node('main', { className: 'fw-shell-content' }, content)].filter(Boolean));
}

export function SharedHeader({ titleText, actions = [] }) {
  if (!titleText) throw new ComponentError('SharedHeader', 'titleText is required');
  return node('header', { className: 'fw-header', typographyRole: 'type.heading' },
    [node('h1', { className: 'fw-header-title', text: titleText }), ...actions]);
}

export function SharedNavigation({ items, accessibleName }) {
  requireAccessibleName('SharedNavigation', accessibleName);
  return node('nav', { className: 'fw-nav', accessibleName },
    items.map((item) => SharedMenuItem(item)));
}

export function SharedMenu({ items, accessibleName }) {
  requireAccessibleName('SharedMenu', accessibleName);
  return node('ul', { role: 'menu', className: 'fw-menu', accessibleName },
    items.map((item) => node('li', { role: 'none' }, [SharedMenuItem(item)])));
}

function SharedMenuItem({ text, onSelect, disabled = false }) {
  requireAccessibleName('SharedMenuItem', text);
  return node('button', {
    role: 'menuitem', className: 'fw-menu-item', text, accessibleName: text,
    disabled, interactive: true, onSelect,
  });
}

/** The one card face — combat hand, rewards, armoury and smith all use it. */
export function SharedCard({ model, chips = [], slots = {} }) {
  if (!model || !model.title) throw new ComponentError('SharedCard', 'model.title is required');
  return node('article', {
    className: 'fw-card', accessibleName: model.accessibleName || model.title,
    interactive: Boolean(model.onActivate), typographyRole: 'type.cardText',
  }, [
    node('h2', { className: 'fw-card-title', text: model.title, typographyRole: 'type.heading' }),
    node('div', { className: 'fw-card-chips' }, chips),
    node('div', { className: 'fw-card-body', text: model.bodyText || '' }),
    slots.footer || null,
  ].filter(Boolean));
}

export function SharedPropertyChip({ text, tooltipModel = null }) {
  requireAccessibleName('SharedPropertyChip', text);
  return node('span', {
    className: 'fw-chip', text, accessibleName: text,
    typographyRole: 'type.chip', tooltipModel,
  });
}

export function SharedTooltip({ model }) {
  if (!model || !model.accessibleFallback) {
    throw new ComponentError('SharedTooltip', 'tooltip model requires an accessible fallback');
  }
  return node('div', {
    role: 'tooltip', className: 'fw-tooltip',
    accessibleName: model.accessibleFallback, typographyRole: 'type.body',
  }, (model.lines || []).map((line) => node('p', { text: `${line.name}. ${line.body}` })));
}

/** The modal grammar: icon+title+close / summary / body / details / footer. */
export function SharedModal({ titleText, closeLabel, summary, body, details = null, footer = null, icon = null }) {
  requireAccessibleName('SharedModal', titleText);
  requireAccessibleName('SharedModal close', closeLabel);
  return node('dialog', { className: 'fw-modal', accessibleName: titleText, modal: true }, [
    node('header', { className: 'fw-modal-header' }, [
      icon, node('h2', { text: titleText, typographyRole: 'type.heading' }),
      node('button', { className: 'fw-modal-close', text: '✕', accessibleName: closeLabel, interactive: true }),
    ].filter(Boolean)),
    node('section', { className: 'fw-modal-summary', text: summary || '' }),
    node('section', { className: 'fw-modal-body' }, body || []),
    details ? SharedScrollableRegion({ children: details, accessibleName: `${titleText} details` }) : null,
    footer,
  ].filter(Boolean));
}

export function SharedConfirmation({ policy, titleText, bodyText, confirmLabel, cancelLabel }) {
  requireAccessibleName('SharedConfirmation confirm', confirmLabel);
  requireAccessibleName('SharedConfirmation cancel', cancelLabel);
  return SharedModal({
    titleText,
    closeLabel: cancelLabel,
    summary: bodyText,
    body: [],
    footer: node('footer', { className: 'fw-modal-footer' }, [
      node('button', { className: 'fw-btn-cancel', text: cancelLabel, accessibleName: cancelLabel, interactive: true, result: 'CANCEL' }),
      node('button', {
        className: policy.level === 'DESTRUCTIVE' ? 'fw-btn-destructive' : 'fw-btn-primary',
        text: confirmLabel, accessibleName: confirmLabel, interactive: true, result: 'CONFIRM',
      }),
    ]),
  });
}

export function SharedCollectionReceipt({ titleText, items, accessibleName }) {
  requireAccessibleName('SharedCollectionReceipt', accessibleName || titleText);
  return node('section', { className: 'fw-receipt', accessibleName: accessibleName || titleText }, [
    node('h2', { text: titleText, typographyRole: 'type.heading' }),
    node('ul', {}, items.map((item) => node('li', { text: item.text, className: 'fw-receipt-item' }))),
  ]);
}

export function SharedEmptyState({ text }) {
  if (!text) throw new ComponentError('SharedEmptyState', 'text is required');
  return node('p', { className: 'fw-empty', text, typographyRole: 'type.body' });
}

export function SharedScrollableRegion({ children, accessibleName }) {
  requireAccessibleName('SharedScrollableRegion', accessibleName);
  // Wide content scrolls INSIDE this region; the page never scrolls sideways.
  return node('div', {
    className: 'fw-scroll', accessibleName, scrollable: true,
    tabIndex: 0, interactive: true,
  }, children);
}

/** Walk a component tree, visiting every node — validation and adapters share it. */
export function walkComponents(root, visit) {
  visit(root);
  for (const child of root.children || []) if (child) walkComponents(child, visit);
}
