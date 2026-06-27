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

# Start Hermes Gateway
echo "Starting Hermes Gateway..."
hermes gateway
