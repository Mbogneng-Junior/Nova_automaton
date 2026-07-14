#!/bin/bash
# Configuration du bot Telegram pour Hermes
# À exécuter sur le droplet après avoir créé le bot via @BotFather
# Doc: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram

set -e

echo "=== Configuration Telegram Bot pour Hermes ==="
echo ""

# Vérifier que le container Hermes tourne
if ! docker ps --format '{{.Names}}' | grep -q automaton_hermes; then
    echo "ERROR: Le container automaton_hermes n'est pas en cours d'exécution."
    echo "Démarre-le d'abord: docker compose up -d hermes"
    exit 1
fi

# Demander le token
read -p "Colle le token du bot Telegram (de @BotFather): " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
    echo "ERROR: Token vide. Abandon."
    exit 1
fi

# Demander le user ID Telegram
echo ""
echo "Pour trouver ton Telegram User ID :"
echo "  - Message @userinfobot sur Telegram → il répond avec ton ID numérique"
echo "  - Ou @get_id_bot"
echo ""
read -p "Colle ton Telegram User ID (numérique): " USER_ID

if [ -z "$USER_ID" ]; then
    echo "WARNING: Pas de User ID. Hermes répondra à tout le monde (non recommandé)."
    USER_ID=""
fi

echo ""
echo "Configuration de Hermes avec le token Telegram..."

# Hermes utilise ~/.hermes/.env pour la config Telegram (pas hermes config set)
ENV_FILE="/home/hermes/.hermes/.env"

# Créer ou mettre à jour le fichier .env dans le container
docker exec automaton_hermes bash -c "touch '$ENV_FILE' && \
    sed -i '/^TELEGRAM_BOT_TOKEN=/d' '$ENV_FILE' && \
    sed -i '/^TELEGRAM_ALLOWED_USERS=/d' '$ENV_FILE' && \
    echo 'TELEGRAM_BOT_TOKEN=$BOT_TOKEN' >> '$ENV_FILE' && \
    echo 'TELEGRAM_ALLOWED_USERS=$USER_ID' >> '$ENV_FILE'"

echo "  ✓ Token et User ID écrits dans $ENV_FILE"

# Redémarrer Hermes pour activer Telegram
echo "Redémarrage de Hermes..."
docker compose restart hermes

echo ""
echo "=== Configuration terminée ==="
echo ""
echo "Pour vérifier que le bot fonctionne:"
echo "  1. Ouvre Telegram et trouve ton bot"
echo "  2. Envoie-lui un message (ex: 'Bonjour')"
echo "  3. Hermes devrait répondre"
echo ""
echo "Logs Hermes:"
echo "  docker compose logs -f hermes"
echo ""
echo "Pour configurer le modèle IA (si pas déjà fait):"
echo "  docker exec -it automaton_hermes bash"
echo "  hermes model"
echo "  # Choisir: IAM (1) → us-east-1 → Claude (1)"
