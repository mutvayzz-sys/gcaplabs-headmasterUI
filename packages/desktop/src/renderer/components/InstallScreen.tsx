/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

export interface InstallStageProgress {
  stageNum: number;
  totalStages: number;
  stageName: string;
  stageStatus: 'running' | 'ok' | 'skipped' | 'failed';
  log: string;
  error?: string;
}

interface InstallScreenProps {
  onRetry?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  uv: 'Package manager (uv)',
  python: 'Python runtime',
  git: 'Git',
  node: 'Node.js',
  'system-packages': 'System packages',
  repository: 'Hermes repository',
  venv: 'Python virtual environment',
  dependencies: 'Python dependencies',
  'node-deps': 'Node dependencies',
  'config-templates': 'Configuration',
  'platform-sdks': 'Platform SDKs',
  'bootstrap-marker': 'Finalizing',
};

export default function InstallScreen({ onRetry }: InstallScreenProps) {
  const [stages, setStages] = useState<InstallStageProgress[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [failError, setFailError] = useState<string>('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.electronAPI?.onInstallProgress) return;

    const unsubscribe = window.electronAPI.onInstallProgress((raw: unknown) => {
      const progress = raw as InstallStageProgress;

      setStages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.stageName === progress.stageName);
        if (idx >= 0) {
          next[idx] = progress;
        } else {
          next.push(progress);
        }
        return next;
      });

      if (progress.log) {
        setLogLines((prev) => [...prev, progress.log]);
      }

      if (progress.stageStatus === 'failed') {
        setFailed(true);
        setFailError(progress.error ?? `Stage "${progress.stageName}" failed`);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const current = stages.findLast((s) => s.stageStatus === 'running');
  const totalStages = stages[0]?.totalStages ?? 12;
  const doneCount = stages.filter((s) => s.stageStatus === 'ok' || s.stageStatus === 'skipped').length;
  const pct = totalStages > 0 ? Math.round((doneCount / totalStages) * 100) : 0;

  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f]'>
      <div className='flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-white/10 bg-[#1a1a1a] p-8 shadow-2xl'>
        {/* Header */}
        <div className='flex flex-col gap-1'>
          <h1 className='text-xl font-semibold text-white'>
            {failed ? 'Installation failed' : 'Installing Headmaster runtime'}
          </h1>
          <p className='text-sm text-white/50'>
            {failed
              ? 'An error occurred during installation.'
              : `Setting up your local runtime — this only happens once.`}
          </p>
        </div>

        {/* Progress bar */}
        {!failed && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between text-xs text-white/40'>
              <span>{current ? (STAGE_LABELS[current.stageName] ?? current.stageName) : 'Preparing…'}</span>
              <span>{pct}%</span>
            </div>
            <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'>
              <div
                className='h-full rounded-full bg-blue-500 transition-all duration-500'
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stage list */}
        <div className='flex flex-col gap-1.5'>
          {stages.map((s) => (
            <div key={s.stageName} className='flex items-center gap-2.5 text-sm'>
              {s.stageStatus === 'ok' || s.stageStatus === 'skipped' ? (
                <span className='text-green-400'>✓</span>
              ) : s.stageStatus === 'failed' ? (
                <span className='text-red-400'>✗</span>
              ) : (
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent' />
              )}
              <span
                className={
                  s.stageStatus === 'ok' || s.stageStatus === 'skipped'
                    ? 'text-white/40'
                    : s.stageStatus === 'failed'
                      ? 'text-red-400'
                      : 'text-white'
                }
              >
                {STAGE_LABELS[s.stageName] ?? s.stageName}
              </span>
            </div>
          ))}
          {stages.length === 0 && (
            <div className='flex items-center gap-2.5 text-sm'>
              <span className='h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent' />
              <span className='text-white/60'>Downloading installer…</span>
            </div>
          )}
        </div>

        {/* Live log */}
        {logLines.length > 0 && (
          <div
            ref={logRef}
            className='max-h-32 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-white/50'
          >
            {logLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* Error + actions */}
        {failed && (
          <div className='flex flex-col gap-3'>
            <div className='rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300'>
              {failError}
            </div>
            <div className='flex gap-3'>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className='flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500'
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => window.electronAPI?.emit('app:quit', {})}
                className='flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5'
              >
                Quit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
