#!/usr/bin/env node
import {
  SPLIT_SCHEMA_TEXT,
  addRecurring,
  claimOwner,
  dropRecurring,
  emptyManifestMessage,
  leaseRefusal,
  parseSplitInput,
  readManifestReport,
  recurringDid,
  recurringDueCount,
  recurringList,
  setRecurring,
  splitTask
} from "./lib/chunk-2WWQUJ3T.mjs";
import {
  analyze,
  formatReport,
  gatherDoctorInputs,
  hasBlockingFindings,
  missingBriefIssues,
  missingVerifyIssues
} from "./lib/chunk-WOW5KK7T.mjs";
import {
  addStaleHeaderNoteLocked,
  analyzeHygiene,
  applyHygiene,
  findCandidates,
  formatHygiene,
  tidyBoard
} from "./lib/chunk-FYYNIZRE.mjs";
import {
  boardBannerView,
  boardStatusView,
  boardView,
  healthLines,
  recurringEntries
} from "./lib/chunk-QSBQPOMF.mjs";
import {
  archiveIdsFor,
  computeRunnable,
  depHops,
  formatRunnableSummary,
  missingDeps,
  scopeRunnableSets,
  submoduleScopeNotice
} from "./lib/chunk-SKIZJWFT.mjs";
import {
  ArchivePartialError,
  BoardRejected,
  DEFAULT_TASK_EXEC,
  DEFAULT_TASK_MODEL,
  SCHEMA_TEXT,
  SET_ORDER,
  WRITABLE_STATUSES,
  archiveAbortLabel,
  archiveLocked,
  archivedBlocks,
  archivedIds,
  convergeApply,
  coreEnd,
  countAllHeaders,
  draftNames,
  gatherDrafts,
  logDone,
  mergeIds,
  rejectDraftErrors,
  rejectDrafts,
  rejectIds,
  resolveDuplicateOf,
  runTaskVerify,
  setBlocker,
  setDeps,
  setFields,
  setFieldsBatch,
  showDeps,
  validateDraftReferences,
  writeDraft
} from "./lib/chunk-T636BNCF.mjs";
import {
  WAITS_ON_SHAPE,
  missingDecideFields,
  noteSuffix,
  ownerMixForBlock,
  resolveProvenance,
  waitsOnError,
  waitsOnOf
} from "./lib/chunk-7XHG2DEQ.mjs";
import {
  appendJournalEvents,
  deriveDayTitle,
  journalEventRef,
  listJournalDaysFolded,
  lock,
  lockAndMigrate,
  nextDecisionTimestamp,
  readJournalDayFolded,
  readJournalEvents,
  reconcile,
  reconcileDryRun,
  reconcileLocked,
  unlock,
  unreviewedDecisionLines,
  unreviewedDecisions
} from "./lib/chunk-3V2BXNFG.mjs";
import {
  AmbiguousIdError,
  BoardFormatTooNew,
  IdClashError,
  KNOWN_HEADER_ID_RE,
  RECURRING_ID_RE,
  RECURRING_ID_SOURCE,
  TASK_ID_RE,
  TASK_ID_SOURCE,
  agentTag,
  appendStatus,
  assertBoardIdentity,
  assertBoardWritable,
  blockRange,
  boardEnv,
  boardFormatLine,
  boardFormatNotice,
  boardIdentityProblem,
  boardPathsFor,
  collapseWhitespace,
  define_TASKBOARD_BUILD_default,
  ensureMigrated,
  epochToLocalIso,
  fencedLineFlags,
  fold,
  lintManifest,
  malformedIdMessage,
  manifestCandidates,
  migrateLegacySource,
  noPromoteActive,
  nonBlankLineCount,
  overlaySources,
  parseLegacyBoard,
  parseManifestBlocks,
  pathInScope,
  resolveBoard,
  resolveIdPrefix,
  shadowedHubBoard,
  submoduleScope,
  todayLocalDate,
  writeFileAtomic
} from "./lib/chunk-GIU6R332.mjs";

// scripts/taskboard-bundle/entry.ts
import { homedir } from "node:os";

// src/commands/tasksBoard.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { existsSync as existsSync10, mkdirSync as mkdirSync3, readFileSync as readFileSync11, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { basename as basename4, dirname as dirname5, join as join7 } from "node:path";

// src/tasks/boardShare.ts
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
var MOVES = ["tasks", "TASKS_ARCHIVE.md", "TASKS_DEDUPE_LEDGER.jsonl", "journal"];
var STAYS = ["status.log", "status.d", ".reconcile.lock", "drafts"];
function syncDir() {
  const dir = boardEnv("CYBERINE_TASKS_SYNC_DIR") || ".claude";
  if (dir !== ".claude" && dir !== ".codex") throw new BoardRejected("tasks: CYBERINE_TASKS_SYNC_DIR must be .claude or .codex");
  return dir;
}
function isRepo(root) {
  try {
    execFileSync("git", ["-C", root, "rev-parse", "--git-dir"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function ensureLine(path, line) {
  const src = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (src.split("\n").some((entry) => entry.trim() === line)) return;
  appendFileSync(path, `${src && !src.endsWith("\n") ? "\n" : ""}${line}
`);
}
function rewriteGitignore(root, dir, dry) {
  const path = join(root, ".gitignore");
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n");
  const bare = lines.findIndex((line) => line.trim() === `${dir}/` || line.trim() === dir || line.trim() === `/${dir}/` || line.trim() === `/${dir}`);
  if (bare < 0) return [];
  const wanted = [`${dir}/*`, `!${dir}/TASKS.md`, `!${dir}/tasks`, `!${dir}/journal`, `!${dir}/TASKS_ARCHIVE.md`, `!${dir}/TASKS_DEDUPE_LEDGER.jsonl`];
  const already = new Set(lines.map((line) => line.trim()));
  const replacement = wanted.filter((line, i) => i === 0 || !already.has(line));
  if (!dry) {
    lines.splice(bare, 1, ...replacement);
    writeFileSync(path, lines.join("\n"));
  }
  return replacement;
}
function ensureGitFiles(root, tracked, dir) {
  if (!isRepo(root)) return;
  ensureLine(join(root, ".gitignore"), ".local/");
  if (tracked) {
    rewriteGitignore(root, dir, false);
    ensureLine(join(root, ".gitattributes"), `${dir}/journal/*.jsonl merge=union`);
  }
}
function manifestTemplate(project) {
  return `# Tasks: ${project}
<!-- Task board manifest v1. Status tokens: [backlog] [todo] [doing] [done] [forbidden]. -->
<!-- "blocked" is DERIVED \u2014 never a manual status. Two kinds: deps not all [done], OR a -->
<!-- "blocker: <reason>" line on a [todo] (external wait); set/clear it with -->
<!-- status block <id> "<reason>" / status unblock <id> -- never hand-edit the line. -->
<!-- [backlog] = not ready yet; excluded from run planning. Promote with: status todo <id> -->
<!-- [forbidden] = too dangerous to ever run \u2014 permanent tombstone. Add 'reason: <why>'. -->
<!--   Never archived. Flip back to todo only if mis-classified. -->
<!--   Set with: status forbidden <id>  -->
<!--   Format: "## T<NN> [forbidden] <title>" + "reason: <why it must never run>" -->
<!-- Task header format is parsed: "## T<NN> [status] <free-text title>". Keep the id+status shape. -->
<!-- The [status] bracket can lag the overlay: a status flip lands in the overlay first and reaches this header only at reconcile, so read status through the CLI (status --json), never by grepping headers. -->
<!-- Recurring chores (separate class, NOT in run/todo) use ids R<NN> + [recurring]; surface only when due. -->
<!--   ## R01 [recurring] <title>  /  every: 7d  /  last-done: YYYY-MM-DD  /  do: ...   (reset with: status did R01) -->
${boardFormatLine()}

`;
}
function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
function manifestAliases(root) {
  const present = manifestCandidates(root).filter((path) => existsSync(path));
  const aliases = /* @__PURE__ */ new Map();
  for (const link of present.filter(isSymlink)) {
    const real = realpathSync(link);
    const board = present.find((path) => path !== link && !isSymlink(path) && realpathSync(path) === real);
    if (board) aliases.set(link, board);
  }
  return aliases;
}
function existingManifests(root) {
  const aliases = manifestAliases(root);
  return manifestCandidates(root).filter((path) => existsSync(path) && !aliases.has(path));
}
function isIgnored(root, path) {
  try {
    execFileSync("git", ["-C", root, "check-ignore", "-q", "--", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function isTracked(root, path) {
  try {
    execFileSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function initBoard(root, args2) {
  if (args2.some((arg) => arg !== "--sync")) throw new BoardRejected("usage: /cyberine-taskboard:tasks init [--sync]");
  const tracked = args2.includes("--sync");
  const dir = syncDir();
  const target = tracked ? join(root, dir, "TASKS.md") : join(root, ".local", "tasks", "ACTIVE.md");
  const candidates = manifestCandidates(root);
  const existing = candidates.find((path) => existsSync(path));
  if (existing && existing !== target && candidates.indexOf(target) < candidates.indexOf(existing)) {
    throw new BoardRejected(`tasks init: board already exists at ${existing}; creating ${target} would hide it. Use /cyberine-taskboard:tasks relocate --to ${tracked ? "sync" : "local"}`);
  }
  const note = existing && existing !== target ? `note: ${existing} outranks ${target}; commands will continue reading the existing board.
` : "";
  assertBoardIdentity(root, target);
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(join(root, ".local", "tasks", "drafts", "consumed"), { recursive: true });
  mkdirSync(join(root, ".local", "tasks", "archive"), { recursive: true });
  ensureGitFiles(root, tracked, dir);
  if (existsSync(target)) return `${note}exists: ${target} (leaving it alone)`;
  writeFileSync(target, manifestTemplate(basename(root)));
  return `${note}created: ${target}`;
}
function relocateBoard(root, args2) {
  let to = "";
  let dry = false;
  for (let i = 0; i < args2.length; i++) {
    const arg = args2[i];
    if (arg === "--to") to = args2[++i] ?? "";
    else if (arg.startsWith("--to=")) to = arg.slice(5);
    else if (arg === "--dry" || arg === "--dry-run") dry = true;
    else throw new BoardRejected(`tasks relocate: unknown argument ${arg}`);
  }
  if (to !== "sync" && to !== "local") throw new BoardRejected("usage: /cyberine-taskboard:tasks relocate --to sync|local [--dry]");
  const dir = syncDir();
  const candidates = manifestCandidates(root);
  const local = candidates[2];
  const target = to === "sync" ? candidates[0] : local;
  const source = to === "sync" ? local : candidates.slice(0, 2).find((path) => existsSync(path));
  const existing = existingManifests(root);
  if (existing.length > 1) throw new BoardRejected(`tasks relocate: multiple manifests exist (${existing.join(", ")}); refusing to merge boards`);
  const alias = source && manifestAliases(root).get(target) === source ? target : null;
  if (existsSync(target) && !alias) return `already there: ${target}`;
  if (!source || !existsSync(source)) throw new BoardRejected("tasks relocate: no board on the source side; run /cyberine-taskboard:tasks init first");
  const paths = boardPathsFor(root);
  assertBoardWritable(paths.manifest);
  const pending = overlaySources(paths).some((path) => readFileSync(path, "utf8").trim().length > 0);
  if (pending) throw new BoardRejected("tasks relocate: unreconciled status flips are pending; run /cyberine-taskboard:tasks reconcile first");
  const from = dirname(source);
  const into = dirname(target);
  const moving = MOVES.filter((name) => existsSync(join(from, name)));
  const conflicts = moving.filter((name) => existsSync(join(into, name)));
  if (conflicts.length) throw new BoardRejected(`tasks relocate: target already contains ${conflicts.join(", ")}; refusing to overwrite`);
  const staying = STAYS.filter((name) => existsSync(join(from, name)));
  const unlinkLine = alias ? [`  unlink: ${alias} (a symlink to ${source}, not a second board)`] : [];
  const trackedNote = to === "local" && isRepo(root) && isTracked(root, source) ? [`note: ${source} was tracked in git; after the move its files show as deleted there -- commit that removal to untrack the board`] : [];
  if (dry) return [`plan: ${source} -> ${target}`, ...unlinkLine, ...moving.map((name) => `  move: ${join(from, name)} -> ${join(into, name)}`), ...staying.map((name) => `  stay: ${join(from, name)}`), ...to === "sync" ? rewriteGitignore(root, dir, true).map((line) => `  gitignore: ${line}`) : [], ...trackedNote, "dry run -- nothing written"].join("\n");
  mkdirSync(into, { recursive: true });
  if (alias) unlinkSync(alias);
  renameSync(source, target);
  for (const name of moving) renameSync(join(from, name), join(into, name));
  if (to === "sync") ensureGitFiles(root, true, dir);
  else if (isRepo(root) && !isIgnored(root, target)) ensureLine(join(root, ".gitignore"), ".local/");
  return [`relocated: ${source} -> ${target}`, ...alias ? [`  removed symlink: ${alias}`] : [], ...moving.map((name) => `  moved: ${name}`), ...staying.map((name) => `  left in place: ${name}`), ...trackedNote].join("\n");
}

// src/tasks/boardShellGuard.ts
import { existsSync as existsSync2, statSync } from "node:fs";
import { join as join3, posix as posix2 } from "node:path";

// src/tasks/boardGuard.ts
import { realpathSync as realpathSync2 } from "node:fs";
import { basename as basename2, dirname as dirname2, join as join2, posix, resolve } from "node:path";
var BOARD_RULE_QUOTE = 'Every change to the board goes through a `/cyberine-taskboard:tasks` subcommand. To a session these files are read-only: the manifest, TASKS_ARCHIVE.md beside it, status.log, and everything under status.d/ and journal/. Reading them is fine. Writing them by any other route is a hand-edit, whatever the tool.';
var BOARD_PATH_PATTERNS = [
  /(^|\/)\.local\/tasks\/ACTIVE\.md$/i,
  /(^|\/)\.claude\/TASKS\.md$/i,
  /(^|\/)\.codex\/TASKS\.md$/i,
  /(^|\/)TASKS_ARCHIVE\.md$/i,
  /(^|\/)\.local\/tasks\/status\.log$/i,
  /(^|\/)\.local\/tasks\/status\.d(\/|$)/i,
  /(^|\/)\.local\/tasks\/journal(\/|$)/i,
  /(^|\/)\.claude\/journal(\/|$)/i,
  /(^|\/)\.codex\/journal(\/|$)/i,
  /(^|\/)TASKS_DEDUPE_LEDGER\.jsonl$/i
];
function normalBoardPath(path) {
  const stripped = String(path ?? "").replace(/^(?:Microsoft\.PowerShell\.Core\\)?FileSystem::/i, "").replace(/\\/g, "/");
  if (stripped === "") return "";
  const norm = posix.normalize(stripped).replace(/(.)\/+$/, "$1");
  return norm === "." ? "" : norm;
}
function isBoardPath(path) {
  const norm = normalBoardPath(path);
  if (norm === "") return false;
  return BOARD_PATH_PATTERNS.some((re) => re.test(norm));
}
function realTarget(path) {
  let parent = path;
  const rest = [];
  for (; ; ) {
    try {
      return normalBoardPath(join2(realpathSync2(parent), ...rest));
    } catch {
      const next = dirname2(parent);
      if (next === parent) return normalBoardPath(path);
      rest.unshift(basename2(parent));
      parent = next;
    }
  }
}
function fileBoardMatcher(cwd) {
  let protectedFiles;
  let protectedDirs = [];
  return (path) => {
    if (path === "") return false;
    const absolute = resolve(cwd, normalBoardPath(path));
    const target = realTarget(absolute).toLowerCase();
    if (isBoardPath(path) || isBoardPath(absolute) || isBoardPath(target)) return true;
    if (protectedFiles === void 0) {
      try {
        const board = resolveBoard(cwd);
        protectedFiles = [board.manifest, board.archive, board.log, board.ledger].map((p) => realTarget(p).toLowerCase());
        protectedDirs = [board.statusDir, board.tasksDir, board.journalDir].map((p) => realTarget(p).toLowerCase());
      } catch {
        protectedFiles = [];
      }
    }
    return protectedFiles.includes(target) || protectedDirs.some((dir) => target === dir || target.startsWith(`${dir}/`));
  };
}
var DESTINATION_LAST_VERBS = /* @__PURE__ */ new Set(["mv", "cp", "rsync", "ln", "install"]);
var WRITES_ANY_ARG_VERBS = /* @__PURE__ */ new Set(["tee", "truncate", "rm", "unlink", "touch", "dd", "patch", "shred"]);
function segmentsOf(command) {
  return command.split(/(?:\|\||&&|[;|&\n])+/).map((s) => s.trim()).filter(Boolean);
}
function tokensOf(segment) {
  return segment.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, "")).filter(Boolean);
}
function verbOf(tokens) {
  let i = 0;
  while (i < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]) || tokens[i] === "sudo" || tokens[i] === "command" || tokens[i] === "env")) {
    i++;
  }
  return { verb: basename2(tokens[i] ?? ""), rest: tokens.slice(i + 1) };
}
var REDIRECT_RE = /(?:^|[^>\d])>{1,2}\|?\s*(['"]?)([^\s'";|&)]+)\1/g;
function quotedMask(text) {
  const mask = new Array(text.length).fill(false);
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "'") {
      mask[i] = true;
      if (ch === "'") quote = "";
      continue;
    }
    if (quote === '"') {
      mask[i] = true;
      if (ch === "\\" && i + 1 < text.length) {
        mask[++i] = true;
        continue;
      }
      if (ch === '"') quote = "";
      continue;
    }
    if (ch === "\\" && i + 1 < text.length) {
      mask[i] = true;
      mask[++i] = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      mask[i] = true;
      quote = ch;
    }
  }
  return quote === "" ? mask : null;
}
function topLevelSegments(text, mask) {
  const out2 = [];
  let start = 0;
  const flush = (end) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body !== "") out2.push({ text: body, mask: mask.slice(start + lead, start + lead + body.length) });
  };
  for (let i = 0; i < text.length; i++) {
    if (!mask[i] && /[;|&\n]/.test(text[i])) {
      flush(i);
      start = i + 1;
    }
  }
  flush(text.length);
  return out2;
}
function isTasksCli(segment) {
  const { verb, rest } = verbOf(tokensOf(segment));
  return verb === "cyberine" && rest[0] === "tasks";
}
function tasksCliWritesBoard(segment) {
  const unquoted = segment.text.split("").filter((_, i) => !segment.mask[i]).join("");
  if (/[`(]/.test(unquoted) || /\$\(|`|\$'/.test(segment.text)) return coarseBashWritesBoard(segment.text.replace(/\$\(|[`()]/g, ";"));
  for (const match of segment.text.matchAll(REDIRECT_RE)) {
    const at = (match.index ?? 0) + (match[0].startsWith(">") ? 0 : 1);
    if (!segment.mask[at] && isBoardPath(match[2] ?? "")) return true;
  }
  return false;
}
function bashWritesBoard(command) {
  const text = String(command ?? "");
  if (text.trim() === "") return false;
  const mask = quotedMask(text);
  if (mask === null) return coarseBashWritesBoard(text);
  const segments = topLevelSegments(text, mask);
  if (!segments.some((s) => isTasksCli(s.text))) return coarseBashWritesBoard(text);
  return segments.some((s) => isTasksCli(s.text) ? tasksCliWritesBoard(s) : coarseBashWritesBoard(s.text));
}
function coarseBashWritesBoard(text) {
  for (const match of text.matchAll(REDIRECT_RE)) {
    if (isBoardPath(match[2] ?? "")) return true;
  }
  for (const segment of segmentsOf(text)) {
    const tokens = tokensOf(segment);
    if (tokens.length === 0) continue;
    const { verb, rest } = verbOf(tokens);
    if (verb === "sed" && rest.some((t) => /^-[a-zA-Z]*i/.test(t))) {
      if (rest.some((t) => isBoardPath(t))) return true;
      continue;
    }
    if ((verb === "perl" || verb === "ruby") && rest.some((t) => /^-[a-zA-Z]*i/.test(t))) {
      if (rest.some((t) => isBoardPath(t))) return true;
      continue;
    }
    if (WRITES_ANY_ARG_VERBS.has(verb)) {
      if (rest.some((t) => isBoardPath(t))) return true;
      continue;
    }
    if (DESTINATION_LAST_VERBS.has(verb)) {
      const destination = rest.filter((t) => !t.startsWith("-")).at(-1) ?? "";
      if (isBoardPath(destination)) return true;
      continue;
    }
  }
  return false;
}
function patchPaths(patch) {
  const out2 = [];
  for (const line of patch.split("\n")) {
    const m = /^\*\*\* (?:Update File|Add File|Delete File|Move to): (.+)$/.exec(line.trim());
    if (m) out2.push(m[1].trim());
  }
  return out2;
}
var FILE_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "NotebookEdit", "MultiEdit", "str_replace_editor"]);
function boardGuardDecision(payload) {
  const tool = String(payload.tool_name ?? "");
  const input = payload.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) {
    const path = String(input["file_path"] ?? input["path"] ?? input["notebook_path"] ?? "");
    if (fileBoardMatcher(payload.cwd || process.cwd())(path)) {
      return {
        blocked: true,
        reason: `${tool} refused: ${basename2(path)} is a TaskBoard board file and this session may only READ it.
${BOARD_RULE_QUOTE}
Use \`/cyberine-taskboard:tasks\` (or \`node \${CLAUDE_PLUGIN_ROOT}/cli/tasks.mjs <subcommand>\`) instead.`
      };
    }
    return { blocked: false };
  }
  if (tool === "apply_patch") {
    const patch = String(input["command"] ?? input["input"] ?? input["patch"] ?? "");
    const hit = patchPaths(patch).find(fileBoardMatcher(payload.cwd || process.cwd()));
    if (hit !== void 0) {
      return {
        blocked: true,
        reason: `apply_patch refused: ${basename2(hit)} is a TaskBoard board file and this session may only READ it.
${BOARD_RULE_QUOTE}
Use \`/cyberine-taskboard:tasks\` (or \`node \${CLAUDE_PLUGIN_ROOT}/cli/tasks.mjs <subcommand>\`) instead.`
      };
    }
    return { blocked: false };
  }
  if (tool === "Bash") {
    const command = String(input["command"] ?? "");
    if (bashWritesBoard(command)) {
      return {
        blocked: true,
        reason: `Bash refused: this command writes a TaskBoard board file, and this session may only READ it.
${BOARD_RULE_QUOTE}
Use \`/cyberine-taskboard:tasks\` (or \`node \${CLAUDE_PLUGIN_ROOT}/cli/tasks.mjs <subcommand>\`) instead; redirect somewhere outside the board if you only want a copy.`
      };
    }
    return { blocked: false };
  }
  return { blocked: false };
}

// src/tasks/psTargets.mjs
var CONTENT_VERBS = /* @__PURE__ */ new Set(["set-content", "sc", "add-content", "ac", "out-file", "tee-object", "tee", "export-csv", "epcsv", "export-clixml", "start-transcript"]);
var PATH_VERBS = /* @__PURE__ */ new Set(["clear-content", "clc", "new-item", "ni", "remove-item", "ri", "rm", "del", "erase", "rd", "rmdir", "clear-item", "cli", "set-itemproperty", "sp"]);
var REMOVE_VERBS = /* @__PURE__ */ new Set(["remove-item", "ri", "rm", "del", "erase", "rd", "rmdir"]);
var RENAME_VERBS = /* @__PURE__ */ new Set(["rename-item", "ren", "rni"]);
var COPY_VERBS = /* @__PURE__ */ new Set(["copy-item", "copy", "cp", "cpi"]);
var MOVE_VERBS = /* @__PURE__ */ new Set(["move-item", "move", "mv", "mi"]);
var LOCATION_VERBS = /* @__PURE__ */ new Set(["set-location", "sl", "cd", "chdir"]);
var PUSH_VERBS = /* @__PURE__ */ new Set(["push-location", "pushd"]);
var POP_VERBS = /* @__PURE__ */ new Set(["pop-location", "popd"]);
var ALIAS_VERBS = /* @__PURE__ */ new Set(["set-alias", "sal", "new-alias", "nal"]);
var VARIABLE_VERBS = /* @__PURE__ */ new Set(["set-variable", "sv", "new-variable", "nv"]);
var BASH_SHELLS = /* @__PURE__ */ new Set(["bash", "sh", "zsh", "bash.exe"]);
var NESTED_SHELLS = /* @__PURE__ */ new Set(["cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe", "invoke-expression", "iex"]);
var WRITE_VERBS = /* @__PURE__ */ new Set([...CONTENT_VERBS, ...PATH_VERBS, ...RENAME_VERBS, ...COPY_VERBS, ...MOVE_VERBS]);
var BASH_COPY_VERBS = /* @__PURE__ */ new Set(["rsync", "install", "ln"]);
var BASH_WRITE_VERBS = /* @__PURE__ */ new Set(["cp", "mv", "rm", "rmdir", ...BASH_COPY_VERBS]);
var VALUE_PARAMS = [
  "path",
  "literalpath",
  "pspath",
  "filepath",
  "newname",
  "name",
  "destination",
  "outfile",
  "redirectstandardoutput",
  "redirectstandarderror",
  "redirectstandardinput",
  "variable",
  "value",
  "itemtype",
  "encoding",
  "stream",
  "filter",
  "include",
  "exclude",
  "credential",
  "delimiter",
  "width",
  "inputobject",
  "type",
  "target",
  "argumentlist",
  "uri",
  "method",
  "body",
  "headers",
  "pattern",
  "totalcount",
  "tail",
  "readcount",
  "depth",
  "culture",
  "erroraction",
  "warningaction",
  "informationaction",
  "progressaction",
  "errorvariable",
  "warningvariable",
  "informationvariable",
  "outvariable",
  "outbuffer",
  "pipelinevariable",
  "workingdirectory",
  "command",
  "scope",
  "option",
  "description",
  "propertytype",
  "property",
  "tosession",
  "fromsession",
  "executionpolicy",
  "childpath",
  "additionalchildpath"
];
var PARAM_ALIASES = { lp: "literalpath", fp: "filepath", rso: "redirectstandardoutput", rse: "redirectstandarderror", ea: "erroraction", wa: "warningaction", ev: "errorvariable", ov: "outvariable", ob: "outbuffer", pv: "pipelinevariable", wd: "workingdirectory", args: "argumentlist", wi: "whatif" };
var MUTATING_METHODS = /\.\s*(?:Delete|MoveTo|CopyTo|Replace|Encrypt|Decrypt|OpenWrite|AppendText|CreateText|Create|SetAccessControl)\s*\(/i;
var FILE_OBJECT_SOURCES = /(?:\[(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)\]::new\s*\(|New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)(?:\s+-ArgumentList)?|\[(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)\]|\b(?:Get-Item|gi|Get-ChildItem|gci|ls|dir)\b)/gi;
var MAX_SCAN = 4096;
var MAX_CALLS = 256;
var MAX_NESTED = 32;
function lex(command, { splitParens, subexprs }) {
  const segments = [];
  let tokens = [];
  let cur = null;
  let quote = null;
  let redirect = false;
  let listNext = false;
  const start = () => cur ??= { text: "", quoted: false, single: false };
  const flush = () => {
    if (cur === null) return;
    if (redirect) {
      cur.redirect = true;
      redirect = false;
    }
    if (listNext) {
      cur.list = true;
      listNext = false;
    }
    tokens.push(cur);
    cur = null;
  };
  const endSegment = (sep = ";") => {
    flush();
    redirect = false;
    listNext = false;
    if (tokens.length > 0) {
      tokens.sep = sep;
      segments.push(tokens);
    } else if (segments.length > 0 && sep === "|") {
      segments.at(-1).sep = "|";
    }
    tokens = [];
  };
  const subexpr = (from) => {
    if (subexprs.length > MAX_NESTED) {
      subexprs.push(String(subexprs.length));
      return from;
    }
    let depth = 0;
    for (let j = from; j < command.length && j - from < MAX_SCAN; j++) {
      if (command[j] === "(") depth++;
      if (command[j] === ")" && --depth === 0) {
        subexprs.push(command.slice(from + 1, j));
        return j;
      }
    }
    subexprs.push(command.slice(from + 1, Math.min(command.length, from + MAX_SCAN)));
    return from;
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'" && command[i + 1] === "'") {
        cur.text += "'";
        i++;
        continue;
      }
      if (ch === "'") {
        quote = null;
        continue;
      }
      cur.text += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === "`" && i + 1 < command.length) {
        cur.text += command[++i];
        continue;
      }
      if (ch === '"') {
        quote = null;
        continue;
      }
      if (ch === "$" && command[i + 1] === "(") {
        const end = subexpr(i + 1);
        cur.text += command.slice(i, end + 1);
        i = end;
        continue;
      }
      cur.text += ch;
      continue;
    }
    if (ch === "@" && (command[i + 1] === "'" || command[i + 1] === '"') && /^\r?\n/.test(command.slice(i + 2, i + 4))) {
      const close = command.indexOf(`
${command[i + 1]}@`, i + 2);
      const body = command.slice(i + 2, close < 0 ? command.length : close);
      if (command[i + 1] === '"') {
        for (let j = body.indexOf("$("); j >= 0; j = body.indexOf("$(", j + 2)) {
          let depth = 0;
          for (let k = j + 1; k < body.length && k - j < MAX_SCAN; k++) {
            if (body[k] === "(") depth++;
            if (body[k] === ")" && --depth === 0) {
              subexprs.push(body.slice(j + 2, k));
              break;
            }
          }
        }
      }
      flush();
      tokens.push({ text: body, quoted: true, single: command[i + 1] === "'" });
      i = close < 0 ? command.length : close + 2;
      continue;
    }
    if (ch === "<" && command[i + 1] === "#") {
      const close = command.indexOf("#>", i + 2);
      i = close < 0 ? command.length : close + 1;
      flush();
      continue;
    }
    if (ch === "#" && cur === null) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
      continue;
    }
    if (ch === "`") {
      if (command[i + 1] === "\n" || command[i + 1] === "\r" && command[i + 2] === "\n") {
        i += command[i + 1] === "\r" ? 2 : 1;
        flush();
        continue;
      }
      if (i + 1 < command.length) {
        start().text += command[++i];
        continue;
      }
    }
    if (ch === "'" || ch === '"') {
      const token = start();
      if (token.text === "") {
        token.quoted = true;
        token.single = ch === "'";
      }
      quote = ch;
      continue;
    }
    if (ch === ">") {
      if (cur !== null && !cur.quoted && /^(?:\d|\*)$/.test(cur.text)) cur = null;
      flush();
      while (command[i + 1] === ">") i++;
      if (command[i + 1] === "&") {
        i++;
        while (/\d/.test(command[i + 1] ?? "")) i++;
        continue;
      }
      redirect = true;
      continue;
    }
    if (ch === "$" && command[i + 1] === "{") {
      const close = command.indexOf("}", i + 2);
      const end = close < 0 ? command.length : close + 1;
      start().text += command.slice(i, end);
      i = end - 1;
      continue;
    }
    if (!splitParens && (ch === "(" || (ch === "@" || ch === "$") && command[i + 1] === "(")) {
      const open = ch === "(" ? i : i + 1;
      const sigil = ch === "(" ? "" : ch;
      const close = matchParen(command, open);
      const inner = command.slice(open + 1, close < 0 ? command.length : close);
      const items = sigil === "$" || cur !== null ? null : literalItems(inner);
      if (items) {
        items.forEach((item2, k) => {
          if (k > 0) listNext = true;
          cur = { text: item2.text, quoted: true, single: item2.single };
          flush();
        });
      } else {
        const token = start();
        token.text += `${sigil}(${inner})`;
        token.expr = true;
      }
      i = close < 0 ? command.length : close;
      continue;
    }
    if ((ch === "@" || ch === "$") && command[i + 1] === "(" && cur === null) continue;
    if ((ch === "\n" || ch === "\r") && listNext) continue;
    if (";|\n\r{}".includes(ch) || ch === "&" && command[i + 1] === "&") {
      if (ch === "|" && command[i + 1] === "|") {
        endSegment(";");
        i++;
        continue;
      }
      endSegment(ch === "|" ? "|" : ch === "{" || ch === "}" ? ch : ";");
      if (ch === "&") i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      endSegment(ch);
      continue;
    }
    if (ch === ",") {
      flush();
      listNext = true;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    start().text += ch;
  }
  endSegment();
  return segments;
}
function matchParen(command, open) {
  let depth = 0;
  let quote = null;
  for (let j = open; j < command.length; j++) {
    const c = command[j];
    if (quote !== null) {
      if (c === "`" && quote === '"') j++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return j;
  }
  return -1;
}
function literalItems(inner) {
  const parts = [];
  let quote = null;
  let cur = "";
  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    if (quote !== null) {
      if (c === "`" && quote === '"' && j + 1 < inner.length) {
        cur += c + inner[++j];
        continue;
      }
      if (c === quote && quote === "'" && inner[j + 1] === "'") {
        cur += "''";
        j++;
        continue;
      }
      if (c === quote) quote = null;
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    if (c === ",") {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  const quotedRe = /^'((?:[^']|'')*)'$|^"((?:[^"`$]|`.)*)"$/s;
  const items = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (part === "") return null;
    const pieces = part.split(/\s*\+\s*/);
    const texts = pieces.map((p) => quotedRe.exec(p));
    if (texts.every(Boolean)) {
      items.push({ text: texts.map((m) => m[1] !== void 0 ? m[1].replace(/''/g, "'") : m[2].replace(/`(.)/g, "$1")).join(""), single: texts.every((m) => m[1] !== void 0) });
    } else if (/^[^\s$()@'"`+]+$/.test(part)) {
      items.push({ text: part, single: true });
    } else {
      return null;
    }
  }
  return items;
}
function param(token) {
  if (token.quoted || !/^-[A-Za-z][\w-]*(?::.*)?$/s.test(token.text)) return null;
  const colon = token.text.indexOf(":");
  const raw = (colon < 0 ? token.text.slice(1) : token.text.slice(1, colon)).toLowerCase();
  const matches = VALUE_PARAMS.filter((p) => p.startsWith(raw));
  let name = PARAM_ALIASES[raw] ?? (VALUE_PARAMS.includes(raw) ? raw : matches.length === 1 ? matches[0] : raw);
  if (raw.length >= 2 && "whatif".startsWith(raw)) name = "whatif";
  return { name, takesValue: VALUE_PARAMS.includes(name), inline: colon < 0 ? null : token.text.slice(colon + 1) };
}
function varName(text) {
  const m = /^(?:\[[^\]]+\])*\$(?:\{([^}]+)\}|([\w:]+))$/.exec(text);
  return m ? `$${(m[1] ?? m[2]).toLowerCase()}` : null;
}
function assignmentOf(words) {
  if (words.length >= 2 && !words[0].quoted && varName(words[0].text) && words[1].text === "=" && !words[1].quoted) {
    return { name: varName(words[0].text), skip: 2 };
  }
  if (words.length >= 1 && !words[0].quoted && /=$/.test(words[0].text) && varName(words[0].text.slice(0, -1))) {
    return { name: varName(words[0].text.slice(0, -1)), skip: 1 };
  }
  if (words.length >= 1 && /^(?:\[[^\]]+\])*\$[\w:{}]+=./.test(words[0].text)) {
    const eq = words[0].text.indexOf("=");
    const name = varName(words[0].text.slice(0, eq));
    if (name) return { name, skip: 0, inline: { text: words[0].text.slice(eq + 1), quoted: words[0].quoted, single: words[0].single } };
  }
  return null;
}
function externalPaths(text) {
  return text.replace(/\$(?:\{env:(\w+)\}|env:(\w+)|home\b|\{home\})/gi, (m, a, b) => `/__outside__/${a ?? b ?? "home"}`).replace(/\$(?:\{pwd\}|pwd)(?:\.Path)?\b/gi, ".");
}
function append(list, items) {
  for (const item2 of items) list.push(item2);
}
function slash(path) {
  return path.replace(/\\/g, "/");
}
function isAbsolute(path) {
  const p = slash(path);
  return p.startsWith("/") || /^[A-Za-z]:\//.test(p) || /^[A-Za-z]+::/.test(p);
}
function parentJoin(source, name) {
  const norm = slash(source);
  const cut = norm.lastIndexOf("/");
  return cut < 0 ? name : `${norm.slice(0, cut)}/${name}`;
}
function baseName(path) {
  return slash(path).replace(/\/+$/, "").split("/").pop() ?? "";
}
function looksUnresolved(text) {
  return /\$/.test(text) || /^@?\(/.test(text);
}
var BOARD_HINT = /ACTIVE\.md|TASKS(?:_ARCHIVE)?\.md|TASKS_DEDUPE_LEDGER|status\.(?:log|d)|journal|(?:^|[\\/'"\s])\.local(?:[\\/'"\s]|$)/i;
function hintsBoard(text) {
  return BOARD_HINT.test(text);
}
function mergeConcat(words) {
  const out2 = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (words[i + 1] && !words[i + 1].quoted && words[i + 1].text === "+" && words[i + 2] && (w.quoted || words[i + 2].quoted)) {
      w = { ...w, text: w.text + words[i + 2].text, quoted: true, single: w.single && words[i + 2].single };
      i += 2;
    }
    out2.push(w);
  }
  return out2;
}
function commandTargets(tokens, state, out2, ctx) {
  const resolve4 = (token) => {
    if (token.single) {
      state.literals.add(token.text);
      return [token.text];
    }
    const name = varName(token.text);
    if (name && state.vars.has(name)) return state.vars.get(name);
    if (token.text.includes("$")) {
      return [externalPaths(token.text).replace(/\$(?:\{([^}]+)\}|([\w:]+))/g, (m, a, b) => state.vars.get(`$${(a ?? b).toLowerCase()}`)?.[0] ?? m)];
    }
    return [token.text];
  };
  const place = (target) => state.cwd === "" || isAbsolute(target) ? target : `${state.cwd}/${slash(target)}`;
  const push = (...targets) => {
    for (const t of targets) {
      if (looksUnresolved(t) && !state.literals.has(t)) out2.unresolved = true;
      if (/[*?[]/.test(t)) out2.globs.push(place(t));
      out2.targets.push(place(t));
    }
  };
  const contain = (...paths) => out2.containers.push(...paths.map(place));
  const assign = (name, value) => {
    state.vars.set(name, value);
    if (name === "$whatifpreference") state.whatIfAll = value.some((v2) => /^(?:\$?true|1)$/i.test(v2));
  };
  for (const t of tokens) if (t.redirect) push(...resolve4(t));
  let words = mergeConcat(tokens.filter((t) => !t.redirect));
  const assignment = assignmentOf(words);
  if (assignment) {
    if (assignment.inline) {
      assign(assignment.name, resolve4(assignment.inline));
      return;
    }
    const rest2 = words.slice(assignment.skip);
    if (rest2.length > 0 && rest2.every((t, i) => t.quoted || varName(t.text) || /^\$(?:true|false|null)$/i.test(t.text) || i > 0 && t.list)) {
      assign(assignment.name, rest2.flatMap(resolve4));
      return;
    }
    words = rest2;
  }
  let v = 0;
  let invoked = false;
  while (v < words.length && !words[v].quoted && (["&", "."].includes(words[v].text) || /^\[[^\]]+\]$/.test(words[v].text))) {
    if (["&", "."].includes(words[v].text)) invoked = true;
    v++;
  }
  if (v >= words.length) return;
  let verbText = words[v].text;
  if (varName(verbText)) {
    if (!invoked) return;
    const value = state.vars.get(varName(verbText));
    if (!value) {
      if (words.slice(v + 1).some((t) => hintsBoard(t.text))) out2.unresolved = true;
      return;
    }
    verbText = value[0];
  }
  let verb = verbText.toLowerCase().replace(/^.*[\\/]/, "");
  verb = state.aliases.get(verb) ?? verb;
  const rest = words.slice(v + 1).filter((t) => !(ctx.dialect === "bash" && !t.quoted && t.text === "--"));
  const groups = [];
  const named = /* @__PURE__ */ new Map();
  let whatIf = false;
  const takeList = (i, first) => {
    const group = [...first];
    while (rest[i + 1]?.list) group.push(...resolve4(rest[++i]));
    return [i, group];
  };
  for (let i = 0; i < rest.length; i++) {
    const p = param(rest[i]);
    let group;
    if (p === null) {
      [i, group] = takeList(i, resolve4(rest[i]));
      groups.push(group);
      continue;
    }
    if (p.name === "whatif") {
      const flag = p.inline === null ? "$true" : resolve4({ text: p.inline, quoted: false, single: false })[0];
      if (!/^(?:\$false|0|)$/i.test(flag)) whatIf = true;
      continue;
    }
    if (p.inline !== null && p.inline !== "") {
      [i, group] = takeList(i, resolve4({ text: p.inline, quoted: false, single: false }));
    } else if (p.inline === "" && rest[i + 1]) {
      i++;
      [i, group] = takeList(i, resolve4(rest[i]));
    } else if (p.inline === null && p.takesValue && rest[i + 1] && param(rest[i + 1]) === null) {
      i++;
      [i, group] = takeList(i, resolve4(rest[i]));
    } else {
      continue;
    }
    named.set(p.name, [...named.get(p.name) ?? [], ...group]);
  }
  const positional = (from = 0, to = groups.length) => groups.slice(from, to).flat();
  const values = (...names) => names.flatMap((n) => named.get(n) ?? []);
  if (ALIAS_VERBS.has(verb)) {
    const byName = values("name").length > 0;
    const name = values("name")[0] ?? positional(0, 1)[0];
    const value = values("value")[0] ?? positional(byName ? 0 : 1, byName ? 1 : 2)[0];
    if (name && value) state.aliases.set(name.toLowerCase(), value.toLowerCase().replace(/^.*[\\/]/, ""));
    return;
  }
  if (VARIABLE_VERBS.has(verb)) {
    const byName = values("name").length > 0;
    const name = values("name")[0] ?? positional(0, 1)[0];
    const value = values("value").length > 0 ? values("value") : positional(byName ? 0 : 1);
    if (name) assign(`$${name.replace(/^\$/, "").toLowerCase()}`, value);
    return;
  }
  if (LOCATION_VERBS.has(verb) || PUSH_VERBS.has(verb)) {
    const dir = values("path", "literalpath")[0] ?? positional(0, 1)[0];
    if (PUSH_VERBS.has(verb)) state.stack.push(state.cwd);
    if (dir) state.cwd = isAbsolute(dir) ? slash(dir) : state.cwd === "" ? slash(dir) : `${state.cwd}/${slash(dir)}`;
    return;
  }
  if (POP_VERBS.has(verb)) {
    state.cwd = state.stack.pop() ?? "";
    return;
  }
  if (whatIf || state.whatIfAll) return;
  push(...values("outfile", "redirectstandardoutput", "redirectstandarderror"));
  if (BASH_SHELLS.has(verb)) {
    const c = rest.findIndex((t) => !t.quoted && /^-[a-z]*c$/.test(t.text));
    if (c >= 0 && rest[c + 1]) out2.bash.push(...resolve4(rest[c + 1]));
    return;
  }
  if (verb === "wsl" || verb === "wsl.exe") {
    out2.bash.push(rest.flatMap(resolve4).join(" "));
    return;
  }
  if (NESTED_SHELLS.has(verb)) {
    const inner = rest.filter((t) => t.quoted || !/^[-/](?:c|k|command|noprofile|noninteractive|nologo|executionpolicy|bypass)$/i.test(t.text));
    out2.nested.push(inner.flatMap(resolve4).join(" "));
    return;
  }
  if (ctx.dialect === "bash" ? !BASH_WRITE_VERBS.has(verb) : !WRITE_VERBS.has(verb)) return;
  const piped = CONTENT_VERBS.has(verb) || verb === "clear-content" || verb === "clc" ? ctx.pipedObjects : ctx.piped;
  if (CONTENT_VERBS.has(verb)) {
    const explicit = values("path", "literalpath", "pspath", "filepath");
    const first = positional(0, 1);
    if (explicit.length === 0 && first.length === 0 && values("variable").length === 0) {
      push(...piped);
      contain(...piped);
    }
    push(...explicit, ...explicit.length > 0 || values("variable").length > 0 ? [] : first);
  } else if (PATH_VERBS.has(verb)) {
    let paths = [...values("path", "literalpath", "pspath"), ...positional()];
    if (paths.length === 0) {
      paths = piped;
      contain(...piped);
    }
    push(...paths);
    if (REMOVE_VERBS.has(verb)) contain(...paths);
    for (const name of values("name")) for (const p of paths.length > 0 ? paths : ["."]) push(`${slash(p).replace(/\/+$/, "")}/${name}`);
  } else if (RENAME_VERBS.has(verb)) {
    const explicit = values("path", "literalpath", "pspath");
    const fromPipe = explicit.length === 0 && values("newname").length > 0 && positional().length === 0;
    const sources = fromPipe ? piped : explicit.length > 0 ? explicit : positional(0, 1);
    const newNames = [...values("newname"), ...explicit.length > 0 || fromPipe ? positional(0, 1) : positional(1, 2)];
    push(...sources);
    contain(...sources);
    for (const s of sources) for (const n of newNames) push(parentJoin(s, n));
  } else if (COPY_VERBS.has(verb) || MOVE_VERBS.has(verb) || BASH_COPY_VERBS.has(verb)) {
    const explicit = values("path", "literalpath", "pspath");
    let sources;
    let destinations;
    if (ctx.dialect === "bash") {
      const all = positional();
      destinations = all.slice(-1);
      sources = all.slice(0, -1);
    } else {
      const fromPipe = explicit.length === 0 && (values("destination").length > 0 ? positional().length === 0 : positional().length <= 1);
      sources = fromPipe ? piped : explicit.length > 0 ? explicit : positional(0, 1);
      const free = explicit.length > 0 || fromPipe ? positional() : positional(1);
      destinations = values("destination").length > 0 ? values("destination") : free.slice(0, 1);
    }
    for (const d of destinations) for (const s of sources) out2.copies.push({ source: place(s), dest: place(d), dialect: ctx.dialect });
    push(...destinations);
    for (const d of destinations) for (const s of sources) push(`${slash(d).replace(/\/+$/, "")}/${baseName(s)}`);
    if (MOVE_VERBS.has(verb)) {
      push(...sources);
      contain(...sources);
    }
  }
}
function codeText(command) {
  const strings = [];
  let code = "";
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === "@" && (command[i + 1] === "'" || command[i + 1] === '"') && /^\r?\n/.test(command.slice(i + 2, i + 4))) {
      const close = command.indexOf(`
${command[i + 1]}@`, i + 2);
      code += " ";
      i = close < 0 ? command.length : close + 2;
      continue;
    }
    if (ch === "<" && command[i + 1] === "#") {
      const close = command.indexOf("#>", i + 2);
      code += " ";
      i = close < 0 ? command.length : close + 1;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(command[i - 1]))) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let text = "";
      let j = i + 1;
      for (; j < command.length; j++) {
        if (ch === "'" && command[j] === "'" && command[j + 1] === "'") {
          text += "'";
          j++;
          continue;
        }
        if (ch === '"' && command[j] === "`" && j + 1 < command.length) {
          text += command[++j];
          continue;
        }
        if (command[j] === ch) break;
        text += command[j];
      }
      code += `${strings.length}`;
      strings.push({ text, single: ch === "'" });
      i = j;
      continue;
    }
    if (ch === "`" && i + 1 < command.length) {
      code += command[++i];
      continue;
    }
    code += ch;
  }
  return { code, strings };
}
function balanced(code, open) {
  let depth = 0;
  const limit = Math.min(code.length, open + MAX_SCAN);
  for (let j = open; j < limit; j++) {
    if (code[j] === "(") depth++;
    if (code[j] === ")" && --depth === 0) return { args: code.slice(open + 1, j), end: j + 1 };
  }
  return { args: code.slice(open + 1, limit), end: limit };
}
function dotnetArgs(args2, strings, vars) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of args2) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((part) => {
    const p = part.trim().replace(/^\(+|\)+$/g, "").trim();
    const lit = /^\u0001(\d+)\u0001$/.exec(p);
    if (lit) {
      const s = strings[Number(lit[1])];
      if (!s.single && s.text.includes("$")) {
        const text = externalPaths(s.text);
        return { values: [text.replace(/\$(?:\{([^}]+)\}|([\w:]+))/g, (m, a, b) => vars.get(`$${(a ?? b).toLowerCase()}`)?.[0] ?? m)], literal: !/\$/.test(text) || [...text.matchAll(/\$(?:\{([^}]+)\}|([\w:]+))/g)].every((m) => vars.has(`$${(m[1] ?? m[2]).toLowerCase()}`)) };
      }
      return { values: [s.text], literal: true };
    }
    if (/^\$(?:\{?env:|\{?home\b|\{?pwd\b)/i.test(p)) return { values: [externalPaths(p)], literal: true };
    const name = varName(p);
    if (name && vars.has(name)) return { values: vars.get(name), literal: true };
    return { values: [p.replace(/\u0001(\d+)\u0001/g, (_, n) => strings[Number(n)].text)], literal: false };
  });
}
function readOnlyAccess(arg) {
  return arg !== void 0 && arg.values.some((v) => /^(?:\[(?:System\.)?IO\.FileAccess\]::)?Read$|^1$/i.test(v.trim()));
}
function capped(matches, out2) {
  const list = [];
  for (const m of matches) {
    if (list.length >= MAX_CALLS) {
      out2.unresolved = true;
      break;
    }
    list.push(m);
  }
  return list;
}
function dotnetTargets(command, vars, out2) {
  const { code, strings } = codeText(command);
  const want = (arg, kind = "targets") => {
    if (arg === void 0) return;
    if (!arg.literal) out2.unresolved = true;
    append(out2[kind], arg.values);
  };
  for (const m of capped(code.matchAll(/\[(?:System\.)?IO\.(File|Directory)\]::(\w+)\s*\(/gi), out2)) {
    const { args: args2 } = balanced(code, m.index + m[0].length - 1);
    const directory = m[1].toLowerCase() === "directory";
    const method = m[2].toLowerCase();
    const list = dotnetArgs(args2, strings, vars);
    if (directory) {
      if (method === "delete") want(list[0], "containers");
      else if (method === "move") {
        want(list[0], "containers");
        want(list[1]);
      } else if (/^create/.test(method)) want(list[0]);
      continue;
    }
    if (method === "copy") want(list[1]);
    else if (method === "move") {
      want(list[0]);
      want(list[1]);
    } else if (method === "replace") list.slice(0, 3).forEach((a) => want(a));
    else if (method === "open" && readOnlyAccess(list[2])) continue;
    else if (/^(?:write|append|create|delete|open(?!read|text)|set|encrypt|decrypt)/.test(method)) want(list[0]);
  }
  for (const m of capped(code.matchAll(/(?:\[(?:System\.)?IO\.(?:StreamWriter|FileStream)\]::new|New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:StreamWriter|FileStream)(?:\s+-ArgumentList)?)\s*\(/gi), out2)) {
    const { args: args2 } = balanced(code, m.index + m[0].length - 1);
    const list = dotnetArgs(args2, strings, vars);
    if (readOnlyAccess(list[2])) continue;
    want(list[0]);
  }
  for (const m of capped(code.matchAll(/New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:StreamWriter|FileStream)\s+(?:-ArgumentList\s+)?(\u0001\d+\u0001|\$[\w:{}]+)/gi), out2)) {
    want(dotnetArgs(m[1], strings, vars)[0]);
  }
  if (MUTATING_METHODS.test(code)) {
    for (const m of capped(code.matchAll(FILE_OBJECT_SOURCES), out2)) {
      const after = code.slice(m.index + m[0].length, m.index + m[0].length + MAX_SCAN);
      const arg = /^\s*\(?\s*(\u0001\d+\u0001|\$[\w:{}]+)/.exec(after) ?? /^\s+(?:-(?:Path|LiteralPath)\s+)?(\u0001\d+\u0001|\$[\w:{}]+)/i.exec(after);
      if (!arg) continue;
      const [first] = dotnetArgs(arg[1], strings, vars);
      want(first);
      want(first, "containers");
    }
    for (const m of capped(code.matchAll(/\.\s*(?:CopyTo|MoveTo)\s*\(/gi), out2)) {
      const { args: args2 } = balanced(code, m.index + m[0].length - 1);
      want(dotnetArgs(args2, strings, vars)[0]);
    }
  }
}
function joinPathArgs(args2) {
  return args2.trim().split(/\s+/).filter((a) => a !== "" && !/^-(?:path|childpath|additionalchildpath|resolve)$/i.test(a)).map((a) => a.replace(/^['"]|['"]$/g, "").replace(/[\\/]+$/, "")).join("/");
}
function literalAssignments(command) {
  return [...command.matchAll(/\$(\w+)\s*=\s*(['"])((?:(?!\2).)*)\2/g)].map((m) => ({ at: m.index, name: m[1].toLowerCase(), value: m[3] }));
}
function expand(command) {
  const assignments = literalAssignments(command);
  const valueAt = (name, at) => assignments.filter((a) => a.name === name && a.at < at).at(-1)?.value;
  const substitute = (text, at) => externalPaths(text).replace(/\$(\w+)/g, (m, n) => {
    const v = valueAt(n.toLowerCase(), at);
    return v === void 0 ? m : `'${v}'`;
  });
  let out2 = command;
  for (let round = 0; round < 8; round++) {
    const next = out2.replace(/\(\s*Join-Path\s+([^()|;\n]+?)\s*\)/gi, (m, args2, at) => `'${joinPathArgs(substitute(args2, at))}'`).replace(/(=\s*)Join-Path\s+([^()|;\n]+)/gi, (m, eq, args2, at) => `${eq}'${joinPathArgs(substitute(args2, at))}'`);
    if (next === out2) break;
    out2 = next;
  }
  const splats = /* @__PURE__ */ new Map();
  const addSplat = (name, text) => splats.set(name, [...splats.get(name) ?? [], text]);
  for (const m of out2.matchAll(/\$(\w+)\s*=\s*@\{([^{}]*)\}/g)) {
    const pairs = m[2].split(/[;\n]/).map((p) => /^\s*['"]?([A-Za-z]\w*)['"]?\s*=\s*(.+?)\s*$/.exec(p)).filter(Boolean);
    addSplat(m[1].toLowerCase(), pairs.map((p) => `-${p[1]} ${p[2]}`).join(" "));
  }
  for (const m of out2.matchAll(/\$(\w+)(?:\.(\w+)|\[\s*['"](\w+)['"]\s*\])\s*=\s*([^;\n|]+)/g)) {
    addSplat(m[1].toLowerCase(), `-${m[2] ?? m[3]} ${m[4].trim()}`);
  }
  for (const m of out2.matchAll(/\$(\w+)\s*=\s*@\(([^()]*)\)/g)) addSplat(m[1].toLowerCase(), m[2].replace(/,/g, " "));
  return out2.replace(/(^|[\s(])@(\w+)(?=$|[\s;|)])/g, (m, lead, name) => splats.has(name.toLowerCase()) ? `${lead}${splats.get(name.toLowerCase()).join(" ")}` : m);
}
var OBJECT_VERBS = /* @__PURE__ */ new Set(["get-item", "gi", "get-childitem", "gci", "ls", "dir", "resolve-path", "rvpa"]);
function emitsPathObjects(tokens) {
  const first = (tokens.find((t) => !/^\[[^\]]+\]$/.test(t.text))?.text ?? "").toLowerCase();
  return OBJECT_VERBS.has(first) || tokens.some((t) => /^(?:LiteralPath|Path|PSPath|FullName)=/i.test(t.text));
}
function pathish(tokens) {
  return tokens.map((t) => t.text.replace(/^[A-Za-z]\w*=/, "")).filter((t) => hintsBoard(t) || /[\\/]/.test(t));
}
function psTargets(command, { dialect = "powershell", depth = 0 } = {}) {
  const out2 = { targets: [], containers: [], globs: [], copies: [], bash: [], nested: [], unresolved: false };
  if (depth > 3) {
    append(out2.targets, command.split(/[\s'"`,;|()<>{}]+/));
    return out2;
  }
  const expanded = expand(command);
  const subexprs = [];
  let vars = /* @__PURE__ */ new Map();
  for (const splitParens of [true, false]) {
    const state = { vars: /* @__PURE__ */ new Map(), aliases: /* @__PURE__ */ new Map(), literals: /* @__PURE__ */ new Set(), cwd: "", stack: [], whatIfAll: false };
    let stmt = [];
    let stmtObjects = [];
    let afterPipe = false;
    for (const tokens of lex(expanded, { splitParens, subexprs })) {
      commandTargets(tokens, state, out2, { dialect, piped: afterPipe ? stmt : [], pipedObjects: afterPipe ? stmtObjects : [] });
      const paths = pathish(tokens);
      append(stmt, paths);
      if (emitsPathObjects(tokens)) append(stmtObjects, paths);
      if (tokens.sep === "|") afterPipe = true;
      else if (tokens.sep === ";") {
        stmt = [];
        stmtObjects = [];
        afterPipe = false;
      }
    }
    if (splitParens) vars = state.vars;
  }
  dotnetTargets(expanded, vars, out2);
  const inners = [.../* @__PURE__ */ new Set([...out2.nested, ...subexprs])];
  if (inners.length > MAX_NESTED) {
    out2.unresolved = true;
    append(out2.targets, command.split(/[\s'"`,;|()<>{}]+/));
    return out2;
  }
  for (const inner of inners) {
    const sub2 = psTargets(inner, { dialect: "powershell", depth: depth + 1 });
    for (const key of ["targets", "containers", "globs", "copies", "bash"]) append(out2[key], sub2[key]);
    out2.unresolved ||= sub2.unresolved;
  }
  return out2;
}

// src/tasks/boardShellGuard.ts
var BOARD_FILES = [
  ".local/tasks/ACTIVE.md",
  ".local/tasks/TASKS_ARCHIVE.md",
  ".local/tasks/status.log",
  ".local/tasks/status.d",
  ".local/tasks/journal",
  ".claude/TASKS.md",
  ".claude/TASKS_ARCHIVE.md",
  ".claude/journal",
  ".codex/TASKS.md",
  ".codex/TASKS_ARCHIVE.md",
  ".codex/journal"
];
var BOARD_MARKERS = ["active.md", "tasks.md", "tasks_archive.md", "tasks_dedupe_ledger.jsonl", "status.log", "status.d", "journal"];
var BOARD_DIR_MENTION = /(?:^|[\s'"`(=,\\/])\.local(?:[\\/]+tasks)?(?=$|[\s'"`),;|\\/*])/i;
var MAX_CHECKS = 32;
var MAX_PARSE = 1e6;
var ADVICE = "Use `/cyberine-taskboard:tasks add | status | set | deps | merge | archive` instead.";
function namesBoard(text) {
  const lower = text.toLowerCase();
  return BOARD_MARKERS.some((m) => lower.includes(m));
}
function mentionsBoard(text) {
  return namesBoard(text) || BOARD_DIR_MENTION.test(text);
}
function isAbsolute2(path) {
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path);
}
function relativeToCwd(target, cwd) {
  const base = normalBoardPath(cwd);
  const path = normalBoardPath(target);
  if (base === "" || path === "") return null;
  const abs = isAbsolute2(path) ? path : posix2.join(base, path);
  return { rel: posix2.relative(base.toLowerCase(), abs.toLowerCase()), up: posix2.relative(abs.toLowerCase(), base.toLowerCase()) };
}
function boardFilesUnder(container, cwd) {
  const where = relativeToCwd(container, cwd);
  if (where === null) return [];
  const coversAll = where.rel === "" || where.up.split("/")[0] !== "..";
  return BOARD_FILES.filter((file) => {
    if (!coversAll && !`${file.toLowerCase()}/`.startsWith(`${where.rel}/`)) return false;
    return existsSync2(join3(cwd, file));
  });
}
function globRegex(glob) {
  let re = "";
  for (const ch of glob) {
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else if (ch === "[" || ch === "]") re += ch;
    else re += ch.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}
function boardFilesMatching(glob, cwd) {
  const where = relativeToCwd(glob, cwd);
  if (where === null || where.rel.startsWith("..")) return [];
  let re;
  try {
    re = globRegex(where.rel);
  } catch {
    return boardFilesUnder(posix2.dirname(where.rel), cwd);
  }
  return BOARD_FILES.filter((file) => {
    const parts = file.toLowerCase().split("/");
    const hit = parts.some((_, i) => re.test(parts.slice(0, i + 1).join("/")));
    return hit && existsSync2(join3(cwd, file));
  });
}
function isDirectory(path, cwd) {
  try {
    const p = normalBoardPath(path);
    return statSync(isAbsolute2(p) ? p : join3(cwd, p)).isDirectory();
  } catch {
    return false;
  }
}
function copyContainers(copies, cwd) {
  const out2 = [];
  for (const { source, dest, dialect } of copies) {
    const src = String(source ?? "").replace(/\\/g, "/");
    const into = String(dest ?? "").replace(/[\\/]+$/, "");
    const named = `${into}/${posix2.basename(posix2.normalize(src))}`;
    if (!isDirectory(src, cwd) && !/\/\.?$/.test(src)) continue;
    if (dialect === "bash" && /\/\.?$/.test(src)) out2.push(into);
    if (dialect === "bash" && /\/\.$/.test(src)) continue;
    out2.push(named);
  }
  return out2;
}
function writtenBoardPaths(parsed, cwd) {
  const found = [
    ...parsed.targets,
    ...[...parsed.containers, ...copyContainers(parsed.copies ?? [], cwd)].flatMap((c) => boardFilesUnder(c, cwd)),
    ...parsed.globs.flatMap((g) => boardFilesMatching(g, cwd))
  ];
  const seen = /* @__PURE__ */ new Set();
  const out2 = [];
  for (const raw of found) {
    const t = normalBoardPath(raw);
    if (t === "" || seen.has(t) || !namesBoard(t)) continue;
    seen.add(t);
    const resolved = cwd !== "" && !isAbsolute2(t) ? posix2.join(normalBoardPath(cwd), t) : t;
    if (isBoardPath(t) || isBoardPath(resolved)) out2.push(t);
  }
  return out2;
}
function parseShell(command, dialect) {
  const coarse = (unresolved) => ({
    targets: command.split(/[\s'"`,;|()<>{}]+/),
    containers: [],
    globs: [],
    copies: [],
    bash: [],
    nested: [],
    unresolved
  });
  if (command.length > MAX_PARSE) return coarse(false);
  try {
    return psTargets(command, { dialect });
  } catch {
    return coarse(mentionsBoard(command));
  }
}
function refusal(tool, detail) {
  return { blocked: true, reason: `${tool} refused: ${detail}
${BOARD_RULE_QUOTE}
${ADVICE}` };
}
function decideWrites(tool, paths) {
  if (paths.length > MAX_CHECKS) return refusal(tool, "this command names more board paths than the guard can check; split it.");
  const hit = paths[0];
  if (hit === void 0) return { blocked: false };
  return refusal(tool, `this command writes ${posix2.basename(hit)}, a TaskBoard board file, and this session may only READ it.`);
}
function decideBashSnippets(tool, snippets) {
  for (const command of new Set(snippets)) {
    const res = boardGuardDecision({ tool_name: "Bash", tool_input: { command } });
    if (res.blocked) return { blocked: true, reason: (res.reason ?? "").replace(/^Bash refused:/, `${tool} refused:`) };
  }
  return { blocked: false };
}
function guardShell(tool, command, cwd, alsoBash) {
  const parsed = parseShell(command, "powershell");
  const snippets = alsoBash ? [command, ...parsed.bash] : parsed.bash;
  const bash = decideBashSnippets(tool, snippets);
  if (bash.blocked) return bash;
  const paths = [...writtenBoardPaths(parsed, cwd), ...alsoBash ? writtenBoardPaths(parseShell(command, "bash"), cwd) : []];
  const writes = decideWrites(tool, paths);
  if (writes.blocked) return writes;
  if (parsed.unresolved && mentionsBoard(command)) {
    return refusal(tool, "this command writes to a path the guard cannot work out before it runs, and it names a board path.");
  }
  return { blocked: false };
}
function guardBash(payload, command, cwd) {
  const first = boardGuardDecision(payload);
  if (first.blocked || !mentionsBoard(command)) return first;
  return decideWrites("Bash", writtenBoardPaths(parseShell(command, "bash"), cwd));
}
function decide(payload) {
  const tool = String(payload.tool_name ?? "");
  const command = String(payload.tool_input?.["command"] ?? "");
  const cwd = String(payload.cwd ?? "");
  if (tool === "PowerShell") return guardShell(tool, command, cwd, false);
  if (tool === "Monitor") return command === "" ? { blocked: false } : guardShell(tool, command, cwd, true);
  if (tool === "Bash") return guardBash(payload, command, cwd);
  return boardGuardDecision(payload);
}
function shellBoardGuardDecision(payload) {
  try {
    return decide(payload);
  } catch {
    if (!mentionsBoard(JSON.stringify(payload))) return { blocked: false };
    return refusal(String(payload.tool_name ?? "Tool"), "the guard could not check this call and the call names a board path.");
  }
}

// src/tasks/boardDrop.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, rmSync } from "node:fs";
import { join as join4 } from "node:path";
function listDeps(block) {
  const raw = (block.fields.get("deps") ?? "").trim();
  return !raw || raw === "-" ? [] : raw.split(/[,\s]+/).filter(Boolean);
}
function resolveIdPrefixSafe(candidate, ids) {
  try {
    return resolveIdPrefix(candidate, ids);
  } catch {
    return null;
  }
}
function planDrop(paths, rawIds) {
  const live = parseManifestBlocks(readFileSync2(paths.manifest, "utf8")).blocks;
  const archived = parseManifestBlocks(
    existsSync3(paths.archive) ? readFileSync2(paths.archive, "utf8") : ""
  ).blocks;
  const effective = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const knownIds = new Set([...live, ...archived].map((b) => b.id));
  const problems = [];
  const removals = [];
  for (const id of [...new Set(rawIds)]) {
    if (!KNOWN_HEADER_ID_RE.test(id)) {
      const guess = resolveIdPrefixSafe(id, knownIds);
      problems.push(guess ? `${id}: ids must be exact -- did you mean ${guess}?` : `${id}: ${malformedIdMessage(id)}`);
      continue;
    }
    const liveBlocks = live.filter((b) => b.id === id);
    const archiveBlocks = archived.filter((b) => b.id === id);
    if (liveBlocks.length === 0) {
      const hint = archiveBlocks.length > 0 ? "it is archived -- drop only removes live tasks" : "no such task on the live board";
      const guess = knownIds.has(id) ? null : resolveIdPrefixSafe(id, knownIds);
      problems.push(`${id}: ${hint}${guess ? ` (did you mean ${guess}?)` : ""}`);
      continue;
    }
    const status = effective.get(id) ?? liveBlocks[0].status;
    if (status === "done") {
      problems.push(`${id}: is [done] -- archive it to keep the record`);
      continue;
    }
    if (status === "forbidden") {
      problems.push(`${id}: is a [forbidden] tombstone that keeps save from re-adding it -- drop refuses a tombstone`);
      continue;
    }
    const briefPath = join4(paths.tasksDir, `${id}.md`);
    removals.push({
      id,
      title: liveBlocks[0].title,
      manifestBlocks: liveBlocks.length,
      briefs: existsSync3(briefPath) ? [briefPath] : []
    });
  }
  const removing = new Set(removals.map((r) => r.id));
  for (const b of live) {
    if (removing.has(b.id)) continue;
    for (const d of listDeps(b)) {
      if (removing.has(d)) {
        problems.push(`${d}: ${b.id} depends on it -- run \`/cyberine-taskboard:tasks deps set ${b.id} ...\` without ${d} first`);
      }
    }
    const dupOf = (b.fields.get("duplicate-of") ?? "").trim();
    if (dupOf && removing.has(dupOf)) {
      problems.push(`${dupOf}: ${b.id} is duplicate-of it -- drop ${b.id} in the same call`);
    }
  }
  if (problems.length > 0) {
    throw new BoardRejected(`drop: ${problems.join("\ndrop: ")}
drop: nothing removed`);
  }
  return removals;
}
function cutBlocks(src, ids) {
  const lines = src.split("\n");
  const targets = parseManifestBlocks(src).blocks.filter((b) => ids.has(b.id)).sort((x, y) => y.start - x.start);
  if (targets.length === 0) return { out: src, removed: 0 };
  const before = countAllHeaders(src);
  for (const b of targets) {
    const end = coreEnd(lines, b.start, b.end);
    lines.splice(b.start, end - b.start);
    while (b.start > 0 && lines[b.start - 1] === "" && lines[b.start] === "") lines.splice(b.start, 1);
  }
  if (countAllHeaders(lines.join("\n")) !== before - targets.length) {
    throw new Error(`drop: header-count guard failed while cutting ${[...ids].join(", ")}`);
  }
  let out2 = lines.join("\n");
  if (src.endsWith("\n\n") && out2.endsWith("\n") && !out2.endsWith("\n\n")) out2 += "\n";
  return { out: out2, removed: targets.length };
}
function applyDrop(paths, removals, reason) {
  const ids = new Set(removals.map((r) => r.id));
  if (ids.size === 0) return;
  if (removals.some((r) => r.manifestBlocks > 0)) {
    const { out: out2 } = cutBlocks(readFileSync2(paths.manifest, "utf8"), ids);
    writeFileAtomic(paths.manifest, out2, "drop");
  }
  for (const r of removals) {
    for (const brief of r.briefs) rmSync(brief, { force: true });
  }
  const ts = epochToLocalIso(Math.floor(Date.now() / 1e3));
  const events = removals.map((r) => {
    const ev = { ts, kind: "note", id: r.id, title: `dropped ${r.id}: ${r.title}`, by: agentTag() };
    if (reason) ev.body = reason;
    return ev;
  });
  appendJournalEvents(paths, events);
}
function describeDrop(r) {
  const parts = [];
  if (r.manifestBlocks) parts.push(`live block${r.manifestBlocks > 1 ? ` x${r.manifestBlocks}` : ""}`);
  if (r.briefs.length) parts.push(`${r.briefs.length} brief(s)`);
  const title = r.title ? ` "${r.title}"` : "";
  return `${r.id}${title}: ${parts.join(", ")} (journal keeps a \`dropped\` note)`;
}

// src/tasks/boardForget.ts
import { existsSync as existsSync4, readFileSync as readFileSync3, readdirSync, rmSync as rmSync2, unlinkSync as unlinkSync2 } from "node:fs";
import { join as join5 } from "node:path";
var DAY_FILE_RE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
function readIfExists(path) {
  return existsSync4(path) ? readFileSync3(path, "utf8") : "";
}
function jsonlLines(path) {
  return readIfExists(path).split("\n").filter((l) => l.trim()).map((raw) => {
    try {
      return { raw, ...JSON.parse(raw) };
    } catch {
      return { raw };
    }
  });
}
function journalFiles(journalDir) {
  if (!existsSync4(journalDir)) return [];
  return readdirSync(journalDir).filter((f) => DAY_FILE_RE.test(f)).sort().map((f) => join5(journalDir, f));
}
function resolveIdPrefixSafe2(candidate, ids) {
  try {
    return resolveIdPrefix(candidate, ids);
  } catch {
    return null;
  }
}
function planForget(paths, rawIds) {
  const live = parseManifestBlocks(readFileSync3(paths.manifest, "utf8")).blocks;
  const archived = parseManifestBlocks(readIfExists(paths.archive)).blocks;
  const knownIds = new Set([...live, ...archived].map((b) => b.id));
  const days = journalFiles(paths.journalDir).map((f) => ({ f, lines: jsonlLines(f) }));
  const ledger = jsonlLines(paths.ledger);
  const problems = [];
  const removals = [];
  for (const id of [...new Set(rawIds)]) {
    if (!KNOWN_HEADER_ID_RE.test(id)) {
      const guess = resolveIdPrefixSafe2(id, knownIds);
      problems.push(guess ? `${id}: ids must be exact -- did you mean ${guess}?` : `${id}: ${malformedIdMessage(id)}`);
      continue;
    }
    const liveBlocks = live.filter((b) => b.id === id);
    const archiveBlocks = archived.filter((b) => b.id === id);
    const briefs = [join5(paths.tasksDir, `${id}.md`), join5(paths.tasksDir, "archive", `${id}.md`)].filter(
      (p) => existsSync4(p)
    );
    const journal = /* @__PURE__ */ new Map();
    for (const { f, lines } of days) {
      const n = lines.filter((l) => l.id === id).length;
      if (n > 0) journal.set(f, n);
    }
    const ledgerHits = ledger.filter((l) => l.a === id || l.b === id).length;
    const title = (liveBlocks[0] ?? archiveBlocks[0])?.title ?? "";
    const traces = liveBlocks.length + archiveBlocks.length + briefs.length + journal.size + ledgerHits;
    if (traces === 0) {
      const guess = resolveIdPrefixSafe2(id, knownIds);
      problems.push(`${id}: no trace of this id on the board${guess ? ` (did you mean ${guess}?)` : ""}`);
      continue;
    }
    removals.push({
      id,
      title,
      manifestBlocks: liveBlocks.length,
      archiveBlocks: archiveBlocks.length,
      briefs,
      journal,
      ledger: ledgerHits
    });
  }
  const removing = new Set(removals.map((r) => r.id));
  for (const b of live) {
    if (removing.has(b.id)) continue;
    for (const d of listDeps(b)) {
      if (removing.has(d)) {
        problems.push(`${d}: ${b.id} depends on it -- run \`/cyberine-taskboard:tasks deps set ${b.id} ...\` without ${d} first`);
      }
    }
    const dupOf = (b.fields.get("duplicate-of") ?? "").trim();
    if (dupOf && removing.has(dupOf)) {
      problems.push(`${dupOf}: ${b.id} is duplicate-of it -- forget or drop ${b.id} in the same call`);
    }
  }
  if (problems.length > 0) {
    throw new BoardRejected(`forget: ${problems.join("\nforget: ")}
forget: nothing removed`);
  }
  return removals;
}
function rewriteJsonl(path, keep) {
  const lines = jsonlLines(path);
  const kept = lines.filter(keep);
  if (kept.length === lines.length) return;
  if (kept.length === 0) unlinkSync2(path);
  else writeFileAtomic(path, `${kept.map((l) => l.raw).join("\n")}
`, "forget");
}
function applyForget(paths, removals) {
  const ids = new Set(removals.map((r) => r.id));
  if (ids.size === 0) return;
  for (const day of new Set(removals.flatMap((r) => [...r.journal.keys()]))) {
    rewriteJsonl(day, (l) => !(l.id && ids.has(l.id)));
  }
  if (removals.some((r) => r.ledger > 0)) {
    rewriteJsonl(paths.ledger, (l) => !(l.a && ids.has(l.a) || l.b && ids.has(l.b)));
  }
  if (removals.some((r) => r.archiveBlocks > 0)) {
    const { out: out2 } = cutBlocks(readFileSync3(paths.archive, "utf8"), ids);
    writeFileAtomic(paths.archive, out2, "forget");
  }
  if (removals.some((r) => r.manifestBlocks > 0)) {
    const { out: out2 } = cutBlocks(readFileSync3(paths.manifest, "utf8"), ids);
    writeFileAtomic(paths.manifest, out2, "forget");
  }
  for (const r of removals) {
    for (const brief of r.briefs) rmSync2(brief, { force: true });
  }
}
function describeForget(r) {
  const parts = [];
  if (r.manifestBlocks) parts.push(`live block${r.manifestBlocks > 1 ? ` x${r.manifestBlocks}` : ""}`);
  if (r.archiveBlocks) parts.push(`archive block${r.archiveBlocks > 1 ? ` x${r.archiveBlocks}` : ""}`);
  if (r.briefs.length) parts.push(`${r.briefs.length} brief(s)`);
  const events = [...r.journal.values()].reduce((a, b) => a + b, 0);
  if (events) parts.push(`${events} journal event(s)`);
  if (r.ledger) parts.push(`${r.ledger} ledger entr${r.ledger > 1 ? "ies" : "y"}`);
  const title = r.title ? ` "${r.title}"` : "";
  return `${r.id}${title}: ${parts.join(", ")}`;
}

// src/tasks/boardBannerRun.ts
import { resolve as resolve2 } from "node:path";
function runBanner(args2, extra) {
  const cwdIdx = args2.indexOf("--cwd");
  const cwd = cwdIdx >= 0 && args2[cwdIdx + 1] ? resolve2(args2[cwdIdx + 1]) : process.cwd();
  let result = { banner: "", inputs: [] };
  try {
    result = boardBannerView(resolveBoard(cwd), cwd);
  } catch (error) {
    console.error("/cyberine-taskboard:tasks banner: board unreadable, staying silent:", error.message);
  }
  if (extra !== void 0) {
    const more = extra(cwd);
    const sep = result.banner === "" || result.banner.endsWith("\n") ? "" : "\n";
    const banner = more.lines.length > 0 ? `${result.banner}${sep}${more.lines.join("\n")}
` : result.banner;
    result = { banner, inputs: [...result.inputs, ...more.inputs] };
  }
  process.stdout.write(args2.includes("--json") ? `${JSON.stringify(result)}
` : result.banner);
}

// src/tasks/boardGroups.ts
var OWNER_WORD = /^(owner|operator)\b/i;
var DECIDE_TITLE = /^(owner|operator)\s*:\s*decide\b/i;
var PROVISION_TITLE = /^(owner|operator)\s*:\s*(provision|fund|supply|set\s*up)\b/i;
var DECISION_BLOCKER = /^(owner|operator)\s+decision\b|^(owner|operator)\s*:\s*decide\b/i;
var RESOURCE_WORD = /\b(keys?|tokens?|credentials?|secrets?|accounts?|tier|quota|funded|funding|subscription|licen[sc]e|domain|billing|api|seat|host)\b/i;
function classifyTodo(t, unmet) {
  const blocker = (t.blocker ?? "").trim();
  if (unmet.length > 0) return { group: "other", why: `waiting on deps: ${unmet.join(", ")}` };
  if (DECIDE_TITLE.test(t.title)) return { group: "decisions", why: "owner decision task" };
  if (DECISION_BLOCKER.test(blocker)) return { group: "decisions", why: "blocker is an owner decision" };
  if (PROVISION_TITLE.test(t.title)) return { group: "ownerResource", why: "owner provisions a resource" };
  if (blocker) {
    if (OWNER_WORD.test(blocker)) return { group: "ownerResource", why: "blocker is owner-only" };
    if (RESOURCE_WORD.test(blocker)) return { group: "ownerResource", why: "blocker names a resource" };
    return { group: "other", why: "blocker names no owner and no resource" };
  }
  if (t.exec === "manual") return { group: "ownerResource", why: "manual task, the owner runs it" };
  return { group: "runnable", why: "agent task, deps met, no blocker" };
}
function item(t, why, unmet) {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority ?? "",
    exec: t.exec ?? "",
    blocker: t.blocker ?? "",
    waitsOn: waitsOnOf(t.waitsOn) || null,
    unmet,
    path: t.path ?? "",
    why
  };
}
function groupBoard(scoped) {
  const { sets } = scoped;
  const groups = { runnable: [], ownerResource: [], decisions: [], backlog: [], other: [] };
  const todo = [...sets.runnable, ...sets.stillTodo, ...sets.waiting, ...sets.blocked];
  for (const t of todo) {
    const unmet = missingDeps(t, sets);
    const { group, why } = classifyTodo(t, unmet);
    groups[group].push(item(t, why, unmet));
  }
  for (const t of sets.backlog) groups.backlog.push(item(t, "status backlog", missingDeps(t, sets)));
  return groups;
}
function groupCounts(groups) {
  return {
    runnable: groups.runnable.length,
    ownerResource: groups.ownerResource.length,
    decisions: groups.decisions.length,
    backlog: groups.backlog.length,
    other: groups.other.length
  };
}
var TEXT_CAP = 12;
var BLOCKER_CAP = 110;
function clip(text) {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > BLOCKER_CAP ? `${one.slice(0, BLOCKER_CAP - 3)}...` : one;
}
function formatBoardGroups(groups, doing) {
  const counts = groupCounts(groups);
  const lines = [
    `${counts.runnable} agent-runnable | ${counts.ownerResource} waiting on owner resource | ${counts.decisions} owner decisions | ${counts.backlog} backlog | ${counts.other} other | ${doing} in-progress`
  ];
  const section = (title, list, line, cap) => {
    lines.push("", `${title} (${list.length}):`);
    if (list.length === 0) lines.push("  (none)");
    for (const i of list.slice(0, cap)) lines.push(`  ${line(i)}`);
    if (list.length > cap) lines.push(`  ... ${list.length - cap} more (next --groups --json lists all)`);
  };
  const plain = (i) => `${i.id}  ${i.title}${i.priority ? `  [${i.priority}]` : ""}`;
  const reason = (i) => `${i.id}  ${i.title}  -- ${i.blocker ? `blocker: ${clip(i.blocker)}${i.waitsOn ? `  (waits on: ${i.waitsOn})` : ""}` : i.why}`;
  section("Agent-runnable now", groups.runnable, plain, Infinity);
  section("Waiting on owner resource", groups.ownerResource, reason, Infinity);
  section("Owner decisions", groups.decisions, reason, Infinity);
  section("Backlog", groups.backlog, plain, TEXT_CAP);
  section("Other (held or queued, not owner work)", groups.other, (i) => `${i.id}  ${i.title}  -- ${i.why}`, TEXT_CAP);
  return lines.join("\n");
}

// src/tasks/boardJson.ts
var BOARD_STATUS_SCHEMA = "board-status/1";
var BOARD_NEXT_SCHEMA = "board-next/1";
function boardStatusJson(view, manifest) {
  const ready = new Set(view.ready.map((t) => t.id));
  const stale = new Set(view.stale.map((t) => t.id));
  const byEff = (eff) => view.tasks.filter((t) => t.eff === eff).length;
  return {
    schema: BOARD_STATUS_SCHEMA,
    manifest,
    scope: view.scope,
    hidden: view.hidden,
    unassigned: view.unassigned.map((t) => t.id),
    unreviewedDecisions: view.unreviewedDecisions,
    counts: {
      doing: byEff("doing"),
      todo: byEff("todo"),
      waiting: byEff("waiting"),
      blocked: byEff("blocked"),
      backlog: byEff("backlog"),
      done: byEff("done"),
      forbidden: byEff("forbidden"),
      unknown: byEff("unknown"),
      ready: ready.size,
      stale: stale.size,
      recurring: view.recurring.length,
      recurringDue: view.recurringDue,
      pending: view.pending,
      ownerActionable: view.ownerActionable.length,
      ownerWaiting: view.ownerWaiting.length
    },
    tasks: view.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      baseStatus: t.baseStatus,
      eff: t.eff,
      deps: t.deps,
      unmet: t.missing,
      blocker: t.blocker,
      waitsOn: t.waitsOn === "" ? null : t.waitsOn,
      reason: t.reason,
      duplicateOf: t.duplicateOf,
      path: t.path,
      owner: t.owner,
      created: t.created,
      ready: ready.has(t.id),
      stale: stale.has(t.id),
      exec: t.exec,
      source: t.source,
      verified: t.verified,
      default: t.default !== "" && t.default !== "-" ? t.default : null,
      undoCost: t.undoCost !== "" && t.undoCost !== "-" ? t.undoCost : null
    })),
    recurring: view.recurring.map((e) => ({
      id: e.id,
      title: e.title,
      state: e.state,
      days: e.days,
      every: e.every,
      lastDone: e.lastDone,
      exec: e.exec
    }))
  };
}
function boardNextJson(scoped, manifest, opts = {}) {
  const { sets } = scoped;
  const groups = opts.groups ? groupBoard(scoped) : null;
  return {
    schema: BOARD_NEXT_SCHEMA,
    manifest,
    scope: scoped.scope,
    hidden: scoped.hidden,
    unassigned: scoped.unassigned,
    counts: {
      done: sets.doneIds.size,
      runnable: sets.runnable.length,
      waiting: sets.blocked.length,
      blocked: sets.waiting.length,
      doing: sets.doing.length,
      backlog: sets.backlog.length,
      forbidden: sets.forbidden.length,
      duplicate: sets.duplicate.length
    },
    runnable: sets.runnable.map((t) => {
      const hops = depHops(t, sets.doneIds, sets.dupMap);
      return {
        id: t.id,
        title: t.title,
        priority: t.priority ?? "",
        deps: t.deps,
        ...Object.keys(hops).length > 0 && { depsVia: hops },
        path: t.path ?? ""
      };
    }),
    waiting: sets.blocked.map((t) => {
      const unmet = missingDeps(t, sets);
      return {
        id: t.id,
        title: t.title,
        unmet,
        cycles: unmet.filter((d) => resolveDuplicateOf(sets.dupMap, d).cycle)
      };
    }),
    blocked: sets.waiting.map((t) => ({ id: t.id, title: t.title, blocker: t.blocker ?? "", waitsOn: waitsOnOf(t.waitsOn) || null })),
    doing: sets.doing.map((t) => ({ id: t.id, title: t.title, path: t.path ?? "" })),
    ...groups && { groups: { counts: groupCounts(groups), ...groups } }
  };
}
function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}
`);
}

// src/tasks/boardHtml.ts
import { existsSync as existsSync5, readFileSync as readFileSync4 } from "node:fs";
import { basename as basename3, join as join6, relative } from "node:path";

// scripts/taskboard-bundle/packageRootStub.ts
import { dirname as dirname3, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
function packageRoot() {
  return resolve3(dirname3(fileURLToPath(import.meta.url)), "..");
}

// src/tasks/boardHtml.ts
var TEMPLATE_NAME = "tasks-board.html";
var DEFAULT_ARCHIVE_RECENT = 50;
var DEFAULT_JOURNAL_DAYS = 14;
function daysBetween(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 864e5));
}
function readAttempts(briefPath) {
  if (!existsSync5(briefPath)) return [];
  const lines = readFileSync4(briefPath, "utf8").split("\n");
  const out2 = [];
  let inAttempts = false;
  for (const line of lines) {
    if (/^##\s+Attempts\s*$/.test(line)) {
      inAttempts = true;
      continue;
    }
    if (inAttempts && /^##\s/.test(line)) break;
    if (inAttempts && /^\s*-\s+/.test(line)) out2.push(line.replace(/^\s*-\s+/, "").trim());
  }
  return out2;
}
function archiveEntries(paths, recent) {
  if (!existsSync5(paths.archive) || recent <= 0) return [];
  const blocks = parseManifestBlocks(readFileSync4(paths.archive, "utf8"), TASK_ID_RE).blocks;
  return blocks.slice(-recent).reverse().map((b) => ({
    id: b.id,
    title: b.title,
    area: (b.fields.get("area") ?? "").trim(),
    evidence: (b.fields.get("evidence") ?? "").trim()
  }));
}
function journalDays(paths, limit) {
  if (limit <= 0) return [];
  const days = listJournalDaysFolded(paths).slice(-limit).reverse();
  return days.map((date) => {
    const events = readJournalDayFolded(paths, date);
    return { date, title: deriveDayTitle(events), events };
  });
}
function buildBoardData(paths, opts = {}) {
  const src = readFileSync4(paths.manifest, "utf8");
  const view = boardView(paths, paths.root, true);
  const byId = new Map(view.all.map((t) => [t.id, t]));
  const blocks = parseManifestBlocks(src, TASK_ID_RE).blocks.filter((b) => b.status !== "recurring");
  const today = todayLocalDate();
  const tasks = blocks.map((b, pos) => {
    const v = byId.get(b.id);
    const f = (k) => (b.fields.get(k) ?? "").trim();
    const depsRaw = f("deps");
    const deps = depsRaw && depsRaw !== "-" ? depsRaw.split(/[,\s]+/).filter(Boolean) : [];
    const created = f("created");
    const briefPath = join6(paths.tasksDir, `${b.id}.md`);
    const hasBrief = existsSync5(briefPath);
    return {
      id: b.id,
      pos,
      status: v?.status ?? (b.status ?? "unknown"),
      eff: v?.eff ?? (b.status ?? "unknown"),
      title: b.title,
      do: f("do"),
      doneWhen: f("done-when"),
      why: f("why"),
      reason: f("reason"),
      blocker: f("blocker") === "-" ? "" : f("blocker"),
      evidence: f("evidence"),
      deps,
      unmet: v?.missing ?? [],
      model: f("model"),
      exec: f("exec"),
      priority: f("priority") || "p1",
      area: f("area"),
      path: f("path") === "-" ? "" : f("path"),
      created,
      createdBy: f("created-by"),
      from: f("from"),
      age: created ? daysBetween(created, today) : null,
      owner: v?.owner ?? "",
      attempts: hasBrief ? readAttempts(briefPath) : [],
      brief: hasBrief ? `tasks/${b.id}.md` : ""
    };
  });
  return {
    meta: {
      repo: basename3(paths.root),
      manifest: paths.manifest.startsWith(paths.root) ? relative(paths.root, paths.manifest) : paths.manifest,
      generated: today,
      root: paths.root
    },
    tasks,
    recurring: recurringEntries(src),
    archive: archiveEntries(paths, opts.archiveRecent ?? DEFAULT_ARCHIVE_RECENT),
    journal: journalDays(paths, opts.journalDays ?? DEFAULT_JOURNAL_DAYS)
  };
}
function boardTemplatePath() {
  return join6(packageRoot(), "templates", TEMPLATE_NAME);
}
function renderBoardHtml(data) {
  const templatePath = boardTemplatePath();
  if (!existsSync5(templatePath)) {
    throw new Error(`/cyberine-taskboard:tasks board: template missing at ${templatePath}`);
  }
  const template = readFileSync4(templatePath, "utf8");
  if (!template.includes("__DATA__") || !template.includes("<title>__TITLE__</title>")) {
    throw new Error(`/cyberine-taskboard:tasks board: template ${templatePath} is missing its __TITLE__ or __DATA__ slot`);
  }
  const json = JSON.stringify(data).replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");
  const title = `${data.meta.repo} \xB7 /cyberine-taskboard:tasks`.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  return template.replace("<title>__TITLE__</title>", () => `<title>${title}</title>`).replace("__DATA__", () => json);
}

// src/tasks/boardStatusExtras.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync2, readFileSync as readFileSync5 } from "node:fs";
import { dirname as dirname4, relative as relative2 } from "node:path";
function duplicateTarget(manifest, id) {
  const map = /* @__PURE__ */ new Map();
  for (const block of parseManifestBlocks(readFileSync5(manifest, "utf8")).blocks) {
    const target2 = block.fields.get("duplicate-of")?.trim();
    if (target2 && target2 !== "-") map.set(block.id, target2);
  }
  if (!map.has(id)) return null;
  let target = id;
  const seen = /* @__PURE__ */ new Set();
  while (map.has(target)) {
    if (seen.has(target)) return { target, cycle: true };
    seen.add(target);
    target = map.get(target);
  }
  return { target, cycle: false };
}
function appendAttempt(briefPath, reason) {
  const entry = `- ${todayLocalDate()}: ${reason}`;
  const src = existsSync6(briefPath) ? readFileSync5(briefPath, "utf8") : "";
  const lines = src.endsWith("\n") ? src.slice(0, -1).split("\n") : src ? src.split("\n") : [];
  const start = lines.findIndex((line) => line.trim() === "## Attempts");
  if (start === -1) {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push("## Attempts", entry);
  } else {
    let end = start + 1;
    while (end < lines.length && !/^## /.test(lines[end])) end++;
    lines.splice(end, 0, entry);
  }
  mkdirSync2(dirname4(briefPath), { recursive: true });
  writeFileAtomic(briefPath, `${lines.join("\n")}
`, "tmp");
}
function stampPaths(manifest, root, cwd, ids) {
  if (cwd === root) return;
  const path = relative2(root, cwd);
  if (!path || path.startsWith("..")) return;
  const src = readFileSync5(manifest, "utf8");
  let lines = src.endsWith("\n") ? src.slice(0, -1).split("\n") : src.split("\n");
  let changed = false;
  for (const id of ids) {
    const range = blockRange(lines, id);
    if (!range || lines.slice(range.start + 1, range.end).some((line) => /^path:(\s|$)/.test(line))) continue;
    let index = range.start + 1;
    for (let i = range.start + 1; i < range.end; i++) {
      const field = /^([a-z][a-z-]*):/.exec(lines[i])?.[1];
      if (field && SET_ORDER.indexOf(field) !== -1 && SET_ORDER.indexOf(field) < SET_ORDER.indexOf("path")) index = i + 1;
    }
    lines = [...lines.slice(0, index), `path: ${path}`, ...lines.slice(index)];
    changed = true;
  }
  if (changed) writeFileAtomic(manifest, `${lines.join("\n")}
`, "tmp");
}
var REASON_LINE_RE = /^reason:(\s|$)/;
function setForbiddenReason(manifest, id, reason) {
  const src = readFileSync5(manifest, "utf8");
  const lines = src.endsWith("\n") ? src.slice(0, -1).split("\n") : src.split("\n");
  const block = parseManifestBlocks(lines.join("\n")).blocks.find((b) => b.id === id);
  if (!block) throw new Error(`no such task: ${id}`);
  if (block.status !== "forbidden") {
    throw new Error(`${id}: header still reads [${block.status ?? ""}] after reconcile -- reason: not written`);
  }
  const fenced = fencedLineFlags(lines);
  const kept = lines.filter((l, i) => i <= block.start || i >= block.end || fenced[i] || !REASON_LINE_RE.test(l));
  kept.splice(block.start + 1, 0, `reason: ${reason}`);
  writeFileAtomic(manifest, `${kept.join("\n")}
`, "tmp");
}
function forbiddenIdsMissingReason(manifest, ids) {
  const blocks = parseManifestBlocks(readFileSync5(manifest, "utf8")).blocks;
  return ids.filter((id) => !blocks.find((b) => b.id === id)?.fields.get("reason")?.trim());
}

// src/tasks/boardNote.ts
import { existsSync as existsSync7, readFileSync as readFileSync6 } from "node:fs";
var FLAG_RE = /^--?[A-Za-z]/;
function resolveLiveTaskId(paths, rawId, cmd) {
  if (RECURRING_ID_RE.test(rawId)) {
    throw new BoardRejected(`${cmd}: ${rawId} is a recurring block -- ${cmd} only annotates task blocks`);
  }
  const { blocks } = parseManifestBlocks(readFileSync6(paths.manifest, "utf8"));
  const live = new Set(blocks.filter((b) => TASK_ID_RE.test(b.id)).map((b) => b.id));
  const archived = archivedIds(paths.archive);
  let id;
  try {
    id = resolveIdPrefix(rawId, /* @__PURE__ */ new Set([...live, ...archived]));
  } catch (e) {
    if (e instanceof AmbiguousIdError) throw new BoardRejected(`${cmd}: ${e.message}`);
    throw e;
  }
  if (id === null) {
    throw new BoardRejected(
      `${cmd}: no such task: ${rawId}${TASK_ID_RE.test(rawId) ? "" : ` (${malformedIdMessage(rawId)})`}`
    );
  }
  if (!live.has(id)) throw new BoardRejected(`${cmd}: ${id} is archived -- only live tasks take notes`);
  const effective = fold(paths.manifest, paths).find((t) => t.id === id)?.status;
  if (effective === "forbidden") throw new BoardRejected(`${cmd}: ${id} is [forbidden] -- tombstone, refusing`);
  return id;
}
function parseIdAndText(args2, cmd, usage) {
  const bad = args2.find((a) => FLAG_RE.test(a));
  if (bad) throw new BoardRejected(`${cmd}: unknown flag: ${bad}

${usage}`);
  const [rawId, ...rest] = args2;
  const text = collapseWhitespace(rest.join(" "));
  if (!rawId || !text) throw new BoardRejected(usage);
  return { rawId, text };
}
function isTrailing(line) {
  const t = line.trim();
  return t === "" || /^<!--.*-->$/.test(t);
}
function appendUpdateLine(manifest, id, text, date = todayLocalDate()) {
  const src = readFileSync6(manifest, "utf8");
  const lines = src.endsWith("\n") ? src.split("\n").slice(0, -1) : src.split("\n");
  const block = parseManifestBlocks(lines.join("\n")).blocks.find((b) => b.id === id);
  if (!block) throw new BoardRejected(`note: no such task: ${id}`);
  let at = block.end;
  while (at > block.start + 1 && isTrailing(lines[at - 1])) at--;
  const line = `update ${date}: ${text}`;
  lines.splice(at, 0, line);
  writeFileAtomic(manifest, `${lines.join("\n")}
`, "tmp");
  return line;
}
var UPDATES_HEADING = "## Updates";
function addBriefUpdate(briefPath, text, date = todayLocalDate()) {
  if (!existsSync7(briefPath)) {
    throw new BoardRejected(
      `brief note: no brief at ${briefPath} -- nothing to annotate; use \`note <id>\` for the manifest block`
    );
  }
  const src = readFileSync6(briefPath, "utf8");
  const lines = src.endsWith("\n") ? src.split("\n").slice(0, -1) : src.split("\n");
  const fenced = fencedLineFlags(lines);
  const isHeading = (i) => !fenced[i] && /^## /.test(lines[i]);
  const entry = `- ${date}: ${text}`;
  const h = lines.findIndex((l, i) => !fenced[i] && l.trim() === UPDATES_HEADING);
  if (h !== -1) {
    let end = h + 1;
    while (end < lines.length && !isHeading(end)) end++;
    let at = end;
    while (at > h + 1 && lines[at - 1].trim() === "") at--;
    lines.splice(at, 0, entry);
  } else {
    const first = lines.findIndex((_, i) => isHeading(i));
    if (first === -1) {
      if (lines.length > 0 && lines[lines.length - 1].trim() !== "") lines.push("");
      lines.push(UPDATES_HEADING, entry);
    } else {
      const block = [UPDATES_HEADING, entry, ""];
      if (first > 0 && lines[first - 1].trim() !== "") block.unshift("");
      lines.splice(first, 0, ...block);
    }
  }
  writeFileAtomic(briefPath, `${lines.join("\n")}
`, "tmp");
  return entry;
}

// src/tasks/boardSuggest.ts
import { existsSync as existsSync8, readFileSync as readFileSync7 } from "node:fs";

// scripts/taskboard-bundle/boardSurfaceStub.ts
var FLEET_DISPATCH = false;

// src/tasks/boardSuggest.ts
function suggestReport(paths, cwd) {
  const lines = [];
  const hasManifest = existsSync8(paths.manifest);
  const draftCount = draftNames(paths.draftsDir).length;
  let todoCount = 0;
  let doneCount = 0;
  let recurDue = 0;
  let tidyCandidates = 0;
  let dispatchableCount = 0;
  let manualCount = 0;
  let worst = null;
  let healthSection = [];
  lines.push("State:");
  if (hasManifest) {
    const src = readFileSync7(paths.manifest, "utf8");
    const view = boardView(paths, cwd, false);
    const doingCount = view.doing.length;
    todoCount = view.todo.length + view.blocked.length;
    doneCount = view.done.length;
    const backlogCount = view.backlog.length;
    const forbiddenCount = view.forbidden.length;
    recurDue = view.recurringDue;
    tidyCandidates = findCandidates(src).length;
    const overdue = view.recurring.filter((e) => e.state !== "OK");
    const dispatchable = overdue.filter((e) => e.exec !== "");
    const manual = overdue.filter((e) => e.exec === "");
    dispatchableCount = dispatchable.length;
    manualCount = manual.length;
    if (manual.length) {
      const worstManual = manual.slice().sort((a, b) => a.state === "NEW" ? -1 : b.state === "NEW" ? 1 : b.days - a.days)[0];
      worst = { id: worstManual.id, note: worstManual.state === "NEW" ? "never run" : `${worstManual.days}d overdue` };
    }
    const fcNote = forbiddenCount > 0 ? `  forbidden=${forbiddenCount}` : "";
    lines.push(
      `  manifest : ${paths.manifest}  (doing=${doingCount}  todo=${todoCount}  backlog=${backlogCount}  done=${doneCount}${fcNote}  recurring-due=${recurDue})`
    );
    healthSection = healthLines(view);
  } else {
    lines.push("  manifest : none");
  }
  lines.push(`  drafts   : ${draftCount} unmerged`);
  lines.push("  hook     : not-applicable");
  lines.push("");
  if (healthSection.length) {
    lines.push("Board health:");
    lines.push(...healthSection);
    lines.push("");
  }
  if (!hasManifest && draftCount === 0) {
    lines.push("Suggest: init");
    lines.push("  No manifest and no drafts -- start here.");
  } else if (!hasManifest && draftCount > 0) {
    lines.push("Suggest: init  ->  gather");
    lines.push("  Drafts waiting but no manifest yet -- init first, then gather them into the manifest.");
  } else if (hasManifest && draftCount > 0) {
    lines.push("Suggest: gather");
    lines.push(`  ${draftCount} draft(s) not yet merged into the manifest.`);
  } else if (hasManifest && tidyCandidates > 0) {
    lines.push("Suggest: tidy");
    lines.push(
      `  ${tidyCandidates} task(s) look like old-style forbidden workarounds (FORBIDDEN in title/blocker) -- tidy migrates them to [forbidden].`
    );
  } else if (hasManifest && doneCount >= 10) {
    lines.push("Suggest: archive");
    lines.push(`  ${doneCount} done task(s) -- archive them to keep the manifest clean.`);
  } else if (hasManifest && todoCount > 0 && FLEET_DISPATCH) {
    lines.push("Suggest: run");
    lines.push(`  ${todoCount} task(s) todo -- emit dispatch plan and fan out.`);
  } else if (hasManifest && todoCount > 0) {
    lines.push("Suggest: next");
    lines.push(`  ${todoCount} task(s) todo -- next lists what is runnable; move one to doing and work it.`);
  } else if (hasManifest && recurDue > 0) {
    if (FLEET_DISPATCH && dispatchableCount > 0) {
      lines.push("Suggest: run");
      lines.push(
        `  ${dispatchableCount} overdue recurring task(s) opted into exec: -- dispatchable now via run; see Board health above for the manual split.`
      );
    } else {
      lines.push("Suggest: status  (then run the due recurring task, then status did <Rxx>)");
      lines.push(`  ${manualCount} recurring task(s) due, none opted into exec: -- still manual; see Board health above.`);
      if (worst) lines.push(`  worst: ${worst.id} (${worst.note})`);
    }
  } else {
    lines.push("Suggest: status");
    lines.push("  Everything looks current -- review the manifest.");
  }
  return lines;
}

// src/commands/boardIo.ts
function out(s) {
  process.stdout.write(`${s}
`);
}
function warn(s) {
  process.stderr.write(`${s}
`);
}
function refuse(msg) {
  warn(msg);
  process.exit(2);
}

// scripts/taskboard-bundle/tasksBoardFleetStub.ts
var FLEET_USAGE = "";
var END_LINES = `  end [--force]                             Gate on pending drafts, reconcile, archive every
                                            [done] task (no threshold), print the board
`;
var END_USAGE = `usage: /cyberine-taskboard:tasks end [--force]

  end                    gate on pending drafts, reconcile, archive every [done] task, print the board
  end --force            wrap even with drafts pending (they stay in the inbox)`;
function consumeEndHandoffArg() {
  return -1;
}
function checkEndHandoffOptions() {
}
function readEndHandoffSeed() {
  return null;
}
function finishEndHandoff() {
}
function runFleetSubcommand() {
  return false;
}
function promoteAfterWrite() {
}
function warnDemotedWouldRepromote() {
}

// src/tasks/boardMove.ts
import { readFileSync as readFileSync8 } from "node:fs";
var MoveRejected = class extends Error {
};
function fail(msg) {
  throw new MoveRejected(`move: ${msg}`);
}
function coreEnd2(lines, start, end) {
  let e = end;
  while (e > start + 1) {
    const t = lines[e - 1].trim();
    if (t === "" || /^<!--.*-->$/.test(t)) e--;
    else break;
  }
  return e;
}
var ALL_HEADER_RE = new RegExp(`^## (?:${TASK_ID_SOURCE}|${RECURRING_ID_SOURCE})\\b`);
function countAllHeaders2(lines) {
  const fenced = fencedLineFlags(lines);
  return lines.filter((l, i) => !fenced[i] && ALL_HEADER_RE.test(l)).length;
}
function resolveId(blocks, archiveIds, effectiveStatus, id, role) {
  const label = role === "anchor" ? `anchor ${id}` : id;
  if (!TASK_ID_RE.test(id) && !RECURRING_ID_RE.test(id)) {
    fail(`${label}: ${malformedIdMessage(id)}`);
  }
  const b = blocks.find((bl) => bl.id === id);
  if (!b) {
    if (archiveIds.has(id)) {
      fail(`${label} is archived -- archived tasks are not part of live ordering, nothing to move`);
    }
    const known = blocks.map((bl) => bl.id).join(", ") || "(none)";
    fail(`${label} not found in manifest or archive -- known ids: ${known}`);
  }
  if (RECURRING_ID_RE.test(id)) {
    fail(`${label} is a recurring block -- move only relocates task (T##/k####) blocks; the recurring region is fixed territory`);
  }
  const st = effectiveStatus.get(id) ?? b.status ?? "";
  if (st === "forbidden") {
    fail(`${label} is [forbidden] -- permanent tombstone, fixed territory, refusing to move`);
  }
  return b;
}
function moveTask(paths, moveId, position, anchorId) {
  if (moveId === anchorId) fail(`cannot move ${moveId} relative to itself`);
  const manifestSrc = readFileSync8(paths.manifest, "utf8");
  const lines = manifestSrc.split("\n");
  const { blocks } = parseManifestBlocks(manifestSrc);
  const archiveIds = archiveIdsFor(paths.manifest);
  const effectiveStatus = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const xBlock = resolveId(blocks, archiveIds, effectiveStatus, moveId, "move");
  resolveId(blocks, archiveIds, effectiveStatus, anchorId, "anchor");
  const before = countAllHeaders2(lines);
  const xCoreEnd = coreEnd2(lines, xBlock.start, xBlock.end);
  const movedCore = lines.slice(xBlock.start, xCoreEnd);
  const workLines = [...lines];
  workLines.splice(xBlock.start, xCoreEnd - xBlock.start);
  while (workLines[xBlock.start - 1] === "" && workLines[xBlock.start] === "") {
    workLines.splice(xBlock.start, 1);
  }
  const anchorBlock = parseManifestBlocks(workLines.join("\n")).blocks.find((b) => b.id === anchorId);
  if (!anchorBlock) {
    fail(`internal: anchor ${anchorId} vanished after removing ${moveId} -- refusing, nothing written`);
  }
  const insertAt = position === "before" ? anchorBlock.start : coreEnd2(workLines, anchorBlock.start, anchorBlock.end);
  const toInsert = position === "before" ? [...movedCore, ""] : ["", ...movedCore];
  workLines.splice(insertAt, 0, ...toInsert);
  const out2 = workLines.join("\n");
  if (out2.trim().length === 0 || countAllHeaders2(workLines) !== before) {
    fail("refused -- header-count guard failed, manifest left untouched");
  }
  writeFileAtomic(paths.manifest, out2, "move");
  return `${moveId} -> ${position} ${anchorId}`;
}

// src/tasks/boardComments.ts
import { readFileSync as readFileSync9 } from "node:fs";
var CommentsRejected = class extends Error {
};
function fail2(msg) {
  throw new CommentsRejected(`comments: ${msg}`);
}
var COMMENT_RE = /^<!--.*-->$/;
var ID_TOKEN_RE = new RegExp(`(?<![A-Za-z0-9])${TASK_ID_SOURCE}(?![A-Za-z0-9])`, "g");
var MANAGED_MARKERS = ["Status tokens:", "can lag the overlay", "permanent tombstones (", "(board tidy)", "tasks tidy)"];
function isManaged(text) {
  return MANAGED_MARKERS.some((m) => text.includes(m));
}
function commentsIn(src) {
  const lines = src.split("\n");
  const fenced = fencedLineFlags(lines);
  const { blocks } = parseManifestBlocks(src);
  const liveIds = new Set(blocks.map((b) => b.id));
  const outside = new Array(lines.length).fill(false);
  const firstStart = blocks.length ? Math.min(...blocks.map((b) => b.start)) : lines.length;
  for (let i = 0; i < firstStart; i++) outside[i] = true;
  for (const b of blocks) {
    for (let i = coreEnd2(lines, b.start, b.end); i < b.end && i < lines.length; i++) outside[i] = true;
  }
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (!outside[i] || fenced[i]) continue;
    const text = lines[i];
    if (!COMMENT_RE.test(text.trim())) continue;
    const ids = [...new Set(text.match(ID_TOKEN_RE) ?? [])];
    const live = ids.filter((id) => liveIds.has(id));
    found.push({
      line: i + 1,
      text,
      ids,
      liveIds: live,
      staleIds: ids.length > 0 && live.length === 0,
      managed: isManaged(text)
    });
  }
  return found;
}
function listBoardComments(paths) {
  return commentsIn(readFileSync9(paths.manifest, "utf8"));
}
function planCommentDrop(src, lineNumbers) {
  if (lineNumbers.length === 0) fail2("name at least one line number to drop");
  const byLine = new Map(commentsIn(src).map((c) => [c.line, c]));
  const lines = src.split("\n");
  const lineCount = src.endsWith("\n") ? lines.length - 1 : lines.length;
  const wanted = [...new Set(lineNumbers)].sort((a, b) => a - b);
  const dropped = [];
  for (const n of wanted) {
    if (!Number.isInteger(n) || n < 1 || n > lineCount) fail2(`line ${n} is outside the manifest (1-${lineCount}) -- nothing written`);
    const c = byLine.get(n);
    if (!c) {
      fail2(`line ${n} is not a droppable comment (only single-line <!-- ... --> comments outside task blocks and code fences): ${lines[n - 1].slice(0, 120)} -- nothing written`);
    }
    if (c.managed) fail2(`line ${n} is a header line the board tools maintain and cannot be dropped: ${c.text.slice(0, 120)} -- nothing written`);
    dropped.push(c);
  }
  const drop = new Set(wanted.map((n) => n - 1));
  const collapsed = [];
  let crossedDrop = false;
  for (let i = 0; i < lines.length; i++) {
    if (drop.has(i)) {
      crossedDrop = true;
      continue;
    }
    const l = lines[i];
    const prevBlank = collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === "";
    if (crossedDrop && l.trim() === "" && prevBlank) continue;
    crossedDrop = false;
    collapsed.push(l);
  }
  if (countAllHeaders2(collapsed) !== countAllHeaders2(lines)) fail2("refused -- header-count guard failed, manifest left untouched");
  const out2 = collapsed.join("\n");
  if (out2.trim().length === 0) fail2("refused -- the result would be empty, manifest left untouched");
  return { dropped, out: out2 };
}
function dropBoardCommentsLocked(paths, lineNumbers, dry) {
  const plan = planCommentDrop(readFileSync9(paths.manifest, "utf8"), lineNumbers);
  if (!dry) writeFileAtomic(paths.manifest, plan.out, "comments");
  return plan.dropped;
}

// src/tasks/boardUnlogged.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync9, readFileSync as readFileSync10 } from "node:fs";
var DEFAULT_UNLOGGED_WINDOW = "24 hours ago";
function knownTaskIds(manifest, archive) {
  const ids = /* @__PURE__ */ new Set();
  for (const file of [manifest, archive]) {
    if (!existsSync9(file)) continue;
    for (const block of parseManifestBlocks(readFileSync10(file, "utf8"), TASK_ID_RE).blocks) ids.add(block.id);
  }
  return ids;
}
function mentionsKnownTask(text, ids) {
  for (const token of text.match(/[A-Za-z0-9]+/g) ?? []) {
    if (ids.has(token)) return true;
  }
  return false;
}
function git(root, args2) {
  const r = spawnSync("git", ["-C", root, ...args2], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: (r.stderr ?? "").trim() };
}
function unloggedReport(root, ids, since = DEFAULT_UNLOGGED_WINDOW) {
  const isRef = !since.includes(" ") && git(root, ["rev-parse", "--verify", "--quiet", `${since}^{commit}`]).ok;
  if (!isRef && !/\d|yesterday|today|now|noon|midnight/i.test(since)) {
    throw new Error(`--since ${JSON.stringify(since)} is neither a commit in this repo nor a date git understands`);
  }
  const range = isRef ? [`${since}..HEAD`] : [`--since=${since}`];
  const log = git(root, ["log", "--no-merges", "--format=%h%x1f%cI%x1f%s%x1f%b%x1e", ...range]);
  if (!log.ok) throw new Error(`git log failed: ${log.stderr || "not a git repository?"}`);
  const unlogged = [];
  let loggedCount = 0;
  for (const record of log.stdout.split("")) {
    const [sha, date, subject, body] = record.replace(/^\n/, "").split("");
    if (!sha || !subject) continue;
    if (mentionsKnownTask(`${subject}
${body ?? ""}`, ids)) loggedCount++;
    else unlogged.push({ sha, date: date ?? "", subject });
  }
  const status = git(root, ["status", "--porcelain"]);
  const uncommitted = status.ok ? status.stdout.split("\n").filter((line) => line.trim().length > 0) : [];
  return { since, sinceKind: isRef ? "ref" : "date", unlogged, loggedCount, uncommitted };
}
function formatUnlogged(report) {
  const lines = [
    `window: ${report.sinceKind === "ref" ? `commits after ${report.since}` : `commits since ${report.since}`} (merges excluded)`,
    `unlogged commits (no board task id in the message): ${report.unlogged.length}`,
    ...report.unlogged.map((c) => `  ${c.sha}  ${c.date.slice(0, 16).replace("T", " ")}  ${c.subject}`),
    `commits naming a board task: ${report.loggedCount}`,
    `uncommitted paths: ${report.uncommitted.length}`,
    ...report.uncommitted.map((line) => `  ${line}`)
  ];
  return `${lines.join("\n")}
`;
}

// src/commands/tasksBoard.ts
var WRITE_STATUSES = ["done", "todo", "doing", "backlog", "forbidden"];
var USAGE = `Usage: /cyberine-taskboard:tasks <subcommand> [...]

  init [--sync]                            Create a local board or tracked .claude/TASKS.md
  relocate --to sync|local [--dry]         Move a board and its adjacent history (from a hub
                                            submodule only with --board-wide)
  status [--summary] [--all]             Show the full board or one banner line
  status --json [--all]                  The board as one JSON object (schema board-status/1)
  status <done|todo|doing|backlog|forbidden> <id...> [--evidence <text>]
  status forbidden <id...> --reason <why>     Tombstone + write reason: under the header
  status done [--evidence <text>]             Close every effective [doing] task
  status doing --path <id...>                Stamp path: from cwd
  status fail <id> "<reason>"                Return to todo and record attempt
  status did <Rxx>                          Reset recurring cadence
  recurring <list|due-count>
  recurring add "<title>" --every <N>d|w|m --do <text> [--exec agent|manual|opencode]
      [--model <tier>] [--reasoning <level>] [--last-done YYYY-MM-DD]
  recurring set <Rxx> [--title <t>] [--every <N>d|w|m] [--do <text>] [--exec <e>|-]
      [--model <m>|-] [--reasoning <r>|-] [--last-done YYYY-MM-DD|-]
  recurring drop <Rxx>
${FLEET_USAGE}  status block <id> "<reason>" [--waits-on user|repo:<path>|session:<name>|upstream:<vendor>|event:<what>]   (unblock clears waits-on)
  status unblock <id>
  add --title <t> --do <d> --done-when <w> --effort S|M|L [--status todo|backlog] [--created-by <who>]
      [--model <tier>] [--reasoning low|medium|high|xhigh|max] [--exec agent|manual|opencode] [--priority p0|p1|p2]
      [--area <a>] [--deps <ids>] [--why <w>] [--brief <text> | --brief-file <path|->] [--waits-on user|repo:<path>|session:<name>|upstream:<vendor>|event:<what>|-]
      [--source peer:<session>|user|agent (--verified "<how>" | --unverified)]
      [--default <text>] [--undo-cost <text>]   (BOTH required when the title starts "Owner: decide")
  set <id> [--effort S|M|L] [--reasoning <level>|-] [--model <tier>|-] [--exec agent|manual|opencode] [--priority p0|p1|p2]
      [--title <text>] [--do <text>] [--done-when <text>] [--why <text>|-] [--path <repo-relative dir>|-]
      [--waits-on user|repo:<path>|session:<name>|upstream:<vendor>|event:<what>|-]
      [--verify "<cmd>"|-] [--reason <text>]   (a task with verify: closes only when <cmd> exits 0)
      [--default <text>|-] [--undo-cost <text>|-]   (on an "Owner: decide" task "-" is refused)
      [--source peer:<session>|user|agent|- (--verified "<how>" | --unverified)]   (- clears source and verified)
      (--reason is REQUIRED with --do or --done-when)
  set --batch <json-file|-> --by <model-id>   ({"changes":[{"id","model"?,"reasoning"?,"exec"?,"priority"?,"effort"?}...]})
      All-or-nothing: one bad entry rejects the whole batch, one write, one journal event
  deps show <id>
  deps set <id> "<ids|->"
  archive [--auto] [--board-wide]          In a hub submodule, archive/reconcile/end/hygiene --apply/
                                            status done (no id) touch only its tasks; --board-wide
                                            (or running from the hub root) restores the whole board
${END_LINES}  reconcile [--dry-run] [--board-wide]
  doctor
  merge <dup-id> <survivor-id>
  merge --reject <a-id> <b-id>
  drop <id...> [--reason "<why>"] [--dry]
  forget <id...> [--dry]                    Erase every trace of ids, live or archived
                                            (the only way to remove an archived, [done] or
                                            [forbidden] id)
  log [--by <model>] "<what was done>" ["<...>" ...]
  note <id> "<text>" [--source peer:<session>|user|agent (--verified "<how>" | --unverified)]
                                            Append a dated update line to the manifest block
  brief note <id> "<text>" [--source ... (--verified "<how>" | --unverified)]
                                            Append a dated entry to the brief's ## Updates
  journal "<title>" [--body <text>] [--id <id>]
  journal --title "<text>"
  decide <id> --choice "<text>" --rejected "<alternative>" --reason "<why>" [--status auto|owner] [--by <model-or-agent>]
  decide --revert <ref> --reason "<why>"
  decide --ack <ref...>|--all
  timeline [<YYYY-MM-DD>] [--grep <pattern>]
  corpus [--recent N] [--full]             --full adds exec, model, deps, doneWhen and blocker per record
  unlogged [--since <ref|date>] [--json]   Read-only: commits in the window whose message names
                                            no board task id, plus uncommitted paths
                                            (default window: the last 24 hours)
  board [--out <file>] [--open] [--json] [--archive-recent N] [--journal-days N]
  migrate [--dry]
  save [--schema] [--input <file|->]         Write a decided batch of tasks (JSON), from drafts
                                            or from the conversation; one task by hand is add
  split <id> --input <file|-> [--dry]       Split owner work out of a task: an explicit decomposition
                                            (board-split/1) written in one recoverable write; --schema
                                            prints the input shape
  draft [--to <repo-path>] "<title>" [--do <text>] [--done-when <text>] [--why <text>]
        [--by <model-id>] [--file <path>|--stdin]
  inbox                                     Show the drafts waiting in .local/tasks/drafts/
  inbox reject <draft-*.md...>|--all --reason "<why>"
                                            Move drafts to drafts/rejected/ and journal the reason
  guard                                     PreToolUse hook: read a Claude Code tool payload on
                                            stdin, exit 2 when it would WRITE a board file
  banner [--cwd <dir>] [--json]             SessionStart banner: summary + resume line, silent
                                            without a board
  suggest                                   Read-only: inspect board state, print the one
                                            recommended next command
  tidy                                       Mechanical housekeeping: reconcile, refresh the
                                            header token list, group [forbidden] blocks at the
                                            end, report old-style forbidden candidates (never
                                            auto-rewritten)
  hygiene [--apply] [--json]                 One hygiene pass. Default is a read-only preview of: stale
                                            status headers, dead dep ids (with the unambiguous repoint),
                                            duplicate candidates, decisions buried in blocker:/titles/
                                            update lines. --apply runs the mechanical fixes only (tidy,
                                            unambiguous dep repoints, exact-duplicate merges); minting
                                            Owner tasks for buried decisions stays a judgement step
  comments [--json]                          Read-only: every single-line <!-- --> comment outside
                                            task blocks, with its line number; stale-ids marks a
                                            line whose task ids are all off the live board
  comments drop <line...> [--dry]            Remove those comment lines; refuses any other line
                                            and the header lines the board tools maintain
  move <id> --before|--after <anchor-id>     Reorder one whole task block; refuses a recurring
                                            block, a [forbidden] block, or either as anchor

Bare \`/cyberine-taskboard:tasks\` (optionally with --all, --summary or --json) is \`/cyberine-taskboard:tasks status\`.
Ids accept git-style unambiguous prefixes. Validation refusals exit 2.`;
var SET_USAGE_LINE = "usage: set <id> [--effort|--reasoning|--model|--exec|--priority|--title|--do|--done-when|--why|--path|--verify|--default|--undo-cost|--waits-on|--source|--verified <v>] [--unverified] [--reason <text>] (--reason is required with --do or --done-when)";
var SELF_HELP_SUBCOMMANDS = /* @__PURE__ */ new Set(["run", "group", "promote", "end", "drop", "forget", "note", "brief", "board", "draft"]);
function subcommandUsage(sub2) {
  const picked = [];
  let inBlock = false;
  for (const line of USAGE.split("\n")) {
    if (/^ {2}\S/.test(line)) inBlock = line.trim().split(/\s+/)[0] === sub2;
    else if (!line.trim()) inBlock = false;
    if (inBlock) picked.push(line);
  }
  return picked.length > 0 ? `Usage: /cyberine-taskboard:tasks ${sub2} ...

${picked.join("\n")}` : null;
}
function flagValue(args2, flag) {
  const inline = args2.find((a) => a.startsWith(`${flag}=`));
  if (inline !== void 0) return inline.slice(flag.length + 1);
  const i = args2.indexOf(flag);
  if (i === -1) return void 0;
  const value = args2[i + 1];
  if (value === void 0 || value.startsWith("--")) {
    refuse(`/cyberine-taskboard:tasks: ${flag} expects a value, got ${value === void 0 ? "nothing" : `the next flag "${value}"`}. Use ${flag}=<value> for a value that starts with --.`);
  }
  return value;
}
function hasFlag(args2, flag) {
  return args2.includes(flag);
}
function positionals(args2, valueFlags) {
  const rest = [];
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (valueFlags.includes(a)) {
      i++;
      continue;
    }
    if (a.startsWith("--")) continue;
    rest.push(a);
  }
  return rest;
}
var PROVENANCE_VALUE_FLAGS = ["--source", "--verified"];
function provenanceFromArgs(args2, cmd) {
  const resolved = resolveProvenance({
    source: flagValue(args2, "--source"),
    verified: flagValue(args2, "--verified"),
    unverified: hasFlag(args2, "--unverified")
  });
  if (resolved.errors.length) {
    refuse(`/cyberine-taskboard:tasks ${cmd}: nothing written --
${resolved.errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return { source: resolved.source, verified: resolved.verified };
}
function stripProvenanceArgs(args2) {
  const rest = [];
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--unverified") continue;
    if (PROVENANCE_VALUE_FLAGS.some((f) => a.startsWith(`${f}=`))) continue;
    if (PROVENANCE_VALUE_FLAGS.includes(a)) {
      i++;
      continue;
    }
    rest.push(a);
  }
  return rest;
}
function requireManifest(paths) {
  if (!existsSync10(paths.manifest)) {
    refuse(`/cyberine-taskboard:tasks: no manifest at ${paths.manifest} -- create the board first`);
  }
}
var UNKNOWN_FIELD_WARNING_RE = /manifest line (\d+): unknown field `([^`]+)` -- /;
function emitLint(paths, full = false) {
  if (!existsSync10(paths.manifest)) return;
  const notice = boardFormatNotice(paths.manifest);
  if (notice) warn(notice);
  const warnings = lintManifest(readFileSync11(paths.manifest, "utf8"));
  if (full) {
    for (const w of warnings) warn(w);
    return;
  }
  const unknown = warnings.map((w) => UNKNOWN_FIELD_WARNING_RE.exec(w)).filter((m) => m !== null);
  let summarised = false;
  for (const w of warnings) {
    if (!UNKNOWN_FIELD_WARNING_RE.test(w)) {
      warn(w);
      continue;
    }
    if (summarised) continue;
    summarised = true;
    const first = unknown[0];
    const n = unknown.length;
    warn(
      `/cyberine-taskboard:tasks: ${n} manifest line${n === 1 ? "" : "s"} ${n === 1 ? "carries" : "carry"} unknown fields (first: line ${first[1]} ${first[2]}); list ${n === 1 ? "it" : "them"} with \`/cyberine-taskboard:tasks doctor\``
    );
  }
}
function liveIdUniverse(paths) {
  const ids = /* @__PURE__ */ new Set();
  for (const t of fold(paths.manifest, paths)) ids.add(t.id);
  return ids;
}
function resolveOrRefuse(raw, ids) {
  try {
    const resolved = resolveIdPrefix(raw, ids);
    if (resolved === null) refuse(`/cyberine-taskboard:tasks: no such task: ${raw}`);
    return resolved;
  } catch (e) {
    if (e instanceof AmbiguousIdError) refuse(`/cyberine-taskboard:tasks: ${e.message}`);
    throw e;
  }
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function withLock(paths, fn) {
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing written)");
    process.exit(1);
  }
  try {
    return fn();
  } finally {
    unlock(paths.lock);
  }
}
var NO_PROMOTE_ENV = "CYBERINE_TASKS_NO_PROMOTE";
var PROMOTING_STATUSES = ["todo", "doing"];
function refuseIfPromoting(token, how) {
  if (!noPromoteActive() || !PROMOTING_STATUSES.includes(token)) return;
  refuse(
    `/cyberine-taskboard:tasks: refusing to set status "${token}" -- ${NO_PROMOTE_ENV} is set for this session, so it may only DRAFT work as [backlog]. Promoting a draft is the operator's decision. (${how})`
  );
}
function runStatus(paths, args2) {
  const token = args2[0];
  if (!token || token === "--summary" || token === "--all" || token === "--json") {
    const unknown = args2.filter((arg) => arg !== "--summary" && arg !== "--all" && arg !== "--json");
    if (unknown.length) refuse(`/cyberine-taskboard:tasks status: unknown argument(s): ${unknown.join(" ")}`);
    if (args2.includes("--json")) {
      if (args2.includes("--summary")) refuse("/cyberine-taskboard:tasks status: --json and --summary do not combine; the JSON already carries the counts");
      writeJsonLine(boardStatusJson(boardView(paths, process.cwd(), args2.includes("--all")), paths.manifest));
      return;
    }
    const result = boardStatusView(paths, process.cwd(), args2.includes("--summary"), args2.includes("--all"));
    for (const message of result.stderr) warn(message);
    process.stdout.write(result.stdout);
    return;
  }
  if (token === "did") {
    const id = args2[1];
    if (!id || args2.length !== 2) refuse("/cyberine-taskboard:tasks status did: usage: status did <Rxx>");
    withLock(paths, () => recurringDid(paths.manifest, id));
    out(`${id} -> last-done: ${todayLocalDate()}`);
    return;
  }
  if (token === "fail") {
    refuseIfPromoting("todo", "/cyberine-taskboard:tasks status fail");
    const id = args2[1];
    const rawReason = args2.slice(2).join(" ");
    if (!id || !rawReason.trim()) refuse('/cyberine-taskboard:tasks status fail: usage: status fail <id> "<reason>"');
    const resolved = resolveOrRefuse(id, liveIdUniverse(paths));
    const reason = rawReason.replace(/\s+/g, " ").trim();
    appendStatus(paths, resolved, "todo", `fail:${reason}`);
    if (!lockAndMigrate(paths.lock, paths.manifest)) {
      out(`${resolved} -> [todo]`);
      warn(`warning: attempt note NOT written to brief for ${resolved} (reconcile lock busy)`);
      process.exitCode = 1;
      return;
    }
    let briefFailed = false;
    try {
      appendAttempt(join7(paths.tasksDir, `${resolved}.md`), reason);
    } catch (e) {
      warn(e.message);
      process.exitCode = 1;
      briefFailed = true;
    } finally {
      unlock(paths.lock);
    }
    if (briefFailed) {
      out(`${resolved} -> [todo]`);
      warn(`warning: attempt note NOT written to brief for ${resolved}`);
    } else out(`${resolved} -> [todo] (fail recorded: ${reason})`);
    return;
  }
  if (token === "block") {
    const rest = args2.slice(1);
    let waitsOn;
    const kept = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--waits-on") {
        waitsOn = rest[++i];
        if (waitsOn === void 0 || waitsOn.startsWith("--")) refuse(`/cyberine-taskboard:tasks status block: --waits-on needs a value (${WAITS_ON_SHAPE}) -- nothing written`);
      } else if (a.startsWith("--waits-on=")) {
        waitsOn = a.slice("--waits-on=".length);
      } else kept.push(a);
    }
    const id = kept[0];
    const reason = kept.slice(1).join(" ");
    if (!id) refuse('/cyberine-taskboard:tasks status block: usage: status block <id> "<reason>" [--waits-on <user|repo:<path>|session:<name>|upstream:<vendor>|event:<what>>]');
    if (waitsOn !== void 0) {
      const waitsErr = waitsOnError(waitsOn);
      if (waitsErr !== null) refuse(`/cyberine-taskboard:tasks status block: ${waitsErr} -- nothing written`);
    }
    out(withLock(paths, () => setBlocker(paths, id, reason, waitsOn)));
    return;
  }
  if (token === "unblock") {
    const id = args2[1];
    if (!id || args2.length > 2) refuse("/cyberine-taskboard:tasks status unblock: usage: status unblock <id>");
    out(withLock(paths, () => setBlocker(paths, id, null)));
    return;
  }
  if (!token || !WRITE_STATUSES.includes(token)) {
    refuse("/cyberine-taskboard:tasks status: first argument must be one of done|todo|doing|backlog|forbidden|did|fail|block|unblock");
  }
  refuseIfPromoting(token, "/cyberine-taskboard:tasks status");
  const unknownFlags = [];
  for (let i = 1; i < args2.length; i++) {
    const arg = args2[i];
    if (arg === "--evidence" || arg === "--fail" || arg === "--reason") i++;
    else if (arg === "--path" || arg.startsWith("--evidence=") || arg.startsWith("--fail=") || arg.startsWith("--reason=")) continue;
    else if (arg.startsWith("-") && arg.length > 1) unknownFlags.push(arg);
  }
  if (unknownFlags.length) {
    refuse(
      `/cyberine-taskboard:tasks status: unknown flag(s): ${unknownFlags.join(" ")} -- nothing written
usage: status <done|todo|doing|backlog|forbidden> <id...> [--evidence <text> | --fail <reason> | --reason <why> | --path]`
    );
  }
  let evidence = flagValue(args2, "--evidence");
  const failReason = flagValue(args2, "--fail");
  const forbidReasonRaw = flagValue(args2, "--reason");
  const stampPath = token === "doing" && hasFlag(args2, "--path");
  if (hasFlag(args2, "--evidence") && (evidence === void 0 || !evidence.trim())) {
    refuse("/cyberine-taskboard:tasks status: --evidence requires a non-empty <text>");
  }
  if (hasFlag(args2, "--fail") && (failReason === void 0 || !failReason.trim())) {
    refuse("/cyberine-taskboard:tasks status: --fail requires a non-empty <reason>");
  }
  if (evidence !== void 0 && token !== "done") {
    refuse("/cyberine-taskboard:tasks status: --evidence is only valid on a `done` flip");
  }
  if (failReason !== void 0 && token !== "todo") {
    refuse("/cyberine-taskboard:tasks status: --fail is only valid on a `todo` flip");
  }
  if (hasFlag(args2, "--reason") && (forbidReasonRaw === void 0 || !forbidReasonRaw.trim())) {
    refuse('/cyberine-taskboard:tasks status: usage: status forbidden <id> [id...] --reason "<why it must never run>"');
  }
  if (forbidReasonRaw !== void 0 && token !== "forbidden") {
    refuse("/cyberine-taskboard:tasks status: --reason is only valid on a `forbidden` flip");
  }
  if (evidence !== void 0 && failReason !== void 0) {
    refuse("/cyberine-taskboard:tasks status: --evidence and --fail are mutually exclusive");
  }
  const rawIds = positionals(args2.slice(1), ["--evidence", "--fail", "--reason"]);
  if (hasFlag(args2, "--path") && !stampPath) refuse("/cyberine-taskboard:tasks status: --path is only valid on a `doing` flip");
  if (rawIds.length === 0 && token !== "done") refuse("/cyberine-taskboard:tasks status: at least one <id> is required");
  const universe = liveIdUniverse(paths);
  const noIdScope = rawIds.length ? void 0 : boardScopeFilter(paths, args2);
  const ids = rawIds.length ? rawIds.map((raw) => resolveOrRefuse(raw, universe)) : fold(paths.manifest, paths).filter((t) => t.status === "doing" && (noIdScope?.keep === void 0 || noIdScope.keep(t.id))).map((t) => t.id);
  if (!ids.length) {
    warn("no [doing] tasks to close.");
    return;
  }
  if (token === "done") {
    for (const id of ids) {
      const duplicate = duplicateTarget(paths.manifest, id);
      if (!duplicate) continue;
      if (duplicate.cycle) refuse(`${id} is duplicate-of ${duplicate.target}, but that chain cycles back on itself -- fix the duplicate-of pointers before closing anything`);
      const survivor = fold(paths.manifest, paths).find((t) => t.id === duplicate.target);
      const targetDone = !survivor || survivor.status === "done";
      refuse(targetDone ? `${id} is duplicate-of ${duplicate.target}, which is already done or archived -- drop the duplicate instead (\`drop ${id}\`)` : `${id} is duplicate-of ${duplicate.target} -- close ${duplicate.target} instead (\`status done ${duplicate.target}\`)`);
    }
  }
  if (token === "doing" || token === "done") {
    const caller = claimOwner();
    for (const id of ids) {
      const refusal2 = leaseRefusal(paths, id, caller);
      if (refusal2) refuse(refusal2);
    }
  }
  if (token === "done") {
    const verified = [];
    const failed = [];
    for (const id of ids) {
      const outcome = runTaskVerify(paths.root, paths.manifest, id);
      if (outcome === null) continue;
      if (outcome.passed) verified.push(`${id} verify ${outcome.detail}`);
      else failed.push(`${id}: ${outcome.detail}`);
    }
    if (failed.length) {
      refuse(`/cyberine-taskboard:tasks status done: refused, nothing written -- a task with a verify: command closes only when it exits 0:
${failed.map((f) => `  ${f}`).join("\n")}`);
    }
    if (verified.length) evidence = [evidence, ...verified].filter((e) => e !== void 0 && e.trim() !== "").join("; ");
  }
  const extra = evidence !== void 0 ? `evidence:${evidence.replace(/\s+/g, " ").trim()}` : failReason !== void 0 ? `fail:${failReason.replace(/\s+/g, " ").trim()}` : void 0;
  for (const id of ids) {
    appendStatus(paths, id, token, extra);
    out(evidence !== void 0 ? `${id} -> [${token}] (evidence: ${evidence.replace(/\s+/g, " ").trim()})` : extra ? `${id} -> [${token}] (${extra})` : `${id} -> [${token}]`);
  }
  if (forbidReasonRaw !== void 0) {
    writeForbiddenReasons(paths, ids, collapseWhitespace(forbidReasonRaw));
    return;
  }
  if (token === "forbidden") {
    for (const id of forbiddenIdsMissingReason(paths.manifest, ids)) {
      warn(`${id}: no reason: recorded -- add one with: status forbidden ${id} --reason "<why it must never run>"`);
    }
  }
  if (stampPath) withLock(paths, () => stampPaths(paths.manifest, paths.root, process.cwd(), ids));
}
function writeForbiddenReasons(paths, ids, reason) {
  if (!reconcile(paths)) {
    warn("/cyberine-taskboard:tasks status forbidden: the flip is recorded in the overlay, but reconcile failed -- reason: not written; re-run once the board is free");
    process.exitCode = 1;
    return;
  }
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks status forbidden: reconcile lock busy -- reason: not written; re-run once the board is free");
    process.exitCode = 1;
    return;
  }
  const written = [];
  try {
    for (const id of ids) {
      setForbiddenReason(paths.manifest, id, reason);
      written.push(id);
      out(`${id}: reason: ${reason}`);
    }
  } catch (e) {
    warn(e.message);
    process.exitCode = 1;
  } finally {
    unlock(paths.lock);
  }
  for (const id of written) journalNoteEvent(paths, id, `forbidden ${id}: ${reason}`, "status forbidden");
}
var RECURRING_EDIT_USAGE = `usage:
  /cyberine-taskboard:tasks recurring add "<title>" --every <N>d|w|m --do "<text>" [--exec agent|manual|opencode] [--model haiku|sonnet|opus|fable] [--reasoning low|medium|high|xhigh|max] [--last-done YYYY-MM-DD]
  /cyberine-taskboard:tasks recurring set <Rxx> [--title <t>] [--every <N>d|w|m] [--do <text>] [--exec <e>|-] [--model <m>|-] [--reasoning <r>|-] [--last-done YYYY-MM-DD|-]
  /cyberine-taskboard:tasks recurring drop <Rxx>`;
var RECURRING_FLAG_MAP = {
  "--title": "title",
  "--every": "every",
  "--last-done": "lastDone",
  "--exec": "exec",
  "--model": "model",
  "--reasoning": "reasoning",
  "--do": "do"
};
function parseRecurringEditArgs(args2, allowed) {
  const positional = [];
  const fields = {};
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a.startsWith("--")) {
      const key = RECURRING_FLAG_MAP[a];
      if (!key || !allowed.includes(key)) refuse(`/cyberine-taskboard:tasks recurring: unknown flag: ${a}

${RECURRING_EDIT_USAGE}`);
      const v = args2[++i];
      if (v === void 0) refuse(`/cyberine-taskboard:tasks recurring: ${a} needs a value`);
      fields[key] = collapseWhitespace(v);
    } else {
      positional.push(a);
    }
  }
  return { positional, fields };
}
function runRecurringEdit(paths, sub2, args2) {
  const all = Object.values(RECURRING_FLAG_MAP);
  const allowed = sub2 === "drop" ? [] : sub2 === "add" ? all.filter((k) => k !== "title") : all;
  const { positional, fields } = parseRecurringEditArgs(args2, allowed);
  if (sub2 === "add" && positional.length > 1) {
    refuse(`/cyberine-taskboard:tasks recurring add: takes one quoted "<title>", got ${positional.length} words

${RECURRING_EDIT_USAGE}`);
  }
  if (sub2 !== "add" && positional.length !== 1) refuse(RECURRING_EDIT_USAGE);
  withLock(paths, () => {
    if (sub2 === "add") {
      const id = addRecurring(paths.manifest, { ...fields, title: collapseWhitespace(positional[0] ?? "") });
      out(`${id} [recurring] added${fields.lastDone ? "" : " (NEW -- never run, due now)"}`);
    } else if (sub2 === "set") {
      const id = positional[0];
      out(setRecurring(paths.manifest, id, fields) ? `${id}: updated` : `${id}: unchanged`);
    } else {
      const title = dropRecurring(paths.manifest, positional[0]);
      out(`${positional[0]} dropped: ${title}`);
    }
  });
}
function runRecurring(paths, args2) {
  if (args2[0] === "add" || args2[0] === "set" || args2[0] === "drop") {
    runRecurringEdit(paths, args2[0], args2.slice(1));
    return;
  }
  if (args2[0] === "list" && args2.length === 1) {
    const lines = recurringList(paths.manifest);
    if (lines) out(lines);
  } else if (args2[0] === "due-count" && args2.length === 1) out(String(recurringDueCount(paths.manifest)));
  else refuse(`/cyberine-taskboard:tasks recurring: usage: recurring <list|due-count|add|set|drop>

${RECURRING_EDIT_USAGE}`);
}
async function runAdd(paths, args2) {
  const VALUE_FLAGS = [
    "--title",
    "--do",
    "--done-when",
    "--effort",
    "--reasoning",
    "--model",
    "--exec",
    "--priority",
    "--area",
    "--deps",
    "--why",
    "--brief",
    "--brief-file",
    "--status",
    "--created-by",
    "--source",
    "--verified",
    "--default",
    "--undo-cost",
    "--waits-on"
  ];
  const title = flagValue(args2, "--title");
  const doText = flagValue(args2, "--do");
  const doneWhen = flagValue(args2, "--done-when");
  const effort = flagValue(args2, "--effort");
  const briefFile = flagValue(args2, "--brief-file");
  const briefText = flagValue(args2, "--brief");
  if (!title || !title.trim()) refuse("/cyberine-taskboard:tasks add: --title is required and non-empty");
  if (!doText || !doText.trim()) refuse("/cyberine-taskboard:tasks add: --do is required and non-empty");
  if (!doneWhen || !doneWhen.trim()) refuse("/cyberine-taskboard:tasks add: --done-when is required and non-empty");
  if (!effort) refuse("/cyberine-taskboard:tasks add: --effort is REQUIRED (S|M|L)");
  const unknown = args2.filter((a) => a.startsWith("--") && a !== "--unverified" && !VALUE_FLAGS.includes(a.split("=")[0]));
  if (unknown.length) refuse(`/cyberine-taskboard:tasks add: unknown flag(s): ${unknown.join(" ")}`);
  const provenance = provenanceFromArgs(args2, "add");
  const exec = flagValue(args2, "--exec") ?? DEFAULT_TASK_EXEC;
  const model = exec === "manual" ? null : flagValue(args2, "--model") ?? DEFAULT_TASK_MODEL;
  const priority = flagValue(args2, "--priority");
  const reasoning = flagValue(args2, "--reasoning");
  const area = flagValue(args2, "--area");
  const deps = flagValue(args2, "--deps");
  const why = flagValue(args2, "--why");
  const defaultText = flagValue(args2, "--default");
  const undoCost = flagValue(args2, "--undo-cost");
  const missingDecide = missingDecideFields(title, { default: defaultText, undoCost });
  if (missingDecide.length) {
    refuse(`/cyberine-taskboard:tasks add: an Owner: decide task needs a default and an undo cost -- missing ${missingDecide.map((m) => m === "default" ? "--default <what happens if the owner never answers>" : "--undo-cost <what reversing it costs>").join(" and ")}; nothing written`);
  }
  const status = flagValue(args2, "--status") ?? "todo";
  if (!WRITABLE_STATUSES.includes(status)) {
    refuse(`/cyberine-taskboard:tasks add: --status must be one of ${WRITABLE_STATUSES.join(" | ")}, got "${status}"`);
  }
  refuseIfPromoting(status, "/cyberine-taskboard:tasks add --status (default todo)");
  const createdBy = flagValue(args2, "--created-by");
  const waitsOnRaw = flagValue(args2, "--waits-on");
  if (waitsOnRaw !== void 0 && waitsOnRaw.trim() !== "-") {
    const waitsErr = waitsOnError(waitsOnRaw);
    if (waitsErr !== null) refuse(`/cyberine-taskboard:tasks add: --waits-on: ${waitsErr} -- nothing written`);
  }
  const waitsOn = waitsOnRaw === void 0 || waitsOnRaw.trim() === "-" ? void 0 : waitsOnRaw.trim();
  if (briefText !== void 0 && briefFile !== void 0) refuse("/cyberine-taskboard:tasks add: give --brief <text> or --brief-file <path|->, not both");
  let briefBody;
  if (briefText !== void 0) {
    briefBody = briefText.endsWith("\n") ? briefText : `${briefText}
`;
  } else if (briefFile === "-") {
    briefBody = await readStdin();
  } else if (briefFile) {
    if (!existsSync10(briefFile)) refuse(`/cyberine-taskboard:tasks add: --brief-file not found: ${briefFile}`);
    briefBody = readFileSync11(briefFile, "utf8");
  }
  if (briefBody !== void 0 && briefBody.trim() === "") refuse(`/cyberine-taskboard:tasks add: ${briefText !== void 0 ? "--brief" : "--brief-file"} is empty`);
  const decision = {
    ref: "a",
    title,
    do: doText,
    doneWhen,
    exec,
    model,
    effort,
    ...reasoning !== void 0 && { reasoning },
    ...priority !== void 0 && { priority },
    ...area !== void 0 && { area: area.split(/[,\s]+/).filter(Boolean) },
    ...deps !== void 0 && { deps: deps.split(/[,\s]+/).filter(Boolean) },
    ...why !== void 0 && { why },
    ...defaultText !== void 0 && { default: defaultText },
    ...undoCost !== void 0 && { undoCost },
    ...status !== "todo" && { status },
    ...createdBy !== void 0 && { createdBy },
    ...provenance.source !== void 0 && { source: provenance.source },
    ...provenance.verified !== void 0 && { verified: provenance.verified },
    ...waitsOn !== void 0 && { waitsOn }
  };
  const applyOut = briefBody === void 0 ? out : (line) => {
    if (line !== "briefs written: none") out(line);
  };
  withLock(paths, () => {
    const result = convergeApply(paths, [decision], applyOut, warn, false);
    const createdId = result.created[0]?.id;
    if (createdId !== void 0) {
      for (const issue of missingBriefIssues({ effort, hasBrief: briefBody !== void 0 })) {
        warn(`/cyberine-taskboard:tasks add: warning: ${createdId}: ${issue}`);
      }
      const { blocks } = parseManifestBlocks(readFileSync11(paths.manifest, "utf8"), TASK_ID_RE);
      const block = blocks.find((b) => b.id === createdId);
      for (const issue of (block ? ownerMixForBlock(block, { blocks, archiveBlocks: archivedBlocks(paths.archive) })?.issues : void 0) ?? []) {
        warn(`/cyberine-taskboard:tasks add: warning: ${createdId}: ${issue}`);
      }
    }
    if (briefBody === void 0) return;
    const created = result.created[0];
    if (!created) return;
    mkdirSync3(paths.tasksDir, { recursive: true });
    const path = join7(paths.tasksDir, `${created.id}.md`);
    if (existsSync10(path) || existsSync10(join7(paths.tasksDir, "archive", `${created.id}.md`))) return;
    writeFileSync2(path, briefBody);
    out(`brief written:
  ${path}`);
  });
}
var SET_FLAGS = /* @__PURE__ */ new Set([
  "--effort",
  "--reasoning",
  "--model",
  "--exec",
  "--priority",
  "--title",
  "--do",
  "--done-when",
  "--why",
  "--reason",
  "--path",
  "--verify",
  "--default",
  "--undo-cost",
  "--waits-on",
  "--source",
  "--verified"
]);
var BATCH_SET_USAGE = `usage: /cyberine-taskboard:tasks set --batch <json-file|-> --by <model-id>

  <json-file|->   path to a JSON file, or "-" to read the batch from stdin
  --by <model>    REQUIRED: the model that judged this batch (recorded in the journal event)

  Input shape: {"changes": [{"id": "<id>", "model"?: "<tier>|-", "reasoning"?: "<level>|-", "exec"?: "agent|manual|opencode", "priority"?: "p0|p1|p2", "effort"?: "S|M|L"}, ...]}
  Same per-entry rules as the single form (exec: manual requires model "-"; priority: p1 removes the line).
  Every entry is validated before anything is written; one bad entry rejects the whole batch.`;
async function runSetBatch(paths, args2) {
  let inputPath;
  let by = "";
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--by") {
      by = args2[++i] ?? "";
    } else if (inputPath === void 0) {
      inputPath = a;
    } else {
      refuse(`/cyberine-taskboard:tasks set --batch: unexpected argument: ${a}

${BATCH_SET_USAGE}`);
    }
  }
  if (!inputPath) refuse(`/cyberine-taskboard:tasks set --batch: a <json-file|-> is required

${BATCH_SET_USAGE}`);
  if (!by.trim()) refuse(`/cyberine-taskboard:tasks set --batch: --by <model-id> is required

${BATCH_SET_USAGE}`);
  if (inputPath !== "-" && !existsSync10(inputPath)) {
    refuse(`/cyberine-taskboard:tasks set --batch: no such file: ${inputPath}`);
  }
  const raw = inputPath === "-" ? await readStdin() : readFileSync11(inputPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    refuse(`/cyberine-taskboard:tasks set --batch: invalid JSON -- ${e.message}`);
  }
  const changesArr = parsed?.changes;
  if (!Array.isArray(changesArr)) {
    refuse('/cyberine-taskboard:tasks set --batch: input must be an object shaped { "changes": [...] }');
  }
  if (changesArr.length === 0) {
    out("set --batch: no changes in input, nothing to do.");
    return;
  }
  withLock(paths, () => setFieldsBatch(paths, changesArr, by, out));
}
async function runSet(paths, args2) {
  if (args2[0] === "--batch") {
    await runSetBatch(paths, args2.slice(1));
    return;
  }
  const id = args2[0];
  if (!id || id.startsWith("--")) {
    refuse(`/cyberine-taskboard:tasks set: ${SET_USAGE_LINE}`);
  }
  const unverified = args2.includes("--unverified");
  args2 = args2.filter((a) => a !== "--unverified");
  for (let i = 1; i < args2.length; i += 2) {
    const flag = args2[i];
    if (!SET_FLAGS.has(flag)) {
      refuse(`/cyberine-taskboard:tasks set: unknown argument ${JSON.stringify(flag)} -- ${SET_USAGE_LINE}; nothing written`);
    }
    const value = args2[i + 1];
    if (value === void 0 || value.startsWith("--")) refuse(`/cyberine-taskboard:tasks set: ${flag} needs a value -- nothing written`);
  }
  const changes = {};
  const effort = flagValue(args2, "--effort");
  const reasoning = flagValue(args2, "--reasoning");
  const model = flagValue(args2, "--model");
  const exec = flagValue(args2, "--exec");
  const priority = flagValue(args2, "--priority");
  const title = flagValue(args2, "--title");
  const doText = flagValue(args2, "--do");
  const doneWhen = flagValue(args2, "--done-when");
  const why = flagValue(args2, "--why");
  const reason = flagValue(args2, "--reason");
  const pathValue = flagValue(args2, "--path");
  const verify = flagValue(args2, "--verify");
  const defaultText = flagValue(args2, "--default");
  const undoCost = flagValue(args2, "--undo-cost");
  if (defaultText !== void 0) changes.default = defaultText;
  if (undoCost !== void 0) changes.undoCost = undoCost;
  const waitsOnSet = flagValue(args2, "--waits-on");
  if (waitsOnSet !== void 0) changes.waitsOn = waitsOnSet;
  const sourceSet = flagValue(args2, "--source");
  const verifiedSet = flagValue(args2, "--verified");
  if (sourceSet !== void 0 || verifiedSet !== void 0 || unverified) {
    if (verifiedSet !== void 0 && unverified) refuse("/cyberine-taskboard:tasks set: --verified and --unverified are mutually exclusive -- nothing written");
    if (verifiedSet !== void 0 && verifiedSet.trim().toLowerCase() === "no") refuse('/cyberine-taskboard:tasks set: --verified "no" is the unverified marker -- pass --unverified instead; nothing written');
    if (sourceSet !== void 0) changes.source = sourceSet;
    if (verifiedSet !== void 0) changes.verified = verifiedSet;
    if (unverified) changes.verified = "no";
  }
  if (verify !== void 0) changes.verify = verify;
  if (effort !== void 0) changes.effort = effort;
  if (reasoning !== void 0) changes.reasoning = reasoning;
  if (model !== void 0) changes.model = model;
  if (exec !== void 0) changes.exec = exec;
  if (priority !== void 0) changes.priority = priority;
  if (title !== void 0) changes.title = title;
  if (doText !== void 0) changes.do = doText;
  if (doneWhen !== void 0) changes.doneWhen = doneWhen;
  if (why !== void 0) changes.why = why;
  if (pathValue !== void 0) changes.path = pathValue;
  if (Object.keys(changes).length === 0) {
    refuse("/cyberine-taskboard:tasks set: at least one of --effort/--reasoning/--model/--exec/--priority/--title/--do/--done-when/--why/--path/--verify/--default/--undo-cost/--waits-on/--source/--verified/--unverified is required");
  }
  out(withLock(paths, () => setFields(paths, id, changes, reason)));
}
function runDeps(paths, args2) {
  const sub2 = args2[0];
  const id = args2[1];
  if (sub2 === "show") {
    if (!id) refuse("/cyberine-taskboard:tasks deps: usage: deps show <id>");
    out(showDeps(paths, id));
    return;
  }
  if (sub2 === "set") {
    const list = args2.slice(2).join(" ").trim();
    if (!id || !list) refuse('/cyberine-taskboard:tasks deps: usage: deps set <id> "<ids|->"');
    out(withLock(paths, () => setDeps(paths, id, list)));
    return;
  }
  refuse("/cyberine-taskboard:tasks deps: usage: deps <show|set> <id> [ids|-]");
}
function boardScopeFilter(paths, args2) {
  const scope = hasFlag(args2, "--board-wide") ? "" : submoduleScope(process.cwd());
  if (!scope) return { scope: "", leftDone: () => 0 };
  const pathOf = /* @__PURE__ */ new Map();
  for (const file of [paths.archive, paths.manifest]) {
    if (!existsSync10(file)) continue;
    for (const b of parseManifestBlocks(readFileSync11(file, "utf8"), TASK_ID_RE).blocks) pathOf.set(b.id, b.fields.get("path")?.trim() ?? "");
  }
  const keep = (id) => pathInScope(pathOf.get(id), scope);
  const leftDone = () => fold(paths.manifest, paths).filter((t) => t.status === "done" && !keep(t.id)).length;
  return { scope, keep, leftDone };
}
function scopeHousekeeping(scope, left, cmd) {
  if (!scope) return;
  out(`scoped to submodule ${scope}/: only its tasks were touched${left ? `; ${left} done task(s) elsewhere on the hub board were left for the hub (run ${cmd} from the hub root, or add --board-wide)` : ""}.`);
}
function runArchive(paths, args2) {
  const auto = hasFlag(args2, "--auto");
  const unknown = args2.filter((a) => a.startsWith("-") && a !== "--auto" && a !== "--board-wide");
  if (unknown.length) refuse(`/cyberine-taskboard:tasks archive: unknown flag(s): ${unknown.join(" ")} -- nothing archived`);
  const scoped = boardScopeFilter(paths, args2);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing written)");
    process.exit(1);
  }
  try {
    if (archiveLocked(paths, { auto, ...scoped.keep ? { keep: scoped.keep } : {} }, out).length) process.exitCode = 1;
    scopeHousekeeping(scoped.scope, scoped.leftDone(), "/cyberine-taskboard:tasks archive");
  } catch (e) {
    warn(e.message);
    out(archiveAbortLabel(e, "archive"));
    process.exitCode = 1;
  } finally {
    unlock(paths.lock);
  }
}
function runEnd(paths, args2) {
  const handoff = {};
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "-h" || a === "--help") {
      out(END_USAGE);
      return;
    }
    if (a === "--force" || a === "--board-wide") continue;
    const consumed = consumeEndHandoffArg(handoff, args2, i);
    if (consumed >= 0) {
      i = consumed;
      continue;
    }
    refuse(`/cyberine-taskboard:tasks end: unknown argument: ${a} -- nothing archived

${END_USAGE}`);
  }
  const force = hasFlag(args2, "--force");
  checkEndHandoffOptions(handoff);
  const handoffSeed = readEndHandoffSeed(handoff);
  const pendingDrafts = draftNames(paths.draftsDir);
  if (pendingDrafts.length > 0 && !force) {
    out(`/cyberine-taskboard:tasks end: ${pendingDrafts.length} draft(s) pending in .local/tasks/drafts/ -- add them to the board first (/cyberine-taskboard:tasks inbox, then /cyberine-taskboard:tasks save), then re-run end.`);
    out('     (or: /cyberine-taskboard:tasks inbox reject <draft>|--all --reason "<why>" to discard them,');
    out("      or: /cyberine-taskboard:tasks end --force to wrap anyway and leave them in the inbox for later)");
    process.exitCode = 2;
    return;
  }
  const scoped = boardScopeFilter(paths, args2);
  const doing = fold(paths.manifest, paths).filter((t) => t.status === "doing" && (scoped.keep === void 0 || scoped.keep(t.id)));
  if (doing.length) {
    out("/cyberine-taskboard:tasks end: still [doing] at session end -- flip each to done/todo, then re-run end:");
    for (const t of doing) out(`  ${t.id}  ${t.title}`);
  }
  let boardLabel = null;
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks end: reconcile lock busy, aborting (nothing archived)");
    process.exitCode = 1;
    boardLabel = archiveAbortLabel(null, "end");
  } else {
    try {
      if (archiveLocked(paths, { auto: false, ...scoped.keep ? { keep: scoped.keep } : {} }, out).length) process.exitCode = 1;
      addStaleHeaderNoteLocked(paths.manifest);
      scopeHousekeeping(scoped.scope, scoped.leftDone(), "/cyberine-taskboard:tasks end");
    } catch (e) {
      warn(e.message);
      process.exitCode = 1;
      boardLabel = archiveAbortLabel(e, "end");
    } finally {
      unlock(paths.lock);
    }
  }
  out("");
  if (boardLabel) out(boardLabel);
  const view = boardStatusView(paths, process.cwd(), false, false);
  for (const message of view.stderr) warn(message);
  process.stdout.write(view.stdout);
  if (pendingDrafts.length > 0) {
    out(`note: ${pendingDrafts.length} draft(s) left in the inbox (--force).`);
  }
  if (handoffSeed !== null) {
    out("");
    const decisions = unreviewedDecisions(paths, submoduleScope(process.cwd()));
    const seed = decisions.length ? `${handoffSeed.trimEnd()}
Open: ${decisions.length} unreviewed decisions (report them, then /cyberine-taskboard:tasks decide --ack <ref...>)
${unreviewedDecisionLines(decisions).map((line) => `- ${line}`).join("\n")}
` : handoffSeed;
    finishEndHandoff(handoff, seed);
  }
}
function runTidy(paths, args2) {
  if (args2.length) refuse("/cyberine-taskboard:tasks tidy: no arguments accepted");
  let result;
  try {
    result = tidyBoard(paths);
  } catch (e) {
    refuse(e.message);
  }
  if (result.refreshedHeader) out("tidy: refreshed header token list");
  if (result.groupedCount) out(`tidy: grouped ${result.groupedCount} forbidden task(s) at the end`);
  out("");
  if (result.candidates.length) {
    out("Old-style forbidden candidates (JUDGMENT -- not auto-changed):");
    for (const c of result.candidates) out(c);
    out("");
    out("  -> For each one you confirm is truly forbidden: change the token to [forbidden],");
    out('     strip the "FORBIDDEN -- " prefix from the title, and fold the explanation');
    out("     (currently in blocker:/do:) into a single 'reason:' line. Drop now-dead fields");
    out("     (blocker:, done-when: N/A, deps: that only served to block it).");
  } else {
    out("No old-style forbidden candidates found.");
  }
  if (!result.changed) out("tidy: manifest already clean (mechanical part).");
}
function runHygiene(paths, args2) {
  const unknown = args2.filter((a) => a !== "--apply" && a !== "--json" && a !== "--board-wide");
  if (unknown.length) refuse(`/cyberine-taskboard:tasks hygiene: unknown argument(s): ${unknown.join(" ")} -- usage: hygiene [--apply] [--json] [--board-wide]`);
  const apply = hasFlag(args2, "--apply");
  const json = hasFlag(args2, "--json");
  if (!apply) {
    const report = analyzeHygiene(paths);
    if (json) out(JSON.stringify(report));
    else for (const line of formatHygiene(report, "preview")) out(line);
    return;
  }
  let result;
  try {
    const scoped = boardScopeFilter(paths, args2);
    result = applyHygiene(paths, scoped.keep);
    if (scoped.scope && !json) out(`scoped to submodule ${scoped.scope}/: dep repoints and merges touch only its tasks; tidy's reformatting stays board-wide.`);
  } catch (e) {
    refuse(e.message);
  }
  if (result.actions.some((a) => a.state === "refused")) process.exitCode = 1;
  if (json) {
    out(JSON.stringify({ actions: result.actions, after: result.after }));
    return;
  }
  out("hygiene --apply:");
  for (const a of result.actions) out(`  ${a.state === "done" ? "done" : a.state === "skipped" ? "skipped" : "REFUSED"} [${a.kind}] ${a.detail}`);
  out("");
  out("What is left after the mechanical fixes:");
  for (const line of formatHygiene(result.after, "after")) out(line);
}
function runComments(paths, args2) {
  if (args2[0] === "drop") {
    const rest = args2.slice(1);
    const dry = hasFlag(rest, "--dry");
    const nums = rest.filter((a) => a !== "--dry");
    const bad = nums.filter((a) => !/^[0-9]+$/.test(a));
    if (bad.length || nums.length === 0) {
      refuse(`/cyberine-taskboard:tasks comments: usage: comments drop <line...> [--dry]${bad.length ? ` -- not a line number: ${bad.join(" ")}` : ""}`);
    }
    if (!lockAndMigrate(paths.lock, paths.manifest)) {
      refuse("/cyberine-taskboard:tasks comments: board lock busy, aborting (nothing written)");
    }
    let dropped;
    try {
      dropped = dropBoardCommentsLocked(paths, nums.map(Number), dry);
    } catch (e) {
      if (e instanceof CommentsRejected) refuse(e.message);
      throw e;
    } finally {
      unlock(paths.lock);
    }
    out(`comments: ${dry ? "dry run, would drop" : "dropped"} ${dropped.length} line(s)${dry ? " -- nothing written" : ""}`);
    for (const c of dropped) out(`  ${c.line}: ${c.text}`);
    return;
  }
  const unknown = args2.filter((a) => a !== "--json");
  if (unknown.length) refuse(`/cyberine-taskboard:tasks comments: unknown argument(s): ${unknown.join(" ")} -- usage: comments [--json] | comments drop <line...> [--dry]`);
  const comments = listBoardComments(paths);
  if (hasFlag(args2, "--json")) {
    out(JSON.stringify({ schema: "board-comments/1", manifest: paths.manifest, comments }));
    return;
  }
  if (comments.length === 0) {
    out("comments: no comment lines outside task blocks");
    return;
  }
  const width = String(comments[comments.length - 1].line).length;
  for (const c of comments) {
    const tag = c.managed ? "managed  " : c.staleIds ? "stale-ids" : "         ";
    out(`${String(c.line).padStart(width)}  ${tag}  ${c.text}`);
  }
  const stale = comments.filter((c) => c.staleIds && !c.managed).length;
  out("");
  out(`comments: ${comments.length} line(s), ${stale} stale-ids (a hint, not a verdict: read the lines around it first)`);
  out("  drop with: /cyberine-taskboard:tasks comments drop <line...> --dry, then the same without --dry");
}
function runMove(paths, args2) {
  const [moveId, ...rest] = args2;
  const beforeIdx = rest.indexOf("--before");
  const afterIdx = rest.indexOf("--after");
  const hasBefore = beforeIdx !== -1;
  const hasAfter = afterIdx !== -1;
  if (!moveId || hasBefore === hasAfter) {
    refuse("/cyberine-taskboard:tasks move: usage: move <id> --before|--after <anchor-id>");
  }
  const position = hasBefore ? "before" : "after";
  const anchorId = rest[(hasBefore ? beforeIdx : afterIdx) + 1];
  if (!anchorId) refuse(`/cyberine-taskboard:tasks move: usage: move <id> --${position} <anchor-id>`);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    refuse("/cyberine-taskboard:tasks move: reconcile lock busy, aborting (nothing written)");
  }
  let message;
  try {
    message = moveTask(paths, moveId, position, anchorId);
  } catch (e) {
    if (e instanceof MoveRejected) refuse(e.message);
    throw e;
  } finally {
    unlock(paths.lock);
  }
  out(message);
}
function runReconcile(paths, args2) {
  if (hasFlag(args2, "--dry-run") || hasFlag(args2, "--dry")) {
    const { pending, plan, changedIds } = reconcileDryRun(paths);
    out(`reconcile --dry-run: ${paths.manifest}`);
    out(`  ${pending} overlay line(s) pending`);
    if (!plan) {
      out("  no manifest -- nothing to bake");
      return;
    }
    if (plan.out === null) {
      out("  REFUSED: the header-count guard would reject this bake (manifest would be left untouched)");
      process.exitCode = 1;
      return;
    }
    const src = readFileSync11(paths.manifest, "utf8");
    out(`  ${plan.out === src ? "no" : "some"} manifest bytes would change`);
    out(`  ${plan.overlay.size} id(s) in the folded overlay${changedIds.length ? `: ${changedIds.join(", ")}` : ""}`);
    if (plan.evidence.size) out(`  ${plan.evidence.size} evidence field(s) would be baked`);
    if (plan.completed.size) out(`  ${plan.completed.size} completed: date(s) would be baked from the flip epoch`);
    if (plan.orphans.length) out(`  ${plan.orphans.length} orphan overlay id(s) would be DISCARDED: ${plan.orphans.join(", ")}`);
    out("  nothing was written");
    return;
  }
  const scoped = boardScopeFilter(paths, args2);
  if (reconcile(paths, scoped.keep)) {
    out(`reconciled overlay -> ${paths.manifest}`);
    if (scoped.scope) out(`scoped to submodule ${scoped.scope}/: flips for tasks elsewhere on the hub board stay pending (run reconcile from the hub root, or add --board-wide).`);
  } else process.exitCode = 1;
}
function runDoctor(paths) {
  emitLint(paths, true);
  const report = analyze(gatherDoctorInputs(paths));
  out(formatReport(report));
  const manifests = existingManifests(paths.root);
  if (manifests.length > 1) {
    out(`
10) Multiple manifests -- ${manifests[0]} hides ${manifests.slice(1).join(", ")}`);
    out("  Resolve the competing boards before making further board changes.");
  }
  const identity = boardIdentityProblem(paths.root, paths.manifest);
  if (identity !== null) out(`
11) Board identity -- ${identity}`);
  const hub = shadowedHubBoard(paths.root);
  if (hub !== null) out(`
12) Shadowed hub board -- ${paths.manifest} shadows ${hub}; this submodule reads and writes its own board, not the hub's.`);
  if (hasBlockingFindings(report) || manifests.length > 1 || identity !== null) process.exitCode = 1;
}
function runMerge(paths, args2) {
  if (args2[0] === "--reject") {
    const a = args2[1];
    const b = args2[2];
    if (!a || !b) refuse("/cyberine-taskboard:tasks merge: usage: merge --reject <a-id> <b-id>");
    out(withLock(paths, () => rejectIds(paths, a, b)));
    return;
  }
  const dup = args2[0];
  const survivor = args2[1];
  if (!dup || !survivor) {
    refuse("/cyberine-taskboard:tasks merge: usage: merge <dup-id> <survivor-id>  |  merge --reject <a-id> <b-id>");
  }
  out(withLock(paths, () => mergeIds(paths, dup, survivor)));
}
var DROP_USAGE = `usage: /cyberine-taskboard:tasks drop <id...> [--reason "<why>"] [--dry]

  Remove live tasks you will not do: the block leaves the board, its brief is
  deleted, and the journal records one "dropped" note (with --reason as its body).
  Earlier journal history for the task stays. Refuses [done] (archive it) and
  [forbidden] (a tombstone), archived ids, and ids a surviving task still depends on.

  --reason <why>  body of the journal note
  --dry           print what would be removed, change nothing`;
function runDrop(paths, args2) {
  const ids = [];
  let reason = "";
  let dry = false;
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "-h" || a === "--help") {
      out(DROP_USAGE);
      return;
    }
    if (a === "--dry") dry = true;
    else if (a === "--reason") {
      const value = args2[++i];
      if (value === void 0 || value.startsWith("--")) {
        refuse(`/cyberine-taskboard:tasks drop: --reason expects a value, got ${value === void 0 ? "nothing" : `the next flag "${value}"`}. Use --reason=<value> for a value that starts with --.`);
      }
      reason = value.replace(/\s+/g, " ").trim();
    } else if (a.startsWith("--reason=")) {
      reason = a.slice("--reason=".length).replace(/\s+/g, " ").trim();
    } else if (a.startsWith("-")) {
      refuse(`/cyberine-taskboard:tasks drop: unknown flag: ${a} -- nothing removed

${DROP_USAGE}`);
    } else ids.push(a);
  }
  if (ids.length === 0) refuse(`/cyberine-taskboard:tasks drop: at least one <id> is required

${DROP_USAGE}`);
  if (dry) {
    const targets = planDrop(paths, ids);
    for (const r of targets) out(`would drop ${describeDrop(r)}`);
    return;
  }
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing removed)");
    process.exit(1);
  }
  try {
    if (!reconcileLocked(paths)) {
      warn("/cyberine-taskboard:tasks drop: reconcile refused (see above) -- nothing removed");
      process.exitCode = 1;
      return;
    }
    const targets = planDrop(paths, ids);
    applyDrop(paths, targets, reason);
    for (const r of targets) out(`dropped ${describeDrop(r)}`);
  } finally {
    unlock(paths.lock);
  }
}
var FORGET_USAGE = `usage: /cyberine-taskboard:tasks forget <id...> [--dry]

  Erase every trace of the ids, live or archived: manifest block, TASKS_ARCHIVE.md
  block, briefs in tasks/ and tasks/archive/, every journal event carrying the id,
  and dedupe-ledger entries naming it. Nothing records that it happened. Works on
  ids whose block is already gone but whose brief or journal events remain. The only
  way to remove an archived, [done] or [forbidden] id -- \`drop\` refuses those.

  --dry           print what would be removed, change nothing`;
function runForget(paths, args2) {
  const ids = [];
  let dry = false;
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "-h" || a === "--help") {
      out(FORGET_USAGE);
      return;
    }
    if (a === "--dry") dry = true;
    else if (a.startsWith("-")) refuse(`/cyberine-taskboard:tasks forget: unknown flag: ${a} -- nothing removed

${FORGET_USAGE}`);
    else ids.push(a);
  }
  if (ids.length === 0) refuse(`/cyberine-taskboard:tasks forget: at least one <id> is required

${FORGET_USAGE}`);
  if (dry) {
    const targets = planForget(paths, ids);
    for (const r of targets) out(`would forget ${describeForget(r)}`);
    return;
  }
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing removed)");
    process.exit(1);
  }
  try {
    if (!reconcileLocked(paths)) {
      warn("/cyberine-taskboard:tasks forget: reconcile refused (see above) -- nothing removed");
      process.exitCode = 1;
      return;
    }
    const targets = planForget(paths, ids);
    applyForget(paths, targets);
    for (const r of targets) out(`forgot ${describeForget(r)}`);
  } finally {
    unlock(paths.lock);
  }
}
function runLog(paths, args2) {
  let by = "";
  const descs = [];
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--by") by = args2[++i] ?? "";
    else if (a.startsWith("--by=")) by = a.slice(5);
    else if (a === "--") {
      descs.push(...args2.slice(i + 1));
      break;
    } else if (a.startsWith("-")) refuse(`/cyberine-taskboard:tasks log: unknown flag: ${a}`);
    else descs.push(a);
  }
  if (descs.length === 0) {
    refuse('/cyberine-taskboard:tasks log: usage: log [--by <model>] "<what was done>" ["<...>" ...]');
  }
  const logged = withLock(paths, () => {
    const written = logDone(paths, descs, by);
    appendJournalEvents(
      paths,
      written.map((w) => ({
        ts: epochToLocalIso(Math.floor(Date.now() / 1e3)),
        kind: "done",
        id: w.id,
        title: w.desc,
        by: agentTag()
      }))
    );
    return written;
  });
  out(`logged ${logged.length} done task(s) -> ${paths.archive}`);
  for (const l of logged) out(`  ${l.id}  ${l.desc}`);
}
var NOTE_USAGE = `usage: /cyberine-taskboard:tasks note <id> "<text>" [--source peer:<session>|user|agent (--verified "<how>" | --unverified)]

Appends one dated line to the task's manifest block, below its fields:
  update <YYYY-MM-DD>: <text>
and records the same text as a journal note attached to <id>. The line is
not field-shaped, so every parser reads past it. <id> accepts an unambiguous
prefix; recurring R<NN> and archived ids are refused.

--source records where the text came from. A peer source (another session's
message) REQUIRES exactly one of --verified "<how you checked it against the
repo or the screen>" or --unverified, else nothing is written. The line then
ends with:
  [source: peer:<session>; verified: <how>|no]
and \`/cyberine-taskboard:tasks doctor\` lists the ones marked no.`;
var BRIEF_NOTE_USAGE = `usage: /cyberine-taskboard:tasks brief note <id> "<text>" [--source peer:<session>|user|agent (--verified "<how>" | --unverified)]

Adds one dated entry to the "## Updates" section at the TOP of tasks/<id>.md,
creating the section above the first heading when absent:
  - <YYYY-MM-DD>: <text>
Entries append oldest-first. The six brief sections are never rewritten.
Records the same text as a journal note attached to <id>. Refuses a task that
has no brief (use \`note <id>\` for the manifest block instead). --source works
as on \`note\`: a peer source needs --verified or --unverified, and the entry
ends with [source: ...; verified: ...].`;
var INBOX_REJECT_USAGE = `usage: /cyberine-taskboard:tasks inbox reject <draft-*.md...> --reason "<why>"
       /cyberine-taskboard:tasks inbox reject --all --reason "<why>"

Moves each named pending draft (a bare basename from /cyberine-taskboard:tasks inbox), or every pending
draft with --all, into .local/tasks/drafts/rejected/ and records one journal note per draft
with the reason. --reason is required. Nothing moves when any name is unknown or already
rejected. Move a file back into drafts/ to restore it.`;
function runInboxReject(paths, args2) {
  if (args2.includes("-h") || args2.includes("--help")) {
    out(INBOX_REJECT_USAGE);
    return;
  }
  const reason = flagValue(args2, "--reason");
  const all = args2.includes("--all");
  const names = [];
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--reason") i++;
    else if (a.startsWith("--reason=") || a === "--all") continue;
    else if (a.startsWith("-")) refuse(`/cyberine-taskboard:tasks inbox reject: unknown flag ${a}

${INBOX_REJECT_USAGE}`);
    else names.push(a);
  }
  if (reason === void 0 || reason.trim() === "") refuse(`/cyberine-taskboard:tasks inbox reject: --reason "<why>" is required

${INBOX_REJECT_USAGE}`);
  if (all && names.length) refuse("/cyberine-taskboard:tasks inbox reject: give draft names or --all, not both");
  const targets = all ? draftNames(paths.draftsDir) : [...new Set(names)];
  if (targets.length === 0) refuse(all ? "/cyberine-taskboard:tasks inbox reject: no pending drafts" : `/cyberine-taskboard:tasks inbox reject: name at least one draft, or --all

${INBOX_REJECT_USAGE}`);
  const errors = rejectDraftErrors(paths.draftsDir, targets);
  if (errors.length) refuse(`/cyberine-taskboard:tasks inbox reject: nothing moved:
${errors.map((e) => `  - ${e}`).join("\n")}`);
  const moved = rejectDrafts(paths.draftsDir, targets);
  const ts = epochToLocalIso(Math.floor(Date.now() / 1e3));
  try {
    appendJournalEvents(paths, moved.map((name) => ({ ts, kind: "note", title: `rejected draft ${name}: ${reason.trim()}`, by: agentTag() })));
  } catch (e) {
    warn(`inbox reject: moved, but the journal append FAILED -- ${e.message}`);
    process.exitCode = 1;
  }
  out(`rejected ${moved.length} draft(s) into ${join7(paths.draftsDir, "rejected")}:`);
  for (const name of moved) out(`  ${name}`);
}
function journalNoteEvent(paths, id, title, cmd) {
  try {
    appendJournalEvents(paths, [
      { ts: epochToLocalIso(Math.floor(Date.now() / 1e3)), kind: "note", id, title, by: agentTag() }
    ]);
  } catch (e) {
    warn(`${cmd}: written, but the journal append FAILED -- ${e.message}`);
    process.exitCode = 1;
  }
}
function runNote(paths, args2) {
  if (args2[0] === "-h" || args2[0] === "--help") {
    out(NOTE_USAGE);
    return;
  }
  const provenance = provenanceFromArgs(args2, "note");
  const parsed = parseIdAndText(stripProvenanceArgs(args2), "note", NOTE_USAGE);
  const text = `${parsed.text}${noteSuffix(provenance.source, provenance.verified)}`;
  const { id, line } = withLock(paths, () => {
    const resolvedId = resolveLiveTaskId(paths, parsed.rawId, "note");
    const appendedLine = appendUpdateLine(paths.manifest, resolvedId, text);
    return { id: resolvedId, line: appendedLine };
  });
  out(`${id}: ${line}`);
  journalNoteEvent(paths, id, `note ${id}: ${text}`, "note");
}
function runBrief(paths, args2) {
  const [sub2, ...rest] = args2;
  if (!sub2 || sub2 === "-h" || sub2 === "--help") {
    out(BRIEF_NOTE_USAGE);
    if (!sub2) process.exitCode = 1;
    return;
  }
  if (sub2 !== "note") {
    refuse(`/cyberine-taskboard:tasks brief: unknown subcommand: ${sub2}

${BRIEF_NOTE_USAGE}`);
  }
  const provenance = provenanceFromArgs(rest, "brief note");
  const parsed = parseIdAndText(stripProvenanceArgs(rest), "brief note", BRIEF_NOTE_USAGE);
  const text = `${parsed.text}${noteSuffix(provenance.source, provenance.verified)}`;
  const id = withLock(paths, () => {
    const resolvedId = resolveLiveTaskId(paths, parsed.rawId, "brief note");
    addBriefUpdate(join7(paths.tasksDir, `${resolvedId}.md`), text);
    return resolvedId;
  });
  out(`${id}: brief updated (${UPDATES_HEADING})`);
  journalNoteEvent(paths, id, `brief note ${id}: ${text}`, "brief note");
}
function runDecide(paths, args2) {
  const values = /* @__PURE__ */ new Map();
  const positional = [];
  let ack = false;
  let all = false;
  const valueFlags = /* @__PURE__ */ new Set(["--choice", "--rejected", "--reason", "--status", "--by", "--revert"]);
  for (let i = 0; i < args2.length; i++) {
    const arg = args2[i];
    if (arg === "--ack" || arg === "--all") {
      if (arg === "--ack" && ack || arg === "--all" && all) refuse(`/cyberine-taskboard:tasks decide: duplicate flag: ${arg}`);
      if (arg === "--ack") ack = true;
      else all = true;
    } else if (valueFlags.has(arg)) {
      if (values.has(arg)) refuse(`/cyberine-taskboard:tasks decide: duplicate flag: ${arg}`);
      const value = args2[++i];
      if (!value?.trim() || value.startsWith("--")) refuse(`/cyberine-taskboard:tasks decide: ${arg} requires a non-empty value`);
      values.set(arg, value);
    } else if (arg.startsWith("-")) refuse(`/cyberine-taskboard:tasks decide: unknown flag: ${arg}`);
    else positional.push(arg);
  }
  const revert = values.get("--revert");
  if (ack) {
    if (values.size || all && positional.length) refuse("/cyberine-taskboard:tasks decide: usage: decide --ack <ref...>|--all");
    if (!all && (!positional.length || positional.some((ref) => !ref.trim()))) refuse("/cyberine-taskboard:tasks decide: --ack requires <ref...> or --all");
  } else if (revert !== void 0) {
    if (all || positional.length || values.size !== 2 || !values.has("--reason")) refuse('/cyberine-taskboard:tasks decide: usage: decide --revert <ref> --reason "<why>"');
  } else {
    if (all || positional.length !== 1 || !TASK_ID_RE.test(positional[0])) refuse("/cyberine-taskboard:tasks decide: a valid task id is required");
    for (const flag of ["--choice", "--rejected", "--reason"]) {
      if (!values.has(flag)) refuse(`/cyberine-taskboard:tasks decide: ${flag} requires a non-empty value`);
    }
    const status = values.get("--status") ?? "auto";
    if (status !== "auto" && status !== "owner") refuse("/cyberine-taskboard:tasks decide: --status must be auto or owner");
  }
  assertBoardWritable(paths.manifest);
  if (!lock(paths.lock)) {
    process.exitCode = 1;
    return;
  }
  let written;
  try {
    const events = readJournalEvents(paths);
    const by = values.get("--by") ?? agentTag();
    const ts = nextDecisionTimestamp(events, by);
    const findDecided = (ref) => events.find((ev) => ev.kind === "decided" && journalEventRef(ev) === ref);
    if (ack && !all) {
      const refs = [...new Set(positional)];
      const unknown = refs.filter((ref) => !findDecided(ref));
      if (unknown.length) throw new BoardRejected(`/cyberine-taskboard:tasks decide: no decided event matches ref: ${unknown.join(", ")}`);
      written = refs.map((ref) => ({ ts, kind: "ack", by, ref }));
    } else if (ack && submoduleScope(process.cwd())) {
      const scope = submoduleScope(process.cwd());
      const refs = unreviewedDecisions(paths, scope).map((d) => d.ref);
      if (refs.length === 0) throw new BoardRejected(`/cyberine-taskboard:tasks decide: no unreviewed decision on a task in scope ${scope}/ -- nothing to ack (run from the hub root to ack the whole board)`);
      out(`acking ${refs.length} decision(s) on tasks in scope ${scope}/; decisions elsewhere on the hub board stay unreviewed`);
      written = refs.map((ref) => ({ ts, kind: "ack", by, ref }));
    } else if (ack) {
      written = [{ ts, kind: "ack", by, all: true }];
    } else if (revert !== void 0) {
      const referenced = findDecided(revert);
      if (!referenced) throw new BoardRejected(`/cyberine-taskboard:tasks decide: no decided event matches ref: ${revert}`);
      written = [{
        ts,
        kind: "decided",
        by,
        status: "reverted",
        ref: revert,
        id: referenced.id,
        title: referenced.title,
        choice: referenced.choice,
        reason: values.get("--reason")
      }];
    } else {
      const id = positional[0];
      const title = parseManifestBlocks(readFileSync11(paths.manifest, "utf8"), TASK_ID_RE).blocks.find((block) => block.id === id)?.title;
      written = [{
        ts,
        kind: "decided",
        id,
        ...title !== void 0 && { title },
        by,
        choice: values.get("--choice"),
        rejected: values.get("--rejected"),
        reason: values.get("--reason"),
        status: values.get("--status") ?? "auto"
      }];
    }
    appendJournalEvents(paths, written);
  } finally {
    unlock(paths.lock);
  }
  out(ack && !all ? `acked ${written.length} decision(s): ${written.map((ev) => ev.ref).join(", ")}` : journalEventRef(written[0]));
}
function runJournal(paths, args2) {
  let title = "";
  let titleOverride;
  let body = "";
  let id = "";
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--title") titleOverride = args2[++i] ?? "";
    else if (a === "--body") body = args2[++i] ?? "";
    else if (a === "--id") id = args2[++i] ?? "";
    else if (a.startsWith("-")) refuse(`/cyberine-taskboard:tasks journal: unknown flag: ${a}`);
    else if (!title) title = a;
    else refuse(`/cyberine-taskboard:tasks journal: unexpected argument: ${a}`);
  }
  const ts = epochToLocalIso(Math.floor(Date.now() / 1e3));
  const day = ts.slice(0, 10);
  mkdirSync3(dirname5(paths.manifest), { recursive: true });
  if (titleOverride !== void 0) {
    if (title || body || id) {
      refuse("/cyberine-taskboard:tasks journal: --title overrides the day title; it cannot be combined with a note");
    }
    if (!titleOverride.trim()) refuse('/cyberine-taskboard:tasks journal: --title requires non-empty "<text>"');
    appendJournalEvents(paths, [{ ts, kind: "title", v: titleOverride }]);
    out(`journal: title added to ${day}.jsonl`);
    return;
  }
  if (!title.trim()) refuse('/cyberine-taskboard:tasks journal: a "<title>" is required');
  if (id && !TASK_ID_RE.test(id)) refuse(`/cyberine-taskboard:tasks journal: --id must be a valid task id, got: ${id}`);
  const event = { ts, kind: "note", id: id || "-", title, by: agentTag() };
  if (body.trim()) event.body = body;
  appendJournalEvents(paths, [event]);
  out(`journal: note added to ${day}.jsonl`);
}
function localTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function runTimeline(paths, args2) {
  if (args2.length === 0) {
    const days = listJournalDaysFolded(paths);
    if (days.length === 0) {
      out("no journal yet");
      return;
    }
    const byMonth = /* @__PURE__ */ new Map();
    for (const day of days) {
      const month = day.slice(0, 7);
      const bucket = byMonth.get(month);
      if (bucket) bucket.push(day);
      else byMonth.set(month, [day]);
    }
    for (const month of [...byMonth.keys()].sort().reverse()) {
      out(month);
      for (const day of byMonth.get(month).sort().reverse()) {
        const events2 = readJournalDayFolded(paths, day);
        out(`  ${day.slice(5)}  ${deriveDayTitle(events2)}`);
        for (const ev of events2) {
          if (ev.kind === "ack") out(`    ${localTime(ev.ts)} ack ${ev.all ? "all decisions at or before this timestamp" : ev.ref ?? ""} (${journalEventRef(ev)})`);
          if (ev.kind !== "decided" || ev.status === void 0) continue;
          out(`    ${localTime(ev.ts)} ${ev.id ?? "-"} [${ev.status}] (${journalEventRef(ev)})`);
          if (ev.choice !== void 0) out(`      choice: ${ev.choice}`);
          if (ev.rejected !== void 0) out(`      rejected: ${ev.rejected}`);
          if (ev.reason !== void 0) out(`      reason: ${ev.reason}`);
          if (ev.ref !== void 0) out(`      ref: ${ev.ref}`);
        }
      }
    }
    return;
  }
  if (args2[0] === "--grep") {
    const pattern = args2[1];
    if (!pattern || args2.length > 2) refuse("/cyberine-taskboard:tasks timeline: usage: timeline --grep <pattern>");
    let re;
    try {
      re = new RegExp(pattern, "i");
    } catch (e) {
      refuse(`/cyberine-taskboard:tasks timeline: invalid pattern: ${e.message}`);
    }
    const days = listJournalDaysFolded(paths);
    if (days.length === 0) {
      out("no journal yet");
      return;
    }
    for (const day of days) {
      for (const ev of readJournalDayFolded(paths, day)) {
        const lines = [];
        if (ev.title !== void 0) lines.push(ev.title);
        if (ev.body !== void 0) lines.push(...ev.body.split("\n"));
        if (ev.v !== void 0) lines.push(ev.v);
        if (ev.evidence !== void 0) lines.push(ev.evidence);
        for (const value of [ev.choice, ev.rejected, ev.reason, ev.status, ev.ref]) if (value !== void 0) lines.push(value);
        if (ev.kind === "ack") lines.push(ev.all ? "ack all decisions" : `ack ${ev.ref ?? ""}`);
        const hit = lines.find((line) => re.test(line));
        if (hit !== void 0) out(`${day}  ${ev.kind}  ${ev.id ?? "-"}  ${hit}`);
      }
    }
    return;
  }
  const date = args2[0];
  if (args2.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    refuse("/cyberine-taskboard:tasks timeline: usage: timeline [<YYYY-MM-DD>] [--grep <pattern>]");
  }
  if (!listJournalDaysFolded(paths).includes(date)) {
    warn(`no journal for ${date}`);
    process.exitCode = 1;
    return;
  }
  const events = readJournalDayFolded(paths, date);
  out(`## ${date} -- ${deriveDayTitle(events)}`);
  const done = events.filter((e) => e.kind === "done");
  if (done.length) {
    out("");
    for (const ev of done) {
      const line = `${localTime(ev.ts)}  ${ev.id}  ${ev.title ?? ""}`;
      out(ev.evidence ? `${line}  -- evidence: ${ev.evidence}` : line);
    }
  }
  for (const ev of events.filter((e) => e.kind === "decided" || e.kind === "ack")) {
    out("");
    if (ev.kind === "ack") {
      out(`${localTime(ev.ts)}  ack ${ev.all ? "all decisions at or before this timestamp" : ev.ref ?? ""} (${journalEventRef(ev)})`);
      continue;
    }
    out(`### ${ev.id} -- ${ev.title ?? ""}${ev.status ? ` [${ev.status}] (${journalEventRef(ev)})` : ""}`);
    if (ev.choice !== void 0) out(`choice: ${ev.choice}`);
    if (ev.rejected !== void 0) out(`rejected: ${ev.rejected}`);
    if (ev.reason !== void 0) out(`reason: ${ev.reason}`);
    if (ev.ref !== void 0) out(`ref: ${ev.ref}`);
    if (ev.body) out(ev.body);
  }
  for (const ev of events.filter((e) => e.kind === "note")) {
    out("");
    out(`### note -- ${ev.title ?? ""}`);
    if (ev.body) out(ev.body);
  }
}
function runUnlogged(paths, args2) {
  let since = DEFAULT_UNLOGGED_WINDOW;
  let json = false;
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--json") json = true;
    else if (a === "--since") {
      const v = args2[++i];
      if (v === void 0 || v.startsWith("--") || !v.trim()) refuse("/cyberine-taskboard:tasks unlogged: --since needs a git ref or a date");
      since = v;
    } else refuse(`/cyberine-taskboard:tasks unlogged: unknown argument: ${a}
usage: /cyberine-taskboard:tasks unlogged [--since <ref|date>] [--json]`);
  }
  let report;
  try {
    report = unloggedReport(paths.root, knownTaskIds(paths.manifest, paths.archive), since);
  } catch (e) {
    warn(`/cyberine-taskboard:tasks unlogged: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  if (json) out(JSON.stringify(report));
  else process.stdout.write(formatUnlogged(report));
}
function runCorpus(paths, args2) {
  let recent = 30;
  const i = args2.indexOf("--recent");
  if (i !== -1) {
    const n = Number(args2[i + 1]);
    if (!Number.isInteger(n) || n < 0) {
      refuse(`/cyberine-taskboard:tasks corpus: --recent needs a non-negative integer, got ${JSON.stringify(args2[i + 1])}`);
    }
    recent = n;
  }
  const full = args2.includes("--full");
  const manifestSrc = readFileSync11(paths.manifest, "utf8");
  const parsed = parseManifestBlocks(manifestSrc, TASK_ID_RE);
  for (const w of parsed.warnings) warn(w);
  const effective = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const toRecord = (b, source, statusOverride) => {
    const area = (b.fields.get("area") ?? "").trim();
    const why = b.fields.get("why")?.trim();
    const effort = b.fields.get("effort")?.trim();
    const fullFields = () => {
      const text = (name) => b.fields.get(name)?.trim() || null;
      const deps = (b.fields.get("deps") ?? "").split(/[,\s]+/).filter((d) => d && d !== "-");
      return { exec: text("exec"), model: text("model"), deps, doneWhen: text("done-when"), blocker: text("blocker") };
    };
    return {
      id: b.id,
      status: statusOverride ?? b.status ?? "",
      title: b.title,
      do: b.fields.get("do") ?? "",
      why: why ? why : null,
      effort: effort ? effort : null,
      area: area ? area.split(/\s+/) : [],
      path: b.fields.get("path") ?? null,
      source,
      ...full ? fullFields() : {}
    };
  };
  for (const b of parsed.blocks) out(JSON.stringify(toRecord(b, "manifest", effective.get(b.id))));
  const archiveBlocks = existsSync10(paths.archive) ? parseManifestBlocks(readFileSync11(paths.archive, "utf8"), TASK_ID_RE).blocks : [];
  const shown = recent >= archiveBlocks.length ? archiveBlocks : archiveBlocks.slice(archiveBlocks.length - recent);
  if (archiveBlocks.length > 0) {
    out(JSON.stringify({ meta: true, source: "archive", shown: shown.length, total: archiveBlocks.length, recent }));
  }
  for (const b of shown) out(JSON.stringify(toRecord(b, "archive")));
  warn(
    `corpus: ${parsed.blocks.length} manifest task(s), ${archiveBlocks.length} archive task(s) (showing ${shown.length})`
  );
}
var BOARD_USAGE = `usage: /cyberine-taskboard:tasks board [--out <file>] [--open] [--json] [--archive-recent N] [--journal-days N]

  Render a READ-ONLY static HTML snapshot of this board -- a Kanban by effective
  status, a sortable table, and recurring/archive/journal tabs, with a search box
  and model/area/exec filters. The page is one self-contained file (inline CSS/JS,
  no network requests) and nothing on it writes the board; regenerate it by hand.

  --out <file>          write the page elsewhere than .local/tasks/board.html
  --open                open the page in the default browser after writing
  --json                print the page's data as JSON on stdout, write no file
  --archive-recent N    archive rows to embed (default ${DEFAULT_ARCHIVE_RECENT}; 0 for none)
  --journal-days N      journal days to embed (default ${DEFAULT_JOURNAL_DAYS}; 0 for none)`;
function numberArg(raw, flag) {
  const value = Number(raw);
  if (raw === void 0 || !Number.isInteger(value) || value < 0) {
    refuse(`/cyberine-taskboard:tasks board: ${flag} needs a non-negative integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}
function openInBrowser(file) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "linux" ? "xdg-open" : null;
  if (!cmd) return false;
  try {
    return spawnSync2(cmd, [file], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}
function runBoard(paths, args2) {
  if (args2.includes("-h") || args2.includes("--help")) {
    out(BOARD_USAGE);
    return;
  }
  let outFile;
  let json = false;
  let shouldOpen = false;
  let archiveRecent = DEFAULT_ARCHIVE_RECENT;
  let journalDays2 = DEFAULT_JOURNAL_DAYS;
  for (let i = 0; i < args2.length; i++) {
    const a = args2[i];
    if (a === "--no-open") shouldOpen = false;
    else if (a === "--open") shouldOpen = true;
    else if (a === "--json") json = true;
    else if (a === "--out" || a.startsWith("--out=")) {
      const value = a === "--out" ? args2[++i] : a.slice("--out=".length);
      if (value === void 0 || value.startsWith("--")) {
        refuse(`/cyberine-taskboard:tasks board: --out expects a file path, got ${value === void 0 ? "nothing" : `the next flag "${value}"`}. Use --out=<path> for a path that starts with --.`);
      }
      outFile = value;
    } else if (a === "--archive-recent" || a.startsWith("--archive-recent=")) {
      archiveRecent = numberArg(a === "--archive-recent" ? args2[++i] : a.slice("--archive-recent=".length), "--archive-recent");
    } else if (a === "--journal-days" || a.startsWith("--journal-days=")) {
      journalDays2 = numberArg(a === "--journal-days" ? args2[++i] : a.slice("--journal-days=".length), "--journal-days");
    } else {
      refuse(`/cyberine-taskboard:tasks board: unknown argument ${JSON.stringify(a)}

${BOARD_USAGE}`);
    }
  }
  const data = buildBoardData(paths, { archiveRecent, journalDays: journalDays2 });
  if (json) {
    out(JSON.stringify(data));
    return;
  }
  const target = outFile ?? join7(paths.root, ".local", "tasks", "board.html");
  mkdirSync3(dirname5(target), { recursive: true });
  writeFileSync2(target, renderBoardHtml(data));
  const counts = data.tasks.reduce((acc, t) => {
    acc[t.eff] = (acc[t.eff] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" \xB7 ");
  out(target);
  out(`${data.tasks.length} tasks (${summary || "empty"}) \xB7 ${data.recurring.length} recurring \xB7 ${data.archive.length} archived \xB7 ${data.journal.length} journal days`);
  if (shouldOpen && !openInBrowser(target)) {
    warn("/cyberine-taskboard:tasks board: could not launch a browser; open the file above by hand");
  }
}
function runMigrate(paths, args2) {
  const KNOWN = /* @__PURE__ */ new Set(["--dry", "--dry-run"]);
  const unknown = args2.filter((a) => !KNOWN.has(a));
  if (unknown.length) refuse(`/cyberine-taskboard:tasks migrate: unknown argument(s): ${unknown.join(" ")} -- usage: migrate [--dry]`);
  const dry = args2.some((a) => KNOWN.has(a));
  const src = readFileSync11(paths.manifest, "utf8");
  const strict = parseManifestBlocks(src);
  if (strict.blocks.length > 0 && !strict.legacy) {
    out(
      `migrate: nothing to do -- ${paths.manifest} already parses as ${strict.blocks.length} block(s) in the canonical format.`
    );
    return;
  }
  const board = parseLegacyBoard(src);
  if (!board) {
    const n = nonBlankLineCount(src);
    out(`migrate: nothing to do -- no legacy task shape found in ${paths.manifest} (${n} non-blank line(s)).`);
    return;
  }
  if (board.blocks.length === 0) {
    out(`migrate: nothing convertible in ${paths.manifest} -- every legacy entry carries an id that is not a real task id.`);
    for (const g of board.ghostLines) out(`    line ${g.line}: "${g.id}" ${g.text}`);
    return;
  }
  if (dry) {
    const result = migrateLegacySource(src);
    out(`migrate --dry: ${paths.manifest}`);
    out(`  format: legacy ${result.kind}, ${result.count} task(s) -- nothing written`);
    for (const b of board.blocks) out(`  ${b.id} [${b.status}] ${b.title}`);
    for (const g of board.ghostLines) out(`    line ${g.line}: "${g.id}" ${g.text}`);
    out(`  ${src.split("\n").length} line(s) -> ${result.out.split("\n").length} line(s) (every non-task line passes through unchanged)`);
    return;
  }
  assertBoardWritable(paths.manifest);
  if (!lock(paths.lock)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing written)");
    process.exit(1);
  }
  try {
    const r = ensureMigrated(paths.manifest);
    if (!r.migrated) {
      out("migrate: nothing to do (another process appears to have migrated it already).");
      return;
    }
    out(`migrate: converted ${r.count} task(s) from the legacy ${r.kind} format`);
    out(`  manifest: ${paths.manifest}`);
    out(`  backup:   ${r.backup}`);
    out("  Every non-task line was passed through unchanged. Review the result before relying on it:");
    out(`    diff "${r.backup}" "${paths.manifest}"`);
  } finally {
    unlock(paths.lock);
  }
}
async function runSplit(paths, args2) {
  if (hasFlag(args2, "--schema")) {
    out(SPLIT_SCHEMA_TEXT);
    return;
  }
  const id = positionals(args2, ["--input"])[0];
  if (!id) refuse("/cyberine-taskboard:tasks split: usage: split <id> --input <file|-> [--dry]");
  const inputPath = flagValue(args2, "--input");
  if (inputPath === void 0) refuse("/cyberine-taskboard:tasks split: --input <file|-> is required -- see split --schema");
  let raw;
  if (inputPath !== "-") {
    if (!existsSync10(inputPath)) refuse(`/cyberine-taskboard:tasks split: no such input file: ${inputPath}`);
    raw = readFileSync11(inputPath, "utf8");
  } else {
    raw = await readStdin();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    refuse(`/cyberine-taskboard:tasks split: invalid JSON -- ${e.message}`);
  }
  const input = parseSplitInput(parsed);
  const resolved = resolveIdPrefix(id, new Set(parseManifestBlocks(readFileSync11(paths.manifest, "utf8"), TASK_ID_RE).blocks.map((b) => b.id))) ?? id;
  const result = withLock(paths, () => splitTask(paths, resolved, input, { dry: hasFlag(args2, "--dry") }));
  for (const line of result.lines) out(line);
}
async function runConvergeApply(paths, args2) {
  if (hasFlag(args2, "--schema")) {
    out(SCHEMA_TEXT);
    return;
  }
  const inputPath = flagValue(args2, "--input");
  let raw;
  if (inputPath && inputPath !== "-") {
    if (!existsSync10(inputPath)) refuse(`/cyberine-taskboard:tasks save: no such input file: ${inputPath}`);
    raw = readFileSync11(inputPath, "utf8");
  } else {
    raw = await readStdin();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    refuse(`/cyberine-taskboard:tasks save: invalid JSON -- ${e.message}`);
  }
  const items = parsed.tasks;
  if (!Array.isArray(items)) {
    refuse('/cyberine-taskboard:tasks save: input must be an object shaped { "tasks": [...] } -- see `save --schema`');
  }
  if (items.length === 0) {
    out("save: no tasks in input, nothing to do.");
    return;
  }
  const draftErrors = validateDraftReferences(paths.draftsDir, items);
  if (draftErrors.length) refuse(`save: rejected, nothing written:
${draftErrors.map((error) => `  - ${error}`).join("\n")}`);
  withLock(paths, () => {
    const result = convergeApply(paths, items, out, warn, true, true);
    const decisions = items;
    const { blocks } = parseManifestBlocks(readFileSync11(paths.manifest, "utf8"), TASK_ID_RE);
    for (const created of result.created) {
      const decision = decisions.find((d) => d.title === created.title);
      if (decision === void 0 || typeof decision.do !== "string") continue;
      const block = blocks.find((b) => b.id === created.id);
      for (const issue of (block ? ownerMixForBlock(block, { blocks, archiveBlocks: archivedBlocks(paths.archive) })?.issues : void 0) ?? []) {
        warn(`save: warning: ${created.id}: ${issue}`);
      }
      for (const issue of missingVerifyIssues({ exec: decision.exec, verify: decision.verify })) {
        warn(`save: warning: ${created.id}: ${issue}`);
      }
    }
  });
}
async function runDraft(args2) {
  if (args2.includes("--help") || args2.includes("-h")) {
    out('Usage: /cyberine-taskboard:tasks draft [--to <repo-path>] "<title>" [--do <text>] [--done-when <text>] [--why <text>] [--by <model-id>] [--file <path>|--stdin]');
    return;
  }
  const valueFlags = ["--to", "--do", "--done-when", "--why", "--by", "--file"];
  const unknown = args2.filter((arg) => arg.startsWith("--") && arg !== "--stdin" && !valueFlags.some((flag) => arg === flag || arg.startsWith(`${flag}=`)));
  if (unknown.length) refuse(`/cyberine-taskboard:tasks draft: unknown flag(s): ${unknown.join(" ")}`);
  const titles = positionals(args2, valueFlags);
  if (titles.length !== 1 || !titles[0]?.trim()) refuse('/cyberine-taskboard:tasks draft: a "<title>" is required');
  const file = flagValue(args2, "--file");
  const useStdin = hasFlag(args2, "--stdin");
  if (file && (!existsSync10(file) || !statSync2(file).isFile())) refuse(`/cyberine-taskboard:tasks draft: --file not found: ${file}`);
  const stdin = file || !useStdin ? void 0 : await readStdin();
  if (useStdin && !file && !stdin?.trim()) refuse("/cyberine-taskboard:tasks draft: --stdin given but no input received");
  const result = writeDraft({
    to: flagValue(args2, "--to"),
    title: titles[0],
    doText: flagValue(args2, "--do"),
    doneWhen: flagValue(args2, "--done-when"),
    why: flagValue(args2, "--why"),
    by: flagValue(args2, "--by"),
    file,
    stdin
  });
  out(`drafted: ${result.path.slice(result.root.length + 1)}`);
  out(`  in repo: ${result.root}`);
  out(`  from:    ${result.from}`);
  if (flagValue(args2, "--to")) out(`  NOTE: draft-and-leave -- the next session of ${basename4(result.root)} picks it up.`);
  else out("  next: /cyberine-taskboard:tasks inbox  (this repo)");
}
async function runGuard() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    process.exit(0);
  }
  const decision = shellBoardGuardDecision(payload);
  if (!decision.blocked) process.exit(0);
  process.stderr.write(`${decision.reason ?? "board write refused"}
`);
  process.exit(2);
}
var STATUS_VIEW_FLAGS = /* @__PURE__ */ new Set(["--all", "--summary", "--json"]);
var VERB_ALIASES = { gather: "inbox", "converge-apply": "save" };
function refuseUnknownSubcommand(sub2) {
  warn(`/cyberine-taskboard:tasks: unknown subcommand "${sub2}"

${USAGE}`);
  process.exitCode = 2;
}
var PROMOTION_TRIGGERS = {
  status: (rest) => rest[0] === "done" || rest[0] === "unblock",
  add: () => true,
  deps: (rest) => rest[0] === "set",
  merge: (rest) => rest[0] !== "--reject",
  save: (rest) => !rest.includes("--schema"),
  split: (rest) => !rest.includes("--schema") && !rest.includes("--dry")
};
function afterBoardWrite(paths, sub2, rest) {
  if (process.exitCode) return;
  if (sub2 === "status" && rest[0] === "backlog") {
    warnDemotedWouldRepromote(paths, positionals(rest.slice(1), []));
    return;
  }
  if (PROMOTION_TRIGGERS[sub2]?.(rest)) promoteAfterWrite(paths);
}
async function cmdTasksBoard(argv) {
  const args2 = argv.length === 0 || STATUS_VIEW_FLAGS.has(argv[0]) ? ["status", ...argv] : argv;
  const sub2 = VERB_ALIASES[args2[0] ?? ""] ?? args2[0] ?? "";
  const rest = args2.slice(1);
  if (sub2 === "--help" || sub2 === "-h" || sub2 === "help") {
    out(USAGE);
    return;
  }
  if (rest.length === 1 && (rest[0] === "--help" || rest[0] === "-h") && !SELF_HELP_SUBCOMMANDS.has(sub2)) {
    const usage = subcommandUsage(sub2);
    if (usage) {
      out(usage);
      return;
    }
  }
  if (sub2 === "guard") {
    await runGuard();
    return;
  }
  if (sub2 === "banner") {
    runBanner(rest);
    return;
  }
  const paths = resolveBoard(process.cwd());
  const NO_MANIFEST_REQUIRED = /* @__PURE__ */ new Set(["init", "relocate", "doctor", "journal", "timeline", "log", "draft", "inbox", "suggest"]);
  if (!NO_MANIFEST_REQUIRED.has(sub2)) requireManifest(paths);
  if (sub2 !== "doctor" && sub2 !== "draft" && sub2 !== "inbox") emitLint(paths);
  try {
    switch (sub2) {
      case "init":
        out(initBoard(paths.root, rest));
        return;
      case "relocate": {
        const scope = submoduleScope(process.cwd());
        if (scope && !rest.includes("--board-wide")) {
          refuse(`/cyberine-taskboard:tasks relocate: this session is in submodule ${scope}/ of a hub board; relocating moves the WHOLE hub board -- run it from the hub root, or add --board-wide to do it from here`);
        }
        out(relocateBoard(paths.root, rest.filter((a) => a !== "--board-wide")));
        return;
      }
      case "status":
        runStatus(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "recurring":
        runRecurring(paths, rest);
        return;
      case "add":
        await runAdd(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "set":
        await runSet(paths, rest);
        return;
      case "deps":
        runDeps(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "archive":
        runArchive(paths, rest);
        return;
      case "end":
        runEnd(paths, rest);
        return;
      case "reconcile":
        runReconcile(paths, rest);
        return;
      case "doctor":
        runDoctor(paths);
        return;
      case "merge":
        runMerge(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "drop":
        runDrop(paths, rest);
        return;
      case "forget":
        runForget(paths, rest);
        return;
      case "log":
        runLog(paths, rest);
        return;
      case "note":
        runNote(paths, rest);
        return;
      case "brief":
        runBrief(paths, rest);
        return;
      case "journal":
        runJournal(paths, rest);
        return;
      case "decide":
        runDecide(paths, rest);
        return;
      case "timeline":
        runTimeline(paths, rest);
        return;
      case "corpus":
        runCorpus(paths, rest);
        return;
      case "unlogged":
        runUnlogged(paths, rest);
        return;
      case "board":
        runBoard(paths, rest);
        return;
      case "migrate":
        runMigrate(paths, rest);
        return;
      case "save":
        await runConvergeApply(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "split":
        await runSplit(paths, rest);
        afterBoardWrite(paths, sub2, rest);
        return;
      case "draft":
        await runDraft(rest);
        return;
      case "inbox":
        if (rest[0] === "reject") {
          runInboxReject(paths, rest.slice(1));
          return;
        }
        if (rest.length) refuse(`/cyberine-taskboard:tasks inbox: unexpected argument(s): ${rest.join(" ")}

${INBOX_REJECT_USAGE}`);
        try {
          process.stdout.write(gatherDrafts(paths.root, paths.draftsDir));
        } catch (error) {
          warn(error.message);
          process.exitCode = 1;
        }
        return;
      case "suggest":
        if (rest.length) refuse("/cyberine-taskboard:tasks suggest: no arguments accepted");
        out(suggestReport(paths, process.cwd()).join("\n"));
        return;
      case "tidy":
        runTidy(paths, rest);
        return;
      case "hygiene":
        runHygiene(paths, rest);
        return;
      case "comments":
        runComments(paths, rest);
        return;
      case "move":
        runMove(paths, rest);
        return;
      default:
        if (!runFleetSubcommand(sub2, paths, rest)) refuseUnknownSubcommand(sub2);
        return;
    }
  } catch (e) {
    if (e instanceof BoardRejected || e instanceof IdClashError || e instanceof AmbiguousIdError || e instanceof BoardFormatTooNew) {
      warn(e.message);
      process.exitCode = 2;
      return;
    }
    if (e instanceof ArchivePartialError) {
      warn(e.message);
      out(archiveAbortLabel(e, "archive"));
      process.exitCode = 1;
      return;
    }
    throw e;
  }
}

// src/tasks/boardYield.ts
import { existsSync as existsSync11, readFileSync as readFileSync12, realpathSync as realpathSync3, statSync as statSync3 } from "node:fs";
import { delimiter, dirname as dirname6, join as join8 } from "node:path";
var BIG_PLUGIN_NAME = "cyberine";
var BIG_PLUGIN_KEY_PREFIX = "cyberine@";
var HOOK_LAUNCHERS = {
  banner: "cyberine-tasks-banner.mjs",
  guard: "cyberine.mjs"
};
var BIG_PLUGIN_LITERALS = [
  BIG_PLUGIN_NAME,
  BIG_PLUGIN_KEY_PREFIX,
  HOOK_LAUNCHERS.banner,
  HOOK_LAUNCHERS.guard
];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readJson(file) {
  try {
    return JSON.parse(readFileSync12(file, "utf8"));
  } catch {
    return void 0;
  }
}
function bigPluginLinked(home) {
  try {
    const dir = realpathSync3(join8(home, ".claude", "skills", BIG_PLUGIN_NAME));
    if (!statSync3(dir).isDirectory()) return false;
    const manifest = readJson(join8(dir, ".claude-plugin", "plugin.json"));
    return isRecord(manifest) && manifest.name === BIG_PLUGIN_NAME;
  } catch {
    return false;
  }
}
function settingsScopeFiles(home, cwd) {
  return [
    join8(home, ".claude", "settings.json"),
    join8(cwd, ".claude", "settings.json"),
    join8(cwd, ".claude", "settings.local.json")
  ];
}
function bigPluginEnabledInSettings(home, cwd) {
  const winning = /* @__PURE__ */ new Map();
  for (const file of settingsScopeFiles(home, cwd)) {
    const settings = readJson(file);
    const plugins = isRecord(settings) ? settings.enabledPlugins : void 0;
    if (!isRecord(plugins)) continue;
    for (const [key, value] of Object.entries(plugins)) {
      if (key.startsWith(BIG_PLUGIN_KEY_PREFIX)) winning.set(key, value);
    }
  }
  return [...winning.values()].some((value) => value === true);
}
function bigPluginBinDir(env) {
  for (const dir of (boardEnv("PATH", env) ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join8(dir, BIG_PLUGIN_NAME);
    if (!existsSync11(candidate)) continue;
    try {
      return dirname6(realpathSync3(candidate));
    } catch {
      return null;
    }
  }
  return null;
}
function bigPluginHooksFindCli(mode, env) {
  const binDir = bigPluginBinDir(env);
  return binDir !== null && existsSync11(join8(binDir, HOOK_LAUNCHERS[mode]));
}
function bigPluginHooksWouldRun(mode, env, home, cwd) {
  if (!bigPluginHooksFindCli(mode, env)) return false;
  return bigPluginLinked(home) || bigPluginEnabledInSettings(home, cwd);
}

// scripts/taskboard-bundle/entry.ts
function runNext(rest) {
  const unknown = rest.filter((a) => a !== "--all" && a !== "--json" && a !== "--groups");
  if (unknown.length > 0) {
    process.stderr.write(`next: unknown argument(s): ${unknown.join(" ")} -- usage: next [--all] [--json] [--groups]
`);
    process.exit(2);
  }
  const cwd = process.cwd();
  const { tasks, warnings } = readManifestReport(cwd);
  for (const w of warnings) process.stderr.write(`${w}
`);
  if (tasks.length === 0) {
    process.stderr.write(`${emptyManifestMessage(cwd)}
`);
    process.exit(1);
  }
  const scoped = scopeRunnableSets(tasks, computeRunnable(tasks), cwd, rest.includes("--all"));
  if (rest.includes("--json")) {
    writeJsonLine(boardNextJson(scoped, tasks[0].manifestPath, { groups: rest.includes("--groups") }));
    return;
  }
  const notice = submoduleScopeNotice(scoped);
  if (notice) process.stderr.write(`${notice}
`);
  if (rest.includes("--groups")) {
    process.stdout.write(`${formatBoardGroups(groupBoard(scoped), scoped.sets.doing.length)}
`);
    return;
  }
  process.stdout.write(`${formatRunnableSummary(scoped.sets)}
`);
}
var args = process.argv.slice(2);
var sub = args[0] ?? "";
if (sub === "--version" || sub === "version") {
  process.stdout.write(`${define_TASKBOARD_BUILD_default.program} ${define_TASKBOARD_BUILD_default.version} (source ${define_TASKBOARD_BUILD_default.source})
`);
  process.exit(0);
}
if ((sub === "banner" || sub === "guard") && bigPluginHooksWouldRun(sub, { PATH: boardEnv("PATH") }, homedir(), boardEnv("CLAUDE_PROJECT_DIR") || process.cwd())) {
  process.exit(0);
}
if (sub === "next") runNext(args.slice(1));
else await cmdTasksBoard(args);
