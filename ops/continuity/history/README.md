# History convention

History files are append-only JSON events named `<sequence>-<event>.json`.
Sequence numbers increase monotonically per ticket. Active tickets hash-lock
their complete ordered history frontier. Corrections create a new event and set
`supersedesHistoryId`; referenced files are never rewritten, renamed, or
deleted. Each event binds one immutable evidence file by SHA-256.
