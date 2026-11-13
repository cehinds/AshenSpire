# JavaScript code quality

Install the pinned tool dependencies once and run the checks from the repo root.

```sh
npm ci --prefix tools/code-quality --ignore-scripts
npm run code:check
npm --prefix tools/code-quality run selftest
```

The check reads files and emits diagnostics. It scans authored `src` exports using TypeScript's
module symbols. Exported functions and classes use PascalCase. Within the owners listed in
`policy.json`, named private functions and methods use camelCase, and public class and factory
methods use PascalCase. The method check follows statically named class members and callable
properties inferred on returned objects. Dynamic property names and assignment flows that
cannot be inferred stay outside this check. Data constants and serialized keys keep their names. Generated source and declaration files are outside the naming scan.

`legacy-public.json` records existing callable exports by source path and name. A new lowercase
callable export fails even outside the enrolled owners. Remove the exact entry when migrating
an export. `npm --prefix tools/code-quality run inventory` prints the current inventory for review.
The checker never regenerates the baseline.

Enrolled files list their compatibility aliases explicitly in `policy.json`. Use a declared binding,
such as `export const oldName = NewName;`, or a deprecated adapter that binds the new
public function's result to a local constant and returns a map of its legacy members. This keeps the aliases compatible with the shipped module loader. Alias entries
expire when the corresponding binding or adapter is removed.

Only enrolled files are checked for formatting. Run `npm run code:format` to write the enrolled
files explicitly. The pinned dprint TypeScript formatter reads the checked `formatting.json` options
for LF, four spaces, Allman braces,
semicolons, and single quotes. It preserves import and export order. Keep compatibility exports
as short individual bindings because the production bundler has a line-oriented export parser.
Hash-sensitive runtime inputs and generated files stay outside formatter enrollment.

The TypeScript project checks the enrolled save boundaries and their deliberate negative type
fixtures without emitting output. The separate tool self-tests require the isolated package;
the game and its regular test lane do not depend on this package.

The isolated package declares the exports it uses from each development dependency in its
package manifest. The repository link check verifies that interface without loading vendor code.
