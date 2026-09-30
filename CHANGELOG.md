# Changelog

All notable changes to Cyberine TaskBoard. Versions follow `version` in `.claude-plugin/plugin.json`; each release is tagged `cyberine-taskboard--v<version>`.

## [0.2.0] - 2026-10-01

- The session-start banner shows its count line on screen, and Claude still receives the counts plus the task to resume.
- The guard also refuses a shell command that writes a board file (a redirect, `tee`, `cp`, `mv`, `sed -i` onto a board path); reading stays allowed. Hooks now run through `hooks/board-hooks.mjs`, which skips any call that names no board file.
- A bare `/cyberine-taskboard:end` logs the session's unlogged work without asking first; an end request in words still asks once.
- Replies no longer add an undo hint after a change; ask for undo when you want it.
- `init` says the banner starts once the board has tasks, which is when it appears.
- PRIVACY.md lists every file and environment variable the plugin reads or writes.
- New icon and banner in a warm cream, coral, amber, plum and sage palette.
- The guard also covers MultiEdit, so a multi-edit of a board file is refused like Write, Edit and NotebookEdit.
- The listing description says the guard refuses direct edits instead of claiming every change goes through the CLI; keywords add task-management and kanban.
- Replies no longer end with the command that ran.

## [0.1.0] - 2026-09-30

- SessionStart hook prints the board banner (counts and the task to resume) on startup, resume, clear and compact; silent in a repository without a board.
- PreToolUse guard on Write, Edit and NotebookEdit refuses a direct edit of a board file.
- Four commands: `/cyberine-taskboard:tasks` (Claude may start it too) saves a conversation as tasks, says what is next and why, starts, closes with observed evidence, blocks, adds recurring chores and renders a read-only HTML board page, all in plain words; `/cyberine-taskboard:init` starts a personal or shared board; `/cyberine-taskboard:end` wraps the board up, typed or started by Claude on an end request that names the taskboard (never a phrase naming cyberine); `/cyberine-taskboard:help` explains the plugin. `init` and `help` start only when the user types them.
- One reply-style file, `references/board-voice.md`, read by every skill: outcome first in the user's language, tasks by title with the id in parentheses, one question per turn, act-then-confirm for clear requests, undo only where an inverse exists, close without observed evidence only as unverified, commands only as a `ran:` footnote.
- `/cyberine-taskboard:end` first proposes logging work the board is missing (commits that name no task), asks once, then wraps.
- Boards record a format version; an older plugin refuses to write a newer-format board instead of damaging it.
- The banner and guard stay silent when another installed board plugin already provides them.
- `TASKBOARD_ROOT` pins the board to another directory.
- Bundled zero-dependency CLI `cli/tasks.mjs` (Node 20+), with `status --json` and `next --json` reads.
