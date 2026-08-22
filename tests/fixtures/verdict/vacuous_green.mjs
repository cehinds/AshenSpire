// tests/fixtures/verdict/vacuous_green.mjs — REQUIRED KNOWN-BAD (#12).
//
// Prints a WELL-FORMED terminal verdict line whose count is zero, and exits 0.
// This is instance 2 of the card — `verify-shipped.mjs` with its recorder
// stopped, printing `OK — 0 checks passed` — and the first fixture passes it
// clean, which is why the card requires both.
//
// The assertion (tools/verdict.mjs) MUST FAIL on this file, with exit 1
// (a verdict counting zero), or it proves nothing.
console.log('vacuous-green: OK — 0 checks passed.');
process.exit(0);
