/**
 * Download and stage the AionCore binary for local dev and packaging.
 *
 * Usage:
 *   node scripts/prepareAioncore.js
 *   node scripts/prepareAioncore.js --platform win32 --arch x64
 */

const path = require('path');
const { prepareAioncore } = require('../packages/shared-scripts/src/prepare-aioncore.js');
const { resolveAioncoreVersion } = require('./resolveAioncoreVersion.js');

function parseArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const projectRoot = path.resolve(__dirname, '..');
const platform = parseArg('--platform', process.platform);
const arch = parseArg('--arch', process.arch);
const version = parseArg('--version', resolveAioncoreVersion(projectRoot));

try {
  prepareAioncore({ projectRoot, platform, arch, version });
} catch (error) {
  console.error('❌ prepareAioncore failed:', error.message);
  process.exit(1);
}
