/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Streaming speech-to-text WebSocket client for `GET /api/stt/stream`.
 *
 * Wire protocol:
 * - C→S first text frame: `{"type":"start","format":"pcm16","sampleRate":24000,"channels":1,"languageHint"?}`
 * - C→S binary frames: raw little-endian PCM16 chunks
 * - C→S text frame `{"type":"stop"}` when recording ends
 * - S→C text frames: `{"type":"ready"}` → `{"type":"partial"|"final","text"}`*
 *   → `{"type":"done"}` (server closes after), or `{"type":"error","code","msg"}` then close.
 */

import { STREAM_SAMPLE_RATE } from './pcmRecorder';
import { isSttAvailable, isWebUiBrowserMode, resolveBackendHost, resolveBackendPort } from '@/common/adapter/backendUrl';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max time to wait for the WebSocket to open. */
export const CONNECT_TIMEOUT_MS = 5000;
/** Max time to wait for `done`/`error` after the stop frame was sent. */
export const DONE_TIMEOUT_MS = 30000;

// Client-side synthetic error codes (server codes are STT_* from the backend).
export const STT_STREAM_CONNECT_FAILED = 'STT_STREAM_CONNECT_FAILED';
export const STT_STREAM_TIMEOUT = 'STT_STREAM_TIMEOUT';
export const STT_STREAM_INTERRUPTED = 'STT_STREAM_INTERRUPTED';
/**
 * Surfaced when the streaming endpoint cannot exist in the current runtime
 * — no shipped runtime exposes the `/api/stt/stream` WebSocket contract (no
 * STT at all on Agent37 cloud, and local Hermes only exposes
 * `/api/audio/transcribe`). Without this code, the WebSocket would either
 * connect-then-fail (network error) or never open (timeout); both produce a
 * confusing "Connection closed" message. The hook maps this to a localized
 * "not available" string and the failure-memory policy disables the
 * streaming path for the rest of the session.
 */
export const STT_STREAM_UNAVAILABLE = 'STT_STREAM_UNAVAILABLE';

// WebSocket readyState values (mirrors WebSocket.CONNECTING/OPEN without
// depending on the global constructor, so injected mocks work in tests).
const WS_CONNECTING = 0;
const WS_OPEN = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpeechStreamCallbacks = {
  onReady: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onDone: () => void;
  /** Terminal failure. code is an STT_* code (server) or a client-side synthetic code. */
  onError: (code: string, msg: string) => void;
};

export type SpeechStreamHandle = {
  sendChunk: (pcm: Uint8Array) => void;
  /** Send stop frame; onDone/onError follows. */
  stop: () => void;
  /** Tear down immediately without waiting (user cancelled). No callbacks after abort. */
  abort: () => void;
};

/** Minimal structural WebSocket type so tests can inject a mock. */
export type WebSocketLike = {
  readyState: number;
  binaryType: BinaryType;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
};

/** Shape of server text frames (fields validated at runtime). */
type ServerFrame = {
  type?: unknown;
  text?: unknown;
  code?: unknown;
  msg?: unknown;
};

// ---------------------------------------------------------------------------
// URL derivation
// ---------------------------------------------------------------------------

/**
 * Resolve the streaming endpoint URL for the current runtime mode.
 *
 * Mirrors the routing logic in `getBackendBase()` (see
 * `packages/desktop/src/common/adapter/backendUrl.ts`):
 * - WebUI browser: no preload, so no `__backendPort`; use same-origin URLs —
 *   web-host's static-server proxies/upgrades to the backend and session
 *   cookies ride along automatically.
 * - Electron renderer: the preload bridge injects `window.__backendPort`,
 *   and the backend listens on loopback. `resolveBackendPort` returns 0
 *   when the dashboard is not yet up — the WebSocket constructor will throw
 *   a clear error rather than silently connect to a dead AionUi-era port.
 */
export const getSpeechStreamUrl = (): string => {
  if (isWebUiBrowserMode()) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/stt/stream`;
  }
  const port = resolveBackendPort();
  if (port <= 0) {
    throw new Error('Speech stream unavailable: backend port not published');
  }
  return `ws://${resolveBackendHost()}:${port}/api/stt/stream`;
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const defaultCreateSocket = (url: string): WebSocketLike => {
  const socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  return socket;
};

/**
 * Open a streaming transcription session.
 *
 * Chunks passed to `sendChunk` before the server `ready` ack are buffered in
 * order and flushed on `ready`. Exactly one terminal event fires per session:
 * `onDone`, `onError`, or none after `abort()`.
 */
export const startSpeechStream = (options: {
  languageHint?: string;
  callbacks: SpeechStreamCallbacks;
  createSocket?: (url: string) => WebSocketLike;
}): SpeechStreamHandle => {
  const { callbacks } = options;

  // No shipped runtime exposes the streaming STT contract — refuse before any
  // WS work. Single source of truth is `isSttAvailable()` in
  // `packages/desktop/src/common/adapter/backendUrl.ts`. The hook maps this
  // code to a localized "not available" message and the failure-memory policy
  // disables the streaming path for the rest of the session via
  // `rememberStreamUnsupported`.
  if (!isSttAvailable()) {
    queueMicrotask(() =>
      callbacks.onError(STT_STREAM_UNAVAILABLE, 'Speech streaming is not available in the current runtime')
    );
    return { sendChunk: () => {}, stop: () => {}, abort: () => {} };
  }

  let url: string;
  try {
    url = getSpeechStreamUrl();
  } catch (error) {
    // URL derivation failed (e.g. backend port not yet published) — report
    // asynchronously so the caller has its handle before the error callback
    // fires.
    queueMicrotask(() =>
      callbacks.onError(STT_STREAM_CONNECT_FAILED, `Speech stream unavailable: ${(error as Error)?.message ?? String(error)}`)
    );
    return { sendChunk: () => {}, stop: () => {}, abort: () => {} };
  }

  let socket: WebSocketLike;
  try {
    socket = (options.createSocket ?? defaultCreateSocket)(url);
  } catch (error) {
    // Constructor threw (e.g. malformed URL) — report asynchronously so the
    // caller has its handle before the error callback fires.
    queueMicrotask(() =>
      callbacks.onError(STT_STREAM_CONNECT_FAILED, `WebSocket construction failed: ${String(error)}`)
    );
    return { sendChunk: () => {}, stop: () => {}, abort: () => {} };
  }

  let terminal = false;
  let readyReceived = false;
  let stopSent = false;
  let pendingStop = false;
  let warnedUnknownFrame = false;
  /** Chunks queued before socket open / server ready. */
  const pendingChunks: ArrayBuffer[] = [];

  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let doneTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = (): void => {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    if (doneTimer !== null) {
      clearTimeout(doneTimer);
      doneTimer = null;
    }
  };

  /** Enter the terminal state: no callback fires after this returns. */
  const enterTerminal = (): void => {
    terminal = true;
    clearTimers();
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    pendingChunks.length = 0;
  };

  const closeSocket = (): void => {
    if (socket.readyState === WS_CONNECTING || socket.readyState === WS_OPEN) {
      try {
        socket.close();
      } catch {
        // Already closing — nothing to do.
      }
    }
  };

  const failWith = (code: string, msg: string): void => {
    if (terminal) return;
    enterTerminal();
    callbacks.onError(code, msg);
    closeSocket();
  };

  const flushPendingChunks = (): void => {
    while (pendingChunks.length > 0) {
      socket.send(pendingChunks.shift()!);
    }
  };

  /** Flush buffered audio, send the stop frame, and arm the done timeout. */
  const sendStopFrame = (): void => {
    if (stopSent) return;
    stopSent = true;
    flushPendingChunks();
    socket.send(JSON.stringify({ type: 'stop' }));
    doneTimer = setTimeout(
      () => failWith(STT_STREAM_TIMEOUT, `No done/error within ${DONE_TIMEOUT_MS}ms after stop`),
      DONE_TIMEOUT_MS
    );
  };

  const warnUnknownFrame = (raw: string): void => {
    if (warnedUnknownFrame) return;
    warnedUnknownFrame = true;
    console.warn('[SpeechStreamClient] ignoring unrecognized server frame:', raw.slice(0, 200));
  };

  socket.onopen = () => {
    if (terminal) return;
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    const startFrame: Record<string, string | number> = {
      type: 'start',
      format: 'pcm16',
      sampleRate: STREAM_SAMPLE_RATE,
      channels: 1,
    };
    const hint = options.languageHint?.trim();
    if (hint) {
      startFrame.languageHint = hint;
    }
    socket.send(JSON.stringify(startFrame));
    if (pendingStop) {
      pendingStop = false;
      sendStopFrame();
    }
  };

  socket.onmessage = (event) => {
    if (terminal) return;
    const raw: unknown = event.data;
    if (typeof raw !== 'string') return; // Server only speaks text frames.
    let frame: ServerFrame;
    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      warnUnknownFrame(raw);
      return;
    }
    switch (frame.type) {
      case 'ready':
        readyReceived = true;
        flushPendingChunks();
        callbacks.onReady();
        break;
      case 'partial':
        callbacks.onPartial(typeof frame.text === 'string' ? frame.text : '');
        break;
      case 'final':
        callbacks.onFinal(typeof frame.text === 'string' ? frame.text : '');
        break;
      case 'done':
        enterTerminal();
        callbacks.onDone();
        closeSocket();
        break;
      case 'error': {
        const code = typeof frame.code === 'string' && frame.code ? frame.code : STT_STREAM_INTERRUPTED;
        const msg = typeof frame.msg === 'string' ? frame.msg : '';
        enterTerminal();
        callbacks.onError(code, msg);
        closeSocket();
        break;
      }
      default:
        warnUnknownFrame(raw);
    }
  };

  socket.onclose = () => {
    failWith(STT_STREAM_INTERRUPTED, 'Connection closed before transcription finished');
  };

  socket.onerror = () => {
    failWith(STT_STREAM_INTERRUPTED, 'WebSocket error');
  };

  connectTimer = setTimeout(
    () => failWith(STT_STREAM_CONNECT_FAILED, `WebSocket did not open within ${CONNECT_TIMEOUT_MS}ms`),
    CONNECT_TIMEOUT_MS
  );

  const sendChunk = (pcm: Uint8Array): void => {
    if (terminal || stopSent) return;
    // Copy exactly the viewed range — pcm may be a view into a larger buffer.
    const payload = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    if (readyReceived && socket.readyState === WS_OPEN) {
      socket.send(payload);
    } else {
      pendingChunks.push(payload);
    }
  };

  const stop = (): void => {
    if (terminal || stopSent || pendingStop) return;
    if (socket.readyState === WS_OPEN) {
      sendStopFrame();
    } else {
      // Not open yet — the stop frame must follow the start frame, so defer
      // until onopen.
      pendingStop = true;
    }
  };

  const abort = (): void => {
    if (terminal) return;
    enterTerminal();
    closeSocket();
  };

  return { sendChunk, stop, abort };
};
