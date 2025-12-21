#!/bin/bash

# Configuration
PI_USER="${1:-maherrt}"
PI_HOST="${2:-192.168.86.39}"
PI_PASS="${3:-}"
PI_DIR="~/Home-Athan"

# Helper to run commands with or without password
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

echo "🚀 Deploying Home Athan (Docker)..."

# 1. Sync Files
if command -v rsync &> /dev/null; then
    echo "📦 Syncing files with rsync..."
    run_rsync -avz --exclude '.git' --exclude 'venv' --exclude '__pycache__' --exclude '.DS_Store' \
        --exclude '.agent' --exclude '.gemini' \
        ./ ${PI_USER}@${PI_HOST}:${PI_DIR}
else
    echo "⚠️ rsync not found. Using scp..."
    # sshpass works with scp too
    if [ -n "$PI_PASS" ]; then
         sshpass -p "$PI_PASS" scp -r . ${PI_USER}@${PI_HOST}:${PI_DIR}
    else
         scp -r . ${PI_USER}@${PI_HOST}:${PI_DIR}
    fi
fi

# 2. Configure System Resources
echo "🔧 Checking system resources..."
run_ssh ${PI_USER}@${PI_HOST} "
    if [ ! -f /swapfile ]; then
        echo 'running low on memory? creating 2GB swapfile...'
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo '✅ Swapfile created and enabled.'
    else
        echo '✅ Swap configuration looks good.'
    fi
"

# 3. Rebuild and Restart Docker
echo "🔄 Rebuilding and restarting container..."
# Note: Using run_ssh wrapper here
run_ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && nohup sudo docker compose up -d --build > build.log 2>&1 & echo 'Build started in background. Monitor with: tail -f ~/Home-Athan/build.log'"

echo "✅ Docker Deployment Complete!"
