const fs = require('fs');
const path = require('path');

const REQUIRED_ACP_TOOLS = ['codex-acp', 'claude-agent-acp'];

function binaryName(platform, baseName) {
  return platform === 'win32' ? `${baseName}.exe` : baseName;
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function bundledPath(runtimeKey, ...parts) {
  return normalize(path.join('bundled-gcapcore', runtimeKey, ...parts));
}

function isFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function readDirectories(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function nodeExecutableParts(platform) {
  return platform === 'win32' ? ['node.exe'] : ['bin', 'node'];
}

function getRuntimeKey(platform, arch) {
  return `${platform}-${arch}`;
}

function getGcapcoreRuntimeDir(projectRoot, platform, arch) {
  return path.join(projectRoot, 'resources', 'bundled-gcapcore', getRuntimeKey(platform, arch));
}

function getUpstreamRuntimeDir(projectRoot, platform, arch) {
  return path.join(projectRoot, 'resources', 'bundled-aioncore', getRuntimeKey(platform, arch));
}

function getOfficecliAssetName(platform, arch) {
  if (platform === 'win32') {
    if (arch === 'x64') return 'officecli-win-x64.exe';
    if (arch === 'arm64') return 'officecli-win-arm64.exe';
    return null;
  }
  if (platform === 'darwin') {
    if (arch === 'x64') return 'officecli-mac-x64';
    if (arch === 'arm64') return 'officecli-mac-arm64';
    return null;
  }
  if (platform === 'linux') {
    if (arch === 'x64') return 'officecli-linux-x64';
    if (arch === 'arm64') return 'officecli-linux-arm64';
  }
  return null;
}

function getOfficecliBinDir(runtimeDir) {
  return path.join(runtimeDir, 'managed-resources', 'officecli', 'bin');
}

function getOfficecliBinaryPath(runtimeDir, platform) {
  return path.join(getOfficecliBinDir(runtimeDir), binaryName(platform, 'officecli'));
}

function summarizeManagedResources(targetDir, platform, runtimeKey) {
  const nodeRoot = path.join(targetDir, 'managed-resources', 'node');
  const acpRoot = path.join(targetDir, 'managed-resources', 'acp');

  return {
    node: readDirectories(nodeRoot).map((version) => ({
      version,
      executable: normalize(path.join('managed-resources', 'node', version, ...nodeExecutableParts(platform))),
    })),
    acp: REQUIRED_ACP_TOOLS.map((toolId) => ({
      id: toolId,
      versions: readDirectories(path.join(acpRoot, toolId)).map((version) => {
        const manifestPath = path.join(acpRoot, toolId, version, runtimeKey, 'manifest.json');
        const manifest = readJson(manifestPath);
        return {
          version,
          runtimeKey,
          entrypoint: typeof manifest?.entrypoint === 'string' ? manifest.entrypoint : null,
        };
      }),
    })),
    officecli: {
      executable: normalize(path.relative(targetDir, getOfficecliBinaryPath(targetDir, platform))),
    },
  };
}

function requireRelativePath(baseDir, runtimeKey, parts, checked, missing) {
  const relativePath = bundledPath(runtimeKey, ...parts);
  checked.push(relativePath);
  if (!fs.existsSync(path.join(baseDir, ...parts))) {
    missing.push(relativePath);
  }
}

function requireManagedNode(baseDir, runtimeKey, platform, checked, missing) {
  const nodeRoot = path.join(baseDir, 'managed-resources', 'node');
  const versions = readDirectories(nodeRoot);
  const executableParts = nodeExecutableParts(platform);
  const relativePath = bundledPath(runtimeKey, 'managed-resources', 'node', '*', ...executableParts);
  checked.push(relativePath);

  if (versions.length === 0) {
    missing.push(relativePath);
    return;
  }

  const executableFound = versions.some((version) => isFile(path.join(nodeRoot, version, ...executableParts)));
  if (!executableFound) {
    missing.push(relativePath);
  }
}

function requireManagedAcpTool(baseDir, runtimeKey, toolId, checked, missing) {
  const toolRoot = path.join(baseDir, 'managed-resources', 'acp', toolId);
  const versions = readDirectories(toolRoot);
  const manifestRelativePath = bundledPath(
    runtimeKey,
    'managed-resources',
    'acp',
    toolId,
    '*',
    runtimeKey,
    'manifest.json'
  );
  checked.push(manifestRelativePath);

  if (versions.length === 0) {
    missing.push(manifestRelativePath);
    return;
  }

  for (const version of versions) {
    const platformRoot = path.join(toolRoot, version, runtimeKey);
    const manifestPath = path.join(platformRoot, 'manifest.json');
    if (!isFile(manifestPath)) {
      missing.push(manifestRelativePath);
      continue;
    }

    const manifest = readJson(manifestPath);
    const entrypoint = typeof manifest?.entrypoint === 'string' ? manifest.entrypoint : null;
    if (!entrypoint) {
      missing.push(bundledPath(runtimeKey, 'managed-resources', 'acp', toolId, version, runtimeKey, '<entrypoint>'));
      continue;
    }

    const entrypointRelativePath = bundledPath(
      runtimeKey,
      'managed-resources',
      'acp',
      toolId,
      version,
      runtimeKey,
      entrypoint
    );
    checked.push(entrypointRelativePath);

    if (!isFile(path.join(platformRoot, entrypoint))) {
      missing.push(entrypointRelativePath);
    }
  }
}

function requireManagedOfficecli(baseDir, runtimeKey, platform, checked, missing) {
  const relativePath = bundledPath(
    runtimeKey,
    'managed-resources',
    'officecli',
    'bin',
    binaryName(platform, 'officecli')
  );
  checked.push(relativePath);
  if (!isFile(getOfficecliBinaryPath(baseDir, platform))) {
    missing.push(relativePath);
  }
}

function verifyGcapcoreResources({ resourcesDir, electronPlatformName, targetArch, requireOfficecli = true }) {
  const runtimeKey = getRuntimeKey(electronPlatformName, targetArch);
  const baseDir = path.join(resourcesDir, 'bundled-gcapcore', runtimeKey);
  const checked = [];
  const missing = [];

  requireRelativePath(baseDir, runtimeKey, [binaryName(electronPlatformName, 'gcapcore')], checked, missing);
  requireRelativePath(baseDir, runtimeKey, ['manifest.json'], checked, missing);
  requireRelativePath(baseDir, runtimeKey, ['managed-resources'], checked, missing);
  requireManagedNode(baseDir, runtimeKey, electronPlatformName, checked, missing);
  for (const toolId of REQUIRED_ACP_TOOLS) {
    requireManagedAcpTool(baseDir, runtimeKey, toolId, checked, missing);
  }
  if (requireOfficecli) {
    requireManagedOfficecli(baseDir, runtimeKey, electronPlatformName, checked, missing);
  }

  return { runtimeKey, checked, missing };
}

function assertGcapcoreResources(options) {
  const result = verifyGcapcoreResources(options);
  if (result.missing.length > 0) {
    throw new Error(`Missing GCAPCore managed resources for ${result.runtimeKey}: ${result.missing.join(', ')}`);
  }
  return result;
}

function importGcapcoreResourcesFromUpstream({ projectRoot, platform, arch }) {
  const runtimeKey = getRuntimeKey(platform, arch);
  const sourceDir = getUpstreamRuntimeDir(projectRoot, platform, arch);
  const targetDir = getGcapcoreRuntimeDir(projectRoot, platform, arch);
  const sourceBinary = path.join(sourceDir, binaryName(platform, 'aioncore'));

  if (!isFile(sourceBinary)) {
    return false;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });

  const copiedSourceBinary = path.join(targetDir, binaryName(platform, 'aioncore'));
  const targetBinary = path.join(targetDir, binaryName(platform, 'gcapcore'));
  fs.copyFileSync(copiedSourceBinary, targetBinary);
  if (copiedSourceBinary !== targetBinary) {
    fs.rmSync(copiedSourceBinary, { force: true });
  }
  if (platform !== 'win32') {
    try {
      fs.chmodSync(targetBinary, 0o755);
    } catch {}
  }

  const verification = assertGcapcoreResources({
    resourcesDir: path.join(projectRoot, 'resources'),
    electronPlatformName: platform,
    targetArch: arch,
    requireOfficecli: false,
  });

  const stagingDir = path.join(targetDir, 'managed-resources', '.staging');
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  const upstreamManifest = readJson(path.join(sourceDir, 'manifest.json')) ?? {};
  writeJson(path.join(targetDir, 'manifest.json'), {
    ...upstreamManifest,
    product: 'GCAPCore',
    platform,
    arch,
    runtimeKey,
    generatedAt: new Date().toISOString(),
    importedFrom: {
      product: 'AionCore',
      path: normalize(path.relative(projectRoot, sourceDir)),
      sourceType: upstreamManifest.sourceType,
      source: upstreamManifest.source,
    },
    features: ['council', 'acp', 'mcp', 'cron', 'officecli', 'preview'],
    files: [binaryName(platform, 'gcapcore'), 'managed-resources/'],
    managedResources: summarizeManagedResources(targetDir, platform, runtimeKey),
    verified: {
      checked: verification.checked,
      missing: verification.missing,
    },
  });

  return true;
}

function resolveOfficecliLatestTag() {
  try {
    const out = require('child_process').execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$ProgressPreference='SilentlyContinue'; (Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/iOfficeAI/OfficeCLI/releases/latest' -MaximumRedirection 5).BaseResponse.ResponseUri.AbsoluteUri",
      ],
      { encoding: 'utf8', timeout: 30000 }
    );
    const match = out.match(/\/releases\/tag\/(v[0-9]+\.[0-9]+\.[0-9]+)/);
    if (match) return match[1];
  } catch {
    // fall through
  }
  return null;
}

function downloadOfficecliFile(urls, outputPath) {
  const { execFileSync } = require('child_process');
  let lastError = null;
  for (const url of urls) {
    try {
      if (process.platform === 'win32') {
        const ps = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${url}' -OutFile '${outputPath.replace(/'/g, "''")}' -TimeoutSec 300`;
        execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 300000 });
      } else {
        execFileSync('curl', ['-fsSL', '--max-time', '300', '-o', outputPath, url], { timeout: 300000 });
      }
      return url;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Failed to download ${outputPath}`);
}

function checksumFile(filePath) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readChecksumForAsset(checksumPath, assetName) {
  if (!fs.existsSync(checksumPath)) return null;
  for (const line of fs.readFileSync(checksumPath, 'utf8').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === assetName) return parts[0].toLowerCase();
  }
  return null;
}

function prepareOfficecliResource({ projectRoot, platform, arch, version = 'latest' }) {
  const assetName = getOfficecliAssetName(platform, arch);
  if (!assetName) {
    throw new Error(`Unsupported OfficeCLI target: ${platform}-${arch}`);
  }

  const tag = version === 'latest' ? resolveOfficecliLatestTag() || 'latest' : version;
  const runtimeDir = getGcapcoreRuntimeDir(projectRoot, platform, arch);
  const binDir = getOfficecliBinDir(runtimeDir);
  const targetBinary = getOfficecliBinaryPath(runtimeDir, platform);
  const tempDir = path.join(require('os').tmpdir(), 'gcapcore-officecli', tag, `${platform}-${arch}`);
  const tempBinary = path.join(tempDir, assetName);
  const checksumPath = path.join(tempDir, 'SHA256SUMS');

  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  const versionPath = tag === 'latest' ? 'latest/download' : `download/${tag}`;
  const assetUrls = [
    `https://d.officecli.ai/releases/${versionPath}/${assetName}`,
    `https://github.com/iOfficeAI/OfficeCLI/releases/${versionPath}/${assetName}`,
  ];
  const checksumUrls = [
    `https://d.officecli.ai/releases/${versionPath}/SHA256SUMS`,
    `https://github.com/iOfficeAI/OfficeCLI/releases/${versionPath}/SHA256SUMS`,
  ];

  const sourceUrl = downloadOfficecliFile(assetUrls, tempBinary);
  try {
    downloadOfficecliFile(checksumUrls, checksumPath);
    const expected = readChecksumForAsset(checksumPath, assetName);
    if (expected) {
      const actual = checksumFile(tempBinary);
      if (actual !== expected) {
        throw new Error(`OfficeCLI checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`);
      }
    }
  } finally {
    fs.rmSync(checksumPath, { force: true });
  }

  fs.copyFileSync(tempBinary, targetBinary);
  if (platform !== 'win32') {
    try {
      fs.chmodSync(targetBinary, 0o755);
    } catch {}
  }
  writeJson(path.join(runtimeDir, 'managed-resources', 'officecli', 'manifest.json'), {
    platform,
    arch,
    version: tag,
    asset: assetName,
    source: sourceUrl,
    executable: normalize(path.relative(runtimeDir, targetBinary)),
    generatedAt: new Date().toISOString(),
  });

  const manifestPath = path.join(runtimeDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  if (manifest && typeof manifest === 'object') {
    const verification = assertGcapcoreResources({
      resourcesDir: path.join(projectRoot, 'resources'),
      electronPlatformName: platform,
      targetArch: arch,
    });
    writeJson(manifestPath, {
      ...manifest,
      generatedAt: new Date().toISOString(),
      managedResources: summarizeManagedResources(runtimeDir, platform, getRuntimeKey(platform, arch)),
      verified: {
        checked: verification.checked,
        missing: verification.missing,
      },
    });
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
  return targetBinary;
}

module.exports = {
  REQUIRED_ACP_TOOLS,
  assertGcapcoreResources,
  binaryName,
  getGcapcoreRuntimeDir,
  getOfficecliBinDir,
  getRuntimeKey,
  importGcapcoreResourcesFromUpstream,
  prepareOfficecliResource,
  verifyGcapcoreResources,
};
