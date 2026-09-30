---
name: init
disable-model-invocation: true
user-invocable: true
description: Start a task board in this repository
---

# Start a task board

Before the first reply, read `${CLAUDE_PLUGIN_ROOT}/references/board-voice.md` and follow it. Run the CLI as `node "${CLAUDE_PLUGIN_ROOT}/cli/tasks.mjs" <sub>` from inside the repository.

1. Check first with `status --summary`. Exit 2 with `no manifest` means there is no board yet: go on. A `[taskboard]` line means the repository already has one: say where it is and how many tasks it holds, and stop. Never create a second board.
2. Ask ONE question with a picker, two options:
   - **Personal** (default): the board lives in `.local/tasks/`, which is added to `.gitignore`; only this machine sees it.
   - **Shared with the team**: the board lives in `.claude/TASKS.md`, tracked in git; teammates see it after they pull, and board changes show up in commits.
3. Run `init` for personal or `init --sync` for shared, and read the path it printed.
4. Report in plain words: where the board is, that once the board has tasks every session opens with a one-line board banner, and that the board fills up by saying "save this as tasks" or "add a task: ..." (or `/cyberine-taskboard:tasks`). For a shared board, add that the new file should be committed so teammates get it.

Never write to a board file by hand, and never add tasks from this command: an empty board is the correct result.
