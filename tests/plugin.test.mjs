import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'cli', 'tasks.mjs');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'taskboard-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=taskboard-test', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
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
  assert.equal(bash('cp notes/ACTIVE.md .local/tasks/'), 2);
  assert.equal(bash('cd .local/tasks && echo x > ACTIVE.md'), 2);
  assert.equal(bash('cp .local/tasks/ACTIVE.md backup/'), 0);
  assert.equal(bash('git log -- .local/tasks/ACTIVE.md'), 0);
  assert.equal(bash('cp -- .local/tasks/ACTIVE.md backup/ACTIVE.md'), 0);
  assert.equal(bash('install -m 644 notes/ACTIVE.md .local/tasks/'), 2);
  assert.equal(bash('rsync -a notes/ .local/tasks/'), 2);
  assert.equal(bash('rm -rf .local/tasks'), 2);
  assert.equal(bash('rm -rf node_modules && cat .local/tasks/ACTIVE.md'), 0);
  const multi = hook(dir, 'guard', { tool_name: 'MultiEdit', tool_input: { file_path: join(dir, board), edits: [] }, cwd: dir });
  assert.equal(multi.status, 2);
});

const winBoard = '.local\\tasks\\ACTIVE.md';
const psRefused = [
  `Set-Content -Path ${winBoard} -Value x`,
  `Set-Content -LiteralPath '${winBoard}' -Value x`,
  `sEt-CoNtEnT -Path:'${winBoard}' -Value x`,
  `sc '${winBoard}' x`,
  `Add-Content -LP '${winBoard}' x`,
  `clc '${winBoard}'`,
  `'x' | Out-File '${winBoard}'`,
  `'x' | Tee-Object -FilePath '${winBoard}'`,
  `'x' > '${winBoard}'`,
  `'x' *>> '.local\\tasks\\status.log'`,
  `Write-Error x 2> '.local\\tasks\\status.log'`,
  `Set-Content -Path 'other.md','${winBoard}' -Value x`,
  `Copy-Item -Path other.md '${winBoard}'`,
  `Copy-Item other.md -Dest '${winBoard}'`,
  `Move-Item '${winBoard}' backup.md`,
  `Rename-Item '${winBoard}' backup.md`,
  `New-Item -Path '.local\\tasks' -Name ACTIVE.md -ItemType File -Force`,
  `Remove-Item .local/tasks/ACTIVE.md`,
  `del ${winBoard}`,
  `[IO.File]::WriteAllText('${winBoard}','x')`,
  `[System.IO.File]::Copy('other.md','${winBoard}',$true)`,
  `[IO.File]::Move('${winBoard}','backup.md')`,
  `$w = [IO.StreamWriter]::new('${winBoard}'); $w.Close()`,
  `(Get-Content '${winBoard}') -replace 'a','b' | Set-Content '${winBoard}'`,
  `Microsoft.PowerShell.Management\\Set-Content '${winBoard}' x`,
  `Set-Content '.claude\\TASKS.md' x`,
  `Set-Content '.local\\tasks\\journal\\x.md' x`,
  `node cli/tasks.mjs status > '${winBoard}'`,
  `Set-Content '.LOCAL\\tasks\\active.md' x`,
  `Set-Content '.local/tasks/../tasks/ACTIVE.md' x`,
  `Set-Content 'FileSystem::${winBoard}' x`,
  `$p = '${winBoard}'; Set-Content $p x`,
  `Set-Content \`\n  -Path '${winBoard}' \`\n  -Value x`,
  `cmd /c "type x > ${winBoard}"`,
  `bash -c 'echo x >> .local/tasks/ACTIVE.md'`,
  `pwsh -NoProfile -Command "Set-Content '${winBoard}' x"`,
  `Invoke-WebRequest https://example.invalid -OutFile '${winBoard}'`,
  `Set-Content -Verbose '${winBoard}' x`,
  `Copy-Item -Debug notes.md '${winBoard}' -Force`,
  `Set-Content -Path @('other.md','${winBoard}') -Value x`,
  `Set-Content -Path 'other.md',\n '${winBoard}' -Value x`,
  `Set-Content ('${winBoard}') x`,
  `$item = New-Item -Path '${winBoard}' -ItemType File -Force`,
  `$null = Set-Content -Path '${winBoard}' -Value x`,
  `$p = '${winBoard}'; Set-Content $p x; $p = 'other.md'`,
  `[string]$p = '${winBoard}'; Set-Content $p x`,
  `\${p} = '${winBoard}'; Set-Content \${p} x`,
  `$c = 'Set-Content ${winBoard} x'; Invoke-Expression $c`,
  `Copy-Item 'notes\\ACTIVE.md' '.local\\tasks\\' -Force`,
  `Set-Location .local\\tasks; Set-Content ACTIVE.md x`,
  `([IO.FileInfo]::new('${winBoard}')).Delete()`,
  `Set-Alias save Set-Content; save '${winBoard}' x`,
  `Remove-Item '.local\\tasks' -Recurse -Force`,
  `Remove-Item .local -Recurse -Force`,
  `Rename-Item .local\\tasks old`,
  `$o = @{Path='${winBoard}';Value='x'}; Set-Content @o`,
  `Set-Content (Join-Path .local tasks ACTIVE.md) x`,
  `$p = Join-Path '.local\\tasks' 'ACTIVE.md'; Set-Content $p x`,
  `$p = '.local\\tasks'; Set-Content (Join-Path $p 'ACTIVE.md') x`,
  `Set-Content (Join-Path '.local' (Join-Path 'tasks' 'ACTIVE.md')) x`,
  `Set-Content (Join-Path '.local\\tasks' 'ACTIVE.md' -Resolve) x`,
  `[IO.File]::WriteAllText((Join-Path '.local\\tasks' 'ACTIVE.md'),'x')`,
  `$o=@{Path='${winBoard}';Value='x'}; Set-Content @o; $o=@{Path='other.md';Value='x'}`,
  `$o=@{Path='other.md';Value='x'}; $o.Path='${winBoard}'; Set-Content @o`,
  `$o=@('${winBoard}','x'); Set-Content @o`,
  `$p=@('other.md','${winBoard}'); Set-Content $p x`,
  `Set-Content -Path '.local\\tasks\\*.md' -Value x`,
  `Remove-Item -Path '.local\\*' -Recurse -Force`,
  `Push-Location .local; Push-Location tasks; Pop-Location; Set-Content tasks\\ACTIVE.md x`,
  `[IO.Directory]::Delete('.local\\tasks',$true)`,
  `[IO.Directory]::Move('.local\\tasks','backup\\tasks')`,
  `([IO.DirectoryInfo]::new('.local\\tasks')).Delete($true)`,
  `$f=[IO.FileInfo]::new('${winBoard}'); $f.Delete()`,
  `(New-Object IO.FileInfo '${winBoard}').Delete()`,
  `([IO.FileInfo]'${winBoard}').Delete()`,
  `([IO.FileInfo]::new('other.md')).CopyTo('${winBoard}',$true)`,
  `$p='${winBoard}'; [IO.File]::WriteAllText("$p",'x')`,
  `$p='${winBoard}'; Set-Content -Path:$p -Value x`,
  `$p='${winBoard}'; 'x' | Out-File -FilePath:$p`,
  `$c='Set-Content'; & $c '${winBoard}' x`,
  `Write-Output "$(Set-Content '${winBoard}' x)"`,
  `$s=@"\n$(Set-Content '${winBoard}' x)\n"@\nWrite-Output $s`,
  `Set-Content ('.local\\tasks\\' + 'ACTIVE.md') x`,
  `Set-Variable p '${winBoard}'; Set-Content $p x`,
  `Get-Item '${winBoard}' | Remove-Item`,
  `Get-Item '${winBoard}' | Set-Content -Value updated`,
  `Get-Item '${winBoard}' | Move-Item -Destination backup\\`,
  `Get-Item '${winBoard}' | Rename-Item -NewName old.md`,
  `Get-ChildItem .local\\tasks -Filter '*.md' | Remove-Item`,
  `[pscustomobject]@{LiteralPath='${winBoard}'} | Remove-Item`,
  `$writer=New-Object System.IO.StreamWriter '${winBoard}'; $writer.WriteLine('x'); $writer.Dispose()`,
  `Copy-Item seed\\tasks .local -Recurse -Force`,
];
const psPassed = [
  `Get-Content '${winBoard}'`,
  `Select-String -Path '${winBoard}' -Pattern todo`,
  `Copy-Item '${winBoard}' backup.md`,
  `Get-Content '${winBoard}' | Set-Content other.md`,
  `Set-Content other.md -Value '.local/tasks/ACTIVE.md'`,
  `[IO.File]::Copy('${winBoard}','backup.md',$true)`,
  `[IO.File]::ReadAllText('${winBoard}')`,
  `[IO.File]::WriteAllText('other.md','.local/tasks/ACTIVE.md')`,
  `Write-Output 'Set-Content ${winBoard} x'`,
  `Write-Error x 2>&1`,
  `node cli/tasks.mjs status`,
  `'x' | Tee-Object -Variable v; Get-Content '${winBoard}'`,
  `# Set-Content '${winBoard}' x\nGet-Content '${winBoard}'`,
  `$s = @'\nSet-Content ${winBoard} x\n'@\nWrite-Output $s`,
  `$p = 'other.md'; Set-Content $p x; $p = '${winBoard}'`,
  `$p = '${winBoard}'; Set-Content '$p' x`,
  `Write-Output "[IO.File]::WriteAllText('${winBoard}','x')"`,
  `[IO.File]::Open('${winBoard}',[IO.FileMode]::Open,[IO.FileAccess]::Read).Dispose()`,
  `([IO.FileInfo]::new('${winBoard}')).Length`,
  `Set-Content '${winBoard}' x -WhatIf`,
  `Copy-Item '${winBoard}' -Destination backup\\`,
  `Remove-Item notes -Recurse -Force`,
  `Get-ChildItem .local\\tasks -Recurse`,
  `$o = @{LiteralPath='other.md';Value='x'}; Set-Content @o`,
  `[IO.File]::Open('${winBoard}','Open','Read').Dispose()`,
  `[IO.FileStream]::new('${winBoard}',[IO.FileMode]::Open,'Read').Dispose()`,
  `Set-Content '${winBoard}' x -wi`,
  `$WhatIfPreference=$true; Set-Content '${winBoard}' x`,
  `$s = @"\nboard is at ${winBoard}\n"@; Write-Output $s`,
  `Get-Content '${winBoard}' | Out-File $env:TEMP\\copy.md`,
  `Copy-Item '${winBoard}' $env:TEMP`,
  `foreach ($f in Get-ChildItem .local\\tasks) { Write-Output $f.Name }`,
  `Get-Content '${winBoard}' | ForEach-Object { $_ } | Out-File -FilePath out\\copy.md`,
  `'${winBoard}' | Set-Content -Value x`,
  `Get-Content '${winBoard}'; $log=Join-Path $PWD 'build.log'; npm run build > $log`,
  `Get-Content '${winBoard}'; $node=(Get-Command node).Source; & $node --version`,
  `Copy-Item (Get-Item '${winBoard}').FullName backup\\ACTIVE.md`,
  `Get-Content '${winBoard}'; Set-Content build-log 'ok'`,
  `Copy-Item notes\\. .local\\tasks -Recurse -Force`,
];

test('guard refuses a PowerShell write to the board and passes reads', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  mkdirSync(join(dir, 'seed', 'tasks'), { recursive: true });
  mkdirSync(join(dir, 'notes'), { recursive: true });
  const ps = (command) => hook(dir, 'guard', { tool_name: 'PowerShell', tool_input: { command }, cwd: dir });
  for (const command of psRefused) {
    const res = ps(command);
    assert.equal(res.status, 2, command);
    assert.match(res.stderr, /^PowerShell refused: /, command);
    assert.match(res.stderr, /\/cyberine-taskboard:tasks/, command);
  }
  for (const command of psPassed) assert.equal(ps(command).status, 0, command);
  assert.equal(readFileSync(join(dir, '.local', 'tasks', 'ACTIVE.md'), 'utf8').includes('\nx\n'), false);
});

test('guard refuses a board path that differs only in letter case', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  const status = (tool_name, tool_input) => hook(dir, 'guard', { tool_name, tool_input, cwd: dir }).status;
  assert.equal(status('Bash', { command: 'echo x >> .local/tasks/active.md' }), 2);
  assert.equal(status('Write', { file_path: join(dir, '.local', 'tasks', 'active.md'), content: 'x' }), 2);
  assert.equal(status('Edit', { file_path: join(dir, '.LOCAL', 'TASKS', 'ACTIVE.MD') }), 2);
  assert.equal(status('Write', { file_path: join(dir, 'notes', 'active.md'), content: 'x' }), 0);
  assert.equal(status('Write', { file_path: join(dir, '.local', 'tasks', '.', 'ACTIVE.md'), content: 'x' }), 2);
  assert.equal(status('Write', { file_path: '.local/tasks/../tasks/ACTIVE.md', content: 'x' }), 2);
});

test('guard checks Monitor commands and skips WebSocket monitors', () => {
  const dir = scratchRepo();
  run(dir, ['init']);
  const monitor = (tool_input) => hook(dir, 'guard', { tool_name: 'Monitor', tool_input: { description: 'd', timeout_ms: 1000, ...tool_input }, cwd: dir });
  const refused = monitor({ command: 'echo x >> .local/tasks/ACTIVE.md' });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /^Monitor refused: /);
  assert.equal(monitor({ command: 'tail -f .local/tasks/ACTIVE.md' }).status, 0);
  assert.equal(monitor({ ws: { url: 'wss://example.invalid/ACTIVE.md' } }).status, 0);
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
  for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell', 'Monitor']) assert.ok(matcher.includes(tool), tool);
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
  for (const file of [cli, ...readdirSync(join(root, 'cli', 'lib')).map((f) => join(root, 'cli', 'lib', f))]) assert.doesNotMatch(readFileSync(file, 'utf8'), banned, file);
});

test('every shipped text file stays under the directory 256 KiB inspection limit', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => f && !/\.png$/.test(f));
  for (const f of files) assert.ok(statSync(join(root, f)).size < 262144, f);
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
  assert.equal(hook(dir, 'guard', JSON.parse(payload), enabledWithCli).status, 0);
  const ps = hook(dir, 'guard', { tool_name: 'PowerShell', tool_input: { command: `Set-Content '${winBoard}' x` }, cwd: dir }, enabledWithCli);
  assert.equal(ps.status, 2);
  const monitor = hook(dir, 'guard', { tool_name: 'Monitor', tool_input: { command: 'echo x >> .local/tasks/ACTIVE.md', description: 'd', timeout_ms: 1000 }, cwd: dir }, enabledWithCli);
  assert.equal(monitor.status, 2);
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
