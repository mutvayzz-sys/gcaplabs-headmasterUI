/**
 * Stage GCAPCore for local dev and packaging.
 *
 * The current upstream artifact is still produced by the original core build.
 * We fetch it through the shared preparer, then materialize the app-facing
 * GCAPCore directory and binary name.
 *
 * Usage:
 *   node scripts/prepareGcapcore.js
 *   node scripts/prepareGcapcore.js --platform win32 --arch x64
 */

const path = require('path');
const { prepareAioncore } = require('../packages/shared-scripts/src/prepare-aioncore.js');
const {
  importGcapcoreResourcesFromUpstream,
  prepareOfficecliResource,
} = require('../packages/shared-scripts/src/gcapcore-resources.js');
const { resolveGcapcoreVersion } = require('./resolveGcapcoreVersion.js');

function parseArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const projectRoot = path.resolve(__dirname, '..');
const platform = parseArg('--platform', process.platform);
const arch = parseArg('--arch', process.arch);
const version = parseArg('--version', resolveGcapcoreVersion(projectRoot));
const officecliVersion = parseArg('--officecli-version', process.env.HEADMASTER_OFFICECLI_VERSION || 'latest');

function versionsMatch(actual, expected) {
  return actual === expected || actual === (expected.startsWith('v') ? expected.slice(1) : `v${expected}`);
}

function upstreamCoreVersionMatches(manifestPath, expected) {
  if (!require('fs').existsSync(manifestPath)) return false;
  if (!expected || expected === 'latest') return true;
  try {
    const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
    const actual = typeof manifest.version === 'string' ? manifest.version.trim() : '';
    return versionsMatch(actual, expected);
  } catch {
    return false;
  }
}

try {
  const fs = require('fs');
  const upstreamBinary = path.join(
    projectRoot,
    'resources',
    'bundled-aioncore',
    `${platform}-${arch}`,
    platform === 'win32' ? 'aioncore.exe' : 'aioncore'
  );
  const upstreamManifest = path.join(projectRoot, 'resources', 'bundled-aioncore', `${platform}-${arch}`, 'manifest.json');
  if (!process.argv.includes('--refresh')) {
    // Reuse the upstream artifact cache when present; it already contains the
    // managed ACP resources prepared by the core binary.
    if (!fs.existsSync(upstreamBinary) || !upstreamCoreVersionMatches(upstreamManifest, version)) {
      prepareAioncore({ projectRoot, platform, arch, version });
    }
  } else {
    prepareAioncore({ projectRoot, platform, arch, version });
  }
  const imported = importGcapcoreResourcesFromUpstream({ projectRoot, platform, arch });
  if (!imported) {
    throw new Error(`Could not import prepared upstream core resources for ${platform}-${arch}`);
  }
  prepareOfficecliResource({ projectRoot, platform, arch, version: officecliVersion });
  console.log(`GCAPCore staged with managed ACP resources: resources/bundled-gcapcore/${platform}-${arch}`);
} catch (error) {
  console.error('prepareGcapcore failed:', error.message);
  process.exit(1);
}
