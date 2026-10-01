# Privacy policy

Cyberine TaskBoard is a Claude Code plugin that runs only on your computer. This policy covers the plugin as published at https://github.com/cyberinecore/cc-task-board.

## What it collects

Nothing leaves your computer. Cyberine TaskBoard makes no network requests, has no telemetry, needs no account or API key, and sends no data to its author, to Anthropic, or to anyone else.

## What it reads and writes locally

Its main files are the task files of the repository you are working in: the board manifest (`.local/tasks/ACTIVE.md`, or `.claude/TASKS.md` when you chose a shared board), the archive, status log, briefs and journal beside it. Beyond those, it touches only these, each for the reason given:

- `init` adds `.local/` to the repository's `.gitignore`; for a shared board it also adjusts that file so the board stays tracked, and adds a `merge=union` line for the journal to `.gitattributes`.
- The board page is written to `.local/tasks/board.html`, or to a path you name with `board --out <file>`; the page is built from a template inside the plugin.
- `draft --to <repo>` writes a draft task into the `.local/tasks/drafts/` folder of another repository you name, and `draft --file <file>` reads the file you name as the draft's text. Neither runs unless you or Claude invoke it with that path.
- The guard hook reads the tool name, file path and, for a shell command, the command text that Claude Code hands it, to decide whether the call writes a board file. When a shell or PowerShell command deletes, moves or matches a folder, it checks whether board files exist under the working directory, without reading them. It keeps none of it and does not read your conversation.

It runs `git` to find the repository root, to check whether a path is ignored, and, when you wrap up the board, to list recent commit messages and the paths of uncommitted changes so work the board is missing can be logged; diffs and file contents are not read. It runs `open` (macOS) or `xdg-open` (Linux) only when you ask for the board page with `--open`.

It reads exactly these environment variables and nothing else in your environment: `TASKBOARD_ROOT`, `CYBERINE_TASKS_ROOT` and `NF_TASKS_ROOT` (pin the board to another directory), `NF_TASKS_AGENT` (the name recorded in the journal), `NF_TASKS_MACHINE` (the machine named in a draft's origin), `NF_TASKS_SYNC_DIR` (which folder holds a shared board), `NF_TASKS_STALE_DOING_DAYS` (when an in-progress task counts as stale), `NF_TASKS_SESSION` and `NF_TASKS_CLAIM_TTL_MS` (who holds a claim on a task, and for how long), `CYBERINE_TASKS_NO_PROMOTE` (refuse to start tasks), `CLAUDE_JOB_DIR` (refuse to touch another project's board from a scratch directory), `CLAUDE_PROJECT_DIR` and `PATH`. To stay silent when another installed board plugin already shows the banner and guards the board, the hooks read the `enabledPlugins` setting from your Claude Code settings files (user, project and project-local), check whether `~/.claude/skills/` links such a plugin, and look for that plugin's command on your `PATH`. They read nothing else from those files.

## What it stores, and for how long

Everything it stores is the board itself, in your repository, kept until you delete it. Journal entries record who made a change as your operating-system user name and the process id (`<user>@<pid>`, or a name you set in the agent-name environment variable), and the short-lived lock directory records the machine's host name so a stale lock from another machine can be told apart, and a claim on a task records the session and host name that holds it. A personal board sits under `.local/`, which `tasks init` adds to `.gitignore`; a shared board under `.claude/` is tracked by git and follows your repository's history.

## Children

Cyberine TaskBoard is a developer tool and is not directed at children under 18.

## Contact

Questions or concerns: open an issue at https://github.com/cyberinecore/cc-task-board/issues or email xinchao@nghia-pham.com. Security reports: see `SECURITY.md`.

## Changes

Changes to this policy are published in this file in the repository, with the history kept by git.
