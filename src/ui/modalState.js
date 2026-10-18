// src/ui/modalState.js — WHICH MODALS ARE OPEN, AS JS STATE.
//
// The stack now lives in modalManager.js, which also owns inert, the scroll
// lock, Escape and the back button for entries that opt in. This module keeps
// the original import path and names (same signatures, same semantics) so no
// importer had to change.

export {
  registerModal,
  modalOpen,
  topModal,
  openModals,
  onModalsClosed,
  resetModalState,
} from './modalManager.js';
