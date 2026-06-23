import React, { useEffect, useState } from 'react';
import { Spin } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

interface RuntimeDetectionProps {
  onRuntimeSelected: (mode: 'detected' | 'skip' | 'quit') => void;
}

export const RuntimeDetectionModal: React.FC<RuntimeDetectionProps> = ({ onRuntimeSelected }) => {
  const { t } = useTranslation();
  const [runtimeStatus, setRuntimeStatus] = useState<'checking' | 'detected' | 'not-detected'>('checking');
  const [callbackFired, setCallbackFired] = useState(false);

  useEffect(() => {
    const checkRuntime = async () => {
      try {
        // Call the direct IPC handler to check and prompt for runtime
        if (window.electronAPI?.checkHermesRuntime) {
          console.log('[RuntimeDetectionModal] Checking local runtime...');
          const result = await window.electronAPI.checkHermesRuntime();
          console.log('[RuntimeDetectionModal] Result:', result);
          if (result?.detected) {
            setRuntimeStatus('detected');
          } else {
            setRuntimeStatus('not-detected');
          }
        } else {
          // Fallback: assume not detected if method not available
          console.warn('[RuntimeDetectionModal] checkHermesRuntime not available, assuming not detected');
          setRuntimeStatus('not-detected');
        }
      } catch (err) {
        console.error('Failed to detect runtime:', err);
        setRuntimeStatus('not-detected');
      }
    };

    checkRuntime();
  }, []);

  useEffect(() => {
    if (runtimeStatus === 'detected') {
      // Auto-advance after 1 second success flash
      const timer = setTimeout(() => {
        console.log('[RuntimeDetectionModal] Calling onRuntimeSelected(detected)');
        setCallbackFired(true);
        onRuntimeSelected('detected');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [runtimeStatus, onRuntimeSelected]);

  useEffect(() => {
    if (runtimeStatus === 'not-detected' && !callbackFired) {
      // Always unblock the app, even if runtime not detected
      console.log('[RuntimeDetectionModal] Calling onRuntimeSelected(skip) due to not-detected');
      setCallbackFired(true);
      onRuntimeSelected('skip');
    }
  }, [runtimeStatus, callbackFired, onRuntimeSelected]);

  // Fallback: if still checking after 10 seconds, force unblock
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!callbackFired) {
        console.warn('[RuntimeDetectionModal] Timeout: forcing app unblock after 10s');
        setCallbackFired(true);
        onRuntimeSelected('skip');
      }
    }, 10000);
    return () => clearTimeout(fallbackTimer);
  }, [callbackFired, onRuntimeSelected]);

  if (runtimeStatus === 'checking') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Spin />
        <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
          {t('common.runtimeDetection.checking', { defaultValue: 'Checking for runtime…' })}
        </p>
      </div>
    );
  }

  if (runtimeStatus === 'detected') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
          {t('common.runtimeDetection.detected', { defaultValue: 'Runtime detected' })}
        </p>
        <p style={{ color: '#666', fontSize: '14px' }}>
          {t('common.runtimeDetection.loading', { defaultValue: 'Loading application…' })}
        </p>
      </div>
    );
  }

  // Not detected - app unblocks via useEffect callback above
  return null;
};
