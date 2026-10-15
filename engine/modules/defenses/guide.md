# defenses

Settings are validated by settings.schema.json. The authored defaults are in defaults.json; the selected game bundle overrides them before author settings. Missing bundled entries inherit, false disables, true uses bundle defaults, and objects recursively override settings (arrays replace). mode: legacy delegates to existing behavior; configured is an explicit policy consumed by the game adapter. This first adapter is not a portable rules VM implementation.

Core policy defaults that remain provisional are listed in the core pack guide. Disabling this feature never activates another optional feature; the runtime adapter must provide a legal fallback or report incompatible custom content.
