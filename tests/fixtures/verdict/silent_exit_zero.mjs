// tests/fixtures/verdict/silent_exit_zero.mjs — REQUIRED KNOWN-BAD (#12).
//
// Prints nothing and exits 0. This is instance 1 of the card — `zoomunits.mjs`
// whose main-module guard was false on Windows, so `main()` never executed,
// stdout was empty, and CI read green — in its platform-independent form: a
// hand-rolled-guard fixture would be silent only on Windows; this one is silent
// everywhere, which is the honest form of that test.
//
// The assertion (tools/verdict.mjs) MUST FAIL on this file, with exit 3
// (SILENCE), or it proves nothing.
process.exit(0);
