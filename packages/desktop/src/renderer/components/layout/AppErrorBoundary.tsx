/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render errors in the page content area so a crash doesn't leave the
 * entire app as an unrecoverable white screen. The sidebar remains functional.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Render error:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '32px',
            gap: '16px',
            color: 'var(--color-text-1)',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-3)', maxWidth: '480px', textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type='button'
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-2)',
                background: 'var(--color-fill-2)',
                color: 'var(--color-text-1)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Try again
            </button>
            <button
              type='button'
              onClick={() => window.location.reload()}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--color-primary-6)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
