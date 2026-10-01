const CONTENT_VERBS = new Set(['set-content', 'sc', 'add-content', 'ac', 'out-file', 'tee-object', 'tee', 'export-csv', 'epcsv', 'export-clixml', 'start-transcript']);
const PATH_VERBS = new Set(['clear-content', 'clc', 'new-item', 'ni', 'remove-item', 'ri', 'rm', 'del', 'erase', 'rd', 'rmdir', 'clear-item', 'cli', 'set-itemproperty', 'sp']);
const REMOVE_VERBS = new Set(['remove-item', 'ri', 'rm', 'del', 'erase', 'rd', 'rmdir']);
const RENAME_VERBS = new Set(['rename-item', 'ren', 'rni']);
const COPY_VERBS = new Set(['copy-item', 'copy', 'cp', 'cpi']);
const MOVE_VERBS = new Set(['move-item', 'move', 'mv', 'mi']);
const LOCATION_VERBS = new Set(['set-location', 'sl', 'cd', 'chdir']);
const PUSH_VERBS = new Set(['push-location', 'pushd']);
const POP_VERBS = new Set(['pop-location', 'popd']);
const ALIAS_VERBS = new Set(['set-alias', 'sal', 'new-alias', 'nal']);
const VARIABLE_VERBS = new Set(['set-variable', 'sv', 'new-variable', 'nv']);
const BASH_SHELLS = new Set(['bash', 'sh', 'zsh', 'bash.exe']);
const NESTED_SHELLS = new Set(['cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe', 'invoke-expression', 'iex']);
const WRITE_VERBS = new Set([...CONTENT_VERBS, ...PATH_VERBS, ...RENAME_VERBS, ...COPY_VERBS, ...MOVE_VERBS]);
const BASH_COPY_VERBS = new Set(['rsync', 'install', 'ln']);
const BASH_WRITE_VERBS = new Set(['cp', 'mv', 'rm', 'rmdir', ...BASH_COPY_VERBS]);
const VALUE_PARAMS = [
  'path', 'literalpath', 'pspath', 'filepath', 'newname', 'name', 'destination', 'outfile', 'redirectstandardoutput',
  'redirectstandarderror', 'redirectstandardinput', 'variable', 'value', 'itemtype', 'encoding', 'stream', 'filter',
  'include', 'exclude', 'credential', 'delimiter', 'width', 'inputobject', 'type', 'target', 'argumentlist', 'uri',
  'method', 'body', 'headers', 'pattern', 'totalcount', 'tail', 'readcount', 'depth', 'culture', 'erroraction',
  'warningaction', 'informationaction', 'progressaction', 'errorvariable', 'warningvariable', 'informationvariable',
  'outvariable', 'outbuffer', 'pipelinevariable', 'workingdirectory', 'command', 'scope', 'option', 'description',
  'propertytype', 'property', 'tosession', 'fromsession', 'executionpolicy', 'childpath', 'additionalchildpath',
];
const PARAM_ALIASES = { lp: 'literalpath', fp: 'filepath', rso: 'redirectstandardoutput', rse: 'redirectstandarderror', ea: 'erroraction', wa: 'warningaction', ev: 'errorvariable', ov: 'outvariable', ob: 'outbuffer', pv: 'pipelinevariable', wd: 'workingdirectory', args: 'argumentlist', wi: 'whatif' };
const MUTATING_METHODS = /\.\s*(?:Delete|MoveTo|CopyTo|Replace|Encrypt|Decrypt|OpenWrite|AppendText|CreateText|Create|SetAccessControl)\s*\(/i;
const FILE_OBJECT_SOURCES = /(?:\[(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)\]::new\s*\(|New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)(?:\s+-ArgumentList)?|\[(?:System\.)?IO\.(?:FileInfo|DirectoryInfo)\]|\b(?:Get-Item|gi|Get-ChildItem|gci|ls|dir)\b)/gi;
const MAX_SCAN = 4096;
const MAX_CALLS = 256;
const MAX_NESTED = 32;

function lex(command, { splitParens, subexprs }) {
  const segments = [];
  let tokens = [];
  let cur = null;
  let quote = null;
  let redirect = false;
  let listNext = false;
  const start = () => (cur ??= { text: '', quoted: false, single: false });
  const flush = () => {
    if (cur === null) return;
    if (redirect) {
      cur.redirect = true;
      redirect = false;
    }
    if (listNext) {
      cur.list = true;
      listNext = false;
    }
    tokens.push(cur);
    cur = null;
  };
  const endSegment = (sep = ';') => {
    flush();
    redirect = false;
    listNext = false;
    if (tokens.length > 0) {
      tokens.sep = sep;
      segments.push(tokens);
    } else if (segments.length > 0 && sep === '|') {
      segments.at(-1).sep = '|';
    }
    tokens = [];
  };
  const subexpr = (from) => {
    if (subexprs.length > MAX_NESTED) {
      subexprs.push(String(subexprs.length));
      return from;
    }
    let depth = 0;
    for (let j = from; j < command.length && j - from < MAX_SCAN; j++) {
      if (command[j] === '(') depth++;
      if (command[j] === ')' && --depth === 0) {
        subexprs.push(command.slice(from + 1, j));
        return j;
      }
    }
    subexprs.push(command.slice(from + 1, Math.min(command.length, from + MAX_SCAN)));
    return from;
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'" && command[i + 1] === "'") { cur.text += "'"; i++; continue; }
      if (ch === "'") { quote = null; continue; }
      cur.text += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '`' && i + 1 < command.length) { cur.text += command[++i]; continue; }
      if (ch === '"') { quote = null; continue; }
      if (ch === '$' && command[i + 1] === '(') {
        const end = subexpr(i + 1);
        cur.text += command.slice(i, end + 1);
        i = end;
        continue;
      }
      cur.text += ch;
      continue;
    }
    if (ch === '@' && (command[i + 1] === "'" || command[i + 1] === '"') && /^\r?\n/.test(command.slice(i + 2, i + 4))) {
      const close = command.indexOf(`\n${command[i + 1]}@`, i + 2);
      const body = command.slice(i + 2, close < 0 ? command.length : close);
      if (command[i + 1] === '"') {
        for (let j = body.indexOf('$('); j >= 0; j = body.indexOf('$(', j + 2)) {
          let depth = 0;
          for (let k = j + 1; k < body.length && k - j < MAX_SCAN; k++) {
            if (body[k] === '(') depth++;
            if (body[k] === ')' && --depth === 0) { subexprs.push(body.slice(j + 2, k)); break; }
          }
        }
      }
      flush();
      tokens.push({ text: body, quoted: true, single: command[i + 1] === "'" });
      i = close < 0 ? command.length : close + 2;
      continue;
    }
    if (ch === '<' && command[i + 1] === '#') {
      const close = command.indexOf('#>', i + 2);
      i = close < 0 ? command.length : close + 1;
      flush();
      continue;
    }
    if (ch === '#' && cur === null) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++;
      continue;
    }
    if (ch === '`') {
      if (command[i + 1] === '\n' || (command[i + 1] === '\r' && command[i + 2] === '\n')) {
        i += command[i + 1] === '\r' ? 2 : 1;
        flush();
        continue;
      }
      if (i + 1 < command.length) {
        start().text += command[++i];
        continue;
      }
    }
    if (ch === "'" || ch === '"') {
      const token = start();
      if (token.text === '') {
        token.quoted = true;
        token.single = ch === "'";
      }
      quote = ch;
      continue;
    }
    if (ch === '>') {
      if (cur !== null && !cur.quoted && /^(?:\d|\*)$/.test(cur.text)) cur = null;
      flush();
      while (command[i + 1] === '>') i++;
      if (command[i + 1] === '&') {
        i++;
        while (/\d/.test(command[i + 1] ?? '')) i++;
        continue;
      }
      redirect = true;
      continue;
    }
    if (ch === '$' && command[i + 1] === '{') {
      const close = command.indexOf('}', i + 2);
      const end = close < 0 ? command.length : close + 1;
      start().text += command.slice(i, end);
      i = end - 1;
      continue;
    }
    if (!splitParens && (ch === '(' || ((ch === '@' || ch === '$') && command[i + 1] === '('))) {
      const open = ch === '(' ? i : i + 1;
      const sigil = ch === '(' ? '' : ch;
      const close = matchParen(command, open);
      const inner = command.slice(open + 1, close < 0 ? command.length : close);
      const items = sigil === '$' || cur !== null ? null : literalItems(inner);
      if (items) {
        items.forEach((item, k) => {
          if (k > 0) listNext = true;
          cur = { text: item.text, quoted: true, single: item.single };
          flush();
        });
      } else {
        const token = start();
        token.text += `${sigil}(${inner})`;
        token.expr = true;
      }
      i = close < 0 ? command.length : close;
      continue;
    }
    if ((ch === '@' || ch === '$') && command[i + 1] === '(' && cur === null) continue;
    if ((ch === '\n' || ch === '\r') && listNext) continue;
    if (';|\n\r{}'.includes(ch) || (ch === '&' && command[i + 1] === '&')) {
      if (ch === '|' && command[i + 1] === '|') {
        endSegment(';');
        i++;
        continue;
      }
      endSegment(ch === '|' ? '|' : ch === '{' || ch === '}' ? ch : ';');
      if (ch === '&') i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      endSegment(ch);
      continue;
    }
    if (ch === ',') {
      flush();
      listNext = true;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    start().text += ch;
  }
  endSegment();
  return segments;
}

function matchParen(command, open) {
  let depth = 0;
  let quote = null;
  for (let j = open; j < command.length; j++) {
    const c = command[j];
    if (quote !== null) {
      if (c === '`' && quote === '"') j++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return j;
  }
  return -1;
}

function literalItems(inner) {
  const parts = [];
  let quote = null;
  let cur = '';
  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    if (quote !== null) {
      if (c === '`' && quote === '"' && j + 1 < inner.length) { cur += c + inner[++j]; continue; }
      if (c === quote && quote === "'" && inner[j + 1] === "'") { cur += "''"; j++; continue; }
      if (c === quote) quote = null;
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    if (c === ',') { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  const quotedRe = /^'((?:[^']|'')*)'$|^"((?:[^"`$]|`.)*)"$/s;
  const items = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (part === '') return null;
    const pieces = part.split(/\s*\+\s*/);
    const texts = pieces.map((p) => quotedRe.exec(p));
    if (texts.every(Boolean)) {
      items.push({ text: texts.map((m) => (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2].replace(/`(.)/g, '$1'))).join(''), single: texts.every((m) => m[1] !== undefined) });
    } else if (/^[^\s$()@'"`+]+$/.test(part)) {
      items.push({ text: part, single: true });
    } else {
      return null;
    }
  }
  return items;
}

function param(token) {
  if (token.quoted || !/^-[A-Za-z][\w-]*(?::.*)?$/s.test(token.text)) return null;
  const colon = token.text.indexOf(':');
  const raw = (colon < 0 ? token.text.slice(1) : token.text.slice(1, colon)).toLowerCase();
  const matches = VALUE_PARAMS.filter((p) => p.startsWith(raw));
  let name = PARAM_ALIASES[raw] ?? (VALUE_PARAMS.includes(raw) ? raw : matches.length === 1 ? matches[0] : raw);
  if (raw.length >= 2 && 'whatif'.startsWith(raw)) name = 'whatif';
  return { name, takesValue: VALUE_PARAMS.includes(name), inline: colon < 0 ? null : token.text.slice(colon + 1) };
}

function varName(text) {
  const m = /^(?:\[[^\]]+\])*\$(?:\{([^}]+)\}|([\w:]+))$/.exec(text);
  return m ? `$${(m[1] ?? m[2]).toLowerCase()}` : null;
}

function assignmentOf(words) {
  if (words.length >= 2 && !words[0].quoted && varName(words[0].text) && words[1].text === '=' && !words[1].quoted) {
    return { name: varName(words[0].text), skip: 2 };
  }
  if (words.length >= 1 && !words[0].quoted && /=$/.test(words[0].text) && varName(words[0].text.slice(0, -1))) {
    return { name: varName(words[0].text.slice(0, -1)), skip: 1 };
  }
  if (words.length >= 1 && /^(?:\[[^\]]+\])*\$[\w:{}]+=./.test(words[0].text)) {
    const eq = words[0].text.indexOf('=');
    const name = varName(words[0].text.slice(0, eq));
    if (name) return { name, skip: 0, inline: { text: words[0].text.slice(eq + 1), quoted: words[0].quoted, single: words[0].single } };
  }
  return null;
}

function externalPaths(text) {
  return text
    .replace(/\$(?:\{env:(\w+)\}|env:(\w+)|home\b|\{home\})/gi, (m, a, b) => `/__outside__/${a ?? b ?? 'home'}`)
    .replace(/\$(?:\{pwd\}|pwd)(?:\.Path)?\b/gi, '.');
}

function append(list, items) {
  for (const item of items) list.push(item);
}

function slash(path) {
  return path.replace(/\\/g, '/');
}

function isAbsolute(path) {
  const p = slash(path);
  return p.startsWith('/') || /^[A-Za-z]:\//.test(p) || /^[A-Za-z]+::/.test(p);
}

function parentJoin(source, name) {
  const norm = slash(source);
  const cut = norm.lastIndexOf('/');
  return cut < 0 ? name : `${norm.slice(0, cut)}/${name}`;
}

function baseName(path) {
  return slash(path).replace(/\/+$/, '').split('/').pop() ?? '';
}

function looksUnresolved(text) {
  return /\$/.test(text) || /^@?\(/.test(text);
}

const BOARD_HINT = /ACTIVE\.md|TASKS(?:_ARCHIVE)?\.md|TASKS_DEDUPE_LEDGER|status\.(?:log|d)|journal|(?:^|[\\/'"\s])\.local(?:[\\/'"\s]|$)/i;

function hintsBoard(text) {
  return BOARD_HINT.test(text);
}

function mergeConcat(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (words[i + 1] && !words[i + 1].quoted && words[i + 1].text === '+' && words[i + 2] && (w.quoted || words[i + 2].quoted)) {
      w = { ...w, text: w.text + words[i + 2].text, quoted: true, single: w.single && words[i + 2].single };
      i += 2;
    }
    out.push(w);
  }
  return out;
}

function commandTargets(tokens, state, out, ctx) {
  const resolve = (token) => {
    if (token.single) {
      state.literals.add(token.text);
      return [token.text];
    }
    const name = varName(token.text);
    if (name && state.vars.has(name)) return state.vars.get(name);
    if (token.text.includes('$')) {
      return [externalPaths(token.text).replace(/\$(?:\{([^}]+)\}|([\w:]+))/g, (m, a, b) => state.vars.get(`$${(a ?? b).toLowerCase()}`)?.[0] ?? m)];
    }
    return [token.text];
  };
  const place = (target) => (state.cwd === '' || isAbsolute(target) ? target : `${state.cwd}/${slash(target)}`);
  const push = (...targets) => {
    for (const t of targets) {
      if (looksUnresolved(t) && !state.literals.has(t)) out.unresolved = true;
      if (/[*?[]/.test(t)) out.globs.push(place(t));
      out.targets.push(place(t));
    }
  };
  const contain = (...paths) => out.containers.push(...paths.map(place));
  const assign = (name, value) => {
    state.vars.set(name, value);
    if (name === '$whatifpreference') state.whatIfAll = value.some((v) => /^(?:\$?true|1)$/i.test(v));
  };
  for (const t of tokens) if (t.redirect) push(...resolve(t));
  let words = mergeConcat(tokens.filter((t) => !t.redirect));
  const assignment = assignmentOf(words);
  if (assignment) {
    if (assignment.inline) {
      assign(assignment.name, resolve(assignment.inline));
      return;
    }
    const rest = words.slice(assignment.skip);
    if (rest.length > 0 && rest.every((t, i) => t.quoted || varName(t.text) || /^\$(?:true|false|null)$/i.test(t.text) || (i > 0 && t.list))) {
      assign(assignment.name, rest.flatMap(resolve));
      return;
    }
    words = rest;
  }
  let v = 0;
  let invoked = false;
  while (v < words.length && !words[v].quoted && (['&', '.'].includes(words[v].text) || /^\[[^\]]+\]$/.test(words[v].text))) {
    if (['&', '.'].includes(words[v].text)) invoked = true;
    v++;
  }
  if (v >= words.length) return;
  let verbText = words[v].text;
  if (varName(verbText)) {
    if (!invoked) return;
    const value = state.vars.get(varName(verbText));
    if (!value) {
      if (words.slice(v + 1).some((t) => hintsBoard(t.text))) out.unresolved = true;
      return;
    }
    verbText = value[0];
  }
  let verb = verbText.toLowerCase().replace(/^.*[\\/]/, '');
  verb = state.aliases.get(verb) ?? verb;
  const rest = words.slice(v + 1).filter((t) => !(ctx.dialect === 'bash' && !t.quoted && t.text === '--'));
  const groups = [];
  const named = new Map();
  let whatIf = false;
  const takeList = (i, first) => {
    const group = [...first];
    while (rest[i + 1]?.list) group.push(...resolve(rest[++i]));
    return [i, group];
  };
  for (let i = 0; i < rest.length; i++) {
    const p = param(rest[i]);
    let group;
    if (p === null) {
      [i, group] = takeList(i, resolve(rest[i]));
      groups.push(group);
      continue;
    }
    if (p.name === 'whatif') {
      const flag = p.inline === null ? '$true' : resolve({ text: p.inline, quoted: false, single: false })[0];
      if (!/^(?:\$false|0|)$/i.test(flag)) whatIf = true;
      continue;
    }
    if (p.inline !== null && p.inline !== '') {
      [i, group] = takeList(i, resolve({ text: p.inline, quoted: false, single: false }));
    } else if (p.inline === '' && rest[i + 1]) {
      i++;
      [i, group] = takeList(i, resolve(rest[i]));
    } else if (p.inline === null && p.takesValue && rest[i + 1] && param(rest[i + 1]) === null) {
      i++;
      [i, group] = takeList(i, resolve(rest[i]));
    } else {
      continue;
    }
    named.set(p.name, [...(named.get(p.name) ?? []), ...group]);
  }
  const positional = (from = 0, to = groups.length) => groups.slice(from, to).flat();
  const values = (...names) => names.flatMap((n) => named.get(n) ?? []);
  if (ALIAS_VERBS.has(verb)) {
    const byName = values('name').length > 0;
    const name = values('name')[0] ?? positional(0, 1)[0];
    const value = values('value')[0] ?? positional(byName ? 0 : 1, byName ? 1 : 2)[0];
    if (name && value) state.aliases.set(name.toLowerCase(), value.toLowerCase().replace(/^.*[\\/]/, ''));
    return;
  }
  if (VARIABLE_VERBS.has(verb)) {
    const byName = values('name').length > 0;
    const name = values('name')[0] ?? positional(0, 1)[0];
    const value = values('value').length > 0 ? values('value') : positional(byName ? 0 : 1);
    if (name) assign(`$${name.replace(/^\$/, '').toLowerCase()}`, value);
    return;
  }
  if (LOCATION_VERBS.has(verb) || PUSH_VERBS.has(verb)) {
    const dir = values('path', 'literalpath')[0] ?? positional(0, 1)[0];
    if (PUSH_VERBS.has(verb)) state.stack.push(state.cwd);
    if (dir) state.cwd = isAbsolute(dir) ? slash(dir) : state.cwd === '' ? slash(dir) : `${state.cwd}/${slash(dir)}`;
    return;
  }
  if (POP_VERBS.has(verb)) {
    state.cwd = state.stack.pop() ?? '';
    return;
  }
  if (whatIf || state.whatIfAll) return;
  push(...values('outfile', 'redirectstandardoutput', 'redirectstandarderror'));
  if (BASH_SHELLS.has(verb)) {
    const c = rest.findIndex((t) => !t.quoted && /^-[a-z]*c$/.test(t.text));
    if (c >= 0 && rest[c + 1]) out.bash.push(...resolve(rest[c + 1]));
    return;
  }
  if (verb === 'wsl' || verb === 'wsl.exe') {
    out.bash.push(rest.flatMap(resolve).join(' '));
    return;
  }
  if (NESTED_SHELLS.has(verb)) {
    const inner = rest.filter((t) => t.quoted || !/^[-/](?:c|k|command|noprofile|noninteractive|nologo|executionpolicy|bypass)$/i.test(t.text));
    out.nested.push(inner.flatMap(resolve).join(' '));
    return;
  }
  if (ctx.dialect === 'bash' ? !BASH_WRITE_VERBS.has(verb) : !WRITE_VERBS.has(verb)) return;
  const piped = CONTENT_VERBS.has(verb) || verb === 'clear-content' || verb === 'clc' ? ctx.pipedObjects : ctx.piped;
  if (CONTENT_VERBS.has(verb)) {
    const explicit = values('path', 'literalpath', 'pspath', 'filepath');
    const first = positional(0, 1);
    if (explicit.length === 0 && first.length === 0 && values('variable').length === 0) {
      push(...piped);
      contain(...piped);
    }
    push(...explicit, ...(explicit.length > 0 || values('variable').length > 0 ? [] : first));
  } else if (PATH_VERBS.has(verb)) {
    let paths = [...values('path', 'literalpath', 'pspath'), ...positional()];
    if (paths.length === 0) {
      paths = piped;
      contain(...piped);
    }
    push(...paths);
    if (REMOVE_VERBS.has(verb)) contain(...paths);
    for (const name of values('name')) for (const p of paths.length > 0 ? paths : ['.']) push(`${slash(p).replace(/\/+$/, '')}/${name}`);
  } else if (RENAME_VERBS.has(verb)) {
    const explicit = values('path', 'literalpath', 'pspath');
    const fromPipe = explicit.length === 0 && values('newname').length > 0 && positional().length === 0;
    const sources = fromPipe ? piped : explicit.length > 0 ? explicit : positional(0, 1);
    const newNames = [...values('newname'), ...(explicit.length > 0 || fromPipe ? positional(0, 1) : positional(1, 2))];
    push(...sources);
    contain(...sources);
    for (const s of sources) for (const n of newNames) push(parentJoin(s, n));
  } else if (COPY_VERBS.has(verb) || MOVE_VERBS.has(verb) || BASH_COPY_VERBS.has(verb)) {
    const explicit = values('path', 'literalpath', 'pspath');
    let sources;
    let destinations;
    if (ctx.dialect === 'bash') {
      const all = positional();
      destinations = all.slice(-1);
      sources = all.slice(0, -1);
    } else {
      const fromPipe = explicit.length === 0 && (values('destination').length > 0 ? positional().length === 0 : positional().length <= 1);
      sources = fromPipe ? piped : explicit.length > 0 ? explicit : positional(0, 1);
      const free = explicit.length > 0 || fromPipe ? positional() : positional(1);
      destinations = values('destination').length > 0 ? values('destination') : free.slice(0, 1);
    }
    for (const d of destinations) for (const s of sources) out.copies.push({ source: place(s), dest: place(d), dialect: ctx.dialect });
    push(...destinations);
    for (const d of destinations) for (const s of sources) push(`${slash(d).replace(/\/+$/, '')}/${baseName(s)}`);
    if (MOVE_VERBS.has(verb)) {
      push(...sources);
      contain(...sources);
    }
  }
}

function codeText(command) {
  const strings = [];
  let code = '';
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === '@' && (command[i + 1] === "'" || command[i + 1] === '"') && /^\r?\n/.test(command.slice(i + 2, i + 4))) {
      const close = command.indexOf(`\n${command[i + 1]}@`, i + 2);
      code += ' ';
      i = close < 0 ? command.length : close + 2;
      continue;
    }
    if (ch === '<' && command[i + 1] === '#') {
      const close = command.indexOf('#>', i + 2);
      code += ' ';
      i = close < 0 ? command.length : close + 1;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(command[i - 1]))) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let text = '';
      let j = i + 1;
      for (; j < command.length; j++) {
        if (ch === "'" && command[j] === "'" && command[j + 1] === "'") { text += "'"; j++; continue; }
        if (ch === '"' && command[j] === '`' && j + 1 < command.length) { text += command[++j]; continue; }
        if (command[j] === ch) break;
        text += command[j];
      }
      code += `\u0001${strings.length}\u0001`;
      strings.push({ text, single: ch === "'" });
      i = j;
      continue;
    }
    if (ch === '`' && i + 1 < command.length) {
      code += command[++i];
      continue;
    }
    code += ch;
  }
  return { code, strings };
}

function balanced(code, open) {
  let depth = 0;
  const limit = Math.min(code.length, open + MAX_SCAN);
  for (let j = open; j < limit; j++) {
    if (code[j] === '(') depth++;
    if (code[j] === ')' && --depth === 0) return { args: code.slice(open + 1, j), end: j + 1 };
  }
  return { args: code.slice(open + 1, limit), end: limit };
}

function dotnetArgs(args, strings, vars) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((part) => {
    const p = part.trim().replace(/^\(+|\)+$/g, '').trim();
    const lit = /^\u0001(\d+)\u0001$/.exec(p);
    if (lit) {
      const s = strings[Number(lit[1])];
      if (!s.single && s.text.includes('$')) {
        const text = externalPaths(s.text);
        return { values: [text.replace(/\$(?:\{([^}]+)\}|([\w:]+))/g, (m, a, b) => vars.get(`$${(a ?? b).toLowerCase()}`)?.[0] ?? m)], literal: !/\$/.test(text) || [...text.matchAll(/\$(?:\{([^}]+)\}|([\w:]+))/g)].every((m) => vars.has(`$${(m[1] ?? m[2]).toLowerCase()}`)) };
      }
      return { values: [s.text], literal: true };
    }
    if (/^\$(?:\{?env:|\{?home\b|\{?pwd\b)/i.test(p)) return { values: [externalPaths(p)], literal: true };
    const name = varName(p);
    if (name && vars.has(name)) return { values: vars.get(name), literal: true };
    return { values: [p.replace(/\u0001(\d+)\u0001/g, (_, n) => strings[Number(n)].text)], literal: false };
  });
}

function readOnlyAccess(arg) {
  return arg !== undefined && arg.values.some((v) => /^(?:\[(?:System\.)?IO\.FileAccess\]::)?Read$|^1$/i.test(v.trim()));
}

function capped(matches, out) {
  const list = [];
  for (const m of matches) {
    if (list.length >= MAX_CALLS) {
      out.unresolved = true;
      break;
    }
    list.push(m);
  }
  return list;
}

function dotnetTargets(command, vars, out) {
  const { code, strings } = codeText(command);
  const want = (arg, kind = 'targets') => {
    if (arg === undefined) return;
    if (!arg.literal) out.unresolved = true;
    append(out[kind], arg.values);
  };
  for (const m of capped(code.matchAll(/\[(?:System\.)?IO\.(File|Directory)\]::(\w+)\s*\(/gi), out)) {
    const { args } = balanced(code, m.index + m[0].length - 1);
    const directory = m[1].toLowerCase() === 'directory';
    const method = m[2].toLowerCase();
    const list = dotnetArgs(args, strings, vars);
    if (directory) {
      if (method === 'delete') want(list[0], 'containers');
      else if (method === 'move') { want(list[0], 'containers'); want(list[1]); }
      else if (/^create/.test(method)) want(list[0]);
      continue;
    }
    if (method === 'copy') want(list[1]);
    else if (method === 'move') { want(list[0]); want(list[1]); }
    else if (method === 'replace') list.slice(0, 3).forEach((a) => want(a));
    else if (method === 'open' && readOnlyAccess(list[2])) continue;
    else if (/^(?:write|append|create|delete|open(?!read|text)|set|encrypt|decrypt)/.test(method)) want(list[0]);
  }
  for (const m of capped(code.matchAll(/(?:\[(?:System\.)?IO\.(?:StreamWriter|FileStream)\]::new|New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:StreamWriter|FileStream)(?:\s+-ArgumentList)?)\s*\(/gi), out)) {
    const { args } = balanced(code, m.index + m[0].length - 1);
    const list = dotnetArgs(args, strings, vars);
    if (readOnlyAccess(list[2])) continue;
    want(list[0]);
  }
  for (const m of capped(code.matchAll(/New-Object\s+(?:-TypeName\s+)?(?:System\.)?IO\.(?:StreamWriter|FileStream)\s+(?:-ArgumentList\s+)?(\u0001\d+\u0001|\$[\w:{}]+)/gi), out)) {
    want(dotnetArgs(m[1], strings, vars)[0]);
  }
  if (MUTATING_METHODS.test(code)) {
    for (const m of capped(code.matchAll(FILE_OBJECT_SOURCES), out)) {
      const after = code.slice(m.index + m[0].length, m.index + m[0].length + MAX_SCAN);
      const arg = /^\s*\(?\s*(\u0001\d+\u0001|\$[\w:{}]+)/.exec(after) ?? /^\s+(?:-(?:Path|LiteralPath)\s+)?(\u0001\d+\u0001|\$[\w:{}]+)/i.exec(after);
      if (!arg) continue;
      const [first] = dotnetArgs(arg[1], strings, vars);
      want(first);
      want(first, 'containers');
    }
    for (const m of capped(code.matchAll(/\.\s*(?:CopyTo|MoveTo)\s*\(/gi), out)) {
      const { args } = balanced(code, m.index + m[0].length - 1);
      want(dotnetArgs(args, strings, vars)[0]);
    }
  }
}

function joinPathArgs(args) {
  return args
    .trim()
    .split(/\s+/)
    .filter((a) => a !== '' && !/^-(?:path|childpath|additionalchildpath|resolve)$/i.test(a))
    .map((a) => a.replace(/^['"]|['"]$/g, '').replace(/[\\/]+$/, ''))
    .join('/');
}

function literalAssignments(command) {
  return [...command.matchAll(/\$(\w+)\s*=\s*(['"])((?:(?!\2).)*)\2/g)].map((m) => ({ at: m.index, name: m[1].toLowerCase(), value: m[3] }));
}

function expand(command) {
  const assignments = literalAssignments(command);
  const valueAt = (name, at) => assignments.filter((a) => a.name === name && a.at < at).at(-1)?.value;
  const substitute = (text, at) => externalPaths(text).replace(/\$(\w+)/g, (m, n) => {
    const v = valueAt(n.toLowerCase(), at);
    return v === undefined ? m : `'${v}'`;
  });
  let out = command;
  for (let round = 0; round < 8; round++) {
    const next = out
      .replace(/\(\s*Join-Path\s+([^()|;\n]+?)\s*\)/gi, (m, args, at) => `'${joinPathArgs(substitute(args, at))}'`)
      .replace(/(=\s*)Join-Path\s+([^()|;\n]+)/gi, (m, eq, args, at) => `${eq}'${joinPathArgs(substitute(args, at))}'`);
    if (next === out) break;
    out = next;
  }
  const splats = new Map();
  const addSplat = (name, text) => splats.set(name, [...(splats.get(name) ?? []), text]);
  for (const m of out.matchAll(/\$(\w+)\s*=\s*@\{([^{}]*)\}/g)) {
    const pairs = m[2].split(/[;\n]/).map((p) => /^\s*['"]?([A-Za-z]\w*)['"]?\s*=\s*(.+?)\s*$/.exec(p)).filter(Boolean);
    addSplat(m[1].toLowerCase(), pairs.map((p) => `-${p[1]} ${p[2]}`).join(' '));
  }
  for (const m of out.matchAll(/\$(\w+)(?:\.(\w+)|\[\s*['"](\w+)['"]\s*\])\s*=\s*([^;\n|]+)/g)) {
    addSplat(m[1].toLowerCase(), `-${m[2] ?? m[3]} ${m[4].trim()}`);
  }
  for (const m of out.matchAll(/\$(\w+)\s*=\s*@\(([^()]*)\)/g)) addSplat(m[1].toLowerCase(), m[2].replace(/,/g, ' '));
  return out.replace(/(^|[\s(])@(\w+)(?=$|[\s;|)])/g, (m, lead, name) => (splats.has(name.toLowerCase()) ? `${lead}${splats.get(name.toLowerCase()).join(' ')}` : m));
}

const OBJECT_VERBS = new Set(['get-item', 'gi', 'get-childitem', 'gci', 'ls', 'dir', 'resolve-path', 'rvpa']);

function emitsPathObjects(tokens) {
  const first = (tokens.find((t) => !/^\[[^\]]+\]$/.test(t.text))?.text ?? '').toLowerCase();
  return OBJECT_VERBS.has(first) || tokens.some((t) => /^(?:LiteralPath|Path|PSPath|FullName)=/i.test(t.text));
}

function pathish(tokens) {
  return tokens.map((t) => t.text.replace(/^[A-Za-z]\w*=/, '')).filter((t) => hintsBoard(t) || /[\\/]/.test(t));
}

export function psTargets(command, { dialect = 'powershell', depth = 0 } = {}) {
  const out = { targets: [], containers: [], globs: [], copies: [], bash: [], nested: [], unresolved: false };
  if (depth > 3) {
    append(out.targets, command.split(/[\s'"`,;|()<>{}]+/));
    return out;
  }
  const expanded = expand(command);
  const subexprs = [];
  let vars = new Map();
  for (const splitParens of [true, false]) {
    const state = { vars: new Map(), aliases: new Map(), literals: new Set(), cwd: '', stack: [], whatIfAll: false };
    let stmt = [];
    let stmtObjects = [];
    let afterPipe = false;
    for (const tokens of lex(expanded, { splitParens, subexprs })) {
      commandTargets(tokens, state, out, { dialect, piped: afterPipe ? stmt : [], pipedObjects: afterPipe ? stmtObjects : [] });
      const paths = pathish(tokens);
      append(stmt, paths);
      if (emitsPathObjects(tokens)) append(stmtObjects, paths);
      if (tokens.sep === '|') afterPipe = true;
      else if (tokens.sep === ';') {
        stmt = [];
        stmtObjects = [];
        afterPipe = false;
      }
    }
    if (splitParens) vars = state.vars;
  }
  dotnetTargets(expanded, vars, out);
  const inners = [...new Set([...out.nested, ...subexprs])];
  if (inners.length > MAX_NESTED) {
    out.unresolved = true;
    append(out.targets, command.split(/[\s'"`,;|()<>{}]+/));
    return out;
  }
  for (const inner of inners) {
    const sub = psTargets(inner, { dialect: 'powershell', depth: depth + 1 });
    for (const key of ['targets', 'containers', 'globs', 'copies', 'bash']) append(out[key], sub[key]);
    out.unresolved ||= sub.unresolved;
  }
  return out;
}
