#!/usr/bin/env node

// <define:__TASKBOARD_BUILD__>
var define_TASKBOARD_BUILD_default = { version: "0.4.0", source: "213987e4", program: "/cyberine-taskboard:tasks" };

// src/tasks/boardEnv.ts
var BOARD_ENV_NAMES = [
  "TASKBOARD_ROOT",
  "CYBERINE_TASKS_ROOT",
  "NF_TASKS_ROOT",
  "CYBERINE_TASKS_AGENT",
  "CYBERINE_TASKS_MACHINE",
  "CYBERINE_TASKS_SYNC_DIR",
  "CYBERINE_TASKS_STALE_DOING_DAYS",
  "CYBERINE_TASKS_SESSION",
  "CYBERINE_TASKS_CLAIM_TTL_MS",
  "NF_TASKS_AGENT",
  "NF_TASKS_MACHINE",
  "NF_TASKS_SYNC_DIR",
  "NF_TASKS_STALE_DOING_DAYS",
  "NF_TASKS_SESSION",
  "NF_TASKS_CLAIM_TTL_MS",
  "CYBERINE_TASKS_NO_PROMOTE",
  "CYBERINE_TASKS_VERIFY_TIMEOUT_MS",
  "CLAUDE_JOB_DIR",
  "CLAUDE_PROJECT_DIR",
  "PATH"
];
var ALLOWED = new Set(BOARD_ENV_NAMES);
var LEGACY_BOARD_ENV = {
  CYBERINE_TASKS_AGENT: "NF_TASKS_AGENT",
  CYBERINE_TASKS_MACHINE: "NF_TASKS_MACHINE",
  CYBERINE_TASKS_SYNC_DIR: "NF_TASKS_SYNC_DIR",
  CYBERINE_TASKS_STALE_DOING_DAYS: "NF_TASKS_STALE_DOING_DAYS",
  CYBERINE_TASKS_SESSION: "NF_TASKS_SESSION",
  CYBERINE_TASKS_CLAIM_TTL_MS: "NF_TASKS_CLAIM_TTL_MS"
};
function boardEnv(name, env = process.env) {
  if (!ALLOWED.has(name)) throw new Error(`board env: ${name} is not on the allowlist`);
  const value = env[name];
  if (value !== void 0) return value;
  const legacy = LEGACY_BOARD_ENV[name];
  return legacy === void 0 ? void 0 : env[legacy];
}
function noPromoteActive(env) {
  const raw = (boardEnv("CYBERINE_TASKS_NO_PROMOTE", env) ?? "").trim().toLowerCase();
  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "no";
}

// src/tasks/boardPaths.ts
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
function manifestCandidates(root) {
  const syncDir = boardEnv("CYBERINE_TASKS_SYNC_DIR") || ".claude";
  const otherDir = syncDir === ".codex" ? ".claude" : ".codex";
  return [
    join(root, syncDir, "TASKS.md"),
    join(root, otherDir, "TASKS.md"),
    join(root, ".local", "tasks", "ACTIVE.md")
  ];
}
function hasAnyManifest(root) {
  return manifestCandidates(root).some((p) => existsSync(p));
}
function git(args) {
  return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}
function worktreeMainRoot(startDir) {
  const [top, gitDir, commonDir] = git([
    "-C",
    startDir,
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
    "--git-dir",
    "--git-common-dir"
  ]).split("\n");
  if (top === void 0) throw new Error(`boardPaths: git rev-parse returned no toplevel for ${startDir}`);
  if (gitDir === commonDir) return top;
  const list = git(["-C", startDir, "worktree", "list", "--porcelain"]);
  const firstLine = list.split("\n").find((l) => l.startsWith("worktree "));
  if (!firstLine) return top;
  const first = firstLine.slice("worktree ".length).trim();
  try {
    const resolved = git(["--git-dir", first, "rev-parse", "--show-toplevel"]);
    if (resolved) return resolved;
  } catch {
  }
  return first;
}
function superWorkingTree(root) {
  try {
    return git(["-C", root, "rev-parse", "--show-superproject-working-tree"]) || null;
  } catch {
    return null;
  }
}
var ScratchEscapeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ScratchEscapeError";
  }
};
function isInside(child, parent) {
  const real = (p2) => {
    try {
      return realpathSync(p2);
    } catch {
      return p2;
    }
  };
  const c = real(child);
  const p = real(parent);
  return c === p || c.startsWith(`${p}/`);
}
function assertRootNotEscapingScratch(from, root) {
  const scratch = boardEnv("CLAUDE_JOB_DIR");
  if (!scratch) return;
  const scratchAbs = resolve(scratch);
  if (!isInside(from, scratchAbs)) return;
  if (isInside(root, scratchAbs)) return;
  throw new ScratchEscapeError(
    `/cyberine-taskboard:tasks: refusing to operate on ${root} -- the working directory ${from} is inside this session's scratch dir (${scratchAbs}), but the board resolved OUTSIDE it: that is another project's board, not a fixture. Build fixtures with \`mktemp -d\` (outside any repo), or pin TASKBOARD_ROOT to a board inside the scratch dir.`
  );
}
var STRICT_ROOT_PINS = ["TASKBOARD_ROOT", "CYBERINE_TASKS_ROOT"];
function isDirectory(p) {
  return existsSync(p) && statSync(p).isDirectory();
}
function pinnedRoot(warn) {
  for (const name of STRICT_ROOT_PINS) {
    const pin = boardEnv(name);
    if (!pin) continue;
    const pinnedAbs = resolve(pin);
    if (isDirectory(pinnedAbs)) return pinnedAbs;
    if (warn) throw new Error(`/cyberine-taskboard:tasks: ${name}=${pin} is not an existing directory`);
    return null;
  }
  const pinned = boardEnv("NF_TASKS_ROOT");
  if (pinned) {
    const pinnedAbs = resolve(pinned);
    if (isDirectory(pinnedAbs)) return pinnedAbs;
    if (warn) {
      process.stderr.write(
        `/cyberine-taskboard:tasks: pinned root ${pinned} is not an existing directory -- ignoring, falling back to git derivation
`
      );
    }
  }
  return null;
}
function repoRootStrict(startDir) {
  const abs = resolve(startDir);
  const pinned = pinnedRoot(true);
  if (pinned !== null) {
    assertRootNotEscapingScratch(abs, pinned);
    return pinned;
  }
  const root = deriveRootStrict(abs);
  if (root !== null) assertRootNotEscapingScratch(abs, root);
  return root;
}
function superChain(ownRoot) {
  const chain = [];
  let current = ownRoot;
  for (; ; ) {
    const superWt = superWorkingTree(current);
    if (!superWt) return chain;
    try {
      current = worktreeMainRoot(superWt);
    } catch {
      return chain;
    }
    if (chain.includes(current)) return chain;
    chain.push(current);
  }
}
function boardOwner(ownRoot) {
  if (hasAnyManifest(ownRoot)) return null;
  return superChain(ownRoot).find((root) => hasAnyManifest(root)) ?? null;
}
function deriveRootStrict(abs) {
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(abs);
  } catch {
    return null;
  }
  return boardOwner(ownRoot) ?? ownRoot;
}
function realOrSelf(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
function scopeUnderPin(abs, pinned) {
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(abs);
  } catch {
    return "";
  }
  const pinReal = realOrSelf(pinned);
  let current = ownRoot;
  for (; ; ) {
    if (realOrSelf(current) === pinReal) break;
    const superWt = superWorkingTree(current);
    if (!superWt) return "";
    try {
      current = worktreeMainRoot(superWt);
    } catch {
      return "";
    }
  }
  const rel = relative(pinReal, realOrSelf(ownRoot));
  return rel && !rel.startsWith("..") ? rel.split("\\").join("/") : "";
}
function submoduleScope(startDir) {
  const abs = resolve(startDir);
  const pinned = pinnedRoot(false);
  if (pinned !== null) return scopeUnderPin(abs, pinned);
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(abs);
  } catch {
    return "";
  }
  const owner = boardOwner(ownRoot);
  if (owner === null) return "";
  const rel = relative(owner, ownRoot);
  return rel && !rel.startsWith("..") ? rel.split("\\").join("/") : "";
}
function normalizeTaskPath(taskPath) {
  const raw = (taskPath ?? "").trim().split("\\").join("/");
  if (raw === "" || raw === "-") return "";
  return raw.replace(/\/{2,}/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "");
}
function caseFold(p) {
  return process.platform === "darwin" || process.platform === "win32" ? p.toLowerCase() : p;
}
function pathInScope(taskPath, scope) {
  if (!scope) return true;
  const norm = caseFold(normalizeTaskPath(taskPath));
  if (!norm) return false;
  const want = caseFold(normalizeTaskPath(scope));
  return norm === want || norm.startsWith(`${want}/`);
}
function scopeForBoard(startDir, boardRoot) {
  const scope = submoduleScope(startDir);
  if (!scope) return "";
  try {
    return realOrSelf(repoRoot(startDir)) === realOrSelf(boardRoot) ? scope : "";
  } catch {
    return "";
  }
}
function danglingTaskPath(boardRoot, taskPath) {
  const norm = normalizeTaskPath(taskPath);
  return norm !== "" && !existsSync(join(boardRoot, norm));
}
function repoRoot(startDir) {
  return repoRootStrict(startDir) ?? resolve(startDir);
}
function boardPathsFor(root) {
  const [primary, secondary, local] = manifestCandidates(root);
  let manifest = primary;
  if (!existsSync(manifest)) manifest = secondary;
  if (!existsSync(manifest)) manifest = local;
  const manifestDir = dirname(manifest);
  return {
    root,
    manifest,
    log: join(root, ".local", "tasks", "status.log"),
    statusDir: join(root, ".local", "tasks", "status.d"),
    lock: join(root, ".local", "tasks", ".reconcile.lock"),
    archive: join(manifestDir, "TASKS_ARCHIVE.md"),
    tasksDir: join(manifestDir, "tasks"),
    journalDir: join(manifestDir, "journal"),
    ledger: join(manifestDir, "TASKS_DEDUPE_LEDGER.jsonl"),
    draftsDir: join(root, ".local", "tasks", "drafts")
  };
}
function resolveBoard(startDir) {
  return boardPathsFor(repoRoot(startDir));
}
var BoardIdentityError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BoardIdentityError";
  }
};
function realOfNearest(p) {
  let current = resolve(p);
  const rest = [];
  for (; ; ) {
    try {
      return join(realpathSync(current), ...rest);
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolve(p);
      rest.unshift(basename(current));
      current = parent;
    }
  }
}
function nearestExistingDir(p) {
  let current = p;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return statSync(current).isDirectory() ? current : dirname(current);
}
function insideReal(child, parent) {
  return child === parent || child.startsWith(`${parent}/`);
}
function boardIdentityProblem(root, manifestPath) {
  const rootReal = realOrSelf(resolve(root));
  const manifestDir = dirname(manifestPath);
  const targets = [manifestDir, join(root, ".local", "tasks"), join(manifestDir, "tasks"), join(manifestDir, "journal")];
  for (const target of targets) {
    const real = realOfNearest(target);
    if (insideReal(real, rootReal)) continue;
    let owner;
    try {
      owner = git(["-C", nearestExistingDir(real), "rev-parse", "--show-toplevel"]) || null;
    } catch {
      owner = null;
    }
    if (owner === null || realOrSelf(owner) === rootReal) continue;
    const hub = superChain(rootReal).find((r) => hasAnyManifest(r));
    const hint = hub !== void 0 ? `This repo is a submodule of ${hub}, which has its own board: run from there, or pin CYBERINE_TASKS_ROOT=${hub} to use it with this submodule's scope.` : `Make ${join(root, ".local")} a real directory in this repo, or pin CYBERINE_TASKS_ROOT=${owner} to use that repo's board.`;
    return `/cyberine-taskboard:tasks: refusing to use the board at ${manifestPath}: its real path ${real} lies in another git repository (${owner}), not in ${rootReal}, so writing it would fork or alias that repo's board. ${hint}`;
  }
  return null;
}
function assertBoardIdentity(root, manifestPath) {
  const problem = boardIdentityProblem(root, manifestPath);
  if (problem !== null) throw new BoardIdentityError(problem);
}
function shadowedHubBoard(root) {
  if (!hasAnyManifest(root)) return null;
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(root);
  } catch {
    return null;
  }
  const hub = superChain(ownRoot).find((r) => hasAnyManifest(r));
  if (hub === void 0) return null;
  return manifestCandidates(hub).find((p) => existsSync(p)) ?? null;
}
function scopeTopologyInputs(startDir) {
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(resolve(startDir));
  } catch {
    return [];
  }
  return [ownRoot, ...superChain(ownRoot)].flatMap((root) => [...manifestCandidates(root), join(root, ".gitmodules")]);
}
function boardRootForManifest(manifestPath) {
  const dir = dirname(manifestPath);
  return basename(manifestPath) === "ACTIVE.md" && basename(dir) === "tasks" && basename(dirname(dir)) === ".local" ? dirname(dirname(dir)) : dirname(dir);
}
function currentUser() {
  try {
    return userInfo().username;
  } catch {
    return "a";
  }
}
function agentTag() {
  const env = boardEnv("CYBERINE_TASKS_AGENT");
  if (env) return env.replace(/\s+/g, "_");
  return `${currentUser()}@${process.pid}`;
}
function formatUtcOffset(offsetMinutes) {
  const pad = (n) => String(n).padStart(2, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
function localOffsetAt(epochSeconds) {
  return formatUtcOffset(-new Date(epochSeconds * 1e3).getTimezoneOffset());
}
var TZ_OFFSET_RE = /^([+-])(\d{2}):(\d{2})$/;
function parseTzOffset(value) {
  const m = TZ_OFFSET_RE.exec(value ?? "");
  if (!m) return null;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (hours > 14 || minutes > 59) return null;
  return (m[1] === "-" ? -1 : 1) * (hours * 60 + minutes);
}
function epochToIsoAtOffset(epochSeconds, offsetMinutes) {
  const d = new Date(epochSeconds * 1e3 + offsetMinutes * 6e4);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${formatUtcOffset(offsetMinutes)}`;
}
function epochToLocalIso(epochSeconds) {
  return epochToIsoAtOffset(epochSeconds, -new Date(epochSeconds * 1e3).getTimezoneOffset());
}
function epochToIsoForTz(epochSeconds, tz) {
  const offset = parseTzOffset(tz);
  return offset === null ? epochToLocalIso(epochSeconds) : epochToIsoAtOffset(epochSeconds, offset);
}
function todayLocalDate() {
  return epochToLocalIso(Math.floor(Date.now() / 1e3)).slice(0, 10);
}

// src/tasks/boardIds.ts
import { existsSync as existsSync2, readdirSync } from "node:fs";
import { join as join2 } from "node:path";
var NEW_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
var NEW_ID_BODY_LEN = 4;
var LEGACY_ID_SOURCE = "T[0-9]+";
var NEW_ID_SOURCE = `k[${NEW_ID_ALPHABET}]{${NEW_ID_BODY_LEN}}`;
var TASK_ID_SOURCE = `(?:${LEGACY_ID_SOURCE}|${NEW_ID_SOURCE})`;
var LEGACY_TASK_ID_RE = new RegExp(`^${LEGACY_ID_SOURCE}$`);
var NEW_TASK_ID_RE = new RegExp(`^${NEW_ID_SOURCE}$`);
var TASK_ID_RE = new RegExp(`^${TASK_ID_SOURCE}$`);
var RECURRING_ID_SOURCE = "R[0-9]+";
var RECURRING_ID_RE = new RegExp(`^${RECURRING_ID_SOURCE}$`);
var KNOWN_HEADER_ID_RE = new RegExp(`^(?:${TASK_ID_SOURCE}|${RECURRING_ID_SOURCE})$`);
var ID_SHAPE_RULE = `a task id is "T<digits>" (legacy) or "k" + exactly ${NEW_ID_BODY_LEN} characters from "${NEW_ID_ALPHABET}" (Crockford base32: no i, l, o or u). Ids are MINTED by the board tool (save / add / log), never hand-written`;
function malformedIdMessage(id) {
  return `${JSON.stringify(id)} is not a valid task id -- ${ID_SHAPE_RULE}.`;
}
function mintTaskId(existingIds) {
  const known = existingIds instanceof Set ? existingIds : new Set(existingIds);
  for (let attempt = 0; attempt < 1e3; attempt++) {
    let body = "";
    for (let i = 0; i < NEW_ID_BODY_LEN; i++) {
      body += NEW_ID_ALPHABET[Math.floor(Math.random() * NEW_ID_ALPHABET.length)];
    }
    const id = `k${body}`;
    if (!known.has(id)) return id;
  }
  throw new Error("/cyberine-taskboard:tasks: mintTaskId could not find a free id in 1000 attempts -- id space exhausted?");
}
var IdClashError = class extends Error {
  constructor(id, foundIn) {
    super(
      `/cyberine-taskboard:tasks: id clash -- "${id}" already exists (${foundIn}) -- allocator regression, aborting (nothing written)`
    );
    this.id = id;
    this.foundIn = foundIn;
    this.name = "IdClashError";
  }
  id;
  foundIn;
};
function briefFileIds(tasksDir) {
  const ids = /* @__PURE__ */ new Set();
  for (const dir of [tasksDir, join2(tasksDir, "archive")]) {
    if (!existsSync2(dir)) continue;
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of names) {
      const m = /^(.+)\.md$/.exec(f);
      if (m && TASK_ID_RE.test(m[1])) ids.add(m[1]);
    }
  }
  return ids;
}
function assertFreshId(id, knownIds, briefIds) {
  if (knownIds.has(id)) throw new IdClashError(id, "manifest/archive known-id set");
  if (briefIds.has(id)) throw new IdClashError(id, "a brief filename under tasks/ or tasks/archive/");
}
var AmbiguousIdError = class extends Error {
  constructor(prefix, candidates) {
    super(`ambiguous id "${prefix}" -- matches: ${candidates.join(", ")}`);
    this.prefix = prefix;
    this.candidates = candidates;
    this.name = "AmbiguousIdError";
  }
  prefix;
  candidates;
};
function resolveIdPrefix(candidate, ids) {
  const all = ids instanceof Set ? ids : new Set(ids);
  if (all.has(candidate)) return candidate;
  const matches = [...all].filter((id) => id.startsWith(candidate));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  throw new AmbiguousIdError(candidate, matches.sort());
}

// src/tasks/atomicWrite.ts
import { chmodSync, realpathSync as realpathSync2, renameSync, statSync as statSync2, unlinkSync, writeFileSync } from "node:fs";
function writeFileAtomic(path, content, tag) {
  let target;
  let mode;
  try {
    target = realpathSync2(path);
    mode = statSync2(target).mode & 511;
  } catch {
    target = path;
  }
  const tmp = `${target}.${tag}.${process.pid}`;
  try {
    writeFileSync(tmp, content);
    if (mode !== void 0) chmodSync(tmp, mode);
    renameSync(tmp, target);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      throw e;
    }
    throw e;
  }
}

// src/tasks/taskStatus.ts
var TASK_STATUSES = ["backlog", "todo", "doing", "done", "forbidden"];
var TASK_STATUS_SOURCE = TASK_STATUSES.join("|");
var TASK_STATUS_SET = new Set(TASK_STATUSES);
function isTaskStatus(token) {
  return TASK_STATUS_SET.has(token);
}

// src/tasks/boardParse.ts
import { existsSync as existsSync3, readFileSync, writeFileSync as writeFileSync2 } from "node:fs";
var BLOCK_HEADER_RE = /^## (\S+) \[([^\]]*)\](?: (.*))?$/;
var KNOWN_STATUS_TOKENS = /* @__PURE__ */ new Set([...TASK_STATUSES, "recurring"]);
var ORPHAN_HEADER_RE = new RegExp(`^## (?:R[0-9]+|${TASK_ID_SOURCE})(?:\\s|$)`);
var COUNT_HEADER_RE = new RegExp(`^## ${TASK_ID_SOURCE} \\[`);
var KNOWN_TASK_FIELDS = [
  "deps",
  "exec",
  "model",
  "effort",
  "reasoning",
  "priority",
  "path",
  "area",
  "created",
  "created-by",
  "from",
  "blocker",
  "waits-on",
  "do",
  "done-when",
  "default",
  "undo-cost",
  "verify",
  "why",
  "every",
  "last-done",
  "reason",
  "evidence",
  "duplicate-of",
  "completed",
  "lease",
  "source",
  "verified"
];
var FOREIGN_TO_UPSTREAM_FIELDS = ["effort", "source", "verified"];
var VENDOR_FIELD_PREFIX = "x-";
var FIELD_LINE_RE = /^([a-z][a-z-]*):\s?(.*)$/;
var FUSED_FIELD_RE = new RegExp(
  `[a-zA-Z0-9](?:${KNOWN_TASK_FIELDS.filter((f) => !FOREIGN_TO_UPSTREAM_FIELDS.includes(f)).join("|")}):`
);
var LINT_BLOCK_HEADER_RE = new RegExp(`^## (?:R[0-9]+|${TASK_ID_SOURCE})\\s+\\[\\w+\\]`);
function fencedLineFlags(lines) {
  const flags = [];
  let open = null;
  for (const line of lines) {
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (m) {
        open = { char: m[1][0], len: m[1].length };
        flags.push(true);
        continue;
      }
      flags.push(false);
      continue;
    }
    const c = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
    if (c && c[1][0] === open.char && c[1].length >= open.len) {
      open = null;
      flags.push(true);
      continue;
    }
    flags.push(true);
  }
  return flags;
}
function dropFieldLines(lines, start, end, re) {
  const fenced = fencedLineFlags(lines);
  return [
    ...lines.slice(0, start + 1),
    ...lines.slice(start + 1, end).filter((l, k) => fenced[start + 1 + k] || !re.test(l)),
    ...lines.slice(end)
  ];
}
function countHeaders(lines) {
  const fenced = fencedLineFlags(lines);
  let n = 0;
  lines.forEach((line, i) => {
    if (!fenced[i] && COUNT_HEADER_RE.test(line)) n++;
  });
  return n;
}
var LEGACY_STATUS_MAP = /* @__PURE__ */ new Map([
  ["todo", "todo"],
  ["doing", "doing"],
  ["done", "done"],
  ["backlog", "backlog"],
  ["forbidden", "forbidden"],
  ["blocked", "todo"],
  ["parked", "backlog"],
  ["dead", "forbidden"],
  ["wip", "doing"]
]);
var LEGACY_STATUS_ALT = [...LEGACY_STATUS_MAP.keys()].join("|");
var DASH = "[-\u2013\u2014]";
var LEGACY_LIST_RE = new RegExp(
  `^ {0,3}[-*][ \\t]*\\[(${LEGACY_STATUS_ALT})\\][ \\t]+(?:\\*\\*)?(${TASK_ID_SOURCE})(?:\\*\\*)?[ \\t]*(?:${DASH}[ \\t]*)?(.*)$`,
  "i"
);
var LEGACY_HEAD_RE = new RegExp(`^##[ \\t]+(${TASK_ID_SOURCE})[ \\t]*${DASH}[ \\t]*(.+)$`);
var LEGACY_FIELD_RE = /^\*\*([A-Za-z][A-Za-z ]*?):?\*\*[ \t]*(.*)$/;
var LEGACY_LIST_ANY_ID_RE = new RegExp(
  `^ {0,3}[-*][ \\t]*\\[(${LEGACY_STATUS_ALT})\\][ \\t]+(\\S+)(?:[ \\t]+(?:${DASH}[ \\t]*)?(.*))?$`,
  "i"
);
var LEGACY_FIELD_MAP = /* @__PURE__ */ new Map([
  ["do", "do"],
  ["done when", "done-when"],
  ["done-when", "done-when"],
  ["why", "why"],
  ["deps", "deps"],
  ["blocker", "blocker"],
  ["area", "area"]
]);
var ZERO_BLOCK_MIN_LINES = 8;
var WANTS_TO_BE_A_BOARD_RE = new RegExp(
  `^ {0,3}(?:##[ \\t]+\\S+[ \\t]+\\[|[-*][ \\t]*\\[(?:${LEGACY_STATUS_ALT})\\])`,
  "mi"
);
var LEGACY_SIGNAL_RE = new RegExp(
  `^ {0,3}(?:[-*][ \\t]*\\[(?:${LEGACY_STATUS_ALT})\\]|##[ \\t]+(?:${TASK_ID_SOURCE})[ \\t]*${DASH})`,
  "mi"
);
function legacyField(label) {
  const key = label.trim().toLowerCase();
  return LEGACY_FIELD_MAP.get(key) ?? key.replace(/\s+/g, "-");
}
function nonBlankLineCount(src) {
  let n = 0;
  for (const line of src.split("\n")) if (line.trim()) n++;
  return n;
}
function looksLikeABoard(src) {
  return nonBlankLineCount(src) >= ZERO_BLOCK_MIN_LINES && WANTS_TO_BE_A_BOARD_RE.test(src);
}
function parseLegacyBoard(src) {
  const lines = src.split("\n").map((l) => l.endsWith("\r") ? l.slice(0, -1) : l);
  const fenced = fencedLineFlags(lines);
  const listBlocks = [];
  const headBlocks = [];
  const ghostLines = [];
  const consumedFieldLines = /* @__PURE__ */ new Set();
  const fieldLineOf = /* @__PURE__ */ new Map();
  let cur = null;
  const closeHead = (end) => {
    if (cur) {
      cur.end = end;
      headBlocks.push(cur);
    }
    cur = null;
  };
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const h = LEGACY_HEAD_RE.exec(line);
    if (h) {
      closeHead(i);
      cur = {
        id: h[1],
        bracket: "todo",
        status: "todo",
        malformed: false,
        title: h[2].trim(),
        fields: /* @__PURE__ */ new Map(),
        start: i,
        end: lines.length
      };
      return;
    }
    if (/^## /.test(line)) {
      closeHead(i);
      return;
    }
    const m = LEGACY_LIST_RE.exec(line);
    if (m) {
      closeHead(i);
      const status = LEGACY_STATUS_MAP.get(m[1].toLowerCase()) ?? "todo";
      listBlocks.push({
        id: m[2],
        bracket: status,
        status,
        malformed: false,
        title: (m[3] ?? "").trim(),
        fields: /* @__PURE__ */ new Map(),
        start: i,
        end: i + 1
      });
      return;
    }
    const g = LEGACY_LIST_ANY_ID_RE.exec(line);
    if (g) {
      ghostLines.push({ line: i + 1, id: g[2].replace(/\*\*/g, ""), text: (g[3] ?? "").trim() });
      return;
    }
    if (!cur) return;
    const f = LEGACY_FIELD_RE.exec(line);
    if (f && f[2].trim()) {
      const key = legacyField(f[1]);
      const prev = fieldLineOf.get(cur)?.get(key);
      if (prev !== void 0) consumedFieldLines.delete(prev);
      cur.fields.set(key, f[2].trim());
      consumedFieldLines.add(i);
      let perBlock = fieldLineOf.get(cur);
      if (!perBlock) {
        perBlock = /* @__PURE__ */ new Map();
        fieldLineOf.set(cur, perBlock);
      }
      perBlock.set(key, i);
    }
  });
  closeHead(lines.length);
  if (listBlocks.length === 0 && headBlocks.length === 0 && ghostLines.length === 0) return null;
  const blocks = [...listBlocks, ...headBlocks].sort((a, b) => a.start - b.start);
  const kind = listBlocks.length >= headBlocks.length ? "list-item" : "dashed-header";
  return { kind, blocks, ghostLines, consumedFieldLines };
}
function parseManifestBlocks(src, idFilter) {
  const lines = src.split("\n");
  const fenced = fencedLineFlags(lines);
  const blocks = [];
  const warnings = [];
  let cur = null;
  let taskHeadersSeen = 0;
  const close = (end) => {
    if (cur) {
      cur.end = end;
      blocks.push(cur);
    }
    cur = null;
  };
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const h = BLOCK_HEADER_RE.exec(line);
    if (h) {
      close(i);
      const id = h[1];
      const bracket = h[2];
      const titleRaw = h[3];
      if (TASK_ID_RE.test(id)) taskHeadersSeen++;
      if (idFilter && !idFilter.test(id)) return;
      const tokens = bracket.trim().split(/\s+/).filter(Boolean);
      const status = tokens.length ? tokens[0] : null;
      const known = tokens.length === 1 && KNOWN_STATUS_TOKENS.has(tokens[0]);
      const malformed = tokens.length > 1 || tokens.length === 0 || !known;
      if (malformed) {
        const why = tokens.length === 0 ? "empty bracket" : tokens.length > 1 ? `reading as [${status}]` : `unknown status token "${status}" -- the task is invisible to every command`;
        warnings.push(
          `/cyberine-taskboard:tasks: manifest line ${i + 1}: malformed status bracket "[${bracket}]" on ${id} -- ${why}, needs a hand-fix`
        );
      }
      cur = {
        id,
        bracket,
        status,
        malformed,
        title: (titleRaw ?? "").trim(),
        fields: /* @__PURE__ */ new Map(),
        start: i,
        end: lines.length
      };
      return;
    }
    if (/^## /.test(line)) {
      close(i);
      if (ORPHAN_HEADER_RE.test(line)) {
        warnings.push(
          `/cyberine-taskboard:tasks: manifest line ${i + 1}: task header with no parsable [status] bracket -- "${line.trim()}" is invisible to every command, needs a hand-fix`
        );
      }
      return;
    }
    if (!cur) return;
    const f = FIELD_LINE_RE.exec(line);
    if (f) cur.fields.set(f[1], f[2]);
  });
  close(lines.length);
  if (LEGACY_SIGNAL_RE.test(src)) {
    const legacy = parseLegacyBoard(src);
    if (legacy) {
      const canonicalIds = new Set(blocks.map((b) => b.id));
      const filtered = legacy.blocks.filter(
        (b) => !canonicalIds.has(b.id) && (!idFilter || idFilter.test(b.id))
      );
      if (filtered.length === 0 && legacy.ghostLines.length === 0) return { blocks, warnings };
      const merged = [...blocks, ...filtered].sort((a, b) => a.start - b.start);
      warnings.length = 0;
      warnings.push(
        `/cyberine-taskboard:tasks: this manifest still holds ${filtered.length} task(s) in the legacy ${legacy.kind} format -- reading them in compatibility mode. The next command that WRITES the board converts them automatically (a timestamped backup is written first); run \`/cyberine-taskboard:tasks migrate\` to do it now.`
      );
      return { blocks: merged, warnings, legacy: legacy.kind };
    }
    return { blocks, warnings };
  }
  if (taskHeadersSeen === 0) {
    if (blocks.length > 0) return { blocks, warnings };
    if (!looksLikeABoard(src)) return { blocks, warnings };
    warnings.push(
      `/cyberine-taskboard:tasks: this manifest has ${nonBlankLineCount(src)} non-blank lines but produced NO task blocks -- nothing here matches "## <id> [<status>] <title>" or any legacy shape the board tool recognises. The board reads as empty on every command; if it is meant to hold tasks, that is a format problem, not an empty board.`
    );
  }
  return { blocks, warnings };
}
function blockRange(lines, id) {
  const b = parseManifestBlocks(lines.join("\n")).blocks.find((x) => x.id === id);
  return b ? { start: b.start, end: b.end } : null;
}
function duplicateBlockerWarning(id, target) {
  return `/cyberine-taskboard:tasks: ${id}: duplicate-of ${target} still carries a blocker; the blocker is ignored for deps, unblock it or drop the duplicate`;
}
function lintManifest(manifestSrc) {
  const warnings = [];
  let inBlock = false;
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  let blockId = "";
  let blockDup = "";
  let blockHasBlocker = false;
  const flushBlock = () => {
    if (blockId && blockDup && blockHasBlocker) {
      warnings.push(duplicateBlockerWarning(blockId, blockDup));
    }
    blockId = "";
    blockDup = "";
    blockHasBlocker = false;
  };
  srcLines.forEach((line, idx) => {
    if (fenced[idx]) return;
    if (/^## /.test(line)) {
      flushBlock();
      inBlock = LINT_BLOCK_HEADER_RE.test(line);
      if (inBlock) blockId = /^## (\S+)/.exec(line)[1];
      return;
    }
    if (!inBlock || !line.trim()) return;
    const m = FIELD_LINE_RE.exec(line);
    if (!m) return;
    const field = m[1];
    const rawValue = m[2];
    if (field === "duplicate-of" && rawValue.trim()) blockDup = rawValue.trim().split(/[,\s]+/)[0];
    if (field === "blocker" && rawValue.trim()) blockHasBlocker = true;
    if (!KNOWN_TASK_FIELDS.includes(field) && !field.startsWith(VENDOR_FIELD_PREFIX)) {
      warnings.push(`/cyberine-taskboard:tasks: manifest line ${idx + 1}: unknown field \`${field}:\` -- ${line}`);
      return;
    }
    if (field === "deps") {
      for (const token of rawValue.split(/[,\s]+/)) {
        if (token && token !== "-" && !TASK_ID_RE.test(token)) {
          warnings.push(`/cyberine-taskboard:tasks: manifest line ${idx + 1}: deps token \`${token}\` is not a task id -- the task stays blocked until it is removed -- ${line}`);
        }
      }
    }
    const value = rawValue.replace(/`[^`]*`/g, "");
    if (FUSED_FIELD_RE.test(value)) {
      warnings.push(`/cyberine-taskboard:tasks: manifest line ${idx + 1}: possible fused field in \`${field}:\` -- ${line}`);
    }
  });
  flushBlock();
  return warnings;
}
function migrateLegacySource(src) {
  const board = parseLegacyBoard(src);
  if (!board || board.blocks.length === 0) return null;
  const lines = src.split("\n");
  const byStart = new Map(board.blocks.map((b) => [b.start, b]));
  const out = [];
  lines.forEach((rawLine, i) => {
    const b = byStart.get(i);
    if (!b) {
      if (!board.consumedFieldLines.has(i)) out.push(rawLine);
      return;
    }
    out.push(`## ${b.id} [${b.status}] ${b.title}`);
    for (const [k, v] of b.fields) out.push(`${k}: ${v}`);
    if (!b.fields.has("do")) out.push(`do: ${b.title}`);
    if (!b.fields.has("done-when") && b.status !== "done" && b.status !== "forbidden") {
      out.push("done-when: (migrated from a legacy board -- fill this in)");
    }
    const next = lines[i + 1];
    if (next !== void 0 && next.replace(/\r$/, "").trim() !== "") out.push("");
  });
  return { out: out.join("\n"), kind: board.kind, count: board.blocks.length };
}
function ensureMigrated(manifestPath) {
  if (!existsSync3(manifestPath)) return { migrated: false };
  const src = readFileSync(manifestPath, "utf8");
  const strict = parseManifestBlocks(src);
  if (strict.blocks.length > 0 && !strict.legacy) return { migrated: false };
  const result = migrateLegacySource(src);
  if (!result) return { migrated: false };
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const backup = `${manifestPath}.pre-migrate-${stamp}`;
  writeFileSync2(backup, src);
  writeFileAtomic(manifestPath, result.out, "migrate");
  return { migrated: true, kind: result.kind, count: result.count, backup };
}
var REFUSAL_HEADER_RE = new RegExp(`^## (${TASK_ID_SOURCE}) \\[([^\\]]*)\\](?: |$)`);
function firstRefusalBracketToken(bracket) {
  return bracket.trim().split(/\s+/).filter(Boolean)[0];
}
function refusedHeaderIds(manifestSrc, overlay, escapedForbidden) {
  const refused = /* @__PURE__ */ new Map();
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  for (const [i, line] of srcLines.entries()) {
    if (fenced[i]) continue;
    const m = REFUSAL_HEADER_RE.exec(line);
    if (!m) continue;
    const base = firstRefusalBracketToken(m[2]);
    const val = overlay.get(m[1]);
    if (val === void 0) continue;
    if (base === void 0) refused.set(m[1], "empty-bracket");
    else if (base === "forbidden" && val !== "todo" && !escapedForbidden.has(m[1])) refused.set(m[1], "forbidden");
  }
  return refused;
}

// src/tasks/boardFormat.ts
import { existsSync as existsSync4, readFileSync as readFileSync2 } from "node:fs";

// scripts/taskboard-bundle/boardFormatHintStub.ts
var BOARD_UPDATE_HINT = "update the TaskBoard plugin";

// src/tasks/boardFormat.ts
var BOARD_FORMAT_VERSION = 1;
var FORMAT_LINE_RE = /^<!-- board-format: ([0-9]+) -->$/;
function boardFormatLine(version = BOARD_FORMAT_VERSION) {
  return `<!-- board-format: ${version} -->`;
}
function readBoardFormat(manifestSrc) {
  const lines = manifestSrc.split("\n").map((l) => l.endsWith("\r") ? l.slice(0, -1) : l);
  const fenced = fencedLineFlags(lines);
  for (const [i, line] of lines.entries()) {
    if (fenced[i]) continue;
    if (line.startsWith("## ")) break;
    const m = FORMAT_LINE_RE.exec(line.trim());
    if (m) return Number(m[1]);
  }
  return BOARD_FORMAT_VERSION;
}
function manifestFormat(manifestPath) {
  if (!existsSync4(manifestPath)) return BOARD_FORMAT_VERSION;
  return readBoardFormat(readFileSync2(manifestPath, "utf8"));
}
var BoardFormatTooNew = class extends Error {
  constructor(manifestPath, found) {
    super(
      `/cyberine-taskboard:tasks: ${manifestPath} is board format ${found}, newer than this build understands (${BOARD_FORMAT_VERSION}) -- nothing written; ${BOARD_UPDATE_HINT} to change this board. Reading it still works.`
    );
    this.manifestPath = manifestPath;
    this.found = found;
    this.name = "BoardFormatTooNew";
  }
  manifestPath;
  found;
};
function boardFormatNotice(manifestPath) {
  const found = manifestFormat(manifestPath);
  if (found <= BOARD_FORMAT_VERSION) return null;
  return `/cyberine-taskboard:tasks: ${manifestPath} is board format ${found}, newer than this build understands (${BOARD_FORMAT_VERSION}); reads may miss newer fields and every write is refused -- ${BOARD_UPDATE_HINT}.`;
}
function assertBoardWritable(manifestPath) {
  assertBoardIdentity(boardRootForManifest(manifestPath), manifestPath);
  const found = manifestFormat(manifestPath);
  if (found > BOARD_FORMAT_VERSION) throw new BoardFormatTooNew(manifestPath, found);
}

// src/tasks/statusWriter.ts
import { appendFileSync, mkdirSync, renameSync as renameSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname2, join as join3 } from "node:path";
import { userInfo as userInfo2 } from "node:os";
var STATUS_LOG_REL = [".local", "tasks", "status.log"];
var STATUS_D_REL = [".local", "tasks", "status.d"];
var ID_RE = /^(?:T\d+|R\d+|k[0-9a-hjkmnp-tv-z]{4})$/;
var STATUSES = ["todo", "doing", "done", "backlog", "forbidden", "dispatched"];
var v2SeqCounter = 0;
function resolveRepoRoot(cwd) {
  return repoRootStrict(cwd);
}
function resolveAgentTag(explicit) {
  let raw;
  const envAgent = boardEnv("CYBERINE_TASKS_AGENT");
  if (explicit && explicit.trim().length > 0) {
    raw = explicit;
  } else if (envAgent !== void 0 && envAgent.trim().length > 0) {
    raw = envAgent;
  } else {
    raw = `${userInfo2().username}@${process.pid}`;
  }
  return raw.replace(/\s+/g, "_");
}
function resolveStatusLogPath(cwd) {
  const repoRoot2 = resolveRepoRoot(cwd);
  if (!repoRoot2) return null;
  return join3(repoRoot2, ...STATUS_LOG_REL);
}
function publishStatusV2(repoRoot2, line) {
  const dir = join3(repoRoot2, ...STATUS_D_REL);
  mkdirSync(dir, { recursive: true });
  const pid = process.pid;
  const seq = String(v2SeqCounter++ % 1e4).padStart(4, "0");
  const epochMs = Date.now();
  const tmpPath = join3(dir, `.tmp.${pid}.${seq}`);
  const finalPath = join3(dir, `${epochMs}-${pid}-${seq}.log`);
  writeFileSync3(tmpPath, line, "utf8");
  renameSync2(tmpPath, finalPath);
}
function republishOverlayLine(repoRoot2, line) {
  publishStatusV2(repoRoot2, line.endsWith("\n") ? line : `${line}
`);
}
function setStatus(cwd, id, status, opts = {}) {
  if (!ID_RE.test(id)) {
    throw new Error(
      `setStatus: id must match T\\d+, R\\d+, or a k-shape id (got ${JSON.stringify(id)})`
    );
  }
  if (!STATUSES.includes(status)) {
    throw new Error(
      `setStatus: status must be one of ${STATUSES.join("|")} (got ${JSON.stringify(status)})`
    );
  }
  if (status === "dispatched" && !/^R\d+$/.test(id)) {
    throw new Error(`setStatus: dispatched applies only to a recurring R-id (got ${JSON.stringify(id)})`);
  }
  const explicitRoot = opts.root;
  const logPath = explicitRoot ? join3(explicitRoot, ...STATUS_LOG_REL) : resolveStatusLogPath(cwd);
  if (!logPath) {
    throw new Error(`setStatus: not inside a git repository (cwd=${cwd})`);
  }
  assertBoardWritable(boardPathsFor(explicitRoot ?? resolveRepoRoot(cwd)).manifest);
  const epoch = Math.floor(Date.now() / 1e3);
  const agent = resolveAgentTag(opts.agent);
  const tz = `tz:${localOffsetAt(epoch)}`;
  const extras = opts.extra ? `${tz} ${opts.extra}` : tz;
  const line = `${epoch}	${agent}	${id}	${status}	${extras}
`;
  const v1Mirror = opts.v1Mirror === true;
  if (v1Mirror) {
    mkdirSync(dirname2(logPath), { recursive: true });
    appendFileSync(logPath, line, "utf8");
  }
  try {
    const repoRoot2 = explicitRoot ?? resolveRepoRoot(cwd);
    publishStatusV2(repoRoot2, line);
  } catch (err) {
    if (!v1Mirror) throw err;
    process.stderr.write(
      `setStatus: v2 status.d publish failed (non-fatal, v1 status.log write already succeeded): ${err.message}
`
    );
  }
  return { logPath, line: line.trimEnd(), id, status, epoch, agent };
}

// src/tasks/boardOverlay.ts
import { existsSync as existsSync5, readFileSync as readFileSync3, readdirSync as readdirSync2, statSync as statSync3 } from "node:fs";
import { basename as basename2, dirname as dirname3, join as join4 } from "node:path";
var FOLD_HEADER_RE = new RegExp(
  `^## (${TASK_ID_SOURCE}) \\[(${TASK_STATUS_SOURCE})(?:\\s[^\\]]*)?\\](?: |$)`
);
function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}
function pendingSnapshots(log) {
  const dir = dirname3(log);
  const prefix = `${basename2(log)}.snap.`;
  let names;
  try {
    names = readdirSync2(dir).filter((n) => n.startsWith(prefix));
  } catch {
    return [];
  }
  return names.map((n) => join4(dir, n)).map((p) => {
    let t;
    try {
      t = statSync3(p).mtimeMs;
    } catch {
      t = 0;
    }
    return { p, t };
  }).sort((a, b) => a.t - b.t).map((x) => x.p);
}
function overlaySources(paths) {
  const out = [...pendingSnapshots(paths.log)];
  if (existsSync5(paths.log)) out.push(paths.log);
  let names;
  try {
    names = readdirSync2(paths.statusDir).filter((n) => n.endsWith(".log"));
  } catch {
    return out;
  }
  out.push(...names.map((n) => join4(paths.statusDir, n)));
  return sortByMtime(out);
}
function sortByMtime(paths) {
  return paths.map((path) => {
    let t;
    try {
      t = statSync3(path, { bigint: true }).mtimeNs;
    } catch {
      t = 0n;
    }
    return { path, t };
  }).sort((x, y) => x.t < y.t ? -1 : x.t > y.t ? 1 : x.path < y.path ? -1 : 1).map((x) => x.path);
}
var EPOCH_FIELD_RE = /^[1-9]\d*$/;
function escapedForbiddenIds(rawLog) {
  const escaped = /* @__PURE__ */ new Set();
  for (const line of rawLog.split("\n")) {
    const fields = line.split("	");
    if (fields.length < 4 || fields[3] !== "todo") continue;
    escaped.add(fields[2]);
  }
  return escaped;
}
function orderOverlayLines(sources) {
  const consumed = /* @__PURE__ */ new Map();
  const entries = [];
  for (const path of sources) {
    let mtimeNs;
    let text;
    try {
      mtimeNs = statSync3(path, { bigint: true }).mtimeNs;
      text = readFileSync3(path, "utf8");
    } catch {
      continue;
    }
    consumed.set(path, text.length);
    const fallback = mtimeNs / 1000000000n;
    for (const [index, line] of text.split("\n").entries()) {
      if (line === "") continue;
      const head = line.split("	", 1)[0];
      const epoch = EPOCH_FIELD_RE.test(head) ? BigInt(head) : fallback;
      entries.push({ epoch, mtimeNs, path, index, line });
    }
  }
  entries.sort((a, b) => {
    if (a.epoch !== b.epoch) return a.epoch < b.epoch ? -1 : 1;
    if (a.mtimeNs !== b.mtimeNs) return a.mtimeNs < b.mtimeNs ? -1 : 1;
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.index - b.index;
  });
  return { text: entries.map((e) => `${e.line}
`).join(""), consumed };
}
function appendStatus(paths, id, status, extra) {
  setStatus(paths.root, id, status, {
    root: paths.root,
    agent: agentTag(),
    v1Mirror: false,
    ...extra !== void 0 && { extra }
  });
}
function readOverlayText(paths) {
  return orderOverlayLines(overlaySources(paths)).text;
}
function foldOverlay(rawLog) {
  const ov = /* @__PURE__ */ new Map();
  for (const line of rawLog.split("\n")) {
    const fields = line.split("	");
    if (fields.length < 4) continue;
    ov.set(fields[2], fields[3]);
  }
  return ov;
}
function fold(manifestPath, paths) {
  const manifestSrc = existsSync5(manifestPath) ? readFileSync3(manifestPath, "utf8") : "";
  const order = [];
  const base = /* @__PURE__ */ new Map();
  const title = /* @__PURE__ */ new Map();
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  for (const [i, line] of srcLines.entries()) {
    if (fenced[i]) continue;
    const m = FOLD_HEADER_RE.exec(line);
    if (!m) continue;
    const id = m[1];
    order.push(id);
    base.set(id, m[2]);
    title.set(id, line.slice(m[0].length));
  }
  const parsed = parseManifestBlocks(manifestSrc);
  if (parsed.legacy) {
    const legacy = parseLegacyBoard(manifestSrc);
    if (legacy) {
      for (const b of legacy.blocks) {
        if (base.has(b.id)) continue;
        order.push(b.id);
        base.set(b.id, b.status ?? "todo");
        title.set(b.id, b.title);
      }
    }
  }
  const ov = foldOverlay(readOverlayText(paths));
  return order.map((id) => ({
    id,
    status: ov.get(id) ?? base.get(id),
    title: title.get(id)
  }));
}
function logLines(paths) {
  let n = 0;
  for (const p of overlaySources(paths)) {
    if (!existsSync5(p)) continue;
    for (const ch of readFileSync3(p, "utf8")) if (ch === "\n") n++;
  }
  return n;
}

export {
  define_TASKBOARD_BUILD_default,
  boardEnv,
  noPromoteActive,
  manifestCandidates,
  repoRootStrict,
  submoduleScope,
  normalizeTaskPath,
  pathInScope,
  scopeForBoard,
  danglingTaskPath,
  repoRoot,
  boardPathsFor,
  resolveBoard,
  boardIdentityProblem,
  assertBoardIdentity,
  shadowedHubBoard,
  scopeTopologyInputs,
  agentTag,
  epochToLocalIso,
  epochToIsoForTz,
  todayLocalDate,
  TASK_ID_SOURCE,
  TASK_ID_RE,
  RECURRING_ID_SOURCE,
  RECURRING_ID_RE,
  KNOWN_HEADER_ID_RE,
  ID_SHAPE_RULE,
  malformedIdMessage,
  mintTaskId,
  IdClashError,
  briefFileIds,
  assertFreshId,
  AmbiguousIdError,
  resolveIdPrefix,
  writeFileAtomic,
  TASK_STATUSES,
  TASK_STATUS_SET,
  isTaskStatus,
  fencedLineFlags,
  dropFieldLines,
  countHeaders,
  nonBlankLineCount,
  looksLikeABoard,
  parseLegacyBoard,
  parseManifestBlocks,
  blockRange,
  lintManifest,
  migrateLegacySource,
  ensureMigrated,
  refusedHeaderIds,
  boardFormatLine,
  BoardFormatTooNew,
  boardFormatNotice,
  assertBoardWritable,
  republishOverlayLine,
  FOLD_HEADER_RE,
  collapseWhitespace,
  pendingSnapshots,
  overlaySources,
  escapedForbiddenIds,
  orderOverlayLines,
  appendStatus,
  readOverlayText,
  foldOverlay,
  fold,
  logLines
};
