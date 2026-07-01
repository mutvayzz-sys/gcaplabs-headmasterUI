#!/bin/bash
# H5: terminal-url.sh — print the public terminal URL for a per-user container.
#
# Usage: terminal-url.sh <container-id>
#
# Returns the public terminal URL (the runtime's terminal endpoint at /terminal).
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <container-id>" >&2
  exit 1
fi

CONTAINER_ID="$1"

# Read RUN_DOMAIN from the stack env file
ENV_FILE="/home/m4/headmaster-stack/.env"
if [ -f "$ENV_FILE" ]; then
  RUN_DOMAIN=$(grep '^RUN_DOMAIN=' "$ENV_FILE" | cut -d= -f2 | tr -d '\r\n' || echo "run.gcaplabs.com")
else
  RUN_DOMAIN="run.gcaplabs.com"
fi

RUN_DOMAIN="${RUN_DOMAIN#run.gcaplabs.com}"
RUN_DOMAIN="${RUN_DOMAIN#.}"
RUN_DOMAIN="${RUN_DOMAIN:-run.gcaplabs.com}"

ROUTER_NAME="hm-${CONTAINER_ID:0:12}"
echo "https://${ROUTER_NAME}.${RUN_DOMAIN}/terminal"