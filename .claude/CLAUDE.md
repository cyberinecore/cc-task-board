# CLAUDE.md

## What this repo is

Cyberine TaskBoard: a Claude Code plugin that keeps a repository's backlog in a file, prints a board banner at session start, and guards the board files so every change goes through the bundled CLI. Local only: no network, keys or dependencies.

## Commands

- Tests: `npm test` (`node --test tests/*.test.mjs`; real scratch git repos, no mocks).
- Validate: `claude plugin validate . --strict` and `claude plugin validate .claude-plugin/plugin.json --strict`. This file sits in `.claude/` because a root `CLAUDE.md` fails strict validation.
- Try it locally: `claude --plugin-dir .` from a scratch repo, or install from this directory as a local marketplace (`claude plugin marketplace add <this dir>`).

## The bundle is generated, never edited

`cli/tasks.mjs`, `cli/lib/chunk-*.mjs` (content-hashed, replaced on every re-vendor), `cli/build.json`, `templates/tasks-board.html`, `references/board-voice.md`, `skills/tasks/SKILL.md` and `skills/end/SKILL.md` are built from the upstream source repository by its `taskboard:bundle` script, so every writer of a board shares one format. Re-vendor from that repository's checkout:

```bash
npm --prefix <upstream checkout> run taskboard:bundle -- --out <this repo> --program "/cyberine-taskboard:tasks" --tag taskboard
npm --prefix <upstream checkout> run taskboard:bundle -- --check <this repo>
```

`--check` rebuilds every output (and fails on a stray file under `cli/lib/`) with the options in `cli/build.json` and exits 1 naming each differing file; run it before every release. A fix to CLI behaviour or to the generated skill and voice text goes to the source repository, never into a vendored file. Hand-maintained here: the `init` and `help` skills, `hooks/hooks.json`, README, PRIVACY, SECURITY, CHANGELOG, the manifests and the tests. The template is resolved relative to the plugin root (`cli/..`), so keep the `cli/` and `templates/` layout.

## Plugin constraints

- No top-level `bin/`: claude.ai and Cowork refuse a plugin that has one.
- Keep the plugin name `cyberine-taskboard`: the big `cyberine` plugin silences its own banner and guard when a `cyberine-taskboard@*` key is enabled.
- `plugin.json` keeps only `privacyPolicyUrl` among the listing links; unknown keys are portal warnings.
- Bump `version` in `plugin.json` on every release with a `CHANGELOG.md` entry; tag `cyberine-taskboard--v<version>`.
- User-facing surface is four skills (tasks, init, end, help); reply style and consent live in `references/board-voice.md`, the one file every skill reads. Skill text is interim: the Cyberine source (task k4hwz) will generate skills, hooks and voice from one source, and this repo will only re-vendor. v0.1 skills use only: init, status, next, add, converge-apply, set, note, deps, corpus, suggest, archive, end, recurring, board, doctor, merge, drop. `draft`/`gather` (write into another repository), `relocate`, `migrate`, `forget`, `journal`/`timeline`/`log`, `move`/`tidy`/`reconcile`, `status forbidden` and the fleet-routing fields stay undocumented. `run`, `group` and `end --handoff` are not in the bundle.
