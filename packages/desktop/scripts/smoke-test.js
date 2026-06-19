/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smoke test for Phase 2–5 screens.
 * Run with: node scripts/smoke-test.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src/renderer/pages');
const ROUTER = path.join(ROOT, 'src/renderer/components/layout/Router.tsx');
const NAV = path.join(ROOT, 'src/renderer/components/layout/Sider/SiderNav/Phase2Nav.tsx');
const I18N = path.join(ROOT, 'src/renderer/services/i18n/locales/en-US/common.json');

let exitCode = 0;
function fail(msg) {
  console.error('❌', msg);
  exitCode = 1;
}
function pass(msg) {
  console.log('✅', msg);
}

const REQUIRED_PAGES = [
  'dashboard',
  'activity',
  'documents',
  'memory',
  'workflows',
  'agents',
  'integrations',
  'kanban',
  'browser',
  'assets',
];

const REQUIRED_ROUTES = [
  '/dashboard',
  '/activity',
  '/documents',
  '/memory',
  '/workflows',
  '/agents',
  '/integrations',
  '/kanban',
  '/browser',
  '/assets',
];

const REQUIRED_NAV = [
  'Dashboard',
  'Activity',
  'Documents',
  'Memory',
  'Skills',
  'Agents',
  'Integrations',
  'Browser',
  'Assets',
  'Kanban',
];

const FORBIDDEN_ROUTES = ['/approvals'];

const FORBIDDEN_NAV = ['Approvals'];

// --- Page files exist + export default ---
for (const page of REQUIRED_PAGES) {
  const indexFile = path.join(PAGES_DIR, page, 'index.tsx');
  if (!fs.existsSync(indexFile)) {
    fail(`Page file missing: ${indexFile}`);
    continue;
  }
  const content = fs.readFileSync(indexFile, 'utf8');
  if (!content.includes('export default')) {
    fail(`Page missing default export: ${page}`);
  } else {
    pass(`Page exists with default export: ${page}`);
  }
}

// --- Router routes ---
const routerContent = fs.readFileSync(ROUTER, 'utf8');
for (const route of REQUIRED_ROUTES) {
  if (routerContent.includes(`path='${route}'`)) {
    pass(`Route wired: ${route}`);
  } else {
    fail(`Route missing in Router.tsx: ${route}`);
  }
}
for (const route of FORBIDDEN_ROUTES) {
  if (routerContent.includes(`path='${route}'`)) {
    fail(`Forbidden route still present: ${route}`);
  } else {
    pass(`Forbidden route removed: ${route}`);
  }
}

// --- Nav items ---
const navContent = fs.readFileSync(NAV, 'utf8');
for (const label of REQUIRED_NAV) {
  if (navContent.includes(label)) {
    pass(`Nav item present: ${label}`);
  } else {
    fail(`Nav item missing: ${label}`);
  }
}
for (const label of FORBIDDEN_NAV) {
  if (navContent.includes(label)) {
    fail(`Forbidden nav item still present: ${label}`);
  } else {
    pass(`Forbidden nav item removed: ${label}`);
  }
}

// --- i18n keys ---
const REQUIRED_I18N_KEYS = [
  'dashboard',
  'activity',
  'documents',
  'memory',
  'skills',
  'agents',
  'integrations',
  'kanban',
  'browser',
  'assets',
];
const i18nContent = fs.readFileSync(I18N, 'utf8');
for (const key of REQUIRED_I18N_KEYS) {
  const quotedKey = `"${key}"`;
  if (i18nContent.includes(quotedKey)) {
    pass(`i18n key present: ${quotedKey}`);
  } else {
    fail(`i18n key missing: ${quotedKey}`);
  }
}

// --- Brand scan: no @icon-park in new pages ---
const NEW_PAGES = [
  'dashboard',
  'activity',
  'documents',
  'memory',
  'workflows',
  'agents',
  'integrations',
  'kanban',
  'browser',
  'assets',
];
for (const page of NEW_PAGES) {
  const indexFile = path.join(PAGES_DIR, page, 'index.tsx');
  if (!fs.existsSync(indexFile)) continue;
  const content = fs.readFileSync(indexFile, 'utf8');
  if (content.includes('@icon-park/react')) {
    fail(`Brand violation — @icon-park/react in ${page}/index.tsx`);
  } else {
    pass(`Brand clean — no @icon-park in ${page}`);
  }
}

// --- Brand scan: no public version numbers in new page source ---
// Only match version numbers preceded by whitespace/quote/comma — NOT IPs
const VERSION_RE = /(?<![\d\.])(?<=[\s'"`,=])v?\d+\.\d+\.\d+(?!\.\d)/;
for (const page of NEW_PAGES) {
  const hookFile = path.join(PAGES_DIR, page, `use${page.charAt(0).toUpperCase() + page.slice(1)}.ts`);
  if (!fs.existsSync(hookFile)) continue;
  const content = fs.readFileSync(hookFile, 'utf8');
  if (VERSION_RE.test(content)) {
    const match = content.match(VERSION_RE);
    fail(`Potential version leak in ${page} hook: ${match?.[0]}`);
  } else {
    pass(`No version leak in ${page} hook`);
  }
}

// --- Summary ---
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log('🎉 All smoke tests passed. Build is ready.');
} else {
  console.log('💥 Smoke test failed. Fix the issues above before shipping.');
}
process.exit(exitCode);
