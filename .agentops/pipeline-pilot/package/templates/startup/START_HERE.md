# Clean-session start

1. Read `../stable/PIPELINE_KERNEL.md`.
2. Read exactly one assigned task node under `../state/tasks/`.
3. Read only the authority and risk-route fragments named by that node.
4. Verify the node's moving references before acting.
5. If READY, pin the current base and acquire locks only when entering work.

Do not preload other tasks, event history, generated reports, chats, or provider
memory. Stop only the exact transition whose required fact cannot be verified.
