/**
 * Flowflex — Playwright Reporter: GitHub Issue Auto-Reporter
 *
 * Adicione em playwright.config.ts:
 *
 *   export default defineConfig({
 *     reporter: [
 *       ['json', { outputFile: 'playwright-report/results.json' }],
 *       ['html'],
 *       ['./scripts/github-reporter/playwright-reporter.js'],
 *     ],
 *   })
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

class GithubIssueReporter {
  constructor(options = {}) {
    this._reportFile = options.reportFile || 'playwright-report/results.json';
    this._dryRun     = options.dryRun     || false;
    this._failures   = 0;
  }

  onBegin()  { console.log('\n[GH Reporter] 🎭 Playwright iniciado.'); }

  onTestEnd(test, result) {
    if (result.status !== 'passed' && result.status !== 'skipped') this._failures++;
  }

  onEnd() {
    if (this._failures === 0) {
      console.log('\n[GH Reporter] ✅ Todos os testes passaram.');
      return;
    }

    console.log(`\n[GH Reporter] 🐛 ${this._failures} falha(s) → abrindo issues no GitHub...`);

    // Aguarda o JSON ser escrito (até 10s)
    let wait = 0;
    while (!fs.existsSync(this._reportFile) && wait++ < 10) {
      try { execSync('sleep 1'); } catch { break; }
    }

    if (!fs.existsSync(this._reportFile)) {
      console.error(`[GH Reporter] ❌ Relatório não encontrado: ${this._reportFile}`);
      return;
    }

    const script = path.join(__dirname, 'github-issue-reporter.js');
    const cmd    = ['node', `"${script}"`, '--type', 'playwright', '--report', `"${this._reportFile}"`];
    if (this._dryRun) cmd.push('--dry-run');

    try {
      const out = execSync(cmd.join(' '), { encoding: 'utf8', stdio: 'pipe' });
      console.log(out);
    } catch (err) {
      console.error('[GH Reporter] ❌', err.stderr || err.message);
    }
  }
}

module.exports = GithubIssueReporter;
