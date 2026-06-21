/**
 * Resolve the aioncore version tag to download for packaging.
 *
 * Order:
 *   1. HEADMASTER_AIONCORE_VERSION or AIONUI_BACKEND_VERSION env override
 *   2. "aioncoreVersion" field in repo-root package.json (the pin)
 *   3. 'latest' (GitHub API releases/latest; non-reproducible fallback)
 */

const fs = require('fs');
const path = require('path');

function resolveAioncoreVersion(projectRoot) {
  const envOverride = process.env.HEADMASTER_AIONCORE_VERSION || process.env.AIONUI_BACKEND_VERSION;
  if (envOverride && envOverride.trim()) {
    return envOverride.trim();
  }

  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg && typeof pkg.aioncoreVersion === 'string' && pkg.aioncoreVersion.trim()) {
      return pkg.aioncoreVersion.trim();
    }
  } catch {
    // fall through
  }

  return 'latest';
}

module.exports = { resolveAioncoreVersion };
