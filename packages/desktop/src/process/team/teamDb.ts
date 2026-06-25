/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { ensureDirectory, getDataPath } from '@process/utils';
import { BetterSqlite3Driver } from '@process/services/database/drivers/BetterSqlite3Driver';
import type { ISqliteDriver } from '@process/services/database/drivers/ISqliteDriver';
import {
  CURRENT_DB_VERSION,
  getDatabaseVersion,
  initSchema,
  setDatabaseVersion,
} from '@process/services/database/schema';
import { runMigrations } from '@process/services/database/migrations';
import { resolveLegacyDatabasePath } from '@process/services/database/runLegacyDatabaseMigrations';

let driver: ISqliteDriver | null = null;

export function getTeamDatabase(): ISqliteDriver {
  if (driver) return driver;

  const dbPath = resolveLegacyDatabasePath(getDataPath());
  ensureDirectory(path.dirname(dbPath));

  const instance = new BetterSqlite3Driver(dbPath);
  initSchema(instance);

  const version = getDatabaseVersion(instance);
  if (version < CURRENT_DB_VERSION) {
    runMigrations(instance, version, CURRENT_DB_VERSION);
    setDatabaseVersion(instance, CURRENT_DB_VERSION);
  } else if (!existsSync(dbPath)) {
    setDatabaseVersion(instance, CURRENT_DB_VERSION);
  }

  instance
    .prepare(
      `INSERT OR IGNORE INTO users (id, username, email, password_hash, avatar_path, created_at, updated_at, last_login, jwt_secret)
     VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, NULL)`
    )
    .run('system_default_user', 'system_default_user', '', Date.now(), Date.now());

  driver = instance;
  return instance;
}

export function closeTeamDatabase(): void {
  if (driver) {
    driver.close();
    driver = null;
  }
}
