# AGENTS.md — START HERE

> **Lis ce fichier en premier.** Que tu sois un agent IA ou un humain qui découvre le repo,
> ce document te dit en 5 minutes : ce qu'on fait, comment c'est organisé, et ce qu'il ne
> faut SURTOUT pas casser.

---

## 1. C'est quoi Automaton ?

Une **infrastructure d'automatisation IA** auto-hébergée (Docker, sur un droplet DigitalOcean),
qui sert deux grandes familles d'usages :

1. **Création de contenu pour les réseaux sociaux** (thématiques : Music AI, Psychologie, ...),
   avec duplication et adaptation du même contenu sur plusieurs chaînes/plateformes.
2. **Automatisations personnelles** (chatbot WhatsApp, résumé d'emails matinal, ...).

L'objectif long terme : que des **agents** (n8n + Hermes) produisent, optimisent et publient du
contenu, **avec validation humaine à chaque étape sensible**, et une boucle d'amélioration
basée sur les analytics.

---

## 2. Le modèle mental (à connaître absolument)

On sépare **4 couches**. Ne jamais les mélanger.

| Couche | Quoi | Où | Change souvent ? |
|---|---|---|---|
| **Socle (plateforme)** | Docker, n8n, Hermes, Postgres, Redis, API, FFmpeg | `services/`, `docker-compose.yml` | Rarement |
| **Briques (capabilities)** | Générer concept, image, vidéo, publier, **valider (HITL)**, analyser | `workflows/_shared/` | Parfois |
| **Pipelines (thématiques)** | Assemblages de briques : music-ai, psychologie | `workflows/content/*`, `workflows/personal/*` | Souvent |
| **Canaux (diffusion)** | YT/TikTok/FB par compte + langue + brand kit | `workflows/content/_channel-registry.json` | Souvent |

### Concept central : Master → Variantes
Un contenu produit un **master** (script, audio, vidéo, miniature). Une **matrice de
distribution** l'adapte vers N canaux (format 16:9 vs 9:16, langue, ton, hashtags).
**Ajouter une chaîne = ajouter une entrée dans le registre de canaux. PAS de modif des pipelines.**

---

## 3. Qui fait quoi : Hermes vs n8n

- **Hermes = le cerveau + le chef d'orchestre** : raisonnement multi-étapes, navigation web,
  recherche de tendances, analyse de sentiment, réécriture de script, **mémoire persistante**,
  **création de skills**, dialogue multi-canaux (Telegram primaire, WhatsApp secondaire,
  Discord, Slack, Email, HCI). **Hermes déclenche et pilote les workflows n8n** — il peut même
  créer ses propres workflows pertinents en fonction des besoins.
- **n8n = la plomberie / l'exécution déterministe** : cron, webhooks, appels API, files d'attente,
  retries, intégrations. n8n exécute ce qu'Hermes lui demande.
- **Ils se parlent en réseau Docker privé** (`automaton_network`) : n8n appelle
  `http://hermes:8123/v1/...`, Hermes appelle `http://n8n:5678/webhook/...`.
  Détails : `docs/HERMES_INTEGRATION.md` et `docs/HERMES_ROADMAP.md`.

> **Vision** : les workflows `.json` dans `workflows/` sont des **exports legacy** conservés
> pour référence et réutilisation ponctuelle. À terme, Hermes crée et gère ses propres
> workflows n8n de manière autonome.

---

## 4. Validation humaine (Human-in-the-loop)

**Rien de sensible ne se publie sans ton feu vert.** Le canal d'approbation principal est
**Telegram via Hermes** (interface riche, boutons, mémoire, interprétation naturelle des retours).
**WhatsApp** (Green API) est conservé comme **canal secondaire** — les briques existantes
(`tool-hitl-approval`, `tool-hitl-reply-router`) restent fonctionnelles pour les notifications
simples et le fallback.

Hermes interprète les retours au-delà du oui/non (ex : "rends le hook plus court" → feedback
structuré → skill persistant). Chaque pipeline a des **portes** :

```
Idée → [valider concept/script] → Assets → [valider audio/vidéo] → [valider date + canaux] → Publication
```

---

## 5. CE QU'IL NE FAUT PAS CASSER (le droplet tourne en prod)

L'infra tourne actuellement sur le droplet. **Ne touche jamais** sans raison ces éléments,
qui sont montés dans `docker-compose.yml` :

- `docker-compose.yml`, `.env` (secrets)
- `services/` (nginx, api, ffmpeg-worker, hermes, postgres/init)
- `data/`, `projects/`, `backups/`

> **Bonne nouvelle** : le dossier `workflows/` est monté dans n8n **en lecture seule pour
> référence**. n8n exécute réellement depuis sa base Postgres. **Réorganiser, renommer ou
> éditer les `.json` de `workflows/` n'impacte PAS la stack qui tourne.** On peut donc itérer
> librement sur la partie métier.

Pour déployer une modif : `git pull && docker compose up -d --build` (voir `RUNBOOK.md`).

---

## 6. Comment ajouter un truc (cheat sheet)

- **Nouvelle thématique de contenu** → `cp -r workflows/_templates/pipeline-template workflows/content/<nom>` puis remplir `manifest.json`.
- **Nouvelle chaîne/plateforme** → ajouter une entrée dans `workflows/content/_channel-registry.json`.
- **Nouvelle capacité réutilisable** → l'ajouter dans `workflows/_shared/` (et l'y maintenir seule).
- **Nouvelle automatisation perso** → `workflows/personal/<nom>`.
- **Nouveau schéma DB** → l'ajouter dans `services/postgres/init/` (un schéma par thématique).

Conventions détaillées : `docs/CONVENTIONS.md`.

---

## 7. Carte du repo

| Dossier | Rôle |
|---|---|
| `services/` | Code des services Docker (NE PAS déplacer) |
| `workflows/_shared/` | Briques réutilisables |
| `workflows/_templates/` | Squelette + manifest pour nouveaux pipelines |
| `workflows/content/` | Pipelines de contenu social (+ registre de canaux) |
| `workflows/personal/` | Automatisations perso |
| `workflows/domains/` | Autres domaines futurs |
| `docs/` | Architecture, déploiement, conventions, intégration Hermes |
| `scripts/` | setup serveur + backup |
| `RUNBOOK.md` | Procédures opérationnelles (déploiement, troubleshooting) |

Documentation complète : `docs/INDEX.md`.
