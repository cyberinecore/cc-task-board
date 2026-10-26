#!/usr/bin/env node
import {
  archiveIdsFor,
  depSatisfied
} from "./chunk-SH2Y6DI2.mjs";
import {
  listJournalDays,
  unreviewedDecisionLines,
  unreviewedDecisions
} from "./chunk-ODYPGOF4.mjs";
import {
  TASK_ID_RE,
  TASK_STATUS_SET,
  boardEnv,
  boardIdentityProblem,
  danglingTaskPath,
  fold,
  logLines,
  manifestCandidates,
  normalizeTaskPath,
  parseManifestBlocks,
  pathInScope,
  readOverlayText,
  scopeTopologyInputs,
  shadowedHubBoard,
  submoduleScope,
  todayLocalDate
} from "./chunk-KIJLE46J.mjs";

// src/tasks/boardStatusView.ts
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
var OPEN_STATUSES = /* @__PURE__ */ new Set(["todo", "doing", "backlog"]);
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
function ownerSplit(tasks) {
  const pool = tasks.filter((t) => t.status === "todo" && t.exec === "manual" && (t.duplicateOf === "" || t.duplicateOf === "-"));
  return { actionable: pool.filter((t) => t.eff === "todo"), waiting: pool.filter((t) => t.eff !== "todo") };
}
function boardView(paths, cwd, showAll) {
  const src = readFileSync(paths.manifest, "utf8");
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
    created: b.fields.get("created")?.trim() ?? "",
    exec: b.fields.get("exec")?.trim() ?? ""
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
      created: t.created,
      exec: t.exec
    };
  });
  const scope = showAll ? "" : submoduleScope(cwd);
  const tasks = scope ? all.filter((t) => pathInScope(t.path, scope)) : all;
  const hidden = all.length - tasks.length;
  const unassigned = scope ? all.filter((t) => OPEN_STATUSES.has(t.status) && (normalizeTaskPath(t.path) === "" || danglingTaskPath(paths.root, t.path))) : [];
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
  const { actionable: ownerActionable, waiting: ownerWaiting } = ownerSplit(tasks);
  const recurring = recurringEntries(src);
  const recurringDue = recurring.filter((e) => e.state !== "OK").length;
  const pending = logLines(paths);
  const rawThreshold = Number(boardEnv("CYBERINE_TASKS_STALE_DOING_DAYS"));
  const threshold = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 3;
  const stale = doing.filter((t) => t.epoch !== void 0 && (Date.now() / 1e3 - t.epoch) / 86400 >= threshold);
  return {
    src,
    tasks,
    all,
    hidden,
    scope,
    unassigned,
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
    stale,
    ownerActionable,
    ownerWaiting,
    unreviewedDecisions: unreviewedDecisions(paths, scope)
  };
}
var RECENT_DONE_DEFAULT_DAYS = 7;
function recentDoneDays() {
  return RECENT_DONE_DEFAULT_DAYS;
}
function dateDaysAgo(days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayLocalDate());
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function recentDoneTasks(paths, view, days = recentDoneDays()) {
  const cutoff = dateDaysAgo(days);
  if (!cutoff) return [];
  const manifestBlocks = parseManifestBlocks(view.src, TASK_ID_RE).blocks.filter((b) => b.status === "done");
  const archiveBlocks = existsSync(paths.archive) ? parseManifestBlocks(readFileSync(paths.archive, "utf8"), TASK_ID_RE).blocks : [];
  const seen = /* @__PURE__ */ new Set();
  const found = [];
  for (const b of [...archiveBlocks.reverse(), ...manifestBlocks.reverse()]) {
    if (seen.has(b.id)) continue;
    const completed = (b.fields.get("completed") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completed) || completed < cutoff) continue;
    if (view.scope && !pathInScope(b.fields.get("path")?.trim(), view.scope)) continue;
    seen.add(b.id);
    found.push({ id: b.id, title: b.title, completed });
  }
  return found.sort((a, b) => a.completed < b.completed ? 1 : a.completed > b.completed ? -1 : 0);
}
function clip(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
}
function recentDoneBannerLine(recent, days) {
  if (recent.length === 0) return "";
  const shown = recent.slice(0, 3).map((t) => `${t.id} ${clip(t.title, 40)}`);
  const more = recent.length - shown.length;
  return `recent done (${days}d): ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}  (/cyberine-taskboard:tasks status for all)`;
}
function boardStatusView(paths, cwd, summary, showAll) {
  const view = boardView(paths, cwd, showAll);
  const { doing, todo, blocked, backlog, done, forbidden, unknown, ready, waitingDeps } = view;
  const stderr = [];
  const identity = boardIdentityProblem(paths.root, paths.manifest);
  if (identity !== null) stderr.push(identity.replace("refusing to use the board", "every write is refused for the board"));
  const hub = shadowedHubBoard(paths.root);
  if (hub !== null) stderr.push(`/cyberine-taskboard:tasks: this repo's own board ${paths.manifest} shadows the hub board ${hub}; commands here read and write the submodule board, not the hub's`);
  if (view.unassigned.length > 0) {
    stderr.push(`/cyberine-taskboard:tasks: ${view.unassigned.length} open task(s) on this board carry no path or a path that no longer exists, so no submodule scope shows them: ${view.unassigned.map((t) => t.id).join(", ")} (/cyberine-taskboard:tasks set <id> --path <dir> assigns one)`);
  }
  if (view.scope && view.hidden > 0) {
    stderr.push(`/cyberine-taskboard:tasks: scoped to submodule ${view.scope}/ -- ${view.hidden} task(s) elsewhere on this board hidden (--all shows every task)`);
  }
  for (const t of view.stale) {
    const age = (Date.now() / 1e3 - t.epoch) / 86400;
    stderr.push(`/cyberine-taskboard:tasks: ${t.id} has been [doing] for ${age.toFixed(1)}d (stale threshold ${view.threshold}d) -- confirm it is still active`);
  }
  if (summary) {
    let line = `[taskboard] ${basename(paths.root)} \xB7 ${doing.length} doing \xB7 ${todo.length} todo \xB7 ${backlog.length} backlog${ready.length ? ` (${ready.length} ready)` : ""}`;
    if (blocked.length) line += ` \xB7 ${blocked.length} blocked`;
    if (view.stale.length) line += ` \xB7 ${view.stale.length} stale-doing`;
    if (forbidden.length) line += ` \xB7 ${forbidden.length} FORBIDDEN`;
    if (unknown.length) line += ` \xB7 ${unknown.length} UNKNOWN-STATUS`;
    if (view.recurringDue) line += ` \xB7 ${view.recurringDue} recurring DUE`;
    if (view.ownerActionable.length || view.ownerWaiting.length) {
      line += ` \xB7 ${view.ownerActionable.length} owner${view.ownerWaiting.length ? ` (${view.ownerWaiting.length} waiting)` : ""}`;
    }
    if (view.pending) line += ` \xB7 ${view.pending} status flip${view.pending === 1 ? "" : "s"} not yet in the headers`;
    if (view.unreviewedDecisions.length) line += ` \xB7 ${view.unreviewedDecisions.length} unreviewed decisions (report them, then /cyberine-taskboard:tasks decide --ack <ref...>)`;
    const scopeNote = view.scope ? ` (scope ${view.scope}/: read it with /cyberine-taskboard:tasks status, never by opening the file)` : "";
    return { stdout: `${line} \u2192 ${paths.manifest}${scopeNote}
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
  if (view.pending) head += ` \xB7 ${view.pending} status flip${view.pending === 1 ? "" : "s"} not yet in the headers`;
  lines.push(head, "---");
  if (view.unreviewedDecisions.length) {
    lines.push(`${view.unreviewedDecisions.length} unreviewed decisions (report them, then /cyberine-taskboard:tasks decide --ack <ref...>)`, ...unreviewedDecisionLines(view.unreviewedDecisions), "");
  }
  const section = (title, entries) => {
    if (!entries.length) return;
    lines.push(`[${title}]`, ...entries, "");
  };
  section("doing", doing.map((t) => `${t.id} [doing] ${t.title}${t.owner ? `  (\xAB${t.owner}\xBB)` : ""}`));
  section("todo", todo.map((t) => `${t.id} [todo] ${t.title}`));
  section("waiting on deps", waitingDeps.map((t) => `${t.id} [todo] ${t.title} -- waiting on: ${t.missing.join(", ")}`));
  section(
    `owner: ${view.ownerActionable.length} actionable, ${view.ownerWaiting.length} waiting`,
    view.ownerActionable.length ? view.ownerActionable.map((t) => `${t.id} ${t.title}`) : view.ownerWaiting.length ? ["(none actionable now)"] : []
  );
  section("blocked", blocked.map((t) => `${t.id} [blocked] ${t.title} -- ${t.blocker}`));
  section("backlog", backlog.map((t) => `${t.id} [backlog] ${t.title}${ready.includes(t) ? "  (ready)" : ""}`));
  section("done", done.map((t) => `${t.id} [done] ${t.title}`));
  const days = recentDoneDays();
  section(`recently done (${days}d, archived included)`, recentDoneTasks(paths, view, days).map((t) => `${t.id} [done ${t.completed}] ${t.title}`));
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
  const inputs = [...scopeTopologyInputs(cwd), ...manifestCandidates(paths.root), paths.log, paths.statusDir, paths.archive, paths.journalDir, ...listJournalDays(paths).map((day) => join(paths.journalDir, `${day}.jsonl`))];
  if (!existsSync(paths.manifest)) return { banner: "", inputs };
  const view = boardView(paths, cwd, false);
  if (view.all.length === 0 && view.recurring.length === 0 && view.unreviewedDecisions.length === 0) return { banner: "", inputs };
  const lines = [boardStatusView(paths, cwd, true, false).stdout.trimEnd()];
  const next = view.doing[0] ?? view.todo[0];
  if (next) {
    const epoch = next.created ? createdEpoch(next.created) : null;
    const age = epoch === null ? "" : `  (created ${next.created}, ${Math.floor((Date.now() / 1e3 - epoch) / 86400)}d ago)`;
    lines.push(`Resume: ${next.id}: ${next.title}${age}  (/cyberine-taskboard:tasks for the full view)`);
  }
  const days = recentDoneDays();
  const recentLine = recentDoneBannerLine(recentDoneTasks(paths, view, days), days);
  if (recentLine) lines.push(recentLine);
  if (view.recurringDue) {
    lines.push(`${view.recurringDue} recurring task(s) due -- /cyberine-taskboard:tasks recurring list to see; /cyberine-taskboard:tasks status did <Rxx> after running.`);
  }
  return { banner: `${lines.join("\n")}
`, inputs };
}

export {
  recurringEntries,
  healthLines,
  ownerSplit,
  boardView,
  RECENT_DONE_DEFAULT_DAYS,
  recentDoneDays,
  recentDoneTasks,
  recentDoneBannerLine,
  boardStatusView,
  boardBannerView
};
