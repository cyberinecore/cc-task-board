---
name: help
disable-model-invocation: true
user-invocable: true
description: What Cyberine TaskBoard does and how to turn it off
---

# Cyberine TaskBoard help

Answer from this page; for anything that reads or changes the board, use `/cyberine-taskboard:tasks`.

What it does: keeps a backlog in a file inside the repository, so it survives every Claude Code session.

- **Banner (SessionStart hook).** On startup, resume, `/clear` and compaction, the plugin prints one line with the board's counts and the task to resume. In a repository without a board it prints nothing: a board is opt-in per repository.
- **Guard (PreToolUse hook on Write, Edit, NotebookEdit).** Refuses a direct edit of a board file, so every change goes through the CLI's lock, validation and header count.
- **Commands.** Four, and everything else is said in plain words:

| Command | Started by | For |
|---|---|---|
| `/cyberine-taskboard:tasks` | you, or Claude when you talk about the board | what's next (when empty), save this conversation as tasks, start, finish or block a task, recurring chores, the board page |
| `/cyberine-taskboard:init` | you | start a board in this repository |
| `/cyberine-taskboard:end` | you, or Claude when you say "taskboard end" or "wrap up the taskboard" | wrap up: archive finished tasks, report what is left |
| `/cyberine-taskboard:help` | you | this page |

Where the board lives:

| Board | File | Shared? |
|---|---|---|
| Personal (default in `/cyberine-taskboard:init`) | `.local/tasks/ACTIVE.md`, with `.local/` added to `.gitignore` | no, this machine only |
| Shared with the team | `.claude/TASKS.md`, tracked in git | yes |

History sits beside the manifest: `TASKS_ARCHIVE.md`, `status.log`, `status.d/`, briefs under `tasks/`, and the journal.

Turning it off: `/plugin` and disable `cyberine-taskboard` for everything; deleting a repository's board file turns off that repository's banner. There are no plugin options.

When another installed board plugin already shows this banner and guards these files, TaskBoard's banner and guard stay silent so each appears only once. `TASKBOARD_ROOT=<dir>` pins the board to another directory.

Limits: the guard sees Write, Edit and NotebookEdit only; a board write through Bash is not caught, which is why the skill forbids it. The plugin needs `node` 20 or newer on the PATH; without it the banner is silent and the guard does not run.

Privacy: no network requests, no keys, nothing stored outside the repository (except a board page you write with `board --out`). It runs `git` to find the repository root, and `open` or `xdg-open` only when you pass `--open`.
