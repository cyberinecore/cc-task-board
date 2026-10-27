#!/usr/bin/env node
import {
  archivedIds,
  resolveDuplicateOf
} from "./chunk-T636BNCF.mjs";
import {
  TASK_STATUSES,
  danglingTaskPath,
  normalizeTaskPath,
  pathInScope,
  repoRoot,
  submoduleScope
} from "./chunk-GIU6R332.mjs";

// src/tasks/runnable.ts
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
var archiveCache = /* @__PURE__ */ new Map();
function archiveIdsFor(manifestPath) {
  const archivePath = join(dirname(manifestPath), "TASKS_ARCHIVE.md");
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
function depHops(t, doneIds, dupMap) {
  const hops = {};
  for (const d of t.deps) {
    if (doneIds.has(d) || !dupMap.has(d)) continue;
    const { target, cycle } = resolveDuplicateOf(dupMap, d);
    if (!cycle && doneIds.has(target)) hops[d] = target;
  }
  return hops;
}
function formatDepsList(t, doneIds, dupMap) {
  const hops = depHops(t, doneIds, dupMap);
  return t.deps.map((d) => hops[d] ? `${d}->${hops[d]} done` : d).join(",");
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
  if (!scope) return { sets, scope: "", hidden: 0, unassigned: [] };
  const root = repoRoot(cwd);
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
    hidden: tasks.filter((t) => !pathInScope(t.path, scope)).length,
    unassigned: tasks.filter((t) => (t.status === "todo" || t.status === "doing" || t.status === "backlog") && (normalizeTaskPath(t.path) === "" || danglingTaskPath(root, t.path))).map((t) => t.id)
  };
}
function submoduleScopeNotice(scoped) {
  if (!scoped.scope || scoped.hidden === 0) return null;
  const unassigned = scoped.unassigned.length > 0 ? `; ${scoped.unassigned.length} open of them carry no path or a dead one (${scoped.unassigned.join(", ")})` : "";
  return `taskboard: scoped to submodule ${scoped.scope}/ -- ${scoped.hidden} task(s) elsewhere on this board hidden${unassigned} (--all shows every task)`;
}
function missingDeps(t, sets) {
  return t.deps.filter((d) => !depSatisfied(d, sets.doneIds, sets.dupMap));
}
function stuckReason(sets) {
  const parts = [];
  if (sets.waiting.length > 0) {
    parts.push(`${sets.waiting.length} blocked by an external blocker (release one with '/cyberine-taskboard:tasks status unblock <id>')`);
  }
  if (sets.blocked.length > 0) parts.push(`${sets.blocked.length} waiting on deps (finish them or mark them done)`);
  return `${parts.join("; ")}.`;
}
function externalBlockerLines(sets) {
  const out = ["Blocked by an external blocker (release with `/cyberine-taskboard:tasks status unblock <id>`):"];
  for (const t of sets.waiting) {
    out.push(`  ${t.id}  ${t.title}  -- blocker: ${t.blocker || "(unspecified)"}${t.waitsOn ? `  (waits on: ${t.waitsOn})` : ""}`);
  }
  return out;
}
function formatRunnableSummary(sets, opts) {
  const take = opts?.take;
  const claimed = take === void 0 ? sets.runnable : sets.runnable.slice(0, take);
  const leftForOthers = take === void 0 ? [] : sets.runnable.slice(take);
  const header = `${sets.doneIds.size} done | ${claimed.length} runnable${take !== void 0 ? ` (take=${take})` : ""} | ${leftForOthers.length} left-for-others | ${sets.waiting.length} blocked | ${sets.blocked.length} waiting | ${sets.doing.length} in-progress | ${sets.backlog.length} backlog | ${sets.forbidden.length} forbidden`;
  const lines = [header, ""];
  if (claimed.length === 0) {
    let reason;
    if (leftForOthers.length > 0) reason = `${leftForOthers.length} runnable but take=0.`;
    else if (sets.blocked.length > 0 || sets.waiting.length > 0) reason = stuckReason(sets);
    else if (sets.done.length > 0 || sets.doing.length > 0)
      reason = "all runnable tasks already in-progress or done.";
    else reason = "no todo tasks in manifest.";
    lines.push(`(nothing runnable \u2014 ${reason})`);
    if (sets.waiting.length > 0) {
      lines.push("");
      lines.push(...externalBlockerLines(sets));
    }
    return lines.join("\n");
  }
  lines.push("Runnable (next to dispatch):");
  for (const t of claimed) {
    let entry = `  ${t.id}  ${t.title}`;
    if (t.deps.length > 0) entry += `  [deps: ${formatDepsList(t, sets.doneIds, sets.dupMap)}]`;
    if (t.blocker) entry += `  [blocker: ${t.blocker}${t.waitsOn ? `; waits on: ${t.waitsOn}` : ""}]`;
    lines.push(entry);
  }
  if (leftForOthers.length > 0) {
    lines.push("");
    lines.push(`Left for other sessions: ${leftForOthers.map((t) => t.id).join(", ")}`);
  }
  if (sets.waiting.length > 0) {
    lines.push("");
    lines.push(...externalBlockerLines(sets));
  }
  if (sets.blocked.length > 0) {
    lines.push("");
    lines.push("Waiting on deps (not done yet):");
    for (const t of sets.blocked) {
      const missing = missingDeps(t, sets).map(
        (d) => resolveDuplicateOf(sets.dupMap, d).cycle ? `${d} (duplicate-of cycle, fix the board)` : d
      );
      lines.push(`  ${t.id}  ${t.title}  -- waiting on: ${missing.join(", ") || "(unknown dep)"}`);
    }
  }
  return lines.join("\n");
}

export {
  archiveIdsFor,
  depSatisfied,
  depHops,
  computeRunnable,
  scopeRunnableSets,
  submoduleScopeNotice,
  missingDeps,
  formatRunnableSummary
};
