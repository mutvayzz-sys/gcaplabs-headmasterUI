/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hermes Bootstrap — spawn and lifecycle for the Hermes Python dashboard.
 *
 * Replaces the legacy backend lifecycle (BackendLifecycleManager) with a focused
 * class that:
 *   1. Resolves the Hermes Python venv (`HERMES_HOME/venv/bin/hermes` on
 *      POSIX, `HERMES_HOME/venv/Scripts/hermes.exe` on Windows).
 *   2. Optionally runs the bootstrap installer
 *      (`hermes_bootstrap.py` from the cloned `hermes-agent/`) if the venv
 *      is missing.
 *   3. Generates a per-launch `HERMES_DASHBOARD_SESSION_TOKEN` so the
 *      renderer and the dashboard agree on the same secret without
 *      scraping it from the dashboard's process env.
 *   4. Spawns `hermes dashboard --no-open --port 0 --skip-build` with
 *      `PYTHONUNBUFFERED=1` so stdout is line-flushed.
 *   5. Parses stdout for `HERMES_DASHBOARD_READY port={N}` (printed at
 *      `hermes_cli/web_server.py:11758`) to capture the OS-assigned port.
 *   6. Restarts up to 3× within 60 s on crash, then surfaces a hard error.
 *   7. Stops cleanly on app quit (SIGTERM on POSIX, taskkill on Windows).
 *
 * Recon reference: `headmaster-hermes/RECON.md` §1-6.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

export type HermesBootstrapStatus =
  | 'stopped' // never started
  | 'installing' // running hermes_bootstrap.py to create the venv
  | 'not-installed' // bootstrap attempted, failed
  | 'starting' // dashboard process spawned, waiting for READY
  | 'ready' // dashboard is up, port + token available
  | 'restarting' // crashed, will restart
  | 'failed'; // exhausted retries

export interface HermesBootstrapStartOptions {
  /** If true, run the bootstrap installer if the venv is missing. Default: true. */
  installIfMissing?: boolean;
  /** Maximum restart attempts within `restartWindowMs` before giving up. Default: 3. */
  maxRestarts?: number;
  /** Window for restart counting. Default: 60_000 ms. */
  restartWindowMs?: number;
  /** Time to wait for the dashboard to print READY before declaring it dead. Default: 30_000 ms. */
  readyTimeoutMs?: number;
}

export interface HermesBootstrapStartResult {
  ok: boolean;
  port?: number;
  status: HermesBootstrapStatus;
  error?: string;
}

export interface HermesBootstrapAppMeta {
  version: string;
  isPackaged: boolean;
  resourcesPath: string;
  userDataPath: string;
}

const READY_LINE_REGEX = /HERMES_DASHBOARD_READY\s+port=(\d+)/;
const PLATFORM_HERMES_BIN = (platform: NodeJS.Platform): string => {
  if (platform === 'win32') return 'hermes.exe';
  return 'hermes';
};

const HERMES_HOME_POSIX = (): string => join(homedir(), '.headmaster', 'runtime');
const HERMES_HOME_WIN32 = (): string => {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  return join(localAppData, 'Headmaster', 'runtime');
};

const generateSessionToken = (): string => randomBytes(32).toString('base64url');

const extractServedDashboardToken = (html: string): string | null => {
  const match = /window\.__HERMES_SESSION_TOKEN__\s*=\s*("(?:\\.|[^"\\])*")/.exec(String(html || ''));
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return null;
  }
};

export interface HermesRuntimeSnapshot {
  status: HermesBootstrapStatus;
  port: number;
  sessionToken: string;
}

export interface HermesInstallProgress {
  stageNum: number;
  totalStages: number;
  stageName: string;
  /** 'running' while the stage executes, 'ok'/'skipped'/'failed' when done */
  stageStatus: 'running' | 'ok' | 'skipped' | 'failed';
  /** Accumulated log lines from stderr of the current stage */
  log: string;
  /** Set when the overall install fails */
  error?: string;
}

export class HermesBootstrap {
  private childProcess: ChildProcess | null = null;
  private _port = 0;
  private _status: HermesBootstrapStatus = 'stopped';
  private _sessionToken: string = '';
  private _startupStartedAt = 0;
  private _restartTimestamps: number[] = [];
  private _readyTimer: NodeJS.Timeout | null = null;
  private _lastError: string | null = null;
  private readonly runtimeListeners = new Set<(snapshot: HermesRuntimeSnapshot) => void>();
  private readonly installProgressListeners = new Set<(progress: HermesInstallProgress) => void>();

  constructor(private readonly appMeta: HermesBootstrapAppMeta) {}

  /** Subscribe to port/token/status changes (spawn, crash-restart, stop). */
  onRuntimeChange(listener: (snapshot: HermesRuntimeSnapshot) => void): () => void {
    this.runtimeListeners.add(listener);
    return () => this.runtimeListeners.delete(listener);
  }

  /** Subscribe to stage-by-stage install progress events. */
  onInstallProgress(listener: (progress: HermesInstallProgress) => void): () => void {
    this.installProgressListeners.add(listener);
    return () => this.installProgressListeners.delete(listener);
  }

  private emitInstallProgress(progress: HermesInstallProgress): void {
    for (const listener of this.installProgressListeners) {
      try {
        listener(progress);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private notifyRuntimeChange(): void {
    const snapshot: HermesRuntimeSnapshot = {
      status: this._status,
      port: this._port,
      sessionToken: this._sessionToken,
    };
    for (const listener of this.runtimeListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[hermes-bootstrap] runtime listener failed:', error);
      }
    }
  }

  private childAlive(): boolean {
    return this.childProcess !== null && this.childProcess.exitCode === null && !this.childProcess.killed;
  }

  // ---------------------------------------------------------------------------
  // Public getters — consumed by IPC handlers and renderer hooks.
  // ---------------------------------------------------------------------------

  get port(): number {
    return this._port;
  }

  get status(): HermesBootstrapStatus {
    return this._status;
  }

  get sessionToken(): string {
    return this._sessionToken;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get hermesHome(): string {
    return process.platform === 'win32' ? HERMES_HOME_WIN32() : HERMES_HOME_POSIX();
  }

  /**
   * Check if a local Hermes installation exists without spawning anything.
   * Returns true if the hermes binary can be resolved from HERMES_HOME.
   */
  isInstalled(): boolean {
    return this.resolveHermesBin() !== null;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Spawn the Hermes dashboard. Resolves once the dashboard prints its
   * `HERMES_DASHBOARD_READY port={N}` banner (or rejects on error / timeout).
   */
  async start(options: HermesBootstrapStartOptions = {}): Promise<HermesBootstrapStartResult> {
    if (this._status === 'starting' || this._status === 'ready') {
      return { ok: true, port: this._port, status: this._status };
    }

    const { installIfMissing = true, maxRestarts = 3, restartWindowMs = 60_000, readyTimeoutMs = 30_000 } = options;

    this._sessionToken = generateSessionToken();
    this._status = 'starting';
    this._startupStartedAt = Date.now();
    this._lastError = null;
    this.notifyRuntimeChange();

    // 1. Resolve the venv hermes binary.
    const hermesBin = this.resolveHermesBin();
    if (!hermesBin) {
      if (installIfMissing) {
        const installed = await this.runBootstrapInstaller();
        if (!installed) {
          this._status = 'not-installed';
          this._lastError = 'Hermes Python venv could not be created at ' + this.hermesHome;
          return { ok: false, status: 'not-installed', error: this._lastError };
        }
      } else {
        this._status = 'not-installed';
        this._lastError = 'Hermes Python venv not found at ' + this.hermesHome;
        return { ok: false, status: 'not-installed', error: this._lastError };
      }
    }

    const finalBin = hermesBin ?? this.resolveHermesBin();
    if (!finalBin) {
      this._status = 'not-installed';
      this._lastError = 'Hermes Python venv still not found after bootstrap';
      return { ok: false, status: 'not-installed', error: this._lastError };
    }

    // 2. Spawn the dashboard.
    return this.spawnDashboard(finalBin, { maxRestarts, restartWindowMs, readyTimeoutMs });
  }

  /** Kill the dashboard child process. Idempotent. */
  stop(): void {
    this.clearReadyTimer();
    if (!this.childProcess) return;
    const proc = this.childProcess;
    this.childProcess = null;
    try {
      if (process.platform === 'win32') {
        // Windows: child_process.kill() doesn't reliably kill grandchildren
        // (the Python interpreter + uvicorn). Use taskkill /T to take the tree.
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (err) {
      // Best effort.
      console.error('[hermes-bootstrap] stop failed:', err);
    }
    this._status = 'stopped';
    this._port = 0;
    this.notifyRuntimeChange();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Returns absolute path to the hermes console script, or null if not present. */
  private resolveHermesBin(): string | null {
    const bin = PLATFORM_HERMES_BIN(process.platform);
    // Only check the Headmaster-isolated venv. install.ps1 creates 'venv' (not '.venv'),
    // but we check both variants to be safe against future installer changes.
    const candidates =
      process.platform === 'win32'
        ? [
            join(this.hermesHome, 'hermes-agent', 'venv', 'Scripts', bin),
            join(this.hermesHome, 'hermes-agent', '.venv', 'Scripts', bin),
          ]
        : [
            join(this.hermesHome, 'hermes-agent', 'venv', 'bin', bin),
            join(this.hermesHome, 'hermes-agent', '.venv', 'bin', bin),
          ];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  /**
   * Download install.ps1 from the official Hermes repo and run individual
   * stages with -HermesHome and -InstallDir pointing at the Headmaster-
   * isolated directory. The 'path' stage is NEVER run — hermes must not
   * appear on the user's PATH. 'configure', 'gateway', and 'desktop' are
   * also skipped (interactive / not needed for desktop embedding).
   */
  private async runBootstrapInstaller(): Promise<boolean> {
    this._status = 'installing';
    const home = this.hermesHome;
    const installDir = join(home, 'hermes-agent');

    const STAGES_TO_RUN = [
      'uv',
      'python',
      'git',
      'node',
      'system-packages',
      'repository',
      'venv',
      'dependencies',
      'node-deps',
      'config-templates',
      'platform-sdks',
      'bootstrap-marker',
    ];

    const installPs1Url = 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1';
    const installPs1Path = join(home, 'install.ps1');

    try {
      mkdirSync(home, { recursive: true });

      const response = await fetch(installPs1Url);
      if (!response.ok) {
        this._lastError = `Failed to download install.ps1: ${response.status} ${response.statusText}`;
        console.error('[hermes-bootstrap]', this._lastError);
        return false;
      }
      writeFileSync(installPs1Path, await response.text(), 'utf-8');

      console.log('[hermes-bootstrap] running install.ps1 stages...');
      console.log(`[hermes-bootstrap] HermesHome=${home}`);
      console.log(`[hermes-bootstrap] InstallDir=${installDir}`);
      console.log(`[hermes-bootstrap] Stages: ${STAGES_TO_RUN.join(', ')}`);
      console.log('[hermes-bootstrap] SKIPPING: path, configure, gateway, desktop');
    } catch (err) {
      this._lastError = `Failed to prepare installer: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[hermes-bootstrap]', this._lastError);
      return false;
    }

    const totalStages = STAGES_TO_RUN.length;
    for (let i = 0; i < STAGES_TO_RUN.length; i++) {
      const stageName = STAGES_TO_RUN[i];
      const stageNum = i + 1;
      console.log(`[hermes-bootstrap] stage: ${stageName}`);

      this.emitInstallProgress({ stageNum, totalStages, stageName, stageStatus: 'running', log: '' });

      const stageResult = await this.runInstallStage(installPs1Path, home, installDir, stageName, (logLine) =>
        this.emitInstallProgress({ stageNum, totalStages, stageName, stageStatus: 'running', log: logLine })
      );

      if (!stageResult.ok) {
        this._lastError = `Stage '${stageName}' failed: ${stageResult.reason}`;
        console.error('[hermes-bootstrap]', this._lastError);
        this.emitInstallProgress({
          stageNum,
          totalStages,
          stageName,
          stageStatus: 'failed',
          log: stageResult.reason ?? '',
          error: this._lastError,
        });
        try {
          unlinkSync(installPs1Path);
        } catch {
          /* best effort */
        }
        return false;
      }

      const status = stageResult.skipped ? 'skipped' : 'ok';
      if (stageResult.skipped) {
        console.log(`[hermes-bootstrap] stage '${stageName}' skipped: ${stageResult.reason}`);
      }
      this.emitInstallProgress({ stageNum, totalStages, stageName, stageStatus: status, log: '' });
    }

    try {
      unlinkSync(installPs1Path);
    } catch {
      /* best effort */
    }
    console.log('[hermes-bootstrap] runtime installed successfully');
    return true;
  }

  private runInstallStage(
    installPs1Path: string,
    home: string,
    installDir: string,
    stageName: string,
    onLog?: (line: string) => void
  ): Promise<{ ok: boolean; skipped: boolean; reason: string | null }> {
    return new Promise((resolve) => {
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-NoProfile',
        '-File',
        installPs1Path,
        '-HermesHome',
        home,
        '-InstallDir',
        installDir,
        '-NonInteractive',
        '-Json',
        '-Stage',
        stageName,
      ];

      let stdout = '';
      let stderr = '';
      const proc = spawn('powershell.exe', args, {
        cwd: home,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HERMES_HOME: home,
          // Force uv installer to place the binary inside our isolated dir,
          // not the user's ~/.local/bin. Passed explicitly so the nested
          // sub-PowerShell spawned by Install-Uv also inherits it.
          UV_INSTALL_DIR: join(home, 'bin'),
        },
        windowsHide: true,
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stdout += text;
        // Forward non-JSON stdout lines to the progress listener so the renderer
        // can show live output (the JSON result line comes last, skip it)
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('{')) {
            console.log(`[hermes-bootstrap:${stageName}] ${trimmed}`);
            onLog?.(trimmed);
          }
        }
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8').trim();
        if (text) {
          stderr += text + '\n';
          console.log(`[hermes-bootstrap:${stageName}] ${text}`);
          onLog?.(text);
        }
      });

      proc.on('exit', (code) => {
        if (stderr.trim()) {
          console.error(`[hermes-bootstrap:${stageName}] stderr: ${stderr.trim()}`);
        }
        try {
          const result = JSON.parse(stdout.trim()) as { ok?: boolean; skipped?: boolean; reason?: string };
          resolve({
            ok: Boolean(result.ok),
            skipped: Boolean(result.skipped),
            reason: result.reason ?? null,
          });
        } catch {
          resolve({ ok: code === 0, skipped: false, reason: code !== 0 ? `exit code ${code}` : null });
        }
      });

      proc.on('error', (err) => {
        resolve({ ok: false, skipped: false, reason: `spawn error: ${err.message}` });
      });
    });
  }

  private spawnDashboard(
    hermesBin: string,
    opts: { maxRestarts: number; restartWindowMs: number; readyTimeoutMs: number }
  ): Promise<HermesBootstrapStartResult> {
    return new Promise<HermesBootstrapStartResult>((resolve) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        HERMES_HOME: this.hermesHome,
        HERMES_DASHBOARD: '1',
        HERMES_DASHBOARD_SESSION_TOKEN: this._sessionToken,
        // PYTHONUNBUFFERED=1 makes stdout line-flushed so the READY banner
        // arrives at the parent in real time (not buffered until the buffer
        // fills, which can hang the readiness detection indefinitely).
        PYTHONUNBUFFERED: '1',
        // Preserve PATH so Python can find its bundled tools.
        PATH: [
          process.env.PATH,
          join(this.hermesHome, 'bin'),
          join(this.hermesHome, 'hermes-agent', 'venv', process.platform === 'win32' ? 'Scripts' : 'bin'),
          join(this.hermesHome, 'venv', process.platform === 'win32' ? 'Scripts' : 'bin'),
        ]
          .filter(Boolean)
          .join(delimiter),
      };

      // Only pass --skip-build when web_dist already exists; otherwise let
      // Hermes build it automatically on first run to avoid an immediate exit.
      const webDistPath = join(this.hermesHome, 'hermes-agent', 'web_dist');
      const args = ['dashboard', '--no-open', '--port', '0'];
      if (existsSync(webDistPath)) {
        args.push('--skip-build');
      } else {
        console.log(`[hermes-bootstrap] web_dist not found at ${webDistPath}; letting Hermes build on first run`);
      }

      console.log(`[hermes-bootstrap] spawning: ${hermesBin} ${args.join(' ')}`);
      console.log(`[hermes-bootstrap] HERMES_HOME=${this.hermesHome}`);
      console.log(`[hermes-bootstrap] session token: ${this._sessionToken.slice(0, 8)}…`);

      const child = spawn(hermesBin, args, {
        cwd: this.hermesHome,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        // Detached false on purpose — we want the child to die when the
        // parent dies, and we want taskkill /T to find it on Windows.
        detached: false,
        windowsHide: true,
      });

      this.childProcess = child;
      this._status = 'starting';
      let stdoutTail = '';
      let stderrTail = '';
      const TAIL_MAX = 4096;

      const handleReady = async (port: number) => {
        this._port = port;
        this._status = 'ready';
        this.clearReadyTimer();
        this._restartTimestamps = []; // reset on successful start
        try {
          // Match upstream Hermes Desktop behavior: the spawned token is the
          // intended value, but the served dashboard HTML is source of truth.
          // If they drift, REST readiness can pass while /api/ws rejects the
          // renderer. Adopt the served token when present.
          const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
          const html = await res.text();
          const servedToken = extractServedDashboardToken(html);
          if (servedToken && servedToken !== this._sessionToken) {
            if (!this.childAlive()) {
              throw new Error(
                'Dashboard served a different session token after the child exited; refusing foreign backend token'
              );
            }
            console.log('[hermes-bootstrap] dashboard served a different session token; adopting it');
            this._sessionToken = servedToken;
          }
        } catch (err) {
          console.warn('[hermes-bootstrap] could not read served dashboard token; using spawn token', err);
        }
        console.log(`[hermes-bootstrap] dashboard ready on port ${port}`);
        this.notifyRuntimeChange();
        resolve({ ok: true, port, status: 'ready' });
      };

      this._readyTimer = setTimeout(() => {
        if (this._status !== 'ready') {
          this._lastError = `Dashboard did not print HERMES_DASHBOARD_READY within ${opts.readyTimeoutMs}ms. stdout tail: ${stdoutTail.slice(-500)} | stderr tail: ${stderrTail.slice(-500)}`;
          console.error('[hermes-bootstrap]', this._lastError);
          this._status = 'failed';
          this.handleCrash('startup_timeout');
          // Don't reject — let the restart logic handle it
        }
      }, opts.readyTimeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stdoutTail = (stdoutTail + text).slice(-TAIL_MAX);
        process.stdout.write(`[hermes] ${text}`);
        const match = text.match(READY_LINE_REGEX);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!Number.isNaN(port)) void handleReady(port);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stderrTail = (stderrTail + text).slice(-TAIL_MAX);
        process.stderr.write(`[hermes:err] ${text}`);
      });

      child.on('error', (err) => {
        this._lastError = `Dashboard spawn error: ${err.message}`;
        console.error('[hermes-bootstrap]', this._lastError);
        this._status = 'failed';
        this.clearReadyTimer();
        // Resolve only if we haven't already (e.g. timeout didn't fire).
        resolve({ ok: false, status: 'failed', error: this._lastError });
      });

      child.on('exit', (code, signal) => {
        console.log(`[hermes-bootstrap] dashboard exited code=${code} signal=${signal}`);
        this.clearReadyTimer();
        if (this._status === 'ready') {
          // Was running, now gone. Restart policy kicks in.
          this.handleCrash(`exit code=${code} signal=${signal}`);
        }
      });
    });
  }

  private handleCrash(reason: string): void {
    this._status = 'restarting';
    this._port = 0;
    this.notifyRuntimeChange();
    const now = Date.now();
    this._restartTimestamps = this._restartTimestamps.filter((t) => now - t < 60_000);
    this._restartTimestamps.push(now);
    if (this._restartTimestamps.length > 3) {
      this._status = 'failed';
      this._lastError = `Dashboard crashed ${this._restartTimestamps.length} times in 60s (${reason}). Giving up.`;
      console.error('[hermes-bootstrap]', this._lastError);
      this.notifyRuntimeChange();
      return;
    }
    this._lastError = `Dashboard crashed (${reason}); restarting (${this._restartTimestamps.length}/3)`;
    console.warn('[hermes-bootstrap]', this._lastError);
    // Restart after 1s to avoid tight loops.
    setTimeout(() => {
      this.start().catch((err) => {
        this._lastError = `Restart failed: ${err.message ?? String(err)}`;
        this._status = 'failed';
        this.notifyRuntimeChange();
      });
    }, 1_000);
  }

  private clearReadyTimer(): void {
    if (this._readyTimer) {
      clearTimeout(this._readyTimer);
      this._readyTimer = null;
    }
  }
}

export default HermesBootstrap;
