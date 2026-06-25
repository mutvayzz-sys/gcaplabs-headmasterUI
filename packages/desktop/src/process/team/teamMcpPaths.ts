/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveTeamMcpStdioScriptPath(): string {
  const devPath = path.join(app.getAppPath(), 'packages/desktop/src/process/team/teamMcpStdio.js');
  if (!app.isPackaged) {
    return devPath;
  }
  const bundled = path.join(path.dirname(fileURLToPath(import.meta.url)), 'teamMcpStdio.js');
  return bundled;
}
