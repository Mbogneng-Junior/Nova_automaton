#!/usr/bin/env bash
set -e

# Automaton - Lightweight server setup
# DigitalOcean Droplet / Ubuntu 24.04
# Run as root or with sudo

export DEBIAN_FRONTEND=noninteractive
APT_OPTS="-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"

echo "=== Automaton - Server Setup ==="

# Update package lists only (no full upgrade by default, use --upgrade to enable)
apt-get update

if [[ "$1" == "--upgrade" ]]; then
    echo "Upgrading packages..."
    apt-get $APT_OPTS upgrade
fi

# Install only what's needed
echo "Installing dependencies..."
apt-get $APT_OPTS install \
    ca-certificates \
    curl \
    git \
    ufw \
    fail2ban

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get $APT_OPTS install docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
    echo "Docker already installed, skipping."
fi

# docker-compose symlink if needed
if [[ ! -e /usr/local/bin/docker-compose ]] && [[ -f /usr/libexec/docker/cli-plugins/docker-compose ]]; then
    ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
fi

systemctl enable docker
systemctl start docker

# Create non-root deploy user
USERNAME="automaton"
if ! id "$USERNAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USERNAME"
    echo "User $USERNAME created."
fi
usermod -aG docker "$USERNAME"

# Firewall (idempotent)
if ! ufw status | grep -q "Status: active"; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 5678/tcp
    ufw --force enable
else
    echo "UFW already active."
fi

# Fail2ban
systemctl enable fail2ban || true
systemctl start fail2ban || true

# Project directory
PROJECT_DIR="/home/$USERNAME/automaton"
mkdir -p "$PROJECT_DIR"
chown -R "$USERNAME:$USERNAME" "$PROJECT_DIR"

echo "=== Server ready ==="
echo "Next steps:"
echo "1. Clone the repo: git clone https://github.com/TON_COMPTE/automaton.git $PROJECT_DIR"
echo "2. cd $PROJECT_DIR && cp .env.example .env && nano .env"
echo "3. Generate SSL certificate (see docs/DEPLOYMENT.md)"
echo "4. docker-compose up -d"
