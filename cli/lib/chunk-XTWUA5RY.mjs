#!/usr/bin/env node
import {
  ownerMixForBlock,
  ownerMixSectionLines
} from "./chunk-UV3X3JLP.mjs";
import {
  ID_SHAPE_RULE,
  KNOWN_HEADER_ID_RE,
  TASK_ID_RE,
  epochToIsoForTz,
  fencedLineFlags,
  looksLikeABoard,
  nonBlankLineCount,
  orderOverlayLines,
  overlaySources,
  parseManifestBlocks
} from "./chunk-KIJLE46J.mjs";

// src/tasks/boardDoctor.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// src/tasks/taskQuality.ts
var ABBREVIATION_RE = /\b(?:e\.g|i\.e|etc|vs|cf|approx|incl)\./gi;
var TERMINATOR_RE = /[.!?](?=\s|$)/g;
function doSentenceCount(doText) {
  const prose = doText.replace(/`[^`]*`/g, "CODE").replace(ABBREVIATION_RE, "ABBR").replace(/\b\d+\.\d+/g, "NUM").trim();
  if (prose === "") return 0;
  const terminators = prose.match(TERMINATOR_RE)?.length ?? 0;
  const endsTerminated = /[.!?]$/.test(prose);
  return terminators + (endsTerminated ? 0 : 1);
}
function missingBriefIssues(task) {
  if ((task.effort === "M" || task.effort === "L") && !task.hasBrief) {
    return [`effort ${task.effort} task has no brief (write one with --brief <text> or --brief-file <path|->, or through save)`];
  }
  return [];
}
function taskQualityIssues(task) {
  const issues = [];
  const sentences = doSentenceCount(task.do.trim());
  if (sentences > 1) issues.push(`do: reads as ${sentences} sentences (the manifest standard is one imperative sentence; move detail into the brief)`);
  return [...issues, ...missingBriefIssues(task)];
}
function missingVerifyIssues(task) {
  if ((task.exec ?? "agent") !== "agent") return [];
  if (typeof task.verify === "string" && task.verify.trim() !== "") return [];
  return ['exec agent task has no verify command; add "verify": "<command that exits 0 when done>" to the save item (e.g. "verify": "npm run typecheck"), or run /cyberine-taskboard:tasks set <id> --verify "<cmd>"'];
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
    })).filter((q) => q.issues.length > 0),
    ownerMixed: manifestTasks.filter((b) => b.status === "todo" || b.status === "doing" || b.status === "backlog").filter((b) => (b.fields.get("duplicate-of")?.trim() ?? "") === "" || b.fields.get("duplicate-of")?.trim() === "-").map((b) => ownerMixForBlock(b, { blocks: manifestTasks })).filter((e) => e !== null)
  };
}
function listBriefIds(dir) {
  if (!existsSync(dir)) return [];
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
    manifestSrc: existsSync(paths.manifest) ? readFileSync(paths.manifest, "utf8") : "",
    archiveSrc: existsSync(paths.archive) ? readFileSync(paths.archive, "utf8") : "",
    briefIds: listBriefIds(paths.tasksDir),
    archiveBriefIds: listBriefIds(join(paths.tasksDir, "archive")),
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
  lines.push("");
  lines.push(`11) Owner-mixed tasks: ${r.ownerMixed.length} (advisory -- a warning, never a blocker; never fails this report)`);
  for (const line of ownerMixSectionLines(r.ownerMixed)) lines.push(line);
  return lines.join("\n");
}

export {
  missingBriefIssues,
  missingVerifyIssues,
  LOWER_BOUND_NOTE,
  findHeldFlips,
  hasBlockingFindings,
  findPrefixPairs,
  scanRawHeaders,
  analyze,
  gatherDoctorInputs,
  formatReport
};
