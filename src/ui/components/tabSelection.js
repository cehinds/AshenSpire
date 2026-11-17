// A modal head's tab strip marks the pressed tab before its screen decides. When the screen
// refuses the change, ReselectTab puts the mark back on the open tab, as the strip draws it:
// aria-selected on that tab only, and it alone in the Tab order.
import { MarkSelected } from '../selection.js';

export function ReselectTab(scope, openTabId) {
  const tabs = [...scope.querySelectorAll('[data-modal-tab]')];
  const isOpen = (tab) => tab.dataset.modalTab === openTabId;
  MarkSelected(tabs, isOpen, { className: [], ariaAttribute: 'aria-selected' });
  for (const tab of tabs) {
    tab.tabIndex = isOpen(tab) ? 0 : -1;
  }
}
