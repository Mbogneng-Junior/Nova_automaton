# Hermes Agent — Service Docker

Hermes Agent installé dans un container Ubuntu 22.04 avec Chromium/Playwright pour browser automation.

## Architecture

- **hermes** : Agent IA + Gateway (port 8123)
- **hermes-hci** : Dashboard web HCI (port 10274)
- **nginx** : Reverse proxy HTTPS `hermes.automaton.neurenova.tech`

## Fichiers

| Fichier | Rôle |
|---------|------|
| `Dockerfile` | Build Hermes avec deps système |
| `entrypoint.sh` | Lance `hermes gateway` ou attend config |

## Première installation

```bash
# Depuis la racine du projet Automaton
cd /home/automaton/automaton

# 1. Prérequis swap (si pas déjà fait)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# 2. Ajouter les variables dans .env
# HERMES_PROVIDER=nous
# HERMES_HCI_PASSWORD=ton_mot_de_passe

# 3. Build et démarrage
./scripts/setup-hermes.sh

# 4. CONFIGURATION OBLIGATOIRE (premier run)
docker exec -it automaton_hermes bash
hermes model
# → Choisir Nous Portal (OAuth) ou OpenAI/Anthropic (API key)
# → Quitter le container

# 5. Redémarrer pour activer
docker compose restart hermes

# 6. Accès
# Dashboard HCI : https://hermes.automaton.neurenova.tech
# Gateway API   : http://127.0.0.1:8123
```

## Désinstallation complète

```bash
docker compose rm -s -f hermes hermes-hci
docker compose down
sudo rm -rf data/hermes data/hermes-hci
# Les images Docker restent : `docker rmi automaton-hermes automaton-hermes-hci`
```

## Ressources allouées

| Service | RAM max | CPU |
|---------|---------|-----|
| hermes | 1G | illimité |
| hermes-hci | 512M | illimité |
