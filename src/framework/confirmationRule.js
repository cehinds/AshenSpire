// src/framework/confirmationRule.js — the framework's ADOPTED confirmation
// LEVEL rule for effect-carrying choices (owner ruling, 2026-09-01, recorded
// in docs/framework-cutover-report.md).
//
// The ruling: src/model/consequence.js's fail-closed derivation — bindingness
// derived from a choice's own effect ops against a positively-known-safe set,
// where every unruled op is binding — is the framework's confirmation-level
// rule for dynamic, effect-carrying choices. The ConfirmationRegistry keeps
// owning STATIC surfaces (load/quit and the authored policy rows); this rule
// owns everything whose danger must be derived, because a hand-kept list
// cannot know what it was not told.
//
// Re-exported, not copied: one derivation, one home, with the authority
// boundary moved to the framework. The tap-to-review / hold-to-commit
// INTERACTION router is presentation behavior and ports separately.

export {
  SAFE_OPS,
  BINDING_CARD_TYPES,
  failClosedOps,
  bindingReasons,
  isBindingChoice,
} from '../model/consequence.js';
