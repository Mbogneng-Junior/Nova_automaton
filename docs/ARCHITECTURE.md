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
- PostgreSQL : workflows, logs, analytics.
- Redis : queues.
- S3 / Cloudinary : stockage distant.

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
