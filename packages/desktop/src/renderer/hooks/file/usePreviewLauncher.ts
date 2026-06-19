/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PreviewContentType } from '@/common/types/office/preview';
import type { PreviewErrorKind } from '@/renderer/utils/previewError';
import { useCallback, useState } from 'react';

/**
 * 预览启动选项 / Preview launch options
 */
interface PreviewLaunchOptions {
  /** 相对工作区路径 / Workspace-relative path */
  relativePath?: string;
  /** 备用路径（如绝对路径）/ Fallback path (absolute or provided path) */
  originalPath?: string;
  /** 文件名 / File name */
  file_name?: string;
  /** 预览标题 / Preview title */
  title?: string;
  /** 代码语言（用于语法高亮）/ Code language (for syntax highlighting) */
  language?: string;
  /** 内容类型 / Content type */
  contentType: PreviewContentType;
  /** 是否可编辑 / Whether editable */
  editable: boolean;
  /** 若无法读取文件，使用此内容打开（可编辑）/ Use this content if file read fails (editable) */
  fallbackContent?: string;
  /** 只读 diff 内容回退 / Read-only diff fallback */
  diffContent?: string;
}

/**
 * Preview launcher hook (deprecated - functionality has been removed with PreviewPanel)
 * Kept as a no-op stub for backward compatibility
 *
 * @returns {{ launchPreview: Function, loading: boolean }}
 */
export const usePreviewLauncher = () => {
  const [loading] = useState(false);
  const [errorKind] = useState<PreviewErrorKind | null>(null);

  const launchPreview = useCallback(async (_options: PreviewLaunchOptions) => {
    // Preview functionality has been removed
  }, []);

  return { launchPreview, loading, errorKind };
};

export type { PreviewLaunchOptions };
