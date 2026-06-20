/**
 * Assign large renderer dependencies to stable vendor chunks.
 *
 * Use the innermost node_modules package name so packages such as
 * `@monaco-editor/react` are not mistaken for React itself.
 */
export function getRendererManualChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/');
  if (!normalizedId.includes('/node_modules/')) return undefined;

  const packagePath = normalizedId.split('/node_modules/').at(-1) ?? '';

  if (
    packagePath.startsWith('monaco-editor/') ||
    packagePath.startsWith('@monaco-editor/') ||
    packagePath.startsWith('codemirror/') ||
    packagePath.startsWith('@codemirror/')
  ) {
    return 'vendor-editor';
  }
  if (packagePath.startsWith('react/') || packagePath.startsWith('react-dom/')) return 'vendor-react';
  if (packagePath.startsWith('@arco-design/')) return 'vendor-arco';
  if (
    packagePath.startsWith('react-markdown/') ||
    packagePath.startsWith('remark-') ||
    packagePath.startsWith('rehype-') ||
    packagePath.startsWith('unified/') ||
    packagePath.startsWith('mdast-') ||
    packagePath.startsWith('hast-') ||
    packagePath.startsWith('micromark')
  ) {
    return 'vendor-markdown';
  }
  if (
    packagePath.startsWith('react-syntax-highlighter/') ||
    packagePath.startsWith('refractor/') ||
    packagePath.startsWith('highlight.js/')
  ) {
    return 'vendor-highlight';
  }
  if (packagePath.startsWith('katex/')) return 'vendor-katex';
  if (packagePath.startsWith('@icon-park/')) return 'vendor-icons';
  if (packagePath.startsWith('diff2html/')) return 'vendor-diff';
  return undefined;
}
