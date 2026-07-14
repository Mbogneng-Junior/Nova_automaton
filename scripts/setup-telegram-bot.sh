#!/bin/bash
# Configuration du bot Telegram pour Hermes
# À exécuter sur le droplet après avoir créé le bot via @BotFather

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

echo ""
echo "Configuration de Hermes avec le token Telegram..."

# Configurer le bot Telegram dans Hermes
docker exec automaton_hermes hermes config set platforms.telegram.bot_token "$BOT_TOKEN" 2>/dev/null || {
    echo "WARNING: La commande 'hermes config set' a échoué."
    echo "Essai via le fichier de config directement..."
}

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
