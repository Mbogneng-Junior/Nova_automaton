#!/usr/bin/env bash
set -e

# Automaton - Initial setup script for DigitalOcean Droplet
# Generic IA content automation stack
# Run as root or with sudo

echo "=== Automaton - Server Setup ==="

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    ufw \
    fail2ban

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install docker-compose v2 symlink if needed
if ! command -v docker-compose &> /dev/null; then
    ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
fi

# Enable Docker
systemctl enable docker
systemctl start docker

# Create non-root user for deployment
USERNAME="automaton"
if ! id "$USERNAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USERNAME"
    usermod -aG docker "$USERNAME"
    echo "User $USERNAME created and added to docker group."
fi

# Firewall setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5678/tcp
ufw --force enable

# Fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Create project directory
PROJECT_DIR="/home/$USERNAME/automaton"
mkdir -p "$PROJECT_DIR"
chown -R "$USERNAME:$USERNAME" "$PROJECT_DIR"

echo "=== Server ready ==="
echo "Next steps:"
echo "1. Clone the repository: git clone https://github.com/TON_COMPTE/automaton.git $PROJECT_DIR"
echo "2. Copy .env.example to .env and fill it"
echo "3. Run: cd $PROJECT_DIR && docker-compose up -d"
