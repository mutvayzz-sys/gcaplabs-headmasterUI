#!/bin/bash
# H4: create-instance.sh — manual per-user container provisioning on the VPS.
#
# Usage: create-instance.sh <user-id> <container-id>
#
# This is a manual-ops wrapper. The production path is HermesHQ's
# container_supervisor.py (backend/hermeshq/services/container_supervisor.py)
# which calls Docker CLI with the same labels. Use this script for
# debugging, manual recovery, or when the supervisor is unreachable.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <user-id> <container-id>" >&2
  exit 1
fi

USER_ID="$1"
CONTAINER_ID="$2"

# Read runtime config from /home/m4/headmaster-stack/.env
ENV_FILE="/home/m4/headmaster-stack/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

IMAGE="${RUNTIME_CONTAINER_IMAGE:-headmaster-hermes-runtime:latest}"
NETWORK="${RUNTIME_CONTAINER_NETWORK:-hermes_runtime}"
DATA_DIR="/var/lib/headmaster/instances/${CONTAINER_ID}"
RUN_DOMAIN="${RUN_DOMAIN:-run.gcaplabs.com}"
FORWARD_AUTH_URL="${FORWARD_AUTH_URL:-http://127.0.0.1:18081/}"

ROUTER_NAME="hm-${CONTAINER_ID:0:12}"
HOST="${ROUTER_NAME}.${RUN_DOMAIN}"

echo "Creating container for user=$USER_ID id=$CONTAINER_ID"
echo "  image: $IMAGE"
echo "  network: $NETWORK"
echo "  data dir: $DATA_DIR"
echo "  host: https://$HOST"

mkdir -p "$DATA_DIR"

# Build the docker run command. We use the same Traefik labels as
# container_supervisor.py: router + forward-auth middleware.
docker run -d \
  --name "hm-${CONTAINER_ID}" \
  --network "$NETWORK" \
  --cpus "${RUNTIME_CONTAINER_CPU:-2}" \
  --memory "${RUNTIME_CONTAINER_MEMORY:-4g}" \
  --pids-limit "${RUNTIME_CONTAINER_PIDS_LIMIT:-512}" \
  --shm-size "${RUNTIME_CONTAINER_SHM_SIZE:-1g}" \
  --security-opt no-new-privileges \
  -v "${DATA_DIR}:/app/data" \
  --label "hermeshq.runtime_container_id=${CONTAINER_ID}" \
  --label "hermeshq.user_id=${USER_ID}" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.${ROUTER_NAME}.rule=Host(\`${HOST}\`)" \
  --label "traefik.http.routers.${ROUTER_NAME}.entrypoints=websecure" \
  --label "traefik.http.routers.${ROUTER_NAME}.tls=true" \
  --label "traefik.http.services.${ROUTER_NAME}.loadbalancer.server.port=3737" \
  --label "traefik.http.routers.${ROUTER_NAME}.middlewares=${ROUTER_NAME}-forward-auth" \
  --label "traefik.http.middlewares.${ROUTER_NAME}-forward-auth.forwardauth.address=${FORWARD_AUTH_URL}" \
  --label "traefik.http.middlewares.${ROUTER_NAME}-forward-auth.forwardauth.trustForwardHeader=true" \
  -e HERMES_MODE=headmaster_remote \
  -e PORT=3737 \
  -e GATEWAY_DEFAULT_AGENT=hermes \
  "$IMAGE"

echo "Container hm-${CONTAINER_ID} started at https://${HOST}"