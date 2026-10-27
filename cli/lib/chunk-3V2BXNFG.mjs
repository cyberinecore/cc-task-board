#!/usr/bin/env node
import {
  FOLD_HEADER_RE,
  TASK_ID_RE,
  TASK_ID_SOURCE,
  assertBoardWritable,
  blockRange,
  countHeaders,
  dropFieldLines,
  ensureMigrated,
  epochToIsoForTz,
  epochToLocalIso,
  escapedForbiddenIds,
  fencedLineFlags,
  foldOverlay,
  orderOverlayLines,
  overlaySources,
  parseManifestBlocks,
  pathInScope,
  pendingSnapshots,
  readOverlayText,
  refusedHeaderIds,
  republishOverlayLine,
  writeFileAtomic
} from "./chunk-GIU6R332.mjs";

// src/tasks/boardReconcile.ts
import { existsSync as existsSync2, linkSync, readFileSync as readFileSync3, renameSync as renameSync2, statSync as statSync2, unlinkSync as unlinkSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { basename } from "node:path";

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

// src/tasks/boardJournal.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
var DAY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
function appendJournalEvents(paths, events) {
  if (events.length === 0) return;
  assertBoardWritable(paths.manifest);
  mkdirSync(paths.journalDir, { recursive: true });
  const byDay = /* @__PURE__ */ new Map();
  for (const ev of events) {
    const day = ev.ts.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(ev);
    else byDay.set(day, [ev]);
  }
  for (const [day, dayEvents] of byDay) {
    const lines = dayEvents.map((ev) => JSON.stringify(ev)).join("\n");
    appendFileSync(join(paths.journalDir, `${day}.jsonl`), `${lines}
`);
  }
}
function listJournalDays(paths) {
  if (!existsSync(paths.journalDir)) return [];
  return readdirSync(paths.journalDir).map((f) => DAY_FILE_RE.exec(f)?.[1]).filter((d) => d !== void 0).sort();
}
function dedupeAndSortEvents(events) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const ev of events) {
    const key = `${ev.kind}\0${ev.id ?? ""}\0${ev.ts}\0${ev.by ?? ""}\0${ev.ref ?? ""}\0${ev.all ?? ""}\0${ev.status ?? ""}\0${ev.choice ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  out.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return out;
}
function readJournalDay(paths, date) {
  const file = join(paths.journalDir, `${date}.jsonl`);
  if (!existsSync(file)) return [];
  const events = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object") continue;
      const ev = parsed;
      if (typeof ev.ts !== "string" || !Number.isFinite(Date.parse(ev.ts)) || typeof ev.kind !== "string") continue;
      if (["id", "title", "body", "by", "v", "evidence", "choice", "rejected", "reason", "status", "ref"].some((field) => ev[field] !== void 0 && typeof ev[field] !== "string")) continue;
      if (ev.all !== void 0 && typeof ev.all !== "boolean") continue;
      events.push(parsed);
    } catch {
      continue;
    }
  }
  return dedupeAndSortEvents(events);
}
function readJournalEvents(paths) {
  return dedupeAndSortEvents(listJournalDays(paths).flatMap((day) => readJournalDay(paths, day)));
}
function journalEventRef(event) {
  return `${event.ts}@${event.by ?? ""}`;
}
function nextDecisionTimestamp(events, by) {
  const refs = new Set(events.map(journalEventRef));
  let now = Date.now();
  for (; ; ) {
    const ts = epochToLocalIso(Math.floor(now / 1e3)).replace(/([+-]\d{2}:\d{2})$/, `.${String(now % 1e3).padStart(3, "0")}$1`);
    if (!refs.has(`${ts}@${by}`)) return ts;
    now++;
  }
}
function taskPathsOf(paths) {
  const out = /* @__PURE__ */ new Map();
  for (const file of [paths.archive, paths.manifest]) {
    if (!existsSync(file)) continue;
    for (const block of parseManifestBlocks(readFileSync(file, "utf8"), TASK_ID_RE).blocks) {
      out.set(block.id, block.fields.get("path")?.trim() ?? "");
    }
  }
  return out;
}
function unreviewedDecisions(paths, scope = "") {
  const all = allUnreviewedDecisions(paths);
  if (!scope) return all;
  const taskPaths = taskPathsOf(paths);
  return all.filter((d) => taskPaths.has(d.id) && pathInScope(taskPaths.get(d.id), scope));
}
function allUnreviewedDecisions(paths) {
  const events = readJournalEvents(paths);
  const reverted = new Set(events.filter((ev) => ev.kind === "decided" && ev.status === "reverted").map((ev) => ev.ref));
  const acks = events.filter((ev) => ev.kind === "ack");
  return events.flatMap((ev) => {
    if (ev.kind !== "decided" || ev.status !== "auto" || !ev.id || !ev.choice || !ev.rejected || !ev.reason || !ev.by) return [];
    const ref = journalEventRef(ev);
    if (reverted.has(ref) || acks.some((ack) => Date.parse(ack.ts) >= Date.parse(ev.ts) && (ack.all === true || ack.ref === ref))) return [];
    return [{ ref, id: ev.id, choice: ev.choice, rejected: ev.rejected, reason: ev.reason, ts: ev.ts, by: ev.by }];
  });
}
function unreviewedDecisionLines(decisions) {
  return decisions.map((ev) => `${ev.id}: ${ev.choice.replace(/\s+/g, " ")} (${ev.ref})`);
}
function deriveDayTitle(events) {
  let titleOverride;
  let doneCount = 0;
  let decidedCount = 0;
  let ackCount = 0;
  let firstDecidedTitle;
  for (const ev of events) {
    if (ev.kind === "title") titleOverride = ev.v;
    else if (ev.kind === "done") doneCount++;
    else if (ev.kind === "decided") {
      decidedCount++;
      if (firstDecidedTitle === void 0) firstDecidedTitle = ev.title;
    } else if (ev.kind === "ack") ackCount++;
  }
  if (titleOverride !== void 0) return titleOverride;
  if (doneCount > 0) return firstDecidedTitle ? `${doneCount} done -- ${firstDecidedTitle}` : `${doneCount} done`;
  if (decidedCount > 0 || ackCount > 0) return `${decidedCount} decided${ackCount ? ` -- ${ackCount} ack` : ""}`;
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
    const briefPath = join(tasksDir, `${id}.md`);
    if (!existsSync(briefPath)) continue;
    const briefSrc = readFileSync(briefPath, "utf8");
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
  if (!existsSync(paths.manifest)) return [];
  const manifestSrc = readFileSync(paths.manifest, "utf8");
  const rawLog = readOverlayText(paths);
  const overlay = foldOverlay(rawLog);
  const refused = refusedHeaderIds(manifestSrc, overlay, escapedForbiddenIds(rawLog));
  const archiveSrc = existsSync(paths.archive) ? readFileSync(paths.archive, "utf8") : "";
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

// src/tasks/boardLock.ts
import { mkdirSync as mkdirSync2, readFileSync as readFileSync2, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join as join2 } from "node:path";
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
    mtimeMs = statSync(lockPath).mtimeMs;
  } catch {
    return null;
  }
  try {
    const stamp = readFileSync2(join2(lockPath, LOCK_OWNER_FILE), "utf8").trim();
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
    return statSync(grave).mtimeMs;
  } catch {
    return null;
  }
}
function breakStaleLock(lockPath, judged) {
  const grave = `${lockPath}.stale.${process.pid}.${Date.now()}`;
  try {
    renameSync(lockPath, grave);
  } catch {
    return false;
  }
  let takenPid = null;
  let takenStamp = null;
  try {
    takenStamp = readFileSync2(join2(grave, LOCK_OWNER_FILE), "utf8").trim();
    const n = Number(takenStamp.split("	")[0]);
    if (Number.isInteger(n) && n > 0) takenPid = n;
  } catch {
    takenPid = null;
  }
  const sameLock = judged.stamp != null ? takenStamp === judged.stamp : judged.pid !== null ? takenPid === judged.pid : takenPid === null && judged.mtimeMs !== null && graveMtime(grave) === judged.mtimeMs;
  if (!sameLock) {
    try {
      renameSync(grave, lockPath);
    } catch {
    }
    return false;
  }
  try {
    unlinkSync(join2(grave, LOCK_OWNER_FILE));
  } catch {
  }
  try {
    rmdirSync(grave);
  } catch {
  }
  return true;
}
function lock(lockPath) {
  mkdirSync2(dirname(lockPath), { recursive: true });
  let brokeOnce = false;
  const deadline = Date.now() + SPIN_TICKS * SPIN_MS;
  for (let i = 0; i < SPIN_TICKS && Date.now() < deadline; i++) {
    try {
      mkdirSync2(lockPath);
      heldLocks.add(lockPath);
      try {
        writeFileSync(join2(lockPath, LOCK_OWNER_FILE), `${process.pid}	${Date.now()}	${THIS_HOST}`);
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
    unlinkSync(join2(lockPath, LOCK_OWNER_FILE));
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
    unlinkSync2(snapshots[0]);
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
  const archivedSet = existsSync2(paths.archive) ? headerIdsOutsideFences(readFileSync3(paths.archive, "utf8")) : /* @__PURE__ */ new Set();
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
  if (!existsSync2(paths.manifest)) return { pending: 0, plan: null, changedIds: [] };
  const rawLog = orderOverlayLines(overlaySources(paths)).text;
  const manifestSrc = readFileSync3(paths.manifest, "utf8");
  const plan = planReconcile(paths, rawLog, manifestSrc);
  const changedIds = plan.out === null ? [] : plan.out === manifestSrc ? [] : [...plan.overlay.keys()].filter((id) => TASK_ID_RE.test(id));
  const pending = rawLog.split("\n").filter((l) => l.split("	").length >= 4).length;
  return { pending, plan, changedIds };
}
function reconcileLocked(paths, keep) {
  const { manifest, log } = paths;
  const snapshots = pendingSnapshots(log);
  const hasLive = existsSync2(log) && statSync2(log).size > 0;
  const published = overlaySources(paths).filter((p) => p.startsWith(`${paths.statusDir}/`));
  if (!hasLive && snapshots.length === 0 && published.length === 0) return true;
  if (hasLive) {
    const mine = `${log}.snap.${process.pid}.${Date.now()}`;
    try {
      renameSync2(log, mine);
      snapshots.push(mine);
    } catch {
      process.stderr.write("/cyberine-taskboard:tasks: reconcile could not snapshot the overlay -- overlay left intact\n");
      return false;
    }
  }
  const ordered = orderOverlayLines([...snapshots, ...published]);
  const { consumed } = ordered;
  const deferred = [];
  let rawLog = ordered.text;
  if (keep !== void 0) {
    const kept = [];
    for (const line of ordered.text.split("\n")) {
      const id = line.split("	")[2];
      if (line === "" || id === void 0 || keep(id)) kept.push(line);
      else deferred.push(line);
    }
    rawLog = kept.join("\n");
  }
  const src = readFileSync3(manifest, "utf8");
  const plan = planReconcile(paths, rawLog, src);
  if (plan.orphans.length > 0) {
    process.stderr.write(
      `/cyberine-taskboard:tasks: reconcile is discarding ${plan.orphans.length} overlay flip(s) for id(s) not in this board: ${plan.orphans.join(", ")} -- they are in neither ${manifest} nor ${basename(paths.archive)}. If you flipped them against a different manifest (another branch, or .claude/TASKS.md vs .local/tasks/ACTIVE.md), re-run the flip on that board.
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
  for (const line of deferred) {
    try {
      republishOverlayLine(paths.root, line);
    } catch {
      restoreSnapshots(log, snapshots);
      process.stderr.write("/cyberine-taskboard:tasks: reconcile could not keep an out-of-scope flip pending -- overlay restored\n");
      return false;
    }
  }
  try {
    appendJournalEvents(paths, harvestJournalEvents(rawLog, plan.overlay, src, paths.tasksDir, plan.refusedHeaders, existsSync2(paths.archive) ? readFileSync3(paths.archive, "utf8") : ""));
  } catch (err) {
    process.stderr.write(
      `/cyberine-taskboard:tasks: journal harvest failed (${err.message}) -- overlay still reconciled
`
    );
  }
  for (const p of published) {
    try {
      unlinkSync2(p);
    } catch {
    }
  }
  for (const p of snapshots) {
    let nowText;
    try {
      nowText = readFileSync3(p, "utf8");
    } catch {
      continue;
    }
    const had = consumed.get(p) ?? 0;
    if (nowText.length > had) {
      try {
        writeFileSync2(p, nowText.slice(had));
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
      unlinkSync2(p);
    } catch {
    }
  }
  try {
    writeFileSync2(log, "", { flag: "wx" });
  } catch {
  }
  return true;
}
function reconcile(paths, keep) {
  const pending = overlaySources(paths).some((p) => {
    try {
      return statSync2(p).size > 0;
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
    return reconcileLocked(paths, keep);
  } finally {
    unlock(paths.lock);
  }
}

export {
  normalizeHost,
  lock,
  unlock,
  lockAndMigrate,
  appendJournalEvents,
  listJournalDays,
  readJournalEvents,
  journalEventRef,
  nextDecisionTimestamp,
  unreviewedDecisions,
  unreviewedDecisionLines,
  deriveDayTitle,
  listJournalDaysFolded,
  readJournalDayFolded,
  bakeOverlay,
  bakeCompleted,
  bakeEvidence,
  bakeLeaseClear,
  planReconcile,
  lastOverlayLinesFor,
  reconcileDryRun,
  reconcileLocked,
  reconcile
};
