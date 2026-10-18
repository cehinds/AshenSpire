# Poise protection

Attach `defense:poiseProtection` to an entity, character, active status, relic or equipped gear source. A tag and matching `mechanicBindings` row activate once. Override `parameters.multiplier` (0 through 1); 0.75 is the default. Module overrides precede attachment parameters; upgradeParameters override both. Inventory alone does not activate gear.

The owner must be the incoming target and its persistentPoise value positive. Only physical components are selected. The strongest reduction in `poise-protection` applies once; independent groups compose by priority and stable source identity. Fractions round only at final damage quantity.

Example binding: `{"tag":"defense:poiseProtection","parameters":{"multiplier":0.6}}`. Compile via `node tools/mechanics-browser.mjs`; the shared live/reference evaluator makes 20 isolated physical damage become 12. Run cases with `node --test tests/mechanics-bindings.test.mjs`.
