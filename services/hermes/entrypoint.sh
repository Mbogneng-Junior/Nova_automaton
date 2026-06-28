#!/bin/bash
set -e

export PATH="/home/hermes/.local/bin:/home/hermes/.hermes/node/bin:$PATH"

# Check if Hermes is properly installed
if [ ! -f "$HOME/.local/bin/hermes" ]; then
    echo "ERROR: Hermes binary not found at $HOME/.local/bin/hermes"
    echo "The installation may have failed during Docker build."
    tail -f /dev/null
fi

# If no config exists, print instructions and keep container alive for setup
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
    echo "Then restart this container."
    echo "Keeping container alive..."
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

# Start Hermes Control Interface in background
echo "Starting Hermes Control Interface (HCI)..."
cd "$HOME/.hermes/hci"
# Make sure we use the same port HCI expects, though we might not need to if we pass PORT
export PORT=10274
export HOST=0.0.0.0
nohup node server.js > hci.log 2>&1 &

# Start Hermes Gateway
echo "Starting Hermes Gateway..."
hermes gateway
