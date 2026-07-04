/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  findNewOfficeFiles,
  isOfficeAutoPreviewTriggerMessage,
  useAutoPreviewOfficeFilesEnabled,
} from '@/renderer/hooks/system/useAutoPreviewOfficeFilesEnabled';

describe('useAutoPreviewOfficeFilesEnabled', () => {
  it('keeps office auto-preview inert while conversion backend contract is pending', () => {
    const { result } = renderHook(() => useAutoPreviewOfficeFilesEnabled());
    expect(result.current).toBe(false);
  });

  it('keeps helper behavior for supported trigger message types', () => {
    expect(isOfficeAutoPreviewTriggerMessage({ type: 'tool_call' })).toBe(true);
    expect(isOfficeAutoPreviewTriggerMessage({ type: 'text' })).toBe(false);
    expect(findNewOfficeFiles(['a.docx', 'b.pptx'], new Set(['a.docx']))).toEqual(['b.pptx']);
  });
});
