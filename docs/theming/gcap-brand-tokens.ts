export const gcapBrandTokens = {
  color: {
    paper: '#f4f1ea',
    surface: '#faf7f2',
    surfaceRaised: '#fffaf2',
    ink: '#1a1814',
    muted: '#5e564a',
    inverse: '#f7f1e6',
    primary: '#1a4d2e',
    primaryHover: '#143d25',
    gold: '#c9a96e',
    signal: '#d4a574',
    moss: '#4a5d4e',
    clay: '#8b7355',
    warm: '#cf806d',
    dark: {
      background: '#15130f',
      surface: '#211d17',
      surfaceRaised: '#2a241c',
      ink: '#f7f1e6',
      muted: '#c7bca9',
      primary: '#74a981',
      gold: '#d4b77a',
    },
  },
  font: {
    display: 'Georgia, "Times New Roman", serif',
    body: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
  },
  motion: {
    fast: '140ms',
    normal: '220ms',
    slow: '420ms',
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
  },
} as const;

export type GcapBrandTokens = typeof gcapBrandTokens;
