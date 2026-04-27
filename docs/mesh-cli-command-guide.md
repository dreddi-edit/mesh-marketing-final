# Mesh CLI Command Guide

Version: 0.9.x preview

This file explains the slash commands from `/help`, what Mesh CLI can fundamentally do, how the functions are implemented internally, and which parts are still experimental or not fully production-level.

## Summary

Mesh is a terminal coding agent with a local tool backend, persistent codebase memory, and isolated verification environments. The agent doesn't just chat over files — it builds local artifacts in `.mesh/`, uses capsules instead of re-reading everything, can test patches in timelines, introspect runtime failures, and run several Moonshot workflows as production-near local ledgers.

The central flow is:

1. `src/agent-loop.ts` receives user input and slash commands.
2. `ContextAssembler` trims transcript, tools, and runtime context to a budget.
3. `BedrockLlmClient` calls the model via the Mesh LLM proxy or BYOK endpoint.
4. `LocalToolBackend` provides workspace, runtime, agent, and moonshot tools.
5. Results are persisted in `.mesh/`, cache, audit logs, timelines, or dashboard artifacts.

Code proof: `src/agent-loop.ts`, `src/context-assembler.ts`, `src/llm-client.ts`, `src/local-tools.ts`, `src/timeline-manager.ts`, `src/runtime-observer.ts`.

## What Mesh Can Do

Mesh today can:

- Search, read, patch, move, delete, and verify files.
- Build workspace capsules and a codebase index so large repos aren't read raw every turn.
- Run commands more safely, with runtime and command-safety guards.
- Create isolated timelines, test patches there, and only promote after verification.
- Analyze runtime errors using the Node/V8 Inspector autopsy.
- Launch dashboard, voice, browser preview, and portal flows.
- Write Engineering Memory, Digital Twin, Causal Intelligence, Discovery Lab, Reality Fork, and Ghost Engineer ledgers.
- Run security and moonshot systems locally: Self-defense, Precrime, Semantic Git, Bidirectional Spec-Code, Semantic Sheriff, Tribunal, Session Resurrection.
- Produce audit and structured-logging artifacts.

The practical advantage: less blind editing, more reproducible evidence, safer promotion through timeline verification, more persistent project knowledge, and better navigation in large repos.

## Command Reference

| Command | What it does | How it works | Code proof |
|---|---|---|---|
| `/help`, `/commands` | Shows the slash-command list. | Reads the static command registry and renders usage/description. | `src/agent-loop.ts#getSlashCommands`, `printHelp` |
| `/status` | Shows runtime, session, model, token, git, and index state. | Combines local agent-state data with backend tools like Index/Git/Sync. | `src/agent-loop.ts#printStatus`, `workspace.get_index_status`, `workspace.git_status` |
| `/capsule`, `/memory` | Manages the session capsule. | Shows, compacts, clears, or exports the stored session summary. | `src/agent-loop.ts#handleCapsuleCommand`, `src/session-capsule-store.ts` |
| `/index` | Re-indexes the workspace. | Runs through WorkspaceIndex and produces file capsules plus repo intelligence. | `src/agent-loop.ts#runIndexing`, `src/workspace-index.ts`, `src/cache-manager.ts` |
| `/distill` | Updates the project brain context. | Analyzes workspace signals and writes `.mesh/project-brain.md`. | `src/agent-loop.ts#distillProjectBrain` |
| `/synthesize` | Generates structural change proposals. | Uses heuristic repo signals and existing project artifacts to propose next changes. | `src/agent-loop.ts#runSynthesize` |
| `/twin` | Builds or reads the Codebase Digital Twin. | Produces a structured view of files, symbols, routes, and risk hotspots. | `workspace.digital_twin`, `src/local-tools.ts` |
| `/repair` | Shows the predictive repair queue. | Collects diagnostics and proposes repairable errors/tasks. | `workspace.predictive_repair`, `src/local-tools.ts` |
| `/daemon` | Controls the Mesh background daemon. | Delegates start/status/digest/stop to the daemon tool. | `workspace.daemon`, `src/daemon.ts`, `src/daemon-protocol.ts` |
| `/issues` | Issue-to-PR pipeline for GitHub/Linear/Jira. | Scans issues and creates PR-oriented work drafts. | `workspace.issue_pipeline`, `src/integrations/issues/*` |
| `/chatops` | Slack/Discord co-engineer flow. | Takes ChatOps context, creates investigation/approval status and PR draft. | `workspace.chatops`, `src/integrations/chatops/manager.ts` |
| `/production` | Shows production signals and top regressions. | Reads/refreshes `.mesh/production-signals.json` from telemetry connectors. | `workspace.production_status`, `src/integrations/telemetry/*` |
| `/replay` | Replays a production trace. | Reconstructs a Trace/Sentry event and checks divergence over timeline/runtime data. | `runtime.replay_trace`, `src/runtime/replay.ts` |
| `/bisect` | Automatic git-bisect by symptom. | Tests commits with verification command and reports the likely introducing commit. | `workspace.symptom_bisect`, `src/timeline/symptom-bisect.ts` |
| `/whatif` | Counterfactual migration analysis. | Creates an isolated timeline, simulates a change hypothesis, and assesses impact. | `workspace.what_if`, `src/local-tools.ts#whatIf` |
| `/audit` | Audit-log replay/verify. | Checks hash-chain integrity of tool calls in `.mesh/audit`. | `workspace.audit`, `src/audit/logger.ts` |
| `/brain` | Mesh Brain stats/query/opt-out. | Queries global fix patterns or local contribution status. | `workspace.brain`, `src/mesh-brain.ts` |
| `/learn` | Read or update Engineering Memory. | Extracts repo habits, risk modules, and rules from local history. | `workspace.engineering_memory`, `src/local-tools.ts` |
| `/intent` | Product intent → implementation contract. | Maps free-form product intent onto likely files, risks, phases, and verification. | `workspace.intent_compile`, `src/local-tools.ts#intentCompile` |
| `/causal` | Causal Software Intelligence. | Builds or queries a graph of files, risks, tests, and causal chains. | `workspace.causal_intelligence`, `src/local-tools.ts` |
| `/lab` | Autonomous Discovery Lab. | Collects hypotheses and discovery items from causal/repair/workspace signals. | `workspace.discovery_lab`, `src/local-tools.ts` |
| `/fork` | Plan or materialize Reality Forks. | Creates alternate implementation realities in timelines and assesses them. | `workspace.reality_fork`, `src/local-tools.ts#realityFork` |
| `/ghost` | Ghost Engineer style replay. | Learns local engineering style, predicts implementation paths, and produces timeline patches. | `workspace.ghost_engineer`, `src/local-tools.ts#ghostEngineer` |
| `/fix` | Apply background-resolved fix. | Uses stored speculative fixes for current linter/compiler problems. | `src/agent-loop.ts#runFix` |
| `/hologram` | Start a command with V8 telemetry. | Injects runtime observer/autopsy hook via Node options and saves run artifacts. | `runtime.start`, `src/runtime-observer.ts` |
| `/entangle` | Quantum-link a second repo. | Connects repository paths for experimental AST/sync workflows. | `src/agent-loop.ts#runEntangle` |
| `/inspect` | Attach the Visual Agent Portal. | Starts/attaches a browser portal and overlay for UI/canvas inspection. | `src/mesh-portal.ts`, `src/agent-loop.ts#handleInspect` |
| `/stop-inspect` | Detach the visual portal. | Removes browser overlay and ends portal connection. | `src/agent-loop.ts#handleSlashCommand`, `MeshPortal.stop` |
| `/preview` | Frontend screenshot in the terminal. | Uses Chrome/CDP preview with optional output protocols. | `frontend.preview`, `src/terminal-preview.ts` |
| `/dashboard` | Launch the local 3D/interactive dashboard. | Starts `dashboard-server.js`, writes events to `.mesh/dashboard`, opens a local URL. | `src/dashboard-server.ts`, `src/agent-loop.ts#launchDashboard` |
| `/sync` | L2 cache sync status. | Queries cloud/Supabase cache state and local L1/L2 statistics. | `workspace.check_sync`, `src/cache-manager.ts` |
| `/setup` | Interactive or scripted settings. | Saves model, theme, cloud, key, endpoint, and voice config in user settings. | `src/config.ts`, `src/agent-loop.ts#handleSetupCommand` |
| `/model` | Choose/list/save the model. | Uses the central model catalog and updates current/user model. | `src/model-catalog.ts`, `src/agent-loop.ts#handleModelCommand` |
| `/cost` | Show token usage and cost. | Computes session input/output tokens against model pricing. | `src/agent-loop.ts#printCost` |
| `/approvals` | Control tool auto-approval. | Toggles approval policy for risky tools in the current agent context. | `src/agent-loop.ts#handleApprovalsCommand` |
| `/undo` | Revert the last agent file change. | Delegates to `workspace.undo` and uses local backup/undo machinery. | `workspace.undo`, `src/local-tools.ts` |
| `/steps` | Set max tool steps. | Changes `maxSteps` for the current session. | `src/agent-loop.ts#handleStepsCommand` |
| `/doctor` | Runtime diagnostics. | Checks environment, voice deps, model paths, tooling, and optional fixes. | `src/agent-loop.ts#runDoctor`, `src/voice-manager.ts` |
| `/compact` | Compress transcript. | Compresses chat/tool history into the session capsule. | `src/agent-loop.ts#compactTranscript` |
| `/clear` | Clear the terminal UI. | ANSI clear plus banner reprint. | `src/agent-loop.ts#handleSlashCommand` |
| `/voice` | Configure/enable speech-to-speech. | Uses Whisper/ffmpeg for STT and local/system TTS voices. | `src/voice-manager.ts`, `src/agent-loop.ts#runVoiceSetupWizard` |
| `/exit`, `/quit` | Exit the CLI. | Signals `shouldExit` to the main loop. | `src/agent-loop.ts#handleSlashCommand` |
| `/tribunal` | 3-Panel AI Tribunal. | Lets Correctness, Performance, and Resilience panelists debate, then writes a decision artifact. | `workspace.tribunal`, `src/moonshots/tribunal.ts` |
| `/resurrect` | Save/restore session state. | Persists intent, open questions, checkpoints, and next actions. | `workspace.session_resurrection`, `src/moonshots/session-resurrection.ts` |
| `/sheriff` | Semantic Contract Sheriff. | Fingerprints module semantics, locks contracts, reports drift. | `workspace.semantic_sheriff`, `src/moonshots/semantic-sheriff.ts` |

## Other Important Tool Functions Without Their Own Slash Command

These are used automatically by the agent or are reachable through tool calls:

| Tool | Purpose | Code proof |
|---|---|---|
| `workspace.self_defend` | Security probing, ReDoS hardening in timelines, security ledger. | `src/security/self-defending.ts` |
| `workspace.precrime` | 14-day risk gates from local outcomes, telemetry, and global patterns. | `src/moonshots/precrime.ts` |
| `workspace.semantic_git` | Semantic merge analyze/plan/resolve/verify with timeline gate. | `src/moonshots/semantic-git.ts` |
| `workspace.spec_code` | Bidirectional spec-code contracts, drift, materialization plans. | `src/moonshots/spec-code.ts` |
| `workspace.natural_language_source` | Natural-language intent specification → implementation IR. | `src/moonshots/natural-language-source.ts` |
| `workspace.fluid_mesh` | Capability map across scripts, routes, and reusable functions. | `src/moonshots/fluid-mesh.ts` |
| `workspace.living_software` | Aggregated pulse over moonshot ledgers and self-maintenance signals. | `src/moonshots/living-software.ts` |
| `workspace.proof_carrying_change` | Promotion proof bundle with risks, contracts, verification, rollback. | `src/moonshots/proof-carrying-change.ts` |
| `workspace.causal_autopsy` | Failure root-cause analysis from runtime, proof, precrime, self-defense, and graph signals. | `src/moonshots/causal-autopsy.ts` |
| `workspace.timeline_*` | Create, patch, verify, compare, promote timelines. | `src/timeline-manager.ts` |
| `runtime.*` | Runtime start/capture/explain/fix/replay. | `src/runtime-observer.ts`, `src/runtime/replay.ts` |
| `agent.*` | Race fixes, spawn/review/merge_verified, planning. | `src/local-tools.ts` |

## How the Architecture Works Together

### Context and Capsules

Mesh avoids dumping large tool outputs raw into the model. File capsules, batch L1/L2 cache, and the ContextAssembler keep context small and targeted.

Code proof: `src/cache-manager.ts#getCapsuleBatch`, `src/context-assembler.ts`, `src/workspace-index.ts`.

### Safety and Validation

Tool inputs are centrally validated against JSON schema. Destructive commands are blocked by pattern guards. Runtime `NODE_OPTIONS` is allowlisted.

Code proof: `src/tool-schema.ts`, `src/command-safety.ts`, `src/runtime-observer.ts#mergeNodeOptions`.

### Timelines

Risky changes can run in isolated worktrees or copy fallbacks. Promotion is separated from patch generation.

Code proof: `src/timeline-manager.ts#create`, `run`, `compare`, `promote`.

### Runtime Observer

Node commands can run with the autopsy hook. On exceptions, stack frames, scope info, and fallback logs are persisted.

Code proof: `src/runtime-observer.ts#buildAutopsyHookSource`, `captureDeepAutopsy`.

### Dashboard and Portal

The agent writes dashboard events to `.mesh/dashboard` and starts a local server. `/inspect` can connect a browser overlay/portal.

Code proof: `src/dashboard-server.ts`, `src/mesh-portal.ts`, `src/agent-loop.ts#appendDashboardEvent`.

### Moonshot Ledgers

Many new features are local, traceable ledgers in `.mesh/`. This is by design: persistent evidence first, automation later.

Examples:

- `.mesh/security/*` for self-defense.
- `.mesh/precrime/*` for the future-self model.
- `.mesh/spec-code/*` for bidirectional contracts.
- `.mesh/semantic-git/*` for merge plans/resolutions.
- `.mesh/semantic-contracts/*` for the Sheriff.
- `.mesh/tribunal/latest.json` for tribunal decisions.

## Benefits in Use

- **Less context waste:** capsules and context budgets save tokens.
- **Better safety:** command guards, input validation, sensitive-path policies, and timeline gates prevent many risky actions.
- **Better reviewability:** many tools write ledgers instead of just chat replies.
- **Faster debugging:** runtime autopsy, replay, bisect, and causal autopsy shorten the search for root causes.
- **More autonomy without flying blind:** race fixes, reality forks, and semantic git work in isolated timelines.
- **Long-term project memory:** Engineering Memory, Ghost Engineer, Session Resurrection, and Project Brain prevent knowledge from living only in the transcript.

## Maturity and Limits

### Solid / production-ready

- File read/search/patch/write basics.
- Tool schema validation.
- Command safety blacklist.
- Capsule cache L1 and batch fetch.
- Timeline create/run/compare/promote including copy fallback.
- Runtime observer with Node/V8 autopsy.
- Audit hash chain.
- Model catalog and fallback handling.
- `spec_code`, `semantic_git`, `self_defend`, `precrime` as local, test-covered ledgers/workflows.

### Production-usable, treat conservatively

- `/dashboard`: useful as a supervision UI, but visual/3D rendering is more cockpit than hard verification.
- `/voice`: depends on local platform, ffmpeg, whisper-cpp, and model downloads.
- `/issues`, `/chatops`, `/production`: quality depends on correctly configured integrations and data sources.
- `/brain`: global benefit depends on endpoint, opt-in, and a real pattern corpus.
- `/tribunal`: structured decision-support system, not a formal proof.
- `/sheriff`: detects semantic drift via fingerprints/signatures, doesn't replace a complete test suite.

### Still experimental / not 100% production-perfect

- **Self-defending code:** auto-patching is currently deterministic and production-near only for simple ReDoS patterns. SQLi, path traversal, and command injection are confirmed and reported but not fully auto-patched.
- **Precrime:** local future-self model is rule/outcome-based. A real globally-trained model over 50k codebases doesn't yet fully exist in this codebase.
- **Semantic Git:** solves distinct-symbol conflicts well, blocks sensitive or overlapping conflicts. Fully semantic branchless Git is still research / extension territory.
- **Bidirectional Spec-Code:** contracts, drift, locks, and materialization plans exist. Full code generation from arbitrary specs is intentionally not automatic.
- **Natural language as source:** compile-to-IR exists; natural language as the primary source of truth isn't there yet.
- **Fluid Mesh / Living Software:** capability map and pulse exist, but cross-repository governance/IP/runtime migration is still open.
- **Ephemeral Execution:** zero-source/JIT execution is an endgame experiment, not released for critical production.
- **Schrödinger AST / Entangle:** strongly experimental workflows; only with isolated verification.

## Recommendations for Daily Use

For normal work:

1. `/status`
2. `/index`
3. `/intent <goal>`
4. work normally with Mesh
5. before risky changes: `/fork`, `/whatif`, `workspace.timeline_*`, or `/ghost patch`
6. before completion: `npm test`, `npm run typecheck`, `workspace.proof_carrying_change`

For quality / security work:

1. `workspace.spec_code action=synthesize`
2. `workspace.self_defend action=probe`
3. `workspace.precrime action=gate`
4. `/sheriff scan`, then `/sheriff verify`
5. `/causal build` or `/lab run`

For merge / conflict work:

1. `workspace.semantic_git action=analyze`
2. `workspace.semantic_git action=plan`
3. `workspace.semantic_git action=resolve verificationCommand="npm test"`
4. only then optionally with `promote=true` or manual review.

## Important

Mesh is strongest when used as a work and evidence system, not just a chat. The best results emerge when changes flow through timelines, tests, contracts, proofs, and local ledgers. The moonshot features are now more than demos, but for production-critical code they should still be used conservatively with verification and review.
