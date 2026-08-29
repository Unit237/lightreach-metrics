# AGENTS.md — instructions for coding agents in this repo

This is a **Spec bundle**. The source of truth is plain English in
`docs/**/*.md` plus the captured conversational history in
`prompts/*.prompts`. Running code is a compile artifact.

## How to compile this bundle

When the user asks you to **compile**, **build**, or **generate** the
code for this bundle:

1. Run `spec compile` in the bundle root. That writes
   `.spec/compile-prompt.md`, a self-contained compile prompt
   derived from the current specs and every `.prompts` file in
   `prompts/`.
2. Read that file and follow the instructions inside it. In particular,
   emit generated files under `./out/` (or whatever `output.target` in
   `spec.yaml` says).
3. If the user edited a `.prompts` file, prefer its guidance over your
   own memory of past conversations — those files *are* the conversation.

## What files matter

- `docs/**/*.md` — **specs**. Plain English intent. Edit these to change
  what gets built.
- `prompts/*.prompts` — captured conversational history. One file per
  commit, each containing every session that produced that commit.
  Edit these to rewrite history (and therefore the next compile).
- `spec.yaml` — bundle manifest, model routing, output target.

## What NOT to do

- Don't put prompts in `.md` files. Prompts have their own extension
  (`.prompts`) and their own schema — `spec push` rejects `.md`
  files inside `prompts/`.
- Don't invent new top-level directories — the bundle structure is
  part of the contract with Spec Cloud.
- Don't edit files under `out/` by hand; they are regenerated on every
  compile.
- Don't commit `.spec/` — it's local index state.

<!-- >>> spec live coordination >>>
## Spec Live — multi-agent coordination

This bundle uses **Spec Live** to coordinate coding agents working in parallel.

Before planning or editing:

1. Run `spec status` to verify this machine's workday switch and watchers.
   Read `.spec/team-coordination.md` when it exists; the brief lists active
   objectives, progress, claimed paths, and recent handoffs.
2. Do not duplicate an active objective. Split the work, wait for the handoff,
   or tell the user about the overlap.
3. Before modifying an existing or potentially shared path, run
   `spec locks check <bundle-relative-path>`. Exit `0` means clear; exit `2`
   means another agent may be editing it, so surface the conflict before
   proceeding.
4. Report material progress, paths changed, blockers, and the final outcome in
   normal assistant messages. Spec Live shares those updates automatically.

Treat the coordination brief as advisory and the lock check as the mechanical
conflict signal. The brief disappears when the last active round finishes, so
its absence is normal. When Spec is OFF or a watcher is stopped, cross-machine
context can be stale or absent and lock checks deliberately fail open. Only the
human operator should change the workday switch with `spec on` / `spec off`.
Never hand-edit files under `.spec/`.
<!-- <<< spec live coordination <<< -->
\n++

<!-- >>> invariant-driven development >>>
## Invariant-driven development

Before fixing localized authorization, identity, lifecycle, privacy,
validation, recovery, retry, ranking, or cross-service behavior:

1. Search this repository and adjacent Lightreach systems for analogous cases.
2. Name the underlying rule and identify its owning boundary.
   Use `python3 architecture/tools/architecture.py context <changed-paths>`
   from the workspace root to load related invariants and architectural memory.
3. If multiple real manifestations share the semantics, change the versioned
   contract or canonical implementation and generate/adapt consumers.
4. Add conformance coverage and remove redundant local handling.
5. Do not generalize beyond evidence in the system; record intentionally
   distinct domain behavior as an explicit exception.
6. When the task reveals recurring conceptual pressure or an architectural
   decision, update architectural memory with durable evidence—not line-level
   task history.

When this repository is in the Lightreach workspace, consult
`architecture/repositories.json` and `architecture/invariants.json` at the
workspace root and run `python3 architecture/tools/architecture.py check`
after changing a registered invariant.
<!-- <<< invariant-driven development <<< -->
