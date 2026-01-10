#!/bin/bash

echo "Installing Home Athan Automation..."

# Detect architecture
ARCH=$(uname -m)
echo "Detected architecture: $ARCH"

# 1. Update system
sudo apt-get update

# Base packages needed on all architectures
BASE_PACKAGES="python3-venv python3-pip libffi-dev libopenblas-dev"

# ARMv6 (Pi 1, Pi Zero) needs GDAL dev packages to build pyogrio from source
# Newer Pis (ARMv7/ARMv8) have prebuilt wheels on piwheels
if [ "$ARCH" = "armv6l" ]; then
    echo "🔧 ARMv6 detected (Pi 1/Zero) - installing GDAL build dependencies..."
    sudo apt-get install -y $BASE_PACKAGES gdal-bin libgdal-dev
else
    echo "✅ Modern architecture detected - using prebuilt wheels..."
    sudo apt-get install -y $BASE_PACKAGES
fi

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

# Install main requirements
./venv/bin/pip install -r requirements.txt

# ARMv6 needs an older pyproj compatible with PROJ 9.1.1
# Newer Pis can use the latest pyproj (pulled as a dependency)
if [ "$ARCH" = "armv6l" ]; then
    echo "🔧 Installing ARMv6-compatible pyproj version..."
    ./venv/bin/pip install "pyproj>=3.5.0,<3.7.0"
fi

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

# 5. Configure Daily Restart
echo "Configuring daily restart at midnight..."
CRON_JOB="0 0 * * * sudo /sbin/shutdown -r now"
# Add cron job if it doesn't exist
(crontab -l 2>/dev/null | grep -Fv "$CRON_JOB"; echo "$CRON_JOB") | crontab -
echo "✅ Daily reboot scheduled for midnight."

echo "Installation complete!"
