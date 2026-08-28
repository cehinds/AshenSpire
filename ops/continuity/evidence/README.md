# Evidence convention

Evidence files are immutable after a history event or pointer records their
SHA-256. A correction is a versioned sibling plus a new history event; it does
not edit the old file. Receipts name ticket, owner task, exact repository tuple,
scope, verification, unresolved gates, rollback, next checkpoint, and authority
boundary. The receipt hash/byte/line identity is recorded by the selecting
pointer or by a later seal; a receipt never claims its own hash inside itself.
