#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function runGuard(input) {
  const res = spawnSync(process.execPath, [CLI, 'guard'], { input, stdio: ['pipe', 'inherit', 'inherit'] });
  return res.status === 2 ? 2 : 0;
}

const mode = process.argv[2];
const input = readStdin();

if (mode === 'banner') {
  runBanner(input);
  process.exit(0);
}

if (mode === 'guard') {
  if (!BOARD_MARKERS.some((m) => input.includes(m))) process.exit(0);
  process.exit(runGuard(input));
}

process.exit(0);
