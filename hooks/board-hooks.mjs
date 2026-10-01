#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { psTargets } from './ps-targets.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'tasks.mjs');

const BOARD_MARKERS = [
  'ACTIVE.md',
  'TASKS.md',
  'TASKS_ARCHIVE.md',
  'TASKS_DEDUPE_LEDGER.jsonl',
  'status.log',
  'status.d',
  'journal',
];

const BOARD_FILES = [
  '.local/tasks/ACTIVE.md',
  '.local/tasks/TASKS_ARCHIVE.md',
  '.local/tasks/status.log',
  '.local/tasks/status.d',
  '.local/tasks/journal',
  '.claude/TASKS.md',
  '.claude/TASKS_ARCHIVE.md',
  '.claude/journal',
  '.codex/TASKS.md',
  '.codex/TASKS_ARCHIVE.md',
  '.codex/journal',
];

const BOARD_NAMES = ['.local', '.claude', '.codex', 'tasks', 'ACTIVE.md', 'TASKS.md', 'TASKS_ARCHIVE.md', 'TASKS_DEDUPE_LEDGER.jsonl', 'status.log', 'status.d', 'journal'];
const NAME_EDGE = String.raw`[\s"'\`\\/=(),;|&<>:]`;
const BOARD_NAME_RES = BOARD_NAMES.map((name) => [
  new RegExp(`(^|${NAME_EDGE})${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|${NAME_EDGE})`, 'gi'),
  name,
]);
const BOARD_DIR_MENTION = /(?:^|[\s'"`(=,\\/])\.local(?:[\\/]+tasks)?(?=$|[\s'"`),;|\\/*])/i;
const FILE_PATH_KEYS = ['file_path', 'path', 'notebook_path'];
const SHELL_TOOLS = new Set(['PowerShell', 'Monitor']);

const MAX_CHECKS = 32;
const MAX_PARSE = 1000000;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function hookEventName(input) {
  try {
    return JSON.parse(input).hook_event_name || 'SessionStart';
  } catch {
    return 'SessionStart';
  }
}

function screenLine(text) {
  const first = text.split('\n').find((line) => line.trim() !== '') ?? '';
  return first.replace(/ (?:→|·|\() ?\/\S.*$/, '').trim();
}

function runBanner(input) {
  const res = spawnSync(process.execPath, [CLI, 'banner'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
  const text = (res.stdout ?? '').trim();
  if (!text) return;
  process.stdout.write(`${JSON.stringify({
    systemMessage: screenLine(text),
    hookSpecificOutput: { hookEventName: hookEventName(input), additionalContext: text },
  })}\n`);
}

function canonicalCase(text) {
  let out = text;
  for (const [re, name] of BOARD_NAME_RES) out = out.replace(re, (_, edge) => edge + name);
  return out;
}

function namesBoard(text) {
  const lower = text.toLowerCase();
  return BOARD_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

function mentionsBoard(text) {
  return namesBoard(text) || BOARD_DIR_MENTION.test(text);
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function normalPath(target) {
  const stripped = asText(target).replace(/^(?:Microsoft\.PowerShell\.Core\\)?FileSystem::/i, '').replace(/\\/g, '/');
  if (stripped === '') return '';
  const norm = posix.normalize(stripped);
  return norm === '.' ? '' : norm;
}

function withNormalPaths(payload) {
  const input = payload?.tool_input;
  if (input === null || typeof input !== 'object') return payload;
  const next = { ...input };
  for (const key of FILE_PATH_KEYS) if (typeof next[key] === 'string') next[key] = normalPath(next[key]);
  return { ...payload, tool_input: next };
}

function guardOnce(payload, { yieldToOther = true } = {}) {
  const env = yieldToOther ? process.env : { ...process.env, PATH: '' };
  const res = spawnSync(process.execPath, [CLI, 'guard'], {
    input: canonicalCase(JSON.stringify(withNormalPaths(payload))),
    encoding: 'utf8',
    env,
    stdio: ['pipe', 'inherit', 'pipe'],
  });
  return { status: res.status === 2 ? 2 : 0, stderr: res.stderr ?? '' };
}

function relativeToCwd(target, cwd) {
  const base = normalPath(cwd);
  const path = normalPath(target);
  if (base === '' || path === '') return null;
  const abs = path.startsWith('/') || /^[A-Za-z]:\//.test(path) ? path : posix.join(base, path);
  return { rel: posix.relative(base.toLowerCase(), abs.toLowerCase()), up: posix.relative(abs.toLowerCase(), base.toLowerCase()) };
}

function boardFilesUnder(container, cwd) {
  const where = relativeToCwd(container, cwd);
  if (where === null) return [];
  const coversAll = where.rel === '' || where.up.split('/')[0] !== '..';
  return BOARD_FILES.filter((file) => {
    if (!coversAll && !`${file.toLowerCase()}/`.startsWith(`${where.rel}/`)) return false;
    return existsSync(join(cwd, file));
  });
}

function globRegex(glob) {
  let re = '';
  for (const ch of glob) {
    if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else if (ch === '[' || ch === ']') re += ch;
    else re += ch.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

function boardFilesMatching(glob, cwd) {
  const where = relativeToCwd(glob, cwd);
  if (where === null || where.rel.startsWith('..')) return [];
  let re;
  try {
    re = globRegex(where.rel);
  } catch {
    return boardFilesUnder(posix.dirname(where.rel), cwd);
  }
  return BOARD_FILES.filter((file) => {
    const parts = file.toLowerCase().split('/');
    const hit = parts.some((_, i) => re.test(parts.slice(0, i + 1).join('/')));
    return hit && existsSync(join(cwd, file));
  });
}

function refuse(stderr, tool) {
  process.stderr.write(stderr.replace(/^(?:Write|Bash) refused:/, `${tool} refused:`));
  return 2;
}

function refuseUnresolved(tool) {
  process.stderr.write(
    `${tool} refused: this command writes to a path the guard cannot work out before it runs, and it names a TaskBoard board path. Board files are read-only to this session.\nUse \`/cyberine-taskboard:tasks\` for board changes, or write to a literal path outside the board.\n`,
  );
  return 2;
}

function coarse(command, unresolved) {
  return { targets: command.split(/[\s'"`,;|()<>{}]+/), containers: [], globs: [], copies: [], bash: [], unresolved };
}

function parseShell(command, dialect) {
  if (command.length > MAX_PARSE) return coarse(command, false);
  try {
    return psTargets(command, { dialect });
  } catch {
    return coarse(command, mentionsBoard(command));
  }
}

function isDirectory(path, cwd) {
  try {
    const p = normalPath(path);
    return statSync(p.startsWith('/') || /^[A-Za-z]:\//.test(p) ? p : join(cwd, p)).isDirectory();
  } catch {
    return false;
  }
}

function copyContainers(copies, cwd) {
  const out = [];
  for (const { source, dest, dialect } of copies) {
    const src = asText(source).replace(/\\/g, '/');
    const into = asText(dest).replace(/[\\/]+$/, '');
    const named = `${into}/${posix.basename(posix.normalize(src))}`;
    if (!isDirectory(src, cwd) && !/\/\.?$/.test(src)) continue;
    if (dialect === 'bash' && /\/\.?$/.test(src)) out.push(into);
    if (dialect === 'bash' && /\/\.$/.test(src)) continue;
    out.push(named);
  }
  return out;
}

function writeChecks(parsed, cwd) {
  const found = [
    ...parsed.targets,
    ...[...parsed.containers, ...copyContainers(parsed.copies ?? [], cwd)].flatMap((c) => boardFilesUnder(c, cwd)),
    ...parsed.globs.flatMap((g) => boardFilesMatching(g, cwd)),
  ];
  const seen = new Set();
  const checks = [];
  for (const t of found.map(normalPath)) {
    if (t === '' || seen.has(t) || !namesBoard(t)) continue;
    seen.add(t);
    checks.push({ tool_name: 'Write', tool_input: { file_path: t } });
  }
  return checks;
}

function runChecks(payload, tool, checks, options) {
  if (checks.length > MAX_CHECKS) {
    process.stderr.write(`${tool} refused: this command names more board paths than the guard can check; split it, or use \`/cyberine-taskboard:tasks\` for board changes.\n`);
    return 2;
  }
  for (const check of checks) {
    const res = guardOnce({ ...payload, ...check }, options);
    if (res.status === 2) return refuse(res.stderr, tool);
  }
  return 0;
}

function guardPowerShell(payload, tool, command, { alsoBash }) {
  const cwd = asText(payload.cwd);
  const parsed = parseShell(command, 'powershell');
  const checks = [
    ...(alsoBash ? [{ tool_name: 'Bash', tool_input: { command } }] : []),
    ...[...new Set(parsed.bash)].map((c) => ({ tool_name: 'Bash', tool_input: { command: c } })),
    ...writeChecks(parsed, cwd),
    ...(alsoBash ? writeChecks(parseShell(command, 'bash'), cwd) : []),
  ];
  const status = runChecks(payload, tool, checks, { yieldToOther: false });
  if (status === 2) return 2;
  return parsed.unresolved && mentionsBoard(command) ? refuseUnresolved(tool) : 0;
}

function guardBash(payload, command) {
  const first = guardOnce(payload);
  if (first.status === 2) {
    process.stderr.write(first.stderr);
    return 2;
  }
  if (!mentionsBoard(command)) return 0;
  return runChecks(payload, 'Bash', writeChecks(parseShell(command, 'bash'), asText(payload.cwd)), { yieldToOther: true });
}

function runGuard(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return 0;
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return 0;
  const tool = asText(payload.tool_name);
  const command = asText(payload.tool_input?.command);
  if (tool === 'PowerShell') return guardPowerShell(payload, tool, command, { alsoBash: false });
  if (tool === 'Monitor') return command === '' ? 0 : guardPowerShell(payload, tool, command, { alsoBash: true });
  if (tool === 'Bash') return guardBash(payload, command);
  const res = guardOnce(payload);
  if (res.status === 2) process.stderr.write(res.stderr);
  return res.status;
}

function guardFailClosed(input) {
  try {
    return runGuard(input);
  } catch {
    if (!mentionsBoard(input)) return 0;
    process.stderr.write('TaskBoard guard refused: it could not check this call and the call names a board path. Use `/cyberine-taskboard:tasks` for board changes.\n');
    return 2;
  }
}

const mode = process.argv[2];
const input = readStdin();

if (mode === 'banner') {
  runBanner(input);
  process.exit(0);
}

if (mode === 'guard') {
  const shellTool = /"tool_name"\s*:\s*"(?:PowerShell|Monitor)"/.test(input);
  if (!shellTool && !namesBoard(input) && !BOARD_DIR_MENTION.test(input)) process.exit(0);
  process.exit(guardFailClosed(input));
}

process.exit(0);
