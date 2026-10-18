// src/ui/modalState.js — WHICH MODALS ARE OPEN, AS JS STATE.
//
// The stack now lives in modalManager.js, which also owns inert, the scroll
// lock, Escape and the back button for entries that opt in. This module keeps
// the original import path and names (same signatures, same semantics) so no
// importer had to change.

// tools/bundle.mjs has no `export ... from`: import, then re-export the local
// bindings on one line.
import { registerModal, modalOpen, topModal, openModals, onModalsClosed, resetModalState } from './modalManager.js';
export { registerModal, modalOpen, topModal, openModals, onModalsClosed, resetModalState };
