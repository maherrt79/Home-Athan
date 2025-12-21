# 🚀 Deployment Guide: Production Setup

This guide provides a comprehensive walkthrough for deploying the **Home Athan** system for long-term production reliability.

---

## 📋 Pre-Flight Checklist

Before you begin, ensure you have:
- [ ] **Raspberry Pi**: Pi 3, 4, 5, or Zero 2 W (recommended).
- [ ] **OS**: Raspberry Pi OS (64-bit Lite recommended).
- [ ] **Network**: Pi and Smart Speakers must be on the **same subnet** (MDNS discovery limitation).
- [ ] **Static IP**: (Optional but Recommended) Assign a static IP to your Pi in your router settings.
- [ ] **SSH**: Enabled on the Pi.

---

## 🛠 Step 1: Remote Access (Mac to Pi)

1.  **Open Terminal** on your Mac.
2.  **Connect via SSH**:
    ```bash
    ssh pi@raspberrypi.local
    ```
    *If `.local` doesn't work, use the Pi's IP address directly.*

---

## 📦 Step 2: Deployment Methods

Choose **one** of the following methods. Docker is recommended for environment isolation.

### Option A: Standard Installation (Recommended for most)

1.  **Clone & Run Installer**:
    ```bash
    git clone https://github.com/maher/Home-Athan.git
    cd Home-Athan
    chmod +x scripts/install.sh
    ./scripts/install.sh
    ```
2.  **Verify Service**:
    ```bash
    sudo systemctl status home-athan
    ```

### Option B: Docker Deployment (Advanced)

1.  **Install Docker**:
    ```bash
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    # Log out and back in
    ```
2.  **Launch Container**:
    ```bash
    # Run the Docker ID deployment (Pi .39):
    ./deploy_docker.sh
    ```

---

## 🔒 Step 3: Security & Remote Access

To access your Athan dashboard from outside your home network safely:

### Use Tailscale (Top Pick)
1.  Install [Tailscale](https://tailscale.com/download/linux) on your Pi.
2.  Install Tailscale on your Phone/Mac.
3.  Access the UI using the Pi's **Tailscale IP** even when you are away.

### Firewall (UFW)
If using the standard install, it's good practice to enable the firewall:
```bash
sudo apt install ufw
sudo ufw allow 22/tcp
sudo ufw allow 8000/tcp
sudo ufw enable
```

---

## 🛠 Step 4: Maintenance & Updates

### Updating the System
To pull the latest changes and update your installation:
```bash
# If using standard install (Pi .36):
./deploy.sh [user] [host] [password]
# Example: ./deploy.sh maherrt 192.168.86.50 mypassword

# If using Docker (Pi .39):
./deploy_docker.sh [user] [host] [password]
# Example: ./deploy_docker.sh maherrt 192.168.86.50 mypassword

> **Note:** To use the password parameter, you must verify `sshpass` is installed (`brew install sshpass`). If not installed, the script will error or ask for the password interactively.
```

### Checking Logs
For real-time debugging:
```bash
# Standard install
journalctl -u home-athan -f

# Docker
sudo docker compose logs -f
```

---

## 🔍 Troubleshooting

| Issue | Potential Cause | Solution |
| :--- | :--- | :--- |
| **Speaker Not Found** | Isolation / Subnet mismatch | Ensure Pi and Speakers are on the same WiFi/Subnet. |
| **No Audio Playback** | Missing MP3 file | Check `audio/athan/` for the exact filename in config. |
| **UI Not Loading** | Firewall blocking port | Run `sudo ufw allow 8000/tcp`. |
| **Wrong Prayer Times** | Incorrect Coordinates | Verify Lat/Lon and Timezone in the Calculation tab. |
| **Echo Not Playing** | Webhook URL broken | Verify the URL and test the trigger in IFTTT/Home Assistant. |

---

## 📁 File Structure Reference

-   `/audio/athan/`: Place your Athan MP3s here.
-   `/audio/reminders/`: Place your reminder beep/audio here.
-   `config/default_config.yaml`: The default settings template.
-   `config/config.yaml`: Your active configuration (stored in `~/.config/home-athan/` if installed via script).
