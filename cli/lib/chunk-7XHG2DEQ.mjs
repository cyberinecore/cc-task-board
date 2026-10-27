#!/usr/bin/env node

// src/tasks/boardSource.ts
var SOURCE_RE = /^(?:user|agent|peer:[A-Za-z0-9][A-Za-z0-9._@-]*)$/;
var UNVERIFIED = "no";
var SOURCE_SHAPE_HINT = "peer:<session> | user | agent";
function isPeerSource(source) {
  return typeof source === "string" && source.startsWith("peer:");
}
function isUnverified(verified) {
  return typeof verified === "string" && verified.trim().toLowerCase() === UNVERIFIED;
}
function sourceIssues(source, verified) {
  const issues = [];
  const hasSource = source !== void 0 && source !== null;
  const hasVerified = verified !== void 0 && verified !== null;
  if (hasSource && (typeof source !== "string" || !SOURCE_RE.test(source))) {
    issues.push(`source ${JSON.stringify(source)} is not valid -- use ${SOURCE_SHAPE_HINT} (a peer session name has letters, digits, . _ @ -)`);
  }
  if (hasVerified) {
    if (typeof verified !== "string" || verified.trim() === "") {
      issues.push('verified must be a non-empty string: how the claim was checked, or "no"');
    } else if (/[\r\n]/.test(verified)) {
      issues.push("verified must be a single line");
    }
  }
  if (!hasSource && hasVerified) issues.push("verified needs a source -- it records how that source's claim was checked");
  if (hasSource && typeof source === "string" && isPeerSource(source) && !hasVerified) {
    issues.push(`a peer source needs verified: how the claim was checked against the repo or the screen, or "${UNVERIFIED}" when it was not`);
  }
  return issues;
}
function resolveProvenance(flags) {
  const errors = [];
  if (flags.verified !== void 0 && flags.unverified) {
    errors.push("--verified and --unverified are mutually exclusive");
  }
  if (flags.verified !== void 0 && isUnverified(flags.verified)) {
    errors.push('--verified "no" is the unverified marker -- pass --unverified instead');
  }
  const verified = flags.unverified ? UNVERIFIED : flags.verified;
  if (errors.length === 0) errors.push(...sourceIssues(flags.source, verified));
  return {
    ...flags.source !== void 0 && { source: flags.source },
    ...verified !== void 0 && { verified },
    errors
  };
}
function noteSuffix(source, verified) {
  if (source === void 0) return "";
  return ` [source: ${source}${verified !== void 0 ? `; verified: ${verified}` : ""}]`;
}
var NOTE_SOURCE_RE = /\[source: (peer:[^;\]\s]+)(?:; verified: (.*))?\]\s*$/;
var UPDATE_LINE_RE = /^update (\d{4}-\d{2}-\d{2}): /;
function peerClaimNeedsReview(verified) {
  return verified === null || verified.trim() === "" || isUnverified(verified);
}

// src/tasks/ownerMix.ts
var OWNER_TITLE_RE = /^\s*Owner:/i;
var DECIDE_RE = /\b(decid\w*|decision|choose|pick a|pick one|rule on|ruling|settle|sign-?off|keep or|which of)\b/i;
var PROVISION_RE = /\b(api[- ]key|credential\w*|secret|funded?|funding|purchase|subscri\w+|provision\w*|billing|create the (?:public )?repo|domain|account)\b/i;
var OPERATOR_PHRASE_RE = /\boperator[- ](?:only|check|decision|live)\b/i;
var OPERATOR_RE = /^\s*(?:operator|owner)\b|\boperator[- ](?:only|check|decision|live)\b/i;
function classifyOwnerNeed(text) {
  const decide = DECIDE_RE.exec(text);
  if (decide) return { class: "decide", match: decide[0] };
  const provision = PROVISION_RE.exec(text);
  if (provision) return { class: "provision", match: provision[0] };
  const operator = OPERATOR_RE.exec(text);
  if (operator) return { class: "operator-action", match: operator[0].trim() };
  return null;
}
var OWNER_DECIDE_TITLE_RE = /^\s*Owner:\s*decide\b/i;
function isOwnerDecideTitle(title) {
  if (OWNER_DECIDE_TITLE_RE.test(title)) return true;
  return OWNER_TITLE_RE.test(title) && classifyOwnerNeed(title)?.class === "decide";
}
function presentField(value) {
  const v = value?.trim() ?? "";
  return v !== "" && v !== "-";
}
function missingDecideFields(title, fields) {
  if (!isOwnerDecideTitle(title)) return [];
  const missing = [];
  if (!presentField(fields.default)) missing.push("default");
  if (!presentField(fields.undoCost)) missing.push("undo-cost");
  return missing;
}
var OWNER_PARTY_RE = /\b(?:owner|operator|stakeholder)(?:'s|s')?\b/i;
var CODE_BEFORE_RE = /\b(?:validat\w*|pars\w*|redact\w*|mask\w*|scrub\w*|sanitiz\w*|detect\w*|lint\w*|format\w*|handl\w*|mock\w*|stub\w*|fake\w*|load\w*|read\w*|resolv\w*|encrypt\w*|hash\w*|stor(?:e|es|ing)|test\w*|fixture\w*|into|extend\w*|separat\w*|record\w*|track\w*|attribut\w*)\b[^,;]*$/i;
var CODE_AFTER_RE = /^[-\s\w]{0,14}?\b(?:parser|parsing|parse|format|formats|validation|validator|validators|validate|model|models|schema|schemas|type|types|handling|handler|redaction|masking|regex|lookup|loader|loading|class|field|fields|helper|logic|layer|entity|entities|object|objects|checker|string|strings|specific|script|scripts|module|code|manifest|template|page|ui|view|screen|component|endpoint|table|calculation|record|records|provenance|kind|task|tasks|row|rows|id|ids|selection|contract|routing|root|dir)\b/i;
var CONFIG_CONTEXT_RE = /\b(?:env|environment|config|configured|configurable|template|placeholder|fails?|errors?|throws?|missing|unset|absent|empty|filled|fill|later|pending|gitignored)\b/i;
var SUBSCRIBE_VERB_RE = /^subscri(?:be|bes|bed|bing|ber|bers)$/i;
var ACCOUNT_FOR_RE = /^\s+for\b/i;
function codeContext(clause, index, matchText) {
  const before = clause.slice(Math.max(0, index - 40), index);
  const after = clause.slice(index + matchText.length, index + matchText.length + 40);
  if (CODE_BEFORE_RE.test(before)) return true;
  if (CODE_AFTER_RE.test(after)) return true;
  if (/^account$/i.test(matchText) && ACCOUNT_FOR_RE.test(after)) return true;
  if (SUBSCRIBE_VERB_RE.test(matchText)) return true;
  return false;
}
var TEST_DESCRIPTION_RE = /\b(?:smoke|fake-board|fixtures?|warnings?|lint|selftest)\b/i;
function strictOwnerNeed(clause) {
  if (TEST_DESCRIPTION_RE.test(clause)) return null;
  const decide = DECIDE_RE.exec(clause);
  if (decide && OWNER_PARTY_RE.test(clause)) return { class: "decide", match: decide[0] };
  if (!CONFIG_CONTEXT_RE.test(clause)) {
    const globalRe = new RegExp(PROVISION_RE.source, "gi");
    for (const m of clause.matchAll(globalRe)) {
      if (!codeContext(clause, m.index ?? 0, m[0])) return { class: "provision", match: m[0] };
    }
  }
  const phrase = OPERATOR_PHRASE_RE.exec(clause);
  if (phrase) return { class: "operator-action", match: phrase[0] };
  return null;
}
var AGENT_STEP_PATTERNS = [
  /\b(?:run|execute|trigger)\s+(?:the\s+|a\s+|an\s+)?(?:[\w-]+\s+){0,2}(?:script|benchmark|bench|build|tests?|test suite|migration|linter|typecheck|codegen|generator)\b/i,
  /\b(?:build|compile|bundle)\s+(?:the\s+)?(?:app|project|image|binary|bundle|package|site|docs)\b/i,
  /\b(?:write|implement|code|refactor|add)\s+(?:the\s+|a\s+|an\s+|some\s+)?(?:[\w-]+\s+){0,3}(?:code|script|function|endpoint|module|class|component|tests?|unit tests|migration|handler|parser|adapter|feature|schema)\b/i,
  /\b(?:edit|update|change|modify)\s+(?:the\s+|a\s+)?(?:[\w-]+\s+)?config(?:uration)?\b/i,
  /`(?:npm|npx|pnpm|yarn|bun|tsx|make|pytest|cargo)\b[^`]*`/i
];
var OWNER_ONLY_CLAUSE_RE = /\.env\b|\bsecrets?\b|\bkeys?\b|\bcredentials?\b|\b(?:decide|whether|approve|confirm)\b/i;
function agentStep(clause) {
  if (OWNER_ONLY_CLAUSE_RE.test(clause)) return null;
  for (const re of AGENT_STEP_PATTERNS) {
    const m = re.exec(clause);
    if (m) return m[0];
  }
  return null;
}
var CLAUSE_SPLIT_RE = /\.(?=\s|$)|[;\n]|\s+(?:and then|then|and)\s+/i;
var QUOTE_MAX = 100;
function clip(s) {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX - 3)}...` : flat;
}
function clausesOf(text) {
  return text.split(CLAUSE_SPLIT_RE).map((c) => c.trim().replace(/[,:\s]+$/, "")).filter((c) => c !== "");
}
function ownerMixFindings(task) {
  const exec = task.exec?.trim() || "agent";
  const out = [];
  const fields = [
    { field: "blocker", text: task.blocker },
    { field: "title", text: task.title },
    { field: "do", text: task.do },
    { field: "done-when", text: task.doneWhen }
  ];
  if (exec === "manual") {
    for (const { field, text } of fields) {
      if (field === "blocker" || text === void 0) continue;
      for (const clause of clausesOf(text)) {
        const match = agentStep(clause);
        if (match !== null) {
          out.push({ kind: "manual-bundles-agent", field, match, clause, class: null });
          break;
        }
      }
    }
    return out;
  }
  if (OWNER_TITLE_RE.test(task.title)) return out;
  for (const { field, text } of fields) {
    const value = text?.trim();
    if (value === void 0 || value === "" || value === "-") continue;
    if (field === "blocker") {
      const need = classifyOwnerNeed(value);
      if (need !== null) out.push({ kind: "agent-needs-owner", field, match: need.match, clause: value, class: need.class });
      continue;
    }
    for (const clause of clausesOf(value)) {
      const need = strictOwnerNeed(clause);
      if (need !== null) {
        out.push({ kind: "agent-needs-owner", field, match: need.match, clause, class: need.class });
        break;
      }
    }
  }
  return out;
}
function ownerMixIssueLines(id, findings) {
  const fix = `split it: /cyberine-taskboard:tasks split ${id} --input <file> --dry (see /cyberine-taskboard:tasks split --schema)`;
  return findings.map(
    (f) => f.kind === "agent-needs-owner" ? `owner-mixed: agent task needs owner input (${f.class}) -- ${f.field} "${clip(f.clause)}", matched "${f.match}"; ${fix}` : `owner-mixed: manual task bundles agent-runnable work -- ${f.field} "${clip(f.clause)}", matched "${f.match}"; ${fix}`
  );
}
function ownerMixLine(id, issue) {
  return `  ${id}  ${issue}`;
}
function depIds(b) {
  return (b.fields.get("deps") ?? "").split(/[,\s]+/).filter((s) => s !== "" && s !== "-");
}
function isOwnerTaskBlock(b) {
  if (OWNER_TITLE_RE.test(b.title)) return true;
  if ((b.fields.get("exec")?.trim() ?? "") !== "manual") return false;
  return !ownerMixFindings({
    title: b.title,
    exec: "manual",
    do: b.fields.get("do") ?? "",
    doneWhen: b.fields.get("done-when"),
    blocker: b.fields.get("blocker")
  }).some((f) => f.kind === "manual-bundles-agent");
}
function carriesOwnerPart(b, ctx) {
  const byId = /* @__PURE__ */ new Map();
  for (const x of ctx.archiveBlocks ?? []) byId.set(x.id, x);
  for (const x of ctx.blocks) byId.set(x.id, x);
  const seen = /* @__PURE__ */ new Set([b.id]);
  const queue = depIds(b);
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = byId.get(id);
    if (dep === void 0) continue;
    if (isOwnerTaskBlock(dep)) return true;
    queue.push(...depIds(dep));
  }
  return false;
}
function ownerMixForBlock(b, ctx) {
  const input = {
    title: b.title,
    exec: b.fields.get("exec"),
    do: b.fields.get("do") ?? "",
    doneWhen: b.fields.get("done-when"),
    blocker: b.fields.get("blocker")
  };
  const covered = ctx !== void 0 && carriesOwnerPart(b, ctx);
  const findings = ownerMixFindings(input).filter((f) => !(covered && f.kind === "agent-needs-owner"));
  const issues = ownerMixIssueLines(b.id, findings);
  return issues.length > 0 ? { id: b.id, issues } : null;
}
function ownerMixSectionLines(entries) {
  const lines = [];
  for (const e of entries) for (const issue of e.issues) lines.push(ownerMixLine(e.id, issue));
  return lines;
}

// src/tasks/boardWaitsOn.ts
var WAITS_ON_SHAPE = "user | repo:<path> | session:<name> | upstream:<vendor> | event:<what>";
var SESSION_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._@:-]*$/;
function hasControlChar(text) {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
function waitsOnError(raw) {
  const v = raw.trim();
  if (v === "") return `waits-on must not be empty (use ${WAITS_ON_SHAPE}, or "-" to clear it)`;
  if (v === "user") return null;
  if (v.startsWith("repo:")) {
    const path = v.slice("repo:".length);
    if (path.trim() === "" || path !== path.trim() || hasControlChar(path)) {
      return `waits-on "${v}": repo: needs one non-empty path on a single line, with no leading or trailing space`;
    }
    return null;
  }
  if (v.startsWith("session:")) {
    const name = v.slice("session:".length);
    if (!SESSION_NAME_RE.test(name)) {
      return `waits-on "${v}": session: needs a name of letters, digits, ".", "_", "-", "@" or ":", starting with a letter or digit`;
    }
    return null;
  }
  if (v.startsWith("upstream:")) {
    const vendor = v.slice("upstream:".length);
    if (!SESSION_NAME_RE.test(vendor)) {
      return `waits-on "${v}": upstream: needs a vendor name of letters, digits, ".", "_", "-", "@" or ":", starting with a letter or digit`;
    }
    return null;
  }
  if (v.startsWith("event:")) {
    const what = v.slice("event:".length);
    if (what.trim() === "" || what !== what.trim() || hasControlChar(what)) {
      return `waits-on "${v}": event: needs one non-empty description on a single line, with no leading or trailing space`;
    }
    return null;
  }
  return `waits-on "${v}" is not one of ${WAITS_ON_SHAPE}`;
}
var OWNER_NAMED_RE = /(?:^|[^A-Za-z0-9_])(?:user|owner|operator|human|waits-on)(?![A-Za-z0-9_])|(?:^|[^A-Za-z0-9_])(?:repo|session):\S/i;
function blockerNamesOwner(blocker) {
  return OWNER_NAMED_RE.test(blocker);
}
function waitsOnOf(raw) {
  const v = (raw ?? "").trim();
  return v === "" || v === "-" ? "" : v;
}

export {
  isPeerSource,
  sourceIssues,
  resolveProvenance,
  noteSuffix,
  NOTE_SOURCE_RE,
  UPDATE_LINE_RE,
  peerClaimNeedsReview,
  OWNER_TITLE_RE,
  classifyOwnerNeed,
  isOwnerDecideTitle,
  missingDecideFields,
  ownerMixForBlock,
  ownerMixSectionLines,
  WAITS_ON_SHAPE,
  waitsOnError,
  blockerNamesOwner,
  waitsOnOf
};
