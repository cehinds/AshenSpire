# actionCosts rules

Attach `combat:actionCosts` to a live owner/source and provide `moduleParameters["combat.actionCosts"]` from `content/source/fixCoreMechanics.json` action-cost fields. This schema intentionally duplicates no numeric defaults. Source `mechanicBindings.parameters` and upgradeParameters override validated module values.

`queryBinding(binding, "parameters")` returns immutable effective configuration. Existing shared live combat primitives consume this query; no event dispatcher or second combat loop is installed. Gear/status/card attachments use their existing mount lifetimes. Empty/inventory sources never activate.

Run `node tools/mechanics-browser.mjs` after authoring. `node --test tests/mechanics-runtime.test.mjs` runs the module, disabled-source and invalid-parameter JSON cases through the same query compiler.
