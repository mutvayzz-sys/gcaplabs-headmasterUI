/**
 * Resolve the GCAPCore version tag to stage for packaging.
 *
 * Order:
 *   1. HEADMASTER_GCAPCORE_VERSION / HEADMASTER_CORE_VERSION env override
 *   2. "gcapcoreVersion" field in repo-root package.json
 *   3. 'latest' (GitHub API releases/latest; non-reproducible fallback)
 */

const fs = require('fs');
const path = require('path');

function resolveGcapcoreVersion(projectRoot) {
  const envOverride = process.env.HEADMASTER_GCAPCORE_VERSION || process.env.HEADMASTER_CORE_VERSION;
  if (envOverride && envOverride.trim()) {
    return envOverride.trim();
  }

  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg && typeof pkg.gcapcoreVersion === 'string' && pkg.gcapcoreVersion.trim()) {
      return pkg.gcapcoreVersion.trim();
    }
  } catch {
    // fall through
  }

  return 'latest';
}

module.exports = { resolveGcapcoreVersion };
