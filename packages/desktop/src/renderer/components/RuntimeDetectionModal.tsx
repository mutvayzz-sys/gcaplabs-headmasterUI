import React, { useEffect } from 'react';

interface RuntimeDetectionProps {
  onRuntimeSelected: (mode: 'detected' | 'skip' | 'quit') => void;
}

// Runtime detection is now handled by the InstallScreen (which listens to
// install:progress IPC events from hermesBootstrap). This component just
// passes through immediately so the rest of the app can load.
export const RuntimeDetectionModal: React.FC<RuntimeDetectionProps> = ({ onRuntimeSelected }) => {
  useEffect(() => {
    onRuntimeSelected('detected');
  }, [onRuntimeSelected]);

  return null;
};
