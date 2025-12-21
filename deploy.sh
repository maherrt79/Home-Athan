#!/bin/bash

# Configuration
PI_USER="${1:-maherrt}"
PI_HOST="${2:-192.168.86.36}"
PI_PASS="${3:-}"
HOST="${PI_USER}@${PI_HOST}"
REMOTE_DIR="~/Home-Athan"
EXCLUDES=("--exclude" ".git" "--exclude" ".DS_Store" "--exclude" "venv" "--exclude" "__pycache__" "--exclude" ".agent" "--exclude" ".gemini" "--exclude" ".dockerignore" "--exclude" "audio" "--exclude" "deploy.sh")

# Helper to run commands
run_ssh() {
    if [ -n "$PI_PASS" ]; then
        if ! command -v sshpass &> /dev/null; then
            echo "❌ Error: 'sshpass' is required for password argument. Install with: brew install sshpass"
            exit 1
        fi
        sshpass -p "$PI_PASS" ssh "$@"
    else
        ssh "$@"
    fi
}

run_rsync() {
    if [ -n "$PI_PASS" ]; then
        if ! command -v sshpass &> /dev/null; then
            echo "❌ Error: 'sshpass' is required for password argument. Install with: brew install sshpass"
            exit 1
        fi
        sshpass -p "$PI_PASS" rsync "$@"
    else
        rsync "$@"
    fi
}

echo "🚀 Deploying Home Athan Updates..."

# Sync files
echo "📦 Syncing files..."
run_rsync -avzP "${EXCLUDES[@]}" ./ $HOST:$REMOTE_DIR/

echo "📦 Installing Dependencies..."
# We run install.sh to ensure system packages (like libopenblas) are also installed
run_ssh $HOST "cd $REMOTE_DIR && chmod +x scripts/install.sh && ./scripts/install.sh"

echo "🔄 Restarting Service..."
run_ssh $HOST "sudo systemctl restart home-athan"

echo "✅ Deployment Complete!"
