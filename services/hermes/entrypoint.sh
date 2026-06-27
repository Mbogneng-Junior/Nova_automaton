#!/bin/bash
set -e

export PATH="/home/hermes/.local/bin:$PATH"

# If no config exists, print instructions and keep container alive for setup
if [ ! -f "$HOME/.hermes/hermes-agent/.hermes/config.json" ]; then
    echo "=========================================="
    echo "Hermes Agent - First Time Setup Required"
    echo "=========================================="
    echo ""
    echo "Run interactively to configure:"
    echo "  docker exec -it automaton_hermes bash"
    echo "  hermes model"
    echo "  hermes gateway"
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
            uv pip install -e ".[all]" &>/dev/null || true
        fi
        echo "Update complete."
    else
        echo "Already up to date."
    fi
else
    echo "Could not check for updates (offline?). Continuing with current version."
fi

# Start Hermes Gateway
echo "Starting Hermes Gateway..."
hermes gateway
