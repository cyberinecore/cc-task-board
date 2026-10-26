#!/usr/bin/env node

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
var OWNER_TASK_PROVISION_RE = /\bfund\w*|\w*api[_ -]?key\b|\.env\b/i;
var OPEN_OWNER_STATUSES = /* @__PURE__ */ new Set(["backlog", "todo", "doing", "blocked"]);
function depIds(b) {
  return (b.fields.get("deps") ?? "").split(/[,\s]+/).filter((s) => s !== "" && s !== "-");
}
function ownerTaskClasses(b) {
  const text = `${b.title.replace(OWNER_TITLE_RE, "")} ${b.fields.get("do") ?? ""}`;
  const out = /* @__PURE__ */ new Set();
  if (DECIDE_RE.test(text)) out.add("decide");
  if (PROVISION_RE.test(text) || OWNER_TASK_PROVISION_RE.test(text)) out.add("provision");
  if (OPERATOR_PHRASE_RE.test(text)) out.add("operator-action");
  return out;
}
function coveredByOpenOwnerDep(b, cls, ctx) {
  const byId = new Map(ctx.blocks.map((x) => [x.id, x]));
  const isOpen = (x) => OPEN_OWNER_STATUSES.has((ctx.statusOf ? ctx.statusOf(x.id) : x.status) ?? "");
  const seen = /* @__PURE__ */ new Set([b.id]);
  const queue = depIds(b);
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = byId.get(id);
    if (dep === void 0 || !isOpen(dep)) continue;
    const isOwnerTask = OWNER_TITLE_RE.test(dep.title) && (dep.fields.get("exec")?.trim() ?? "") === "manual";
    if (isOwnerTask && ownerTaskClasses(dep).has(cls)) return true;
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
  const findings = ownerMixFindings(input).filter(
    (f) => !(ctx !== void 0 && f.kind === "agent-needs-owner" && f.class !== null && coveredByOpenOwnerDep(b, f.class, ctx))
  );
  const issues = ownerMixIssueLines(b.id, findings);
  return issues.length > 0 ? { id: b.id, issues } : null;
}
function ownerMixSectionLines(entries) {
  const lines = [];
  for (const e of entries) for (const issue of e.issues) lines.push(ownerMixLine(e.id, issue));
  return lines;
}

export {
  OWNER_TITLE_RE,
  classifyOwnerNeed,
  ownerMixForBlock,
  ownerMixSectionLines
};
