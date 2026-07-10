# 🧠 Hermes au centre de l'infrastructure

Ce document explique comment l'agent IA **Hermes**, l'orchestrateur **n8n**, et les bases de données (PostgreSQL, Redis) cohabitent et communiquent au sein de l'infrastructure `Automaton`.

> **Vision actuelle** : Hermes n'est pas seulement un gateway LLM. C'est le **cerveau conversationnel** du système : il reçoit les messages de l'utilisateur, comprend les intentions, déclenche les workflows, apprend des feedbacks et crée des skills réutilisables.
>
> Voir la roadmap complète : [`docs/HERMES_ROADMAP.md`](HERMES_ROADMAP.md).

---

## 🏗️ Architecture Globale (Réseau Docker)

L'entièreté de l'infrastructure repose sur un **réseau privé Docker** nommé `automaton_network`. 
C'est grâce à lui que les containers se parlent **sans jamais passer par internet**, en utilisant simplement le nom de leur service (le `container_name`) comme s'il s'agissait d'un domaine ou d'une adresse IP locale.

```mermaid
graph TD
    subgraph Internet Public
        User((Utilisateur 👨‍💻)) --> |Telegram| TG[Telegram Bot]
        User --> |WhatsApp| WA[WhatsApp Green API]
        User --> |Discord| DC[Discord Bot]
        User --> |Slack| SL[Slack]
        User --> |Email| EM[Email]
        User --> |https://hermes...| NGINX[Nginx Proxy]
    end

    subgraph Automaton Network (100% Privé)
        TG --> H[Hermes Agent]
        WA --> H
        DC --> H
        SL --> H
        EM --> H
        NGINX --> H
        H <--> |Port 8123| N8N[n8n]
        N8N <--> |Port 5432| DB[(PostgreSQL)]
        N8N <--> |Port 6379| R[(Redis)]
        N8N <--> |Port 3000| API[API Node.js]
        H <--> |I/O local| HCI[HCI / TUI]
        H <--> |skills + memory| HH[data/hermes-home]
    end
```

---

## 🎯 Rôle central d'Hermes

Hermes est le point d'entrée privilégié pour :

1. **La conversation** : l'utilisateur parle à Hermes via Telegram, WhatsApp, Discord, Slack, Email ou HCI.
2. **L'intention** : Hermes comprend ce que l'utilisateur veut (générer, valider, critiquer, publier, analyser).
3. **L'action** : Hermes déclenche les workflows n8n, l'API Node, ou les queues Redis.
4. **L'apprentissage** : Hermes crée des skills et met à jour `shared.preferences` à partir des feedbacks.
5. **La mémoire** : Hermes se souvient des projets, des préférences et des conversations passées.

## 🤝 Comment faire dialoguer n8n et Hermes ?

Le grand avantage de cette cohabitation est que **n8n** peut déléguer des tâches cognitives complexes à **Hermes**, et vice versa. 

Puisqu'ils sont sur le même réseau Docker (`automaton_network`), n8n peut appeler l'API de Hermes de manière native.

### Depuis n8n vers Hermes (Délégation d'IA)
Pour demander à Hermes d'analyser un texte, de synthétiser un document, ou d'écrire un script depuis un workflow n8n :

1. Créez un nœud **HTTP Request** dans n8n.
2. Configurez-le ainsi :
   - **Method** : `POST`
   - **URL** : `http://hermes:8123/v1/chat/completions` *(on utilise `hermes` et non l'URL HTTPS car on est en réseau interne !)*
   - **Authentication** : Header API Key → `Authorization: Bearer <votre_API_SERVER_KEY_dans_runbook>`
   - **Body (JSON)**:
     ```json
     {
       "model": "claude",
       "messages": [
         { "role": "user", "content": "Rédige moi un résumé pour ce contenu audio..." }
       ]
     }
     ```

### Depuis Hermes vers n8n (Exécution d'Outils)
Si vous voulez que votre agent conversationnel (Hermes) puisse déclencher un email, écrire dans la DB, ou poster sur les réseaux sociaux lorsqu'il discute avec vous dans l'interface (HCI) :

1. Dans n8n, créez un workflow qui commence par un **Webhook Node** (POST).
2. Notez l'URL interne du webhook (ex: `http://n8n:5678/webhook/mon-action`).
3. Dans Hermes (HCI ou CLI), ajoutez une **Skill** (Compétence HTTP) qui envoie une requête vers `http://n8n:5678/webhook/...`.
4. Désormais, chaque fois que vous demandez à Hermes : *"Poste un résumé du projet X sur Twitter"*, Hermes appellera n8n en interne sans utiliser l'internet externe.

---

## 📡 Canaux de communication supportés

Hermes peut recevoir et envoyer des messages sur plusieurs canaux simultanément :

| Canal | Configuration | Usage dans Automaton |
|---|---|---|
| **Telegram** | Bot token via @BotFather | Interface principale riche (boutons, médias, threads) |
| **WhatsApp** | Green API (déjà en place) | HITL et notifications simples |
| **Discord** | Bot token | Feedback détaillé, debug, canaux thématiques |
| **Slack** | App token | Collaboration équipe, multi-utilisateurs |
| **Signal** | Signal CLI | Échanges sensibles |
| **Email** | SMTP/IMAP | Récapitulifs, rapports hebdomadaires |
| **HCI Web** | `https://hermes...` | Dashboard de configuration et monitoring |
| **CLI / TUI** | `hermes` dans le container | Développement et debug |

> **Principe** : quel que soit le canal, le cerveau reste le même. Un feedback donné sur Telegram est réutilisé si l'utilisateur passe sur WhatsApp la semaine suivante.

## 💾 Cohabitation avec PostgreSQL et Redis

1. **Performances & Mémoire** :
   Chaque container dans le `docker-compose.yml` est bridé en RAM (via la section `deploy.resources.limits`) pour s'assurer que ni Postgres, ni Hermes, ni n8n ne monopolise toute la mémoire du serveur, ce qui le ferait planter aléatoirement.

2. **Volumes Indépendants** :
   L'infrastructure est conçue pour être "Stateless" : l'arrêt brutal du serveur ne corrompra aucune donnée. 
   - La base Postgres est mappée sur le disque host (volume `postgres_data`).
   - Le profil Hermes et HCI sont mappés sur `data/hermes-home`.
   - Les données n8n sur `/data/n8n`.

**Conséquence** : On peut mettre à jour n'importe quel composant de l'infrastructure séparément des autres (`docker compose up -d --build hermes` ne redémarre PAS la base Postgres).

---

## 🔒 Sécurité et Accès

L'orchestration garantit que **seul Nginx est exposé au monde extérieur** (ports 80 et 443).
- **Postgres** (port 5432) est verrouillé au sein du réseau Docker. Vous seul pouvez y accéder via SSH, ou n8n depuis son conteneur.
- **Le Gateway Hermes** (port 8123) est protégé derrière la nécessité du proxy-pass, empêchant quiconque n'ayant pas le mot de passe d'interroger publiquement vos modèles IA avec votre argent !

---

## 💡 Que faire de "Claude Code" dans cette infra ?

**Claude Code** est un excellent outil de terminal (TUI) pensé pour écrire ou comprendre du code via des lignes de commandes.

- **Est-ce indispensable ici ?** 
  Non. L'outil que vous utilisez actuellement (cette interface de chat Agentique via l'IDE Cursor/Gemini) fait **exactement le même travail** (et même plus car elle voit vos fichiers graphiquement). 
- **Cas d'usage potentiel de Claude Code** : L'utiliser *directement depuis le serveur (SSH)* pour faire du débuggage d'urgence directement dans le terminal SSH quand vous êtes hors de votre IDE, sans avoir besoin de coder.

Cependant, ajouter Claude Code directement dans les conteneurs n'a pas beaucoup de sens en production. Si vous voulez l'utiliser, installez-le **sur votre ordinateur de développement**, mais votre agent actuel vous permet déjà de piloter 100% de cette architecture !
