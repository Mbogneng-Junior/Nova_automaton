# Automaton

Stack d'automatisation de contenus IA, modulaire et réutilisable.

La musique IA est le premier cas pratique, mais la structure est conçue pour accueillir plusieurs workflows (vidéo, blog, newsletter, social media, etc.).

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

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Guide workflows](workflows/README.md)

## Démarrage rapide

```bash
# 1. Créer le repo GitHub (voir docs/DEPLOYMENT.md)
# 2. Configurer le serveur
ssh root@TON_IP
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TON_COMPTE/automaton/main/scripts/setup-server.sh)"

# 3. Cloner sur le droplet
ssh automaton@TON_IP
git clone https://github.com/TON_COMPTE/automaton.git /home/automaton/automaton
cd /home/automaton/automaton

# 4. Configurer
cp .env.example .env
nano .env

# 5. Certificat SSL (voir docs/DEPLOYMENT.md)

# 6. Lancer
docker-compose up -d
```

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

## Créer un nouveau workflow

```bash
cp -r workflows/workflow-template workflows/mon-nouveau-workflow
# Éditer workflows/mon-nouveau-workflow/README.md
# Ajouter prompts, templates, workflows n8n
```

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

## Prochaines étapes

1. Créer le repo GitHub et pousser le code.
2. Déployer sur le droplet.
3. Connecter OpenAI, Suno, Leonardo dans n8n.
4. Valider le workflow `music-ai` end-to-end.
5. Ajouter un deuxième workflow.

## Note

Le warning de schéma `package.json` dans l'IDE est un problème de connexion au schema store. J'ai ajouté un champ `$schema` correct ; si le warning persiste, il ne bloque pas le build.
