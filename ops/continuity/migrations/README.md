# Continuity migrations

Migration records are append-only, hash-locked manifests selected through the
current pointer history evidence. Compatibility projections contain no copied
authority or state; they name the existing authoritative source path. Rollback
removes only an unselected projection in a later correction and never rewrites
the prior history chain.
