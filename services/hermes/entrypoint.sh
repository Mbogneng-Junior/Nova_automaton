#!/bin/bash
set -e

export PATH="/home/hermes/.local/bin:/home/hermes/.hermes/node/bin:$PATH"

# Check if Hermes is properly installed
if [ ! -f "$HOME/.local/bin/hermes" ]; then
    echo "ERROR: Hermes binary not found at $HOME/.local/bin/hermes"
    echo "The installation may have failed during Docker build."
    tail -f /dev/null
fi

# Create .hermes dir + symlinks to /opt (survives volume mount overwriting .hermes)
mkdir -p "$HOME/.hermes"
[ -e "$HOME/.hermes/hermes-agent" ] || ln -sf /opt/hermes-agent "$HOME/.hermes/hermes-agent"
[ -e "$HOME/.hermes/hci" ]          || ln -sf /opt/hci          "$HOME/.hermes/hci"

# Start Hermes Control Interface in background (always, before any config check)
echo "Starting Hermes Control Interface (HCI)..."
export PORT=10274
export HOST=0.0.0.0
cd "$HOME/.hermes/hci"
nohup node server.js > /tmp/hci.log 2>&1 &
cd "$HOME"

# If no config exists, print instructions but keep HCI alive for setup
CONFIG_FILE="$HOME/.hermes/auth.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "=========================================="
    echo "Hermes Agent - First Time Setup Required"
    echo "=========================================="
    echo ""
    echo "Run interactively to configure:"
    echo "  docker exec -it automaton_hermes bash"
    echo "  hermes model"
    echo ""
    echo "HCI is running at port 10274 - waiting for hermes model config..."
    echo "=========================================="
    tail -f /dev/null
fi

# Auto-update to latest version before starting
echo "Checking for Hermes updates..."
cd "$HOME/.hermes/hermes-agent"
if git fetch origin main &>/dev/null; then
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "New version available. Updating..."
        git reset --hard origin/main
        # Re-install dependencies if needed
        if [ -f "pyproject.toml" ]; then
            ~/.local/bin/uv pip install -e ".[all]" &>/dev/null || true
        fi
        echo "Update complete."
    else
        echo "Already up to date."
    fi
else
    echo "Could not check for updates (offline?). Continuing with current version."
fi

# Auto-configure API server platform (config is reset on container restart)
echo "Configuring Hermes API server..."
hermes config set platforms.api_server.enabled true &>/dev/null || true
hermes config set platforms.api_server.extra.port 8123 &>/dev/null || true
hermes config set GATEWAY_ALLOW_ALL_USERS true &>/dev/null || true

# Start Hermes Gateway
echo "Starting Hermes Gateway..."
hermes gateway
