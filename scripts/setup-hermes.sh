#!/bin/bash
set -e

echo "=========================================="
echo "Setup Hermes Agent + HCI on Automaton"
echo "=========================================="

# 1. Create data directories
mkdir -p data/hermes data/hermes-hci

# 2. Build and start Hermes services
docker compose build hermes hermes-hci
docker compose up -d hermes hermes-hci

echo ""
echo "=========================================="
echo "Hermes containers started."
echo ""
echo "NEXT STEPS (required for first run):"
echo "=========================================="
echo ""
echo "1. Configure Hermes LLM provider:"
echo "   docker exec -it automaton_hermes bash"
echo "   hermes model"
echo "   # Choose your provider (OpenAI, Anthropic, Nous Portal)"
echo "   # Exit the container when done"
echo ""
echo "2. Restart Hermes container:"
echo "   docker compose restart hermes"
echo ""
echo "3. Access HCI dashboard:"
echo "   https://hermes.automaton.neurenova.tech"
echo "   Password: \${HERMES_HCI_PASSWORD}"
echo ""
echo "=========================================="
