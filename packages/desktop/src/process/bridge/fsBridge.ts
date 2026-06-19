/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import { readDirectoryRecursive } from '@process/utils/utils';

type GetFilesByDirParams = {
  dir: string;
  root: string;
  search?: string;
};

export function initFileSystemBridge(): void {
  ipcBridge.fs.getFilesByDir.provider(async (params: GetFilesByDirParams): Promise<IDirOrFile[]> => {
    const tree = await readDirectoryRecursive(params.dir, {
      root: params.root,
      maxDepth: params.search ? Infinity : 1,
      search: params.search ? { text: params.search } : undefined,
    });
    return tree ? [tree] : [];
  });
}
