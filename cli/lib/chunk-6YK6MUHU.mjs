#!/usr/bin/env node
import {
  BoardRejected,
  VALID_EXEC,
  VALID_MODELS,
  VALID_REASONING,
  archivedIds,
  briefText,
  coreEnd,
  countAllHeaders,
  renderBlock,
  replaceDoneWhenBody,
  upsertField,
  validateDecisions,
  validateFieldPair,
  withTaskDefaults
} from "./chunk-66MJ3JXB.mjs";
import {
  appendJournalEvents,
  normalizeHost
} from "./chunk-ODYPGOF4.mjs";
import {
  RECURRING_ID_RE,
  TASK_ID_RE,
  TASK_STATUS_SET,
  agentTag,
  assertFreshId,
  boardEnv,
  briefFileIds,
  collapseWhitespace,
  epochToLocalIso,
  fencedLineFlags,
  fold,
  isTaskStatus,
  malformedIdMessage,
  manifestCandidates,
  mintTaskId,
  normalizeTaskPath,
  orderOverlayLines,
  parseManifestBlocks,
  repoRootStrict,
  scopeForBoard,
  todayLocalDate,
  writeFileAtomic
} from "./chunk-KIJLE46J.mjs";

// src/tasks/boardSplit.ts
import { createHash } from "node:crypto";
import { appendFileSync, existsSync as existsSync4, mkdirSync, readFileSync as readFileSync4, writeFileSync } from "node:fs";
import { dirname, join as join2 } from "node:path";

// src/tasks/boardClaim.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import { hostname } from "node:os";

// src/tasks/boardRecurring.ts
import { existsSync, readFileSync } from "node:fs";
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
  if (!existsSync(manifest)) return "";
  const blocks = parseManifestBlocks(readFileSync(manifest, "utf8"), /^R[0-9]+$/).blocks;
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
  if (!existsSync(manifest)) throw new Error("no manifest");
  const src = readFileSync(manifest, "utf8");
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
  const src = readFileSync(manifest, "utf8");
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
  const out = [...lines];
  if (rBlocks.length) {
    const lastBlock = rBlocks[rBlocks.length - 1];
    out.splice(coreEnd(lines, lastBlock.start, lastBlock.end), 0, "", ...block);
  } else {
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    out.push("", ...block);
  }
  writeGuarded(manifest, lines, out, 1);
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
  let out = [...lines];
  let end = block.end;
  if (fields.title !== void 0) out[block.start] = `## ${id} [recurring] ${fields.title}`;
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
    const kept = out.filter((l, i) => i <= block.start || i >= end || !re.test(l));
    end -= out.length - kept.length;
    out = kept;
    if (value === "-") continue;
    out.splice(fieldSlot(out, block.start, end, name), 0, `${name}: ${value}`);
    end++;
  }
  if (out.join("\n") === lines.join("\n")) return false;
  writeGuarded(manifest, lines, out, 0);
  return true;
}
function dropRecurring(manifest, id) {
  if (!RECURRING_ID_RE.test(id)) throw new BoardRejected(`recurring drop: drop takes an exact R<NN> id (got "${id}")`);
  const lines = readLines(manifest);
  const block = findR(lines, id);
  if (!block) throw new BoardRejected(`recurring drop: no such recurring task: ${id} -- drop takes exact ids, never a prefix`);
  const out = [...lines];
  out.splice(block.start, coreEnd(lines, block.start, block.end) - block.start);
  while (block.start < out.length && out[block.start].trim() === "" && (block.start === 0 || out[block.start - 1].trim() === "")) {
    out.splice(block.start, 1);
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  writeGuarded(manifest, lines, out, -1);
  return block.title;
}

// src/tasks/manifestReader.ts
import { existsSync as existsSync2, readdirSync, readFileSync as readFileSync2, statSync } from "node:fs";
import { join } from "node:path";
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
    if (!existsSync2(p)) continue;
    try {
      return { path: p, content: readFileSync2(p, "utf8") };
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
    return readdirSync(dir);
  } catch {
    return [];
  }
}
function collectOverlaySources(repoRoot) {
  const sources = [];
  const addIfReadable = (p) => {
    try {
      sources.push({ path: p, mtimeNs: statSync(p, { bigint: true }).mtimeNs });
    } catch {
    }
  };
  const mainLog = join(repoRoot, ...STATUS_LOG_REL);
  if (existsSync2(mainLog)) addIfReadable(mainLog);
  const tasksDir = join(repoRoot, ...STATUS_TASKS_DIR_REL);
  if (existsSync2(tasksDir)) {
    for (const name of listDirSafe(tasksDir)) {
      if (name.startsWith("status.log.snap.")) addIfReadable(join(tasksDir, name));
    }
  }
  const statusD = join(repoRoot, ...STATUS_D_REL);
  if (existsSync2(statusD)) {
    for (const name of listDirSafe(statusD)) {
      if (name.startsWith(".tmp.")) continue;
      if (!name.endsWith(".log")) continue;
      addIfReadable(join(statusD, name));
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
  const verify = fieldValue(block, "verify");
  const area = presentValue(block, "area");
  const path = fieldValue(block, "path");
  const effort = fieldValue(block, "effort");
  const reasoning = fieldValue(block, "reasoning");
  const priority = fieldValue(block, "priority");
  const created = fieldValue(block, "created");
  const duplicateOf = presentValue(block, "duplicate-of");
  const createdBy = presentValue(block, "created-by");
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
    ...verify !== void 0 && verify !== "-" && verify.trim() !== "" && { verify: verify.trim() },
    ...area !== void 0 && { area },
    ...path !== void 0 && { path },
    ...fork !== void 0 && { fork },
    ...effort !== void 0 && EFFORT_RE.test(effort) && { effort },
    ...exec === "agent" && reasoning !== void 0 && VALID_REASONING.has(reasoning) && { reasoning },
    ...priority !== void 0 && PRIORITY_RE.test(priority) && { priority },
    ...created !== void 0 && { created },
    ...duplicateOf !== void 0 && { duplicateOf },
    ...createdBy !== void 0 && { createdBy },
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
  return readManifestReportAt(repoRoot);
}
function readManifestReportAt(repoRoot) {
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
  const session = boardEnv("CYBERINE_TASKS_SESSION") || agentTag();
  return `${session.replace(/\s+/g, "_")}@${normalizeHost(hostname())}`;
}
function leaseRefusal(paths, id, caller = claimOwner(), now = Date.now()) {
  const manifestSrc = readFileSync3(paths.manifest, "utf8");
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

// src/tasks/boardSplit.ts
var SPLIT_SCHEMA = "board-split/1";
var SPLIT_SHAPES = ["resource", "decision", "eyes", "convert"];
var SPLIT_SCHEMA_TEXT = `/cyberine-taskboard:tasks split <id> --input <file|-> [--dry] -- input shape (${SPLIT_SCHEMA}):

{
  "schema": "${SPLIT_SCHEMA}",
  "op": "split-k1234-s3",          // required, [a-z0-9][a-z0-9-]{5,63}: the retry identity
  "shape": "resource",             // required: resource | decision | eyes | convert
  "source": "k1234",               // optional, must equal the <id> argument when given
  "amend": {                       // optional changes to the source block
    "title": "...", "do": "...", "doneWhen": "...",
    "exec": "agent", "model": "sonnet",   // exec manual needs model null
    "deps": ["k0001", "@owner"],          // full replacement list
    "blocker": null,                      // null removes the blocker
    "reason": "..."                       // required when any other key is set
  },
  "tasks": [                       // new tasks, the save batch shape plus a role
    { "ref": "owner", "role": "owner", "title": "Owner: provision ...", "exec": "manual", "model": null,
      "effort": "S", "deps": [], "do": "...", "doneWhen": "...", "brief": { ...six sections... } },
    { "ref": "verify", "role": "verify", "title": "Verify ... live", "exec": "agent", "model": "sonnet",
      "effort": "S", "deps": ["@owner", "@source"], "do": "...", "doneWhen": "...", "brief": { ... } }
  ],
  "dependents": { "k5678": "@verify", "k9012": "keep" }   // every current dependent of the source
}

Shapes: resource = one owner + one verify task (verify deps on @owner and @source); decision = one
"Owner: decide" task, no verify, amend.deps gains @owner; eyes = one owner task with deps on @source,
no verify; convert = no tasks, amend.exec "manual". Roles: owner (exec manual, model null, title
"Owner: ..."), verify, agent. The contract is docs/tasks-manifest.md section 15.`;
var OP_RE = /^[a-z0-9][a-z0-9-]{5,63}$/;
var AMEND_KEYS = /* @__PURE__ */ new Set(["title", "do", "doneWhen", "exec", "model", "deps", "blocker", "reason"]);
var OWNER_TITLE_RE = /^\s*Owner:/i;
var OWNER_DECIDE_RE = /^\s*Owner:\s*decide\b/i;
var HEADER_PREFIX_RE = /^(## \S+ \[[^\]]*\])(?: .*)?$/;
var DEPS_LINE_RE = /^deps:(\s|$)/;
function splitLedgerPath(paths) {
  return join2(dirname(paths.log), "split-ops.jsonl");
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function splitFingerprint(input, source) {
  return createHash("sha256").update(canonical({ ...input, source })).digest("hex");
}
function readLedger(path) {
  if (!existsSync4(path)) return [];
  const out = [];
  for (const line of readFileSync4(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      throw new BoardRejected(`split: ${path} holds a line that is not JSON -- repair the ledger before splitting`);
    }
  }
  return out;
}
function appendLedger(path, entry) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}
`);
}
function depList(value) {
  const v = value?.trim();
  return !v || v === "-" ? [] : v.split(/[,\s]+/).filter(Boolean);
}
function fieldIndex(lines, start, end, re) {
  const fenced = fencedLineFlags(lines);
  for (let i = start + 1; i < end; i++) if (!fenced[i] && re.test(lines[i])) return i;
  return -1;
}
function setDepsLine(lines, start, end, deps) {
  const value = `deps: ${deps.length ? deps.join(", ") : "-"}`;
  const idx = fieldIndex(lines, start, end, DEPS_LINE_RE);
  if (idx === -1) lines.splice(start + 1, 0, value);
  else lines[idx] = value;
}
function clampedCoreEnd(lines, start, end) {
  return coreEnd(lines, start, Math.min(end, lines.length));
}
function findCycle(graph, starts) {
  const state = /* @__PURE__ */ new Map();
  const stack = [];
  const walk = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      const s = state.get(dep) ?? 0;
      if (s === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (s === 0 && graph.has(dep)) {
        const found = walk(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(node, 2);
    return null;
  };
  for (const s of starts) {
    if ((state.get(s) ?? 0) === 0) {
      const found = walk(s);
      if (found) return found;
    }
  }
  return null;
}
function parseSplitInput(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BoardRejected("split: input must be one JSON object -- see `split --schema`");
  const o = raw;
  if (o.schema !== SPLIT_SCHEMA) errors.push(`schema must be "${SPLIT_SCHEMA}" (got ${JSON.stringify(o.schema)})`);
  if (typeof o.op !== "string" || !OP_RE.test(o.op)) errors.push(`op must match ${OP_RE.source} (got ${JSON.stringify(o.op)})`);
  if (typeof o.shape !== "string" || !SPLIT_SHAPES.includes(o.shape)) {
    errors.push(`shape must be one of ${SPLIT_SHAPES.join(" | ")} (got ${JSON.stringify(o.shape)})`);
  }
  if (o.source !== void 0 && typeof o.source !== "string") errors.push("source must be a task id string");
  if (!Array.isArray(o.tasks)) errors.push("tasks must be an array (use [] for none)");
  if (!o.dependents || typeof o.dependents !== "object" || Array.isArray(o.dependents)) {
    errors.push('dependents must be an object mapping every current dependent of the source to "keep" or "@<ref>" (use {} for none)');
  } else {
    for (const [k, v] of Object.entries(o.dependents)) {
      if (typeof v !== "string") errors.push(`dependents.${k} must be "keep" or "@<ref>"`);
    }
  }
  if (o.amend !== void 0) {
    if (!o.amend || typeof o.amend !== "object" || Array.isArray(o.amend)) errors.push("amend must be an object");
    else {
      const a = o.amend;
      for (const k of Object.keys(a)) if (!AMEND_KEYS.has(k)) errors.push(`amend.${k} is not an allowed key (${[...AMEND_KEYS].join(", ")})`);
      if ("blocker" in a && a.blocker !== null) errors.push("amend.blocker accepts only null (removes the blocker)");
      if (a.deps !== void 0 && (!Array.isArray(a.deps) || a.deps.some((d) => typeof d !== "string"))) errors.push("amend.deps must be an array of strings");
      const changing = Object.keys(a).filter((k) => k !== "reason");
      if (changing.length && (typeof a.reason !== "string" || !a.reason.trim())) errors.push("amend.reason is required when amend changes anything");
      for (const k of ["title", "do", "doneWhen", "reason"]) {
        const v = a[k];
        if (v !== void 0 && (typeof v !== "string" || !v.trim() || /[\r\n]/.test(v))) errors.push(`amend.${k} must be a non-empty single line`);
      }
    }
  }
  if (Array.isArray(o.tasks)) {
    o.tasks.forEach((t, i) => {
      const role = t?.role;
      if (role !== "owner" && role !== "verify" && role !== "agent") errors.push(`tasks[${i}].role must be owner | verify | agent`);
      const ref = t?.ref;
      if (ref === "source") errors.push(`tasks[${i}].ref "source" is reserved for the source task`);
    });
  }
  if (errors.length) throw new BoardRejected(`split: rejected, nothing written:
${errors.map((e) => `  - ${e}`).join("\n")}`);
  return o;
}
function shapeErrors(input, tasks) {
  const errors = [];
  const owners = tasks.filter((t) => t.role === "owner");
  const verifies = tasks.filter((t) => t.role === "verify");
  const has = (list, ref) => (list ?? []).includes(ref);
  for (const t of owners) {
    if (t.exec !== "manual" || t.model !== null) errors.push(`@${t.ref}: an owner task is exec manual with model null`);
    if (!OWNER_TITLE_RE.test(t.title ?? "")) errors.push(`@${t.ref}: an owner task title starts with "Owner:"`);
  }
  switch (input.shape) {
    case "resource":
      if (owners.length !== 1 || verifies.length !== 1) errors.push("shape resource needs exactly one owner task and one verify task");
      for (const v of verifies) {
        if (owners[0] && !has(v.deps, `@${owners[0].ref}`)) errors.push(`@${v.ref}: the verify task depends on @${owners[0].ref}`);
        if (!has(v.deps, "@source")) errors.push(`@${v.ref}: the verify task depends on @source`);
      }
      break;
    case "decision":
      if (owners.length !== 1 || verifies.length !== 0) errors.push("shape decision needs exactly one owner task and no verify task");
      if (owners[0] && !OWNER_DECIDE_RE.test(owners[0].title)) errors.push(`@${owners[0].ref}: a decision owner task is titled "Owner: decide ..."`);
      if (owners[0] && !has(input.amend?.deps, `@${owners[0].ref}`)) errors.push(`shape decision: amend.deps must include @${owners[0].ref}`);
      break;
    case "eyes":
      if (owners.length !== 1 || verifies.length !== 0) errors.push("shape eyes needs exactly one owner task and no verify task");
      if (owners[0] && !has(owners[0].deps, "@source")) errors.push(`@${owners[0].ref}: the eyes owner task depends on @source`);
      break;
    case "convert":
      if (tasks.length !== 0) errors.push("shape convert creates no tasks");
      if (input.amend?.exec !== "manual") errors.push('shape convert needs amend.exec "manual"');
      break;
  }
  return errors;
}
function splitTask(paths, sourceArg, input, opts = {}) {
  const source = sourceArg.trim();
  if (!TASK_ID_RE.test(source)) throw new BoardRejected(`split: ${malformedIdMessage(source)}`);
  if (input.source !== void 0 && input.source !== source) {
    throw new BoardRejected(`split: input.source ${input.source} does not match the <id> argument ${source}`);
  }
  const fingerprint = splitFingerprint(input, source);
  const ledgerPath = splitLedgerPath(paths);
  const prior = readLedger(ledgerPath).filter((e) => e.op === input.op);
  const last = prior[prior.length - 1];
  if (last && last.fingerprint !== fingerprint) {
    throw new BoardRejected(`split: op ${input.op} was already used with a different input -- a changed payload needs a new op id`);
  }
  if (last && last.state === "done") {
    const lines2 = [`split ${input.op}: already applied to ${last.source}, nothing written`, ...Object.entries(last.ids).map(([r, id]) => `  @${r} -> ${id}`)];
    return { state: "replayed", source: last.source, ids: last.ids, lines: lines2 };
  }
  const resumeIds = last?.state === "begun" ? last.ids : null;
  const src = readFileSync4(paths.manifest, "utf8");
  const hadTrailingNewline = src.endsWith("\n");
  const lines = hadTrailingNewline ? src.split("\n").slice(0, -1) : src.split("\n");
  const { blocks } = parseManifestBlocks(src, TASK_ID_RE);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const archived = archivedIds(paths.archive);
  if (resumeIds && Object.values(resumeIds).every((id) => byId.has(id))) {
    writeBriefs(paths, input, resumeIds);
    appendLedger(ledgerPath, { op: input.op, fingerprint, source, ids: resumeIds, state: "done", ts: (/* @__PURE__ */ new Date()).toISOString() });
    return { state: "resumed", source, ids: resumeIds, lines: [`split ${input.op}: finished an interrupted write on ${source}`] };
  }
  const block = byId.get(source);
  if (!block) {
    throw new BoardRejected(archived.has(source) ? `split: ${source} is archived -- an archived task is never split` : `split: no such task: ${source}`);
  }
  const effective = fold(paths.manifest, paths).find((t) => t.id === source)?.status ?? block.status ?? "";
  if (effective === "forbidden") throw new BoardRejected(`split: ${source} is [forbidden] -- tombstone, refusing`);
  if (effective === "done") throw new BoardRejected(`split: ${source} is effectively [done] -- a finished task is never split`);
  if (effective === "doing") throw new BoardRejected(`split: ${source} is [doing] -- a worker may hold it; split it once it is back to todo`);
  const dupOf = block.fields.get("duplicate-of")?.trim();
  if (dupOf && dupOf !== "-") throw new BoardRejected(`split: ${source} is duplicate-of ${dupOf} -- split the survivor instead`);
  const lease = parseLease(block.fields.get("lease"));
  if (lease && lease.expiresAt >= (opts.now ?? Date.now())) {
    throw new BoardRejected(`split: ${source} is claimed by ${lease.owner} -- refusing while the lease is live`);
  }
  const inherited = normalizeTaskPath(block.fields.get("path")) || scopeForBoard(process.cwd(), paths.root);
  const tasks = input.tasks.map((t) => {
    const withDefaults = withTaskDefaults(t);
    const path = inherited && (withDefaults.path === void 0 || withDefaults.path === null) ? { path: inherited } : {};
    return { ...withDefaults, ...path, role: t.role };
  });
  const errors = [...validateDecisions(tasks, true), ...shapeErrors(input, tasks)];
  const refs = new Set(tasks.map((t) => t.ref));
  const forbidden = new Set(blocks.filter((b) => b.status === "forbidden").map((b) => b.id));
  const known = /* @__PURE__ */ new Set([...byId.keys(), ...archived]);
  const sourceDepsBefore = depList(block.fields.get("deps"));
  const checkDep = (owner, d, allowArchived) => {
    if (d === "@source") {
      if (owner === "@source") errors.push("amend.deps: the source cannot depend on itself");
      return;
    }
    if (d.startsWith("@")) {
      if (!refs.has(d.slice(1))) errors.push(`${owner}: dep "${d}" does not resolve to any ref in this split`);
      return;
    }
    if (!TASK_ID_RE.test(d)) errors.push(`${owner}: dep ${malformedIdMessage(d)}`);
    else if (d === source) errors.push(`${owner}: name the source as "@source", not ${d}`);
    else if (!known.has(d)) errors.push(`${owner}: unknown dep id "${d}" -- not on the board or in the archive`);
    else if (forbidden.has(d)) errors.push(`${owner}: dep "${d}" is [forbidden] -- permanently unsatisfiable`);
    else if (!byId.has(d) && !allowArchived) errors.push(`${owner}: dep "${d}" is archived -- a dep the split introduces must be a live task`);
  };
  for (const t of tasks) for (const d of t.deps ?? []) if (typeof d === "string") checkDep(`@${t.ref}`, d, false);
  const amend = input.amend ?? {};
  for (const d of amend.deps ?? []) checkDep("@source", d, sourceDepsBefore.includes(d));
  const start = block.start;
  let end = clampedCoreEnd(lines, block.start, block.end);
  const currentField = (name) => {
    const idx = fieldIndex(lines, start, end, new RegExp(`^${name}:(\\s|$)`));
    return idx === -1 ? null : lines[idx].replace(new RegExp(`^${name}:\\s?`), "").trim();
  };
  if (amend.exec !== void 0 || amend.model !== void 0) {
    errors.push(
      ...validateFieldPair(
        { exec: amend.exec, model: amend.model === void 0 ? void 0 : amend.model === null ? "-" : amend.model },
        { exec: currentField("exec"), model: currentField("model"), reasoning: amend.exec === "manual" ? null : currentField("reasoning") }
      ).map((e) => `amend: ${e}`)
    );
  }
  if (input.shape === "convert" && !OWNER_TITLE_RE.test(amend.title ?? block.title)) {
    errors.push('shape convert: the source title must start with "Owner:" (set amend.title)');
  }
  const dependents = blocks.filter((b) => {
    if (b.id === source) return false;
    const st = b.status ?? "";
    if (st === "done" || st === "forbidden") return false;
    return depList(b.fields.get("deps")).includes(source);
  });
  const dependentIds = new Set(dependents.map((b) => b.id));
  for (const d of dependents) {
    const target = input.dependents[d.id];
    if (target === void 0) errors.push(`dependents: ${d.id} depends on ${source} and is not allocated -- map it to "keep" or "@<ref>"`);
  }
  for (const [id, target] of Object.entries(input.dependents)) {
    if (!dependentIds.has(id)) errors.push(`dependents: ${id} does not depend on ${source}`);
    if (target !== "keep" && !(target.startsWith("@") && refs.has(target.slice(1)))) {
      errors.push(`dependents.${id}: "${target}" must be "keep" or "@<ref>" naming a task in this split`);
    }
  }
  if (errors.length) throw new BoardRejected(`split: rejected, nothing written:
${errors.map((e) => `  - ${e}`).join("\n")}`);
  const refToId = /* @__PURE__ */ new Map([["source", source]]);
  if (resumeIds) {
    for (const t of tasks) {
      const id = resumeIds[t.ref];
      if (!id) throw new BoardRejected(`split: the ledger for ${input.op} has no id for @${t.ref} -- refusing to resume`);
      refToId.set(t.ref, id);
    }
  } else {
    const minted = new Set(known);
    const briefIds = briefFileIds(paths.tasksDir);
    for (const t of tasks) {
      const id = mintTaskId(minted);
      assertFreshId(id, minted, briefIds);
      minted.add(id);
      refToId.set(t.ref, id);
    }
  }
  const resolve = (d) => d.startsWith("@") ? refToId.get(d.slice(1)) : d;
  const today = todayLocalDate();
  const newBlocks = tasks.map((t) => renderBlock({ ...t, status: "todo" }, refToId, today));
  const report = [];
  const headersBefore = countAllHeaders(lines.join("\n"));
  if (amend.title !== void 0) {
    const m = HEADER_PREFIX_RE.exec(lines[start]);
    if (!m) throw new BoardRejected(`split: header of ${source} does not match "## <id> [<status>] <title>"`);
    const t = collapseWhitespace(amend.title);
    if (t !== block.title) report.push(`title "${block.title}" -> "${t}"`);
    lines[start] = `${m[1]} ${t}`;
  }
  const setField = (name, value) => {
    const prev = currentField(name);
    if (prev === value) return;
    end = upsertField(lines, start, end, name, value);
    report.push(`${name} ${prev ?? "(none)"} -> ${value ?? "(none)"}`);
  };
  if (amend.exec !== void 0) setField("exec", amend.exec);
  if (amend.model !== void 0) setField("model", amend.model === null ? "-" : amend.model);
  if (amend.exec === "manual" && currentField("reasoning") !== null) setField("reasoning", null);
  if ("blocker" in amend) setField("blocker", null);
  if (amend.do !== void 0) setField("do", collapseWhitespace(amend.do));
  if (amend.doneWhen !== void 0) setField("done-when", collapseWhitespace(amend.doneWhen));
  if (amend.deps !== void 0) {
    const next = [...new Set(amend.deps.map(resolve))];
    const prevText = sourceDepsBefore.length ? sourceDepsBefore.join(", ") : "-";
    const shown = opts.dry ? [...new Set(amend.deps.map((d) => d === "@source" ? source : d))] : next;
    const nextText = shown.length ? shown.join(", ") : "-";
    if (prevText !== nextText) report.push(`deps ${prevText} -> ${nextText}`);
    setDepsLine(lines, start, end, next);
  }
  const dependentReport = [];
  for (const [id, target] of Object.entries(input.dependents)) {
    if (target === "keep") {
      dependentReport.push(`  ${id}: keeps ${source}`);
      continue;
    }
    const b = parseManifestBlocks(`${lines.join("\n")}
`, TASK_ID_RE).blocks.find((x) => x.id === id);
    const before = depList(b.fields.get("deps"));
    const after2 = [...new Set(before.map((d) => d === source ? resolve(target) : d))];
    setDepsLine(lines, b.start, clampedCoreEnd(lines, b.start, b.end), after2);
    dependentReport.push(`  ${id}: deps ${before.join(", ")} -> ${opts.dry ? before.map((d) => d === source ? target : d).join(", ") : after2.join(", ")}`);
  }
  const sourceEnd = clampedCoreEnd(lines, start, parseManifestBlocks(`${lines.join("\n")}
`, TASK_ID_RE).blocks.find((b) => b.id === source).end);
  const out = newBlocks.length ? [...lines.slice(0, sourceEnd), "", ...newBlocks.join("\n\n").split("\n"), ...lines.slice(sourceEnd)] : [...lines];
  const merged = `${out.join("\n")}
`;
  if (countAllHeaders(merged) !== headersBefore + newBlocks.length) {
    throw new BoardRejected("split: refused -- header-count guard failed, manifest left untouched");
  }
  const after = parseManifestBlocks(merged, TASK_ID_RE).blocks;
  const graph = new Map(after.map((b) => [b.id, depList(b.fields.get("deps"))]));
  const touched = [source, ...tasks.map((t) => refToId.get(t.ref)), ...dependentIds];
  const cycle = findCycle(graph, touched);
  if (cycle) throw new BoardRejected(`split: rejected, nothing written: dependency cycle ${cycle.join(" -> ")}`);
  const ids = Object.fromEntries(tasks.map((t) => [t.ref, refToId.get(t.ref)]));
  const plan = [
    `split ${source} (${input.shape}, op ${input.op})${opts.dry ? " -- dry run, nothing written" : ""}`,
    `  source: ${report.length ? report.join("; ") : "unchanged"}`,
    ...tasks.map((t) => `  new ${opts.dry ? `@${t.ref}` : refToId.get(t.ref)} [${t.role}] ${t.title} (exec ${t.exec}, deps ${(t.deps ?? []).map((d) => opts.dry ? d : resolve(d)).join(", ") || "-"})`),
    ...dependentReport.length ? ["  dependents:", ...dependentReport] : ["  dependents: none"]
  ];
  if (opts.dry) return { state: "dry", source, ids: {}, lines: plan };
  if (!resumeIds) appendLedger(ledgerPath, { op: input.op, fingerprint, source, ids, state: "begun", ts: (/* @__PURE__ */ new Date()).toISOString() });
  writeBriefs(paths, input, ids);
  writeFileAtomic(paths.manifest, merged, "split");
  if (amend.doneWhen !== void 0) {
    const briefPath = join2(paths.tasksDir, `${source}.md`);
    if (existsSync4(briefPath)) {
      const updated = replaceDoneWhenBody(readFileSync4(briefPath, "utf8"), collapseWhitespace(amend.doneWhen));
      if (updated !== null) writeFileAtomic(briefPath, updated, "tmp");
    }
  }
  try {
    appendJournalEvents(paths, [
      {
        kind: "note",
        id: source,
        ts: epochToLocalIso(Math.floor(Date.now() / 1e3)),
        by: agentTag(),
        title: `split ${source} (${input.shape}) -- ${collapseWhitespace(amend.reason ?? "owner work split out")}`,
        body: plan.slice(1).join("\n")
      }
    ]);
  } catch (e) {
    process.stderr.write(`split: manifest written but the journal append FAILED -- ${e.message}
`);
  }
  appendLedger(ledgerPath, { op: input.op, fingerprint, source, ids, state: "done", ts: (/* @__PURE__ */ new Date()).toISOString() });
  return { state: resumeIds ? "resumed" : "applied", source, ids, lines: plan };
}
function writeBriefs(paths, input, ids) {
  mkdirSync(paths.tasksDir, { recursive: true });
  for (const t of input.tasks) {
    const id = ids[t.ref];
    if (!id || !t.brief) continue;
    const path = join2(paths.tasksDir, `${id}.md`);
    if (!existsSync4(path) && !existsSync4(join2(paths.tasksDir, "archive", `${id}.md`))) writeFileSync(path, briefText(t.brief));
  }
}

export {
  recurringList,
  recurringDueCount,
  recurringDid,
  addRecurring,
  setRecurring,
  dropRecurring,
  emptyManifestMessage,
  readManifestReport,
  claimOwner,
  leaseRefusal,
  SPLIT_SCHEMA,
  SPLIT_SHAPES,
  SPLIT_SCHEMA_TEXT,
  splitLedgerPath,
  splitFingerprint,
  parseSplitInput,
  splitTask
};
