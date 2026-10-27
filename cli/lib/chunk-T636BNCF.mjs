#!/usr/bin/env node
import {
  isOwnerDecideTitle,
  missingDecideFields,
  sourceIssues,
  waitsOnError
} from "./chunk-7XHG2DEQ.mjs";
import {
  appendJournalEvents,
  lockAndMigrate,
  reconcileLocked,
  unlock
} from "./chunk-3V2BXNFG.mjs";
import {
  AmbiguousIdError,
  RECURRING_ID_RE,
  TASK_ID_RE,
  TASK_ID_SOURCE,
  agentTag,
  assertBoardWritable,
  assertFreshId,
  blockRange,
  boardEnv,
  boardPathsFor,
  briefFileIds,
  collapseWhitespace,
  countHeaders,
  dropFieldLines,
  epochToLocalIso,
  fencedLineFlags,
  fold,
  malformedIdMessage,
  mintTaskId,
  normalizeTaskPath,
  parseManifestBlocks,
  repoRoot,
  resolveBoard,
  resolveIdPrefix,
  scopeForBoard,
  todayLocalDate,
  writeFileAtomic
} from "./chunk-GIU6R332.mjs";

// src/tasks/boardWrite.ts
import { existsSync as existsSync5, mkdirSync as mkdirSync4, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "node:fs";
import { isAbsolute, join as join4 } from "node:path";

// src/tasks/boardArchive.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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
  if (!existsSync(archivePath)) return /* @__PURE__ */ new Set();
  return new Set(
    parseManifestBlocks(readFileSync(archivePath, "utf8"), TASK_ID_RE).blocks.map((b) => b.id)
  );
}
function archivedBlocks(archivePath) {
  if (!existsSync(archivePath)) return [];
  return parseManifestBlocks(readFileSync(archivePath, "utf8"), TASK_ID_RE).blocks;
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
function splitDone(src, keep) {
  const rawLines = src.split("\n");
  const lines = src.endsWith("\n") ? rawLines.slice(0, -1) : rawLines;
  const { blocks, warnings } = parseManifestBlocks(lines.join("\n"), TASK_ID_RE);
  for (const w of warnings) process.stderr.write(`${w}
`);
  const doneBlocks = blocks.filter((b) => b.status === "done" && (keep === void 0 || keep(b.id)));
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
  const brief = join(tasksDir, `${id}.md`);
  if (!existsSync(brief)) return "absent";
  const archiveDir = join(tasksDir, "archive");
  const dest = join(archiveDir, `${id}.md`);
  if (existsSync(dest)) {
    process.stderr.write(
      `archive: ${id} already has an archived brief -- left ${brief} in place rather than overwriting ${dest}
`
    );
    return "collision";
  }
  mkdirSync(archiveDir, { recursive: true });
  renameSync(brief, dest);
  return "moved";
}
function orphanBriefIds(paths) {
  if (!existsSync(paths.tasksDir)) return [];
  const archived = archivedIds(paths.archive);
  return readdirSync(paths.tasksDir).filter((f) => f.endsWith(".md") && archived.has(f.slice(0, -3))).map((f) => f.slice(0, -3)).sort();
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
  return `# Tasks Archive: ${basename(root)}

`;
}
function appendToArchive(paths, text) {
  mkdirSync(dirname(paths.archive), { recursive: true });
  const existing = existsSync(paths.archive) ? readFileSync(paths.archive, "utf8") : archiveHeader(paths.root);
  writeFileAtomic(paths.archive, existing + text, "arch");
}
function archiveLocked(paths, opts, out = (s) => process.stdout.write(`${s}
`)) {
  if (!reconcileLocked(paths, opts.keep)) {
    throw new ArchivePartialError(
      new Error("archive: reconcile refused (see above) -- nothing archived"),
      "none",
      [],
      []
    );
  }
  const src = readFileSync(paths.manifest, "utf8");
  const { archiveText, remaining, archivedIds: ids } = splitDone(src, opts.keep);
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
import { appendFileSync, existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname2 } from "node:path";
function appendLedgerEntry(ledgerPath, entry) {
  mkdirSync2(dirname2(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}
`);
}
function readLedger(ledgerPath) {
  if (!existsSync2(ledgerPath)) return [];
  const out = [];
  for (const line of readFileSync2(ledgerPath, "utf8").split("\n")) {
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
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, readdirSync as readdirSync2, renameSync as renameSync2, statSync, writeFileSync } from "node:fs";
import { basename as basename2, join as join2, relative, resolve } from "node:path";
function draftNames(draftsDir) {
  if (!existsSync3(draftsDir)) return [];
  return readdirSync2(draftsDir).filter((name) => /^draft-.*\.md$/.test(name) && statSync(join2(draftsDir, name)).isFile()).sort();
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
    } else if (existsSync3(join2(draftsDir, "consumed", draft))) {
      errors.push(`@${task.ref}: draft "${draft}" already exists in drafts/consumed/`);
    }
  }
  return errors;
}
function consumedDrafts(draftsDir, names) {
  if (names.length === 0) return [];
  const consumedDir = join2(draftsDir, "consumed");
  mkdirSync3(consumedDir, { recursive: true });
  for (const name of names) renameSync2(join2(draftsDir, name), join2(consumedDir, name));
  return names;
}
function rejectDraftErrors(draftsDir, names) {
  const pending = draftNames(draftsDir);
  const errors = [];
  for (const name of names) {
    if (/[\\/]/.test(name) || !/^draft-.*\.md$/.test(name)) {
      errors.push(`"${name}" is not a bare draft-*.md filename`);
    } else if (existsSync3(join2(draftsDir, "rejected", name))) {
      errors.push(`"${name}" already exists in drafts/rejected/`);
    } else if (!pending.includes(name)) {
      errors.push(`"${name}" is not pending in .local/tasks/drafts/ (names are case-sensitive)`);
    }
  }
  return errors;
}
function rejectDrafts(draftsDir, names) {
  if (names.length === 0) return [];
  const rejectedDir = join2(draftsDir, "rejected");
  mkdirSync3(rejectedDir, { recursive: true });
  for (const name of names) renameSync2(join2(draftsDir, name), join2(rejectedDir, name));
  return names;
}
function gatherDrafts(root, draftsDir) {
  if (!existsSync3(draftsDir) || !statSync(draftsDir).isDirectory()) {
    throw new Error(`no drafts dir: ${draftsDir}  (run init first, then add draft-*.md)`);
  }
  const names = draftNames(draftsDir);
  if (names.length === 0) throw new Error(`no draft-*.md found in ${draftsDir}`);
  let result = "";
  for (const name of names) {
    const file = join2(draftsDir, name);
    const content = readFileSync3(file, "utf8");
    const from = content.match(/^from:\s*(.+)$/m)?.[1]?.trim();
    const path = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
    result += `
===== ${relative(root, file)}${from ? `   [from: ${from}]` : ""} =====
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
  const root = repoRoot(input.to ? resolve(input.to) : process.cwd());
  assertBoardWritable(boardPathsFor(root).manifest);
  const fromRoot = repoRoot(process.cwd());
  const machine = (boardEnv("CYBERINE_TASKS_MACHINE") ?? "").trim();
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const from = `${sourceSlug(basename2(fromRoot))}${machine ? `@${machine}` : ""} ${day}`;
  const target = input.to ? resolve(input.to) : process.cwd();
  const targetScope = scopeForBoard(target, root);
  const path = relative(root, target);
  const pathStamp = (path && !path.startsWith("..") ? path : null) ?? (targetScope || null);
  let body;
  if (input.file) body = readFileSync3(input.file, "utf8").trimEnd();
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
  const draftsDir = join2(root, ".local", "tasks", "drafts");
  mkdirSync3(draftsDir, { recursive: true });
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "task";
  const epoch = Math.floor(Date.now() / 1e3);
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? `${epoch}-${process.pid}` : `${epoch}-${process.pid}-${attempt}`;
    const candidate = join2(draftsDir, `draft-${slug}-${suffix}.md`);
    try {
      writeFileSync(candidate, `${header.join("\n")}

${body}
`, { flag: "wx" });
      return { path: candidate, root, from };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`draft: could not find a free filename for "${input.title}" in ${draftsDir} after 50 attempts`);
}

// src/tasks/taskVerify.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync4, readFileSync as readFileSync4 } from "node:fs";
import { join as join3 } from "node:path";

// src/core/redact.ts
var PATTERNS = [
  // Named credential assignments: api_key=..., token: "...", secret=..., password=..., etc.
  /(?<![A-Za-z0-9])(sk|sk-ant|sk-proj|api[_-]?key|api[_-]?token|pat|token|secret|password|passwd|pass|pwd|auth(?:orization)?|credential)["']?\s*[=:]\s*['"]?\s*[\w\-.+/=%]{16,}/gi,
  // HTTP Bearer tokens
  /\bBearer\s+[\w\-.+/=%]{16,}/g,
  /\bBasic\s+(?=[A-Za-z0-9+/]*[0-9+/])[A-Za-z0-9+/]{12,}={0,2}(?![\w+/=])/g,
  // x-api-key header value
  /\bx-api-key\s*[:=]\s*[\w\-.+/=%]{16,}/gi,
  // Env-var-style assignment whose NAME carries a credential keyword, with or without a
  // prefix: DEEPSEEK_API_KEY=..., DB_PASSWORD=..., MY_API_TOKEN=... The first pattern above
  // anchors on \b and therefore does NOT match these -- there is no word boundary between
  // the prefix and the keyword inside DEEPSEEK_API_KEY, so every prefixed provider key in a
  // .env dump survived it. That matters because `cat` is an allowed run_bash command and the
  // worker transcript writes tool results to disk: an unredacted `cat .env` result is a
  // plaintext key file. The lookahead requires at least one letter in the value so numeric
  // config (LOOP_MAX_TOKENS=100000000) is not redacted as if it were a credential.
  /\b[A-Z][A-Z0-9]*(?:[_-][A-Z0-9]+)*?[_-]?(?:API[_-]?KEYS?|APIKEYS?|SECRETS?|PASSWORDS?|PASSWD|TOKENS?|CREDENTIALS?|PRIVATE[_-]?KEYS?)(?:[_-][A-Z0-9]+)*\s*[=:]\s*['"]?(?=[\w\-.+/=%]*[A-Za-z])[\w\-.+/=%]{8,}/g,
  // Shell export of sensitive env vars (e.g. export ANTHROPIC_API_KEY=sk-ant-...)
  /\bexport\s+([A-Z][A-Z0-9_]*(?:API[_\w]*|PASSWORD|TOKEN|SECRET|KEY))\s*=\s*['"]?[\w\-.+/=]{12,}/g,
  /\bsk-(?:ant|proj)-[A-Za-z0-9_-]{20,}/g,
  /\bsk-or-v1-[A-Za-z0-9]{20,}/g,
  /\bsk-(?:svcacct|admin)-[A-Za-z0-9_-]{20,}/g,
  /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bhf_[A-Za-z0-9]{30,}/g,
  /\bxai-[A-Za-z0-9]{20,}/g,
  /\bpplx-[A-Za-z0-9]{20,}/g,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\bnpm_[A-Za-z0-9]{36,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bxapp-[A-Za-z0-9-]{10,}/g,
  /\bya29\.[A-Za-z0-9_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}(?![\w-])/g,
  /\bsk-[A-Za-z0-9]{32,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}(?![\w-])/g,
  // PEM private key blocks
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g
];
var URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]+:)[^\s/]+@(?=[^\s@/?#]+)/gi;
var ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
var ZERO_WIDTH_KEY = /[\w\u200B-\u200D\u2060\uFEFF-]*[\u200B-\u200D\u2060\uFEFF][\w\u200B-\u200D\u2060\uFEFF-]*\s*[=:]\s*['"]?[^\s'"]+/g;
function redactSecrets(text) {
  if (!text) return text;
  let out = text.replace(URL_CREDENTIALS, "$1[REDACTED]@");
  out = out.replace(ZERO_WIDTH_KEY, (match) => {
    const joined = match.replace(ZERO_WIDTH, "");
    const redacted = applyPatterns(joined);
    return redacted === joined ? match : redacted;
  });
  return applyPatterns(out);
}
function applyPatterns(text) {
  let out = text;
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (match) => {
      const eqPos = match.search(/[=:\s]/);
      const prefix = eqPos > 0 ? match.slice(0, eqPos) : "";
      return prefix ? `${prefix}=[REDACTED]` : "[REDACTED]";
    });
  }
  return out;
}

// src/tasks/taskVerify.ts
var TASK_VERIFY_TIMEOUT_MS = 6e5;
var SHELL_OPERATORS = /[;&|<>]|\$\(|\n/;
var REFUSED_PROGRAMS = /* @__PURE__ */ new Set([
  "git",
  "gh",
  "curl",
  "wget",
  "ssh",
  "scp",
  "sftp",
  "rsync",
  "sudo",
  "su",
  "rm",
  "rmdir",
  "mv",
  "dd",
  "kill",
  "pkill",
  "killall",
  "shutdown",
  "reboot",
  "launchctl",
  "systemctl",
  "docker",
  "kubectl",
  "cyberine",
  "claude",
  "codex",
  "muse",
  "gemini",
  "opencode",
  "open",
  "osascript",
  "eval",
  "exec",
  "source"
]);
var REFUSED_SUBCOMMANDS = /* @__PURE__ */ new Set(["publish", "deploy", "push", "login", "logout", "unpublish"]);
function verifyCommandRefusal(command) {
  if (!command.trim()) return "it is empty";
  if (SHELL_OPERATORS.test(command)) return "it chains or redirects commands (; & | < > $( )); put a compound check in a script and name that";
  const words = command.trim().split(/\s+/);
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  const program = (words[i] ?? "").replace(/^.*\//, "");
  if (program === "") return "it names no program";
  if (REFUSED_PROGRAMS.has(program)) return `\`${program}\` can change state outside this check`;
  const sub = words.slice(i + 1).find((w) => !w.startsWith("-"));
  if (sub !== void 0 && REFUSED_SUBCOMMANDS.has(sub)) return `\`${program} ${sub}\` reaches outside this machine`;
  return null;
}
function verifyTimeoutMs() {
  const raw = Number(boardEnv("CYBERINE_TASKS_VERIFY_TIMEOUT_MS"));
  return Number.isFinite(raw) && raw > 0 ? raw : TASK_VERIFY_TIMEOUT_MS;
}
function tail(text) {
  return redactSecrets(text).trim().split("\n").slice(-8).join(" | ").replace(/\s+/g, " ").slice(-400);
}
function runVerifyCommand(command, cwd) {
  const refusal = verifyCommandRefusal(command);
  if (refusal !== null) return { command, passed: false, detail: `\`${command}\` was not run: ${refusal}` };
  const timeoutMs = verifyTimeoutMs();
  const res = spawnSync("bash", ["-c", command], { cwd, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  const out = tail(`${res.stdout ?? ""}
${res.stderr ?? ""}`);
  if (res.error !== void 0 && res.error.code === "ETIMEDOUT") {
    return { command, passed: false, detail: `\`${command}\` timed out after ${Math.round(timeoutMs / 1e3)}s: ${out}` };
  }
  if (res.status === 0) return { command, passed: true, detail: `\`${command}\` exit 0${out ? `; tail: ${out}` : ""}` };
  return { command, passed: false, detail: `\`${command}\` exited ${res.status ?? res.signal ?? "non-zero"}${out ? `: ${out}` : ""}` };
}
function taskVerifyField(manifestPath, id) {
  if (!existsSync4(manifestPath)) return null;
  const block = parseManifestBlocks(readFileSync4(manifestPath, "utf8"), TASK_ID_RE).blocks.find((b) => b.id === id);
  const command = block?.fields.get("verify")?.trim();
  if (!block || !command || command === "-") return null;
  return { command, path: normalizeTaskPath(block.fields.get("path")) };
}
function runTaskVerify(boardRoot, manifestPath, id) {
  const field = taskVerifyField(manifestPath, id);
  if (field === null) return null;
  const dir = field.path && existsSync4(join3(boardRoot, field.path)) ? join3(boardRoot, field.path) : boardRoot;
  return runVerifyCommand(field.command, dir);
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
      "source": "peer:dot-claude_312", // optional -- where the claim behind this task came from: peer:<session> | user | agent
      "verified": "read src/x.ts:40", // required with a peer: source -- how the claim was checked against the repo or the screen, or "no" when it was not
      "draft": "draft-task-123.md",  // optional -- pending draft basename to consume after apply
      "blocker": null,               // optional -- external blocker reason, or null/omit when none
      "waitsOn": "user",             // optional -- who a blocker waits on: "user" | "repo:<path>" | "session:<name>" | "upstream:<vendor>" | "event:<what>"; null/omit when none
      "verify": "npm run typecheck", // optional, exec:"agent" -- a command that exits 0 when the task is done; the task then closes only on it (saving an agent task without one prints a warning)
      "why": "...",                  // optional -- one-line rationale kept IN the manifest
      "default": "...",              // REQUIRED when the title starts "Owner: decide" -- what happens if the owner never answers (one line)
      "undoCost": "...",             // REQUIRED when the title starts "Owner: decide" -- what it costs to reverse the default or the answer (one line)
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
    do: b.fields.get("do") ?? "",
    path: normalizeTaskPath(b.fields.get("path"))
  }));
}
function findExisting(title, doText, path, ...blockLists) {
  const wanted = normalizeTaskPath(path);
  for (const blocks of blockLists) {
    for (const b of blocks) {
      if (b.title === title.trim() && b.do === doText.trim() && b.path === wanted) return b.id;
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
  if (t.waitsOn) lines.push(`waits-on: ${t.waitsOn}`);
  if (t.createdBy) lines.push(`created-by: ${t.createdBy}`);
  if (t.from) lines.push(`from: ${t.from}`);
  if (t.source) lines.push(`source: ${t.source}`);
  if (t.verified) lines.push(`verified: ${t.verified.trim()}`);
  lines.push(`do: ${t.do.trim()}`);
  lines.push(`done-when: ${t.doneWhen.trim()}`);
  if (t.default && t.default.trim()) lines.push(`default: ${t.default.trim().replace(/\s+/g, " ")}`);
  if (t.undoCost && t.undoCost.trim()) lines.push(`undo-cost: ${t.undoCost.trim().replace(/\s+/g, " ")}`);
  if (t.verify && t.verify.trim()) lines.push(`verify: ${t.verify.trim().replace(/\s+/g, " ")}`);
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
    if (t?.waitsOn !== void 0 && t.waitsOn !== null) {
      const waitsErr = typeof t.waitsOn === "string" ? waitsOnError(t.waitsOn) : "waits-on must be a string";
      if (waitsErr !== null) errors.push(`${tag}: waitsOn: ${waitsErr}`);
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
    for (const issue of sourceIssues(t?.source, t?.verified)) errors.push(`${tag}: ${issue}`);
    if (t?.path !== void 0 && t.path !== null) {
      const pathErr = validatePathField(t.path);
      if (pathErr) errors.push(`${tag}: path ${pathErr}`);
    }
    if (t?.why !== void 0 && t.why !== null && typeof t.why !== "string") {
      errors.push(`${tag}: why must be a string (one-line rationale)`);
    }
    if (t?.verify !== void 0 && t.verify !== null) {
      const refusal = typeof t.verify === "string" ? verifyCommandRefusal(t.verify) : "it must be a string";
      if (refusal !== null) errors.push(`${tag}: verify ${refusal}`);
    }
    for (const field of ["default", "undoCost"]) {
      const v = t?.[field];
      if (v !== void 0 && v !== null && typeof v !== "string") errors.push(`${tag}: ${field} must be a string (one line)`);
      else if (typeof v === "string" && /[\r\n]/.test(v)) errors.push(`${tag}: "${field}" must be a single line -- it renders as one manifest line`);
    }
    if (typeof t?.title === "string") {
      const missing = missingDecideFields(t.title, {
        default: typeof t.default === "string" ? t.default : null,
        undoCost: typeof t.undoCost === "string" ? t.undoCost : null
      });
      if (missing.length) {
        errors.push(`${tag}: an Owner: decide task needs a default and an undo cost -- missing ${missing.map((m) => m === "default" ? '"default" (--default)' : '"undoCost" (--undo-cost)').join(" and ")}`);
      }
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
  const scope = scopeForBoard(process.cwd(), paths.root);
  const decisions = input.map(withTaskDefaults).map((d) => scope && (d.path === void 0 || d.path === null) ? { ...d, path: scope } : d);
  const manifestSrc = readFileSync5(paths.manifest, "utf8");
  const manifestBlocks = parseSimpleBlocks(manifestSrc, warn);
  const archiveSrc = existsSync5(paths.archive) ? readFileSync5(paths.archive, "utf8") : "";
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
    const existingId = findExisting(t.title, t.do, t.path, manifestBlocks, archiveBlocks);
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
  mkdirSync4(paths.tasksDir, { recursive: true });
  for (const t of decisions) {
    if (!t.brief) continue;
    const id = refToId.get(t.ref);
    const path = join4(paths.tasksDir, `${id}.md`);
    const archivedPath = join4(paths.tasksDir, "archive", `${id}.md`);
    if (!existsSync5(path) && !existsSync5(archivedPath)) {
      writeFileSync2(path, briefText(t.brief));
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
  if (!existsSync5(paths.manifest)) {
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
  "waits-on",
  "created-by",
  "from",
  "source",
  "verified",
  "do",
  "done-when",
  "default",
  "undo-cost",
  "verify",
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
function replaceIntentFirstParagraph(src, newBody) {
  const lines = src.split("\n");
  const hIdx = lines.findIndex((line) => /^## Intent\s*$/.test(line));
  if (hIdx === -1) return null;
  let bodyStart = hIdx + 1;
  if (bodyStart < lines.length && /^<!--.*-->$/.test(lines[bodyStart].trim())) bodyStart++;
  while (bodyStart < lines.length && lines[bodyStart].trim() === "") bodyStart++;
  let end = bodyStart;
  while (end < lines.length && lines[end].trim() !== "" && !SECTION_HEADING_RE.test(lines[end])) end++;
  return [...lines.slice(0, bodyStart), newBody, ...lines.slice(end)].join("\n");
}
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
  const src = readFileSync5(paths.manifest, "utf8");
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
  const pathOnly = changes.path !== void 0 && Object.entries(changes).every(([k, v]) => k === "path" || v === void 0);
  if (effective === "done" && !pathOnly) {
    throw new BoardRejected(`set: ${id} is effectively [done] -- refusing to re-tier a closed task (only --path alone may re-scope it)`);
  }
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
  if (changes.verify !== void 0 && changes.verify !== "-") {
    const refusal = verifyCommandRefusal(changes.verify);
    if (refusal !== null) throw new BoardRejected(`set: --verify ${JSON.stringify(changes.verify)} refused: ${refusal} (pass "-" to remove it)`);
  }
  for (const [flag, key] of [["--default", "default"], ["--undo-cost", "undoCost"]]) {
    const v = changes[key];
    if (v !== void 0 && v !== "-" && !collapseWhitespace(v)) throw new BoardRejected(`set: ${flag} must not be empty (pass "-" to remove it)`);
  }
  const titleAfter = changes.title !== void 0 ? collapseWhitespace(changes.title) : block.title;
  if (isOwnerDecideTitle(titleAfter)) {
    for (const [flag, key] of [["--default", "default"], ["--undo-cost", "undoCost"]]) {
      if (changes[key] === "-") throw new BoardRejected(`set: ${id} is an Owner: decide task -- ${flag} cannot be cleared; replace it with new text instead`);
    }
    if (changes.title !== void 0 && !isOwnerDecideTitle(block.title)) {
      const missing = missingDecideFields(titleAfter, {
        default: changes.default ?? block.fields.get("default"),
        undoCost: changes.undoCost ?? block.fields.get("undo-cost")
      });
      if (missing.length) {
        throw new BoardRejected(`set: the new title makes ${id} an Owner: decide task, which needs a default and an undo cost -- add ${missing.map((m) => m === "default" ? "--default" : "--undo-cost").join(" and ")}`);
      }
    }
  }
  if (changes.path !== void 0 && changes.path !== "-") {
    const p = changes.path.trim();
    if (!p || /\s/.test(p) || isAbsolute(p) || p.split(/[\\/]/).includes("..")) {
      throw new BoardRejected(`set: --path must be one relative path inside the board's repository, or "-" to remove it (got ${JSON.stringify(changes.path)})`);
    }
  }
  if (changes.waitsOn !== void 0 && changes.waitsOn.trim() !== "-") {
    const waitsErr = waitsOnError(changes.waitsOn);
    if (waitsErr !== null) throw new BoardRejected(`set: --waits-on: ${waitsErr}`);
  }
  const clearsSource = changes.source !== void 0 && changes.source.trim() === "-";
  if (clearsSource && changes.verified !== void 0) {
    throw new BoardRejected("set: --source - clears source and verified together; pass no --verified or --unverified with it");
  }
  const sourceAfter = clearsSource ? void 0 : changes.source?.trim() ?? block.fields.get("source");
  const verifiedAfter = clearsSource ? void 0 : changes.verified ?? (changes.source !== void 0 ? void 0 : block.fields.get("verified"));
  if (changes.source !== void 0 || changes.verified !== void 0) {
    const issues = sourceIssues(sourceAfter, verifiedAfter);
    if (issues.length) throw new BoardRejected(`set: ${issues.join("; ")}`);
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
  if (changes.path !== void 0) {
    const prev = currentValue(lines, start, end, "path");
    const next = changes.path === "-" ? null : changes.path.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    end = upsertField(lines, start, end, "path", next);
    if (prev !== next) {
      report.push(`path ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
      journalFields.push({ field: "path", oldV: prev ?? "-", newV: next ?? "-" });
    }
  }
  if (changes.waitsOn !== void 0) {
    const prev = currentValue(lines, start, end, "waits-on");
    const next = changes.waitsOn.trim() === "-" ? null : changes.waitsOn.trim();
    end = upsertField(lines, start, end, "waits-on", next);
    if (prev !== next) {
      report.push(`waits-on ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
      journalFields.push({ field: "waits-on", oldV: prev ?? "-", newV: next ?? "-" });
    }
  }
  if (changes.source !== void 0 || changes.verified !== void 0) {
    for (const [field, next] of [["source", sourceAfter ?? null], ["verified", verifiedAfter?.trim() ?? null]]) {
      const prev = currentValue(lines, start, end, field);
      end = upsertField(lines, start, end, field, next);
      if (prev !== next) {
        report.push(`${field} ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
        journalFields.push({ field, oldV: prev ?? "-", newV: next ?? "-" });
      }
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
  for (const [key, field] of [["default", "default"], ["undoCost", "undo-cost"]]) {
    const v = changes[key];
    if (v === void 0) continue;
    const prev = currentValue(lines, start, end, field);
    const next = v === "-" ? null : collapseWhitespace(v);
    end = upsertField(lines, start, end, field, next);
    if (prev !== next) {
      report.push(`${field} ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
      journalFields.push({ field, oldV: prev ?? "-", newV: next ?? "-" });
    }
  }
  if (changes.verify !== void 0) {
    const prev = currentValue(lines, start, end, "verify");
    const next = changes.verify === "-" ? null : collapseWhitespace(changes.verify);
    end = upsertField(lines, start, end, "verify", next);
    if (prev !== next) {
      report.push(`verify ${prev ?? "(none)"} -> ${next ?? "(none)"}`);
      journalFields.push({ field: "verify", oldV: prev ?? "-", newV: next ?? "-" });
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
  const briefPath = join4(paths.tasksDir, `${id}.md`);
  if (changes.do !== void 0 && existsSync5(briefPath)) {
    const updated = replaceIntentFirstParagraph(readFileSync5(briefPath, "utf8"), collapseWhitespace(changes.do));
    if (updated === null) {
      process.stderr.write(`set: ${briefPath} has no ## Intent section to update -- use /cyberine-taskboard:tasks add --brief-file <file> to create a replacement task with ## Intent
`);
    } else {
      writeFileAtomic(briefPath, updated, "tmp");
    }
  }
  if (changes.doneWhen !== void 0) {
    const newVal = collapseWhitespace(changes.doneWhen);
    if (!existsSync5(briefPath)) {
      process.stderr.write(`set: no brief at ${briefPath} -- done-when updated in the manifest only
`);
    } else {
      const updated = replaceDoneWhenBody(readFileSync5(briefPath, "utf8"), newVal);
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
  const src = readFileSync5(paths.manifest, "utf8");
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
function setBlocker(paths, rawId, reason, waitsOn) {
  if (RECURRING_ID_RE.test(rawId)) {
    throw new BoardRejected(
      `blocker: ${rawId} is a recurring block -- blocker only edits task blocks; recurring exec/model tiers live in the R-block itself`
    );
  }
  const src = readFileSync5(paths.manifest, "utf8");
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
  if (dupOf && dupOf !== "-" && reason !== null) {
    throw new BoardRejected(`blocker: ${id} is duplicate-of ${dupOf} -- refusing to block a merged task`);
  }
  const start = block.start;
  const end = coreEnd(lines, block.start, block.end);
  const before = countAllHeaders(lines.join("\n"));
  if (reason !== null) {
    const collapsed = reason.replace(/\s+/g, " ").trim();
    if (!collapsed) throw new BoardRejected("blocker: reason must be non-empty");
    if (waitsOn !== void 0) {
      const waitsErr = waitsOnError(waitsOn);
      if (waitsErr !== null) throw new BoardRejected(`blocker: --waits-on: ${waitsErr}`);
    }
    const afterBlocker = upsertField(lines, start, end, "blocker", collapsed);
    if (waitsOn !== void 0) upsertField(lines, start, afterBlocker, "waits-on", waitsOn.trim());
    if (countAllHeaders(lines.join("\n")) !== before) {
      throw new BoardRejected("blocker: refused -- header-count guard failed, manifest left untouched");
    }
    writeFileAtomic(paths.manifest, lines.join("\n"), "blocker");
    return `${id} blocker set: ${collapsed}${waitsOn !== void 0 ? ` (waits on ${waitsOn.trim()})` : ""}`;
  }
  if (currentValue(lines, start, end, "blocker") === null && currentValue(lines, start, end, "waits-on") === null) {
    throw new BoardRejected(`blocker: ${id} has no blocker: line -- nothing to unblock`);
  }
  const afterUnblock = upsertField(lines, start, end, "blocker", null);
  upsertField(lines, start, afterUnblock, "waits-on", null);
  if (countAllHeaders(lines.join("\n")) !== before) {
    throw new BoardRejected("blocker: refused -- header-count guard failed, manifest left untouched");
  }
  writeFileAtomic(paths.manifest, lines.join("\n"), "blocker");
  return `${id} blocker cleared`;
}
function blockTaskUnderLock(startDir, rawId, reason, waitsOn) {
  const paths = resolveBoard(startDir);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new BoardRejected(`blocker: reconcile lock busy -- ${rawId} left without a blocker`);
  }
  try {
    return setBlocker(paths, rawId, reason, waitsOn);
  } finally {
    unlock(paths.lock);
  }
}
var DEPS_LINE_RE = /^deps:(\s|$)/;
var MERGED_DUP_DROP_RE = /^(duplicate-of|blocker|waits-on):(\s|$)/;
function readManifestLines(manifest) {
  const src = readFileSync5(manifest, "utf8");
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
    parseManifestBlocks(readFileSync5(paths.manifest, "utf8"), TASK_ID_RE).blocks.map((b) => b.id)
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
  const { blocks, warnings } = parseManifestBlocks(readFileSync5(paths.manifest, "utf8"), TASK_ID_RE);
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
    const cleared = dropFieldLines(lines, range.start, range.end, MERGED_DUP_DROP_RE);
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
  const manifestSrc = existsSync5(paths.manifest) ? readFileSync5(paths.manifest, "utf8") : "";
  const archiveSrc = existsSync5(paths.archive) ? readFileSync5(paths.archive, "utf8") : archiveHeader(paths.root);
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
  ArchivePartialError,
  archivedIds,
  archivedBlocks,
  archiveAbortLabel,
  archiveLocked,
  readLedger,
  draftNames,
  validateDraftReferences,
  rejectDraftErrors,
  rejectDrafts,
  gatherDrafts,
  writeDraft,
  runTaskVerify,
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
  replaceDoneWhenBody,
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
