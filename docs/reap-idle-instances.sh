#!/bin/bash
# Reap idle runtime containers past RUNTIME_CONTAINER_IDLE_TTL_SECONDS.
# Runs every 10 minutes via /etc/cron.d/headmaster-reaper.
set -euo pipefail

TTL_SECONDS=${RUNTIME_CONTAINER_IDLE_TTL_SECONDS:-3600}
NOW=$(date +%s)
REAPED=0
CHECKED=0

# Only look at containers tagged by HermesHQ
for CID in $(docker ps --filter 'label=hermeshq.runtime_container_id' --format '{{.ID}}'); do
  CHECKED=$((CHECKED + 1))
  CREATED=$(docker inspect -f '{{.State.StartedAt}}' "$CID" 2>/dev/null || echo "")
  if [ -z "$CREATED" ]; then continue; fi
  CREATED_EPOCH=$(date -d "$CREATED" +%s 2>/dev/null || echo 0)
  if [ "$CREATED_EPOCH" -eq 0 ]; then continue; fi
  AGE=$((NOW - CREATED_EPOCH))
  if [ $AGE -gt $TTL_SECONDS ]; then
    NAME=$(docker inspect -f '{{.Name}}' "$CID" 2>/dev/null | tr -d '/')
    echo "$(date -Iseconds) Reaping idle container $NAME (age: ${AGE}s > TTL ${TTL_SECONDS}s)"
    docker stop "$CID" >/dev/null 2>&1 && docker rm "$CID" >/dev/null 2>&1
    REAPED=$((REAPED + 1))
  fi
done

echo "$(date -Iseconds) Reaper run: checked=$CHECKED, reaped=$REAPED"