import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'cli', 'tasks.mjs');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'taskboard-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
  return dir;
}

const isolatedHome = mkdtempSync(join(tmpdir(), 'taskboard-home-'));
const isolatedPath = [dirname(process.execPath), '/usr/bin', '/bin'].join(':');

function run(cwd, args, input, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, input, encoding: 'utf8', env: { PATH: isolatedPath, HOME: isolatedHome, ...env } });
}

test('plugin, marketplace and build metadata agree', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  const market = readJson('.claude-plugin/marketplace.json');
  const build = readJson('cli/build.json');
  assert.equal(plugin.name, 'cyberine-taskboard');
  assert.equal(market.name, plugin.name);
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(build.program, `/${plugin.name}:tasks`);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(readFileSync(join(root, 'CHANGELOG.md'), 'utf8').includes(`[${plugin.version}]`));
});

test('no top-level bin and no root CLAUDE.md', () => {
  assert.equal(existsSync(join(root, 'bin')), false);
  assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
});

test('hooks run the bundled wrapper in exec form', () => {
  const hooks = readJson('hooks/hooks.json').hooks;
  const cmds = [...hooks.SessionStart, ...hooks.PreToolUse].flatMap((m) => m.hooks);
  for (const h of cmds) {
    assert.equal(h.command, 'node');
    assert.equal(h.args[0], '${CLAUDE_PLUGIN_ROOT}/hooks/board-hooks.mjs');
  }
  assert.deepEqual(cmds.map((h) => h.args[1]).sort(), ['banner', 'guard']);
});

const wrapper = join(root, 'hooks', 'board-hooks.mjs');

function hook(cwd, mode, payload, env = {}) {
  return spawnSync(process.execPath, [wrapper, mode], { cwd, input: JSON.stringify(payload), encoding: 'utf8', env: { PATH: isolatedPath, HOME: isolatedHome, ...env } });
}

test('session start shows the count line on screen and the full banner as context', () => {
  const dir = scratchRepo();
  assert.equal(hook(dir, 'banner', { hook_event_name: 'SessionStart' }).stdout, '');
  run(dir, ['init']);
  run(dir, ['add', '--title', 'Ship it', '--do', 'Do it', '--done-when', 'Done', '--effort', 'S']);
  const out = JSON.parse(hook(dir, 'banner', { hook_event_name: 'SessionStart' }).stdout);
  assert.match(out.systemMessage, /^\[taskboard\] .*1 todo/);
  assert.doesNotMatch(out.systemMessage, /→|ACTIVE\.md/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /Resume: .*Ship it/);
});

test('guard refuses a Bash write to the board and passes reads', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  const board = join('.local', 'tasks', 'ACTIVE.md');
  const bash = (command) => hook(dir, 'guard', { tool_name: 'Bash', tool_input: { command }, cwd: dir }).status;
  assert.equal(bash('echo x >> ' + board), 2);
  assert.equal(bash('cat ' + board), 0);
  assert.equal(bash('ls'), 0);
  const multi = hook(dir, 'guard', { tool_name: 'MultiEdit', tool_input: { file_path: join(dir, board), edits: [] }, cwd: dir });
  assert.equal(multi.status, 2);
});

test('every skill has a name and description', () => {
  for (const name of readdirSync(join(root, 'skills'))) {
    const text = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(text, /\ndescription: .+\n/);
  }
});

test('banner is silent without a board and names the plugin with one', () => {
  const dir = scratchRepo();
  const silent = run(dir, ['banner']);
  assert.equal(silent.status, 0);
  assert.equal(silent.stdout, '');
  assert.equal(run(dir, ['init']).status, 0);
  assert.equal(run(dir, ['add', '--title', 'T', '--do', 'Do it', '--done-when', 'Done', '--effort', 'S']).status, 0);
  const banner = run(dir, ['banner']);
  assert.equal(banner.status, 0);
  assert.match(banner.stdout, /^\[taskboard\] /);
  assert.ok(!banner.stdout.includes('cyberine tasks'));
});

test('guard refuses a board edit and passes any other file', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  const payload = (file) => JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(dir, file) }, cwd: dir });
  const refused = run(dir, ['guard'], payload('.local/tasks/ACTIVE.md'));
  assert.equal(refused.status, 2);
  assert.match(refused.stderr + refused.stdout, /\/cyberine-taskboard:tasks/);
  assert.equal(run(dir, ['guard'], payload('README.md')).status, 0);
  const multi = JSON.stringify({ tool_name: 'MultiEdit', tool_input: { file_path: join(dir, '.local/tasks/ACTIVE.md'), edits: [] }, cwd: dir });
  assert.equal(run(dir, ['guard'], multi).status, 2);
  const matcher = readJson('hooks/hooks.json').hooks.PreToolUse[0].matcher.split('|');
  for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash']) assert.ok(matcher.includes(tool), tool);
});

const banned = new RegExp(['npm' + ' i ', 'npm' + ' install', '@' + 'cyberine/' + 'cli', 'full ' + 'cyberine'].join('|'), 'i');

test('fleet commands are absent and no output names another product', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  for (const args of [['run'], ['group'], ['end', '--handoff', 'short']]) {
    const r = run(dir, args);
    assert.equal(r.status, 2, args.join(' '));
    assert.doesNotMatch(r.stderr + r.stdout, banned, args.join(' '));
  }
  assert.doesNotMatch(readFileSync(cli, 'utf8'), banned);
});

test('banner and guard yield only when the other board plugin would run', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  run(dir, ['add', '--title', 'T', '--do', 'Do it', '--done-when', 'Done', '--effort', 'S']);
  const home = mkdtempSync(join(tmpdir(), 'taskboard-yield-home-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'cyberine@m': true } }));
  const payload = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(dir, '.local/tasks/ACTIVE.md') }, cwd: dir });
  const enabledNoCli = { HOME: home };
  assert.match(run(dir, ['banner'], '', enabledNoCli).stdout, /^\[taskboard\] /);
  assert.equal(run(dir, ['guard'], payload, enabledNoCli).status, 2);
  const bin = mkdtempSync(join(tmpdir(), 'taskboard-yield-bin-'));
  for (const name of ['cyberine', 'cyberine-tasks-banner.mjs', 'cyberine.mjs']) writeFileSync(join(bin, name), '');
  chmodSync(join(bin, 'cyberine'), 0o755);
  const enabledWithCli = { HOME: home, PATH: bin + ':' + isolatedPath };
  assert.equal(run(dir, ['banner'], '', enabledWithCli).stdout, '');
  assert.equal(run(dir, ['guard'], payload, enabledWithCli).status, 0);
});

test('every skill reads the one board-voice file', () => {
  assert.ok(existsSync(join(root, 'references', 'board-voice.md')));
  for (const name of readdirSync(join(root, 'skills'))) {
    if (name === 'help') continue;
    const text = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(text, /\$\{CLAUDE_PLUGIN_ROOT\}\/references\/board-voice\.md/, name);
  }
});

test('no skill frontmatter claims a cyberine phrase', () => {
  for (const name of readdirSync(join(root, 'skills'))) {
    const text = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const front = text.match(/^---\n([\s\S]*?)\n---\n/)[1];
    assert.ok(front.length - 1 < 1536 + 400, name);
    assert.doesNotMatch(front.replace(/names cyberine/g, ''), /"[^"]*cyberine [^"]*"|"[^"]* cyberine"/i, name);
  }
});
