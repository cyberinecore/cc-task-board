# Changelog

All notable changes to Cyberine TaskBoard. Versions follow `version` in `.claude-plugin/plugin.json`; each release is tagged `cyberine-taskboard--v<version>`.

## [0.4.0] - 2026-10-27

- Re-vendored from the upstream board source at 213987e4. A board written by a newer writer no longer prints "manifest lines carry unknown fields" on every command: the CLI now reads `waits-on`, `default`, `undo-cost`, `source` and `verified`.
- A blocked task can say who it waits on: you, another repository, another session, an outside vendor or an event (`waits-on`). Blocking a task records it, unblocking clears it, and the status views and the doctor show it.
- An "Owner: decide ..." task now carries the default that applies if you never answer and what undoing it would cost. Saving one without both is refused with nothing written, and the doctor flags older owner-decide tasks that have neither.
- A task or note that records a claim from another session names its source and how the claim was checked, or marks it unverified; the doctor lists unverified claims from other sessions.
- A task that depends on owner work no longer gets flagged as mixing owner and agent work in the board cleanup pass.

## [0.3.2] - 2026-10-26

- Re-vendored from the upstream board source at 318d5de5. The CLI is split into smaller files (`cli/tasks.mjs` is now 196,617 bytes, down from 242,698), which leaves wide headroom under the directory's 256 KiB per-file inspection limit.
- The board voice now states who decides what (the agent takes reversible design choices alone; the user decides irreversible or outward actions) and gives manual steps one checkpoint at a time. The tasks skill shapes owner work into separate "Owner:" tasks and can split an existing task.
- Also carries the 0.3.1-era re-vendor from 9302826c, which shipped without its own entry.
- The README banner is now a 112 KB JPEG instead of a 757 KB PNG.

## [0.3.1] - 2026-10-21

- The session-start banner now also shows in a forked session (`SessionStart` source `fork`, which Claude Code added alongside `startup`, `resume`, `clear` and `compact`).

## [0.3.0] - 2026-10-08

- Re-vendored from the upstream board source at 181a6ff6. `--version` now prints the plugin version (0.3.0) instead of the upstream build number.
- The bundled CLI guard itself now refuses case-variant and `.`/`..` board paths and PowerShell and Monitor writes, so the check no longer depends on the hook layer alone.
- "Clean up the board" runs a hygiene pass: a read-only preview of stale headers, dead dependency ids, duplicate candidates and decisions buried in blockers, then the mechanical fixes.
- Saving tasks you asked for runs in the same turn: Claude prints the titles and writes them, instead of asking first. A save Claude inferred on its own still asks.
- What only you can do is its own task: a decision about money, law, a public name or taste becomes "Owner: decide ...", with options, a recommendation and the default if you do not answer; an outside account or key becomes "Owner: provision ...", between the agent's integration task and a live verification task. Work that needs it waits on it instead of being marked blocked.
- An integration is reported "built, live verification pending" until the live check closes with observed output, and keys are asked for as an empty template in a gitignored env file, never in the chat.
- `/cyberine-taskboard:end` runs without asking when your message tells the session to wrap the board, also when the phrase comes after other work in the same message ("finish this, then taskboard end"); things it would have asked become tasks or report lines.
- The "next" view no longer swaps the blocked and waiting labels.
- The environment variables for the journal name, machine, shared-board folder, stale threshold and task claims are now `CYBERINE_TASKS_*`; the `NF_TASKS_*` names still work when the new one is unset.

## [0.2.2] - 2026-10-02

- The guard also covers the PowerShell tool: a PowerShell command that writes a board file (a redirect, `Set-Content`, `Add-Content`, `Out-File`, `Tee-Object`, `New-Item`, `Remove-Item`, `Rename-Item`, `Copy-Item` or `Move-Item` onto a board path or a folder holding one, or a .NET file write) is refused like the matching Bash command; reading, copying from the board and `-WhatIf` stay allowed. It follows literal variables and arrays, `Join-Path`, string concatenation, literal splatting, `$(...)` inside strings, wildcards, paths piped from `Get-Item` or `Get-ChildItem`, recursive folder copies, `Set-Location`/`Push-Location`, `Set-Alias` and `Set-Variable` within the command, and refuses a write it cannot resolve when the command names a board path.
- The guard also refuses a Bash `cp`, `mv`, `rsync` or `install` into the board folder, `rm -r` of it, and a write after `cd` into it.
- The guard also covers Monitor commands; a WebSocket monitor is not checked.
- A board path that differs only in letter case, such as `.local/tasks/active.md`, or that goes through `.` or `..` segments, is refused on every tool, since macOS and Windows treat a case variant as the same file.
- When the other board plugin is active, TaskBoard still guards PowerShell and Monitor calls, which that plugin does not cover.
- CI validates the plugin with Claude Code 2.1.287.

## [0.2.1] - 2026-10-01

- The bundled CLI is split into `cli/tasks.mjs` and `cli/lib/`, each file under 256 KiB so the directory can read all of it.
- Skill wording no longer uses phrasing a scanner reads as a credential; the manifests drop their `$schema` links.

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
- Four commands: `/cyberine-taskboard:tasks` (Claude may start it too) saves a conversation as tasks, says what is next and why, starts, closes with observed evidence, blocks, adds recurring chores and renders a read-only HTML board page, all in plain words; `/cyberine-taskboard:init` starts a personal or shared board; `/cyberine-taskboard:end` wraps the board up, typed or started by Claude on an end request that names the taskboard (never a phrase that names another tool); `/cyberine-taskboard:help` explains the plugin. `init` and `help` start only when the user types them.
- One reply-style file, `references/board-voice.md`, read by every skill: outcome first in the user's language, tasks by title with the id in parentheses, one question per turn, act-then-confirm for clear requests, undo only where an inverse exists, close without observed evidence only as unverified, commands only as a `ran:` footnote.
- `/cyberine-taskboard:end` first proposes logging work the board is missing (commits that name no task), asks once, then wraps.
- Boards record a format version; an older plugin refuses to write a newer-format board instead of damaging it.
- The banner and guard stay silent when another installed board plugin already provides them.
- `TASKBOARD_ROOT` pins the board to another directory.
- Bundled zero-dependency CLI `cli/tasks.mjs` (Node 20+), with `status --json` and `next --json` reads.
