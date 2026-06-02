/**
 * Flowflex — Cypress Plugin: GitHub Issue Auto-Reporter
 *
 * Adicione em cypress.config.ts:
 *
 *   import { setupGithubReporter } from './scripts/github-reporter/cypress-plugin'
 *
 *   export default defineConfig({
 *     e2e: {
 *       setupNodeEvents(on, config) {
 *         setupGithubReporter(on)
 *         return config
 *       },
 *       reporter: 'mochawesome',
 *       reporterOptions: {
 *         reportDir: 'cypress/results',
 *         overwrite: false,
 *         html: false,
 *         json: true,
 *       },
 *     },
 *   })
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

function setupGithubReporter(on, options = {}) {
  const reportDir = options.reportDir || 'cypress/results';
  const dryRun    = options.dryRun    || false;

  on('after:run', (results) => {
    if (!results || (results.totalFailed || 0) === 0) {
      console.log('\n[GH Reporter] ✅ Todos os testes passaram.');
      return;
    }

    console.log(`\n[GH Reporter] 🐛 ${results.totalFailed} falha(s) → abrindo issues no GitHub...`);

    const script = path.join(__dirname, 'github-issue-reporter.js');
    const cmd    = ['node', `"${script}"`, '--type', 'cypress', '--report', `"${reportDir}"`];
    if (dryRun) cmd.push('--dry-run');

    try {
      const out = execSync(cmd.join(' '), { encoding: 'utf8', stdio: 'pipe' });
      console.log(out);
    } catch (err) {
      console.error('[GH Reporter] ❌', err.stderr || err.message);
    }
  });
}

module.exports = { setupGithubReporter };
