# Architecture

Automaton est une stack d'automatisation de contenus IA, conçue pour être modulaire et réutilisable au-delà de la musique.

## Vue d'ensemble

```
Source d'idées (Sheet, Notion, Webhook)
         |
         v
    +---------+
    |   n8n   |  <-- Orchestrateur
    +---------+
         |
    +----+----+----+
    |         |    |
    v         v    v
 OpenAI    Suno   Leonardo
    |         |    |
    v         v    v
 S3/Cloudinary  API métier
    |              |
    v              v
 FFmpeg Worker   Upload Workers
    |              |
    +------+-------+
           |
           v
    Plateformes (YT, TT, IG, Spotify)
           |
           v
    Analytics Loop
```

## Couches

### 1. Orchestration : n8n

- Déclenche les workflows selon un cron ou un webhook.
- Lit les sources de données.
- Appelle les APIs IA et les services internes.
- Surveille les queues de jobs.

### 2. API métier : Node.js + BullMQ

- Endpoints REST pour créer des jobs (`/jobs/ffmpeg`, `/jobs/upload`, `/jobs/analytics`).
- Gère les queues Redis.
- Centralise les secrets et les connecteurs.

### 3. Workers : FFmpeg, upload, analytics

- Traitements lourds isolés de n8n.
- Scalables horizontalement.

### 4. Stockage

- `projects/` : fichiers générés (audio, covers, vidéos).
- PostgreSQL : base de données **partagée**, avec **un schéma par workflow**.
- Redis : queue partagée pour tous les workflows.
- S3 / Cloudinary : stockage distant.

### Base de données multi-schema

- Une seule base `automaton`.
- Chaque workflow a son propre schéma PostgreSQL : `music_ai`, `workflow_template`, etc.
- Les tables d'analytics et de logs sont isolées par workflow.
- Avantages :
  - Backup unique de la base.
  - Permissions et isolation simples.
  - Possibilité de requêtes cross-schema si nécessaire.
- L'API expose `POST /analytics/:schema/events` pour stocker des événements dans le bon schéma.

### 5. Workflows

- Définis dans `workflows/<name>/`.
- Chaque workflow a ses templates, prompts et règles.

## Modularité

L'ajout d'un nouveau workflow ne nécessite pas de modifier la stack.
Il suffit de :
1. Créer un dossier dans `workflows/`.
2. Ajouter les prompts et templates.
3. Créer les workflows n8n.
4. Utiliser les services existants si besoin.

## Sécurité

- Secrets dans `.env` uniquement.
- n8n protégé par basic auth.
- HTTPS via Nginx + Certbot.
- UFW + Fail2ban sur le serveur.
