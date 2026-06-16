/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin, Tooltip, Input } from '@arco-design/web-react';
import { Books, Folder, FileText, ArrowCounterClockwise, CaretDown, CaretRight } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useDocuments } from './useDocuments';
import type { FileEntry } from './useDocuments';

function formatBytes(n?: number): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
}

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({ entry, depth, selectedPath, onSelect, expandedPaths, onToggleExpand }) => {
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isFolder = entry.type === 'folder';

  return (
    <div className='flex flex-col'>
      <div
        className={classNames(
          'flex items-center gap-6px cursor-pointer h-28px px-6px rd-6px transition-colors select-none',
          isSelected ? 'bg-fill-3 text-t-primary' : 'hover:bg-fill-2 text-t-secondary'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (isFolder) {
            onToggleExpand(entry.path);
          } else {
            onSelect(entry.path);
          }
        }}
      >
        {isFolder ? (
          isExpanded ? (
            <CaretDown size={12} className='shrink-0 text-t-secondary' />
          ) : (
            <CaretRight size={12} className='shrink-0 text-t-secondary' />
          )
        ) : (
          <span className='w-12px shrink-0' />
        )}
        {isFolder ? (
          <Folder size={14} weight='fill' className='shrink-0 text-amber-300' />
        ) : isImage(entry.name) ? (
          <FileText size={14} className='shrink-0 text-emerald-300' />
        ) : (
          <FileText size={14} className='shrink-0 text-t-tertiary' />
        )}
        <span className='text-13px truncate'>{entry.name}</span>
        {entry.size != null && (
          <span className='text-11px text-t-tertiary ml-auto shrink-0'>{formatBytes(entry.size)}</span>
        )}
      </div>
      {isFolder && isExpanded && entry.children?.map((child) => (
        <TreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
};

const DocumentsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const {
    rootPath,
    entries,
    loading,
    error,
    refresh,
    selectedPath,
    setSelectedPath,
    preview,
    previewLoading,
    uploadFile,
  } = useDocuments();

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const filteredEntries = search
    ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <div className={classNames('size-full flex', isMobile ? 'flex-col' : 'flex-row')}>
      {/* Sidebar tree */}
      <div
        className={classNames(
          'flex flex-col border-r border-border-2 bg-fill-1',
          isMobile ? 'h-40%' : 'w-280px'
        )}
      >
        <div className='flex items-center justify-between px-12px py-10px shrink-0'>
          <div className='flex items-center gap-8px'>
            <Books size={18} weight='duotone' className='text-t-primary' />
            <span className='text-15px font-semibold text-t-primary'>
              {t('documents.title', { defaultValue: 'Documents' })}
            </span>
          </div>
          <Button
            type='secondary'
            size='small'
            icon={<ArrowCounterClockwise size={14} />}
            onClick={refresh}
            disabled={loading}
          />
        </div>

        <div className='px-10px pb-8px shrink-0'>
          <Input
            size='small'
            placeholder={t('documents.search', { defaultValue: 'Search files…' })}
            value={search}
            onChange={setSearch}
            allowClear
          />
        </div>

        <div className='flex-1 min-h-0 overflow-y-auto px-8px pb-8px'>
          {loading && entries.length === 0 && (
            <div className='flex justify-center py-40px'>
              <Spin size={24} />
            </div>
          )}
          {error && (
            <div className='text-center py-24px text-t-secondary'>
              <p className='text-13px mb-8px'>{error}</p>
              <Button type='primary' size='small' onClick={refresh}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          )}
          {!loading && !error && filteredEntries.length === 0 && (
            <Empty description={t('documents.empty', { defaultValue: 'No files' })} />
          )}
          <div className='flex flex-col gap-2px'>
            {filteredEntries.map((entry) => (
              <TreeItem
                key={entry.path}
                entry={entry}
                depth={0}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Preview pane */}
      <div className='flex-1 min-h-0 overflow-y-auto p-16px'>
        {selectedPath == null ? (
          <div className='flex flex-col items-center justify-center h-full text-t-secondary'>
            <Books size={48} weight='thin' className='mb-12px opacity-40' />
            <p className='text-14px'>
              {t('documents.selectFile', { defaultValue: 'Select a file to preview' })}
            </p>
          </div>
        ) : previewLoading ? (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        ) : preview == null ? (
          <p className='text-t-secondary text-14px'>
            {t('documents.noPreview', { defaultValue: 'Cannot preview this file' })}
          </p>
        ) : preview.type === 'image' ? (
          <img
            src={`data:image/${preview.path.split('.').pop()};base64,${preview.content}`}
            alt={preview.path}
            className='max-w-full max-h-full object-contain'
          />
        ) : (
          <pre className='text-13px text-t-primary whitespace-pre-wrap break-words bg-fill-1 p-12px rd-8px border border-border-2'>
            {preview.content}
          </pre>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
