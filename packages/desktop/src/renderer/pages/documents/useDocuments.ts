/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet, httpPost } from '@/common/adapter/httpBridge';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt?: string;
  children?: FileEntry[];
}

export interface FilesListResponse {
  root: string;
  base: string;
  entries: FileEntry[];
}

export interface FileReadResponse {
  type: 'text' | 'image';
  path: string;
  content: string;
}

interface AdonisFsEntry {
  name: string;
  full_path?: string;
  relative_path?: string;
  is_dir?: boolean;
  is_file?: boolean;
  size?: number | null;
  mtime?: number;
}

interface AdonisConversation {
  extra?: {
    workspace?: string;
  };
}

interface AdonisConversationsResponse {
  items?: AdonisConversation[];
}

interface FsWriteResponse {
  ok?: boolean;
}

interface UseDocumentsReturn {
  rootPath: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  selectedPath: string | null;
  setSelectedPath: (p: string | null) => void;
  preview: FileReadResponse | null;
  previewLoading: boolean;
  uploadFile: (file: File, targetPath: string) => Promise<void>;
}

function normalizeEntry(entry: AdonisFsEntry): FileEntry {
  return {
    name: entry.name,
    path: entry.full_path ?? entry.relative_path ?? entry.name,
    type: entry.is_dir ? 'folder' : 'file',
    size: typeof entry.size === 'number' ? entry.size : undefined,
    modifiedAt: typeof entry.mtime === 'number' ? new Date(entry.mtime * 1000).toISOString() : undefined,
  };
}

function inferAionuiRoot(conversations: AdonisConversation[]): string {
  for (const conversation of conversations) {
    const workspace = conversation.extra?.workspace;
    if (!workspace) continue;
    const marker = `${separatorFor(workspace)}conversations${separatorFor(workspace)}`;
    const markerIndex = workspace.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIndex > 0) return workspace.slice(0, markerIndex);
  }
  return '';
}

function separatorFor(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function useDocuments(): UseDocumentsReturn {
  const [rootPath, setRootPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileReadResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conversations = await httpGet<AdonisConversationsResponse>('/api/conversations').invoke();
      const root = inferAionuiRoot(conversations?.items ?? []);
      if (!root) {
        setRootPath('');
        setEntries([]);
        return;
      }
      const entriesRaw = await httpPost<AdonisFsEntry[], { root: string }>('/api/fs/list').invoke({ root });
      setRootPath(root);
      setEntries((entriesRaw ?? []).map(normalizeEntry));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPreview = useCallback(async (path: string) => {
    setPreviewLoading(true);
    try {
      const content = await httpPost<string | null, { path: string }>('/api/fs/read').invoke({ path });
      setPreview(content !== null && content !== undefined ? {
        type: 'text',
        path,
        content,
      } : null);
    } catch (err) {
      console.error('Failed to read file:', err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const uploadFile = useCallback(async (file: File, targetPath: string) => {
    const normalizedTarget = targetPath.endsWith('/') || targetPath.endsWith('\\')
      ? `${targetPath}${file.name}`
      : targetPath || `${rootPath}${separatorFor(rootPath)}${file.name}`;
    await httpPost<FsWriteResponse, { path: string; data: string }>('/api/fs/write').invoke({
      path: normalizedTarget,
      data: await file.text(),
    });
    await fetchFiles();
  }, [fetchFiles, rootPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (selectedPath) {
      fetchPreview(selectedPath);
    } else {
      setPreview(null);
    }
  }, [selectedPath, fetchPreview]);

  return {
    rootPath,
    entries,
    loading,
    error,
    refresh: fetchFiles,
    selectedPath,
    setSelectedPath,
    preview,
    previewLoading,
    uploadFile,
  };
}
