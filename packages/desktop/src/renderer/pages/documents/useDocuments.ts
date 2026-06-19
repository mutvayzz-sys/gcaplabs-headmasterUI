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

interface ManagedFilesResponse {
  base: string;
  entries: Array<{
    name: string;
    path: string;
    is_dir?: boolean;
    is_file?: boolean;
    size?: number | null;
    modified_at?: number;
  }>;
}

interface ManagedFileResponse {
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
      const cwd = await httpGet<{ cwd?: string }>('/api/fs/default-cwd').invoke();
      const root = cwd?.cwd ?? '';
      if (!root) {
        setRootPath('');
        setEntries([]);
        return;
      }
      const files = await httpGet<ManagedFilesResponse>(`/api/files?path=${encodeURIComponent(root)}`).invoke();
      setRootPath(files.base || root);
      setEntries(
        (files.entries ?? []).map((entry) =>
          normalizeEntry({
            name: entry.name,
            full_path: entry.path,
            is_dir: entry.is_dir,
            is_file: entry.is_file,
            size: entry.size,
            mtime: entry.modified_at,
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPreview = useCallback(async (path: string) => {
    setPreviewLoading(true);
    try {
      const content = await httpGet<{ path: string; content?: string; text?: string }>(
        `/api/files/read?path=${encodeURIComponent(path)}`
      ).invoke();
      setPreview({
        type: 'text',
        path: content.path || path,
        content: content.content ?? content.text ?? '',
      });
    } catch (err) {
      console.error('Failed to read file:', err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File, targetPath: string) => {
      const normalizedTarget =
        targetPath.endsWith('/') || targetPath.endsWith('\\')
          ? `${targetPath}${file.name}`
          : targetPath || `${rootPath}${separatorFor(rootPath)}${file.name}`;
      await httpPost<ManagedFileResponse, { path: string; data_url: string; overwrite: boolean }>(
        '/api/files/upload'
      ).invoke({
        path: normalizedTarget,
        data_url: await fileToDataUrl(file),
        overwrite: true,
      });
      await fetchFiles();
    },
    [fetchFiles, rootPath]
  );

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
