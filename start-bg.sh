#!/bin/bash
# Run start.sh inside a detached tmux session so the services survive SSH
# disconnects. Use this on servers; use start.sh directly for local dev / CI.

set -e
cd "$(dirname "$0")"

SESSION="claudecode-hub"

if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is not installed. Run 'bash install.sh' first."
  exit 1
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' is already running."
  echo "  Attach (see logs):   tmux attach -t $SESSION"
  echo "  Stop:                tmux kill-session -t $SESSION"
  exit 0
fi

tmux new-session -d -s "$SESSION" 'bash start.sh'

# Give start.sh a moment to fail fast (e.g. preflight .env check)
sleep 1

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Error: start.sh exited immediately. Run 'bash start.sh' directly to see the error."
  exit 1
fi

cat <<INFO
Started in tmux session '$SESSION'.

  Services:
    Proxy:                  http://localhost:3180
    Admin dashboard:        http://localhost:3182
    Marketing site:         http://localhost:3183

  Attach (see logs):        tmux attach -t $SESSION
  Detach while running:     press Ctrl+B, then D
  Stop:                     tmux kill-session -t $SESSION
  Status:                   tmux ls
INFO