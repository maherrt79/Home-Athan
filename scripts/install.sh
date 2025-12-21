#!/bin/bash

echo "Installing Home Athan Automation..."

# 1. Update system
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip libffi-dev libopenblas-dev

# 2. Create Virtual Env
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
fi

# 3. Install Dependencies
# Skip Cython compilation for zeroconf/others to avoid hangs on Pi Zero
export SKIP_CYTHON=1

# Fix for "No space left on device" in /tmp (common on Pis)
mkdir -p pip_tmp
export TMPDIR=$(pwd)/pip_tmp
echo "Using disk-based temp dir: $TMPDIR"

./venv/bin/pip install -r requirements.txt

# Cleanup temp dir
rm -rf pip_tmp

# 4. Setup Service
echo "Setting up systemd service..."
# Check if running on Pi/Linux
if [ -d "/etc/systemd/system" ]; then
    # Modify path in service file to current dir if needed, or assume standard /home/pi/Home-Athan
    # For now, we copy the sample
    # Create a temporary service file with correct paths and user
    SERVICE_FILE="home-athan.service"
    CURRENT_USER=$(whoami)
    CURRENT_DIR=$(pwd)
    
    echo "Configuring service for user: $CURRENT_USER at $CURRENT_DIR"
    
    cp scripts/$SERVICE_FILE $SERVICE_FILE.tmp
    sed -i "s|User=pi|User=$CURRENT_USER|g" $SERVICE_FILE.tmp
    sed -i "s|Group=pi|Group=$CURRENT_USER|g" $SERVICE_FILE.tmp
    sed -i "s|/home/pi/Home-Athan|$CURRENT_DIR|g" $SERVICE_FILE.tmp
    
    sudo mv $SERVICE_FILE.tmp /etc/systemd/system/$SERVICE_FILE
    sudo systemctl daemon-reload
    sudo systemctl enable home-athan
    echo "Service enabled. Start with: sudo systemctl start home-athan"
else
    echo "Systemd not found (not Linux?), skipping service installation."
fi

echo "Installation complete!"
