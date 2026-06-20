import { describe, expect, it } from 'vitest';
import { getRendererManualChunk } from '../../packages/desktop/scripts/rendererChunks';

describe('getRendererManualChunk', () => {
  it('keeps Monaco React bindings in the editor chunk', () => {
    expect(getRendererManualChunk('/repo/node_modules/@monaco-editor/react/dist/index.js')).toBe('vendor-editor');
  });

  it('assigns React itself to the React chunk', () => {
    expect(getRendererManualChunk('/repo/node_modules/.bun/react@19.1.0/node_modules/react/index.js')).toBe(
      'vendor-react'
    );
  });

  it('does not classify unrelated package names containing react as React', () => {
    expect(getRendererManualChunk('/repo/node_modules/some-react-helper/index.js')).toBeUndefined();
  });

  it('handles Windows paths for Arco modules', () => {
    expect(getRendererManualChunk('C:\\repo\\node_modules\\@arco-design\\web-react\\es\\index.js')).toBe(
      'vendor-arco'
    );
  });
});
