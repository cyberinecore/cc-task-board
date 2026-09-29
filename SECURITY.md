# Security policy

## Reporting

Report privately through GitHub's "Report a vulnerability" button on https://github.com/cyberinecore/cc-task-board/security, or by email to xinchao@nghia-pham.com. Please include the Claude Code version, the Node version, the plugin version, and the exact command or tool call. Do not open a public issue for an unfixed vulnerability.

## Scope

In scope: a board command that writes outside the repository without being given an explicit path, a crafted board file that makes the CLI execute code or spawn a process other than `git`, `open` or `xdg-open`, a network request of any kind, and a Write or Edit to a board file that the guard should have refused and did not.

Out of scope, documented as limits in the README: board writes made through Bash, MCP tools or commands typed with the `!` prefix; a missing `node`; a hook timeout; and a board you pointed elsewhere with `TASKBOARD_ROOT`.
