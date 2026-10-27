#!/usr/bin/env node
import {
  archivedBlocks,
  archivedIds,
  mergeIds,
  readLedger,
  setDeps
} from "./chunk-T636BNCF.mjs";
import {
  OWNER_TITLE_RE,
  classifyOwnerNeed,
  ownerMixForBlock,
  ownerMixSectionLines
} from "./chunk-7XHG2DEQ.mjs";
import {
  lockAndMigrate,
  planReconcile,
  reconcileLocked,
  unlock
} from "./chunk-3V2BXNFG.mjs";
import {
  TASK_ID_RE,
  TASK_ID_SOURCE,
  TASK_STATUSES,
  danglingTaskPath,
  fencedLineFlags,
  normalizeTaskPath,
  parseManifestBlocks,
  readOverlayText,
  writeFileAtomic
} from "./chunk-GIU6R332.mjs";

// src/tasks/boardHygiene.ts
import { existsSync, readFileSync as readFileSync2 } from "node:fs";
import { join } from "node:path";

// src/tasks/boardTidy.ts
import { readFileSync } from "node:fs";
var TIDY_MARKER = "<!-- ===== FORBIDDEN \u2014 never run, permanent tombstones (board tidy) ===== -->";
var ANY_TIDY_MARKER_RE = /^<!-- ===== FORBIDDEN — never run, permanent tombstones \([a-z /:-]*(?:tasks|board) tidy\) ===== -->$/;
var TOKENS_HEADER = "<!-- Task board manifest v1. Status tokens: [backlog] [todo] [doing] [done] [forbidden]. -->";
var STALE_HEADER_NOTE = "<!-- The [status] bracket can lag the overlay: a status flip lands in the overlay first and reaches this header only at reconcile, so read status through the CLI (status --json), never by grepping headers. -->";
var STALE_HEADER_MARKER = "can lag the overlay";
var FORBIDDEN_HEADER_RE = new RegExp(`^## ${TASK_ID_SOURCE} \\[forbidden\\]`);
var CANDIDATE_HEADER_RE = new RegExp(`^## (${TASK_ID_SOURCE}) \\[(todo|backlog)\\]`);
var TITLE_STRIP_RE = new RegExp(`^## ${TASK_ID_SOURCE} \\[[a-z]+\\] `);
function splitLines(src) {
  return src.endsWith("\n") ? src.slice(0, -1).split("\n") : src.split("\n");
}
function writeManifestSafely(manifest, out) {
  if (out.length === 0) return false;
  writeFileAtomic(manifest, out, "tidy");
  return true;
}
function refreshHeaderTokens(src) {
  const lines = splitLines(src);
  const hasTokensLine = lines.some((l) => l.includes("Status tokens:"));
  const hasForbiddenTokensLine = lines.some((l) => l.includes("Status tokens:") && l.includes("[forbidden]"));
  if (!hasTokensLine || hasForbiddenTokensLine) return null;
  let done = false;
  const out = lines.map((l) => {
    if (!done && /^<!--/.test(l) && l.includes("Status tokens:")) {
      done = true;
      return TOKENS_HEADER;
    }
    return l;
  });
  return out.join("\n") + (src.endsWith("\n") ? "\n" : "");
}
function ensureStaleHeaderNote(src) {
  const lines = splitLines(src);
  if (lines.some((l) => /^<!--/.test(l) && l.includes(STALE_HEADER_MARKER))) return null;
  const anchor = lines.findIndex((l) => /^<!--/.test(l) && l.includes("Task header format is parsed"));
  const fallback = lines.findIndex((l) => /^<!--/.test(l) && l.includes("Status tokens:"));
  const at = anchor !== -1 ? anchor : fallback;
  if (at === -1) return null;
  lines.splice(at + 1, 0, STALE_HEADER_NOTE);
  return lines.join("\n") + (src.endsWith("\n") ? "\n" : "");
}
function addStaleHeaderNoteLocked(manifest) {
  const out = ensureStaleHeaderNote(readFileSync(manifest, "utf8"));
  return out !== null && writeManifestSafely(manifest, out);
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
function refreshHeaderTokensPreview(src) {
  return refreshHeaderTokens(src) !== null;
}
function groupForbiddenPreview(src) {
  const grouped = groupForbidden(src);
  return grouped !== null && grouped.out !== src;
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
function tidyBoard(paths, keep) {
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new Error("tidy: could not acquire the board lock -- nothing changed");
  }
  let changed = false;
  let refreshedHeader = false;
  let groupedCount = 0;
  try {
    if (!reconcileLocked(paths, keep)) {
      throw new Error("tidy: reconcile failed, so the manifest is not in a known state -- nothing changed");
    }
    {
      const src2 = readFileSync(paths.manifest, "utf8");
      const out = refreshHeaderTokens(src2);
      if (out !== null && writeManifestSafely(paths.manifest, out)) {
        refreshedHeader = true;
        changed = true;
      }
    }
    {
      const src2 = readFileSync(paths.manifest, "utf8");
      const out = ensureStaleHeaderNote(src2);
      if (out !== null && writeManifestSafely(paths.manifest, out)) {
        refreshedHeader = true;
        changed = true;
      }
    }
    {
      const src2 = readFileSync(paths.manifest, "utf8");
      const grouped = groupForbidden(src2);
      if (grouped && writeManifestSafely(paths.manifest, grouped.out)) {
        groupedCount = grouped.count;
        changed = true;
      }
    }
  } finally {
    unlock(paths.lock);
  }
  const src = readFileSync(paths.manifest, "utf8");
  const candidates = findCandidates(src);
  return { refreshedHeader, groupedCount, candidates, changed };
}

// src/tasks/boardHygiene.ts
var HYGIENE_SCHEMA = "board-hygiene/1";
var LIVE_STATUSES = /* @__PURE__ */ new Set(["todo", "doing", "backlog"]);
var STATUS_RANK = { doing: 3, todo: 2, backlog: 1 };
var NEAR_THRESHOLD = 0.8;
var NEAR_LIMIT = 1500;
var UPDATE_LINE_RE = /^update \d{4}-\d{2}-\d{2}:\s*(.*)$/;
var UPDATE_DECISION_RE = /\b(?:awaiting|waiting (?:on|for)|needs?|pending|blocked on)\b[^.;]{0,60}\b(?:decision|ruling|operator|owner)\b/i;
var TITLE_DECISION_RE = /\b(decide|decision|choose|ruling)\b/i;
function splitDeps(raw) {
  if (raw === void 0) return [];
  return raw.split(/[,\s]+/).filter((s) => s !== "" && s !== "-");
}
function normalizeText(s) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function exactText(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function classify(text) {
  return classifyOwnerNeed(text)?.class ?? null;
}
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function buildContext(paths) {
  const src = readFileSync2(paths.manifest, "utf8");
  const { blocks } = parseManifestBlocks(src, TASK_ID_RE);
  const rawLog = readOverlayText(paths);
  const plan = planReconcile(paths, rawLog, src);
  const effective = /* @__PURE__ */ new Map();
  for (const b of blocks) {
    const ov = plan.overlay.get(b.id);
    effective.set(b.id, ov !== void 0 && !plan.refusedHeaders.has(b.id) ? ov : b.status ?? "");
  }
  const archive = archivedIds(paths.archive);
  const universe = /* @__PURE__ */ new Set([...blocks.map((b) => b.id), ...archive]);
  return { src, blocks, effective, archive, universe };
}
function liveBlocks(ctx) {
  return ctx.blocks.filter((b) => {
    if (b.malformed) return false;
    if (!LIVE_STATUSES.has(ctx.effective.get(b.id) ?? "")) return false;
    const dup = b.fields.get("duplicate-of")?.trim();
    return !(dup && dup !== "-");
  });
}
function staleHeaders(paths, ctx) {
  const plan = planReconcile(paths, readOverlayText(paths), ctx.src);
  const out = [];
  for (const b of ctx.blocks) {
    if (b.malformed || b.status === null) continue;
    const ov = plan.overlay.get(b.id);
    if (ov === void 0 || plan.refusedHeaders.has(b.id)) continue;
    if (!TASK_STATUSES.includes(ov)) continue;
    if (ov !== b.status) out.push({ id: b.id, header: b.status, effective: ov });
  }
  return out;
}
function ledgerSurvivor(paths, dead, universe) {
  const merged = readLedger(paths.ledger).filter((e) => e.verdict === "merged");
  let cur = dead;
  const seen = /* @__PURE__ */ new Set([dead]);
  for (let hop = 0; hop < 12; hop++) {
    const targets = [...new Set(merged.filter((e) => e.a === cur).map((e) => e.b))];
    if (targets.length === 0) break;
    if (targets.length > 1) return { target: null, via: `ledger lists ${cur} merged into several ids (${targets.join(", ")})` };
    cur = targets[0];
    if (seen.has(cur)) return { target: null, via: "ledger merge chain loops" };
    seen.add(cur);
    if (universe.has(cur)) return { target: cur, via: `merged into ${cur} (dedupe ledger)` };
  }
  return { target: null, via: "no replacement known" };
}
function deadDeps(paths, ctx) {
  const out = [];
  for (const b of ctx.blocks) {
    if (b.malformed) continue;
    const st = ctx.effective.get(b.id) ?? "";
    if (st === "done" || st === "forbidden") continue;
    for (const dep of splitDeps(b.fields.get("deps"))) {
      if (ctx.universe.has(dep)) continue;
      let replacement = null;
      let via;
      const ledger = ledgerSurvivor(paths, dep, ctx.universe);
      if (ledger.target !== null) {
        replacement = ledger.target;
        via = ledger.via;
      } else {
        const cased = [dep.toUpperCase(), dep.toLowerCase()].filter((c) => c !== dep && ctx.universe.has(c));
        if (cased.length === 1) {
          replacement = cased[0];
          via = `same id in the other letter case (${cased[0]})`;
        } else {
          via = ledger.via;
        }
      }
      if (replacement === b.id) {
        replacement = null;
        via = "the only replacement is the task itself";
      }
      out.push({ id: b.id, dep, replacement, via });
    }
  }
  return out;
}
function duplicates(paths, ctx) {
  const live = liveBlocks(ctx);
  const ledgerPairs = new Set(readLedger(paths.ledger).map((e) => pairKey(e.a, e.b)));
  const dependents = /* @__PURE__ */ new Map();
  for (const b of ctx.blocks) for (const d of splitDeps(b.fields.get("deps"))) dependents.set(d, (dependents.get(d) ?? 0) + 1);
  const position = new Map(ctx.blocks.map((b, i) => [b.id, i]));
  const hasBrief = (id) => existsSync(join(paths.tasksDir, `${id}.md`));
  const survivorOf = (group) => {
    const ranked = [...group].sort((x, y) => {
      const sx = STATUS_RANK[ctx.effective.get(x.id) ?? ""] ?? 0;
      const sy = STATUS_RANK[ctx.effective.get(y.id) ?? ""] ?? 0;
      if (sx !== sy) return sy - sx;
      const bx = hasBrief(x.id) ? 1 : 0;
      const by = hasBrief(y.id) ? 1 : 0;
      if (bx !== by) return by - bx;
      const dx = dependents.get(x.id) ?? 0;
      const dy = dependents.get(y.id) ?? 0;
      if (dx !== dy) return dy - dx;
      const cx = x.fields.get("created")?.trim() ?? "9999";
      const cy = y.fields.get("created")?.trim() ?? "9999";
      if (cx !== cy) return cx < cy ? -1 : 1;
      return (position.get(x.id) ?? 0) - (position.get(y.id) ?? 0);
    });
    const doingCount = group.filter((g) => ctx.effective.get(g.id) === "doing").length;
    return doingCount > 1 ? null : ranked[0].id;
  };
  const out = [];
  const grouped = /* @__PURE__ */ new Set();
  const exact = /* @__PURE__ */ new Map();
  for (const b of live) {
    const t = exactText(b.title);
    const d = exactText(b.fields.get("do"));
    if (t === "" || d === "") continue;
    const key = `${t}\0${d}\0${normalizeTaskPath(b.fields.get("path"))}`;
    const list = exact.get(key) ?? [];
    list.push(b);
    exact.set(key, list);
  }
  for (const group of exact.values()) {
    if (group.length < 2) continue;
    const rejectedInside = group.some((x, i) => group.slice(i + 1).some((y) => ledgerPairs.has(pairKey(x.id, y.id))));
    if (group.length === 2 && rejectedInside) continue;
    const ranked = survivorOf(group);
    const survivor = rejectedInside ? null : ranked;
    for (const g of group) grouped.add(g.id);
    out.push({
      kind: "exact",
      ids: group.map((g) => g.id),
      survivor,
      reason: rejectedInside ? "same title and same do: text, but the ledger rejects a pair among them, so none is merged automatically" : ranked === null ? "same title and same do: text, several are [doing]" : "same title and same do: text"
    });
  }
  if (live.length <= NEAR_LIMIT) {
    const tokens = new Map(live.map((b) => [b.id, new Set(normalizeText(b.title).split(" ").filter((w) => w.length > 2))]));
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (grouped.has(a.id) && grouped.has(b.id)) continue;
        if (ledgerPairs.has(pairKey(a.id, b.id))) continue;
        if (normalizeTaskPath(a.fields.get("path")) !== normalizeTaskPath(b.fields.get("path"))) continue;
        const ta = normalizeText(a.title);
        const tb = normalizeText(b.title);
        const sameTitle = ta !== "" && ta === tb;
        const score = sameTitle ? 1 : jaccard(tokens.get(a.id), tokens.get(b.id));
        if (score < NEAR_THRESHOLD) continue;
        out.push({
          kind: "near",
          ids: [a.id, b.id],
          survivor: survivorOf([a, b]),
          reason: sameTitle ? "same title, different do: text" : `title word overlap ${score.toFixed(2)}`
        });
      }
    }
  }
  return out;
}
function blockLines(ctx, b) {
  const lines = ctx.src.split("\n");
  const fenced = fencedLineFlags(lines);
  const out = [];
  for (let i = b.start + 1; i < b.end; i++) if (!fenced[i]) out.push({ line: lines[i], index: i });
  return out;
}
function buriedDecisions(ctx) {
  const out = [];
  const ownerTasks = new Set(ctx.blocks.filter((b) => OWNER_TITLE_RE.test(b.title)).map((b) => b.id));
  for (const b of liveBlocks(ctx)) {
    const exec = b.fields.get("exec")?.trim() || "agent";
    if (exec === "manual" || OWNER_TITLE_RE.test(b.title)) continue;
    if (splitDeps(b.fields.get("deps")).some((d) => ownerTasks.has(d))) continue;
    const blocker = b.fields.get("blocker")?.trim();
    if (blocker && blocker !== "-") {
      const cls = classify(blocker);
      if (cls !== null) out.push({ id: b.id, source: "blocker", class: cls, exec, text: blocker });
    }
    if (TITLE_DECISION_RE.test(b.title)) {
      out.push({ id: b.id, source: "title", class: "decide", exec, text: b.title });
    }
    for (const { line } of blockLines(ctx, b)) {
      const m = UPDATE_LINE_RE.exec(line);
      if (m && UPDATE_DECISION_RE.test(m[1])) {
        out.push({ id: b.id, source: "update", class: classify(m[1]) ?? "decide", exec, text: m[1].trim() });
      }
    }
  }
  return out;
}
function ownerMixed(paths, ctx) {
  const out = [];
  const mixCtx = { blocks: ctx.blocks, archiveBlocks: archivedBlocks(paths.archive) };
  for (const b of liveBlocks(ctx)) {
    const entry = ownerMixForBlock(b, mixCtx);
    if (entry !== null) out.push(entry);
  }
  return out;
}
function pathFindings(paths, ctx) {
  const hub = existsSync(join(paths.root, ".gitmodules"));
  const out = [];
  for (const b of liveBlocks(ctx)) {
    const raw = b.fields.get("path")?.trim() ?? "";
    const norm = normalizeTaskPath(raw);
    if (norm === "") {
      if (hub) out.push({ id: b.id, kind: "pathless", path: "" });
    } else if (danglingTaskPath(paths.root, norm)) {
      out.push({ id: b.id, kind: "dangling", path: raw });
    }
  }
  return out;
}
function analyzeHygiene(paths) {
  const ctx = buildContext(paths);
  const forbiddenTotal = ctx.blocks.filter((b) => ctx.effective.get(b.id) === "forbidden" || b.status === "forbidden").length;
  return {
    schema: HYGIENE_SCHEMA,
    staleHeaders: staleHeaders(paths, ctx),
    headerTokensStale: refreshHeaderTokensPreview(ctx.src),
    forbiddenTotal,
    forbiddenUngrouped: groupForbiddenPreview(ctx.src),
    deadDeps: deadDeps(paths, ctx),
    duplicates: duplicates(paths, ctx),
    buriedDecisions: buriedDecisions(ctx),
    ownerMixed: ownerMixed(paths, ctx),
    pathFindings: pathFindings(paths, ctx)
  };
}
function hygieneIsClean(r) {
  return r.staleHeaders.length === 0 && !r.headerTokensStale && !r.forbiddenUngrouped && r.deadDeps.length === 0 && r.duplicates.length === 0 && r.buriedDecisions.length === 0 && r.ownerMixed.length === 0 && r.pathFindings.length === 0;
}
function quote(s, max = 110) {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}
function formatHygiene(r, mode) {
  const lines = [];
  const heading = (n, text) => {
    lines.push("");
    lines.push(`${n}) ${text}`);
  };
  heading(1, `Stale status headers: ${r.staleHeaders.length}${r.headerTokensStale ? " (+ the header token list lacks [forbidden])" : ""}`);
  for (const h of r.staleHeaders) lines.push(`  ${h.id}  manifest says [${h.header}], the overlay says [${h.effective}]`);
  if (r.staleHeaders.length || r.headerTokensStale) lines.push("  fix: /cyberine-taskboard:tasks tidy  (reconcile + header token list + tombstones grouped; --apply runs it)");
  heading(2, `Tombstones: ${r.forbiddenTotal} [forbidden], ${r.forbiddenUngrouped ? "not grouped at the end" : "grouped"}`);
  lines.push("  [forbidden] blocks are permanent: they are grouped, never removed.");
  heading(3, `Dead dep ids: ${r.deadDeps.length}`);
  for (const d of r.deadDeps) {
    lines.push(
      d.replacement ? `  ${d.id}  deps on ${d.dep} (not on the board or archive) -> repoint to ${d.replacement}: ${d.via}` : `  ${d.id}  deps on ${d.dep} (not on the board or archive) -> no unambiguous replacement (${d.via}); decide, then: /cyberine-taskboard:tasks deps set ${d.id} "<ids>"`
    );
  }
  heading(4, `Duplicate candidates: ${r.duplicates.length}`);
  for (const d of r.duplicates) {
    if (d.kind === "exact") {
      lines.push(
        d.survivor ? `  exact  ${d.ids.join(", ")}  (${d.reason}); survivor ${d.survivor}: ${d.ids.filter((i) => i !== d.survivor).map((i) => `/cyberine-taskboard:tasks merge ${i} ${d.survivor}`).join("; ")}` : `  exact  ${d.ids.join(", ")}  (${d.reason}); pick the survivor by hand`
      );
    } else {
      lines.push(
        `  near   ${d.ids.join(", ")}  (${d.reason}); judgement: read both, then \`/cyberine-taskboard:tasks merge <dup> <survivor>\` or \`/cyberine-taskboard:tasks merge --reject ${d.ids[0]} ${d.ids[1]}\``
      );
    }
  }
  heading(5, `Buried decisions: ${r.buriedDecisions.length}`);
  for (const d of r.buriedDecisions) {
    lines.push(`  ${d.id}  ${d.source} (${d.class}, exec ${d.exec}): ${quote(d.text)}`);
  }
  if (r.buriedDecisions.length) {
    lines.push("  fix, per genuine one (judgement, not run by --apply):");
    lines.push("    /cyberine-taskboard:tasks split <id> --input <file> --dry   (shape decision, resource, eyes or convert; see /cyberine-taskboard:tasks split --schema)");
    lines.push("    /cyberine-taskboard:tasks split <id> --input <file>         (the same input without --dry writes it; the blocker goes with amend.blocker: null)");
  }
  heading(6, `Owner-mixed tasks: ${r.ownerMixed.length} (advisory: a warning, never a blocker)`);
  for (const line of ownerMixSectionLines(r.ownerMixed)) lines.push(line);
  heading(7, `Task paths: ${r.pathFindings.length}`);
  for (const f of r.pathFindings) {
    lines.push(
      f.kind === "pathless" ? `  ${f.id}  open hub task with no path: no submodule scope shows it; fix: /cyberine-taskboard:tasks set ${f.id} --path <submodule dir>` : `  ${f.id}  path: ${f.path} no longer exists under the board root; fix: /cyberine-taskboard:tasks set ${f.id} --path <dir> (or --path - to clear it)`
    );
  }
  lines.push("");
  if (hygieneIsClean(r)) lines.push(mode === "preview" ? "hygiene: nothing to fix." : "hygiene: clean.");
  else if (mode === "preview") lines.push("hygiene: preview only, nothing was written. `/cyberine-taskboard:tasks hygiene --apply` runs the mechanical fixes (1, 2, exact duplicates, unambiguous dep repoints).");
  return lines;
}
function applyHygiene(paths, keep) {
  const actions = [];
  const tidy = tidyBoard(paths, keep);
  actions.push({
    kind: "tidy",
    detail: `reconciled the overlay${tidy.refreshedHeader ? ", refreshed the header token list" : ""}${tidy.groupedCount ? `, grouped ${tidy.groupedCount} [forbidden] block(s) at the end` : ""}`,
    state: "done"
  });
  const fresh = analyzeHygiene(paths);
  const byTask = /* @__PURE__ */ new Map();
  for (const d of fresh.deadDeps) byTask.set(d.id, [...byTask.get(d.id) ?? [], d]);
  if (!lockAndMigrate(paths.lock, paths.manifest)) {
    throw new Error("hygiene: could not acquire the board lock for the dep and merge fixes -- tidy was applied, nothing else changed");
  }
  try {
    const manifestDeps = new Map(parseManifestBlocks(readFileSync2(paths.manifest, "utf8"), TASK_ID_RE).blocks.map((b) => [b.id, b]));
    for (const [id, dead] of byTask) {
      if (keep !== void 0 && !keep(id)) {
        actions.push({ kind: "repoint", detail: `${id}: skipped, outside this submodule's scope (run hygiene --apply from the hub root)`, state: "skipped" });
        continue;
      }
      if (dead.some((d) => d.replacement === null)) {
        actions.push({ kind: "repoint", detail: `${id}: skipped, ${dead.filter((d) => d.replacement === null).map((d) => d.dep).join(", ")} has no unambiguous replacement`, state: "skipped" });
        continue;
      }
      const replaceMap = new Map(dead.map((d) => [d.dep, d.replacement]));
      const current = splitDeps(manifestDeps.get(id)?.fields.get("deps"));
      const next = [...new Set(current.map((d) => replaceMap.get(d) ?? d))];
      try {
        actions.push({ kind: "repoint", detail: setDeps(paths, id, next.join(", ")), state: "done" });
      } catch (e) {
        actions.push({ kind: "repoint", detail: `${id}: refused, ${e.message}`, state: "refused" });
      }
    }
    for (const d of analyzeHygiene(paths).duplicates) {
      if (d.kind !== "exact" || d.survivor === null) continue;
      if (keep !== void 0 && !d.ids.every((i) => keep(i))) {
        actions.push({ kind: "merge", detail: `${d.ids.join(", ")}: skipped, not all inside this submodule's scope (run hygiene --apply from the hub root)`, state: "skipped" });
        continue;
      }
      for (const dup of d.ids.filter((i) => i !== d.survivor)) {
        try {
          actions.push({ kind: "merge", detail: mergeIds(paths, dup, d.survivor), state: "done" });
        } catch (e) {
          actions.push({ kind: "merge", detail: `${dup} -> ${d.survivor}: refused, ${e.message}`, state: "refused" });
        }
      }
    }
  } finally {
    unlock(paths.lock);
  }
  return { actions, after: analyzeHygiene(paths) };
}

export {
  addStaleHeaderNoteLocked,
  findCandidates,
  tidyBoard,
  HYGIENE_SCHEMA,
  analyzeHygiene,
  hygieneIsClean,
  formatHygiene,
  applyHygiene
};
