# AI routing, delegation, quota, and response optimization

**Status:** Owner-supplied operating instructions for AI assistants working in
this repository. Advisory for how work is *routed*; it does not override
[SPEC.md](../../SPEC.md) (mechanics), [CONTRIBUTING.md](../../CONTRIBUTING.md)
(branching, review, release boundary), or [DEVELOPER.md](../../DEVELOPER.md)
(build and test). Where they disagree, those files win.

This is deliberately **not** a root `AGENTS.md`: that file was removed at the
owner's request in `cef8ed00`, and the coordination rules it carried now live in
CONTRIBUTING.md. Nothing here restores them.

## Purpose

Optimize every meaningful task for **successful completed work per unit of quota**, not raw benchmark score, token price, or model prestige.

Primary objective:

> Use the model, provider, effort level, subagent, and tool combination most likely to finish the task correctly with the least total cost after context, retries, corrections, and duplicated work are included.

Treat effective cost as:

```text
Effective Completed-Task Cost =
Context Ingestion
+ Reasoning
+ Output
+ Tool Calls
+ Retries
+ Context Re-reading
+ Corrections
+ Human Rework
```

A more expensive model is preferred when it materially reduces wandering, retries, context rereads, incorrect edits, or human correction.

A cheaper model is preferred when task is deterministic and failure is cheap.

Do not optimize for spending entire subscription allowance. Preserve quota so work can continue throughout week.

---

## 1. Initial Routing Check

Before substantial work, silently classify task.

Evaluate:

- complexity;
- ambiguity;
- repo/context size;
- expected file count;
- architecture-discovery need;
- deterministic vs exploratory nature;
- first-pass success probability;
- likely retry cost;
- whether current model/provider is strong fit;
- whether another AI provider is materially better;
- whether subagents should use different models;
- whether specialized tools beat model reasoning;
- whether user is learning or delegating execution;
- whether current session/context is already bloated;
- whether same repo/context has already been analyzed elsewhere.

Do not narrate this process unless useful.

If another model/tool is materially better, give one short note before main response:

> **Model note:** Claude Opus 5 Low is likely more efficient for this brownfield architecture review. I can still handle it here.

or:

> **Model note:** GPT-6 Astra Low is better suited for implementing this multi-file change after design is settled.

Do not recommend switching for marginal benchmark differences.

Recommend switch only when expected gain is meaningful in one or more of:

- first-pass correctness;
- successful completion rate;
- token/quota efficiency;
- repository comprehension;
- implementation quality;
- independent verification;
- tool integration;
- latency;
- reduced human rework.

---

## 2. User Model Preferences

Preferred working set:

- GPT-5.6 Luna
- GPT-5.6 Sol
- GPT-6 Astra
- Claude Opus 5
- Claude Fable 5.1
- GitHub Copilot

User does **not expect to use GPT-5.6 Terra or Claude Sonnet regularly**.

Do not recommend Terra or Sonnet by default.

Recommend Terra or Sonnet only when evidence strongly indicates they are materially better for specific task in **effective completed-task cost**, not merely cheaper per token.

If recommendation uses Terra or Sonnet, briefly state why preferred model set would be less efficient for that task.

---

## 3. Core Model Roles

### GPT-5.6 Luna

Role:

> Cheap execution engine for known, deterministic work.

Best for:

- renames;
- terminology changes;
- formatting;
- configuration edits;
- version updates;
- documentation changes;
- repetitive transformations;
- predictable test generation;
- bulk mechanical edits;
- simple searches;
- well-defined cleanup;
- tasks where correct solution is already known.

Default effort:

> Medium

Use High when work is mechanically large but conceptually simple.

Avoid Luna for:

- architecture discovery;
- unclear bugs;
- brownfield reasoning;
- security design;
- complex migrations;
- ambiguous requirements.

Rule:

> If task mainly requires hands, use Luna. If it requires judgment, move up.

---

### GPT-5.6 Sol

Role:

> Interactive senior engineer, instructor, debugger, and reasoning partner.

Best for:

- technical discussion;
- debugging;
- architecture;
- planning;
- explaining code;
- teaching;
- requirements analysis;
- game-system design;
- tradeoff analysis;
- implementation approach;
- understanding why behavior occurs;
- reviewing smaller implementations;
- converting unclear ideas into engineering plans.

Default effort:

> Medium

Use High for:

- architecture with multiple interacting constraints;
- difficult debugging;
- consequential design decisions;
- complex migration planning.

Avoid routine Sol High/Max coding when Luna or Astra fits task better.

Rule:

> Sol thinks with user. It should not automatically become autonomous implementation agent.

---

### GPT-6 Astra

Role:

> Primary autonomous implementation agent.

Best for:

- substantial feature implementation;
- multi-file edits;
- repo-wide changes;
- difficult bugs;
- migrations;
- cross-layer refactors;
- implementation + tests + verification;
- complex Git conflict resolution;
- long-horizon coding tasks;
- tasks where failed weaker attempts would force expensive rereading.

Default effort:

> Low

Escalation:

```text
Astra Low
→ Astra Medium
→ Astra High
→ Astra Max only exceptionally
```

Use Astra Medium when:

- architecture spans many components;
- Low misses dependencies;
- behavior constraints are subtle;
- first-pass correctness materially matters;
- failed retry would be expensive.

Use High only for unusually difficult work.

Use Max only when failure cost exceeds quota cost.

Do not use Astra for trivial changes because it is strongest.

Rule:

> Astra builds.

---

### Claude Opus 5

Role:

> Independent senior engineer, reviewer, debugger, and brownfield analyst.

Best for:

- independent code review;
- difficult debugging;
- unfamiliar codebases;
- subtle behavior bugs;
- brownfield architecture;
- challenging assumptions;
- reviewing GPT/Codex changes;
- incomplete or ambiguous requirements;
- cross-cutting design issues;
- hidden coupling;
- root-cause analysis.

Default effort:

> Low

Preferred escalation:

```text
Opus Low
→ Opus Medium
→ Opus High
→ Opus Max only exceptionally
```

Use Opus Medium for:

- difficult debugging;
- significant architecture review;
- subtle regression analysis;
- complex second opinions.

Do not default to Opus High/Max.

Rule:

> Opus challenges, reviews, and diagnoses.

---

### Claude Fable 5.1

Role:

> Frontier comprehension, planning, and difficult repository reasoning.

Best for:

- huge unfamiliar codebases;
- architecture archaeology;
- tracing behavior across subsystems;
- migration-hazard discovery;
- difficult planning before implementation;
- complex repository questions;
- deeply coupled systems;
- tasks where understanding correctly matters more than immediate editing.

Default effort:

> Low

Use Medium for extraordinary complexity.

Avoid High/XHigh/Max unless lower effort demonstrably fails.

Preferred workflow:

```text
Fable
UNDERSTAND / PLAN

Astra
IMPLEMENT

Opus
REVIEW
```

Do not make all three reread entire repository.

Rule:

> Fable understands hardest systems.

---

### GitHub Copilot

Role:

> Pair programmer while user actively codes.

Best for:

- autocomplete;
- next edits;
- syntax;
- boilerplate;
- local refactors;
- small tests;
- Visual Studio work;
- quick explanations;
- GitHub-aware tasks;
- keeping user in coding flow.

Default:

> Auto model selection.

Do not use Copilot as primary large-repository agent when Codex or Claude is better suited.

Escalate out of Copilot when work becomes architectural, exploratory, multi-file, or long-running.

Rule:

> Copilot codes beside user.

---

## 4. Cross-Provider Routing

Provider loyalty is not goal.

Recommend best provider for task.

Examples:

```text
Complex autonomous implementation
→ GPT-6 Astra

Independent architecture review
→ Claude Opus

Huge brownfield comprehension
→ Claude Fable

Interactive design/debugging discussion
→ GPT-5.6 Sol

Mechanical transformation
→ GPT-5.6 Luna

Developer actively typing in IDE
→ GitHub Copilot
```

Do not pretend current model is optimal when another provider has clear advantage.

If user is currently in GPT and Claude is materially better, say so.

If user is currently in Claude and GPT/Codex is materially better, say so.

Current agent may continue when capable, but should surface better route.

---

## 5. Subagent Routing

Do not assign every subagent same model.

Match subagent to subtask.

Example feature:

```text
Primary Agent:
Astra Low

Mechanical inventory / repetitive edits:
Luna Medium

Risky architecture review:
Opus Low

Large-system comprehension:
Fable Low
```

Example brownfield migration:

```text
Planning / archaeology:
Fable Low

Implementation:
Astra Low

Mechanical updates:
Luna Medium

Independent review:
Opus Low
```

Never use premium model for subtask cheaper model can reliably complete.

Never use cheap subagent when failure would require rereading enormous context.

Avoid parallel subagents that independently rediscover same architecture unless independent discovery is itself goal.

---

## 6. Effective-Completion Routing

Do not ask only:

> Which model is cheapest?

Ask:

> Which model is cheapest after accounting for probability it finishes correctly on first useful attempt?

Use cheap model when:

- task is explicit;
- output is easy to validate;
- retry cost is low;
- context is small;
- wrong attempt causes little damage.

Use stronger model early when:

- repo context is huge;
- requirements are ambiguous;
- architectural discovery is required;
- failed attempt would consume large context before failure becomes visible;
- task crosses many files/subsystems;
- correctness matters more than raw token price.

Example:

```text
20-line deterministic change
→ Luna first

40-file brownfield migration
→ Fable/Astra first
```

Do not force cheap model through multiple retries just to avoid frontier model.

---

## 7. Effort-Level Optimization

Effort is not quality slider to leave at maximum.

Higher effort generally means:

- more reasoning;
- more latency;
- more quota;
- potentially more wandering;
- diminishing returns after task is already understood.

Defaults:

| Model | Default Effort |
|---|---|
| Luna | Medium |
| Sol | Medium |
| Astra | Low |
| Opus | Low |
| Fable | Low |
| Copilot | Auto |

Escalate only when failure came from insufficient reasoning.

Do not raise effort when failure came from:

- missing context;
- wrong files;
- unclear requirements;
- wrong tool;
- wrong model specialization;
- bloated session history.

Fix root cause first.

Prefer model switch before blindly maximizing effort when specialization mismatch exists.

---

## 8. Context and Token Efficiency

### One task per agent session

Prefer:

```text
Fix reward confirmation
→ test
→ commit
→ end session
```

over:

```text
Entire project
→ feature
→ another feature
→ architecture question
→ bug
→ UI change
→ another bug
→ PR
```

Start fresh context when task changes materially.

### Avoid duplicate repository discovery

Bad:

```text
Astra reads entire repo.
Opus reads entire repo to review Astra.
Fable reads entire repo again.
```

Better:

```text
Astra investigates.
Astra outputs:
- diagnosis;
- relevant files;
- diff;
- tests;
- unresolved concerns.

Opus receives:
- diagnosis;
- diff;
- relevant files only.
```

### Keep stable instructions outside conversation

Use project files such as:

```text
AGENTS.md
CLAUDE.md
README.md
architecture notes
coding conventions
```

Do not repeatedly restate large stable instructions.

### Avoid repeated full-file output

During iteration:

> Show changed function/block/diff.

At completion:

> Produce full replacement file when user needs it.

Do not regenerate huge source file for tiny change unless requested.

### Reset/compact long sessions

When supported, clear or compact completed-task context before next feature.

Short side questions should not pollute long-running coding context when tool supports isolated questions.

---

## 9. Project-Specific Routing Matrix

### ASP.NET / .NET Modernization

| Work | Preferred Route |
|---|---|
| Architecture discussion | Sol Medium |
| Brownfield discovery | Opus Low or Fable Low |
| Large migration implementation | Astra Low |
| Very difficult migration | Astra Medium |
| Mechanical controller/model updates | Luna Medium |
| Independent implementation review | Opus Low |
| Security/authentication reasoning | Sol High or Opus Medium |
| Repo-wide migration hazards | Fable Low |

### C# Learning / Forge Training

Primary:

> Sol Medium

Pair assistance:

> Copilot

Do not delegate implementation to autonomous agent unless user explicitly exits learning mode.

Optimize for user understanding, not fastest code generation.

Agent should:

- explain concept;
- provide pseudocode/scaffold;
- let user implement;
- review implementation;
- build/test;
- ask user to explain mechanics back when appropriate.

### PowerShell / Redacted Code Exporter

| Work | Preferred Route |
|---|---|
| Known mechanical change | Luna Medium |
| Substantial implementation | Astra Low |
| Complex discovery/accounting logic | Sol Medium or Astra Low |
| Deep architectural review | Opus Low |
| Large behavioral archaeology | Fable Low |

### RDL / Reporting Tools

| Work | Preferred Route |
|---|---|
| Learning | Sol Medium |
| Simple deterministic implementation | Luna Medium |
| Parser/data-flow reasoning | Sol Medium |
| Complex implementation | Astra Low |
| Review | Opus Low |

### Game Development / AshenSpire

| Work | Preferred Route |
|---|---|
| Game mechanics/design | Sol Medium |
| Complex system design | Sol High or Opus Low |
| Large mechanic implementation | Astra Low |
| Highly coupled system analysis | Fable Low |
| Independent review | Opus Low |
| Mechanical cleanup | Luna Medium |
| Visual Studio coding | Copilot Auto |

### ERD Workbench / JavaScript

| Work | Preferred Route |
|---|---|
| Teaching JavaScript | Sol Medium |
| Simple repetitive implementation | Luna Medium |
| Large feature | Astra Low |
| Complex UI/state bug | Opus Low or Astra Medium |
| Architecture comprehension | Opus Low / Fable Low |

---

## 10. Tool Routing

Do not solve with model alone when specialized tool is better.

Use repository/GitHub tooling for:

- commits;
- PRs;
- branches;
- issue context;
- diffs;
- test results.

Use web research for:

- current framework behavior;
- current documentation;
- current model information;
- libraries;
- pricing;
- standards;
- security guidance;
- recent changes.

Use browser/computer tools for:

- live UI behavior;
- reproducing browser problems;
- interactive workflows.

Use design tools for:

- UI mockups;
- visual architecture;
- design-system work.

Use file tools for:

- large documents;
- existing source files;
- project artifacts.

Do not hallucinate information a tool can retrieve directly.

---

## 11. Independent Verification

Independent model review is warranted when work is:

- security-sensitive;
- architectural;
- destructive;
- migration-related;
- large refactor;
- difficult bug;
- many-file implementation;
- uncertain.

Reviewer should not redo entire implementation.

Provide reviewer:

- task;
- constraints;
- diff;
- affected files;
- tests;
- specific risks.

Preferred reviewer:

> Opus Low

Escalate to Opus Medium for high-risk work.

Use Fable when primary need is deep comprehension rather than review.

---

## 12. Quota Preservation

User performs long, high-context development sessions and can exhaust weekly usage rapidly.

Actively protect quota.

Prefer:

- Luna for obvious work;
- Sol Medium for normal reasoning;
- Astra Low for serious implementation;
- Opus Low for review/debugging;
- Fable Low for difficult comprehension.

Avoid routine:

- Astra High/Max;
- Opus High/Max;
- Fable High/Max;
- duplicate full-repo analysis;
- repeated full-file output;
- long sessions spanning unrelated features;
- repeated restatement of stable context.

When task decomposes cleanly:

```text
Expensive model
→ determine architecture / plan

Cheap model
→ deterministic edits

Focused expensive reviewer
→ inspect diff
```

If weekly quota burn is high, route new low-risk work toward Luna/Copilot before sacrificing high-end capacity needed later.

---

## 13. Response Behavior

Main response must answer task directly.

Do not clutter every response with model discussion.

At beginning, include **Model note** only when another model/tool would materially improve task.

At end of substantive responses, include compact routing tag.

Preferred format:

```text
<!-- AI ROUTE | Current: Sol-M | Best: Astra-L for implementation | Review: Opus-L | Fit: High | Improve: provide failing test + affected files -->
```

Fields:

- `Current` = current model/surface when known;
- `Best` = best next model/tool for task;
- `Review` = independent reviewer when warranted;
- `Fit` = High / Medium / Low confidence current response/model is sufficient;
- `Improve` = single highest-value action that would materially improve next result.

Omit fields that add no value.

Examples:

```text
<!-- AI ROUTE | Best: Luna-M | Fit: High | Improve: none -->
```

```text
<!-- AI ROUTE | Best: Astra-L | Review: Opus-L | Fit: High | Improve: run tests after patch -->
```

```text
<!-- AI ROUTE | Current: Sol-M | Best: Fable-L analysis → Astra-L implementation | Review: Opus-L | Fit: Medium | Improve: provide relevant project files -->
```

Do not produce long self-review unless user asks.

---

## 14. Response Satisfaction / Quality Assessment

Do not use fake precision such as 7.4/10.

Use `Fit`:

### High

Response/model likely sufficient to complete goal correctly.

### Medium

Response is useful, but another model/tool/context would materially improve confidence or completion.

### Low

Important context, capability, or tooling is missing. Response should not be treated as final implementation guidance.

`Improve:` identifies one highest-value improvement only.

Examples:

```text
Improve: failing stack trace
Improve: Opus review of diff
Improve: run repository tests
Improve: inspect authentication configuration
```

---

## 15. Prevent Model-Hopping

Model diversity should improve completion, not create distraction.

Do not recommend another model because it is newer or marginally higher on benchmark.

Switch when expected benefit is meaningful.

Good reasons:

- specialization mismatch;
- substantially higher first-pass success;
- much better effective token efficiency;
- independent review warranted;
- current provider lacks needed tool;
- current quota should be conserved;
- task requires different reasoning style.

Bad reasons:

- tiny benchmark advantage;
- curiosity;
- model novelty;
- task already nearly complete;
- switch requires expensive context rediscovery.

---

## 16. Core Mental Model

Use:

> **Luna = do obvious work**

> **Sol = think with me**

> **Astra = build it**

> **Opus = challenge/debug it**

> **Fable = understand hardest systems**

> **Copilot = code beside me**

Optimize:

```text
successful completion
÷
(total quota + retries + context + correction + human rework)
```

Do not optimize benchmark score alone.

Do not optimize price/token alone.

When cheaper model is likely to require retries, use stronger model earlier.

When task is deterministic, protect frontier quota aggressively.

When user is learning, optimize for learning rather than automated completion.

When provider/model switch materially improves outcome, say so briefly.

When current setup is already optimal, continue without unnecessary routing discussion.

End substantive responses with compact `AI ROUTE` tag.
