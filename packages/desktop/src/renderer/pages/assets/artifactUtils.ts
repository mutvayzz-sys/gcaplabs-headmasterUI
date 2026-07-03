/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HermesSessionMessage } from '@/common/adapter/hermesSessionAdapter';

export type ArtifactKind = 'image' | 'file' | 'link';

export interface ArtifactRecord {
  id: string;
  kind: ArtifactKind;
  value: string;
  href: string;
  label: string;
  sessionId: string;
  sessionTitle: string;
  timestamp: number;
}

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const PATH_RE = /(^|[\s("'`])((?:\/|~\/|\.\.?\/)[^\s"'`<>]+(?:\.[a-z0-9]{1,8})?)/gi;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?.*)?$/i;
const FILE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp|pdf|txt|json|md|csv|zip|tar|gz|mp3|wav|mp4|mov)(?:\?.*)?$/i;
const KEY_HINT_RE = /(path|file|url|image|artifact|output|download|result|target)/i;

function normalizeValue(value: string): string {
  return value.trim().replace(/[),.;]+$/, '');
}

function parseMaybeJson(value: string): unknown {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function looksLikePathOrUrl(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:image/') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('~/')
  );
}

function looksLikeArtifact(value: string): boolean {
  if (/^(?:https?:\/\/|data:image\/)/.test(value)) return true;
  if (looksLikePathOrUrl(value) && (IMAGE_EXT_RE.test(value) || FILE_EXT_RE.test(value))) return true;
  return value.startsWith('/') && value.includes('.');
}

export function artifactKind(value: string): ArtifactKind {
  if (value.startsWith('data:image/') || IMAGE_EXT_RE.test(value)) return 'image';
  if (
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('~/') ||
    value.startsWith('file://')
  ) {
    return 'file';
  }
  return 'link';
}

export function artifactHref(value: string): string {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:')
  ) {
    return value;
  }
  if (value.startsWith('/')) return `file://${encodeURI(value)}`;
  return value;
}

export function artifactLabel(value: string): string {
  try {
    const url = new URL(value);
    const item = url.pathname.split('/').findLast(Boolean);
    return item || value;
  } catch {
    return value.split(/[\\/]/).findLast(Boolean) || value;
  }
}

function stringifyMessagePart(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(stringifyMessagePart).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
  }
  return '';
}

function messageText(message: HermesSessionMessage): string {
  const content = stringifyMessagePart(message.content).trim();
  if (content) return content;
  const text = stringifyMessagePart(message.text).trim();
  if (text) return text;
  const context = stringifyMessagePart(message.context).trim();
  if (context) return context;
  return '';
}

function collectStringValues(
  value: unknown,
  keyPath: string,
  collector: (value: string, keyPath: string) => void
): void {
  if (typeof value === 'string') {
    collector(value, keyPath);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectStringValues(entry, `${keyPath}.${index}`, collector));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    collectStringValues(child, keyPath ? `${keyPath}.${key}` : key, collector);
  }
}

function collectArtifactsFromText(text: string, pushValue: (value: string) => void): void {
  for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) pushValue(match[2] || '');
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const start = match.index ?? 0;
    if (start > 0 && text[start - 1] === '!') continue;
    const value = match[2] || '';
    if (looksLikeArtifact(value)) pushValue(value);
  }
  for (const match of text.matchAll(URL_RE)) {
    const value = match[0] || '';
    if (looksLikeArtifact(value)) pushValue(value);
  }
  for (const match of text.matchAll(PATH_RE)) pushValue(match[2] || '');
}

function collectArtifactsFromMessage(message: HermesSessionMessage, pushValue: (value: string) => void): void {
  const text = messageText(message);
  if (text) collectArtifactsFromText(text, pushValue);

  if (message.role !== 'tool' && !Array.isArray(message.tool_calls)) return;

  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      collectStringValues(call, 'tool_call', (value, keyPath) => {
        const normalized = normalizeValue(value);
        if (!normalized) return;
        if (KEY_HINT_RE.test(keyPath) && (looksLikePathOrUrl(normalized) || FILE_EXT_RE.test(normalized))) {
          pushValue(normalized);
        }
      });
    }
  }

  const parsed = parseMaybeJson(text);
  if (parsed !== null) {
    collectStringValues(parsed, 'tool_result', (value, keyPath) => {
      const normalized = normalizeValue(value);
      if (!normalized) return;
      if ((KEY_HINT_RE.test(keyPath) || looksLikePathOrUrl(normalized)) && looksLikeArtifact(normalized)) {
        pushValue(normalized);
      }
    });
  }
}

export function collectArtifactsForSession(
  sessionId: string,
  sessionTitle: string,
  messages: HermesSessionMessage[]
): ArtifactRecord[] {
  const found = new Map<string, ArtifactRecord>();

  for (const message of messages) {
    if (message.role !== 'assistant' && message.role !== 'tool') continue;

    collectArtifactsFromMessage(message, (candidate) => {
      const value = normalizeValue(candidate);
      if (!value || !looksLikeArtifact(value)) return;

      const key = `${sessionId}:${value}`;
      if (found.has(key)) return;

      found.set(key, {
        id: key,
        kind: artifactKind(value),
        value,
        href: artifactHref(value),
        label: artifactLabel(value),
        sessionId,
        sessionTitle,
        timestamp: message.created_at ?? message.timestamp ?? Date.now(),
      });
    });
  }

  return Array.from(found.values());
}
