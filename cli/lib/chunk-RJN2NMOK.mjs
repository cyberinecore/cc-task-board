#!/usr/bin/env node

// <define:__TASKBOARD_BUILD__>
var define_TASKBOARD_BUILD_default = { version: "0.2.0", source: "e27dd5ba", program: "/cyberine-taskboard:tasks" };

// src/tasks/boardWrite.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync7, readFileSync as readFileSync10, writeFileSync as writeFileSync7 } from "node:fs";
import { join as join9 } from "node:path";

// src/tasks/boardPaths.ts
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

// src/tasks/boardEnv.ts
var BOARD_ENV_NAMES = [
  "TASKBOARD_ROOT",
  "CYBERINE_TASKS_ROOT",
  "NF_TASKS_ROOT",
  "NF_TASKS_AGENT",
  "NF_TASKS_MACHINE",
  "NF_TASKS_SYNC_DIR",
  "NF_TASKS_STALE_DOING_DAYS",
  "NF_TASKS_SESSION",
  "NF_TASKS_CLAIM_TTL_MS",
  "CYBERINE_TASKS_NO_PROMOTE",
  "CLAUDE_JOB_DIR",
  "CLAUDE_PROJECT_DIR",
  "PATH"
];
var ALLOWED = new Set(BOARD_ENV_NAMES);
function boardEnv(name, env = process.env) {
  if (!ALLOWED.has(name)) throw new Error(`board env: ${name} is not on the allowlist`);
  return env[name];
}

// src/tasks/boardPaths.ts
function manifestCandidates(root) {
  const syncDir = boardEnv("NF_TASKS_SYNC_DIR") || ".claude";
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
    `/cyberine-taskboard:tasks: refusing to operate on ${root} -- the working directory ${from} is inside this session's scratch dir (${scratchAbs}), but the board resolved OUTSIDE it: that is another project's board, not a fixture. Build fixtures with \`mktemp -d\` (outside any repo), or pin the root with TASKBOARD_ROOT=<dir>.`
  );
}
var STRICT_ROOT_PINS = ["TASKBOARD_ROOT", "CYBERINE_TASKS_ROOT"];
function repoRootStrict(startDir) {
  for (const name of STRICT_ROOT_PINS) {
    const pin = boardEnv(name);
    if (!pin) continue;
    const pinnedAbs = resolve(pin);
    if (existsSync(pinnedAbs) && statSync(pinnedAbs).isDirectory()) return pinnedAbs;
    throw new Error(`/cyberine-taskboard:tasks: ${name}=${pin} is not an existing directory`);
  }
  const pinned = boardEnv("NF_TASKS_ROOT");
  if (pinned) {
    const pinnedAbs = resolve(pinned);
    if (existsSync(pinnedAbs) && statSync(pinnedAbs).isDirectory()) return pinnedAbs;
    process.stderr.write(
      `/cyberine-taskboard:tasks: pinned root ${pinned} is not an existing directory -- ignoring, falling back to git derivation
`
    );
  }
  const abs = resolve(startDir);
  const root = deriveRootStrict(abs);
  if (root !== null) assertRootNotEscapingScratch(abs, root);
  return root;
}
function deriveRootStrict(abs) {
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(abs);
  } catch {
    return null;
  }
  const superWt = superWorkingTree(ownRoot);
  if (!superWt) return ownRoot;
  let superRoot;
  try {
    superRoot = worktreeMainRoot(superWt);
  } catch {
    return ownRoot;
  }
  if (hasAnyManifest(ownRoot)) return ownRoot;
  if (hasAnyManifest(superRoot)) return superRoot;
  return ownRoot;
}
function submoduleScope(startDir) {
  if (boardEnv("TASKBOARD_ROOT") || boardEnv("CYBERINE_TASKS_ROOT") || boardEnv("NF_TASKS_ROOT")) return "";
  const abs = resolve(startDir);
  let ownRoot;
  try {
    ownRoot = worktreeMainRoot(abs);
  } catch {
    return "";
  }
  const superWt = superWorkingTree(ownRoot);
  if (!superWt) return "";
  let superRoot;
  try {
    superRoot = worktreeMainRoot(superWt);
  } catch {
    return "";
  }
  if (hasAnyManifest(ownRoot)) return "";
  if (!hasAnyManifest(superRoot)) return "";
  const rel = relative(superRoot, ownRoot);
  return rel && !rel.startsWith("..") ? rel.split("\\").join("/") : "";
}
function pathInScope(taskPath, scope) {
  if (!scope) return true;
  if (!taskPath) return false;
  const norm = taskPath.replace(/\/+$/, "");
  return norm === scope || norm.startsWith(`${scope}/`);
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
function currentUser() {
  try {
    return userInfo().username;
  } catch {
    return "a";
  }
}
function agentTag() {
  const env = boardEnv("NF_TASKS_AGENT");
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

// src/tasks/boardLock.ts
import { mkdirSync, readFileSync as readFileSync3, renameSync as renameSync2, rmdirSync, statSync as statSync3, unlinkSync as unlinkSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { hostname } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";

// src/tasks/boardFormat.ts
import { existsSync as existsSync4, readFileSync as readFileSync2 } from "node:fs";

// scripts/taskboard-bundle/boardFormatHintStub.ts
var BOARD_UPDATE_HINT = "update the TaskBoard plugin";

// src/tasks/boardParse.ts
import { existsSync as existsSync3, readFileSync, writeFileSync as writeFileSync2 } from "node:fs";

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
  "do",
  "done-when",
  "why",
  "every",
  "last-done",
  "reason",
  "evidence",
  "duplicate-of",
  "completed",
  "lease"
];
var FOREIGN_TO_UPSTREAM_FIELDS = ["effort"];
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
function lintManifest(manifestSrc) {
  const warnings = [];
  let inBlock = false;
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  srcLines.forEach((line, idx) => {
    if (fenced[idx]) return;
    if (/^## /.test(line)) {
      inBlock = LINT_BLOCK_HEADER_RE.test(line);
      return;
    }
    if (!inBlock || !line.trim()) return;
    const m = FIELD_LINE_RE.exec(line);
    if (!m) return;
    const field = m[1];
    const rawValue = m[2];
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
  const found = manifestFormat(manifestPath);
  if (found > BOARD_FORMAT_VERSION) throw new BoardFormatTooNew(manifestPath, found);
}

// src/tasks/boardLock.ts
var LOCK_OWNER_FILE = "owner";
var LOCK_STALE_MS = 5 * 6e4;
var SPIN_TICKS = 250;
var SPIN_MS = 20;
var PROBE_TICK = 3;
function normalizeHost(h) {
  return h.trim().toLowerCase().replace(/\.local$/, "");
}
var THIS_HOST = normalizeHost(hostname());
function sleepSync(ms) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}
function readLockOwner(lockPath) {
  let mtimeMs;
  try {
    mtimeMs = statSync3(lockPath).mtimeMs;
  } catch {
    return null;
  }
  try {
    const stamp = readFileSync3(join3(lockPath, LOCK_OWNER_FILE), "utf8").trim();
    const raw = stamp.split("	");
    const pid = Number(raw[0]);
    const at = Number(raw[1]);
    const host = raw[2] !== void 0 && raw[2] !== "" ? normalizeHost(raw[2]) : null;
    if (Number.isInteger(pid) && pid > 0 && Number.isFinite(at)) {
      return { pid, ageMs: Date.now() - at, host, mtimeMs, stamp };
    }
  } catch {
  }
  return { pid: null, ageMs: Date.now() - mtimeMs, host: null, mtimeMs };
}
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
function isStale(owner) {
  if (owner.host !== null && owner.host !== THIS_HOST) return owner.ageMs > LOCK_STALE_MS;
  if (owner.pid !== null) return !pidAlive(owner.pid);
  return owner.ageMs > LOCK_STALE_MS;
}
function isForeignHost(owner) {
  return owner.host !== null && owner.host !== THIS_HOST;
}
function graveMtime(grave) {
  try {
    return statSync3(grave).mtimeMs;
  } catch {
    return null;
  }
}
function breakStaleLock(lockPath, judged) {
  const grave = `${lockPath}.stale.${process.pid}.${Date.now()}`;
  try {
    renameSync2(lockPath, grave);
  } catch {
    return false;
  }
  let takenPid = null;
  let takenStamp = null;
  try {
    takenStamp = readFileSync3(join3(grave, LOCK_OWNER_FILE), "utf8").trim();
    const n = Number(takenStamp.split("	")[0]);
    if (Number.isInteger(n) && n > 0) takenPid = n;
  } catch {
    takenPid = null;
  }
  const sameLock = judged.stamp != null ? takenStamp === judged.stamp : judged.pid !== null ? takenPid === judged.pid : takenPid === null && judged.mtimeMs !== null && graveMtime(grave) === judged.mtimeMs;
  if (!sameLock) {
    try {
      renameSync2(grave, lockPath);
    } catch {
    }
    return false;
  }
  try {
    unlinkSync2(join3(grave, LOCK_OWNER_FILE));
  } catch {
  }
  try {
    rmdirSync(grave);
  } catch {
  }
  return true;
}
function lock(lockPath) {
  mkdirSync(dirname2(lockPath), { recursive: true });
  let brokeOnce = false;
  const deadline = Date.now() + SPIN_TICKS * SPIN_MS;
  for (let i = 0; i < SPIN_TICKS && Date.now() < deadline; i++) {
    try {
      mkdirSync(lockPath);
      heldLocks.add(lockPath);
      try {
        writeFileSync3(join3(lockPath, LOCK_OWNER_FILE), `${process.pid}	${Date.now()}	${THIS_HOST}`);
      } catch {
      }
      return true;
    } catch {
      if (!brokeOnce && i === PROBE_TICK) {
        const owner = readLockOwner(lockPath);
        if (owner && isStale(owner)) {
          const why = isForeignHost(owner) ? `${Math.round(owner.ageMs / 1e3)}s old and its pid belongs to another machine` : owner.pid !== null ? `owner pid ${owner.pid} is gone` : `unstamped and ${Math.round(owner.ageMs / 1e3)}s old`;
          if (breakStaleLock(lockPath, owner)) {
            const where = isForeignHost(owner) ? ` stamped by host "${owner.host}", not this one,` : "";
            process.stderr.write(`/cyberine-taskboard:tasks: breaking stale lock${where} (${why}) at ${lockPath}
`);
          }
          brokeOnce = true;
          continue;
        }
      }
      sleepSync(SPIN_MS);
    }
  }
  process.stderr.write(
    `/cyberine-taskboard:tasks: lock busy after 5s -- another board process is holding ${lockPath}. If none is running, remove that directory.
`
  );
  return false;
}
var heldLocks = /* @__PURE__ */ new Set();
function unlock(lockPath) {
  const owner = readLockOwner(lockPath);
  if (owner && owner.pid !== null && owner.pid !== process.pid) return;
  if (owner && isForeignHost(owner)) return;
  if (owner && owner.pid === null && !heldLocks.has(lockPath)) return;
  heldLocks.delete(lockPath);
  try {
    unlinkSync2(join3(lockPath, LOCK_OWNER_FILE));
  } catch {
  }
  try {
    rmdirSync(lockPath);
  } catch {
  }
}
function lockAndMigrate(lockPath, manifestPath) {
  assertBoardWritable(manifestPath);
  if (!lock(lockPath)) return false;
  try {
    const r = ensureMigrated(manifestPath);
    if (r.migrated) {
      process.stderr.write(
        `/cyberine-taskboard:tasks: auto-migrated this board from the legacy ${r.kind} format -- ${r.count} task(s) converted to "## <id> [<status>] <title>".
`
      );
      process.stderr.write(
        `/cyberine-taskboard:tasks: backup written to ${r.backup} (every non-task line was passed through unchanged).
`
      );
    }
  } catch (e) {
    unlock(lockPath);
    throw e;
  }
  return true;
}

// src/tasks/boardArchive.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync4, readFileSync as readFileSync7, readdirSync as readdirSync4, renameSync as renameSync5 } from "node:fs";
import { basename as basename4, dirname as dirname5, join as join7 } from "node:path";

// src/tasks/boardReconcile.ts
import { existsSync as existsSync7, linkSync, readFileSync as readFileSync6, renameSync as renameSync4, statSync as statSync5, unlinkSync as unlinkSync3, writeFileSync as writeFileSync5 } from "node:fs";
import { basename as basename3 } from "node:path";

// src/tasks/boardExtras.ts
var FREE_TEXT_EXTRA_KEYS = /* @__PURE__ */ new Set(["evidence", "fail"]);
var EXTRA_KEY_RE = /^([a-z][a-z0-9-]*):/;
function parseExtras(field) {
  const out = /* @__PURE__ */ new Map();
  let rest = field ?? "";
  while (rest.length > 0) {
    const m = EXTRA_KEY_RE.exec(rest);
    if (m === null) break;
    const key = m[1];
    const value = rest.slice(m[0].length);
    if (FREE_TEXT_EXTRA_KEYS.has(key)) {
      if (!out.has(key)) out.set(key, value);
      return out;
    }
    const sp = value.indexOf(" ");
    if (sp === -1) {
      if (!out.has(key)) out.set(key, value);
      return out;
    }
    if (!out.has(key)) out.set(key, value.slice(0, sp));
    rest = value.slice(sp + 1).replace(/^ +/, "");
  }
  return out;
}
function extraValue(fields, key) {
  if (fields.length < 5) return void 0;
  return parseExtras(fields[4]).get(key);
}

// src/tasks/boardOverlay.ts
import { existsSync as existsSync5, readFileSync as readFileSync4, readdirSync as readdirSync2, statSync as statSync4 } from "node:fs";
import { basename as basename2, dirname as dirname4, join as join5 } from "node:path";

// src/tasks/statusWriter.ts
import { appendFileSync, mkdirSync as mkdirSync2, renameSync as renameSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname3, join as join4 } from "node:path";
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
  const envAgent = boardEnv("NF_TASKS_AGENT");
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
  return join4(repoRoot2, ...STATUS_LOG_REL);
}
function publishStatusV2(repoRoot2, line) {
  const dir = join4(repoRoot2, ...STATUS_D_REL);
  mkdirSync2(dir, { recursive: true });
  const pid = process.pid;
  const seq = String(v2SeqCounter++ % 1e4).padStart(4, "0");
  const epochMs = Date.now();
  const tmpPath = join4(dir, `.tmp.${pid}.${seq}`);
  const finalPath = join4(dir, `${epochMs}-${pid}-${seq}.log`);
  writeFileSync4(tmpPath, line, "utf8");
  renameSync3(tmpPath, finalPath);
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
  const logPath = explicitRoot ? join4(explicitRoot, ...STATUS_LOG_REL) : resolveStatusLogPath(cwd);
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
    mkdirSync2(dirname3(logPath), { recursive: true });
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
var FOLD_HEADER_RE = new RegExp(
  `^## (${TASK_ID_SOURCE}) \\[(${TASK_STATUS_SOURCE})(?:\\s[^\\]]*)?\\](?: |$)`
);
function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}
function pendingSnapshots(log) {
  const dir = dirname4(log);
  const prefix = `${basename2(log)}.snap.`;
  let names;
  try {
    names = readdirSync2(dir).filter((n) => n.startsWith(prefix));
  } catch {
    return [];
  }
  return names.map((n) => join5(dir, n)).map((p) => {
    let t;
    try {
      t = statSync4(p).mtimeMs;
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
  out.push(...names.map((n) => join5(paths.statusDir, n)));
  return sortByMtime(out);
}
function sortByMtime(paths) {
  return paths.map((path) => {
    let t;
    try {
      t = statSync4(path, { bigint: true }).mtimeNs;
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
      mtimeNs = statSync4(path, { bigint: true }).mtimeNs;
      text = readFileSync4(path, "utf8");
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
  const manifestSrc = existsSync5(manifestPath) ? readFileSync4(manifestPath, "utf8") : "";
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
    for (const ch of readFileSync4(p, "utf8")) if (ch === "\n") n++;
  }
  return n;
}

// src/tasks/boardJournal.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync6, mkdirSync as mkdirSync3, readFileSync as readFileSync5, readdirSync as readdirSync3 } from "node:fs";
import { join as join6 } from "node:path";
var DAY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
function appendJournalEvents(paths, events) {
  if (events.length === 0) return;
  assertBoardWritable(paths.manifest);
  mkdirSync3(paths.journalDir, { recursive: true });
  const byDay = /* @__PURE__ */ new Map();
  for (const ev of events) {
    const day = ev.ts.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(ev);
    else byDay.set(day, [ev]);
  }
  for (const [day, dayEvents] of byDay) {
    const lines = dayEvents.map((ev) => JSON.stringify(ev)).join("\n");
    appendFileSync2(join6(paths.journalDir, `${day}.jsonl`), `${lines}
`);
  }
}
function listJournalDays(paths) {
  if (!existsSync6(paths.journalDir)) return [];
  return readdirSync3(paths.journalDir).map((f) => DAY_FILE_RE.exec(f)?.[1]).filter((d) => d !== void 0).sort();
}
function dedupeAndSortEvents(events) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const ev of events) {
    const key = `${ev.kind}\0${ev.id ?? ""}\0${ev.ts}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  out.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  return out;
}
function readJournalDay(paths, date) {
  const file = join6(paths.journalDir, `${date}.jsonl`);
  if (!existsSync6(file)) return [];
  const events = [];
  for (const line of readFileSync5(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return dedupeAndSortEvents(events);
}
function deriveDayTitle(events) {
  let titleOverride;
  let doneCount = 0;
  let firstDecidedTitle;
  for (const ev of events) {
    if (ev.kind === "title") titleOverride = ev.v;
    else if (ev.kind === "done") doneCount++;
    else if (ev.kind === "decided" && firstDecidedTitle === void 0) firstDecidedTitle = ev.title;
  }
  if (titleOverride !== void 0) return titleOverride;
  if (doneCount > 0) return firstDecidedTitle ? `${doneCount} done -- ${firstDecidedTitle}` : `${doneCount} done`;
  return "empty";
}
function extractSection(briefSrc, heading) {
  const lines = briefSrc.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines.slice(start + 1, end).join("\n");
  if (!body.trim() || body.includes("{{")) return null;
  return lines.slice(start, end).join("\n").trimEnd();
}
function harvestJournalEvents(rawLog, overlay, manifestSrc, tasksDir, refusedHeaders, archiveSrc) {
  const lastDone = /* @__PURE__ */ new Map();
  for (const line of rawLog.split("\n")) {
    const fields = line.split("	");
    if (fields.length < 4 || fields[3] !== "done") continue;
    const epoch = Number(fields[0]);
    if (!Number.isFinite(epoch)) continue;
    const evidence = extraValue(fields, "evidence");
    const ts = epochToIsoForTz(epoch, extraValue(fields, "tz"));
    lastDone.set(fields[2], { ts, by: fields[1], ...evidence !== void 0 && { evidence } });
  }
  const titleFor = /* @__PURE__ */ new Map();
  const srcLines = manifestSrc.split("\n");
  const fenced = fencedLineFlags(srcLines);
  for (const [i, line] of srcLines.entries()) {
    if (fenced[i]) continue;
    const m = FOLD_HEADER_RE.exec(line);
    if (m) titleFor.set(m[1], line.slice(m[0].length));
  }
  const bakeable = archiveSrc === void 0 ? null : new Set(titleFor.keys());
  if (bakeable) {
    const archiveLines = archiveSrc.split("\n");
    const archiveFenced = fencedLineFlags(archiveLines);
    for (const [i, line] of archiveLines.entries()) {
      if (archiveFenced[i]) continue;
      const m = FOLD_HEADER_RE.exec(line);
      if (m) bakeable.add(m[1]);
    }
  }
  const events = [];
  for (const [id, status] of overlay) {
    if (status !== "done" || !TASK_ID_RE.test(id)) continue;
    if (refusedHeaders.has(id)) continue;
    if (bakeable && !bakeable.has(id)) continue;
    const done = lastDone.get(id);
    if (!done) continue;
    events.push({
      ts: done.ts,
      kind: "done",
      id,
      ...titleFor.get(id) !== void 0 && { title: titleFor.get(id) },
      by: done.by,
      ...done.evidence ? { evidence: done.evidence } : {}
    });
    const briefPath = join6(tasksDir, `${id}.md`);
    if (!existsSync6(briefPath)) continue;
    const briefSrc = readFileSync5(briefPath, "utf8");
    const sections = [
      extractSection(briefSrc, "Decisions"),
      extractSection(briefSrc, "Rejected approaches")
    ].filter((s) => s !== null);
    if (sections.length > 0) {
      events.push({
        ts: done.ts,
        kind: "decided",
        id,
        ...titleFor.get(id) !== void 0 && { title: titleFor.get(id) },
        body: sections.join("\n\n"),
        by: done.by
      });
    }
  }
  return events;
}
function pendingJournalEvents(paths) {
  if (!existsSync6(paths.manifest)) return [];
  const manifestSrc = readFileSync5(paths.manifest, "utf8");
  const rawLog = readOverlayText(paths);
  const overlay = foldOverlay(rawLog);
  const refused = refusedHeaderIds(manifestSrc, overlay, escapedForbiddenIds(rawLog));
  const archiveSrc = existsSync6(paths.archive) ? readFileSync5(paths.archive, "utf8") : "";
  return harvestJournalEvents(rawLog, overlay, manifestSrc, paths.tasksDir, refused, archiveSrc);
}
function listJournalDaysFolded(paths) {
  const days = new Set(listJournalDays(paths));
  for (const ev of pendingJournalEvents(paths)) days.add(ev.ts.slice(0, 10));
  return [...days].sort();
}
function readJournalDayFolded(paths, date) {
  const pending = pendingJournalEvents(paths).filter((ev) => ev.ts.slice(0, 10) === date);
  return dedupeAndSortEvents([...readJournalDay(paths, date), ...pending]);
}

// src/tasks/boardReconcile.ts
var BAKE_HEADER_RE = new RegExp(`^## (${TASK_ID_SOURCE}) \\[([^\\]]*)\\](?: |$)`);
var EVIDENCE_LINE_RE = /^evidence:(\s|$)/;
var COMPLETED_LINE_RE = /^completed:(\s|$)/;
var LEASE_LINE_RE = /^lease:(\s|$)/;
var ARCHIVE_HEADER_RE = new RegExp(`^## (${TASK_ID_SOURCE}) \\[`);
function firstBracketToken(bracket) {
  return bracket.trim().split(/\s+/).filter(Boolean)[0];
}
function rewriteStatusToken(line, val) {
  return line.replace(/\[([^\]]*)\]/, (_all, bracket) => {
    const rest = bracket.trim().split(/\s+/).filter(Boolean).slice(1);
    return rest.length ? `[${val} ${rest.join(" ")}]` : `[${val}]`;
  });
}
function bakeOverlay(manifestSrc, overlay, escapedForbidden = /* @__PURE__ */ new Set()) {
  const lines = manifestSrc.split("\n");
  const inputHeaders = countHeaders(lines);
  const fenced = fencedLineFlags(lines);
  const outLines = lines.map((line, i) => {
    if (fenced[i]) return line;
    const m = BAKE_HEADER_RE.exec(line);
    if (!m) return line;
    const val = overlay.get(m[1]);
    if (val === void 0) return line;
    const base = firstBracketToken(m[2]);
    if (base === void 0) return line;
    if (base === "forbidden" && val !== "todo" && !escapedForbidden.has(m[1])) return line;
    return rewriteStatusToken(line, val);
  });
  const out = outLines.join("\n");
  if (out.length === 0 || countHeaders(outLines) !== inputHeaders) return null;
  return out;
}
function evidenceInsertIndex(lines, start, end) {
  let i = end;
  while (i > start + 1 && lines[i - 1].trim() === "") i--;
  return i;
}
function headerIdsOutsideFences(src) {
  const ids = /* @__PURE__ */ new Set();
  const srcLines = src.split("\n");
  const fenced = fencedLineFlags(srcLines);
  for (const [i, line] of srcLines.entries()) {
    if (fenced[i]) continue;
    const m = ARCHIVE_HEADER_RE.exec(line);
    if (m) ids.add(m[1]);
  }
  return ids;
}
function stripFieldLines(lines, id, re) {
  const range = blockRange(lines, id);
  if (!range) return lines;
  return dropFieldLines(lines, range.start, range.end, re);
}
function bakeCompleted(manifestSrc, completedMap, clearIds) {
  if (completedMap.size === 0 && clearIds.size === 0) return manifestSrc;
  const rawLines = manifestSrc.split("\n");
  let lines = manifestSrc.endsWith("\n") ? rawLines.slice(0, -1) : rawLines;
  for (const id of clearIds) lines = stripFieldLines(lines, id, COMPLETED_LINE_RE);
  for (const [id, date] of completedMap) {
    const range = blockRange(lines, id);
    if (!range) continue;
    const cleared = dropFieldLines(lines, range.start, range.end, COMPLETED_LINE_RE);
    const clearedRange = blockRange(cleared, id);
    let insertAt = evidenceInsertIndex(cleared, clearedRange.start, clearedRange.end);
    while (insertAt > clearedRange.start + 1 && EVIDENCE_LINE_RE.test(cleared[insertAt - 1])) insertAt--;
    lines = [...cleared.slice(0, insertAt), `completed: ${date}`, ...cleared.slice(insertAt)];
  }
  return `${lines.join("\n")}
`;
}
function bakeEvidence(manifestSrc, evidenceMap, clearIds = /* @__PURE__ */ new Set()) {
  if (evidenceMap.size === 0 && clearIds.size === 0) return manifestSrc;
  const rawLines = manifestSrc.split("\n");
  let lines = manifestSrc.endsWith("\n") ? rawLines.slice(0, -1) : rawLines;
  for (const id of clearIds) lines = stripFieldLines(lines, id, EVIDENCE_LINE_RE);
  for (const [id, text] of evidenceMap) {
    const range = blockRange(lines, id);
    if (!range) continue;
    const cleared = dropFieldLines(lines, range.start, range.end, EVIDENCE_LINE_RE);
    const clearedRange = blockRange(cleared, id);
    const insertAt = evidenceInsertIndex(cleared, clearedRange.start, clearedRange.end);
    lines = [...cleared.slice(0, insertAt), `evidence: ${text}`, ...cleared.slice(insertAt)];
  }
  return `${lines.join("\n")}
`;
}
function bakeLeaseClear(manifestSrc, clearIds) {
  if (clearIds.size === 0) return manifestSrc;
  const rawLines = manifestSrc.split("\n");
  let lines = manifestSrc.endsWith("\n") ? rawLines.slice(0, -1) : rawLines;
  let changed = false;
  for (const id of clearIds) {
    const range = blockRange(lines, id);
    if (!range) continue;
    const next = dropFieldLines(lines, range.start, range.end, LEASE_LINE_RE);
    if (next.length !== lines.length) changed = true;
    lines = next;
  }
  if (!changed) return manifestSrc;
  return `${lines.join("\n")}
`;
}
function restoreSnapshots(log, snapshots) {
  if (snapshots.length !== 1) return;
  try {
    linkSync(snapshots[0], log);
  } catch {
    return;
  }
  try {
    unlinkSync3(snapshots[0]);
  } catch {
  }
}
function planReconcile(paths, rawLog, manifestSrc) {
  const overlay = /* @__PURE__ */ new Map();
  const escapedForbidden = escapedForbiddenIds(rawLog);
  const evidence = /* @__PURE__ */ new Map();
  const completed = /* @__PURE__ */ new Map();
  const uncompleted = /* @__PURE__ */ new Set();
  for (const line of rawLog.split("\n")) {
    const fields = line.split("	");
    if (fields.length < 4) continue;
    const id = fields[2];
    overlay.set(id, fields[3]);
    const epoch = Number(fields[0]);
    if (fields[3] === "done" && Number.isFinite(epoch) && epoch > 0) {
      completed.set(id, epochToIsoForTz(epoch, extraValue(fields, "tz")).slice(0, 10));
      uncompleted.delete(id);
    } else {
      completed.delete(id);
      uncompleted.add(id);
    }
    const flipEvidence = fields[3] === "done" ? extraValue(fields, "evidence") : void 0;
    if (flipEvidence !== void 0) {
      evidence.set(id, flipEvidence);
    } else {
      evidence.delete(id);
    }
  }
  const manifestIds = headerIdsOutsideFences(manifestSrc);
  const archivedSet = existsSync7(paths.archive) ? headerIdsOutsideFences(readFileSync6(paths.archive, "utf8")) : /* @__PURE__ */ new Set();
  const orphans = [...overlay.keys()].filter(
    (id) => TASK_ID_RE.test(id) && !manifestIds.has(id) && !archivedSet.has(id)
  );
  const refusedHeaders = refusedHeaderIds(manifestSrc, overlay, escapedForbidden);
  for (const id of refusedHeaders.keys()) {
    completed.delete(id);
    uncompleted.delete(id);
    evidence.delete(id);
  }
  const noEvidence = new Set([...overlay.keys()].filter((id) => !evidence.has(id) && !refusedHeaders.has(id)));
  const baked = bakeOverlay(manifestSrc, overlay, escapedForbidden);
  const leaseClear = /* @__PURE__ */ new Set();
  {
    const srcLines = manifestSrc.split("\n");
    const fenced = fencedLineFlags(srcLines);
    for (const [i, line] of srcLines.entries()) {
      if (fenced[i]) continue;
      const m = BAKE_HEADER_RE.exec(line);
      if (!m) continue;
      const base = firstBracketToken(m[2]);
      if (base === void 0) continue;
      if ((overlay.get(m[1]) ?? base) !== "doing") leaseClear.add(m[1]);
    }
  }
  const out = baked === null ? null : bakeLeaseClear(bakeEvidence(bakeCompleted(baked, completed, uncompleted), evidence, noEvidence), leaseClear);
  const heldLines = lastOverlayLinesFor(
    rawLog,
    new Set([...refusedHeaders].filter(([, reason]) => reason === "empty-bracket").map(([id]) => id))
  );
  return { overlay, heldLines, escapedForbidden, evidence, completed, refusedHeaders, orphans, baked, out };
}
function lastOverlayLinesFor(rawLog, ids) {
  const out = /* @__PURE__ */ new Map();
  if (ids.size === 0) return out;
  for (const line of rawLog.split("\n")) {
    if (line === "") continue;
    const fields = line.split("	");
    if (fields.length < 4) continue;
    const id = fields[2];
    if (ids.has(id)) out.set(id, line);
  }
  return out;
}
function reconcileDryRun(paths) {
  if (!existsSync7(paths.manifest)) return { pending: 0, plan: null, changedIds: [] };
  const rawLog = orderOverlayLines(overlaySources(paths)).text;
  const manifestSrc = readFileSync6(paths.manifest, "utf8");
  const plan = planReconcile(paths, rawLog, manifestSrc);
  const changedIds = plan.out === null ? [] : plan.out === manifestSrc ? [] : [...plan.overlay.keys()].filter((id) => TASK_ID_RE.test(id));
  const pending = rawLog.split("\n").filter((l) => l.split("	").length >= 4).length;
  return { pending, plan, changedIds };
}
function reconcileLocked(paths) {
  const { manifest, log } = paths;
  const snapshots = pendingSnapshots(log);
  const hasLive = existsSync7(log) && statSync5(log).size > 0;
  const published = overlaySources(paths).filter((p) => p.startsWith(`${paths.statusDir}/`));
  if (!hasLive && snapshots.length === 0 && published.length === 0) return true;
  if (hasLive) {
    const mine = `${log}.snap.${process.pid}.${Date.now()}`;
    try {
      renameSync4(log, mine);
      snapshots.push(mine);
    } catch {
      process.stderr.write("/cyberine-taskboard:tasks: reconcile could not snapshot the overlay -- overlay left intact\n");
      return false;
    }
  }
  const { text: rawLog, consumed } = orderOverlayLines([...snapshots, ...published]);
  const src = readFileSync6(manifest, "utf8");
  const plan = planReconcile(paths, rawLog, src);
  if (plan.orphans.length > 0) {
    process.stderr.write(
      `/cyberine-taskboard:tasks: reconcile is discarding ${plan.orphans.length} overlay flip(s) for id(s) not in this board: ${plan.orphans.join(", ")} -- they are in neither ${manifest} nor ${basename3(paths.archive)}. If you flipped them against a different manifest (another branch, or .claude/TASKS.md vs .local/tasks/ACTIVE.md), re-run the flip on that board.
`
    );
  }
  if (plan.out === null) {
    restoreSnapshots(log, snapshots);
    process.stderr.write("/cyberine-taskboard:tasks: reconcile refused, header count guard failed -- overlay left intact\n");
    return false;
  }
  try {
    writeFileAtomic(manifest, plan.out, "rec");
  } catch {
    restoreSnapshots(log, snapshots);
    process.stderr.write("/cyberine-taskboard:tasks: reconcile failed, overlay left intact\n");
    return false;
  }
  for (const [id, reason] of plan.refusedHeaders) {
    if (reason !== "empty-bracket") continue;
    const held = plan.heldLines.get(id);
    if (held !== void 0) {
      try {
        republishOverlayLine(paths.root, held);
      } catch {
        process.stderr.write(
          `/cyberine-taskboard:tasks: reconcile could not hold the ${plan.overlay.get(id)} flip for ${id} -- it is lost; re-flip it after repairing the bracket
`
        );
        continue;
      }
    }
    process.stderr.write(
      `/cyberine-taskboard:tasks: reconcile is holding a ${plan.overlay.get(id)} flip for ${id} -- its header bracket is empty ([]), so there is no status to rewrite; repair the bracket and the held flip bakes with its original date
`
    );
  }
  try {
    appendJournalEvents(paths, harvestJournalEvents(rawLog, plan.overlay, src, paths.tasksDir, plan.refusedHeaders, existsSync7(paths.archive) ? readFileSync6(paths.archive, "utf8") : ""));
  } catch (err) {
    process.stderr.write(
      `/cyberine-taskboard:tasks: journal harvest failed (${err.message}) -- overlay still reconciled
`
    );
  }
  for (const p of published) {
    try {
      unlinkSync3(p);
    } catch {
    }
  }
  for (const p of snapshots) {
    let nowText;
    try {
      nowText = readFileSync6(p, "utf8");
    } catch {
      continue;
    }
    const had = consumed.get(p) ?? 0;
    if (nowText.length > had) {
      try {
        writeFileSync5(p, nowText.slice(had));
        process.stderr.write(
          `/cyberine-taskboard:tasks: an append landed in ${p} after reconcile read it -- kept pending for the next reconcile
`
        );
        continue;
      } catch {
        continue;
      }
    }
    try {
      unlinkSync3(p);
    } catch {
    }
  }
  try {
    writeFileSync5(log, "", { flag: "wx" });
  } catch {
  }
  return true;
}
function reconcile(paths) {
  const pending = overlaySources(paths).some((p) => {
    try {
      return statSync5(p).size > 0;
    } catch {
      return false;
    }
  });
  if (!pending) return true;
  assertBoardWritable(paths.manifest);
  if (!lock(paths.lock)) return false;
  try {
    const mig = ensureMigrated(paths.manifest);
    if (mig.migrated) {
      process.stderr.write(
        `/cyberine-taskboard:tasks: auto-migrated this board from the legacy ${mig.kind} format -- ${mig.count} task(s) converted (backup: ${mig.backup}).
`
      );
    }
  } catch (e) {
    unlock(paths.lock);
    throw e;
  }
  try {
    return reconcileLocked(paths);
  } finally {
    unlock(paths.lock);
  }
}

// src/tasks/boardArchive.ts
var ArchivePartialError = class extends Error {
  phase;
  archivedIds;
  briefsPending;
  constructor(cause, phase, archivedIds2, briefsPending) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "ArchivePartialError";
    this.phase = phase;
    this.archivedIds = archivedIds2;
    this.briefsPending = briefsPending;
  }
};
function archivedIds(archivePath) {
  if (!existsSync8(archivePath)) return /* @__PURE__ */ new Set();
  return new Set(
    parseManifestBlocks(readFileSync7(archivePath, "utf8"), TASK_ID_RE).blocks.map((b) => b.id)
  );
}
function archiveAbortLabel(e, cmd = "archive") {
  const partial = e instanceof ArchivePartialError ? e : null;
  const n = partial?.archivedIds.length ?? 0;
  const board = cmd === "end" ? "the board below" : "the board";
  if (!partial || partial.phase === "none" || n === 0) {
    return cmd === "end" ? "end: wrap-up aborted above -- board as-is, nothing archived this run:" : "archive: aborted -- nothing archived, the board is unchanged.";
  }
  if (partial.phase === "archive-appended") {
    return `${cmd}: ${n} task(s) appended to TASKS_ARCHIVE.md but ${board} was NOT rewritten, so they now exist in BOTH files; delete the ${n} block(s) from TASKS_ARCHIVE.md (NOT from ${board}) and re-run ${cmd}.`;
  }
  const behind = partial.briefsPending.length;
  if (behind === 0) {
    return `${cmd}: ${n} task(s) archived and ${board} is current, but the run failed after the move (see stderr).`;
  }
  return `${cmd}: ${n} task(s) archived and ${board} is current, but ${behind} brief file(s) did not move to tasks/archive/ -- re-run ${cmd} to finish the move.`;
}
function splitDone(src) {
  const rawLines = src.split("\n");
  const lines = src.endsWith("\n") ? rawLines.slice(0, -1) : rawLines;
  const { blocks, warnings } = parseManifestBlocks(lines.join("\n"), TASK_ID_RE);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const doneBlocks = blocks.filter((b) => b.status === "done");
  const doneIds = doneBlocks.map((b) => b.id);
  let archiveText = "";
  for (const b of doneBlocks) archiveText += lines.slice(b.start, b.end).join("\n") + "\n\n";
  const excluded = /* @__PURE__ */ new Set();
  for (const b of doneBlocks) for (let i = b.start; i < b.end; i++) excluded.add(i);
  const outLines = lines.filter((_, i) => !excluded.has(i));
  const remaining = outLines.length ? outLines.join("\n") + "\n" : "";
  return { archiveText, remaining, archivedIds: doneIds };
}
function moveBrief(tasksDir, id) {
  const brief = join7(tasksDir, `${id}.md`);
  if (!existsSync8(brief)) return "absent";
  const archiveDir = join7(tasksDir, "archive");
  const dest = join7(archiveDir, `${id}.md`);
  if (existsSync8(dest)) {
    process.stderr.write(
      `archive: ${id} already has an archived brief -- left ${brief} in place rather than overwriting ${dest}
`
    );
    return "collision";
  }
  mkdirSync4(archiveDir, { recursive: true });
  renameSync5(brief, dest);
  return "moved";
}
function orphanBriefIds(paths) {
  if (!existsSync8(paths.tasksDir)) return [];
  const archived = archivedIds(paths.archive);
  return readdirSync4(paths.tasksDir).filter((f) => f.endsWith(".md") && archived.has(f.slice(0, -3))).map((f) => f.slice(0, -3)).sort();
}
function pendingBriefs(paths) {
  try {
    return orphanBriefIds(paths);
  } catch (error) {
    process.stderr.write(`archive: could not measure pending briefs: ${String(error)}
`);
    return [];
  }
}
function sweepOrphanBriefs(paths, collisions) {
  const moved = [];
  for (const id of orphanBriefIds(paths)) {
    const outcome = moveBrief(paths.tasksDir, id);
    if (outcome === "moved") moved.push(id);
    else if (outcome === "collision") collisions.push(id);
  }
  return moved;
}
function reportCollisions(paths, ids, out) {
  if (!ids.length) return;
  out(
    `brief collision: ${ids.length} archived task(s) have a brief in BOTH ${paths.tasksDir}/ and ${paths.tasksDir}/archive/ -- nothing was overwritten; compare each pair and delete the copy you do not want, then re-run:`
  );
  for (const id of ids) out(`  ${id}`);
}
function archiveHeader(root) {
  return `# Tasks Archive: ${basename4(root)}

`;
}
function appendToArchive(paths, text) {
  mkdirSync4(dirname5(paths.archive), { recursive: true });
  const existing = existsSync8(paths.archive) ? readFileSync7(paths.archive, "utf8") : archiveHeader(paths.root);
  writeFileAtomic(paths.archive, existing + text, "arch");
}
function archiveLocked(paths, opts, out = (s) => process.stdout.write(`${s}
`)) {
  if (!reconcileLocked(paths)) {
    throw new ArchivePartialError(
      new Error("archive: reconcile refused (see above) -- nothing archived"),
      "none",
      [],
      []
    );
  }
  const src = readFileSync7(paths.manifest, "utf8");
  const { archiveText, remaining, archivedIds: ids } = splitDone(src);
  const nDone = ids.length;
  if (opts.auto && nDone < 10) {
    out(`${nDone} done task(s) -- threshold not reached (need >= 10). skip.`);
    return [];
  }
  if (nDone > 0) {
    let phase = "none";
    let moved2;
    const collisions2 = [];
    try {
      appendToArchive(paths, archiveText);
      phase = "archive-appended";
      writeFileAtomic(paths.manifest, remaining, "arch");
      phase = "manifest-rewritten";
      moved2 = sweepOrphanBriefs(paths, collisions2);
    } catch (e) {
      reportCollisions(paths, collisions2, out);
      throw new ArchivePartialError(e, phase, ids, pendingBriefs(paths));
    }
    out(`archived ${nDone} task(s) -> ${paths.archive}`);
    const stranded = moved2.filter((id) => !ids.includes(id)).length;
    if (stranded) out(`  (also moved ${stranded} stranded brief(s) from an earlier run)`);
    reportCollisions(paths, collisions2, out);
    return collisions2;
  }
  let moved;
  const collisions = [];
  try {
    moved = sweepOrphanBriefs(paths, collisions);
  } catch (e) {
    reportCollisions(paths, collisions, out);
    throw new ArchivePartialError(e, "none", [], []);
  }
  out("no [done] tasks to archive.");
  if (moved.length) out(`  moved ${moved.length} stranded brief(s) into tasks/archive/`);
  reportCollisions(paths, collisions, out);
  return collisions;
}

// src/tasks/boardLedger.ts
import { appendFileSync as appendFileSync3, existsSync as existsSync9, mkdirSync as mkdirSync5, readFileSync as readFileSync8 } from "node:fs";
import { dirname as dirname6 } from "node:path";
function appendLedgerEntry(ledgerPath, entry) {
  mkdirSync5(dirname6(ledgerPath), { recursive: true });
  appendFileSync3(ledgerPath, `${JSON.stringify(entry)}
`);
}
function readLedger(ledgerPath) {
  if (!existsSync9(ledgerPath)) return [];
  const out = [];
  for (const line of readFileSync8(ledgerPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return out;
}
function findLedgerEntry(ledgerPath, idA, idB) {
  let found = null;
  for (const e of readLedger(ledgerPath)) {
    if (e.a === idA && e.b === idB || e.a === idB && e.b === idA) found = e;
  }
  return found;
}

// src/tasks/boardDrafts.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync6, readFileSync as readFileSync9, readdirSync as readdirSync5, renameSync as renameSync6, statSync as statSync6, writeFileSync as writeFileSync6 } from "node:fs";
import { basename as basename5, join as join8, relative as relative2, resolve as resolve2 } from "node:path";
function draftNames(draftsDir) {
  if (!existsSync10(draftsDir)) return [];
  return readdirSync5(draftsDir).filter((name) => /^draft-.*\.md$/.test(name) && statSync6(join8(draftsDir, name)).isFile()).sort();
}
function validateDraftReferences(draftsDir, decisions) {
  const pending = draftNames(draftsDir);
  const errors = [];
  for (const task of decisions) {
    if (!task || typeof task !== "object") continue;
    const draft = task.draft;
    if (draft === void 0 || draft === null) continue;
    if (typeof draft !== "string") {
      errors.push(`@${task.ref}: draft must be a string (the draft filename this task came from)`);
    } else if (/[\\/]/.test(draft) || draft === "." || draft === "..") {
      errors.push(`@${task.ref}: draft must be a bare basename with no path separator (got ${JSON.stringify(draft)})`);
    } else if (!/^draft-.*\.md$/.test(draft)) {
      errors.push(`@${task.ref}: draft must be a "draft-*.md" filename (got ${JSON.stringify(draft)})`);
    } else if (!pending.includes(draft)) {
      errors.push(`@${task.ref}: draft "${draft}" not found in .local/tasks/drafts/ (names are case-sensitive)`);
    } else if (existsSync10(join8(draftsDir, "consumed", draft))) {
      errors.push(`@${task.ref}: draft "${draft}" already exists in drafts/consumed/`);
    }
  }
  return errors;
}
function consumedDrafts(draftsDir, names) {
  if (names.length === 0) return [];
  const consumedDir = join8(draftsDir, "consumed");
  mkdirSync6(consumedDir, { recursive: true });
  for (const name of names) renameSync6(join8(draftsDir, name), join8(consumedDir, name));
  return names;
}
function gatherDrafts(root, draftsDir) {
  if (!existsSync10(draftsDir) || !statSync6(draftsDir).isDirectory()) {
    throw new Error(`no drafts dir: ${draftsDir}  (run init first, then add draft-*.md)`);
  }
  const names = draftNames(draftsDir);
  if (names.length === 0) throw new Error(`no draft-*.md found in ${draftsDir}`);
  let result = "";
  for (const name of names) {
    const file = join8(draftsDir, name);
    const content = readFileSync9(file, "utf8");
    const from = content.match(/^from:\s*(.+)$/m)?.[1]?.trim();
    const path = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
    result += `
===== ${relative2(root, file)}${from ? `   [from: ${from}]` : ""} =====
`;
    if (from) result += `# provenance -> set this task's "from": ${JSON.stringify(from)} in the save batch
`;
    result += `# consumed-from -> set this task's "draft": ${JSON.stringify(name)} so save archives it
`;
    if (path) result += `# dispatch cwd -> set this task's "path": ${JSON.stringify(path)} in the save batch
`;
    result += `${content}
`;
  }
  return result;
}
function sourceSlug(name) {
  const leadingDot = name.startsWith(".");
  let slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (leadingDot) slug = `dot-${slug.replace(/^dot-/, "")}`;
  return slug || "repo";
}
function writeDraft(input) {
  const root = repoRoot(input.to ? resolve2(input.to) : process.cwd());
  assertBoardWritable(boardPathsFor(root).manifest);
  const fromRoot = repoRoot(process.cwd());
  const machine = (boardEnv("NF_TASKS_MACHINE") ?? "").trim();
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const from = `${sourceSlug(basename5(fromRoot))}${machine ? `@${machine}` : ""} ${day}`;
  const path = relative2(root, process.cwd());
  const pathStamp = path && !path.startsWith("..") ? path : null;
  let body;
  if (input.file) body = readFileSync9(input.file, "utf8").trimEnd();
  else if (input.stdin !== void 0) body = input.stdin.trimEnd();
  else {
    const parts = [`# ${input.title.trim()}`, ""];
    if (input.doText?.trim()) parts.push(`**do:** ${input.doText.trim()}`, "");
    if (input.doneWhen?.trim()) parts.push(`**done-when:** ${input.doneWhen.trim()}`, "");
    if (input.why?.trim()) parts.push("## Context", "", input.why.trim(), "");
    body = parts.join("\n").trimEnd();
  }
  const header = ["<!-- nf-tasks-draft", `from: ${from}`];
  if (input.by?.trim()) header.push(`from-model: ${input.by.trim()}`);
  if (pathStamp) header.push(`path: ${pathStamp}`);
  if (input.why?.trim()) header.push(`why: ${input.why.trim().replace(/\s+/g, " ")}`);
  header.push("-->");
  const draftsDir = join8(root, ".local", "tasks", "drafts");
  mkdirSync6(draftsDir, { recursive: true });
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "task";
  const epoch = Math.floor(Date.now() / 1e3);
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? `${epoch}-${process.pid}` : `${epoch}-${process.pid}-${attempt}`;
    const candidate = join8(draftsDir, `draft-${slug}-${suffix}.md`);
    try {
      writeFileSync6(candidate, `${header.join("\n")}

${body}
`, { flag: "wx" });
      return { path: candidate, root, from };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`draft: could not find a free filename for "${input.title}" in ${draftsDir} after 50 attempts`);
}

// src/tasks/boardWrite.ts
var BoardRejected = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BoardRejected";
  }
};
var VALID_MODELS = /* @__PURE__ */ new Set(["haiku", "sonnet", "opus", "fable"]);
var VALID_EXEC = /* @__PURE__ */ new Set(["agent", "manual", "opencode"]);
var VALID_PRIORITIES = /* @__PURE__ */ new Set(["p0", "p1", "p2"]);
var VALID_EFFORT = /* @__PURE__ */ new Set(["S", "M", "L"]);
var REASONING_LEVELS = ["low", "medium", "high", "xhigh", "max"];
var VALID_REASONING = new Set(REASONING_LEVELS);
var DEFAULT_TASK_EXEC = "agent";
var DEFAULT_TASK_MODEL = "sonnet";
function withTaskDefaults(t) {
  if (!t || typeof t !== "object") return t;
  const raw = t;
  const exec = raw.exec ?? DEFAULT_TASK_EXEC;
  const model = raw.model !== void 0 ? raw.model : exec === "manual" ? null : DEFAULT_TASK_MODEL;
  return { ...t, exec, model };
}
var BRIEF_SECTIONS = ["intent", "decisions", "pointers", "rejected", "doneWhen", "gotchas"];
var BRIEF_TEMPLATE = `<!-- Task brief: self-sufficient work order for one manifest task. Filename convention -->
<!-- is tasks/T<NN>.md, next to the manifest. Converge fills this in while brainstorm -->
<!-- context still exists; run dispatch points the cold executor at this file instead -->
<!-- of the one-line manifest do:/done-when:. -->

## Intent
<!-- What to do AND why; scope boundaries - what is explicitly out of scope. -->
{{intent}}

## Decisions
<!-- Choices already made during brainstorm the executor must follow, one-line each: "use X, not Y, because Z". -->
{{decisions}}

## Pointers
<!-- Concrete files/modules to touch, existing helpers/conventions to reuse, relevant docs. -->
{{pointers}}

## Rejected approaches
<!-- Dead ends already considered and dismissed, with why, so the executor does not re-explore them. -->
{{rejected-approaches}}

## Done-when
<!-- Acceptance criteria a cold session can verify: commands to run, outputs to expect. No outside knowledge assumed. -->
{{done-when}}

## Gotchas
<!-- Environment quirks, ordering requirements, things that look right but are wrong. -->
{{gotchas}}
`;
var WRITABLE_STATUSES = ["todo", "backlog"];
var SCHEMA_TEXT = `/cyberine-taskboard:tasks save -- input shape (--input <file>, or stdin):

{
  "tasks": [
    {
      "ref": "a",                    // required, unique in this batch -- batch-local handle
      "title": "...",                // required, non-empty
      "do": "...",                   // required, non-empty -- one-sentence imperative instruction
      "doneWhen": "...",             // required, non-empty -- observable acceptance criterion
      "exec": "agent",               // optional, default "agent" when omitted: "agent" | "manual" | "opencode"
      "model": "sonnet",             // optional, default "sonnet" (null when exec:"manual", which requires null): haiku|sonnet|opus|fable
      "effort": "M",                 // REQUIRED: S | M | L
      "reasoning": "high",           // optional, exec:"agent" only -- low|medium|high|xhigh|max; omit or null to inherit
      "priority": "p1",              // optional, default "p1" when omitted -- p0 | p1 | p2
      "path": "apps/web",            // optional -- dispatch cwd, relative POSIX path from the resolved root, or "-"
      "deps": ["T03", "@b"],         // optional, default [] -- existing ids (T##/k####) and batch refs (@ref)
      "area": ["auth"],              // optional, default [] -- affinity tag(s), whitespace-free tokens
      "createdBy": "claude-opus-5",  // optional -- model id that authored the task (provenance only)
      "from": "repo 2026-09-06",     // optional -- origin-session provenance
      "draft": "draft-task-123.md",  // optional -- pending draft basename to consume after apply
      "blocker": null,               // optional -- external blocker reason, or null/omit when none
      "why": "...",                  // optional -- one-line rationale kept IN the manifest
      "brief": {                     // REQUIRED -- every section real content; a bare N/A/None/TBD/- is refused, decisions/rejected/gotchas take "None \u2014 <why>"
        "intent": "...", "decisions": "...", "pointers": "...",
        "rejected": "...", "doneWhen": "...", "gotchas": "..."
      }
    }
  ]
}
`;
function briefText(brief) {
  const withoutComments = BRIEF_TEMPLATE.split("\n").filter((l) => !/^<!--.*-->$/.test(l.trim())).join("\n");
  return withoutComments.replace("{{intent}}", brief.intent.trim()).replace("{{decisions}}", brief.decisions.trim()).replace("{{pointers}}", brief.pointers.trim()).replace("{{rejected-approaches}}", brief.rejected.trim()).replace("{{done-when}}", brief.doneWhen.trim()).replace("{{gotchas}}", brief.gotchas.trim());
}
function validatePathField(value) {
  if (typeof value !== "string" || !value) return "must be a non-empty string";
  if (value === "-") return null;
  if (/\s/.test(value)) return "must be a single token (no whitespace) -- one cwd, not a list";
  if (value.startsWith("/")) return 'must be relative (no leading "/")';
  if (value.startsWith("./")) return 'must not start with "./"';
  if (value.endsWith("/")) return 'must not have a trailing "/"';
  if (value.split("/").includes("..")) return 'must not contain ".." segments';
  return null;
}
function parseSimpleBlocks(src, warn) {
  const { blocks, warnings } = parseManifestBlocks(src, TASK_ID_RE);
  for (const w of warnings) warn(w);
  return blocks.map((b) => ({
    id: b.id,
    status: b.status ?? "",
    title: b.title,
    do: b.fields.get("do") ?? ""
  }));
}
function findExisting(title, doText, ...blockLists) {
  for (const blocks of blockLists) {
    for (const b of blocks) {
      if (b.title === title.trim() && b.do === doText.trim()) return b.id;
    }
  }
  return null;
}
function findRefCycle(refs, childrenOf) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const state = new Map(refs.map((r) => [r, WHITE]));
  const stack = [];
  function dfs(r) {
    state.set(r, GRAY);
    stack.push(r);
    for (const c of childrenOf(r)) {
      if (state.get(c) === GRAY) return [...stack.slice(stack.indexOf(c)), c];
      if (state.get(c) === WHITE) {
        const found = dfs(c);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(r, BLACK);
    return null;
  }
  for (const r of refs) {
    if (state.get(r) === WHITE) {
      const found = dfs(r);
      if (found) return found;
    }
  }
  return null;
}
function topoOrder(items, batchDeps) {
  const indexOf = new Map(items.map((t, i) => [t.ref, i]));
  const inDeg = new Map(items.map((t) => [t.ref, 0]));
  const children = new Map(items.map((t) => [t.ref, []]));
  for (const t of items) {
    for (const dep of batchDeps.get(t.ref) ?? []) {
      if (!indexOf.has(dep)) continue;
      children.get(dep).push(t.ref);
      inDeg.set(t.ref, (inDeg.get(t.ref) ?? 0) + 1);
    }
  }
  const byRef = new Map(items.map((t) => [t.ref, t]));
  const queue = items.filter((t) => inDeg.get(t.ref) === 0).map((t) => t.ref);
  const order = [];
  while (queue.length) {
    queue.sort((a, b) => indexOf.get(a) - indexOf.get(b));
    const r = queue.shift();
    order.push(byRef.get(r));
    for (const c of children.get(r)) {
      inDeg.set(c, inDeg.get(c) - 1);
      if (inDeg.get(c) === 0) queue.push(c);
    }
  }
  if (order.length !== items.length) throw new Error("internal: cycle slipped past the earlier cycle check");
  return order;
}
function renderBlock(t, refToId, today) {
  const id = refToId.get(t.ref);
  const depIds = (t.deps ?? []).map((d) => d.startsWith("@") ? refToId.get(d.slice(1)) : d);
  const status = t.status ?? "todo";
  if (!WRITABLE_STATUSES.includes(status)) {
    throw new BoardRejected(`save: refusing to write status "${status}" -- allowed: ${WRITABLE_STATUSES.join(" | ")}`);
  }
  const lines = [`## ${id} [${status}] ${t.title.trim()}`];
  lines.push(`created: ${today}`);
  lines.push(`deps: ${depIds.length ? depIds.join(", ") : "-"}`);
  lines.push(`exec: ${t.exec}`);
  lines.push(`model: ${t.exec === "manual" ? "-" : t.model}`);
  lines.push(`effort: ${t.effort}`);
  if (t.reasoning) lines.push(`reasoning: ${t.reasoning}`);
  if (t.priority) lines.push(`priority: ${t.priority}`);
  if (t.path) lines.push(`path: ${t.path}`);
  if (t.area && t.area.length) lines.push(`area: ${t.area.join(" ")}`);
  if (t.blocker) lines.push(`blocker: ${t.blocker}`);
  if (t.createdBy) lines.push(`created-by: ${t.createdBy}`);
  if (t.from) lines.push(`from: ${t.from}`);
  lines.push(`do: ${t.do.trim()}`);
  lines.push(`done-when: ${t.doneWhen.trim()}`);
  if (t.why && t.why.trim()) lines.push(`why: ${t.why.trim().replace(/\s+/g, " ")}`);
  const rendered = lines.join("\n");
  const { blocks } = parseManifestBlocks(`${rendered}
`, TASK_ID_RE);
  if (blocks.length !== 1 || blocks[0].id !== id) {
    throw new BoardRejected(
      `save: rejected, nothing written: task "${t.ref}" renders to ${blocks.length} block(s) instead of 1 -- a field value is injecting manifest structure (check title/do/done-when for newlines or a leading "## ")`
    );
  }
  return rendered;
}
var ALL_HEADER_RE = new RegExp(`^## (?:${TASK_ID_SOURCE}|R[0-9]+)\\b`);
function countAllHeaders(src) {
  const lines = src.split("\n");
  const fenced = fencedLineFlags(lines);
  return lines.filter((l, i) => !fenced[i] && ALL_HEADER_RE.test(l)).length;
}
function insertBlocks(manifestSrc, newBlocksText) {
  if (!newBlocksText) return manifestSrc;
  const lines = manifestSrc.split("\n");
  const rBlock = parseManifestBlocks(manifestSrc, /^R[0-9]+$/).blocks[0];
  if (!rBlock) {
    const head = manifestSrc.replace(/\n+$/, "");
    return `${head}

${newBlocksText}
`;
  }
  const before = lines.slice(0, rBlock.start).join("\n").replace(/\n+$/, "");
  const after = lines.slice(rBlock.start).join("\n");
  return `${before}

${newBlocksText}

${after}`;
}
function mergeManifest(manifestSrc, newBlocksText, expectedNewCount) {
  const before = countAllHeaders(manifestSrc);
  const out = insertBlocks(manifestSrc, newBlocksText);
  if (out.trim().length === 0 || countAllHeaders(out) !== before + expectedNewCount) return null;
  return out;
}
var MAY_BE_NONE = /* @__PURE__ */ new Set(["decisions", "rejected", "gotchas"]);
var BARE_PLACEHOLDER_RE = /^(?:n\/?a|none|nil|null|tbd|todo|-+|—|\.{2,}|…)\.?$/i;
function validateDecisions(decisions, requireBrief = false) {
  const errors = [];
  const refIndex = /* @__PURE__ */ new Map();
  decisions.forEach((t, i) => {
    const tag = t && typeof t.ref === "string" && t.ref ? `@${t.ref}` : `#${i}`;
    if (!t || typeof t.ref !== "string" || !t.ref.trim()) {
      errors.push(`${tag}: ref is required and non-empty`);
    } else if (refIndex.has(t.ref)) {
      errors.push(`${tag}: duplicate ref (also used at batch index ${refIndex.get(t.ref)})`);
    } else {
      refIndex.set(t.ref, i);
    }
    for (const field of ["title", "do", "doneWhen"]) {
      if (!t?.[field] || !String(t[field]).trim()) errors.push(`${tag}: "${field}" is required and non-empty`);
    }
    if (t?.status !== void 0 && !WRITABLE_STATUSES.includes(t.status)) {
      errors.push(`${tag}: "status" must be one of ${WRITABLE_STATUSES.join(" | ")}, got "${String(t.status)}"`);
    }
    for (const field of ["title", "do", "doneWhen", "blocker", "from", "path", "createdBy"]) {
      const v = t?.[field];
      if (typeof v === "string" && /[\r\n]/.test(v)) {
        errors.push(
          `${tag}: "${field}" must be a single line -- it renders as one manifest line and a newline would split the task block`
        );
      }
    }
    if (Array.isArray(t?.area)) {
      for (const a of t.area) {
        if (typeof a === "string" && /[\r\n\s]/.test(a)) {
          errors.push(
            `${tag}: area tag ${JSON.stringify(a)} must be a single whitespace-free token -- area renders space-separated on one line`
          );
        }
      }
    }
    if (!t || !VALID_EXEC.has(t.exec)) {
      errors.push(`${tag}: exec must be one of agent|manual|opencode (got ${JSON.stringify(t?.exec)})`);
    } else if (t.exec === "manual") {
      if (t.model !== null && t.model !== void 0) errors.push(`${tag}: model must be null when exec:manual`);
    } else if (!VALID_MODELS.has(t.model)) {
      errors.push(`${tag}: model must be one of haiku|sonnet|opus|fable (got ${JSON.stringify(t?.model)})`);
    }
    if (!t || typeof t.effort !== "string" || !VALID_EFFORT.has(t.effort)) {
      errors.push(`${tag}: effort is REQUIRED and must be one of S|M|L (got ${JSON.stringify(t?.effort)})`);
    }
    if (t?.reasoning !== void 0 && t.reasoning !== null) {
      if (!VALID_REASONING.has(t.reasoning)) {
        errors.push(`${tag}: reasoning must be one of ${REASONING_LEVELS.join("|")} (got ${JSON.stringify(t.reasoning)})`);
      } else if (t.exec !== "agent") {
        errors.push(`${tag}: reasoning applies only to exec:agent (got exec:${t.exec}) -- omit it or use null`);
      }
    }
    if (t?.deps !== void 0 && !Array.isArray(t.deps)) errors.push(`${tag}: deps must be an array of strings`);
    if (t?.priority !== void 0 && t.priority !== null && !VALID_PRIORITIES.has(t.priority)) {
      errors.push(`${tag}: priority must be one of p0|p1|p2 (got ${JSON.stringify(t?.priority)})`);
    }
    if (t?.area !== void 0 && !Array.isArray(t.area)) {
      errors.push(`${tag}: area must be an array of strings (got ${JSON.stringify(t?.area)})`);
    }
    if (t?.from !== void 0 && t.from !== null && typeof t.from !== "string") {
      errors.push(`${tag}: from must be a string (origin-session provenance)`);
    }
    if (t?.path !== void 0 && t.path !== null) {
      const pathErr = validatePathField(t.path);
      if (pathErr) errors.push(`${tag}: path ${pathErr}`);
    }
    if (t?.why !== void 0 && t.why !== null && typeof t.why !== "string") {
      errors.push(`${tag}: why must be a string (one-line rationale)`);
    }
    if (t?.brief === void 0 || t.brief === null) {
      if (requireBrief) errors.push(`${tag}: brief is required`);
    } else if (typeof t.brief !== "object") {
      errors.push(`${tag}: brief must be an object with the six section keys`);
    } else {
      for (const s of BRIEF_SECTIONS) {
        const v = t.brief[s] ? String(t.brief[s]).trim() : "";
        if (!v) {
          errors.push(`${tag}: brief.${s} is empty -- sufficiency lint failed`);
        } else if (BARE_PLACEHOLDER_RE.test(v)) {
          errors.push(
            MAY_BE_NONE.has(s) ? `${tag}: brief.${s} is a bare "${v}" -- write "None \u2014 <why>" so the executor knows it was considered, not skipped` : `${tag}: brief.${s} is a bare "${v}" -- intent, pointers and doneWhen must carry real content; a cold executor cannot work without them`
          );
        }
      }
    }
  });
  return errors;
}
function convergeApply(paths, input, out, warn, reportDrafts = true, requireBrief = false) {
  const decisions = input.map(withTaskDefaults);
  const manifestSrc = readFileSync10(paths.manifest, "utf8");
  const manifestBlocks = parseSimpleBlocks(manifestSrc, warn);
  const archiveSrc = existsSync11(paths.archive) ? readFileSync10(paths.archive, "utf8") : "";
  const archiveBlocks = parseSimpleBlocks(archiveSrc, warn);
  const forbiddenIds = new Set(manifestBlocks.filter((b) => b.status === "forbidden").map((b) => b.id));
  const knownIds = new Set([...manifestBlocks, ...archiveBlocks].map((b) => b.id));
  const errors = [...validateDecisions(decisions, requireBrief), ...validateDraftReferences(paths.draftsDir, decisions)];
  if (errors.length) {
    throw new BoardRejected(
      `save: rejected, nothing written:
${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
  const refs = new Set(decisions.map((t) => t.ref));
  const batchDepsOf = /* @__PURE__ */ new Map();
  const depErrors = [];
  for (const t of decisions) {
    const batchRefs = [];
    for (const d of t.deps ?? []) {
      if (typeof d !== "string" || !d.trim()) {
        depErrors.push(
          `@${t.ref}: dep ${JSON.stringify(d)} must be a non-empty string -- an existing task id, or "@<ref>" for a task in this batch`
        );
        continue;
      }
      if (d.startsWith("@")) {
        const r = d.slice(1);
        if (!refs.has(r)) depErrors.push(`@${t.ref}: dep "${d}" does not resolve to any ref in this batch`);
        else batchRefs.push(r);
      } else if (!TASK_ID_RE.test(d)) {
        depErrors.push(`@${t.ref}: dep ${malformedIdMessage(d)}`);
      } else if (!knownIds.has(d)) {
        depErrors.push(`@${t.ref}: unknown dep id "${d}" -- not found in manifest or TASKS_ARCHIVE.md`);
      } else if (forbiddenIds.has(d)) {
        depErrors.push(`@${t.ref}: dep "${d}" is [forbidden] -- permanently unsatisfiable`);
      }
    }
    batchDepsOf.set(t.ref, batchRefs);
  }
  const cycle = findRefCycle(
    decisions.map((t) => t.ref),
    (r) => batchDepsOf.get(r) ?? []
  );
  if (cycle) depErrors.push(`dependency cycle among batch refs: ${cycle.map((r) => `@${r}`).join(" -> ")}`);
  if (depErrors.length) {
    throw new BoardRejected(
      `save: rejected, nothing written:
${depErrors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
  const refToId = /* @__PURE__ */ new Map();
  const skipped = [];
  const toCreate = [];
  for (const t of decisions) {
    const existingId = findExisting(t.title, t.do, manifestBlocks, archiveBlocks);
    if (existingId) {
      refToId.set(t.ref, existingId);
      skipped.push({ ref: t.ref, id: existingId });
    } else {
      toCreate.push(t);
    }
  }
  const order = topoOrder(toCreate, batchDepsOf);
  const mintedIds = new Set(knownIds);
  const briefIds = briefFileIds(paths.tasksDir);
  const today = todayLocalDate();
  for (const t of order) {
    const id = mintTaskId(mintedIds);
    assertFreshId(id, mintedIds, briefIds);
    mintedIds.add(id);
    refToId.set(t.ref, id);
  }
  const badIds = [...refToId.entries()].filter(([, id]) => !TASK_ID_RE.test(id));
  if (badIds.length) {
    throw new BoardRejected(
      `save: rejected, nothing written:
${badIds.map(([ref, id]) => `  - @${ref}: ${malformedIdMessage(id)}`).join("\n")}`
    );
  }
  if (order.length) {
    const newBlocksText = order.map((t) => renderBlock(t, refToId, today)).join("\n\n");
    const merged = mergeManifest(manifestSrc, newBlocksText, order.length);
    if (merged === null) {
      throw new BoardRejected("save: refused -- header-count guard failed, manifest left untouched");
    }
    writeFileAtomic(paths.manifest, merged, "converge");
  }
  const briefsWritten = [];
  mkdirSync7(paths.tasksDir, { recursive: true });
  for (const t of decisions) {
    if (!t.brief) continue;
    const id = refToId.get(t.ref);
    const path = join9(paths.tasksDir, `${id}.md`);
    const archivedPath = join9(paths.tasksDir, "archive", `${id}.md`);
    if (!existsSync11(path) && !existsSync11(archivedPath)) {
      writeFileSync7(path, briefText(t.brief));
      briefsWritten.push(path);
    }
  }
  const consumedNames = [...new Set(decisions.map((t) => t.draft).filter((name) => Boolean(name)))];
  const draftsMoved = consumedDrafts(paths.draftsDir, consumedNames);
  const stillPending = draftNames(paths.draftsDir);
  const created = order.map((t) => ({ id: refToId.get(t.ref), title: t.title }));
  if (created.length) {
    out(`created ${created.length} task(s):`);
    for (const c of created) out(`  ${c.id}  ${c.title}`);
  } else {
    out("created 0 tasks.");
  }
  if (skipped.length) {
    out(`skipped (already applied): ${skipped.map((s) => `@${s.ref} -> ${s.id}`).join(", ")}`);
  }
  if (briefsWritten.length) {
    out("briefs written:");
    for (const p of briefsWritten) out(`  ${p}`);
  } else {
    out("briefs written: none");
  }
  if (reportDrafts) {
    if (draftsMoved.length) {
      out(`drafts archived: ${draftsMoved.length}`);
      for (const name of draftsMoved) out(`  ${name}`);
    } else {
      out("drafts archived: none (no task declared a `draft:`)");
    }
    if (stillPending.length) {
      out(`drafts STILL PENDING: ${stillPending.length} -- not touched by this batch`);
      for (const name of stillPending) out(`  ${name}`);
    }
  }
  return { created, skipped, briefsWritten, draftsMoved, stillPending };
}
function convergeApplyUnderLock(startDir, decisions, out, warn) {
  const paths = resolveBoard(startDir);
  if (!existsSync11(paths.manifest)) {
    throw new BoardRejected(`save: no manifest under ${paths.root} -- nothing written`);
  }
  const draftErrors = validateDraftReferences(paths.draftsDir, decisions);
  if (draftErrors.length) {
    throw new BoardRejected(`save: rejected, nothing written:
${draftErrors.map((error) => `  - ${error}`).join("\n")}`);
  }
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new BoardRejected("save: reconcile lock busy -- nothing written");
  }
  try {
    return convergeApply(paths, decisions, out, warn);
  } finally {
    unlock(paths.lock);
  }
}
var SET_ORDER = [
  "created",
  "deps",
  "exec",
  "model",
  "effort",
  "reasoning",
  "priority",
  "path",
  "area",
  "blocker",
  "created-by",
  "from",
  "do",
  "done-when",
  "why"
];
var HEADER_PREFIX_RE = /^(## \S+ \[[^\]]*\])(?: .*)?$/;
function setHeaderTitle(lines, start, newTitle) {
  const m = HEADER_PREFIX_RE.exec(lines[start]);
  if (!m) {
    throw new BoardRejected(
      `set: internal: header line ${start + 1} doesn't match the expected "## <id> [<status>] <title>" shape, refusing`
    );
  }
  lines[start] = `${m[1]} ${newTitle}`;
}
var DONE_WHEN_HEADING_RE = /^## Done-when\s*$/;
var SECTION_HEADING_RE = /^## /;
function replaceDoneWhenBody(src, newBody) {
  let lines = src.split("\n");
  if (src.endsWith("\n")) lines = lines.slice(0, -1);
  const hIdx = lines.findIndex((l) => DONE_WHEN_HEADING_RE.test(l));
  if (hIdx === -1) return null;
  let bodyStart = hIdx + 1;
  if (bodyStart < lines.length && /^<!--.*-->$/.test(lines[bodyStart].trim())) bodyStart++;
  let end = bodyStart;
  while (end < lines.length && !SECTION_HEADING_RE.test(lines[end])) end++;
  let trimEnd = end;
  while (trimEnd > bodyStart && lines[trimEnd - 1].trim() === "") trimEnd--;
  const out = [...lines.slice(0, bodyStart), newBody, ...lines.slice(trimEnd)];
  return `${out.join("\n")}
`;
}
function coreEnd(lines, start, end) {
  let e = end;
  while (e > start + 1) {
    const t = lines[e - 1].trim();
    if (t === "" || /^<!--.*-->$/.test(t)) e--;
    else break;
  }
  return e;
}
function fieldRe(name) {
  return new RegExp(`^${name}:(\\s|$)`);
}
function currentValue(lines, start, end, name) {
  const re = fieldRe(name);
  const fenced = fencedLineFlags(lines);
  for (let i = start + 1; i < end; i++) {
    if (!fenced[i] && re.test(lines[i])) return lines[i].replace(re, "").trim();
  }
  return null;
}
function upsertField(lines, start, end, name, value) {
  const re = fieldRe(name);
  const fenced = fencedLineFlags(lines);
  let idx = -1;
  for (let i = start + 1; i < end; i++) {
    if (!fenced[i] && re.test(lines[i])) {
      idx = i;
      break;
    }
  }
  for (let i = end - 1; i > start; i--) {
    if (!fenced[i] && re.test(lines[i]) && i !== idx) {
      lines.splice(i, 1);
      end--;
    }
  }
  if (value === null) {
    if (idx !== -1) {
      lines.splice(idx, 1);
      end--;
    }
    return end;
  }
  const line = `${name}: ${value}`;
  if (idx !== -1) {
    lines[idx] = line;
    return end;
  }
  const myPos = SET_ORDER.indexOf(name);
  const fencedNow = fencedLineFlags(lines);
  let insertAt = start + 1;
  for (let i = start + 1; i < end; i++) {
    if (fencedNow[i]) continue;
    const m = /^([a-z-]+):/.exec(lines[i]);
    if (!m) continue;
    const pos = SET_ORDER.indexOf(m[1]);
    if (pos !== -1 && pos < myPos) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, line);
  return end + 1;
}
function validateFieldPair(changes, current) {
  const errors = [];
  const exec = changes.exec ?? current.exec ?? "agent";
  const modelRaw = changes.model ?? current.model ?? "-";
  if (changes.exec !== void 0 && !VALID_EXEC.has(changes.exec)) {
    errors.push(`exec must be one of ${[...VALID_EXEC].join("|")}`);
  }
  if (changes.model !== void 0 && changes.model !== "-" && !VALID_MODELS.has(changes.model)) {
    errors.push(`model must be one of ${[...VALID_MODELS].join("|")} or "-"`);
  }
  if (changes.priority !== void 0 && !VALID_PRIORITIES.has(changes.priority)) {
    errors.push("priority must be p0|p1|p2");
  }
  if (changes.effort !== void 0 && !VALID_EFFORT.has(changes.effort)) {
    errors.push("effort must be S|M|L");
  }
  if (changes.reasoning !== void 0 && changes.reasoning !== "-" && !VALID_REASONING.has(changes.reasoning)) {
    errors.push(`reasoning must be one of ${REASONING_LEVELS.join("|")} or "-"`);
  }
  const reasoningAfter = changes.reasoning === void 0 ? current.reasoning : changes.reasoning === "-" ? null : changes.reasoning;
  if (reasoningAfter && exec !== "agent") {
    errors.push(`reasoning applies only to exec: agent (got exec: ${exec}); pass reasoning -`);
  }
  if (exec === "manual" && modelRaw !== "-") {
    errors.push(`exec: manual requires model "-" (got ${modelRaw}); pass model -`);
  }
  if (exec !== "manual" && !VALID_MODELS.has(modelRaw)) {
    errors.push(`exec: ${exec} requires a real model tier (got ${modelRaw})`);
  }
  return errors;
}
function setFields(paths, rawId, changes, reason) {
  if (RECURRING_ID_RE.test(rawId)) {
    throw new BoardRejected(
      `set: ${rawId} is a recurring block -- set only edits task blocks; recurring exec/model tiers live in the R-block itself`
    );
  }
  const src = readFileSync10(paths.manifest, "utf8");
  const lines = src.split("\n");
  const { blocks, warnings } = parseManifestBlocks(src);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const liveIds = new Set(blocks.filter((b) => TASK_ID_RE.test(b.id)).map((b) => b.id));
  const archived = archivedIds(paths.archive);
  const id = resolveIdPrefix(rawId, /* @__PURE__ */ new Set([...liveIds, ...archived]));
  if (id === null) {
    throw new BoardRejected(
      `set: no such task: ${rawId}${TASK_ID_RE.test(rawId) ? "" : ` (${malformedIdMessage(rawId)})`}`
    );
  }
  if (!liveIds.has(id)) throw new BoardRejected(`set: ${id} is archived -- archived tasks are never re-tiered`);
  const block = blocks.find((b) => b.id === id);
  const effective = fold(paths.manifest, paths).find((t) => t.id === id)?.status ?? block.status;
  if (effective === "forbidden") throw new BoardRejected(`set: ${id} is [forbidden] -- tombstone, refusing`);
  if (effective === "done") throw new BoardRejected(`set: ${id} is effectively [done] -- refusing to re-tier a closed task`);
  const start = block.start;
  let end = coreEnd(lines, block.start, block.end);
  const fieldErrors = validateFieldPair(changes, {
    exec: currentValue(lines, start, end, "exec"),
    model: currentValue(lines, start, end, "model"),
    reasoning: currentValue(lines, start, end, "reasoning")
  });
  if (fieldErrors.length) throw new BoardRejected(`set: ${fieldErrors[0]}`);
  if (changes.title !== void 0 && !collapseWhitespace(changes.title)) {
    throw new BoardRejected("set: --title must not be empty");
  }
  if (changes.do !== void 0 && !collapseWhitespace(changes.do)) {
    throw new BoardRejected("set: --do must not be empty");
  }
  if (changes.doneWhen !== void 0 && !collapseWhitespace(changes.doneWhen)) {
    throw new BoardRejected("set: --done-when must not be empty");
  }
  if (changes.why !== void 0 && changes.why !== "-" && !collapseWhitespace(changes.why)) {
    throw new BoardRejected('set: --why must not be empty (pass "-" to remove it)');
  }
  if ((changes.do !== void 0 || changes.doneWhen !== void 0) && !reason) {
    throw new BoardRejected(
      "set: --reason is required when --do or --done-when is present -- narrowing either is a scope cut"
    );
  }
  if (effective === "doing") {
    process.stderr.write(`set: ${id} is [doing] -- a dispatched worker may still hold the old text
`);
  }
  const before = countAllHeaders(lines.join("\n"));
  const report = [];
  const journalFields = [];
  if (changes.title !== void 0) {
    const newTitle = collapseWhitespace(changes.title);
    const prevTitle = block.title;
    if (prevTitle !== newTitle) {
      setHeaderTitle(lines, start, newTitle);
      report.push(`title "${prevTitle}" -> "${newTitle}"`);
      journalFields.push({ field: "title", oldV: prevTitle || "-", newV: newTitle });
    }
  }
  if (changes.exec !== void 0) {
    const prev = currentValue(lines, start, end, "exec");
    end = upsertField(lines, start, end, "exec", changes.exec);
    if (prev !== changes.exec) {
      report.push(`exec ${prev ?? "(none)"} -> ${changes.exec}`);
      journalFields.push({ field: "exec", oldV: prev ?? "-", newV: changes.exec });
    }
  }
  if (changes.model !== void 0) {
    const prev = currentValue(lines, start, end, "model");
    end = upsertField(lines, start, end, "model", changes.model);
    if (prev !== changes.model) {
      report.push(`model ${prev ?? "(none)"} -> ${changes.model}`);
      journalFields.push({ field: "model", oldV: prev ?? "-", newV: changes.model });
    }
  }
  if (changes.effort !== void 0) {
    const prev = currentValue(lines, start, end, "effort");
    end = upsertField(lines, start, end, "effort", changes.effort);
    if (prev !== changes.effort) {
      report.push(`effort ${prev ?? "(none)"} -> ${changes.effort}`);
      journalFields.push({ field: "effort", oldV: prev ?? "-", newV: changes.effort });
    }
  }
  if (changes.reasoning !== void 0) {
    const prev = currentValue(lines, start, end, "reasoning");
    const next = changes.reasoning === "-" ? null : changes.reasoning;
    end = upsertField(lines, start, end, "reasoning", next);
    if (prev !== next) {
      report.push(`reasoning ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
      journalFields.push({ field: "reasoning", oldV: prev ?? "-", newV: next ?? "-" });
    }
  }
  if (changes.priority !== void 0) {
    const prev = currentValue(lines, start, end, "priority") ?? "p1";
    end = upsertField(lines, start, end, "priority", changes.priority === "p1" ? null : changes.priority);
    if (prev !== changes.priority) {
      report.push(`priority ${prev} -> ${changes.priority}`);
      journalFields.push({ field: "priority", oldV: prev, newV: changes.priority });
    }
  }
  if (changes.do !== void 0) {
    const prev = currentValue(lines, start, end, "do");
    const newVal = collapseWhitespace(changes.do);
    end = upsertField(lines, start, end, "do", newVal);
    if (prev !== newVal) {
      report.push(`do ${prev ?? "(none)"} -> ${newVal}`);
      journalFields.push({ field: "do", oldV: prev ?? "-", newV: newVal });
    }
  }
  if (changes.doneWhen !== void 0) {
    const prev = currentValue(lines, start, end, "done-when");
    const newVal = collapseWhitespace(changes.doneWhen);
    end = upsertField(lines, start, end, "done-when", newVal);
    if (prev !== newVal) {
      report.push(`done-when ${prev ?? "(none)"} -> ${newVal}`);
      journalFields.push({ field: "done-when", oldV: prev ?? "-", newV: newVal });
    }
  }
  if (changes.why !== void 0) {
    const prev = currentValue(lines, start, end, "why");
    const newVal = changes.why === "-" ? null : collapseWhitespace(changes.why);
    upsertField(lines, start, end, "why", newVal);
    if (prev !== newVal) {
      report.push(`why ${prev ?? "(none)"} -> ${newVal ?? "-"}`);
      journalFields.push({ field: "why", oldV: prev ?? "-", newV: newVal ?? "-" });
    }
  }
  if (countAllHeaders(lines.join("\n")) !== before) {
    throw new BoardRejected("set: refused -- header-count guard failed, manifest left untouched");
  }
  if (report.length === 0) return `${id}: nothing to change`;
  writeFileAtomic(paths.manifest, lines.join("\n"), "set");
  const briefPath = join9(paths.tasksDir, `${id}.md`);
  if (changes.do !== void 0 && existsSync11(briefPath)) {
    process.stderr.write(`set: ${briefPath} may now disagree with do: -- --do never rewrites the brief's Intent
`);
  }
  if (changes.doneWhen !== void 0) {
    const newVal = collapseWhitespace(changes.doneWhen);
    if (!existsSync11(briefPath)) {
      process.stderr.write(`set: no brief at ${briefPath} -- done-when updated in the manifest only
`);
    } else {
      const updated = replaceDoneWhenBody(readFileSync10(briefPath, "utf8"), newVal);
      if (updated === null) {
        process.stderr.write(`set: ${briefPath} has no ## Done-when section -- done-when updated in the manifest only
`);
      } else {
        writeFileAtomic(briefPath, updated, "tmp");
      }
    }
  }
  if (journalFields.length > 0) {
    const title = `set ${id}: ${journalFields.map((f) => f.field).join(", ")}${reason ? ` -- ${collapseWhitespace(reason)}` : ""}`;
    const body = journalFields.flatMap((f) => [`${f.field} old: ${f.oldV}`, `${f.field} new: ${f.newV}`]).join("\n");
    const event = {
      kind: "note",
      id,
      ts: epochToLocalIso(Math.floor(Date.now() / 1e3)),
      by: agentTag(),
      title,
      body
    };
    try {
      appendJournalEvents(paths, [event]);
    } catch (e) {
      process.stderr.write(`set: manifest written but the journal append FAILED -- ${e.message}
`);
      process.exitCode = 1;
    }
  }
  return `${id}: ${report.join("; ")}`;
}
var BATCH_ENTRY_FIELDS = ["id", "model", "reasoning", "exec", "priority", "effort"];
function setFieldsBatch(paths, rawEntries, by, out) {
  if (!by || !by.trim()) {
    throw new BoardRejected(
      "set --batch: --by <model-id> is required for --batch -- a batch with no judge named is not an audit trail"
    );
  }
  const src = readFileSync10(paths.manifest, "utf8");
  const lines = src.split("\n");
  const { blocks, warnings } = parseManifestBlocks(src);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const liveIds = new Set(blocks.filter((b) => TASK_ID_RE.test(b.id)).map((b) => b.id));
  const archived = archivedIds(paths.archive);
  const knownIds = /* @__PURE__ */ new Set([...liveIds, ...archived]);
  const effectiveStatus = new Map(fold(paths.manifest, paths).map((t) => [t.id, t.status]));
  const errors = [];
  const seenIds = /* @__PURE__ */ new Set();
  const plan = [];
  rawEntries.forEach((raw, i) => {
    const hasId = !!raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.id === "string" && raw.id !== "";
    const tag = hasId ? String(raw.id) : `#${i}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${tag}: entry must be an object`);
      return;
    }
    if (!hasId) {
      errors.push(`${tag}: "id" is required and must be a non-empty string`);
      return;
    }
    const entry = raw;
    const rawId = entry.id;
    const entryErrors = [];
    const changes = {};
    for (const field of ["model", "reasoning", "exec", "priority", "effort"]) {
      const v = entry[field];
      if (v === void 0) continue;
      if (typeof v !== "string") {
        entryErrors.push(`${rawId}: "${field}" must be a string (got ${JSON.stringify(v)})`);
        continue;
      }
      changes[field] = v;
    }
    for (const k of Object.keys(entry)) {
      if (!BATCH_ENTRY_FIELDS.includes(k)) entryErrors.push(`${rawId}: unknown field "${k}"`);
    }
    if (Object.keys(changes).length === 0 && entryErrors.length === 0) {
      entryErrors.push(`${rawId}: no changes specified (need at least one of model/reasoning/exec/priority/effort)`);
    }
    if (RECURRING_ID_RE.test(rawId)) {
      entryErrors.push(
        `${rawId} is a recurring block -- set only edits task blocks; recurring exec/model tiers live in the R-block itself`
      );
      errors.push(...entryErrors);
      return;
    }
    let id;
    try {
      id = resolveIdPrefix(rawId, knownIds);
    } catch (e) {
      if (!(e instanceof AmbiguousIdError)) throw e;
      entryErrors.push(`${rawId}: ${e.message}`);
      errors.push(...entryErrors);
      return;
    }
    if (id === null) {
      entryErrors.push(`no such task: ${rawId}${TASK_ID_RE.test(rawId) ? "" : ` (${malformedIdMessage(rawId)})`}`);
      errors.push(...entryErrors);
      return;
    }
    if (seenIds.has(id)) {
      entryErrors.push(
        `${id}: duplicate id in batch (resolved twice, possibly via different prefixes) -- each id may be changed once per batch`
      );
      errors.push(...entryErrors);
      return;
    }
    seenIds.add(id);
    if (!liveIds.has(id)) {
      entryErrors.push(`${id} is archived -- archived tasks are never re-tiered`);
      errors.push(...entryErrors);
      return;
    }
    const block = blocks.find((b) => b.id === id);
    const eff = effectiveStatus.get(id) ?? block.status;
    if (eff === "forbidden") {
      entryErrors.push(`${id} is [forbidden] -- tombstone, refusing`);
      errors.push(...entryErrors);
      return;
    }
    if (eff === "done") {
      entryErrors.push(`${id} is effectively [done] -- refusing to re-tier a closed task`);
      errors.push(...entryErrors);
      return;
    }
    if (entryErrors.length) {
      errors.push(...entryErrors);
      return;
    }
    const start = block.start;
    const end = coreEnd(lines, block.start, block.end);
    const fieldErrors = validateFieldPair(changes, {
      exec: currentValue(lines, start, end, "exec"),
      model: currentValue(lines, start, end, "model"),
      reasoning: currentValue(lines, start, end, "reasoning")
    }).map((e) => `${id}: ${e}`);
    if (fieldErrors.length) {
      errors.push(...fieldErrors);
      return;
    }
    plan.push({ id, changes });
  });
  if (errors.length) {
    throw new BoardRejected(`set --batch: rejected, nothing written:
${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  const before = countAllHeaders(lines.join("\n"));
  const report = [];
  for (const { id, changes } of plan) {
    const { blocks: freshBlocks } = parseManifestBlocks(lines.join("\n"));
    const freshBlock = freshBlocks.find((b) => b.id === id);
    const start = freshBlock.start;
    let end = coreEnd(lines, freshBlock.start, freshBlock.end);
    const parts = [];
    if (changes.exec !== void 0) {
      const prev = currentValue(lines, start, end, "exec");
      end = upsertField(lines, start, end, "exec", changes.exec);
      parts.push(`exec ${prev ?? "(none)"} -> ${changes.exec}`);
    }
    if (changes.model !== void 0) {
      const prev = currentValue(lines, start, end, "model");
      end = upsertField(lines, start, end, "model", changes.model);
      parts.push(`model ${prev ?? "(none)"} -> ${changes.model}`);
    }
    if (changes.effort !== void 0) {
      const prev = currentValue(lines, start, end, "effort");
      end = upsertField(lines, start, end, "effort", changes.effort);
      parts.push(`effort ${prev ?? "(none)"} -> ${changes.effort}`);
    }
    if (changes.reasoning !== void 0) {
      const prev = currentValue(lines, start, end, "reasoning");
      const next = changes.reasoning === "-" ? null : changes.reasoning;
      end = upsertField(lines, start, end, "reasoning", next);
      parts.push(`reasoning ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
    }
    if (changes.priority !== void 0) {
      const prev = currentValue(lines, start, end, "priority") ?? "p1";
      upsertField(lines, start, end, "priority", changes.priority === "p1" ? null : changes.priority);
      parts.push(`priority ${prev} -> ${changes.priority}`);
    }
    report.push(`${id}: ${parts.length ? parts.join("; ") : "nothing to change"}`);
  }
  if (countAllHeaders(lines.join("\n")) !== before) {
    throw new BoardRejected("set --batch: refused -- header-count guard failed, manifest left untouched");
  }
  writeFileAtomic(paths.manifest, lines.join("\n"), "set");
  for (const r of report) out(r);
  const ids = plan.map((p) => p.id);
  const title = `retiered ${plan.length} task${plan.length === 1 ? "" : "s"} by ${by}`;
  const event = {
    kind: "note",
    id: "-",
    ts: epochToLocalIso(Math.floor(Date.now() / 1e3)),
    by: agentTag(),
    title,
    body: ids.join(", ")
  };
  try {
    appendJournalEvents(paths, [event]);
    out(`journal: ${title}`);
  } catch (e) {
    process.stderr.write(`set --batch: manifest written but the journal append FAILED -- ${e.message}
`);
    process.stderr.write(
      `set --batch: affected ids (already written to the manifest): ${ids.join(", ")}; judged-by: ${by}
`
    );
    process.exitCode = 1;
  }
}
function setBlocker(paths, rawId, reason) {
  if (RECURRING_ID_RE.test(rawId)) {
    throw new BoardRejected(
      `blocker: ${rawId} is a recurring block -- blocker only edits task blocks; recurring exec/model tiers live in the R-block itself`
    );
  }
  const src = readFileSync10(paths.manifest, "utf8");
  const lines = src.split("\n");
  const { blocks, warnings } = parseManifestBlocks(src);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const liveIds = new Set(blocks.filter((b) => TASK_ID_RE.test(b.id)).map((b) => b.id));
  const archived = archivedIds(paths.archive);
  const id = resolveIdPrefix(rawId, /* @__PURE__ */ new Set([...liveIds, ...archived]));
  if (id === null) {
    throw new BoardRejected(
      `blocker: no such task: ${rawId}${TASK_ID_RE.test(rawId) ? "" : ` (${malformedIdMessage(rawId)})`}`
    );
  }
  if (!liveIds.has(id)) throw new BoardRejected(`blocker: ${id} is archived -- archived tasks are never re-blocked`);
  const block = blocks.find((b) => b.id === id);
  if (block.status === "forbidden") throw new BoardRejected(`blocker: ${id} is [forbidden] -- tombstone, refusing`);
  if (block.status === "done") throw new BoardRejected(`blocker: ${id} is [done] -- refusing to block a finished task`);
  const dupOf = block.fields.get("duplicate-of")?.trim();
  if (dupOf && dupOf !== "-") {
    throw new BoardRejected(`blocker: ${id} is duplicate-of ${dupOf} -- refusing to edit a merged task`);
  }
  const start = block.start;
  const end = coreEnd(lines, block.start, block.end);
  const before = countAllHeaders(lines.join("\n"));
  if (reason !== null) {
    const collapsed = reason.replace(/\s+/g, " ").trim();
    if (!collapsed) throw new BoardRejected("blocker: reason must be non-empty");
    upsertField(lines, start, end, "blocker", collapsed);
    if (countAllHeaders(lines.join("\n")) !== before) {
      throw new BoardRejected("blocker: refused -- header-count guard failed, manifest left untouched");
    }
    writeFileAtomic(paths.manifest, lines.join("\n"), "blocker");
    return `${id} blocker set: ${collapsed}`;
  }
  if (currentValue(lines, start, end, "blocker") === null) {
    throw new BoardRejected(`blocker: ${id} has no blocker: line -- nothing to unblock`);
  }
  upsertField(lines, start, end, "blocker", null);
  if (countAllHeaders(lines.join("\n")) !== before) {
    throw new BoardRejected("blocker: refused -- header-count guard failed, manifest left untouched");
  }
  writeFileAtomic(paths.manifest, lines.join("\n"), "blocker");
  return `${id} blocker cleared`;
}
function blockTaskUnderLock(startDir, rawId, reason) {
  const paths = resolveBoard(startDir);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new BoardRejected(`blocker: reconcile lock busy -- ${rawId} left without a blocker`);
  }
  try {
    return setBlocker(paths, rawId, reason);
  } finally {
    unlock(paths.lock);
  }
}
var DEPS_LINE_RE = /^deps:(\s|$)/;
var DUP_OF_LINE_RE = /^duplicate-of:(\s|$)/;
function readManifestLines(manifest) {
  const src = readFileSync10(manifest, "utf8");
  const raw = src.split("\n");
  return src.endsWith("\n") ? raw.slice(0, -1) : raw;
}
function findDepsLine(lines, start, end) {
  const fenced = fencedLineFlags(lines);
  for (let i = start + 1; i < end; i++) {
    if (!fenced[i] && DEPS_LINE_RE.test(lines[i])) {
      return { idx: i, value: lines[i].replace(/^deps:\s*/, "").trim() };
    }
  }
  return null;
}
function manifestIdSet(lines) {
  return new Set(parseManifestBlocks(lines.join("\n"), TASK_ID_RE).blocks.map((b) => b.id));
}
function depsGraph(lines) {
  const g = /* @__PURE__ */ new Map();
  for (const b of parseManifestBlocks(lines.join("\n"), TASK_ID_RE).blocks) {
    const val = b.fields.get("deps")?.trim();
    g.set(b.id, !val || val === "-" ? [] : val.split(/[,\s]+/).filter(Boolean));
  }
  return g;
}
function findDepCycle(graph, id) {
  const stack = [];
  const visiting = /* @__PURE__ */ new Set();
  const walk = (node) => {
    if (node === id && stack.length > 0) return [...stack, node];
    if (visiting.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      const found = walk(dep);
      if (found) return found;
    }
    stack.pop();
    return null;
  };
  return walk(id);
}
function resolveBoardId(paths, lines, raw) {
  const ids = manifestIdSet(lines);
  for (const id of archivedIds(paths.archive)) ids.add(id);
  const resolved = resolveIdPrefix(raw, ids);
  if (resolved === null) throw new BoardRejected(`no such task: ${raw}`);
  return resolved;
}
function showDeps(paths, id) {
  const lines = readManifestLines(paths.manifest);
  const resolvedId = resolveBoardId(paths, lines, id);
  const range = blockRange(lines, resolvedId);
  if (!range) throw new BoardRejected(`no such task: ${resolvedId}`);
  const existing = findDepsLine(lines, range.start, range.end);
  return `${resolvedId} deps: ${existing ? existing.value : "(no deps: line)"}`;
}
function setDeps(paths, id, rawList) {
  const lines = readManifestLines(paths.manifest);
  const resolvedId = resolveBoardId(paths, lines, id);
  const range = blockRange(lines, resolvedId);
  if (!range) throw new BoardRejected(`no such task: ${resolvedId}`);
  let newValue;
  if (rawList === "-") {
    newValue = "-";
  } else {
    const rawDeps = [...new Set(rawList.split(/[,\s]+/).filter(Boolean))];
    if (rawDeps.length === 0) throw new BoardRejected("empty deps list -- use '-' to clear");
    const allIds = manifestIdSet(lines);
    for (const a of archivedIds(paths.archive)) allIds.add(a);
    const deps = [];
    for (const d of rawDeps) {
      const resolvedDep = resolveIdPrefix(d, allIds);
      if (resolvedDep === null) throw new BoardRejected(`unknown dep: ${d} (not in manifest or archive)`);
      if (resolvedDep === resolvedId) throw new BoardRejected(`${resolvedId} cannot depend on itself`);
      deps.push(resolvedDep);
    }
    newValue = deps.join(", ");
  }
  const existing = findDepsLine(lines, range.start, range.end);
  const newLine = `deps: ${newValue}`;
  const withoutDeps = dropFieldLines(lines, range.start, range.end, DEPS_LINE_RE);
  const next = [...withoutDeps.slice(0, range.start + 1), newLine, ...withoutDeps.slice(range.start + 1)];
  if (newValue !== "-") {
    const cycle = findDepCycle(depsGraph(next), resolvedId);
    if (cycle) throw new BoardRejected(`dependency cycle: ${cycle.join(" -> ")}`);
  }
  if (countHeaders(next) !== countHeaders(lines)) {
    throw new BoardRejected("deps: refused -- header-count guard failed, manifest left untouched");
  }
  writeFileAtomic(paths.manifest, next.join("\n") + "\n", "deps");
  return `${resolvedId}: deps ${existing ? `"${existing.value}" -> ` : "set -> "}"${newValue}"`;
}
function buildDuplicateOfMap(blocks) {
  const map = /* @__PURE__ */ new Map();
  for (const b of blocks) {
    const val = b.fields.get("duplicate-of")?.trim();
    if (val && val !== "-") map.set(b.id, val);
  }
  return map;
}
function resolveDuplicateOf(dupOfMap, id) {
  let cur = id;
  const seen = /* @__PURE__ */ new Set();
  while (dupOfMap.has(cur)) {
    if (seen.has(cur)) return { target: cur, cycle: true };
    seen.add(cur);
    cur = dupOfMap.get(cur);
  }
  return { target: cur, cycle: false };
}
function wouldCreateDuplicateCycle(dupOfMap, dupId, survivorId) {
  const path = [dupId, survivorId];
  const seen = /* @__PURE__ */ new Set([dupId, survivorId]);
  let cur = survivorId;
  while (dupOfMap.has(cur)) {
    const next = dupOfMap.get(cur);
    if (next === dupId) {
      path.push(next);
      return path;
    }
    if (seen.has(next)) break;
    seen.add(next);
    path.push(next);
    cur = next;
  }
  return null;
}
function idUniverse(paths) {
  const liveIds = new Set(
    parseManifestBlocks(readFileSync10(paths.manifest, "utf8"), TASK_ID_RE).blocks.map((b) => b.id)
  );
  return { liveIds, archiveIds: archivedIds(paths.archive) };
}
function mergeIds(paths, dupRaw, survivorRaw) {
  const { liveIds, archiveIds } = idUniverse(paths);
  const allIds = /* @__PURE__ */ new Set([...liveIds, ...archiveIds]);
  const dupId = resolveIdPrefix(dupRaw, allIds);
  if (dupId === null) throw new BoardRejected(`merge: no such task: ${dupRaw} (checked manifest + archive)`);
  const survivorId = resolveIdPrefix(survivorRaw, allIds);
  if (survivorId === null) {
    throw new BoardRejected(`merge: no such task: ${survivorRaw} (checked manifest + archive)`);
  }
  if (dupId === survivorId) throw new BoardRejected(`merge: cannot merge ${dupId} into itself`);
  const already = findLedgerEntry(paths.ledger, dupId, survivorId);
  if (already && already.verdict === "rejected") {
    throw new BoardRejected(
      `merge: ${dupId} / ${survivorId} were already reviewed and REJECTED as duplicates on ${already.date} -- not re-merging automatically; edit the ledger by hand if that verdict was wrong`
    );
  }
  const { blocks, warnings } = parseManifestBlocks(readFileSync10(paths.manifest, "utf8"), TASK_ID_RE);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const dupOfMap = buildDuplicateOfMap(blocks);
  const cyclePath = wouldCreateDuplicateCycle(dupOfMap, dupId, survivorId);
  if (cyclePath) {
    throw new BoardRejected(`merge: refusing -- would create a duplicate-of cycle: ${cyclePath.join(" -> ")}`);
  }
  if (dupOfMap.has(survivorId)) {
    const { target, cycle } = resolveDuplicateOf(dupOfMap, survivorId);
    process.stderr.write(
      `merge: note -- ${survivorId} is itself duplicate-of ${target}${cycle ? " (cycle detected in ITS chain)" : ""}; ${dupId} will resolve through the full chain to ${target} at read time
`
    );
  }
  const dupIsLive = liveIds.has(dupId);
  const today = todayLocalDate();
  if (dupIsLive) {
    const lines = readManifestLines(paths.manifest);
    const beforeCount = countHeaders(lines);
    const range = blockRange(lines, dupId);
    if (!range) {
      throw new BoardRejected(
        `merge: internal: ${dupId} vanished from the manifest under lock -- refusing, nothing written`
      );
    }
    const cleared = dropFieldLines(lines, range.start, range.end, DUP_OF_LINE_RE);
    const clearedRange = blockRange(cleared, dupId);
    const next = [
      ...cleared.slice(0, clearedRange.start + 1),
      `duplicate-of: ${survivorId}`,
      ...cleared.slice(clearedRange.start + 1)
    ];
    if (countHeaders(next) !== beforeCount) {
      throw new BoardRejected("merge: refused -- header-count guard failed, manifest left untouched");
    }
    writeFileAtomic(paths.manifest, next.join("\n") + "\n", "merge");
  }
  appendLedgerEntry(paths.ledger, { a: dupId, b: survivorId, verdict: "merged", date: today });
  return dupIsLive ? `${dupId} -> duplicate-of ${survivorId} (ledger: merged ${today})` : `${dupId} is archived -- ledger-only merge recorded (${dupId} duplicate-of ${survivorId}, ${today}); archive left untouched (append-only, never rewritten)`;
}
function rejectIds(paths, aRaw, bRaw) {
  const { liveIds, archiveIds } = idUniverse(paths);
  const allIds = /* @__PURE__ */ new Set([...liveIds, ...archiveIds]);
  const a = resolveIdPrefix(aRaw, allIds);
  if (a === null) throw new BoardRejected(`merge: no such task: ${aRaw} (checked manifest + archive)`);
  const b = resolveIdPrefix(bRaw, allIds);
  if (b === null) throw new BoardRejected(`merge: no such task: ${bRaw} (checked manifest + archive)`);
  if (a === b) throw new BoardRejected(`merge: cannot reject a pair against itself: ${a}`);
  const already = findLedgerEntry(paths.ledger, a, b);
  if (already && already.verdict === "merged") {
    throw new BoardRejected(
      `merge: ${a} / ${b} were already MERGED (${already.a} duplicate-of ${already.b}, ${already.date}) -- not overwriting that verdict`
    );
  }
  const today = todayLocalDate();
  appendLedgerEntry(paths.ledger, { a, b, verdict: "rejected", date: today });
  return `${a} / ${b} -> ledger: rejected ${today} (this pair will not be re-raised)`;
}
function bornDoneBlock(id, desc, today, by) {
  let block = `## ${id} [done] ${desc}
`;
  block += `created: ${today}
`;
  block += "exec: manual\n";
  block += "model: -\n";
  if (by) block += `created-by: ${by}
`;
  block += `completed: ${today}
`;
  block += `do: ${desc}
`;
  block += "done-when: Done outside the task flow; logged retroactively.\n\n";
  return block;
}
function logDone(paths, descs, by) {
  const manifestSrc = existsSync11(paths.manifest) ? readFileSync10(paths.manifest, "utf8") : "";
  const archiveSrc = existsSync11(paths.archive) ? readFileSync10(paths.archive, "utf8") : archiveHeader(paths.root);
  const known = /* @__PURE__ */ new Set();
  for (const src of [manifestSrc, archiveSrc]) {
    const { blocks, warnings } = parseManifestBlocks(src, TASK_ID_RE);
    for (const w of warnings) process.stderr.write(`${w}
`);
    for (const b of blocks) known.add(b.id);
  }
  const briefIds = briefFileIds(paths.tasksDir);
  if (/[\r\n]/.test(by)) {
    throw new BoardRejected("log: --by must be a single line -- it renders as the created-by: line; nothing written");
  }
  for (const d of descs) {
    if (!d.trim()) throw new BoardRejected("log: a description must not be empty -- nothing written");
    if (/[\r\n]/.test(d)) {
      throw new BoardRejected(
        `log: a description must be a single line -- it renders as the header and do: line, and a newline would plant extra blocks in the archive: ${JSON.stringify(d.slice(0, 80))}; nothing written`
      );
    }
  }
  const today = todayLocalDate();
  const logged = [];
  let text = "";
  for (const d of descs) {
    const id = mintTaskId(known);
    assertFreshId(id, known, briefIds);
    known.add(id);
    const block = bornDoneBlock(id, d, today, by);
    const parsed = parseManifestBlocks(block, TASK_ID_RE).blocks;
    if (parsed.length !== 1 || parsed[0].id !== id) {
      throw new BoardRejected(
        `log: rejected, nothing written: ${JSON.stringify(d.slice(0, 80))} renders to ${parsed.length} block(s) instead of 1 -- the description is injecting manifest structure`
      );
    }
    text += block;
    logged.push({ id, desc: d });
  }
  appendToArchive(paths, text);
  return logged;
}

export {
  define_TASKBOARD_BUILD_default,
  boardEnv,
  manifestCandidates,
  repoRootStrict,
  submoduleScope,
  pathInScope,
  boardPathsFor,
  resolveBoard,
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
  IdClashError,
  AmbiguousIdError,
  resolveIdPrefix,
  writeFileAtomic,
  TASK_STATUSES,
  TASK_STATUS_SET,
  isTaskStatus,
  fencedLineFlags,
  nonBlankLineCount,
  looksLikeABoard,
  parseLegacyBoard,
  parseManifestBlocks,
  blockRange,
  lintManifest,
  migrateLegacySource,
  ensureMigrated,
  boardFormatLine,
  BoardFormatTooNew,
  boardFormatNotice,
  assertBoardWritable,
  collapseWhitespace,
  overlaySources,
  orderOverlayLines,
  appendStatus,
  readOverlayText,
  fold,
  logLines,
  normalizeHost,
  lock,
  unlock,
  lockAndMigrate,
  appendJournalEvents,
  deriveDayTitle,
  listJournalDaysFolded,
  readJournalDayFolded,
  reconcileDryRun,
  reconcileLocked,
  reconcile,
  ArchivePartialError,
  archivedIds,
  archiveAbortLabel,
  archiveLocked,
  draftNames,
  validateDraftReferences,
  gatherDrafts,
  writeDraft,
  BoardRejected,
  VALID_MODELS,
  VALID_EXEC,
  VALID_PRIORITIES,
  VALID_EFFORT,
  REASONING_LEVELS,
  VALID_REASONING,
  DEFAULT_TASK_EXEC,
  DEFAULT_TASK_MODEL,
  withTaskDefaults,
  WRITABLE_STATUSES,
  SCHEMA_TEXT,
  briefText,
  validatePathField,
  renderBlock,
  countAllHeaders,
  mergeManifest,
  validateDecisions,
  convergeApply,
  convergeApplyUnderLock,
  SET_ORDER,
  coreEnd,
  upsertField,
  validateFieldPair,
  setFields,
  setFieldsBatch,
  setBlocker,
  blockTaskUnderLock,
  findDepsLine,
  showDeps,
  setDeps,
  buildDuplicateOfMap,
  resolveDuplicateOf,
  wouldCreateDuplicateCycle,
  mergeIds,
  rejectIds,
  bornDoneBlock,
  logDone
};
