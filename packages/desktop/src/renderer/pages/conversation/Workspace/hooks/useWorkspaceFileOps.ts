/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { downloadFileFromPath } from '@/renderer/utils/file/download';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import { emitter } from '@/renderer/utils/emitter';
import { removeWorkspaceEntry, renameWorkspaceEntry } from '@/renderer/utils/file/workspaceFs';
import { useCallback } from 'react';
import type { MessageApi, RenameModalState, DeleteModalState } from '../types';
import type { WorkspaceEventPrefix } from '@/renderer/utils/emitter';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { getPathSeparator, replacePathInList, updateTreeForRename } from '../utils/treeHelpers';

interface UseWorkspaceFileOpsOptions {
  workspace: string;
  eventPrefix: 'aionrs' | 'acp' | 'codex';
  messageApi: MessageApi;
  t: (key: string) => string;

  // Dependencies from useWorkspaceTree
  setFiles: React.Dispatch<React.SetStateAction<IDirOrFile[]>>;
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<string[]>>;
  selectedKeysRef: React.MutableRefObject<string[]>;
  selectedNodeRef: React.MutableRefObject<{ relativePath: string; fullPath: string } | null>;
  ensureNodeSelected: (nodeData: IDirOrFile, options?: { emit?: boolean }) => void;
  refreshWorkspace: () => void;

  // Dependencies from useWorkspaceModals (will be created next)
  renameModal: RenameModalState;
  deleteModal: DeleteModalState;
  renameLoading: boolean;
  setRenameLoading: React.Dispatch<React.SetStateAction<boolean>>;
  closeRenameModal: () => void;
  closeDeleteModal: () => void;
  closeContextMenu: () => void;
  setRenameModal: React.Dispatch<React.SetStateAction<RenameModalState>>;
  setDeleteModal: React.Dispatch<React.SetStateAction<DeleteModalState>>;
}

/**
 * useWorkspaceFileOps - 文件操作逻辑（打开、删除、重命名、预览、添加到聊天）
 * File operations logic (open, delete, rename, preview, add to chat)
 */
export function useWorkspaceFileOps(options: UseWorkspaceFileOpsOptions) {
  const {
    workspace,
    eventPrefix,
    messageApi,
    t,
    setFiles,
    setSelected,
    setExpandedKeys,
    selectedKeysRef,
    selectedNodeRef,
    ensureNodeSelected,
    refreshWorkspace,
    renameModal,
    deleteModal,
    renameLoading,
    setRenameLoading,
    closeRenameModal,
    closeDeleteModal,
    closeContextMenu,
    setRenameModal,
    setDeleteModal,
  } = options;

  /**
   * 打开文件或文件夹（使用系统默认程序）
   * Open file or folder with system default handler
   */
  const handleOpenNode = useCallback(
    async (nodeData: IDirOrFile | null) => {
      if (!nodeData) return;
      try {
        await ipcBridge.shell.openFile.invoke(nodeData.fullPath);
      } catch (error) {
        messageApi.error(t('conversation.workspace.contextMenu.openFailed') || 'Failed to open');
      }
    },
    [messageApi, t]
  );

  /**
   * 在系统文件管理器中定位文件/文件夹
   * Reveal item in system file explorer
   */
  const handleRevealNode = useCallback(
    async (nodeData: IDirOrFile | null) => {
      if (!nodeData) return;
      try {
        await ipcBridge.shell.showItemInFolder.invoke(nodeData.fullPath);
      } catch (error) {
        messageApi.error(t('conversation.workspace.contextMenu.revealFailed') || 'Failed to reveal');
      }
    },
    [messageApi, t]
  );

  /**
   * 显示删除确认弹窗
   * Show delete confirmation modal
   */
  const handleDeleteNode = useCallback(
    (nodeData: IDirOrFile | null, options?: { emit?: boolean }) => {
      if (!nodeData || !nodeData.relativePath) return;
      ensureNodeSelected(nodeData, { emit: Boolean(options?.emit) });
      closeContextMenu();
      setDeleteModal({ visible: true, target: nodeData, loading: false });
    },
    [closeContextMenu, ensureNodeSelected, setDeleteModal]
  );

  /**
   * 确认删除操作
   * Confirm delete operation
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.target) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true }));
      await removeWorkspaceEntry(deleteModal.target.fullPath);

      messageApi.success(t('conversation.workspace.contextMenu.deleteSuccess'));
      setSelected([]);
      selectedKeysRef.current = [];
      selectedNodeRef.current = null;
      emitter.emit(`${eventPrefix}.selected.file`, []);
      closeDeleteModal();
      setTimeout(() => refreshWorkspace(), 200);
    } catch (error) {
      messageApi.error(t('conversation.workspace.contextMenu.deleteFailed'));
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  }, [
    deleteModal.target,
    closeDeleteModal,
    eventPrefix,
    messageApi,
    refreshWorkspace,
    t,
    setSelected,
    selectedKeysRef,
    selectedNodeRef,
    setDeleteModal,
  ]);

  /**
   * 超时包装器
   * Wrap promise with timeout guard
   */
  const waitWithTimeout = useCallback(<T>(promise: Promise<T>, timeoutMs = 8000) => {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error('timeout'));
      }, timeoutMs);

      promise
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timer);
          reject(error);
        });
    });
  }, []);

  /**
   * 确认重命名操作
   * Confirm rename operation
   */
  const handleRenameConfirm = useCallback(async () => {
    const target = renameModal.target;
    if (!target) return;
    if (renameLoading) return;
    const trimmedName = renameModal.value.trim();

    if (!trimmedName) {
      messageApi.warning(t('conversation.workspace.contextMenu.renameEmpty'));
      return;
    }

    if (trimmedName === target.name) {
      closeRenameModal();
      return;
    }

    const sep = getPathSeparator(target.fullPath);
    const parentFull = target.fullPath.slice(0, target.fullPath.lastIndexOf(sep));
    const newFullPath = parentFull ? `${parentFull}${sep}${trimmedName}` : trimmedName;

    const newRelativePath = (() => {
      if (!target.relativePath) {
        return target.isFile ? trimmedName : '';
      }
      const segments = target.relativePath.split('/');
      segments[segments.length - 1] = trimmedName;
      return segments.join('/');
    })();

    try {
      setRenameLoading(true);
      await waitWithTimeout(renameWorkspaceEntry(target.fullPath, trimmedName));

      closeRenameModal();

      setFiles((prev) => updateTreeForRename(prev, target.relativePath ?? '', trimmedName, newFullPath));

      const oldRelativePath = target.relativePath ?? '';
      setExpandedKeys((prev) => replacePathInList(prev, oldRelativePath, newRelativePath));

      setSelected((prev) => replacePathInList(prev, oldRelativePath, newRelativePath));
      selectedKeysRef.current = replacePathInList(selectedKeysRef.current, oldRelativePath, newRelativePath);

      if (!target.isFile) {
        selectedNodeRef.current = {
          relativePath: newRelativePath,
          fullPath: newFullPath,
        };
        emitter.emit(`${eventPrefix}.selected.file`, []);
      } else {
        selectedNodeRef.current = null;
      }

      messageApi.success(t('conversation.workspace.contextMenu.renameSuccess'));
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') {
        messageApi.error(t('conversation.workspace.contextMenu.renameTimeout'));
      } else {
        messageApi.error(t('conversation.workspace.contextMenu.renameFailed'));
      }
    } finally {
      setRenameLoading(false);
    }
  }, [
    closeRenameModal,
    eventPrefix,
    messageApi,
    renameLoading,
    renameModal,
    t,
    waitWithTimeout,
    setFiles,
    setExpandedKeys,
    setSelected,
    selectedKeysRef,
    selectedNodeRef,
    setRenameLoading,
  ]);

  /**
   * 添加到聊天
   * Add to chat
   */
  const handleAddToChat = useCallback(
    (nodeData: IDirOrFile | null) => {
      if (!nodeData || !nodeData.fullPath) return;
      ensureNodeSelected(nodeData);
      closeContextMenu();

      const payload: FileOrFolderItem = {
        path: nodeData.fullPath,
        name: nodeData.name,
        isFile: Boolean(nodeData.isFile),
        relativePath: nodeData.relativePath || undefined,
      };

      emitter.emit(`${eventPrefix}.selected.file.append`, [payload]);
      messageApi.success(t('conversation.workspace.contextMenu.addedToChat'));
    },
    [closeContextMenu, ensureNodeSelected, eventPrefix, messageApi, t]
  );

  /**
   * 预览文件
   * Preview file (removed - functionality has been deprecated)
   */
  const handlePreviewFile = useCallback(
    async (_nodeData: IDirOrFile | null) => {
      // Preview functionality has been removed
    },
    []
  );

  /**
   * 打开重命名弹窗
   * Open rename modal
   */
  const openRenameModal = useCallback(
    (nodeData: IDirOrFile | null) => {
      if (!nodeData) return;
      ensureNodeSelected(nodeData);
      closeContextMenu();
      setRenameModal({ visible: true, value: nodeData.name, target: nodeData });
    },
    [closeContextMenu, ensureNodeSelected, setRenameModal]
  );

  /**
   * 下载文件到本地（直接从磁盘读取二进制，不经过预览）
   * Download file to local system (read binary directly from disk, bypassing preview)
   */
  const handleDownloadFile = useCallback(
    async (nodeData: IDirOrFile | null) => {
      if (!nodeData || !nodeData.isFile || !nodeData.fullPath) return;
      closeContextMenu();

      try {
        await downloadFileFromPath(nodeData.fullPath, nodeData.name, workspace);
        messageApi.success(t('conversation.workspace.contextMenu.downloadSuccess'));
      } catch (error) {
        messageApi.error(t('conversation.workspace.contextMenu.downloadFailed'));
      }
    },
    [closeContextMenu, messageApi, t]
  );

  return {
    handleOpenNode,
    handleRevealNode,
    handleDeleteNode,
    handleDeleteConfirm,
    handleRenameConfirm,
    handleAddToChat,
    handlePreviewFile,
    openRenameModal,
    handleDownloadFile,
  };
}
