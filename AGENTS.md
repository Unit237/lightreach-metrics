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
