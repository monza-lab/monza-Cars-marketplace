BRIDGECODE WORKFLOW

Bridgecode is a repo-local instruction system that turns Codex into a task-signal routed coding agent. It gives the repo an always-on router, research flow, instruction stabilizer, architecture/design function, execution/debug loop, temporary analysis space, durable design space, and recursive correction memory.

The central idea is simple: Codex should not guess the workflow. It should classify the task signal, declare the Bridgecode route, read the route files, inspect repo evidence, execute the smallest complete useful action, and explain the result.

-------------------------------------------------------------------------------
QUICK START
-------------------------------------------------------------------------------

1. Installation

Copy these into your project root:

- AGENTS.md
- bridgecode/
- agentic/ if you want to create it manually, though Bridgecode can create it when needed

AGENTS.md is the entry point. The bridgecode/ folder contains routed functions. The agentic/ folder is for temporary analysis, durable design artifacts, testscripts, failure reports, and other generated notes when they are useful.

2. Activation

At the start of a Codex session, use this prompt pattern:

"Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: [your request]"

For important work, add this line:

"Before major action, declare the BRIDGECODE_ROUTE from the task signal. In the final handoff, explain what was done agentically, what was validated, what remains uncertain, and the next real obstacle."

This activation prompt is intentionally simple. You do not need to name the specific Bridgecode function unless you want to. The router should classify the task signal and choose the route.

-------------------------------------------------------------------------------
HOW IT WORKS
-------------------------------------------------------------------------------

Bridgecode routes by task signal.

A task signal is the operational meaning of your request. It is inferred from your prompt, repo evidence, current task state, visible failures, and correction memory.

Common routes:

GENERAL
Shared routing, writing, design correction, artifact policy, affirmative correction, and recursive correction.

RESEARCH
Current docs, unfamiliar APIs, external evidence, unclear vocabulary, verified mechanisms, and research that helps the next route act without guessing.

INSTRUCT
Expert-guided question batches and user-dependent contract stabilization. This route is used when your answers materially change what should be built, designed, validated, or preserved.

LIRA
Architecture, repo audit, remediation planning, product definition, frontend design, UX, and design-system definition. This route decides what the system should be before EYE implements it.

EYE
Implementation, testing, debugging, loop-breaking, validation, final handoff, and correction-memory updates. This route changes code when the system is ready to change.

A new app from PRD/docs/mockups usually routes GENERAL → LIRA → EYE. A local code patch usually routes GENERAL → EYE. An unfamiliar API usually routes GENERAL → RESEARCH before implementation. A user-dependent product choice usually routes GENERAL → INSTRUCT before architecture or code.

Bridgecode should show a route declaration like this during nontrivial work:

BRIDGECODE_ROUTE: <task signal> → [GENERAL, ROUTE...] | MODE: <mode> | WHY: <one sentence>

This route declaration is operational traceability. It tells you what kind of work Codex thinks it is doing and which Bridgecode path is active.

-------------------------------------------------------------------------------
PROJECT STRUCTURE
-------------------------------------------------------------------------------

AGENTS.md

The always-on router and correction memory. Codex should read this first. It defines task-signal routing, the artifact policy, the engineering constitutions, communication rules, and repo/harness correction memory.

bridgecode/

The routed instruction system. Codex reads only the function files needed by the active task signal.

bridgecode/general-functions.md

The shared Bridgecode kernel: task-signal routing support, writing rules, artifact policy, design function, affirmative correction workflow, and recursive correction principles.

bridgecode/specific-functions/research.md

Used for discovery, current docs, unfamiliar tools, external APIs, evidence, vocabulary, and verified mechanisms.

bridgecode/specific-functions/instruct.md

Used when expert user answers would materially change the build contract.

bridgecode/specific-functions/lira.md

Used for architecture, repo audits, remediation plans, product definition, frontend design, UX, and design systems.

bridgecode/specific-functions/eye.md

Used for implementation, testing, debugging, loop-breaking, runtime validation, and correction-memory updates.

agentic/analysis.md

The default temporary whiteboard. Bridgecode uses this when written working memory helps analysis, planning, debugging, research synthesis, contract stabilization, implementation-block shaping, or handoff. It is temporary and can be replaced on the next task.

agentic/design/

The durable design space. UI style, design-system rules, UX models, visual references, accessibility rules, responsive behavior rules, and frontend implementation notes that should survive future tasks belong here.

agentic/testscripts/

Persistent validation scripts or human-run test instructions belong here when they are useful beyond the immediate turn.

-------------------------------------------------------------------------------
ARTIFACT POLICY
-------------------------------------------------------------------------------

Bridgecode keeps ordinary working analysis temporary.

Use agentic/analysis.md for route analysis, architecture scratchwork, research synthesis, contract stabilization, implementation-blocks, debug notes, and handoff notes that help the current task. This file can be deleted or replaced for the next task.

Use agentic/design/ for durable design memory. Design direction often needs to survive because future frontend work can drift without a stable UI/UX/design-system reference.

Use agentic/testscripts/ for validation instructions that should survive the current task.

Real app code, schemas, migrations, configs, tests, styles, and assets belong in the actual app/repo structure, not in agentic/.

Persistent canon.md, plan.md, review.md, or research.md files are optional, not default. They are useful when you explicitly want long-lived project documents or when the repo benefits from durable documentation beyond AGENTS.md, agentic/analysis.md, and agentic/design/.

-------------------------------------------------------------------------------
SELF-CORRECTION MEMORY
-------------------------------------------------------------------------------

AGENTS.md contains correction memory. It is a prevention layer, not a history log.

Harness rules capture repeated failures in task-signal routing, Codex coordination, tools, browser/computer/image-generation behavior, bad handoffs, artifact misuse, or LLM behavior.

Repo rules capture repeated failures in this specific repo’s architecture, conventions, dependencies, tests, runtime behavior, domain logic, or implementation patterns.

When Codex fixes an error that can recur, it should update the smallest durable rule. Related existing rules should be modified, extended, replaced, or deleted instead of blindly stacking new lines.

-------------------------------------------------------------------------------
EXAMPLE PROMPTS
-------------------------------------------------------------------------------

New app from docs and mockups:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: build the first MVP from the PRD and brainstorming notes in @docs, using the UI and branding in @mockups. Before major action, declare the BRIDGECODE_ROUTE from the task signal.

Feature implementation:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: implement the next feature described in @agentic/analysis.md, preserving the current contracts and validating the runtime path.

Bug fix:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: debug the failing test, prove the fix with a reproducer and the relevant test path, and update correction memory if the solved error can recur.

Repo review:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: audit the repo architecture, frontend, tests, and runtime setup. Use evidence from the repo and produce prioritized remediation blocks.

Prompt or workflow correction:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: correct the Bridgecode workflow using affirmative correction. State the desired behavior directly, update the right file, and preserve the task-signal router.

Design-heavy frontend work:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: redesign the frontend using the current backend behavior as truth. Put durable UI style, design-system, UX, and implementation notes under @agentic/design/. Validate the real app in browser after implementation.

Unfamiliar integration:

Use @AGENTS.md as the active repo instructions. Follow Bridgecode routing for this task: research the current official docs for this integration, create a route-ready handoff, then implement only after the usage is verified.

-------------------------------------------------------------------------------
GOLDEN RULE
-------------------------------------------------------------------------------

Tag @AGENTS.md once at the start, state the task, and let the task-signal router choose the route. For important work, ask Codex to show the BRIDGECODE_ROUTE before major action and explain the completed agentic work in the final handoff.