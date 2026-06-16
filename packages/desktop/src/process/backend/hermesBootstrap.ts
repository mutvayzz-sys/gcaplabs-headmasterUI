/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hermes Bootstrap — spawn and lifecycle for the Hermes Python dashboard.
 *
 * Replaces the `aioncore` lifecycle (BackendLifecycleManager) with a focused
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

import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

export type HermesBootstrapStatus =
  | 'stopped'           // never started
  | 'installing'        // running hermes_bootstrap.py to create the venv
  | 'not-installed'     // bootstrap attempted, failed
  | 'starting'          // dashboard process spawned, waiting for READY
  | 'ready'             // dashboard is up, port + token available
  | 'restarting'        // crashed, will restart
  | 'failed';           // exhausted retries

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

const HERMES_HOME_POSIX = (): string => process.env.HERMES_HOME || join(homedir(), '.hermes');
const HERMES_HOME_WIN32 = (): string => process.env.HERMES_HOME || join(app.getPath('appData'), 'hermes');

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

export class HermesBootstrap {
  private childProcess: ChildProcess | null = null;
  private _port = 0;
  private _status: HermesBootstrapStatus = 'stopped';
  private _sessionToken: string = '';
  private _startupStartedAt = 0;
  private _restartTimestamps: number[] = [];
  private _readyTimer: NodeJS.Timeout | null = null;
  private _lastError: string | null = null;

  constructor(private readonly appMeta: HermesBootstrapAppMeta) {}

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
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Returns absolute path to the hermes console script, or null if not present. */
  private resolveHermesBin(): string | null {
    const bin = PLATFORM_HERMES_BIN(process.platform);
    const candidates =
      process.platform === 'win32'
        ? [
            // Current Hermes Windows installer path.
            join(this.hermesHome, 'bin', bin),
            // Git/source checkout venv path used by Hermes One / desktop dev installs.
            join(this.hermesHome, 'hermes-agent', 'venv', 'Scripts', bin),
            // Older experimental layout.
            join(this.hermesHome, 'venv', 'Scripts', bin),
          ]
        : [
            join(this.hermesHome, 'bin', bin),
            join(this.hermesHome, 'hermes-agent', 'venv', 'bin', bin),
            join(this.hermesHome, 'venv', 'bin', bin),
          ];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  /**
   * Run the Hermes bootstrap installer. Spawns the Python interpreter with
   * `hermes_bootstrap.py` so the venv is created and the console script
   * installed. Resolves with true on success.
   *
   * NOTE: this is a placeholder — the actual installer (clone + venv +
   * pip install) lives in the Python repo. The full implementation will be
   * ported in Task 2.1 (the implementation follows the existing
   * `hermes_bootstrap.py` flow in `headmaster-hermes/hermes-agent/`).
   */
  private async runBootstrapInstaller(): Promise<boolean> {
    this._status = 'installing';
    const home = this.hermesHome;
    const hermesAgentSrc = join(home, 'hermes-agent');
    const bootstrapPy = join(hermesAgentSrc, 'hermes_bootstrap.py');
    if (!existsSync(bootstrapPy)) {
      // The user hasn't cloned the Python repo yet. Surface a clear error.
      this._lastError = `Hermes Python runtime not found at ${hermesAgentSrc}. Run: git clone https://github.com/NousResearch/hermes-agent ${hermesAgentSrc}`;
      console.error('[hermes-bootstrap]', this._lastError);
      return false;
    }
    const py = process.platform === 'win32' ? 'python' : 'python3';
    return new Promise<boolean>((resolve) => {
      const proc = spawn(py, [bootstrapPy, '--home', home], {
        cwd: hermesAgentSrc,
        stdio: 'inherit', // surface installer output to the user
        env: { ...process.env, HERMES_HOME: home },
      });
      proc.on('exit', (code) => {
        if (code === 0) {
          console.log('[hermes-bootstrap] installer succeeded');
          resolve(true);
        } else {
          this._lastError = `Hermes installer exited with code ${code}`;
          console.error('[hermes-bootstrap]', this._lastError);
          resolve(false);
        }
      });
      proc.on('error', (err) => {
        this._lastError = `Hermes installer failed to spawn: ${err.message}`;
        console.error('[hermes-bootstrap]', this._lastError);
        resolve(false);
      });
    });
  }

  private spawnDashboard(hermesBin: string, opts: { maxRestarts: number; restartWindowMs: number; readyTimeoutMs: number }): Promise<HermesBootstrapStartResult> {
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

      const args = ['dashboard', '--no-open', '--port', '0', '--skip-build'];

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
            console.log('[hermes-bootstrap] dashboard served a different session token; adopting it');
            this._sessionToken = servedToken;
          }
        } catch (err) {
          console.warn('[hermes-bootstrap] could not read served dashboard token; using spawn token', err);
        }
        console.log(`[hermes-bootstrap] dashboard ready on port ${port}`);
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
    const now = Date.now();
    this._restartTimestamps = this._restartTimestamps.filter((t) => now - t < 60_000);
    this._restartTimestamps.push(now);
    if (this._restartTimestamps.length > 3) {
      this._status = 'failed';
      this._lastError = `Dashboard crashed ${this._restartTimestamps.length} times in 60s (${reason}). Giving up.`;
      console.error('[hermes-bootstrap]', this._lastError);
      return;
    }
    this._lastError = `Dashboard crashed (${reason}); restarting (${this._restartTimestamps.length}/3)`;
    console.warn('[hermes-bootstrap]', this._lastError);
    // Restart after 1s to avoid tight loops.
    setTimeout(() => {
      this.start().catch((err) => {
        this._lastError = `Restart failed: ${err.message ?? String(err)}`;
        this._status = 'failed';
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
