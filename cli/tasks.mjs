#!/usr/bin/env node
import {
  AmbiguousIdError,
  ArchivePartialError,
  BoardFormatTooNew,
  BoardRejected,
  DEFAULT_TASK_EXEC,
  DEFAULT_TASK_MODEL,
  ID_SHAPE_RULE,
  IdClashError,
  KNOWN_HEADER_ID_RE,
  RECURRING_ID_RE,
  RECURRING_ID_SOURCE,
  SCHEMA_TEXT,
  SET_ORDER,
  TASK_ID_RE,
  TASK_ID_SOURCE,
  TASK_STATUSES,
  TASK_STATUS_SET,
  VALID_EXEC,
  VALID_MODELS,
  VALID_REASONING,
  WRITABLE_STATUSES,
  agentTag,
  appendJournalEvents,
  appendStatus,
  archiveAbortLabel,
  archiveLocked,
  archivedIds,
  assertBoardWritable,
  blockRange,
  boardEnv,
  boardFormatLine,
  boardFormatNotice,
  boardPathsFor,
  collapseWhitespace,
  convergeApply,
  coreEnd,
  countAllHeaders,
  define_TASKBOARD_BUILD_default,
  deriveDayTitle,
  draftNames,
  ensureMigrated,
  epochToIsoForTz,
  epochToLocalIso,
  fencedLineFlags,
  fold,
  gatherDrafts,
  isTaskStatus,
  lintManifest,
  listJournalDaysFolded,
  lock,
  lockAndMigrate,
  logDone,
  logLines,
  looksLikeABoard,
  malformedIdMessage,
  manifestCandidates,
  mergeIds,
  migrateLegacySource,
  nonBlankLineCount,
  normalizeHost,
  orderOverlayLines,
  overlaySources,
  parseLegacyBoard,
  parseManifestBlocks,
  pathInScope,
  readJournalDayFolded,
  readOverlayText,
  reconcile,
  reconcileDryRun,
  reconcileLocked,
  rejectIds,
  repoRootStrict,
  resolveBoard,
  resolveDuplicateOf,
  resolveIdPrefix,
  setBlocker,
  setDeps,
  setFields,
  setFieldsBatch,
  showDeps,
  submoduleScope,
  todayLocalDate,
  unlock,
  validateDraftReferences,
  writeDraft,
  writeFileAtomic
} from "./lib/chunk-RJN2NMOK.mjs";

// scripts/taskboard-bundle/entry.ts
import { homedir } from "node:os";

// src/commands/tasksBoard.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { existsSync as existsSync14, mkdirSync as mkdirSync3, readFileSync as readFileSync16, statSync as statSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { basename as basename5, dirname as dirname5, join as join8, resolve as resolve2 } from "node:path";

// src/tasks/boardShare.ts
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
var MOVES = ["tasks", "TASKS_ARCHIVE.md", "TASKS_DEDUPE_LEDGER.jsonl", "journal"];
var STAYS = ["status.log", "status.d", ".reconcile.lock", "drafts"];
function syncDir() {
  const dir = boardEnv("NF_TASKS_SYNC_DIR") || ".claude";
  if (dir !== ".claude" && dir !== ".codex") throw new BoardRejected("tasks: NF_TASKS_SYNC_DIR must be .claude or .codex");
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

// src/tasks/boardDoctor.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync } from "node:fs";
import { join as join2 } from "node:path";

// src/tasks/taskQuality.ts
var DO_MAX_CHARS = 300;
var ABBREVIATION_RE = /\b(?:e\.g|i\.e|etc|vs|cf|approx|incl)\./gi;
var TERMINATOR_RE = /[.!?](?=\s|$)/g;
function doSentenceCount(doText) {
  const prose = doText.replace(/`[^`]*`/g, "CODE").replace(ABBREVIATION_RE, "ABBR").replace(/\b\d+\.\d+/g, "NUM").trim();
  if (prose === "") return 0;
  const terminators = prose.match(TERMINATOR_RE)?.length ?? 0;
  const endsTerminated = /[.!?]$/.test(prose);
  return terminators + (endsTerminated ? 0 : 1);
}
function taskQualityIssues(task) {
  const issues = [];
  const text = task.do.trim();
  const sentences = doSentenceCount(text);
  if (sentences > 1) issues.push(`do: reads as ${sentences} sentences (the manifest standard is one imperative sentence; move detail into the brief)`);
  if (text.length > DO_MAX_CHARS) issues.push(`do: is ${text.length} characters (over ${DO_MAX_CHARS}; move detail into the brief)`);
  if ((task.effort === "M" || task.effort === "L") && !task.hasBrief) {
    issues.push(`effort ${task.effort} task has no brief (write one with --brief-file, or through save)`);
  }
  return issues;
}

// src/tasks/boardDoctor.ts
var LOWER_BOUND_NOTE = "(lower bound -- a malformed header exists and can hide its own collision; fix section 1 first, then re-run)";
var HELD_HEADER_RE = /^## ([A-Za-z0-9]+) \[([^\]]*)\](?: |$)/;
function findHeldFlips(manifestSrc, overlayRaw, now) {
  const last = /* @__PURE__ */ new Map();
  for (const line of overlayRaw.split("\n")) {
    if (line === "") continue;
    const fields = line.split("	");
    if (fields.length < 4) continue;
    const epoch = Number(fields[0]);
    last.set(fields[2], { status: fields[3], epoch: Number.isFinite(epoch) ? epoch : 0 });
  }
  if (last.size === 0) return [];
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  const held = [];
  for (const [i, line] of srcLines.entries()) {
    if (fenced[i]) continue;
    const m = HELD_HEADER_RE.exec(line);
    if (!m) continue;
    if (m[2].trim() !== "") continue;
    const entry = last.get(m[1]);
    if (entry === void 0) continue;
    held.push({
      id: m[1],
      status: entry.status,
      epoch: entry.epoch,
      ageDays: entry.epoch > 0 ? Math.floor((now - entry.epoch * 1e3) / 864e5) : 0
    });
  }
  return held;
}
function hasBlockingFindings(r) {
  const manifestCount = r.headerCounts.find((c) => c.source === "manifest");
  return r.ghosts.some((g) => g.source === "manifest") || (manifestCount ? manifestCount.raw !== manifestCount.parsed : false) || r.boardFormat === "unparsable" || r.boardFormat === "legacy-list-item" || r.boardFormat === "legacy-dashed-header";
}
function line1(b) {
  return b.start + 1;
}
function findPrefixPairs(ids) {
  const sorted = [...new Set(ids)].sort();
  const groups = /* @__PURE__ */ new Map();
  const stack = [];
  for (const id of sorted) {
    while (stack.length > 0 && !id.startsWith(stack[stack.length - 1])) stack.pop();
    for (const shorter of stack) {
      const g = groups.get(shorter);
      if (g) g.push(id);
      else groups.set(shorter, [id]);
    }
    stack.push(id);
  }
  return [...groups.entries()].map(([shorter, longerIds]) => ({ shorter, longerIds }));
}
var SEP = "[ \\t\\u00a0]";
var RAW_HEADER_RE = new RegExp(`^${SEP}{0,3}##${SEP}+(\\S+)${SEP}+\\[`);
var RAW_HEADER_TITLE_RE = new RegExp(`^${SEP}{0,3}##${SEP}+\\S+${SEP}+\\[[^\\]]*\\]${SEP}?(.*)$`);
var CR_RE = /\r/;
function scanRawHeaders(src, source) {
  let raw = 0;
  const ghosts = [];
  const lines = src.split("\n");
  const fenced = fencedLineFlags(lines);
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const m = RAW_HEADER_RE.exec(line);
    if (!m) return;
    raw++;
    const id = m[1];
    if (KNOWN_HEADER_ID_RE.test(id)) return;
    ghosts.push({ source, id, line: i + 1, title: (RAW_HEADER_TITLE_RE.exec(line)?.[1] ?? "").trim() });
  });
  return { raw, ghosts };
}
function analyze(inputs) {
  const manifestAll = inputs.manifestSrc ? parseManifestBlocks(inputs.manifestSrc) : { blocks: [], warnings: [], legacy: void 0 };
  const archiveAll = inputs.archiveSrc ? parseManifestBlocks(inputs.archiveSrc) : { blocks: [], warnings: [], legacy: void 0 };
  const malformed = [
    ...manifestAll.blocks.filter((b) => b.malformed).map((b) => ({ source: "manifest", id: b.id, bracket: b.bracket, line: line1(b) })),
    ...archiveAll.blocks.filter((b) => b.malformed).map((b) => ({ source: "archive", id: b.id, bracket: b.bracket, line: line1(b) }))
  ];
  const ORPHAN_WARNING = "task header with no parsable [status] bracket";
  const orphanHeaders = [
    ...manifestAll.warnings.filter((w) => w.includes(ORPHAN_WARNING)).map((w) => `manifest -- ${w.split("manifest line ")[1] ?? w}`),
    ...archiveAll.warnings.filter((w) => w.includes(ORPHAN_WARNING)).map((w) => `archive -- ${w.split("manifest line ")[1] ?? w}`)
  ];
  const manifestTasks = manifestAll.blocks.filter((b) => TASK_ID_RE.test(b.id));
  const archiveTasks = archiveAll.blocks.filter((b) => TASK_ID_RE.test(b.id));
  const bySource = /* @__PURE__ */ new Map();
  for (const b of manifestTasks) {
    const cur = bySource.get(b.id) ?? { manifest: 0, archive: 0 };
    cur.manifest++;
    bySource.set(b.id, cur);
  }
  for (const b of archiveTasks) {
    const cur = bySource.get(b.id) ?? { manifest: 0, archive: 0 };
    cur.archive++;
    bySource.set(b.id, cur);
  }
  const duplicates = [...bySource.entries()].map(([id, counts]) => ({ id, count: counts.manifest + counts.archive, bySource: counts })).filter((d) => d.count > 1).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const stranded = manifestTasks.filter((b) => b.malformed && b.status === "done").map((b) => ({ id: b.id, bracket: b.bracket, line: line1(b) }));
  const allTaskIds = [...manifestTasks, ...archiveTasks].map((b) => b.id);
  const ambiguousPrefixes = findPrefixPairs(allTaskIds);
  const knownIds = new Set(allTaskIds);
  const briefIdSet = /* @__PURE__ */ new Set();
  const orphanBriefs = [];
  for (const id of inputs.briefIds) {
    briefIdSet.add(id);
    if (!knownIds.has(id)) orphanBriefs.push({ id, path: `${id}.md` });
  }
  for (const id of inputs.archiveBriefIds) {
    briefIdSet.add(id);
    if (!knownIds.has(id)) orphanBriefs.push({ id, path: `archive/${id}.md` });
  }
  orphanBriefs.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const missingBriefIds = [...knownIds].filter((id) => !briefIdSet.has(id)).sort();
  const boardLineCount = nonBlankLineCount(inputs.manifestSrc);
  const boardFormat = manifestAll.legacy ? manifestAll.legacy === "list-item" ? "legacy-list-item" : "legacy-dashed-header" : manifestAll.blocks.length > 0 ? "canonical" : looksLikeABoard(inputs.manifestSrc) ? "unparsable" : "empty";
  const boardTaskCount = manifestAll.blocks.length;
  const manifestScan = scanRawHeaders(inputs.manifestSrc, "manifest");
  const archiveScan = scanRawHeaders(inputs.archiveSrc, "archive");
  const ghosts = [...manifestScan.ghosts, ...archiveScan.ghosts];
  const headerCounts = [
    {
      source: "manifest",
      raw: manifestScan.raw,
      parsed: manifestAll.blocks.filter((b) => KNOWN_HEADER_ID_RE.test(b.id)).length,
      hasCr: CR_RE.test(inputs.manifestSrc)
    },
    {
      source: "archive",
      raw: archiveScan.raw,
      parsed: archiveAll.blocks.filter((b) => KNOWN_HEADER_ID_RE.test(b.id)).length,
      hasCr: CR_RE.test(inputs.archiveSrc)
    }
  ];
  const forbiddenNoReason = [];
  const strayReasons = [];
  for (const b of manifestTasks) {
    const hasReason = b.fields.has("reason");
    const reason = (b.fields.get("reason") ?? "").trim();
    if (b.status === "forbidden" && reason === "") forbiddenNoReason.push({ id: b.id, status: b.status ?? "-", line: line1(b) });
    if (b.status !== "forbidden" && hasReason) strayReasons.push({ id: b.id, status: b.status ?? "-", line: line1(b) });
  }
  return {
    boardFormat,
    boardTaskCount,
    boardLineCount,
    malformed,
    orphanHeaders,
    duplicates,
    stranded,
    ambiguousPrefixes,
    orphanBriefs,
    missingBriefIds,
    ghosts,
    headerCounts,
    forbiddenNoReason,
    strayReasons,
    heldFlips: findHeldFlips(inputs.manifestSrc, inputs.overlayRaw ?? "", inputs.now ?? Date.now()),
    qualityIssues: manifestTasks.filter((b) => b.status === "todo" || b.status === "doing" || b.status === "backlog").map((b) => ({
      id: b.id,
      line: line1(b),
      issues: taskQualityIssues({ do: b.fields.get("do") ?? "", effort: b.fields.get("effort")?.trim(), hasBrief: briefIdSet.has(b.id) })
    })).filter((q) => q.issues.length > 0)
  };
}
function listBriefIds(dir) {
  if (!existsSync2(dir)) return [];
  const ids = [];
  for (const name of readdirSync(dir)) {
    const m = /^(.+)\.md$/.exec(name);
    if (!m) continue;
    if (!TASK_ID_RE.test(m[1])) continue;
    ids.push(m[1]);
  }
  return ids;
}
function gatherDoctorInputs(paths) {
  return {
    manifestSrc: existsSync2(paths.manifest) ? readFileSync2(paths.manifest, "utf8") : "",
    archiveSrc: existsSync2(paths.archive) ? readFileSync2(paths.archive, "utf8") : "",
    briefIds: listBriefIds(paths.tasksDir),
    archiveBriefIds: listBriefIds(join2(paths.tasksDir, "archive")),
    overlayRaw: orderOverlayLines(overlaySources(paths)).text
  };
}
function formatReport(r) {
  const lines = [];
  const none = "  (none found)";
  lines.push("/cyberine-taskboard:tasks doctor -- read-only board integrity report");
  lines.push("");
  if (r.boardFormat !== "canonical" && r.boardFormat !== "empty") {
    lines.push(
      r.boardFormat === "unparsable" ? "7) BOARD FORMAT -- read this first: every count below is about a board nothing can parse" : "7) BOARD FORMAT -- this board is in a legacy format and needs converting"
    );
    if (r.boardFormat === "unparsable") {
      lines.push(`  ${r.boardLineCount} non-blank line(s), 0 task blocks, and no legacy shape the board tool recognises.`);
      lines.push('  Nothing here matches "## <id> [<status>] <title>". Every command reads this board as EMPTY.');
      lines.push("  Recognised legacy shapes, both anchored at line start:");
      lines.push("    - [done] T1 -- title      (list item, optional **bold** id)");
      lines.push("    ## T001 -- Title          (dashed header, with **Do:** / **Done when:** lines)");
    } else {
      const kind = r.boardFormat === "legacy-list-item" ? "list-item" : "dashed-header";
      lines.push(`  legacy ${kind} format -- ${r.boardTaskCount} task(s), readable only through the compatibility layer.`);
      lines.push("  Reads fine today; the next command that WRITES the board will auto-convert it (backup first).");
      lines.push("  To convert now, deliberately:  /cyberine-taskboard:tasks migrate --dry   then   /cyberine-taskboard:tasks migrate");
    }
    lines.push("");
  }
  lines.push("1) Malformed status brackets");
  if (r.malformed.length === 0 && r.orphanHeaders.length === 0) {
    lines.push(none);
  } else {
    for (const m of r.malformed) lines.push(`  ${m.source}:${m.id} line ${m.line} -- bracket "[${m.bracket}]"`);
    for (const o of r.orphanHeaders) lines.push(`  ${o}`);
  }
  lines.push("");
  lines.push(
    `2) Duplicate ids (manifest + archive combined)${r.malformed.length + r.orphanHeaders.length > 0 ? ` ${LOWER_BOUND_NOTE}` : ""}`
  );
  if (r.duplicates.length === 0) {
    lines.push(none);
  } else {
    for (const d of r.duplicates) {
      lines.push(`  ${d.id}: ${d.count} occurrences (manifest: ${d.bySource.manifest}, archive: ${d.bySource.archive})`);
    }
  }
  lines.push("");
  lines.push("3) [done] tasks stranded in the manifest (malformed bracket, can never archive as-is)");
  if (r.stranded.length === 0) {
    lines.push(none);
  } else {
    for (const s of r.stranded) lines.push(`  ${s.id} line ${s.line} -- bracket "[${s.bracket}]"`);
  }
  lines.push("");
  lines.push("4) Ambiguous id prefixes (one id silently shadows another on exact-match resolution)");
  if (r.ambiguousPrefixes.length === 0) {
    lines.push(none);
  } else {
    for (const p of r.ambiguousPrefixes) lines.push(`  ${p.shorter} shadows: ${p.longerIds.join(", ")}`);
  }
  lines.push("");
  lines.push("5) Task briefs");
  lines.push("  orphan briefs (file exists, id matches nothing in manifest or archive):");
  if (r.orphanBriefs.length === 0) {
    lines.push("    (none found)");
  } else {
    for (const o of r.orphanBriefs) lines.push(`    tasks/${o.path}`);
  }
  lines.push(
    `  missing briefs (informational only -- older tasks legitimately predate briefs): ${r.missingBriefIds.length} id(s)`
  );
  if (r.missingBriefIds.length > 0) lines.push(`    ${r.missingBriefIds.join(", ")}`);
  lines.push("");
  lines.push(
    "6) Ghost task ids (header id outside the minted id space -- invisible to every command, this report included)"
  );
  lines.push("  header counts (raw scan vs strict parse -- any gap is a finding):");
  for (const c of r.headerCounts) {
    const gap = c.raw === c.parsed ? "ok" : `GAP: ${c.raw - c.parsed} header(s) no command can see`;
    lines.push(`    ${c.source.padEnd(8)} ${c.raw} raw header(s), ${c.parsed} parsed -- ${gap}`);
    if (c.raw !== c.parsed && c.hasCr) {
      lines.push("      ^ this file contains CR (CRLF) line endings -- that alone makes every header unparsable.");
      lines.push("        Convert it to LF first, then re-run; the ids below (if any) may be fine.");
    }
  }
  if (r.ghosts.length === 0) {
    lines.push(none);
  } else {
    for (const g of r.ghosts) {
      lines.push(`  ${g.source.padEnd(8)} line ${g.line} -- id "${g.id}"${g.title ? `: ${g.title}` : ""}`);
    }
    lines.push(`  ${ID_SHAPE_RULE}.`);
    lines.push("  -> fix by hand: no command can resolve a ghost id (merge/set/status all filter by id shape first).");
    lines.push(
      "     Either replace the id with a real minted one, or re-create the task via `/cyberine-taskboard:tasks save` and delete the ghost block; then re-run doctor."
    );
    if (r.ghosts.some((g) => g.source === "archive")) {
      lines.push(
        "     Archive ghosts are history and do not fail this report -- re-iding an archived task breaks every doc, handoff and dep that cites it."
      );
    }
  }
  lines.push("");
  lines.push("8) Forbidden tombstones (informational -- never fails this report)");
  lines.push("  [forbidden] blocks missing a reason: line (the manifest template asks for one):");
  if (r.forbiddenNoReason.length === 0) lines.push(none);
  for (const t of r.forbiddenNoReason) lines.push(`  line ${t.line} -- ${t.id} [forbidden] has no reason:`);
  lines.push("  reason: lines on a block that is NOT [forbidden] (a released or hand-resurrected tombstone; this report cannot tell which):");
  if (r.strayReasons.length === 0) lines.push(none);
  for (const t of r.strayReasons) lines.push(`  line ${t.line} -- ${t.id} [${t.status}] still carries reason:`);
  lines.push("");
  lines.push("9) Held flips (informational -- never fails this report)");
  lines.push("  flips reconcile is holding because the header bracket is empty ([]); repair the bracket and they bake with their original date:");
  if (r.heldFlips.length === 0) lines.push(none);
  for (const h of r.heldFlips) {
    const age = h.epoch > 0 ? `${h.ageDays}d old (${epochToIsoForTz(h.epoch, void 0)})` : "age unknown";
    lines.push(`  ${h.id} -- held "${h.status}" flip, ${age}`);
  }
  lines.push("");
  lines.push("10) Task quality (informational -- never fails this report)");
  lines.push("  open tasks short of the manifest standard (one-sentence do:, a brief for effort M and L):");
  if (r.qualityIssues.length === 0) lines.push(none);
  for (const q of r.qualityIssues) for (const issue of q.issues) lines.push(`  line ${q.line} -- ${q.id}: ${issue}`);
  return lines.join("\n");
}

// src/tasks/boardGuard.ts
import { basename as basename2 } from "node:path";
var BOARD_RULE_QUOTE = 'Every change to the board goes through a `/cyberine-taskboard:tasks` subcommand. To a session these files are read-only: the manifest, TASKS_ARCHIVE.md beside it, status.log, and everything under status.d/ and journal/. Reading them is fine. Writing them by any other route is a hand-edit, whatever the tool.';
var BOARD_PATH_PATTERNS = [
  /(^|\/)\.local\/tasks\/ACTIVE\.md$/,
  /(^|\/)\.claude\/TASKS\.md$/,
  /(^|\/)\.codex\/TASKS\.md$/,
  /(^|\/)TASKS_ARCHIVE\.md$/,
  /(^|\/)\.local\/tasks\/status\.log$/,
  /(^|\/)\.local\/tasks\/status\.d(\/|$)/,
  /(^|\/)\.local\/tasks\/journal(\/|$)/,
  /(^|\/)\.claude\/journal(\/|$)/,
  /(^|\/)\.codex\/journal(\/|$)/,
  /(^|\/)TASKS_DEDUPE_LEDGER\.jsonl$/
];
function isBoardPath(path) {
  const norm = String(path ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (norm === "") return false;
  return BOARD_PATH_PATTERNS.some((re) => re.test(norm));
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
function bashWritesBoard(command) {
  const text = String(command ?? "");
  if (text.trim() === "") return false;
  for (const match of text.matchAll(/(?:^|[^>\d])>{1,2}\|?\s*(['"]?)([^\s'";|&)]+)\1/g)) {
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
var FILE_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "NotebookEdit", "MultiEdit", "str_replace_editor"]);
function boardGuardDecision(payload) {
  const tool = String(payload.tool_name ?? "");
  const input = payload.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) {
    const path = String(input["file_path"] ?? input["path"] ?? input["notebook_path"] ?? "");
    if (isBoardPath(path)) {
      return {
        blocked: true,
        reason: `${tool} refused: ${basename2(path)} is a TaskBoard board file and this session may only READ it.
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

// src/tasks/boardDrop.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, rmSync } from "node:fs";
import { join as join3 } from "node:path";
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
  const live = parseManifestBlocks(readFileSync3(paths.manifest, "utf8")).blocks;
  const archived = parseManifestBlocks(
    existsSync3(paths.archive) ? readFileSync3(paths.archive, "utf8") : ""
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
    const briefPath = join3(paths.tasksDir, `${id}.md`);
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
    const { out: out2 } = cutBlocks(readFileSync3(paths.manifest, "utf8"), ids);
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
import { existsSync as existsSync4, readFileSync as readFileSync4, readdirSync as readdirSync2, rmSync as rmSync2, unlinkSync as unlinkSync2 } from "node:fs";
import { join as join4 } from "node:path";
var DAY_FILE_RE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
function readIfExists(path) {
  return existsSync4(path) ? readFileSync4(path, "utf8") : "";
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
  return readdirSync2(journalDir).filter((f) => DAY_FILE_RE.test(f)).sort().map((f) => join4(journalDir, f));
}
function resolveIdPrefixSafe2(candidate, ids) {
  try {
    return resolveIdPrefix(candidate, ids);
  } catch {
    return null;
  }
}
function planForget(paths, rawIds) {
  const live = parseManifestBlocks(readFileSync4(paths.manifest, "utf8")).blocks;
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
    const briefs = [join4(paths.tasksDir, `${id}.md`), join4(paths.tasksDir, "archive", `${id}.md`)].filter(
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
    const { out: out2 } = cutBlocks(readFileSync4(paths.archive, "utf8"), ids);
    writeFileAtomic(paths.archive, out2, "forget");
  }
  if (removals.some((r) => r.manifestBlocks > 0)) {
    const { out: out2 } = cutBlocks(readFileSync4(paths.manifest, "utf8"), ids);
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

// src/tasks/boardStatusView.ts
import { existsSync as existsSync5, readFileSync as readFileSync5 } from "node:fs";
import { basename as basename3 } from "node:path";

// src/tasks/runnable.ts
import { dirname as dirname2, join as join5 } from "node:path";
import { statSync } from "node:fs";
var archiveCache = /* @__PURE__ */ new Map();
function archiveIdsFor(manifestPath) {
  const archivePath = join5(dirname2(manifestPath), "TASKS_ARCHIVE.md");
  let st;
  try {
    const raw = statSync(archivePath);
    st = { mtimeMs: raw.mtimeMs, size: raw.size };
  } catch {
    return /* @__PURE__ */ new Set();
  }
  const cached = archiveCache.get(archivePath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.ids;
  const ids = archivedIds(archivePath);
  archiveCache.set(archivePath, { ...st, ids });
  return ids;
}
function depSatisfied(depId, doneIds, dupMap) {
  if (doneIds.has(depId)) return true;
  const { target, cycle } = resolveDuplicateOf(dupMap, depId);
  return !cycle && doneIds.has(target);
}
function isRunnableTask(t, doneIds, dupMap) {
  if (t.status !== "todo") return false;
  if (t.blocker) return false;
  if (t.duplicateOf) return false;
  return t.deps.every((d) => depSatisfied(d, doneIds, dupMap));
}
function computeRunnable(tasks, opts = {}) {
  const doneIds = /* @__PURE__ */ new Set();
  for (const t of tasks) {
    if (t.status === "done") doneIds.add(t.id);
  }
  const archive = opts.archiveIds === null ? null : opts.archiveIds ?? (tasks[0]?.manifestPath ? archiveIdsFor(tasks[0].manifestPath) : null);
  if (archive) for (const id of archive) doneIds.add(id);
  const byId = /* @__PURE__ */ new Map();
  for (const t of tasks) byId.set(t.id, t.status);
  const dupMap = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    if (t.duplicateOf) dupMap.set(t.id, t.duplicateOf);
  }
  const byStatus = new Map(TASK_STATUSES.map((s) => [s, []]));
  const runnable = [];
  const waiting = [];
  const blocked = [];
  const stillTodo = [];
  const duplicate = [];
  for (const t of tasks) {
    if (t.duplicateOf) {
      duplicate.push(t);
      continue;
    }
    byStatus.get(t.status)?.push(t);
    if (t.status !== "todo") continue;
    if (t.blocker) {
      waiting.push(t);
    } else if (isRunnableTask(t, doneIds, dupMap)) {
      runnable.push(t);
    } else if (t.deps.every((d) => depSatisfied(d, doneIds, dupMap))) {
      stillTodo.push(t);
    } else {
      blocked.push(t);
    }
  }
  const rank = { p0: 0, p1: 1, p2: 2 };
  runnable.sort((a, b) => rank[a.priority ?? "p1"] - rank[b.priority ?? "p1"]);
  return {
    runnable,
    waiting,
    blocked,
    stillTodo,
    doing: byStatus.get("doing"),
    backlog: byStatus.get("backlog"),
    done: byStatus.get("done"),
    forbidden: byStatus.get("forbidden"),
    duplicate,
    doneIds,
    byId,
    byStatus,
    dupMap
  };
}
function scopeRunnableSets(tasks, sets, cwd, showAll) {
  const scope = showAll ? "" : submoduleScope(cwd);
  if (!scope) return { sets, scope: "", hidden: 0 };
  const keep = (list) => list.filter((t) => pathInScope(t.path, scope));
  const byStatus = /* @__PURE__ */ new Map();
  for (const [status, list] of sets.byStatus) byStatus.set(status, keep(list));
  return {
    sets: {
      ...sets,
      runnable: keep(sets.runnable),
      waiting: keep(sets.waiting),
      blocked: keep(sets.blocked),
      stillTodo: keep(sets.stillTodo),
      doing: byStatus.get("doing") ?? [],
      backlog: byStatus.get("backlog") ?? [],
      done: byStatus.get("done") ?? [],
      forbidden: byStatus.get("forbidden") ?? [],
      duplicate: keep(sets.duplicate),
      byStatus
    },
    scope,
    hidden: tasks.filter((t) => !pathInScope(t.path, scope)).length
  };
}
function submoduleScopeNotice(scoped) {
  if (!scoped.scope || scoped.hidden === 0) return null;
  return `taskboard: scoped to submodule ${scoped.scope}/ -- ${scoped.hidden} task(s) elsewhere on this board hidden (--all shows every task)`;
}
function missingDeps(t, sets) {
  return t.deps.filter((d) => !depSatisfied(d, sets.doneIds, sets.dupMap));
}
function formatRunnableSummary(sets, opts) {
  const take = opts?.take;
  const claimed = take === void 0 ? sets.runnable : sets.runnable.slice(0, take);
  const leftForOthers = take === void 0 ? [] : sets.runnable.slice(take);
  const header = `${sets.doneIds.size} done | ${claimed.length} runnable${take !== void 0 ? ` (take=${take})` : ""} | ${leftForOthers.length} left-for-others | ${sets.blocked.length} blocked | ${sets.waiting.length} waiting | ${sets.doing.length} in-progress | ${sets.backlog.length} backlog | ${sets.forbidden.length} forbidden`;
  const lines = [header, ""];
  if (claimed.length === 0) {
    let reason;
    if (leftForOthers.length > 0) reason = `${leftForOthers.length} runnable but take=0.`;
    else if (sets.blocked.length > 0) reason = "unblock deps or mark them done.";
    else if (sets.waiting.length > 0)
      reason = `${sets.waiting.length} waiting on an external blocker -- release one with '/cyberine-taskboard:tasks status unblock <id>'.`;
    else if (sets.done.length > 0 || sets.doing.length > 0)
      reason = "all runnable tasks already in-progress or done.";
    else reason = "no todo tasks in manifest.";
    lines.push(`(nothing runnable \u2014 ${reason})`);
    return lines.join("\n");
  }
  lines.push("Runnable (next to dispatch):");
  for (const t of claimed) {
    let entry = `  ${t.id}  ${t.title}`;
    if (t.deps.length > 0) entry += `  [deps: ${t.deps.join(",")}]`;
    if (t.blocker) entry += `  [blocker: ${t.blocker}]`;
    lines.push(entry);
  }
  if (leftForOthers.length > 0) {
    lines.push("");
    lines.push(`Left for other sessions: ${leftForOthers.map((t) => t.id).join(", ")}`);
  }
  if (sets.blocked.length > 0) {
    lines.push("");
    lines.push("Blocked (deps not done):");
    for (const t of sets.blocked) {
      const missing = missingDeps(t, sets).map(
        (d) => resolveDuplicateOf(sets.dupMap, d).cycle ? `${d} (duplicate-of cycle, fix the board)` : d
      );
      lines.push(`  ${t.id}  ${t.title}  -- waiting on: ${missing.join(", ") || "(unknown dep)"}`);
    }
  }
  if (sets.waiting.length > 0) {
    lines.push("");
    lines.push("Waiting on external blocker (release with `/cyberine-taskboard:tasks status unblock <id>`):");
    for (const t of sets.waiting) {
      lines.push(`  ${t.id}  ${t.title}  -- blocker: ${t.blocker || "(unspecified)"}`);
    }
  }
  return lines.join("\n");
}

// src/tasks/boardStatusView.ts
function recurringEntries(src) {
  const blocks = parseManifestBlocks(src, /^R[0-9]+$/).blocks.filter((b) => b.status === "recurring");
  const today = /* @__PURE__ */ new Date();
  const todayEpoch = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return blocks.map((b) => {
    const every = b.fields.get("every") ?? "";
    const last = b.fields.get("last-done") ?? "";
    const exec = (b.fields.get("exec") ?? "").trim();
    const count = Number(/^\d+/.exec(every)?.[0] ?? 0);
    const unit = /[dwm]/.exec(every)?.[0] ?? "d";
    const need = count * (unit === "w" ? 7 : unit === "m" ? 30 : 1);
    if (!last) return { id: b.id, state: "NEW", days: 0, every, lastDone: "", title: b.title, exec };
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(last);
    const lastEpoch = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : 0;
    const elapsed = Math.floor((todayEpoch - lastEpoch) / 864e5);
    const due = elapsed >= need;
    return {
      id: b.id,
      state: due ? "DUE" : "OK",
      days: due ? elapsed - need : need - elapsed,
      every,
      lastDone: last,
      title: b.title,
      exec
    };
  });
}
function createdEpoch(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1e3);
}
function healthLines(view) {
  const nowSec = Date.now() / 1e3;
  const ages = view.tasks.filter((t) => (t.status === "todo" || t.status === "backlog") && t.created !== "").flatMap((t) => {
    const epoch = createdEpoch(t.created);
    return epoch === null ? [] : [{ id: t.id, title: t.title, label: t.eff === "blocked" ? "blocked" : t.status, created: t.created, ageDays: Math.floor((nowSec - epoch) / 86400) }];
  }).sort((a, b) => b.ageDays - a.ageDays);
  const overdue = view.recurring.filter((e) => e.state !== "OK");
  const dispatchable = overdue.filter((e) => e.exec !== "");
  const manual = overdue.filter((e) => e.exec === "");
  const worstManual = manual.slice().sort((a, b) => a.state === "NEW" ? -1 : b.state === "NEW" ? 1 : b.days - a.days)[0];
  const health = [];
  if (view.ready.length) {
    health.push(`  backlog-rot: ${view.ready.length} task(s) ready to promote (deps satisfied):`);
    for (const t of view.ready) health.push(`    ${t.id} [backlog] ${t.title}  ->  /cyberine-taskboard:tasks status todo ${t.id}`);
  }
  if (ages.length) {
    health.push(`  age: ${ages.length} task(s) carry a created: field:`);
    for (const a of ages) health.push(`    ${a.id} [${a.label}] ${a.title}  -- created ${a.created} (${a.ageDays}d old)`);
  }
  if (view.stale.length) {
    health.push(`  stale-doing: ${view.stale.length} task(s) [doing] past the ${view.threshold}d threshold -- see the [doing] section above`);
  }
  if (overdue.length) {
    health.push(`  recurring: ${overdue.length} overdue (${dispatchable.length} with an exec: field, ${manual.length} manual)`);
    if (worstManual) health.push(`    worst manual: ${worstManual.id} (${worstManual.state === "NEW" ? "never run" : `${worstManual.days}d overdue`})`);
  }
  return health;
}
function formatRecurringLine(e) {
  if (e.state === "NEW") return `${e.id}  ** DUE ** never run (every ${e.every})  ${e.title}`;
  if (e.state === "DUE") return `${e.id}  ** DUE ** ${e.days}d overdue (every ${e.every})  ${e.title}`;
  return `${e.id}  in ${e.days}d (every ${e.every}, last ${e.lastDone})  ${e.title}`;
}
function boardView(paths, cwd, showAll) {
  const src = readFileSync5(paths.manifest, "utf8");
  const effective = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const overlay = readOverlayText(paths);
  const owners = /* @__PURE__ */ new Map();
  const epochs = /* @__PURE__ */ new Map();
  for (const line of overlay.split("\n")) {
    const fields = line.split("	");
    if (fields.length < 4) continue;
    owners.set(fields[2], fields[1]);
    const epoch = Number(fields[0]);
    if (Number.isFinite(epoch)) epochs.set(fields[2], epoch);
  }
  const base = parseManifestBlocks(src, TASK_ID_RE).blocks.filter((b) => b.status !== "recurring").map((b) => ({
    id: b.id,
    status: effective.get(b.id) ?? b.status ?? "",
    title: b.title,
    blocker: b.fields.get("blocker")?.trim() ?? "",
    reason: b.fields.get("reason")?.trim() ?? "",
    deps: (b.fields.get("deps") ?? "").split(/[,\s]+/).filter((id) => TASK_ID_RE.test(id)),
    duplicateOf: b.fields.get("duplicate-of")?.trim() ?? "",
    path: b.fields.get("path")?.trim() ?? "",
    baseStatus: b.status ?? "",
    created: b.fields.get("created")?.trim() ?? ""
  }));
  const doneIds = archiveIdsFor(paths.manifest);
  for (const t of base) if (t.status === "done") doneIds.add(t.id);
  const duplicates = new Map(base.filter((t) => t.duplicateOf && t.duplicateOf !== "-").map((t) => [t.id, t.duplicateOf]));
  const all = base.map((t) => {
    const missing = t.deps.filter((id) => !depSatisfied(id, doneIds, duplicates));
    const blocked2 = t.blocker !== "" && t.blocker !== "-";
    let eff;
    if (!TASK_STATUS_SET.has(t.status)) eff = "unknown";
    else if (t.status === "todo" && blocked2) eff = "blocked";
    else if (t.status === "todo" && missing.length) eff = "waiting";
    else eff = t.status;
    return {
      id: t.id,
      status: t.status,
      baseStatus: t.baseStatus,
      eff,
      title: t.title,
      blocker: t.blocker,
      reason: t.reason,
      deps: t.deps,
      missing,
      duplicateOf: t.duplicateOf,
      path: t.path,
      owner: owners.get(t.id) ?? "",
      epoch: epochs.get(t.id),
      created: t.created
    };
  });
  const scope = showAll ? "" : submoduleScope(cwd);
  const tasks = scope ? all.filter((t) => pathInScope(t.path, scope)) : all;
  const hidden = all.length - tasks.length;
  const doing = tasks.filter((t) => t.status === "doing");
  const todo = tasks.filter((t) => t.status === "todo" && (t.blocker === "" || t.blocker === "-"));
  const blocked = tasks.filter((t) => t.status === "todo" && t.blocker !== "" && t.blocker !== "-");
  const backlog = tasks.filter((t) => t.status === "backlog");
  const done = tasks.filter((t) => t.status === "done");
  const forbidden = tasks.filter((t) => t.status === "forbidden");
  const unknown = tasks.filter((t) => !TASK_STATUS_SET.has(t.status));
  const ready = backlog.filter(
    (t) => (t.blocker === "" || t.blocker === "-") && (t.duplicateOf === "" || t.duplicateOf === "-") && t.missing.length === 0
  );
  const waitingDeps = todo.filter((t) => t.missing.length > 0);
  const recurring = recurringEntries(src);
  const recurringDue = recurring.filter((e) => e.state !== "OK").length;
  const pending = logLines(paths);
  const rawThreshold = Number(boardEnv("NF_TASKS_STALE_DOING_DAYS"));
  const threshold = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 3;
  const stale = doing.filter((t) => t.epoch !== void 0 && (Date.now() / 1e3 - t.epoch) / 86400 >= threshold);
  return {
    src,
    tasks,
    all,
    hidden,
    scope,
    doing,
    todo,
    blocked,
    backlog,
    done,
    forbidden,
    unknown,
    ready,
    waitingDeps,
    recurring,
    recurringDue,
    pending,
    threshold,
    stale
  };
}
function boardStatusView(paths, cwd, summary, showAll) {
  const view = boardView(paths, cwd, showAll);
  const { doing, todo, blocked, backlog, done, forbidden, unknown, ready, waitingDeps } = view;
  const stderr = [];
  if (view.scope && view.hidden > 0) {
    stderr.push(`/cyberine-taskboard:tasks: scoped to submodule ${view.scope}/ -- ${view.hidden} task(s) elsewhere on this board hidden (--all shows every task)`);
  }
  for (const t of view.stale) {
    const age = (Date.now() / 1e3 - t.epoch) / 86400;
    stderr.push(`/cyberine-taskboard:tasks: ${t.id} has been [doing] for ${age.toFixed(1)}d (stale threshold ${view.threshold}d) -- confirm it is still active`);
  }
  if (summary) {
    let line = `[taskboard] ${basename3(paths.root)} \xB7 ${doing.length} doing \xB7 ${todo.length} todo \xB7 ${backlog.length} backlog${ready.length ? ` (${ready.length} ready)` : ""}`;
    if (blocked.length) line += ` \xB7 ${blocked.length} blocked`;
    if (view.stale.length) line += ` \xB7 ${view.stale.length} stale-doing`;
    if (forbidden.length) line += ` \xB7 ${forbidden.length} FORBIDDEN`;
    if (unknown.length) line += ` \xB7 ${unknown.length} UNKNOWN-STATUS`;
    if (view.recurringDue) line += ` \xB7 ${view.recurringDue} recurring DUE`;
    if (view.pending) line += ` \xB7 ${view.pending} overlay pending`;
    return { stdout: `${line} \u2192 ${paths.manifest}
`, stderr };
  }
  const lines = [paths.manifest];
  let head = `${doing.length} doing \xB7 ${todo.length} todo \xB7 ${backlog.length} backlog \xB7 ${done.length} done`;
  if (blocked.length) head += ` \xB7 ${blocked.length} blocked`;
  if (waitingDeps.length) head += ` \xB7 ${waitingDeps.length} waiting on deps`;
  if (ready.length) head += ` \xB7 ${ready.length} backlog ready`;
  if (view.recurring.length) head += ` \xB7 ${view.recurring.length} recurring (${view.recurringDue} due)`;
  if (forbidden.length) head += ` \xB7 ${forbidden.length} FORBIDDEN`;
  if (unknown.length) head += ` \xB7 ${unknown.length} UNKNOWN-STATUS`;
  if (view.pending) head += ` \xB7 ${view.pending} overlay pending`;
  lines.push(head, "---");
  const section = (title, entries) => {
    if (!entries.length) return;
    lines.push(`[${title}]`, ...entries, "");
  };
  section("doing", doing.map((t) => `${t.id} [doing] ${t.title}${t.owner ? `  (\xAB${t.owner}\xBB)` : ""}`));
  section("todo", todo.map((t) => `${t.id} [todo] ${t.title}`));
  section("waiting on deps", waitingDeps.map((t) => `${t.id} [todo] ${t.title} -- waiting on: ${t.missing.join(", ")}`));
  section("blocked", blocked.map((t) => `${t.id} [blocked] ${t.title} -- ${t.blocker}`));
  section("backlog", backlog.map((t) => `${t.id} [backlog] ${t.title}${ready.includes(t) ? "  (ready)" : ""}`));
  section("done", done.map((t) => `${t.id} [done] ${t.title}`));
  section("FORBIDDEN \u2014 never run, permanent tombstone", forbidden.map((t) => `${t.id} [forbidden] ${t.title}${t.reason ? `
   reason: ${t.reason}` : ""}`));
  section("UNKNOWN STATUS \u2014 fix the bracket", unknown.map((t) => `${t.id} [${t.status}] ${t.title}`));
  section("recurring", view.recurring.map(formatRecurringLine));
  const health = healthLines(view);
  if (health.length) lines.push("[board health]", ...health, "");
  return { stdout: `${lines.join("\n").replace(/\n+$/, "")}
`, stderr };
}
function boardBannerView(paths, cwd) {
  const inputs = [...manifestCandidates(paths.root), paths.log, paths.statusDir, paths.archive];
  if (!existsSync5(paths.manifest)) return { banner: "", inputs };
  const view = boardView(paths, cwd, false);
  if (view.all.length === 0 && view.recurring.length === 0) return { banner: "", inputs };
  const lines = [boardStatusView(paths, cwd, true, false).stdout.trimEnd()];
  const next = view.doing[0] ?? view.todo[0];
  if (next) {
    const epoch = next.created ? createdEpoch(next.created) : null;
    const age = epoch === null ? "" : `  (created ${next.created}, ${Math.floor((Date.now() / 1e3 - epoch) / 86400)}d ago)`;
    lines.push(`Resume: ${next.id}: ${next.title}${age}  (/cyberine-taskboard:tasks for the full view)`);
  }
  if (view.recurringDue) {
    lines.push(`${view.recurringDue} recurring task(s) due -- /cyberine-taskboard:tasks recurring list to see; /cyberine-taskboard:tasks status did <Rxx> after running.`);
  }
  return { banner: `${lines.join("\n")}
`, inputs };
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
      pending: view.pending
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
      reason: t.reason,
      duplicateOf: t.duplicateOf,
      path: t.path,
      owner: t.owner,
      created: t.created,
      ready: ready.has(t.id),
      stale: stale.has(t.id)
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
function boardNextJson(scoped, manifest) {
  const { sets } = scoped;
  return {
    schema: BOARD_NEXT_SCHEMA,
    manifest,
    scope: scoped.scope,
    hidden: scoped.hidden,
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
    runnable: sets.runnable.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority ?? "",
      deps: t.deps,
      path: t.path ?? ""
    })),
    waiting: sets.blocked.map((t) => {
      const unmet = missingDeps(t, sets);
      return {
        id: t.id,
        title: t.title,
        unmet,
        cycles: unmet.filter((d) => resolveDuplicateOf(sets.dupMap, d).cycle)
      };
    }),
    blocked: sets.waiting.map((t) => ({ id: t.id, title: t.title, blocker: t.blocker ?? "" })),
    doing: sets.doing.map((t) => ({ id: t.id, title: t.title, path: t.path ?? "" }))
  };
}
function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}
`);
}

// src/tasks/boardHtml.ts
import { existsSync as existsSync6, readFileSync as readFileSync6 } from "node:fs";
import { basename as basename4, join as join6, relative } from "node:path";

// scripts/taskboard-bundle/packageRootStub.ts
import { dirname as dirname3, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function packageRoot() {
  return resolve(dirname3(fileURLToPath(import.meta.url)), "..");
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
  if (!existsSync6(briefPath)) return [];
  const lines = readFileSync6(briefPath, "utf8").split("\n");
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
  if (!existsSync6(paths.archive) || recent <= 0) return [];
  const blocks = parseManifestBlocks(readFileSync6(paths.archive, "utf8"), TASK_ID_RE).blocks;
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
  const src = readFileSync6(paths.manifest, "utf8");
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
    const hasBrief = existsSync6(briefPath);
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
      repo: basename4(paths.root),
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
  if (!existsSync6(templatePath)) {
    throw new Error(`/cyberine-taskboard:tasks board: template missing at ${templatePath}`);
  }
  const template = readFileSync6(templatePath, "utf8");
  if (!template.includes("__DATA__") || !template.includes("<title>__TITLE__</title>")) {
    throw new Error(`/cyberine-taskboard:tasks board: template ${templatePath} is missing its __TITLE__ or __DATA__ slot`);
  }
  const json = JSON.stringify(data).replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");
  const title = `${data.meta.repo} \xB7 /cyberine-taskboard:tasks`.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  return template.replace("<title>__TITLE__</title>", () => `<title>${title}</title>`).replace("__DATA__", () => json);
}

// src/tasks/boardStatusExtras.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync2, readFileSync as readFileSync7 } from "node:fs";
import { dirname as dirname4, relative as relative2 } from "node:path";
function duplicateTarget(manifest, id) {
  const map = /* @__PURE__ */ new Map();
  for (const block of parseManifestBlocks(readFileSync7(manifest, "utf8")).blocks) {
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
  const src = existsSync7(briefPath) ? readFileSync7(briefPath, "utf8") : "";
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
  const src = readFileSync7(manifest, "utf8");
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
  const src = readFileSync7(manifest, "utf8");
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
  const blocks = parseManifestBlocks(readFileSync7(manifest, "utf8")).blocks;
  return ids.filter((id) => !blocks.find((b) => b.id === id)?.fields.get("reason")?.trim());
}

// src/tasks/boardRecurring.ts
import { existsSync as existsSync8, readFileSync as readFileSync8 } from "node:fs";
function epochOf(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return 0;
  return Math.floor(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() / 1e3);
}
function everyDays(value) {
  const n = Number(/^[0-9]+/.exec(value)?.[0] ?? 0);
  const unit = /[dwm]/.exec(value)?.[0] ?? "d";
  return n * (unit === "w" ? 7 : unit === "m" ? 30 : 1);
}
function recurringList(manifest) {
  if (!existsSync8(manifest)) return "";
  const blocks = parseManifestBlocks(readFileSync8(manifest, "utf8"), /^R[0-9]+$/).blocks;
  const today = epochOf(todayLocalDate());
  return blocks.filter((b) => b.status === "recurring").map((b) => {
    const every = b.fields.get("every") ?? "";
    const last = b.fields.get("last-done") ?? "";
    if (!last) return `NEW|${b.id}|0|${every}||${b.title}`;
    const elapsed = Math.floor((today - epochOf(last)) / 86400);
    const need = everyDays(every);
    return `${elapsed >= need ? "DUE" : "OK"}|${b.id}|${elapsed >= need ? elapsed - need : need - elapsed}|${every}|${last}|${b.title}`;
  }).join("\n");
}
function recurringDueCount(manifest) {
  return recurringList(manifest).split("\n").filter((line) => /^(DUE|NEW)\|/.test(line)).length;
}
function recurringDid(manifest, id) {
  if (!existsSync8(manifest)) throw new Error("no manifest");
  const src = readFileSync8(manifest, "utf8");
  const lines = src.endsWith("\n") ? src.slice(0, -1).split("\n") : src.split("\n");
  const block = parseManifestBlocks(lines.join("\n"), /^R[0-9]+$/).blocks.find((b) => b.id === id && b.status === "recurring");
  if (!block) throw new Error(`no such recurring task: ${id}`);
  const line = `last-done: ${todayLocalDate()}`;
  if (block.fields.has("last-done")) {
    for (let i = block.start + 1; i < block.end; i++) if (/^last-done:/.test(lines[i])) lines[i] = line;
  } else {
    let at = -1;
    for (let i = block.start + 1; i < block.end; i++) if (/^every:/.test(lines[i])) at = i + 1;
    if (at < 0) {
      at = block.end;
      while (at > block.start + 1 && lines[at - 1].trim() === "") at--;
    }
    lines.splice(at, 0, line);
  }
  writeFileAtomic(manifest, `${lines.join("\n")}
`, "tmp");
}
var R_FIELD_ORDER = ["every", "last-done", "exec", "model", "reasoning", "do"];
var EVERY_RE = /^[1-9][0-9]*[dwm]$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(v) {
  if (!DATE_RE.test(v)) return false;
  const parts = v.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
function validateRecurringFields(fields, merged) {
  if (fields.title !== void 0 && !fields.title) throw new BoardRejected("recurring: --title must not be empty");
  if (fields.do !== void 0 && !fields.do) throw new BoardRejected("recurring: --do must not be empty");
  if (fields.every !== void 0 && !EVERY_RE.test(fields.every)) {
    throw new BoardRejected(`recurring: --every must be <N>d, <N>w or <N>m with N >= 1 (got "${fields.every}")`);
  }
  if (fields.lastDone !== void 0 && fields.lastDone !== "-") {
    if (!isRealDate(fields.lastDone)) {
      throw new BoardRejected(`recurring: --last-done must be a real YYYY-MM-DD date or "-" (got "${fields.lastDone}")`);
    }
    if (fields.lastDone > todayLocalDate()) {
      throw new BoardRejected(`recurring: --last-done ${fields.lastDone} is in the future`);
    }
  }
  if (fields.exec !== void 0 && fields.exec !== "-" && !VALID_EXEC.has(fields.exec)) {
    throw new BoardRejected(`recurring: --exec must be one of ${[...VALID_EXEC].join("|")} or "-"`);
  }
  if (fields.model !== void 0 && fields.model !== "-" && !VALID_MODELS.has(fields.model)) {
    throw new BoardRejected(`recurring: --model must be one of ${[...VALID_MODELS].join("|")} or "-"`);
  }
  if (merged.model && !merged.exec) {
    throw new BoardRejected("recurring: model: only means something with exec: -- pass --exec too, or --model -");
  }
  if (merged.exec === "manual" && merged.model) {
    throw new BoardRejected("recurring: exec: manual dispatches no agent, so it takes no model: -- pass --model -");
  }
  if (fields.reasoning !== void 0 && fields.reasoning !== "-" && !VALID_REASONING.has(fields.reasoning)) {
    throw new BoardRejected(`recurring: --reasoning must be one of ${[...VALID_REASONING].join("|")} or "-"`);
  }
  if (merged.reasoning && merged.exec !== "agent") {
    throw new BoardRejected("recurring: reasoning: applies only to exec: agent -- pass --exec agent, or --reasoning -");
  }
}
function readLines(manifest) {
  const src = readFileSync8(manifest, "utf8");
  return src.endsWith("\n") ? src.split("\n").slice(0, -1) : src.split("\n");
}
function writeGuarded(manifest, before, after, delta) {
  if (countAllHeaders(after.join("\n")) !== countAllHeaders(before.join("\n")) + delta) {
    throw new BoardRejected("recurring: internal: the rewrite would change the block count unexpectedly -- manifest left untouched");
  }
  writeFileAtomic(manifest, `${after.join("\n")}
`, "tmp");
}
function findR(lines, id) {
  return parseManifestBlocks(lines.join("\n"), RECURRING_ID_RE).blocks.find((b) => b.id === id && b.status === "recurring");
}
function fieldSlot(lines, start, end, field) {
  const mine = R_FIELD_ORDER.indexOf(field);
  let at = start + 1;
  for (let i = start + 1; i < end; i++) {
    const m = /^([a-z][a-z-]*):/.exec(lines[i]);
    if (!m) continue;
    const pos = R_FIELD_ORDER.indexOf(m[1]);
    if (pos !== -1 && pos < mine) at = i + 1;
  }
  return at;
}
function addRecurring(manifest, fields) {
  if (!fields.title) throw new BoardRejected('recurring add: a "<title>" is required');
  if (!fields.every) throw new BoardRejected("recurring add: --every is required");
  if (!fields.do) throw new BoardRejected("recurring add: --do is required");
  if (fields.exec === "-" || fields.model === "-" || fields.reasoning === "-") {
    throw new BoardRejected('recurring add: "-" clears a field; add has nothing to clear -- omit the flag');
  }
  if (fields.lastDone === "-") {
    throw new BoardRejected('recurring add: omit --last-done for a never-run chore; "-" is only for set');
  }
  validateRecurringFields(fields, { exec: fields.exec ?? "", model: fields.model ?? "", reasoning: fields.reasoning ?? "" });
  const lines = readLines(manifest);
  const idRe = /^R([0-9]+)$/;
  let max = 0;
  for (const b of parseManifestBlocks(lines.join("\n")).blocks) {
    const m = idRe.exec(b.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const id = `R${String(max + 1).padStart(2, "0")}`;
  const block = [
    `## ${id} [recurring] ${fields.title}`,
    `every: ${fields.every}`,
    ...fields.lastDone ? [`last-done: ${fields.lastDone}`] : [],
    ...fields.exec ? [`exec: ${fields.exec}`] : [],
    ...fields.model ? [`model: ${fields.model}`] : [],
    ...fields.reasoning ? [`reasoning: ${fields.reasoning}`] : [],
    `do: ${fields.do}`
  ];
  const rBlocks = parseManifestBlocks(lines.join("\n"), RECURRING_ID_RE).blocks;
  const out2 = [...lines];
  if (rBlocks.length) {
    const lastBlock = rBlocks[rBlocks.length - 1];
    out2.splice(coreEnd(lines, lastBlock.start, lastBlock.end), 0, "", ...block);
  } else {
    while (out2.length && out2[out2.length - 1].trim() === "") out2.pop();
    out2.push("", ...block);
  }
  writeGuarded(manifest, lines, out2, 1);
  return id;
}
function setRecurring(manifest, id, fields) {
  const lines = readLines(manifest);
  const block = findR(lines, id);
  if (!block) throw new BoardRejected(`recurring set: no such recurring task: ${id}`);
  const cur = (k) => block.fields.get(k)?.trim() ?? "";
  const pick = (v, k) => v === void 0 ? cur(k) : v === "-" ? "" : v;
  if (fields.every === "-" || fields.do === "-" || fields.title === "-") {
    throw new BoardRejected(
      'recurring set: "-" clears only --exec, --model, --reasoning and --last-done; every:, do: and the title are required'
    );
  }
  validateRecurringFields(fields, {
    exec: pick(fields.exec, "exec"),
    model: pick(fields.model, "model"),
    reasoning: pick(fields.reasoning, "reasoning")
  });
  let out2 = [...lines];
  let end = block.end;
  if (fields.title !== void 0) out2[block.start] = `## ${id} [recurring] ${fields.title}`;
  const edits = [
    ["every", fields.every],
    ["last-done", fields.lastDone],
    ["exec", fields.exec],
    ["model", fields.model],
    ["reasoning", fields.reasoning],
    ["do", fields.do]
  ];
  for (const [name, value] of edits) {
    if (value === void 0) continue;
    const re = new RegExp(`^${name}:(\\s|$)`);
    const kept = out2.filter((l, i) => i <= block.start || i >= end || !re.test(l));
    end -= out2.length - kept.length;
    out2 = kept;
    if (value === "-") continue;
    out2.splice(fieldSlot(out2, block.start, end, name), 0, `${name}: ${value}`);
    end++;
  }
  if (out2.join("\n") === lines.join("\n")) return false;
  writeGuarded(manifest, lines, out2, 0);
  return true;
}
function dropRecurring(manifest, id) {
  if (!RECURRING_ID_RE.test(id)) throw new BoardRejected(`recurring drop: drop takes an exact R<NN> id (got "${id}")`);
  const lines = readLines(manifest);
  const block = findR(lines, id);
  if (!block) throw new BoardRejected(`recurring drop: no such recurring task: ${id} -- drop takes exact ids, never a prefix`);
  const out2 = [...lines];
  out2.splice(block.start, coreEnd(lines, block.start, block.end) - block.start);
  while (block.start < out2.length && out2[block.start].trim() === "" && (block.start === 0 || out2[block.start - 1].trim() === "")) {
    out2.splice(block.start, 1);
  }
  while (out2.length && out2[out2.length - 1].trim() === "") out2.pop();
  writeGuarded(manifest, lines, out2, -1);
  return block.title;
}

// src/tasks/boardClaim.ts
import { existsSync as existsSync10, readFileSync as readFileSync10 } from "node:fs";
import { hostname } from "node:os";

// src/tasks/manifestReader.ts
import { existsSync as existsSync9, readdirSync as readdirSync3, readFileSync as readFileSync9, statSync as statSync2 } from "node:fs";
import { join as join7 } from "node:path";
var STATUS_LOG_REL = [".local", "tasks", "status.log"];
var STATUS_TASKS_DIR_REL = [".local", "tasks"];
var STATUS_D_REL = [".local", "tasks", "status.d"];
var ID_PATTERN = "(?:T\\d+|R\\d+|k[0-9a-hjkmnp-tv-z]{4})";
var LIST_ITEM_RE = /^\s+-\s+(.+)$/;
var FORK_LINE_RE = /^fork:/;
var ID_TOKEN_RE = new RegExp(`^${ID_PATTERN}$`);
var EFFORT_RE = /^[SML]$/;
var PRIORITY_RE = /^p[0-2]$/;
var NO_VALUE = "-";
var KNOWN_STATUSES = TASK_STATUS_SET;
function resolveRepoRoot(cwd) {
  return repoRootStrict(cwd);
}
function findManifest(repoRoot) {
  for (const p of manifestCandidates(repoRoot)) {
    if (!existsSync9(p)) continue;
    try {
      return { path: p, content: readFileSync9(p, "utf8") };
    } catch (err) {
      process.stderr.write(
        `manifestReader: cannot read ${p}: ${err.message}
`
      );
    }
  }
  return null;
}
function listDirSafe(dir) {
  try {
    return readdirSync3(dir);
  } catch {
    return [];
  }
}
function collectOverlaySources(repoRoot) {
  const sources = [];
  const addIfReadable = (p) => {
    try {
      sources.push({ path: p, mtimeNs: statSync2(p, { bigint: true }).mtimeNs });
    } catch {
    }
  };
  const mainLog = join7(repoRoot, ...STATUS_LOG_REL);
  if (existsSync9(mainLog)) addIfReadable(mainLog);
  const tasksDir = join7(repoRoot, ...STATUS_TASKS_DIR_REL);
  if (existsSync9(tasksDir)) {
    for (const name of listDirSafe(tasksDir)) {
      if (name.startsWith("status.log.snap.")) addIfReadable(join7(tasksDir, name));
    }
  }
  const statusD = join7(repoRoot, ...STATUS_D_REL);
  if (existsSync9(statusD)) {
    for (const name of listDirSafe(statusD)) {
      if (name.startsWith(".tmp.")) continue;
      if (!name.endsWith(".log")) continue;
      addIfReadable(join7(statusD, name));
    }
  }
  return sources;
}
function parseOverlayLine(line) {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) return null;
  const fields = trimmed.split("	");
  if (fields.length < 4) return null;
  const id = fields[2];
  const status = fields[3];
  if (!ID_TOKEN_RE.test(id)) return null;
  if (!KNOWN_STATUSES.has(status)) return null;
  return { id, status };
}
function applyStatusOverlay(tasks, repoRoot) {
  const sources = collectOverlaySources(repoRoot);
  if (sources.length === 0) return;
  const overrides = /* @__PURE__ */ new Map();
  for (const line of orderOverlayLines(sources.map((s) => s.path)).text.split("\n")) {
    const parsed = parseOverlayLine(line);
    if (parsed) overrides.set(parsed.id, parsed.status);
  }
  for (const t of tasks) {
    const ov = overrides.get(t.id);
    if (ov) t.status = ov;
  }
}
function parseDeps(raw) {
  return raw.split(/[,\s]+/).filter((s) => s !== "" && s !== "-");
}
function fieldValue(block, key) {
  return block.fields.get(key)?.trim();
}
function presentValue(block, key) {
  const v = fieldValue(block, key);
  return v === void 0 || v === "" || v === NO_VALUE ? void 0 : v;
}
function forkEntries(lines, fenced, block) {
  let entries;
  for (let i = block.start + 1; i < block.end; i++) {
    if (fenced[i] || !FORK_LINE_RE.test(lines[i])) continue;
    const found = [];
    for (let j = i + 1; j < block.end && !fenced[j]; j++) {
      const next = lines[j];
      if (next.trim() === "") continue;
      const item = LIST_ITEM_RE.exec(next);
      if (!item) break;
      found.push(item[1].trim());
    }
    entries = found;
  }
  return entries !== void 0 && entries.length >= 2 ? entries : void 0;
}
function toTask(block, status, manifestPath, fork) {
  const exec = fieldValue(block, "exec");
  const model = fieldValue(block, "model");
  const blocker = presentValue(block, "blocker");
  const doText = fieldValue(block, "do");
  const doneWhen = fieldValue(block, "done-when");
  const area = presentValue(block, "area");
  const path = fieldValue(block, "path");
  const effort = fieldValue(block, "effort");
  const reasoning = fieldValue(block, "reasoning");
  const priority = fieldValue(block, "priority");
  const created = fieldValue(block, "created");
  const duplicateOf = presentValue(block, "duplicate-of");
  const deps = fieldValue(block, "deps");
  return {
    id: block.id,
    status,
    baseStatus: status,
    title: block.title,
    deps: deps === void 0 ? [] : parseDeps(deps),
    ...exec !== void 0 && { exec },
    ...model !== void 0 && { model },
    ...blocker !== void 0 && { blocker },
    ...doText !== void 0 && { do: doText },
    ...doneWhen !== void 0 && { doneWhen },
    ...area !== void 0 && { area },
    ...path !== void 0 && { path },
    ...fork !== void 0 && { fork },
    ...effort !== void 0 && EFFORT_RE.test(effort) && { effort },
    ...exec === "agent" && reasoning !== void 0 && VALID_REASONING.has(reasoning) && { reasoning },
    ...priority !== void 0 && PRIORITY_RE.test(priority) && { priority },
    ...created !== void 0 && { created },
    ...duplicateOf !== void 0 && { duplicateOf },
    manifestPath,
    line: block.start + 1
  };
}
function parseManifest(manifestPath, content) {
  const { blocks, warnings } = parseManifestBlocks(content, TASK_ID_RE);
  const lines = content.split("\n");
  const fenced = fencedLineFlags(lines);
  const tasks = [];
  for (const block of blocks) {
    if (block.status === null || !isTaskStatus(block.status)) continue;
    tasks.push(toTask(block, block.status, manifestPath, forkEntries(lines, fenced, block)));
  }
  if (tasks.length === 0 && content.includes("\r\n")) {
    warnings.push(
      `taskboard: ${manifestPath} has CRLF line endings, so no task header parses and the board reads as empty -- convert it to LF (/cyberine-taskboard:tasks doctor reports the same)`
    );
  }
  return { tasks, warnings };
}
function findManifestPath(cwd) {
  const repoRoot = resolveRepoRoot(cwd);
  if (!repoRoot) return null;
  return findManifest(repoRoot)?.path ?? null;
}
var NO_MANIFEST_MESSAGE = "no manifest found. create .claude/TASKS.md (or .local/tasks/ACTIVE.md) to populate the runnable set.";
function emptyManifestMessage(cwd) {
  const path = findManifestPath(cwd);
  if (path === null) return NO_MANIFEST_MESSAGE;
  return `board is empty: ${path} exists but holds no task block yet. add tasks (/cyberine-taskboard:tasks add) to populate the runnable set.`;
}
function readManifestReport(cwd) {
  const repoRoot = resolveRepoRoot(cwd);
  if (!repoRoot) {
    process.stderr.write(
      `manifestReader: not inside a git repository (cwd=${cwd}); returning empty task list
`
    );
    return { tasks: [], warnings: [] };
  }
  const manifest = findManifest(repoRoot);
  if (!manifest) return { tasks: [], warnings: [] };
  const report = parseManifest(manifest.path, manifest.content);
  applyStatusOverlay(report.tasks, repoRoot);
  return report;
}

// src/tasks/boardClaim.ts
function parseLease(value) {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const expiresAt = Number(parts[1]);
  if (!owner || !Number.isFinite(expiresAt)) return null;
  return { owner, expiresAt };
}
function claimOwner() {
  const session = boardEnv("NF_TASKS_SESSION") || agentTag();
  return `${session.replace(/\s+/g, "_")}@${normalizeHost(hostname())}`;
}
function leaseRefusal(paths, id, caller = claimOwner(), now = Date.now()) {
  const manifestSrc = readFileSync10(paths.manifest, "utf8");
  const statusBy = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  if (statusBy.get(id) !== "doing") return null;
  const block = parseManifestBlocks(manifestSrc, TASK_ID_RE).blocks.find((b) => b.id === id);
  const lease = parseLease(block?.fields.get("lease"));
  if (!lease) return null;
  if (lease.owner !== caller) {
    return `${id} is held by ${lease.owner}, not ${caller} -- a claim is never written over; re-claim it (/cyberine-taskboard:tasks run) if it is free`;
  }
  if (lease.expiresAt < now) {
    return `your lease on ${id} expired -- it may have been reclaimed by another session; re-claiming is not automatic, run \`/cyberine-taskboard:tasks run\` rather than keep writing`;
  }
  return null;
}

// src/tasks/boardNote.ts
import { existsSync as existsSync11, readFileSync as readFileSync11 } from "node:fs";
var FLAG_RE = /^--?[A-Za-z]/;
function resolveLiveTaskId(paths, rawId, cmd) {
  if (RECURRING_ID_RE.test(rawId)) {
    throw new BoardRejected(`${cmd}: ${rawId} is a recurring block -- ${cmd} only annotates task blocks`);
  }
  const { blocks } = parseManifestBlocks(readFileSync11(paths.manifest, "utf8"));
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
  const src = readFileSync11(manifest, "utf8");
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
  if (!existsSync11(briefPath)) {
    throw new BoardRejected(
      `brief note: no brief at ${briefPath} -- nothing to annotate; use \`note <id>\` for the manifest block`
    );
  }
  const src = readFileSync11(briefPath, "utf8");
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
import { existsSync as existsSync12, readFileSync as readFileSync13 } from "node:fs";

// src/tasks/boardTidy.ts
import { readFileSync as readFileSync12 } from "node:fs";
var TIDY_MARKER = "<!-- ===== FORBIDDEN \u2014 never run, permanent tombstones (board tidy) ===== -->";
var ANY_TIDY_MARKER_RE = /^<!-- ===== FORBIDDEN — never run, permanent tombstones \([a-z /:-]*(?:tasks|board) tidy\) ===== -->$/;
var TOKENS_HEADER = "<!-- Task board manifest v1. Status tokens: [backlog] [todo] [doing] [done] [forbidden]. -->";
var FORBIDDEN_HEADER_RE = new RegExp(`^## ${TASK_ID_SOURCE} \\[forbidden\\]`);
var CANDIDATE_HEADER_RE = new RegExp(`^## (${TASK_ID_SOURCE}) \\[(todo|backlog)\\]`);
var TITLE_STRIP_RE = new RegExp(`^## ${TASK_ID_SOURCE} \\[[a-z]+\\] `);
function splitLines(src) {
  return src.endsWith("\n") ? src.slice(0, -1).split("\n") : src.split("\n");
}
function writeManifestSafely(manifest, out2) {
  if (out2.length === 0) return false;
  writeFileAtomic(manifest, out2, "tidy");
  return true;
}
function refreshHeaderTokens(src) {
  const lines = splitLines(src);
  const hasTokensLine = lines.some((l) => l.includes("Status tokens:"));
  const hasForbiddenTokensLine = lines.some((l) => l.includes("Status tokens:") && l.includes("[forbidden]"));
  if (!hasTokensLine || hasForbiddenTokensLine) return null;
  let done = false;
  const out2 = lines.map((l) => {
    if (!done && /^<!--/.test(l) && l.includes("Status tokens:")) {
      done = true;
      return TOKENS_HEADER;
    }
    return l;
  });
  return out2.join("\n") + (src.endsWith("\n") ? "\n" : "");
}
function groupForbidden(src) {
  const lines = splitLines(src);
  const fenced = fencedLineFlags(lines);
  const nForbidden = lines.filter((l, i) => !fenced[i] && FORBIDDEN_HEADER_RE.test(l)).length;
  if (nForbidden === 0) return null;
  const bodyLines = [];
  const fbBlocks = [];
  let inForbidden = false;
  let block = "";
  const flush = () => {
    if (block !== "") fbBlocks.push(block);
    block = "";
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!fenced[i] && ANY_TIDY_MARKER_RE.test(l)) continue;
    if (!fenced[i] && FORBIDDEN_HEADER_RE.test(l)) {
      flush();
      inForbidden = true;
      block = l;
      continue;
    }
    if (!fenced[i] && /^## /.test(l)) {
      flush();
      inForbidden = false;
      bodyLines.push(l);
      continue;
    }
    if (inForbidden) {
      block += `
${l}`;
      continue;
    }
    bodyLines.push(l);
  }
  flush();
  if (fbBlocks.join("").length === 0) return null;
  const collapsed = [];
  let blanks = 0;
  for (const l of bodyLines) {
    if (/^\s*$/.test(l)) {
      blanks++;
      continue;
    }
    while (blanks > 0) {
      collapsed.push("");
      blanks--;
    }
    collapsed.push(l);
  }
  collapsed.push("");
  const partA = `${collapsed.join("\n")}
`;
  const partB = `${TIDY_MARKER}

`;
  const partC = fbBlocks.map((b) => `${b}
`).join("");
  return { out: partA + partB + partC, count: nForbidden };
}
function findCandidates(src) {
  const candidates = [];
  let cur = "";
  let st = "";
  let title = "";
  let flag = false;
  const emit = () => {
    if (cur !== "" && flag) candidates.push(`  ${cur} [${st}] ${title}`);
  };
  const lines = splitLines(src);
  const fenced = fencedLineFlags(lines);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenced[i]) continue;
    const h = line.match(CANDIDATE_HEADER_RE);
    if (h) {
      emit();
      cur = h[1];
      st = h[2];
      title = line.replace(TITLE_STRIP_RE, "");
      flag = /FORBIDDEN|NEVER RUN|DO NOT/.test(title);
      continue;
    }
    if (/^## /.test(line)) {
      emit();
      cur = "";
      flag = false;
      continue;
    }
    if (cur !== "" && /^blocker:\s/.test(line)) {
      if (/FORBIDDEN|ruled out|[Dd]o not run|DO NOT/.test(line)) flag = true;
    }
    if (cur !== "" && /^do:\s/.test(line)) {
      if (/[Ff]orbidden/.test(line)) flag = true;
    }
  }
  emit();
  return candidates;
}
function tidyBoard(paths) {
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new Error("tidy: could not acquire the board lock -- nothing changed");
  }
  let changed = false;
  let refreshedHeader = false;
  let groupedCount = 0;
  try {
    if (!reconcileLocked(paths)) {
      throw new Error("tidy: reconcile failed, so the manifest is not in a known state -- nothing changed");
    }
    {
      const src2 = readFileSync12(paths.manifest, "utf8");
      const out2 = refreshHeaderTokens(src2);
      if (out2 !== null && writeManifestSafely(paths.manifest, out2)) {
        refreshedHeader = true;
        changed = true;
      }
    }
    {
      const src2 = readFileSync12(paths.manifest, "utf8");
      const grouped = groupForbidden(src2);
      if (grouped && writeManifestSafely(paths.manifest, grouped.out)) {
        groupedCount = grouped.count;
        changed = true;
      }
    }
  } finally {
    unlock(paths.lock);
  }
  const src = readFileSync12(paths.manifest, "utf8");
  const candidates = findCandidates(src);
  return { refreshedHeader, groupedCount, candidates, changed };
}

// scripts/taskboard-bundle/boardSurfaceStub.ts
var FLEET_DISPATCH = false;

// src/tasks/boardSuggest.ts
function suggestReport(paths, cwd) {
  const lines = [];
  const hasManifest = existsSync12(paths.manifest);
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
    const src = readFileSync13(paths.manifest, "utf8");
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

// src/tasks/boardMove.ts
import { readFileSync as readFileSync14 } from "node:fs";
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
  const manifestSrc = readFileSync14(paths.manifest, "utf8");
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

// src/tasks/boardUnlogged.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync13, readFileSync as readFileSync15 } from "node:fs";
var DEFAULT_UNLOGGED_WINDOW = "24 hours ago";
function knownTaskIds(manifest, archive) {
  const ids = /* @__PURE__ */ new Set();
  for (const file of [manifest, archive]) {
    if (!existsSync13(file)) continue;
    for (const block of parseManifestBlocks(readFileSync15(file, "utf8"), TASK_ID_RE).blocks) ids.add(block.id);
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
  relocate --to sync|local [--dry]         Move a board and its adjacent history
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
${FLEET_USAGE}  status block <id> "<reason>"
  status unblock <id>
  add --title <t> --do <d> --done-when <w> --effort S|M|L [--status todo|backlog] [--created-by <who>]
      [--model <tier>] [--reasoning low|medium|high|xhigh|max] [--exec agent|manual|opencode] [--priority p0|p1|p2]
      [--area <a>] [--deps <ids>] [--why <w>] [--brief-file <path>]
  set <id> [--effort S|M|L] [--reasoning <level>|-] [--model <tier>|-] [--exec agent|manual|opencode] [--priority p0|p1|p2]
      [--title <text>] [--do <text>] [--done-when <text>] [--why <text>|-] [--reason <text>]
      (--reason is REQUIRED with --do or --done-when)
  set --batch <json-file|-> --by <model-id>   ({"changes":[{"id","model"?,"reasoning"?,"exec"?,"priority"?,"effort"?}...]})
      All-or-nothing: one bad entry rejects the whole batch, one write, one journal event
  deps show <id>
  deps set <id> "<ids|->"
  archive [--auto]
${END_LINES}  reconcile [--dry-run]
  doctor
  merge <dup-id> <survivor-id>
  merge --reject <a-id> <b-id>
  drop <id...> [--reason "<why>"] [--dry]
  forget <id...> [--dry]                    Erase every trace of ids, live or archived
                                            (the only way to remove an archived, [done] or
                                            [forbidden] id)
  log [--by <model>] "<what was done>" ["<...>" ...]
  note <id> "<text>"                        Append a dated update line to the manifest block
  brief note <id> "<text>"                  Append a dated entry to the brief's ## Updates
  journal "<title>" [--body <text>] [--id <id>]
  journal --title "<text>"
  timeline [<YYYY-MM-DD>] [--grep <pattern>]
  corpus [--recent N]
  unlogged [--since <ref|date>] [--json]   Read-only: commits in the window whose message names
                                            no board task id, plus uncommitted paths
                                            (default window: the last 24 hours)
  board [--out <file>] [--open] [--json] [--archive-recent N] [--journal-days N]
  migrate [--dry]
  save [--schema] [--input <file|->]         Write a decided batch of tasks (JSON), from drafts
                                            or from the conversation; one task by hand is add
  draft [--to <repo-path>] "<title>" [--do <text>] [--done-when <text>] [--why <text>]
        [--by <model-id>] [--file <path>|--stdin]
  inbox                                     Show the drafts waiting in .local/tasks/drafts/
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
  move <id> --before|--after <anchor-id>     Reorder one whole task block; refuses a recurring
                                            block, a [forbidden] block, or either as anchor

Bare \`/cyberine-taskboard:tasks\` (optionally with --all, --summary or --json) is \`/cyberine-taskboard:tasks status\`.
Ids accept git-style unambiguous prefixes. Validation refusals exit 2.`;
var SET_USAGE_LINE = "usage: set <id> [--effort|--reasoning|--model|--exec|--priority|--title|--do|--done-when|--why <v>] [--reason <text>] (--reason is required with --do or --done-when)";
var SELF_HELP_SUBCOMMANDS = /* @__PURE__ */ new Set(["run", "group", "end", "drop", "forget", "note", "brief", "board", "draft"]);
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
function requireManifest(paths) {
  if (!existsSync14(paths.manifest)) {
    refuse(`/cyberine-taskboard:tasks: no manifest at ${paths.manifest} -- create the board first`);
  }
}
function emitLint(paths) {
  if (!existsSync14(paths.manifest)) return;
  const notice = boardFormatNotice(paths.manifest);
  if (notice) warn(notice);
  for (const w of lintManifest(readFileSync16(paths.manifest, "utf8"))) warn(w);
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
function noPromoteActive(env) {
  const raw = (boardEnv("CYBERINE_TASKS_NO_PROMOTE", env) ?? "").trim().toLowerCase();
  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "no";
}
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
      appendAttempt(join8(paths.tasksDir, `${resolved}.md`), reason);
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
    const id = args2[1];
    const reason = args2.slice(2).join(" ");
    if (!id) refuse('/cyberine-taskboard:tasks status block: usage: status block <id> "<reason>"');
    out(withLock(paths, () => setBlocker(paths, id, reason)));
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
  const evidence = flagValue(args2, "--evidence");
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
  const ids = rawIds.length ? rawIds.map((raw) => resolveOrRefuse(raw, universe)) : fold(paths.manifest, paths).filter((t) => t.status === "doing").map((t) => t.id);
  if (!ids.length) {
    warn("no [doing] tasks to close.");
    return;
  }
  if (token === "done") {
    for (const id of ids) {
      const duplicate = duplicateTarget(paths.manifest, id);
      if (!duplicate) continue;
      refuse(duplicate.cycle ? `${id} is duplicate-of ${duplicate.target}, but that chain cycles back on itself -- fix the duplicate-of pointers before closing anything` : `${id} is duplicate-of ${duplicate.target} -- close ${duplicate.target} instead (\`status done ${duplicate.target}\`)`);
    }
  }
  if (token === "doing" || token === "done") {
    const caller = claimOwner();
    for (const id of ids) {
      const refusal = leaseRefusal(paths, id, caller);
      if (refusal) refuse(refusal);
    }
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
function runAdd(paths, args2) {
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
    "--brief-file",
    "--status",
    "--created-by"
  ];
  const title = flagValue(args2, "--title");
  const doText = flagValue(args2, "--do");
  const doneWhen = flagValue(args2, "--done-when");
  const effort = flagValue(args2, "--effort");
  const briefFile = flagValue(args2, "--brief-file");
  if (!title || !title.trim()) refuse("/cyberine-taskboard:tasks add: --title is required and non-empty");
  if (!doText || !doText.trim()) refuse("/cyberine-taskboard:tasks add: --do is required and non-empty");
  if (!doneWhen || !doneWhen.trim()) refuse("/cyberine-taskboard:tasks add: --done-when is required and non-empty");
  if (!effort) refuse("/cyberine-taskboard:tasks add: --effort is REQUIRED (S|M|L)");
  const unknown = args2.filter((a) => a.startsWith("--") && !VALUE_FLAGS.includes(a.split("=")[0]));
  if (unknown.length) refuse(`/cyberine-taskboard:tasks add: unknown flag(s): ${unknown.join(" ")}`);
  const exec = flagValue(args2, "--exec") ?? DEFAULT_TASK_EXEC;
  const model = exec === "manual" ? null : flagValue(args2, "--model") ?? DEFAULT_TASK_MODEL;
  const priority = flagValue(args2, "--priority");
  const reasoning = flagValue(args2, "--reasoning");
  const area = flagValue(args2, "--area");
  const deps = flagValue(args2, "--deps");
  const why = flagValue(args2, "--why");
  const status = flagValue(args2, "--status") ?? "todo";
  if (!WRITABLE_STATUSES.includes(status)) {
    refuse(`/cyberine-taskboard:tasks add: --status must be one of ${WRITABLE_STATUSES.join(" | ")}, got "${status}"`);
  }
  refuseIfPromoting(status, "/cyberine-taskboard:tasks add --status (default todo)");
  const createdBy = flagValue(args2, "--created-by");
  let briefBody;
  if (briefFile) {
    if (!existsSync14(briefFile)) refuse(`/cyberine-taskboard:tasks add: --brief-file not found: ${briefFile}`);
    briefBody = readFileSync16(briefFile, "utf8");
  }
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
    ...status !== "todo" && { status },
    ...createdBy !== void 0 && { createdBy }
  };
  const applyOut = briefBody === void 0 ? out : (line) => {
    if (line !== "briefs written: none") out(line);
  };
  withLock(paths, () => {
    const result = convergeApply(paths, [decision], applyOut, warn, false);
    const createdId = result.created[0]?.id;
    if (createdId !== void 0) {
      for (const issue of taskQualityIssues({ do: doText, effort, hasBrief: briefBody !== void 0 })) {
        warn(`/cyberine-taskboard:tasks add: warning: ${createdId}: ${issue}`);
      }
    }
    if (briefBody === void 0) return;
    const created = result.created[0];
    if (!created) return;
    mkdirSync3(paths.tasksDir, { recursive: true });
    const path = join8(paths.tasksDir, `${created.id}.md`);
    if (existsSync14(path) || existsSync14(join8(paths.tasksDir, "archive", `${created.id}.md`))) return;
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
  "--reason"
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
  if (inputPath !== "-" && !existsSync14(inputPath)) {
    refuse(`/cyberine-taskboard:tasks set --batch: no such file: ${inputPath}`);
  }
  const raw = inputPath === "-" ? await readStdin() : readFileSync16(inputPath, "utf8");
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
  if (effort !== void 0) changes.effort = effort;
  if (reasoning !== void 0) changes.reasoning = reasoning;
  if (model !== void 0) changes.model = model;
  if (exec !== void 0) changes.exec = exec;
  if (priority !== void 0) changes.priority = priority;
  if (title !== void 0) changes.title = title;
  if (doText !== void 0) changes.do = doText;
  if (doneWhen !== void 0) changes.doneWhen = doneWhen;
  if (why !== void 0) changes.why = why;
  if (Object.keys(changes).length === 0) {
    refuse("/cyberine-taskboard:tasks set: at least one of --effort/--reasoning/--model/--exec/--priority/--title/--do/--done-when/--why is required");
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
function runArchive(paths, args2) {
  const auto = hasFlag(args2, "--auto");
  const unknown = args2.filter((a) => a.startsWith("-") && a !== "--auto");
  if (unknown.length) refuse(`/cyberine-taskboard:tasks archive: unknown flag(s): ${unknown.join(" ")} -- nothing archived`);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    warn("/cyberine-taskboard:tasks: reconcile lock busy, aborting (nothing written)");
    process.exit(1);
  }
  try {
    if (archiveLocked(paths, { auto }, out).length) process.exitCode = 1;
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
    if (a === "--force") continue;
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
    out("     (or: /cyberine-taskboard:tasks end --force to wrap anyway and leave them in the inbox for later)");
    process.exitCode = 2;
    return;
  }
  const doing = fold(paths.manifest, paths).filter((t) => t.status === "doing");
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
      if (archiveLocked(paths, { auto: false }, out).length) process.exitCode = 1;
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
    finishEndHandoff(handoff, handoffSeed);
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
    const src = readFileSync16(paths.manifest, "utf8");
    out(`  ${plan.out === src ? "no" : "some"} manifest bytes would change`);
    out(`  ${plan.overlay.size} id(s) in the folded overlay${changedIds.length ? `: ${changedIds.join(", ")}` : ""}`);
    if (plan.evidence.size) out(`  ${plan.evidence.size} evidence field(s) would be baked`);
    if (plan.completed.size) out(`  ${plan.completed.size} completed: date(s) would be baked from the flip epoch`);
    if (plan.orphans.length) out(`  ${plan.orphans.length} orphan overlay id(s) would be DISCARDED: ${plan.orphans.join(", ")}`);
    out("  nothing was written");
    return;
  }
  if (reconcile(paths)) out(`reconciled overlay -> ${paths.manifest}`);
  else process.exitCode = 1;
}
function runDoctor(paths) {
  const report = analyze(gatherDoctorInputs(paths));
  out(formatReport(report));
  const manifests = existingManifests(paths.root);
  if (manifests.length > 1) {
    out(`
10) Multiple manifests -- ${manifests[0]} hides ${manifests.slice(1).join(", ")}`);
    out("  Resolve the competing boards before making further board changes.");
  }
  if (hasBlockingFindings(report) || manifests.length > 1) process.exitCode = 1;
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
var NOTE_USAGE = `usage: /cyberine-taskboard:tasks note <id> "<text>"

Appends one dated line to the task's manifest block, below its fields:
  update <YYYY-MM-DD>: <text>
and records the same text as a journal note attached to <id>. The line is
not field-shaped, so every parser reads past it. <id> accepts an unambiguous
prefix; recurring R<NN> and archived ids are refused.`;
var BRIEF_NOTE_USAGE = `usage: /cyberine-taskboard:tasks brief note <id> "<text>"

Adds one dated entry to the "## Updates" section at the TOP of tasks/<id>.md,
creating the section above the first heading when absent:
  - <YYYY-MM-DD>: <text>
Entries append oldest-first. The six brief sections are never rewritten.
Records the same text as a journal note attached to <id>. Refuses a task that
has no brief (use \`note <id>\` for the manifest block instead).`;
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
  const parsed = parseIdAndText(args2, "note", NOTE_USAGE);
  const { id, line } = withLock(paths, () => {
    const resolvedId = resolveLiveTaskId(paths, parsed.rawId, "note");
    const appendedLine = appendUpdateLine(paths.manifest, resolvedId, parsed.text);
    return { id: resolvedId, line: appendedLine };
  });
  out(`${id}: ${line}`);
  journalNoteEvent(paths, id, `note ${id}: ${parsed.text}`, "note");
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
  const parsed = parseIdAndText(rest, "brief note", BRIEF_NOTE_USAGE);
  const id = withLock(paths, () => {
    const resolvedId = resolveLiveTaskId(paths, parsed.rawId, "brief note");
    addBriefUpdate(join8(paths.tasksDir, `${resolvedId}.md`), parsed.text);
    return resolvedId;
  });
  out(`${id}: brief updated (${UPDATES_HEADING})`);
  journalNoteEvent(paths, id, `brief note ${id}: ${parsed.text}`, "brief note");
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
        out(`  ${day.slice(5)}  ${deriveDayTitle(readJournalDayFolded(paths, day))}`);
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
  for (const ev of events.filter((e) => e.kind === "decided")) {
    out("");
    out(`### ${ev.id} -- ${ev.title ?? ""}`);
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
  const manifestSrc = readFileSync16(paths.manifest, "utf8");
  const parsed = parseManifestBlocks(manifestSrc, TASK_ID_RE);
  for (const w of parsed.warnings) warn(w);
  const effective = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const toRecord = (b, source, statusOverride) => {
    const area = (b.fields.get("area") ?? "").trim();
    const why = b.fields.get("why")?.trim();
    const effort = b.fields.get("effort")?.trim();
    return {
      id: b.id,
      status: statusOverride ?? b.status ?? "",
      title: b.title,
      do: b.fields.get("do") ?? "",
      why: why ? why : null,
      effort: effort ? effort : null,
      area: area ? area.split(/\s+/) : [],
      path: b.fields.get("path") ?? null,
      source
    };
  };
  for (const b of parsed.blocks) out(JSON.stringify(toRecord(b, "manifest", effective.get(b.id))));
  const archiveBlocks = existsSync14(paths.archive) ? parseManifestBlocks(readFileSync16(paths.archive, "utf8"), TASK_ID_RE).blocks : [];
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
  const target = outFile ?? join8(paths.root, ".local", "tasks", "board.html");
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
  const src = readFileSync16(paths.manifest, "utf8");
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
async function runConvergeApply(paths, args2) {
  if (hasFlag(args2, "--schema")) {
    out(SCHEMA_TEXT);
    return;
  }
  const inputPath = flagValue(args2, "--input");
  let raw;
  if (inputPath && inputPath !== "-") {
    if (!existsSync14(inputPath)) refuse(`/cyberine-taskboard:tasks save: no such input file: ${inputPath}`);
    raw = readFileSync16(inputPath, "utf8");
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
    for (const created of result.created) {
      const decision = decisions.find((d) => d.title === created.title);
      if (decision === void 0 || typeof decision.do !== "string") continue;
      for (const issue of taskQualityIssues({ do: decision.do, effort: decision.effort, hasBrief: true })) {
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
  if (file && (!existsSync14(file) || !statSync3(file).isFile())) refuse(`/cyberine-taskboard:tasks draft: --file not found: ${file}`);
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
  if (flagValue(args2, "--to")) out(`  NOTE: draft-and-leave -- the next session of ${basename5(result.root)} picks it up.`);
  else out("  next: /cyberine-taskboard:tasks inbox  (this repo)");
}
function runBanner(args2) {
  const cwdIdx = args2.indexOf("--cwd");
  const cwd = cwdIdx >= 0 && args2[cwdIdx + 1] ? resolve2(args2[cwdIdx + 1]) : process.cwd();
  let result = { banner: "", inputs: [] };
  try {
    result = boardBannerView(resolveBoard(cwd), cwd);
  } catch (error) {
    console.error("/cyberine-taskboard:tasks banner: board unreadable, staying silent:", error.message);
  }
  process.stdout.write(args2.includes("--json") ? `${JSON.stringify(result)}
` : result.banner);
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
  const decision = boardGuardDecision(payload);
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
      case "relocate":
        out(relocateBoard(paths.root, rest));
        return;
      case "status":
        runStatus(paths, rest);
        return;
      case "recurring":
        runRecurring(paths, rest);
        return;
      case "add":
        runAdd(paths, rest);
        return;
      case "set":
        await runSet(paths, rest);
        return;
      case "deps":
        runDeps(paths, rest);
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
        return;
      case "draft":
        await runDraft(rest);
        return;
      case "inbox":
        if (rest.length) refuse("/cyberine-taskboard:tasks inbox: no arguments accepted");
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
import { existsSync as existsSync15, readFileSync as readFileSync17, realpathSync as realpathSync2, statSync as statSync4 } from "node:fs";
import { delimiter, dirname as dirname6, join as join9 } from "node:path";
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
    return JSON.parse(readFileSync17(file, "utf8"));
  } catch {
    return void 0;
  }
}
function bigPluginLinked(home) {
  try {
    const dir = realpathSync2(join9(home, ".claude", "skills", BIG_PLUGIN_NAME));
    if (!statSync4(dir).isDirectory()) return false;
    const manifest = readJson(join9(dir, ".claude-plugin", "plugin.json"));
    return isRecord(manifest) && manifest.name === BIG_PLUGIN_NAME;
  } catch {
    return false;
  }
}
function settingsScopeFiles(home, cwd) {
  return [
    join9(home, ".claude", "settings.json"),
    join9(cwd, ".claude", "settings.json"),
    join9(cwd, ".claude", "settings.local.json")
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
    const candidate = join9(dir, BIG_PLUGIN_NAME);
    if (!existsSync15(candidate)) continue;
    try {
      return dirname6(realpathSync2(candidate));
    } catch {
      return null;
    }
  }
  return null;
}
function bigPluginHooksFindCli(mode, env) {
  const binDir = bigPluginBinDir(env);
  return binDir !== null && existsSync15(join9(binDir, HOOK_LAUNCHERS[mode]));
}
function bigPluginHooksWouldRun(mode, env, home, cwd) {
  if (!bigPluginHooksFindCli(mode, env)) return false;
  return bigPluginLinked(home) || bigPluginEnabledInSettings(home, cwd);
}

// scripts/taskboard-bundle/entry.ts
function runNext(rest) {
  const unknown = rest.filter((a) => a !== "--all" && a !== "--json");
  if (unknown.length > 0) {
    process.stderr.write(`next: unknown argument(s): ${unknown.join(" ")} -- usage: next [--all] [--json]
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
    writeJsonLine(boardNextJson(scoped, tasks[0].manifestPath));
    return;
  }
  const notice = submoduleScopeNotice(scoped);
  if (notice) process.stderr.write(`${notice}
`);
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
