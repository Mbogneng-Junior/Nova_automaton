# Validation humaine (HITL) — Telegram via Hermes (primaire) + WhatsApp (secondaire)

> **Architecture cible** : le HITL passe par **Hermes** (Telegram primaire). Les briques
> WhatsApp/Green API ci-dessous sont conservées comme **canal secondaire** pour les
> notifications simples et le fallback. À terme, Hermes gère le HITL de manière autonome
> avec mémoire, interprétation naturelle des retours, et création de skills.

## Canaux HITL

| Canal | Rôle | Statut |
|---|---|---|
| **Telegram via Hermes** | Interface principale riche (boutons, médias, mémoire, feedback structuré) | Cible |
| **WhatsApp (Green API)** | Notifications simples, fallback | Livré (briques ci-dessous) |

---

## Briques WhatsApp (canal secondaire — legacy)

Brique réutilisable permettant à **n'importe quel pipeline** de demander ta validation sur
WhatsApp et de **mettre l'exécution en pause** jusqu'à ta réponse. Rien ne se publie sans ton
feu vert.

## Pourquoi 2 workflows + une table

n8n exécute chaque sous-workflow dans son propre contexte, et la réponse WhatsApp arrive sur un
webhook **séparé** de l'exécution mise en pause. Il faut donc un point de rendez-vous partagé :
la table `shared.hitl_approvals` (Postgres).

```
Pipeline ──appelle──> tool-hitl-approval
                         │ 1. envoie le draft sur WhatsApp
                         │ 2. INSERT pending (chat_id, resume_url) en base
                         │ 3. PAUSE (Wait node) ............................┐
                                                                           │
Toi (WhatsApp) ──réponds "OUI" / "non" / "change le titre"──> webhook agent│
                         │ appelle tool-hitl-reply-router                  │
                         │ 1. retrouve la demande pending pour ton chat_id │
                         │ 2. interprète ta réponse                        │
                         │ 3. POST resume_url ─────────────────────────────┘ (reprise)
                         │ 4. UPDATE status=approved/rejected/revise
Pipeline <──reçoit { decision, feedback, approved }── (reprend)
```

## Installation (une fois)

### 1. Appliquer le schéma SQL sur la base de PROD

Les scripts de `services/postgres/init/` ne tournent que sur une base vierge. Sur le droplet :

```bash
docker exec -i automaton_postgres psql -U postgres -d automaton \
  < services/postgres/init/03-shared-hitl.sql
```

### 2. Importer les 2 workflows dans n8n

- `workflows/_shared/n8n/tool-hitl-approval.json`
- `workflows/_shared/n8n/tool-hitl-reply-router.json`

### 3. Configurer le credential Postgres

Dans chaque nœud Postgres, sélectionne ton credential (host `postgres`, db `automaton`,
user `postgres`). Le placeholder `REPLACE_POSTGRES_CRED_ID` sera remplacé automatiquement
quand tu choisis le credential dans l'UI.

## Utilisation dans un pipeline

### A. Demander une validation

Ajoute un nœud **Execute Sub-workflow** pointant vers `Tool: HITL Approval (WhatsApp)` avec :

| Input | Exemple |
|---|---|
| `chat_id` | `237657185475@c.us` |
| `instance` | `1` (music-ai) ou `2` (perso) |
| `project_id` | `song_001` |
| `theme` | `music-ai` |
| `step` | `concept` |
| `title` | `Valider le concept ?` |
| `body` | le script / résumé à valider |
| `options` | `Réponds OUI pour valider, NON pour annuler, ou écris tes corrections.` |

Le nœud **ne rend la main qu'après ta réponse**, avec en sortie :
`{ decision: "approved" | "rejected" | "revise", feedback: "...", approved: true|false }`.

### B. Router tes réponses (dans le webhook de l'agent)

Dans le workflow qui reçoit déjà tes messages WhatsApp (ex: l'agent music-ai sur l'instance 1),
**tout en haut**, appelle `Tool: HITL Reply Router` avec `chat_id` + `text`.

- S'il renvoie `matched: true` → ta réponse était une validation : **stoppe** le traitement normal.
- S'il renvoie `matched: false` → message normal : continue le flux habituel de l'agent.

> Mots-clés reconnus : `oui/ok/valide/publie/go` → approuvé ; `non/annule/stop` → rejeté ;
> tout autre texte → `revise` avec ton texte comme `feedback`.

## Notes

- **Timeout** : le Wait node peut rester en pause longtemps. Pense à un nettoyage périodique
  des lignes `pending` trop vieilles (`status='expired'`).
- **Sécurité** : seuls les numéros de `MUSIC_AI_AUTHORIZED_NUMBERS` / `CHATBOT_AUTHORIZED_NUMBERS`
  doivent pouvoir valider — fais ce contrôle dans le webhook avant d'appeler le router.
