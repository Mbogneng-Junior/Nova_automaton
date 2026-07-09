# 🤖 Automaton - NeureNova

Infrastructure d'automatisation IA auto-hébergée pour la création de contenu et les automatisations personnelles.

> **Nouveau ?** Commence par lire [`AGENTS.md`](AGENTS.md) pour comprendre l'architecture en 5 minutes.

## 🎯 Objectif

Produire, optimiser et publier du contenu sur les réseaux sociaux **avec validation humaine à chaque étape sensible**, et une boucle d'amélioration basée sur les analytics.

**Deux grandes familles d'usages :**
1. **Création de contenu social** (Music AI, Psychologie...) avec distribution multi-canaux
2. **Automatisations personnelles** (chatbot WhatsApp, résumés emails...)

## Structure du projet

```
.
├── docker-compose.yml          # Orchestration complète
├── .env.example                # Modèle de variables d'environnement
├── .env                        # Fichier de secrets (non versionné)
├── services/                   # Services partagés
│   ├── nginx/                  # Reverse proxy + SSL
│   ├── api/                    # API métier Node.js + BullMQ
│   └── ffmpeg-worker/          # Worker FFmpeg Python
├── workflows/                  # Workflows métier
│   ├── README.md
│   ├── music-ai/               # Production musicale IA
│   └── workflow-template/      # Squelette pour nouveaux workflows
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
├── scripts/                    # Scripts serveur
│   ├── setup-server.sh
│   └── backup.sh
├── data/                       # Volumes Docker
├── backups/                    # Backups quotidiens
└── projects/                   # Fichiers générés au runtime
```

## Stack déployée

- **n8n** : orchestration des workflows
- **PostgreSQL** : base de données n8n + analytics
- **Redis** : queue BullMQ
- **API Node.js** : endpoints métiers pour FFmpeg, upload, analytics
- **FFmpeg worker** : rendu vidéo, Shorts, sous-titres
- **Nginx + Certbot** : HTTPS, reverse proxy

## Workflows inclus

- **`music-ai`** : génération de tracks IA, covers, vidéos, Shorts, upload et analytics.

## 📚 Documentation

### 🚀 Démarrage
- **[developement/QUICK_START.md](developement/QUICK_START.md)** - Déploiement rapide (15-20 min)
- **[developement/DEPLOYMENT_GUIDE.md](developement/DEPLOYMENT_GUIDE.md)** - Guide complet en 5 phases
- **[RUNBOOK.md](RUNBOOK.md)** - Procédures opérationnelles

### 📖 Référence
- **[AGENTS.md](AGENTS.md)** - Architecture & modèle mental (START HERE)
- **[TODO.md](TODO.md)** - Checklist de déploiement
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Architecture technique détaillée
- **[docs/CONVENTIONS.md](docs/CONVENTIONS.md)** - Conventions de code
- **[docs/HERMES_INTEGRATION.md](docs/HERMES_INTEGRATION.md)** - Intégration Hermes Agent
- **[docs/INDEX.md](docs/INDEX.md)** - Index de toute la documentation

### 🛠️ Workflows & Scripts
- **[workflows/README.md](workflows/README.md)** - Organisation des workflows
- **[workflows/_shared/HITL.md](workflows/_shared/HITL.md)** - Validation humaine (WhatsApp)
- **[scripts/README.md](scripts/README.md)** - Scripts de déploiement et tests

## ⚡ Démarrage rapide

### Tu as déjà le droplet configuré ?

```bash
# 1. Pull les dernières modifications
cd /home/automaton/automaton
git pull

# 2. Rebuild l'API
docker compose up -d --build api

# 3. Vérifier l'état
./scripts/check-system-status.sh

# 4. Tester les endpoints
./scripts/test-api-endpoints.sh droplet
```

**Voir [QUICK_START.md](QUICK_START.md) pour le guide complet.**

### Premier déploiement ?

```bash
# 1. Setup serveur (une seule fois)
ssh root@TON_IP
curl -fsSL https://raw.githubusercontent.com/Mbogneng-Junior/Nova_automaton/master/scripts/setup-server.sh | bash

# 2. Cloner et configurer
ssh automaton@TON_IP
cd /home/automaton/automaton
cp .env.example .env
nano .env  # Remplir les secrets

# 3. Lancer
docker compose up -d --build

# 4. Configurer Hermes
./scripts/setup-hermes.sh
```

**Voir [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) pour le guide détaillé.**

## Commandes utiles

```bash
# Logs
docker-compose logs -f n8n
docker-compose logs -f api
docker-compose logs -f ffmpeg-worker

# Redémarrer
docker-compose restart n8n

# Mise à jour
docker-compose pull && docker-compose up -d

# Backup
./scripts/backup.sh

# Nettoyer les volumes (ATTENTION : suppression des données)
docker-compose down -v
```

## 🧪 Scripts utiles

```bash
# Vérifier l'état complet du système
./scripts/check-system-status.sh

# Tester tous les endpoints API
./scripts/test-api-endpoints.sh droplet

# Obtenir le token YouTube OAuth
node scripts/get-youtube-token.js

# Backup de la base de données
./scripts/backup.sh
```

**Voir [scripts/README.md](scripts/README.md) pour la liste complète.**

## 🏗️ Créer un nouveau workflow

```bash
# Copier le template
cp -r workflows/_templates/pipeline-template workflows/content/mon-workflow

# Copier et remplir le manifest
cp workflows/_templates/manifest.template.json workflows/content/mon-workflow/manifest.json

# Éditer le README et les prompts
nano workflows/content/mon-workflow/README.md
```

**Voir [docs/CONVENTIONS.md](docs/CONVENTIONS.md) pour les conventions.**

## Sécurité

- Ne jamais commiter `.env`.
- Changer les mots de passe par défaut.
- Accès SSH par clé uniquement.
- UFW + Fail2ban activés par le script de setup.
- Utiliser un gestionnaire de secrets en production.

## Coûts estimés Phase 1

- DigitalOcean droplet : ~$24/mois
- APIs IA : ~$30-50/mois
- Stockage S3/Cloudinary : ~$5-15/mois
- Distribution musicale : ~$22/an
- **Total : ~$66-91/mois**

## 🎯 État actuel du projet

### ✅ Fonctionnalités déployées
- Infrastructure Docker complète (7 services)
- n8n orchestrateur avec workflows music-ai
- Hermes Agent (Bedrock Claude) avec HCI
- API métier avec endpoints FFmpeg, publication, génération d'images
- Validation humaine (HITL) via WhatsApp
- Base de données PostgreSQL avec schémas par workflow
- Redis + BullMQ pour les queues

### 🚧 En cours de déploiement
- Configuration OAuth YouTube pour publication réelle
- Import des 5 workflows partagés dans n8n
- Tests complets des nouveaux endpoints
- Câblage du reply-router HITL

**Voir [TODO.md](TODO.md) pour la checklist complète.**

## 🌐 URLs des services

| Service | URL |
|---------|-----|
| n8n Workflows | https://n8n.automaton.neurenova.tech |
| Hermes HCI | https://hermes.automaton.neurenova.tech |
| API Métier | http://
:3000 (interne) |

## 🆘 Support

- **Problème de déploiement ?** → [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) section Troubleshooting
- **Service qui ne démarre pas ?** → [RUNBOOK.md](RUNBOOK.md) section Troubleshooting
- **Question sur l'architecture ?** → [AGENTS.md](AGENTS.md) ou [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 📝 Licence

Propriétaire - NeureNova © 2026
