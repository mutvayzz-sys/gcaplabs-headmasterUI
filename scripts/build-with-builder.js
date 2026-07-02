#!/usr/bin/env node

/**
 * Headmaster desktop build coordinator.
 * Runs electron-vite for app bundles, stages optional packaged resources, then
 * hands off to electron-builder for installer/zip/dmg/deb artifacts.
 *
 * Current architecture:
 * - Primary runtime is the Hermes Python dashboard, installed/started by the app.
 * - Remote mode talks to a provisioned container gateway over /v1 and /api.
 * - GCAPCore sidecar carries local Council, MCP, cron, Office CLI, and preview
 *   compatibility inherited from the upstream core surface. It is bundled by
 *   default for full desktop builds.
 *
 * Features:
 * - Incremental builds: use --skip-vite to reuse existing Vite output
 * - Force rebuild: use --force to ignore the Vite output cache
 * - Bundle only: use --pack-only to skip distributable creation
 * - Thin remote/container-only build: use --skip-gcapcore
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const ELECTRON_VITE_CONFIG = 'packages/desktop/electron.vite.config.ts';
const ELECTRON_BUILDER_CONFIG = 'packages/desktop/electron-builder.yml';
const ELECTRON_BUILDER_CLI = './node_modules/electron-builder/cli.js';
const EXPECTED_PACKAGE_MAIN = './out/main/index.js';
let activeElectronBuilderConfig = ELECTRON_BUILDER_CONFIG;

// DMG retry logic for macOS: detects DMG creation failures by checking artifacts
// (.app exists but .dmg missing) and retries only the DMG step using
// electron-builder --prepackaged with the .app path (not the parent directory).
// This preserves full DMG styling (window size, icon positions, background)
// Background: GitHub Actions macos-14 runners occasionally suffer from transient
// "Device not configured" hdiutil errors (electron-builder#8415, actions/runner-images#12323).
const DMG_RETRY_MAX = 3;
const DMG_RETRY_DELAY_SEC = 30;

// Incremental build: hash of source files to detect changes
const INCREMENTAL_CACHE_FILE = 'out/.build-hash';
const HASH_SKIP_DIRS = new Set([
  'node_modules',
  'out',
  '.git',
  '.venv',
  'coverage',
  'dist',
  'bundled-aioncore',
  'bundled-gcapcore',
]);

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (HASH_SKIP_DIRS.has(entry.name)) continue;
      walkFiles(fullPath, acc);
    } else if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function computeSourceHash() {
  const hash = crypto.createHash('md5');
  const filesToHash = [
    'package.json',
    'package-lock.json',
    'bun.lock',
    'tsconfig.json',
    ELECTRON_VITE_CONFIG,
    ELECTRON_BUILDER_CONFIG,
    'justfile',
  ];

  for (const file of filesToHash) {
    const filePath = path.resolve(ROOT_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      hash.update(file + ':');
      hash.update(content);
    }
  }

  const hashDirs = ['packages', 'public', 'resources', 'scripts'];
  for (const dir of hashDirs) {
    const dirPath = path.resolve(ROOT_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = walkFiles(dirPath)
      .map((file) => path.relative(ROOT_DIR, file).replace(/\\/g, '/'))
      .sort();

    for (const relPath of files) {
      const absolutePath = path.resolve(ROOT_DIR, relPath);
      const stat = fs.statSync(absolutePath);
      hash.update(relPath + ':');
      hash.update(String(stat.size));
      hash.update(String(stat.mtimeMs));
    }
  }

  return hash.digest('hex');
}

function loadCachedHash() {
  try {
    const cacheFile = path.resolve(ROOT_DIR, INCREMENTAL_CACHE_FILE);
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile, 'utf8').trim();
    }
  } catch {}
  return null;
}

function saveCurrentHash(hash) {
  try {
    const cacheFile = path.resolve(ROOT_DIR, INCREMENTAL_CACHE_FILE);
    const viteDir = path.dirname(cacheFile);
    if (!fs.existsSync(viteDir)) {
      fs.mkdirSync(viteDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, hash);
  } catch {}
}

function viteBuildExists() {
  const outDir = path.resolve(ROOT_DIR, 'out');
  const mainDir = path.join(outDir, 'main');
  const rendererDir = path.join(outDir, 'renderer');

  return fs.existsSync(path.join(mainDir, 'index.js')) && fs.existsSync(path.join(rendererDir, 'index.html'));
}

function shouldSkipViteBuild(skipViteFlag, forceFlag) {
  if (forceFlag) return false;
  if (skipViteFlag) return true;

  // Auto-detect: skip if build exists and hash matches
  const currentHash = computeSourceHash();
  const cachedHash = loadCachedHash();

  if (cachedHash && currentHash === cachedHash && viteBuildExists()) {
    console.log('📦 Incremental build: Vite output unchanged, skipping compilation');
    return true;
  }

  return false;
}

function cleanupDiskImages() {
  try {
    // Detach all mounted disk images that may block subsequent DMG creation:
    // hdiutil info → grep device paths → force detach each
    const result = spawnSync(
      'sh',
      [
        '-c',
        "hdiutil info 2>/dev/null | grep /dev/disk | awk '{print $1}' | xargs -I {} hdiutil detach {} -force 2>/dev/null",
      ],
      { stdio: 'ignore' }
    );
    if (result.status !== 0) {
      console.log(`   ℹ️  Disk image cleanup exit code: ${result.status}`);
    }
    return result.status === 0;
  } catch (error) {
    console.log(`   ℹ️  Disk image cleanup failed: ${error.message}`);
    return false;
  }
}

// Find the .app directory from electron-builder output
function findAppDir(outDir) {
  const candidates = ['mac', 'mac-arm64', 'mac-x64', 'mac-universal'];
  for (const dir of candidates) {
    const fullPath = path.join(outDir, dir);
    if (fs.existsSync(fullPath)) {
      const hasApp = fs.readdirSync(fullPath).some((f) => f.endsWith('.app'));
      if (hasApp) return fullPath;
    }
  }
  return null;
}

// Check if DMG exists in output directory
function dmgExists(outDir) {
  try {
    return fs.readdirSync(outDir).some((f) => f.endsWith('.dmg'));
  } catch {
    return false;
  }
}

function tryRemoveDir(targetDir) {
  if (!fs.existsSync(targetDir)) return true;
  try {
    fs.rmSync(targetDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 300,
    });
    return true;
  } catch (error) {
    console.log(`❌ Failed to remove ${targetDir}: ${error.message}`);
    return false;
  }
}

function isProcessRunningWindows(imageName) {
  if (process.platform !== 'win32') return false;
  try {
    const result = execSync(`tasklist /FI "IMAGENAME eq ${imageName}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.toString().toLowerCase().includes(imageName.toLowerCase());
  } catch {
    return false;
  }
}

function killWindowsProcesses(imageNames) {
  if (process.platform !== 'win32') return;
  for (const name of imageNames) {
    try {
      execSync(`taskkill /F /IM ${name}`, { stdio: 'ignore' });
    } catch {}
  }
}

function formatExecError(error) {
  return [error?.message, error?.stdout?.toString?.(), error?.stderr?.toString?.()].filter(Boolean).join('\n').trim();
}

// Create DMG using electron-builder --prepackaged with .app path
// This preserves DMG styling from electron-builder.yml (window size, icon positions, background)
function createDmgWithPrepackaged(appDir, targetArch) {
  const appName = fs.readdirSync(appDir).find((f) => f.endsWith('.app'));
  if (!appName) throw new Error(`No .app found in ${appDir}`);
  const appPath = path.join(appDir, appName);

  execSync(
    `node ${ELECTRON_BUILDER_CLI} --config ${activeElectronBuilderConfig} --mac dmg --${targetArch} --prepackaged "${appPath}" --publish=never`,
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );
}

function buildWithDmgRetry(cmd, targetArch) {
  const isMac = process.platform === 'darwin';
  const outDir = path.resolve(ROOT_DIR, 'out');

  try {
    execSync(cmd, { stdio: 'inherit', shell: process.platform === 'win32' });
    return;
  } catch (error) {
    // On non-macOS or if .app doesn't exist, just throw
    const appDir = isMac ? findAppDir(outDir) : null;
    if (!appDir || dmgExists(outDir)) throw error;

    // .app exists but no .dmg → DMG creation failed
    console.log('\n🔄 Build failed during DMG creation (.app exists, .dmg missing)');
    console.log('   Retrying DMG creation with --prepackaged...');

    for (let attempt = 1; attempt <= DMG_RETRY_MAX; attempt++) {
      cleanupDiskImages();
      spawnSync('sleep', [String(DMG_RETRY_DELAY_SEC)]);

      try {
        console.log(`\n📀 DMG retry attempt ${attempt}/${DMG_RETRY_MAX}...`);
        createDmgWithPrepackaged(appDir, targetArch);
        console.log('✅ DMG created successfully on retry');
        return;
      } catch (retryError) {
        console.log(`   ⚠️  DMG retry ${attempt}/${DMG_RETRY_MAX} failed`);
        cleanupDiskImages();
        if (attempt === DMG_RETRY_MAX) {
          console.log(`   ❌ DMG creation failed after ${DMG_RETRY_MAX} retries`);
          throw retryError;
        }
      }
    }
  }
}

// Clean stale Windows packaging outputs from previous runs
function cleanupWindowsPackOutput() {
  const outDir = path.resolve(ROOT_DIR, 'out');
  if (!fs.existsSync(outDir)) return;

  const removed = [];
  const winUnpackedDirRe = /^win(?:-[a-z0-9]+)?-unpacked$/i;
  const winArtifactFileRe = /-win-[^.]+\.(?:exe|msi|zip|7z)$/i;

  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    const fullPath = path.join(outDir, entry.name);

    if (entry.isDirectory() && winUnpackedDirRe.test(entry.name)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        removed.push(entry.name);
      } catch (error) {
        console.log(`⚠️  Could not clean ${entry.name}: ${error.message}`);
      }
      continue;
    }

    if (entry.isFile() && winArtifactFileRe.test(entry.name)) {
      try {
        fs.rmSync(fullPath, { force: true });
        removed.push(entry.name);
      } catch (error) {
        console.log(`⚠️  Could not clean ${entry.name}: ${error.message}`);
      }
    }
  }

  if (removed.length > 0) {
    console.log(`🧹 Cleaned stale Windows outputs: ${removed.join(', ')}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const archList = ['x64', 'arm64', 'ia32', 'armv7l'];

// Check for special flags
const skipVite = args.includes('--skip-vite');
const skipNative = args.includes('--skip-native');
const packOnly = args.includes('--pack-only');
const forceBuild = args.includes('--force');
const withGcapcore = args.includes('--with-gcapcore') || args.includes('--with-council-sidecar');
const skipGcapcore = args.includes('--skip-gcapcore') || args.includes('--skip-council-sidecar');

const builderArgs = args
  .filter((arg) => {
    // Filter out 'auto', architecture flags, and special flags
    if (arg === 'auto') return false;
    if (
      arg === '--skip-vite' ||
      arg === '--skip-native' ||
      arg === '--pack-only' ||
      arg === '--force' ||
      arg === '--with-gcapcore' ||
      arg === '--skip-gcapcore' ||
      arg === '--with-council-sidecar' ||
      arg === '--skip-council-sidecar'
    ) {
      return false;
    }
    if (archList.includes(arg)) return false;
    if (arg.startsWith('--') && archList.includes(arg.slice(2))) return false;
    return true;
  })
  .join(' ');

// Get target architecture from electron-builder.yml
function getTargetArchFromConfig(platform) {
  try {
    const configPath = path.resolve(ROOT_DIR, ELECTRON_BUILDER_CONFIG);
    const content = fs.readFileSync(configPath, 'utf8');

    const platformRegex = new RegExp(`^${platform}:\\s*$`, 'm');
    const platformMatch = content.match(platformRegex);
    if (!platformMatch) return null;

    const platformStartIndex = platformMatch.index;
    const afterPlatform = content.slice(platformStartIndex + platformMatch[0].length);
    const nextPlatformMatch = afterPlatform.match(/^[a-zA-Z][a-zA-Z0-9]*:/m);
    const platformBlock = nextPlatformMatch
      ? content.slice(platformStartIndex, platformStartIndex + platformMatch[0].length + nextPlatformMatch.index)
      : content.slice(platformStartIndex);

    const archMatch = platformBlock.match(/arch:\s*\[\s*([a-z0-9_]+)/i);
    return archMatch ? archMatch[1].trim() : null;
  } catch (error) {
    return null;
  }
}

// Determine target architecture
const buildMachineArch = process.arch;
let targetArch;
let multiArch = false;

// Check if multiple architectures are specified (support both --x64 and x64 formats)
const rawArchArgs = args
  .filter((arg) => {
    if (archList.includes(arg)) return true;
    if (arg.startsWith('--') && archList.includes(arg.slice(2))) return true;
    return false;
  })
  .map((arg) => (arg.startsWith('--') ? arg.slice(2) : arg));

// Remove duplicates to avoid treating "x64 --x64" as multiple architectures
const archArgs = [...new Set(rawArchArgs)];

if (archArgs.length > 1) {
  // Multiple unique architectures specified - let electron-builder handle it
  multiArch = true;
  targetArch = archArgs[0]; // Use first arch for Vite build-time env
  console.log(`🔨 Multi-architecture build detected: ${archArgs.join(', ')}`);
} else if (args[0] === 'auto') {
  if (archArgs.length === 1) {
    targetArch = archArgs[0];
  } else {
    // Auto mode: detect from electron-builder.yml
    let detectedPlatform = null;
    if (builderArgs.includes('--linux')) detectedPlatform = 'linux';
    else if (builderArgs.includes('--mac')) detectedPlatform = 'mac';
    else if (builderArgs.includes('--win')) detectedPlatform = 'win';

    const configArch = detectedPlatform ? getTargetArchFromConfig(detectedPlatform) : null;
    targetArch = configArch || buildMachineArch;
  }
} else {
  // Explicit architecture or default to build machine
  targetArch = archArgs[0] || buildMachineArch;
}

console.log(`🔨 Building for architecture: ${targetArch}`);
console.log(`📋 Builder arguments: ${builderArgs || '(none)'}`);
if (skipVite) console.log('⚡ --skip-vite: Will skip Vite compilation if output exists');
if (skipNative) {
  console.log('⚡ --skip-native accepted for compatibility; native rebuilds are already disabled in builder config');
}
if (packOnly) console.log('⚡ --pack-only: Will skip electron-builder distributable creation');
if (forceBuild) console.log('⚡ --force: Force full rebuild');
if (withGcapcore) console.log('⚡ --with-gcapcore: Will force-refresh bundled GCAPCore resources');
if (skipGcapcore) console.log('⚡ --skip-gcapcore: Will exclude bundled GCAPCore resources');

function validatePackageMain() {
  const packageJsonPath = path.resolve(ROOT_DIR, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.main !== EXPECTED_PACKAGE_MAIN) {
    throw new Error(
      `package.json main must be ${EXPECTED_PACKAGE_MAIN} for electron-builder; found ${packageJson.main || '(missing)'}`
    );
  }
}

function shouldPrepareGcapcore() {
  if (skipGcapcore) return false;
  if (withGcapcore) return true;
  if (process.env.HEADMASTER_REFRESH_GCAPCORE === '1') return true;
  if (process.env.HEADMASTER_INCLUDE_COUNCIL_SIDECAR === '1') return true;
  if (!gcapcoreVersionMatches(targetArch)) return true;
  if (!gcapcoreResourcesComplete(targetArch)) return true;
  return !gcapcoreExists(targetArch);
}

function shouldPackageGcapcore() {
  return !skipGcapcore;
}

function prepareGcapcore(targetArch) {
  const { prepareAioncore: prepareSidecarRuntime } = require('../packages/shared-scripts/src/prepare-aioncore.js');
  const { resolveGcapcoreVersion } = require('./resolveGcapcoreVersion.js');
  if (
    !upstreamCoreExists(targetArch) ||
    !upstreamCoreVersionMatches(targetArch) ||
    withGcapcore ||
    process.env.HEADMASTER_REFRESH_GCAPCORE === '1'
  ) {
    prepareSidecarRuntime({
      projectRoot: ROOT_DIR,
      platform: process.platform,
      arch: targetArch,
      version:
        process.env.HEADMASTER_GCAPCORE_VERSION ||
        process.env.HEADMASTER_COUNCIL_SIDECAR_VERSION ||
        process.env.HEADMASTER_CORE_VERSION ||
        resolveGcapcoreVersion(ROOT_DIR),
    });
  }
  materializeGcapcoreFromUpstream(targetArch, { force: true });
  const { prepareOfficecliResource } = require('../packages/shared-scripts/src/gcapcore-resources.js');
  prepareOfficecliResource({
    projectRoot: ROOT_DIR,
    platform: process.platform,
    arch: targetArch,
    version: process.env.HEADMASTER_OFFICECLI_VERSION || 'latest',
  });
}

function getGcapcoreRuntimeKey(targetArch) {
  return `${process.platform}-${targetArch}`;
}

function getGcapcoreBinaryName() {
  return process.platform === 'win32' ? 'gcapcore.exe' : 'gcapcore';
}

function getUpstreamCoreBinaryName() {
  return process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
}

function getGcapcoreRuntimeDir(targetArch) {
  const { getGcapcoreRuntimeDir: resolveRuntimeDir } = require('../packages/shared-scripts/src/gcapcore-resources.js');
  return resolveRuntimeDir(ROOT_DIR, process.platform, targetArch);
}

function getUpstreamCoreRuntimeDir(targetArch) {
  return path.join(ROOT_DIR, 'resources', 'bundled-aioncore', getGcapcoreRuntimeKey(targetArch));
}

function gcapcoreExists(targetArch) {
  const runtimeDir = getGcapcoreRuntimeDir(targetArch);
  return fs.existsSync(path.join(runtimeDir, getGcapcoreBinaryName()));
}

function upstreamCoreExists(targetArch) {
  const runtimeDir = getUpstreamCoreRuntimeDir(targetArch);
  return fs.existsSync(path.join(runtimeDir, getUpstreamCoreBinaryName()));
}

function expectedGcapcoreVersion() {
  const { resolveGcapcoreVersion } = require('./resolveGcapcoreVersion.js');
  return (
    process.env.HEADMASTER_GCAPCORE_VERSION ||
    process.env.HEADMASTER_COUNCIL_SIDECAR_VERSION ||
    process.env.HEADMASTER_CORE_VERSION ||
    resolveGcapcoreVersion(ROOT_DIR)
  ).trim();
}

function versionsMatch(actual, expected) {
  return actual === expected || actual === (expected.startsWith('v') ? expected.slice(1) : `v${expected}`);
}

function upstreamCoreVersionMatches(targetArch) {
  if (!upstreamCoreExists(targetArch)) return false;
  try {
    const expected = expectedGcapcoreVersion();
    if (!expected || expected === 'latest') return true;
    const manifestPath = path.join(getUpstreamCoreRuntimeDir(targetArch), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const actual = typeof manifest.version === 'string' ? manifest.version.trim() : '';
    return versionsMatch(actual, expected);
  } catch {
    return false;
  }
}

function gcapcoreResourcesComplete(targetArch) {
  if (!gcapcoreExists(targetArch)) return false;
  try {
    const { assertGcapcoreResources } = require('../packages/shared-scripts/src/gcapcore-resources.js');
    assertGcapcoreResources({
      resourcesDir: path.resolve(ROOT_DIR, 'resources'),
      electronPlatformName: process.platform,
      targetArch,
    });
    return true;
  } catch {
    return false;
  }
}

function gcapcoreVersionMatches(targetArch) {
  if (!gcapcoreExists(targetArch)) return false;
  try {
    const expected = expectedGcapcoreVersion();
    if (!expected || expected === 'latest') return true;

    const manifestPath = path.join(getGcapcoreRuntimeDir(targetArch), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const actual = typeof manifest.version === 'string' ? manifest.version.trim() : '';
    return versionsMatch(actual, expected);
  } catch {
    return false;
  }
}

function materializeGcapcoreFromUpstream(targetArch, options = {}) {
  if (!options.force && gcapcoreExists(targetArch)) return;
  const { importGcapcoreResourcesFromUpstream } = require('../packages/shared-scripts/src/gcapcore-resources.js');
  importGcapcoreResourcesFromUpstream({
    projectRoot: ROOT_DIR,
    platform: process.platform,
    arch: targetArch,
  });
}

function validatePackagedResourceInputs(targetArch) {
  const requiredPaths = ['public', 'resources/app.png'];
  for (const relPath of requiredPaths) {
    if (!fs.existsSync(path.resolve(ROOT_DIR, relPath))) {
      throw new Error(`Missing packaged resource input: ${relPath}`);
    }
  }

  const optionalHubDir = path.resolve(ROOT_DIR, 'resources/hub');
  if (!fs.existsSync(optionalHubDir)) {
    fs.mkdirSync(optionalHubDir, { recursive: true });
  }

  const sidecarRoot = path.resolve(ROOT_DIR, 'resources/bundled-gcapcore');
  if (!fs.existsSync(sidecarRoot)) {
    fs.mkdirSync(sidecarRoot, { recursive: true });
  }

  if (!skipGcapcore && !gcapcoreExists(targetArch)) {
    materializeGcapcoreFromUpstream(targetArch);
  }

  if (!skipGcapcore && !gcapcoreExists(targetArch)) {
    throw new Error(
      `Missing GCAPCore sidecar for ${getGcapcoreRuntimeKey(targetArch)}. Run with --with-gcapcore to prepare it, or --skip-gcapcore for a thin remote-only build.`
    );
  }

  if (!skipGcapcore) {
    const { assertGcapcoreResources } = require('../packages/shared-scripts/src/gcapcore-resources.js');
    assertGcapcoreResources({
      resourcesDir: path.resolve(ROOT_DIR, 'resources'),
      electronPlatformName: process.platform,
      targetArch,
    });
  }
}

function createEffectiveBuilderConfig({ packageGcapcore }) {
  const sourcePath = path.resolve(ROOT_DIR, ELECTRON_BUILDER_CONFIG);
  let content = fs.readFileSync(sourcePath, 'utf8');

  if (!packageGcapcore) {
    content = content.replace(
      /\n\s*# GCAPCore sidecar \(pre-compiled per platform\/arch, ships its own runtime\)\r?\n\s*- from: resources\/bundled-gcapcore\r?\n\s+to: bundled-gcapcore\r?\n/,
      '\n'
    );
  }

  const generatedPath = path.resolve(ROOT_DIR, 'out', 'electron-builder.effective.yml');
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(generatedPath, content);
  return path.relative(ROOT_DIR, generatedPath).replace(/\\/g, '/');
}

try {
  // 1. Validate package metadata instead of rewriting tracked files during a build.
  validatePackageMain();

  // 2. Check if we can skip Vite build (incremental build)
  const skipViteBuild = shouldSkipViteBuild(skipVite, forceBuild);

  if (!skipViteBuild) {
    const outDir = path.resolve(ROOT_DIR, 'out');
    if (!process.env.HEADMASTER_SKIP_OUT_CLEAN && fs.existsSync(outDir)) {
      console.log('🧹 Cleaning out/ before Vite build...');
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    // Run electron-vite to build all bundles (main + preload + renderer)
    console.log(`📦 Building ${targetArch}...`);
    execSync(`bunx electron-vite build --config ${ELECTRON_VITE_CONFIG}`, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ELECTRON_BUILDER_ARCH: targetArch,
      },
    });

    // Save hash after successful build
    saveCurrentHash(computeSourceHash());
  } else {
    console.log('📦 Using cached Vite build output');
  }

  // Re-bundle builtin MCP server as a fully self-contained CJS bundle so it can
  // be executed by an external `node` process (no Electron ASAR support available).
  // electron-vite's externalizeDepsPlugin leaves npm packages as require() calls
  // which the standalone node process cannot resolve from inside app.asar.unpacked.
  // Uses a dedicated script (build-mcp-servers.js) to avoid shell-quoting issues
  // with special characters in esbuild --define values.
  console.log('📦 Bundling builtin MCP servers (self-contained)...');
  execSync(`node "${path.join(__dirname, 'build-mcp-servers.js')}"`, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // 3. Verify electron-vite output
  const outDir = path.resolve(ROOT_DIR, 'out');
  if (!fs.existsSync(outDir)) {
    throw new Error('electron-vite did not generate out/ directory');
  }

  // 4. Validate output structure
  const mainIndex = path.join(outDir, 'main', 'index.js');
  const rendererIndex = path.join(outDir, 'renderer', 'index.html');

  if (!fs.existsSync(mainIndex)) {
    throw new Error('Missing main entry: out/main/index.js');
  }

  if (!fs.existsSync(rendererIndex)) {
    throw new Error('Missing renderer entry: out/renderer/index.html');
  }

  // If --pack-only, skip electron-builder distributable creation
  if (packOnly) {
    console.log('✅ Package completed! (skipped distributable creation)');
    return;
  }

  // 5. Prepare GCAPCore sidecar resources when missing or explicitly refreshed.
  // Council, MCP, cron, Office CLI, and preview compatibility rely on this core
  // surface in full desktop builds.
  const packageGcapcore = shouldPackageGcapcore();
  if (shouldPrepareGcapcore()) {
    console.log('📦 Preparing GCAPCore sidecar resources...');
    prepareGcapcore(targetArch);
  } else {
    console.log('📦 Using staged GCAPCore sidecar resources');
  }

  // 6. Validate packaged resources and prepare optional hub resources
  // (index.json + extension zips for offline fallback).
  validatePackagedResourceInputs(targetArch);
  activeElectronBuilderConfig = createEffectiveBuilderConfig({ packageGcapcore });
  if (!packageGcapcore) {
    console.log('⏭️  Excluding GCAPCore sidecar from packaged resources');
  }

  if (process.env.HEADMASTER_HUB_REQUIRED === '1') {
    execSync('node scripts/prepareHubResources.js', { stdio: 'inherit', env: process.env });
  } else {
    console.log('⏭️  Skipping optional hub resource prepare');
  }

  // Run electron-builder to create distributables (DMG/ZIP/EXE, etc.)
  // Always disable auto-publish to avoid electron-builder's implicit tag-based publishing
  // Publishing is handled by a separate release job in CI
  const publishArg = '--publish=never';

  // Set compression level based on environment
  // 7za -mx accepts numeric values: 0 (store) to 9 (ultra)
  // CI builds use 9 (maximum) for smallest size
  // Local builds use 7 (normal) for 30-50% faster ASAR packing
  const isCI = process.env.CI === 'true';
  if (!process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL) {
    process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = isCI ? '9' : '7';
  }
  console.log(
    `📦 Compression level: ${process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL} (${isCI ? 'CI build' : 'local build'})`
  );

  // Add arch flags based on mode
  let archFlag = '';
  if (multiArch) {
    // Multi-arch mode: pass all arch flags to electron-builder
    archFlag = archArgs.map((arch) => `--${arch}`).join(' ');
    console.log(`🚀 Packaging for multiple architectures: ${archArgs.join(', ')}...`);
  } else {
    // Single arch mode: use the determined target arch
    archFlag = `--${targetArch}`;
    console.log(`🚀 Creating distributables for ${targetArch}...`);
  }

  // Add architecture detection scripts for Windows builds
  // Use .onVerifyInstDir to avoid conflicts with electron-builder
  let nsisInclude = '';
  if (builderArgs.includes('--win') || builderArgs.includes('--all')) {
    if (!multiArch) {
      // Single-arch build: Add architecture-specific detection script
      if (targetArch === 'arm64') {
        const arm64Script = 'resources/windows-installer-arm64.nsh';
        if (fs.existsSync(path.resolve(ROOT_DIR, arm64Script))) {
          nsisInclude += ` --config.nsis.include="${arm64Script}"`;
          console.log(`📋 Including Windows ARM64 architecture check script`);
        }
      } else if (targetArch === 'x64') {
        const x64Script = 'resources/windows-installer-x64.nsh';
        if (fs.existsSync(path.resolve(ROOT_DIR, x64Script))) {
          nsisInclude += ` --config.nsis.include="${x64Script}"`;
          console.log(`📋 Including Windows x64 architecture check script`);
        }
      }
    }
    // Multi-arch builds: Architecture detection not supported yet
  }

  if (process.platform === 'win32' && builderArgs.includes('--win')) {
    const winUnpackedDir = path.join(outDir, 'win-unpacked');
    let cleaned = tryRemoveDir(winUnpackedDir);
    if (!cleaned) {
      const headmasterRunning = isProcessRunningWindows('Headmaster.exe');
      const electronRunning = isProcessRunningWindows('electron.exe');
      if (headmasterRunning || electronRunning) {
        console.log('⚠️  Detected running Headmaster/Electron process. Attempting to close...');
        killWindowsProcesses(['Headmaster.exe', 'electron.exe']);
        cleaned = tryRemoveDir(winUnpackedDir);
        if (!cleaned) {
          console.log('⚠️  Directory still locked. Please close any running Headmaster/Electron processes and retry.');
        }
      }
    }
  }

  const isWindowsBuild = builderArgs.includes('--win') || builderArgs.includes('--all');
  if (isWindowsBuild) {
    cleanupWindowsPackOutput();
  }

  const packOutputDir = process.env.HEADMASTER_PACK_OUTPUT
    ? path.resolve(process.env.HEADMASTER_PACK_OUTPUT)
    : outDir;
  const packOutputOverride = process.env.HEADMASTER_PACK_OUTPUT
    ? ` --config.directories.output="${packOutputDir.replace(/\\/g, '/')}"`
    : '';

  const builderCommand = `node ${ELECTRON_BUILDER_CLI} --config ${activeElectronBuilderConfig} ${builderArgs} ${archFlag} ${nsisInclude} ${publishArg}${packOutputOverride}`;
  try {
    buildWithDmgRetry(builderCommand, targetArch);

    if (process.env.HEADMASTER_PACK_OUTPUT) {
      const packedWinDir = path.join(packOutputDir, 'win-unpacked');
      const targetWinDir = path.join(outDir, 'win-unpacked');
      if (fs.existsSync(packedWinDir) && packedWinDir !== targetWinDir) {
        console.log(`📦 Copying packaged app to ${targetWinDir}...`);
        fs.rmSync(targetWinDir, { recursive: true, force: true });
        fs.cpSync(packedWinDir, targetWinDir, { recursive: true });
      }
    }
  } catch (error) {
    const winExePath = path.join(outDir, 'win-unpacked', 'Headmaster.exe');
    const firstError = formatExecError(error);
    const canRetryWithoutExecutableEdit =
      process.platform === 'win32' && isWindowsBuild && process.env.CI !== 'true' && fs.existsSync(winExePath);

    if (!canRetryWithoutExecutableEdit) {
      throw error;
    }

    console.log('⚠️  Windows local build failed after Headmaster.exe was produced.');
    if (firstError) {
      console.log('   First failure summary:');
      console.log(
        firstError
          .split(/\r?\n/)
          .slice(0, 6)
          .map((line) => `   ${line}`)
          .join('\n')
      );
    }
    console.log('   Retrying local build with win.signAndEditExecutable=false...');
    console.log('   This fallback is intended for transient rcedit / file-lock failures on developer machines.');
    killWindowsProcesses(['Headmaster.exe', 'electron.exe']);
    cleanupWindowsPackOutput();

    try {
      buildWithDmgRetry(`${builderCommand} --config.win.signAndEditExecutable=false`, targetArch);
    } catch (retryError) {
      const retryFailure = formatExecError(retryError);
      throw new Error(
        [
          'Windows local retry with win.signAndEditExecutable=false also failed.',
          'First failure:',
          firstError || String(error),
          'Retry failure:',
          retryFailure || String(retryError),
        ].join('\n')
      );
    }
  }

  console.log('✅ Build completed!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
