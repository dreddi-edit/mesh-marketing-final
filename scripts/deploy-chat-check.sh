#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://try-mesh.com}"

echo "== Mesh chat deploy checks =="
echo "target: $BASE"
echo

status_widget=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/assets/mesh-qa-chat.js")
echo "GET /assets/mesh-qa-chat.js -> $status_widget"
[[ "$status_widget" == "200" ]] || { echo "FAIL: widget missing"; exit 1; }

status_chat_method=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/chat")
echo "GET /api/chat -> $status_chat_method (expect 405)"
[[ "$status_chat_method" == "405" ]] || echo "WARN: expected 405 for GET"

status_poll=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/auth/cli/poll?session_id=00000000000000000000000000000000")
echo "GET /api/auth/cli/poll -> $status_poll (expect 204)"
[[ "$status_poll" == "204" ]] || echo "WARN: expected 204 for empty CLI poll"

echo
echo "POST /api/chat (SSE smoke)..."
tmp=$(mktemp)
code=$(curl -sS -N -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message":"How do I install Mesh CLI?"}' \
  -o "$tmp" -w "%{http_code}" --max-time 45 || true)

echo "HTTP $code"
head -c 800 "$tmp" | tr '\n' ' '
echo
echo

if [[ "$code" != "200" ]]; then
  echo "FAIL: chat API returned $code"
  cat "$tmp"
  rm -f "$tmp"
  exit 1
fi

if ! grep -q 'event: answer' "$tmp" && ! grep -q '"text"' "$tmp"; then
  echo "WARN: no answer event in response"
fi

rm -f "$tmp"
echo "OK"
