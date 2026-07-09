# 🛠️ Scripts Automaton

Scripts utilitaires pour le déploiement, la maintenance et les tests du système Automaton.

---

## 📋 Liste des scripts

### 🚀 Déploiement & Configuration

#### `setup-server.sh`
Configuration initiale d'un nouveau serveur (droplet DigitalOcean).

```bash
# Sur un nouveau serveur Ubuntu
curl -fsSL https://raw.githubusercontent.com/Mbogneng-Junior/Nova_automaton/master/scripts/setup-server.sh | bash
```

**Ce qu'il fait :**
- Installe Docker & Docker Compose
- Crée l'utilisateur `automaton`
- Clone le dépôt
- Configure les permissions

#### `setup-hermes.sh`
Configuration post-installation de Hermes (modèle IA, HCI, Gateway).

```bash
./scripts/setup-hermes.sh
```

**Ce qu'il fait :**
- Configure le modèle Bedrock Claude
- Crée le compte admin HCI
- Active le Gateway API

---

### 🔐 OAuth & Credentials

#### `get-youtube-token.js`
Obtention interactive du refresh_token YouTube OAuth 2.0.

```bash
# Prérequis
npm install googleapis

# Éditer le script avec tes credentials Google Cloud
nano scripts/get-youtube-token.js
# Remplace CLIENT_ID et CLIENT_SECRET

# Exécuter
node scripts/get-youtube-token.js
```

**Étapes :**
1. Le script affiche une URL d'autorisation
2. Tu visites l'URL et autorises l'application
3. Tu copies le code d'autorisation
4. Le script te donne le refresh_token à mettre dans le .env

**Variables à configurer dans le .env :**
```bash
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
```

---

### 🧪 Tests & Validation

#### `test-api-endpoints.sh`
Tests automatisés de tous les endpoints de l'API.

```bash
# Tests en local
./scripts/test-api-endpoints.sh local

# Tests sur le droplet
./scripts/test-api-endpoints.sh droplet
```

**Ce qu'il teste :**
- Health check
- Plateformes de publication (`/publish/platforms`)
- Publication YouTube en dry_run (`/publish`)
- Génération d'images Leonardo (`/ai/generate-image`)
- Génération d'images OpenAI (`/ai/generate-image`)
- Rendu vidéo FFmpeg (`/ffmpeg/render`)
- Statut FFmpeg worker (`/ffmpeg/status`)

**Sortie :** Résultats JSON formatés avec jq.

#### `check-system-status.sh`
Vérification complète de l'état du système.

```bash
./scripts/check-system-status.sh
```

**Ce qu'il vérifie :**
- État de tous les containers Docker (7 services)
- Connexion PostgreSQL + schémas + tables HITL
- Connexion Redis + queues BullMQ
- Endpoints de l'API
- Hermes Gateway & HCI
- n8n healthcheck
- Variables d'environnement critiques

**Sortie :** Rapport détaillé avec ✅/❌/⚠️ pour chaque composant.

---

### 💾 Backup & Maintenance

#### `backup.sh`
Sauvegarde automatique de la base de données et des configurations.

```bash
# Backup manuel
./scripts/backup.sh

# Backup automatique (cron)
# Ajouter dans crontab : 0 2 * * * /home/automaton/automaton/scripts/backup.sh
```

**Ce qu'il sauvegarde :**
- Base de données PostgreSQL (dump SQL)
- Configurations n8n
- Données Hermes
- Fichier .env (chiffré)

**Destination :** `./backups/` avec timestamp.

---

## 🎯 Workflows typiques

### Premier déploiement sur un nouveau serveur

```bash
# 1. Setup serveur (une seule fois)
curl -fsSL https://raw.githubusercontent.com/.../setup-server.sh | bash

# 2. Configurer .env
cd /home/automaton/automaton
cp .env.example .env
nano .env

# 3. Démarrer les services
docker compose up -d --build

# 4. Configurer Hermes
./scripts/setup-hermes.sh

# 5. Vérifier l'état
./scripts/check-system-status.sh
```

### Déploiement d'une mise à jour

```bash
# 1. Pull les changements
cd /home/automaton/automaton
git pull

# 2. Rebuild les services modifiés
docker compose up -d --build

# 3. Vérifier l'état
./scripts/check-system-status.sh

# 4. Tester les endpoints
./scripts/test-api-endpoints.sh droplet
```

### Configuration YouTube OAuth

```bash
# 1. Sur ta machine locale
cd /path/to/automaton
npm install googleapis
nano scripts/get-youtube-token.js  # Éditer CLIENT_ID/SECRET
node scripts/get-youtube-token.js

# 2. Sur le droplet
nano /home/automaton/automaton/.env  # Ajouter les tokens
docker compose restart api

# 3. Tester
docker exec automaton_api curl -s http://localhost:3000/publish/platforms
```

### Troubleshooting

```bash
# 1. Vérifier l'état complet
./scripts/check-system-status.sh

# 2. Voir les logs d'un service
docker logs --tail 100 automaton_api
docker logs --tail 100 automaton_n8n
docker logs --tail 100 automaton_hermes

# 3. Tester les endpoints
./scripts/test-api-endpoints.sh droplet

# 4. Redémarrer un service
docker compose restart api
docker compose restart n8n

# 5. Rebuild complet
docker compose down
docker compose up -d --build
```

---

## 📝 Notes importantes

### Permissions

Tous les scripts doivent être exécutables :

```bash
chmod +x scripts/*.sh
chmod +x scripts/*.js
```

### Dépendances

- **bash** : Tous les scripts .sh
- **jq** : Pour formater le JSON (test-api-endpoints.sh, check-system-status.sh)
- **Node.js** : Pour get-youtube-token.js
- **Docker** : Pour tous les scripts de déploiement

### Variables d'environnement

Les scripts utilisent les variables du fichier `.env` à la racine du projet.
Ne jamais commiter le `.env` (il contient des secrets).

---

## 🆘 Support

- **Documentation complète** : `../DEPLOYMENT_GUIDE.md`
- **Runbook opérationnel** : `../RUNBOOK.md`
- **TODO structuré** : `../TODO.md`
- **Quick Start** : `../QUICK_START.md`

---

## 🔄 Maintenance des scripts

### Ajouter un nouveau script

1. Créer le fichier dans `scripts/`
2. Ajouter le shebang : `#!/bin/bash` ou `#!/usr/bin/env node`
3. Rendre exécutable : `chmod +x scripts/nouveau-script.sh`
4. Documenter ici dans ce README
5. Tester en local puis sur le droplet

### Conventions

- **Noms** : kebab-case (ex: `check-system-status.sh`)
- **Sortie** : Utiliser des emojis pour la lisibilité (✅ ❌ ⚠️ 📦 🔍)
- **Erreurs** : Utiliser `set -e` pour arrêter sur erreur
- **Documentation** : Commenter les sections importantes