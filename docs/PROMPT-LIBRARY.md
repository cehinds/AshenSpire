# Constantine's prompt library

The repository's two authoritative prompts can be exported to a personal library
that is available independently of the current checkout:

| Library ID | Repository authority | Purpose |
|---|---|---|
| `ashenspire` | [`../PROMPT.md`](../PROMPT.md) | Rebuild Ashen Spire with its game-specific design and backlog contracts. |
| `general-game` | [`GENERAL-GAME-BUILD-PROMPT.md`](GENERAL-GAME-BUILD-PROMPT.md) | Start another game using Constantine's reusable .NET-first defaults. |

## Install or refresh

From this repository:

```bash
node tools/prompt-library.mjs install
```

The default library is:

```text
~/.constantine/prompt-library/
  manifest.json
  README.md
  ashenspire.md
  general-game.md
```

The command creates the directory if needed and atomically refreshes both files.
`manifest.json` records each library ID, source path, installed filename, SHA-256,
title, voice-friendly summary, and installation time. `README.md` is a voice-chat
catalog with each summary, full-prompt link, and a short spoken cue. Repository
files remain the one editable authority; run the
install command after changing either prompt rather than hand-editing installed
copies.

Override the destination when needed:

```bash
node tools/prompt-library.mjs install --library-dir "/path/to/my/prompts"
```

The same override can be persisted in the environment:

```bash
export CONSTANTINE_PROMPT_LIBRARY="/path/to/my/prompts"
node tools/prompt-library.mjs install
```

PowerShell:

```powershell
$env:CONSTANTINE_PROMPT_LIBRARY = "$HOME\Documents\PromptLibrary"
node tools/prompt-library.mjs install
```

## Use from anywhere

Once installed, these commands do not need to run from the repository:

```bash
node /path/to/AshenSpire/tools/prompt-library.mjs path
node /path/to/AshenSpire/tools/prompt-library.mjs list
node /path/to/AshenSpire/tools/prompt-library.mjs summary
node /path/to/AshenSpire/tools/prompt-library.mjs summary ashenspire
node /path/to/AshenSpire/tools/prompt-library.mjs print ashenspire
node /path/to/AshenSpire/tools/prompt-library.mjs print general-game
```

More simply, open or attach either installed Markdown file directly from
`~/.constantine/prompt-library`. To make the command itself global, add a shell
alias that points to the repository tool:

```bash
alias prompt-library='node /absolute/path/to/AshenSpire/tools/prompt-library.mjs'
prompt-library list
prompt-library print general-game
```

PowerShell profile equivalent:

```powershell
function prompt-library {
  node "C:\absolute\path\to\AshenSpire\tools\prompt-library.mjs" @args
}
```

## Commands

| Command | Result |
|---|---|
| `install` | Atomically install or refresh every registered prompt and manifest. |
| `list` | Print installed IDs, filenames, and SHA-256 values. |
| `path` | Print the resolved personal library directory. |
| `summary [id]` | Print voice-friendly summaries for all prompts or one ID. |
| `print <id>` | Write one installed prompt to standard output for piping or copying. |
| `verify` | Confirm installed files exactly match their recorded hashes. |

`list`, `summary`, `print`, and `verify` fail clearly until `install` has created a valid
library. Unknown IDs and malformed manifests are refused rather than guessed.

## Voice-chat quick start

Open the installed `README.md` or run `prompt-library summary`. In a voice chat,
say one of:

- **Ashen Spire:** “Use my `ashenspire` master prompt. It is the game-specific
  .NET rebuild contract. Summarize the requirements relevant to this request, check
  the live issue context, and propose one reviewable increment before coding.”
- **Any other game:** “Use my `general-game` master prompt. It is my reusable
  .NET-first game architecture and delivery template. Help me fill in the project
  brief, summarize the resulting plan, and stop at the first review gate.”

The summary is an introduction, not a replacement for the full prompt. Attach or
paste `ashenspire.md` or `general-game.md` when the chat cannot read the installed
library directly.
