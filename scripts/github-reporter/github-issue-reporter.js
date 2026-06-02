#!/usr/bin/env node
/**
 * Flowflex — GitHub Issue Auto-Reporter
 * Roda automaticamente quando testes falham.
 * Credenciais lidas APENAS do .env — nunca hardcoded, nunca commitadas.
 */
'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ─── Carregar .env (sem dependência externa) ─────────────────────────────────
function loadEnv() {
  // Procura .env subindo até 3 níveis da pasta do script
  const dirs = [
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
  ];
  for (const dir of dirs) {
    const envPath = path.join(dir, '.env');
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
    break;
  }
}
loadEnv();

// ─── Config (lida do ambiente, nunca do código) ───────────────────────────────
const TOKEN          = process.env.GITHUB_TOKEN;
const OWNER          = process.env.GITHUB_OWNER          || 'Qu4troBits';
const REPO_FRONTEND  = process.env.GITHUB_REPO_FRONTEND  || 'flowflex';
const REPO_BACKEND   = process.env.GITHUB_REPO_BACKEND   || 'flow-flex-backend';
const BRANCH         = process.env.GITHUB_BRANCH         || 'qa-teste-github-issue';

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args     = parseArgs(process.argv.slice(2));
const testType = (args['type']   || '').toLowerCase();
const report   = args['report']  || '';
const dryRun   = 'dry-run' in args;

if (!testType || !report) {
  console.error('Uso: node github-issue-reporter.js --type <cypress|playwright|api> --report <caminho>');
  process.exit(1);
}
if (!TOKEN) {
  console.error('❌  GITHUB_TOKEN não encontrado. Configure o arquivo .env');
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🔍  Processando relatório [${testType}]: ${report}`);

  let failures = [];
  if (testType === 'cypress')    failures = parseCypressReport(report);
  else if (testType === 'playwright') failures = parsePlaywrightReport(report);
  else if (testType === 'api')   failures = parseJUnitReports(report);
  else { console.error(`❌  Tipo inválido: ${testType}`); process.exit(1); }

  if (failures.length === 0) {
    console.log('✅  Nenhuma falha. Nenhuma issue será aberta.');
    return;
  }

  const repo = ['cypress', 'playwright'].includes(testType) ? REPO_FRONTEND : REPO_BACKEND;
  console.log(`\n🐛  ${failures.length} falha(s) → repo: ${OWNER}/${repo} | branch: ${BRANCH}\n`);

  let opened = 0, skipped = 0;

  for (const f of failures) {
    const title  = buildTitle(testType, f);
    const body   = buildBody(testType, f, repo);
    const labels = getLabels(testType);

    if (dryRun) {
      console.log(`[DRY-RUN] Issue: "${title}"`);
      console.log(body.slice(0, 300) + '\n...\n');
      continue;
    }

    // Deduplicação: não abre se já existe issue aberta com mesmo título
    const existing = await findOpenIssue(repo, title);
    if (existing) {
      console.log(`⏩  Já existe #${existing.number}: "${title}"`);
      skipped++;
      continue;
    }

    try {
      const issue = await createIssue(repo, title, body, labels);
      console.log(`✅  Issue aberta → #${issue.number}: ${issue.html_url}`);
      opened++;
    } catch (err) {
      console.error(`❌  Erro ao criar issue: ${err.message}`);
    }

    await sleep(800); // respeitar rate limit
  }

  if (!dryRun) {
    console.log(`\n📊  ${opened} issue(s) abertas · ${skipped} duplicata(s) ignorada(s)`);
  }
})();

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseCypressReport(reportPath) {
  const failures = [];
  for (const file of resolveFiles(reportPath, ['.json'])) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const suites = data?.results?.[0]?.suites || data?.suites || [];
    walkMochaSuites(suites, failures);
  }
  return failures;
}

function parsePlaywrightReport(reportPath) {
  const failures = [];
  for (const file of resolveFiles(reportPath, ['.json'])) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    walkPlaywrightSuites(data?.suites || [], failures);
  }
  return failures;
}

function parseJUnitReports(reportPath) {
  const failures = [];
  for (const file of resolveFiles(reportPath, ['.xml'])) {
    let xml;
    try { xml = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const testcases = [...xml.matchAll(/<testcase[^>]*name="([^"]*)"[^>]*classname="([^"]*)"[^/]*>([\s\S]*?)<\/testcase>/g)];
    for (const [, name, classname, inner] of testcases) {
      const m = inner.match(/<(?:failure|error)[^>]*(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/(?:failure|error)>/);
      if (!m) continue;
      failures.push({ suite: classname, title: name, error: m[1] || 'Falha sem mensagem', stacktrace: m[2]?.trim() || '', file: path.basename(file), duration: '?' });
    }
  }
  return failures;
}

function walkMochaSuites(suites, out, parent = '') {
  for (const s of suites) {
    const name = [parent, s.title].filter(Boolean).join(' › ');
    for (const t of s.tests || []) {
      if (t.pass || t.pending || t.skipped) continue;
      out.push({ suite: name, title: t.title, error: t.err?.message || 'Erro desconhecido', stacktrace: t.err?.estack || t.err?.stack || '', file: t.file || s.file || '', duration: t.duration || 0, screenshot: t.screenshots?.[0]?.path || null });
    }
    if (s.suites?.length) walkMochaSuites(s.suites, out, name);
  }
}

function walkPlaywrightSuites(suites, out, parent = '') {
  for (const s of suites) {
    const name = [parent, s.title].filter(Boolean).join(' › ');
    for (const spec of s.specs || []) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          if (result.status === 'passed' || result.status === 'skipped') continue;
          out.push({ suite: name, title: spec.title, error: result.error?.message || 'Falha', stacktrace: result.error?.stack || '', file: spec.file || '', duration: result.duration || 0, browser: test.projectName || '' });
        }
      }
    }
    if (s.suites?.length) walkPlaywrightSuites(s.suites, out, name);
  }
}

// ─── Builders ─────────────────────────────────────────────────────────────────
function buildTitle(type, f) {
  const emoji = { cypress: '🌲', playwright: '🎭', api: '⚙️' }[type] || '🐛';
  return `${emoji} [${f.suite || type}] ${f.title}`.slice(0, 200);
}

function buildBody(type, f, repo) {
  const typeLabel = { cypress: 'Cypress E2E', playwright: 'Playwright E2E', api: 'API/Backend (JUnit)' }[type];
  const browser   = f.browser   ? `\n- **Browser:** \`${f.browser}\`` : '';
  const file      = f.file      ? `\n- **Arquivo:** \`${f.file}\`` : '';
  const duration  = typeof f.duration === 'number' ? `${f.duration}ms` : f.duration;
  const screenshot = f.screenshot ? `\n\n### 📸 Screenshot\n\`\`\`\n${f.screenshot}\n\`\`\`` : '';
  const now        = new Date().toISOString();

  return `## 🐛 Falha Detectada Automaticamente

> Gerada pelo **Flowflex Test Reporter** em \`${now}\`
> Branch: \`${BRANCH}\` · Repositório: \`${OWNER}/${repo}\`

---

### 📋 Detalhes

| Campo | Valor |
|---|---|
| **Tipo** | ${typeLabel} |
| **Suite** | \`${f.suite || 'N/A'}\` |
| **Teste** | \`${f.title}\` |
| **Duração** | \`${duration}\` |${browser}${file}

---

### ❌ Mensagem de Erro

\`\`\`
${(f.error || 'Erro desconhecido').trim()}
\`\`\`

---

### 🔍 Stack Trace

\`\`\`
${(f.stacktrace || 'Stack trace não disponível').trim().slice(0, 4000)}
\`\`\`
${screenshot}

---

### ✅ Checklist de Investigação

- [ ] Reproduzir localmente
- [ ] Verificar logs do backend (\`./mvnw spring-boot:run\`)
- [ ] Verificar logs do frontend (\`npm run dev\`)
- [ ] Identificar commit causador (\`git bisect\`)
- [ ] Corrigir e adicionar teste de regressão
- [ ] Fechar esta issue após merge

---
*🤖 Gerado automaticamente por [github-issue-reporter.js](../scripts/github-reporter/) · Flowflex QA Pipeline*`;
}

function getLabels(type) {
  return {
    cypress:    ['bug', 'test:e2e', 'frontend', 'automated-report'],
    playwright: ['bug', 'test:e2e', 'frontend', 'automated-report'],
    api:        ['bug', 'test:api', 'backend',  'automated-report'],
  }[type] || ['bug', 'automated-report'];
}

// ─── GitHub API ───────────────────────────────────────────────────────────────
async function createIssue(repo, title, body, labels) {
  return githubRequest('POST', `/repos/${OWNER}/${repo}/issues`,
    JSON.stringify({ title, body, labels }));
}

async function findOpenIssue(repo, title) {
  try {
    const q   = encodeURIComponent(`repo:${OWNER}/${repo} is:issue is:open "${title.slice(0, 60)}"`);
    const res = await githubRequest('GET', `/search/issues?q=${q}`);
    return res.items?.[0] || null;
  } catch { return null; }
}

function githubRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'Authorization':        `token ${TOKEN}`,
        'Accept':               'application/vnd.github+json',
        'User-Agent':           'flowflex-test-reporter/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) { reject(new Error(`GitHub ${res.statusCode}: ${data}`)); return; }
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function resolveFiles(p, exts) {
  if (!fs.existsSync(p)) { console.warn(`⚠️  Não encontrado: ${p}`); return []; }
  if (fs.statSync(p).isDirectory())
    return fs.readdirSync(p).filter(f => exts.some(e => f.endsWith(e))).map(f => path.join(p, f));
  return [p];
}

function parseArgs(argv) {
  const r = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      r[k] = (!argv[i+1] || argv[i+1].startsWith('--')) ? true : argv[++i];
    }
  }
  return r;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
