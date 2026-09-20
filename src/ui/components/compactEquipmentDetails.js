import { equipmentDetails } from './equipmentCard.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';

// A connected element owns the observers and popover, including across stage changes.
class CreationTagRow extends HTMLElement {
  connectedCallback() {
    if (!this.more) {
      this.tags = [...this.children];
      this.more = document.createElement('button');
      this.more.className = 'inspection-tag cc-tags-more';
      this.more.type = 'button';
      this.more.setAttribute('aria-expanded', 'false');
      this.popup = document.createElement('div');
      this.popup.className = 'cc-tags-popup';
      this.popup.setAttribute('popover', 'auto');
      this.popup.setAttribute('aria-label', 'Additional equipment tags');
      this.append(this.more, this.popup);
      const open = () => {
        if (this.popup.matches(':popover-open')) return;
        this.popup.replaceChildren();
        const explanation = document.createElement('p');
        explanation.className = 'cc-tag-explanation';
        explanation.textContent = 'Select a tag for details.';
        for (const tag of this.tags.filter(tag => tag.hidden)) {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'inspection-tag';
          button.textContent = tag.textContent;
          button.addEventListener('click', () => { explanation.textContent = tag.dataset.tip || tag.textContent; });
          this.popup.append(button);
        }
        this.popup.append(explanation);
        this.popup.showPopover();
        const anchor = this.more.getBoundingClientRect();
        const box = this.popup.getBoundingClientRect();
        const position = anchorLocalBox(VIEWPORT_ORIGIN, {
          left: Math.max(8, Math.min(innerWidth - box.width - 8, anchor.right - box.width)),
          top: Math.max(8, anchor.top - box.height - 8), width: box.width, height: box.height,
        });
        this.popup.style.left = `${position.left}px`;
        this.popup.style.top = `${position.top}px`;
      };
      this.more.addEventListener('click', open);
      this.more.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open(); });
      this.popup.addEventListener('toggle', () => this.more.setAttribute('aria-expanded', String(this.popup.matches(':popover-open'))));
    }
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this);
    this.fit();
  }
  fit() {
    if (!this.clientWidth) return;
    if (this.popup.matches(':popover-open')) this.popup.hidePopover();
    this.tags.forEach(tag => { tag.hidden = false; });
    this.more.hidden = true;
    if (this.scrollWidth <= this.clientWidth + 1) return;
    this.more.hidden = false;
    let count = 0;
    for (let i = this.tags.length - 1; i >= 0; i--) {
      this.tags[i].hidden = true;
      this.more.textContent = `+${++count}`;
      this.more.setAttribute('aria-label', `Show ${count} additional tags`);
      if (this.scrollWidth <= this.clientWidth + 1) break;
    }
  }
  disconnectedCallback() {
    this.observer?.disconnect();
    if (this.popup?.matches(':popover-open')) this.popup.hidePopover();
  }
}

export function compactEquipmentDetails(name, explanations) {
  if (!customElements.get('creation-tag-row')) customElements.define('creation-tag-row', CreationTagRow);
  const details = equipmentDetails(explanations);
  details.classList.add('cc-compact-details');
  const heading = document.createElement('div'); heading.className = 'cc-item-heading';
  const title = document.createElement('h3'); title.textContent = name; heading.append(title);
  const facts = details.querySelector('.inspection-facts');
  if (facts) heading.append(facts);
  details.prepend(heading);
  const tags = details.querySelector('.inspection-tags');
  if (tags) {
    const row = document.createElement('creation-tag-row');
    row.className = 'inspection-tags cc-single-tags';
    row.setAttribute('aria-label', 'Equipment tags');
    row.append(...tags.childNodes); tags.replaceWith(row);
  }
  return details;
}
