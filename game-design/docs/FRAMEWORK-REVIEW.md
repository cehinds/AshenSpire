# Repo-native multi-agent framework — approved Game Design review

Status: approved input for Help Desk synthesis; documentation-only.

This folder keeps a compact, clone-local index. Canonical source documents remain in their existing locations; these Markdown files are pointers, not duplicate authorities.

## Operating contract

- Use a bounded bootstrap and load one task plus directly referenced evidence.
- Validate identity, currentness, writer/path ownership, authority, and hashes before writing.
- Keep `DEFAULT PROCEED` for reversible work; apply `UNKNOWN/WITHHOLD` only to the affected unsafe transition.
- Protect irreversible/security, integration ownership, and independent QA/release gates.
- Game Design may define mechanics intent, UX rules, data contracts, tuning ranges, and acceptance criteria; it may not grant QA, merge, release, or canon authority.
- Git history is the durable audit trail; routine dispatch/acknowledgement does not require a new continuity artifact.

## Cold-start tuple

`/ops/BOOT.md` → `/ops/teams/<team>/HEAD.json` → `/ops/tasks/<task-id>/WORKPACK.json`.

Target budget: 7 KiB / approximately 1,450 tokens before task evidence.

## Source pointers

- [Recovery guide](SESSION-RECOVERY-GUIDE.md)
- [Continuity schema](SESSION-CONTINUITY-SCHEMA.md)
- [Team pointer](TEAM-POINTER.md)
- [Team backlog](TEAM-BACKLOG.md)

No repository, board, branch, merge, release, or publication authority is implied by this review.
