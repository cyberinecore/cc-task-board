# Privacy policy

Cyberine TaskBoard is a Claude Code plugin that runs only on your computer. This policy covers the plugin as published at https://github.com/cyberinecore/cc-task-board.

## What it collects

Nothing leaves your computer. Cyberine TaskBoard makes no network requests, has no telemetry, needs no account or API key, and sends no data to its author, to Anthropic, or to anyone else.

## What it reads and writes locally

It reads and writes only the task files of the repository you are working in: the board manifest (`.local/tasks/ACTIVE.md`, or `.claude/TASKS.md` when you chose a shared board), the archive, status log, briefs and journal beside it. The guard hook reads the tool name and file path that Claude Code hands it, to decide whether an edit targets one of those files. It does not read your conversation.

It runs `git` to find the repository root, and, when you wrap up the board, to list recent commit messages and the paths of uncommitted changes so work the board is missing can be logged; diffs and file contents are not read. It runs `open` (macOS) or `xdg-open` (Linux) only when you ask for the board page with `--open`. It writes outside the repository only when you name a path yourself with `board --out <file>`.

It reads a fixed list of named environment variables, among them `TASKBOARD_ROOT` (pins the board to another directory), `CLAUDE_PROJECT_DIR` and `PATH`; nothing else in your environment is read. To stay silent when another installed board plugin already shows the banner and guards the board, the hooks read the `enabledPlugins` setting from your Claude Code settings files (user, project and project-local), check whether `~/.claude/skills/` links such a plugin, and look for that plugin's command on your `PATH`. They read nothing else from those files.

## What it stores, and for how long

Everything it stores is the board itself, in your repository, kept until you delete it. Journal entries record who made a change as your operating-system user name and the process id (`<user>@<pid>`, or a name you set in the agent-name environment variable), and the short-lived lock directory records the machine's host name so a stale lock from another machine can be told apart. A personal board sits under `.local/`, which `tasks init` adds to `.gitignore`; a shared board under `.claude/` is tracked by git and follows your repository's history.

## Children

Cyberine TaskBoard is a developer tool and is not directed at children under 18.

## Contact

Questions or concerns: open an issue at https://github.com/cyberinecore/cc-task-board/issues or email xinchao@nghia-pham.com. Security reports: see `SECURITY.md`.

## Changes

Changes to this policy are published in this file in the repository, with the history kept by git.
