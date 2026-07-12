# Pipeline Template

Squelette **unique et officiel** pour créer un nouveau pipeline (thématique de contenu ou automatisation perso).

## Comment l'utiliser

```bash
# Exemple : créer la thématique "psychologie"
cp -r workflows/_templates/pipeline-template workflows/content/psychologie
```

Puis :
1. Renseigner `manifest.json` (à partir de `manifest.template.json` inclus).
2. Décrire le cas d'usage dans `README.md`.
3. Ajouter les prompts dans `prompts/` (ou utiliser ceux de `_shared/prompts/`).
4. Ajouter les templates de métadonnées dans `templates/`.
5. Construire les workflows dans n8n, puis les exporter dans `n8n/` (legacy — Hermes créera les siens à terme).
6. Réutiliser les briques de `workflows/_shared/` au lieu de recoder la logique.
7. Déclarer les canaux ciblés dans `workflows/content/_channel-registry.json`.
8. Écrire les commandes curl de test dans `TESTING.md`.

## Structure attendue (obligatoire)

```
mon-pipeline/
├── manifest.json        # contrat: triggers, briques, gates, env, canaux
├── README.md            # ce que fait le pipeline (humain)
├── TESTING.md           # commandes curl de test du pipeline complet
├── prompts/             # prompts système spécifiques (ou utiliser _shared/prompts/)
├── templates/           # templates de métadonnées (contrat n8n <-> API)
├── n8n/                 # workflows n8n exportés (.json) — legacy, Hermes créera les siens
└── examples/            # exemples de sortie générée (optionnel)
```

## Manifest — champs obligatoires

| Champ | Description |
|---|---|
| `id` | Identifiant unique du pipeline |
| `theme` | Thématique (`music-ai`, `psychologie`, ...) |
| `category` | `content` \| `personal` \| `domains` |
| `status` | `draft` \| `active` \| `deprecated` |
| `triggers` | Comment le pipeline démarre (`hermes`, `webhook`, `cron`) |
| `uses_bricks` | Briques `_shared/` réutilisées |
| `approval_gates` | Portes de validation HITL (canal + obligation) |
| `channels` | IDs des canaux dans `_channel-registry.json` |
| `env_required` | Variables d'environnement nécessaires |

## Règles d'or

- **Ne recode jamais** une capacité déjà présente dans `_shared/` (publication, validation, rendu...).
- **Toute publication passe par une porte de validation** (voir `approval_gates` du manifest).
- **Aucun secret** dans ce dossier : tout va dans `.env`.
- **Hermes-first** : le trigger principal doit être `hermes` (Telegram). Webhook/cron = fallback.
- **Approval gates sur Telegram** via Hermes (WhatsApp = fallback secondaire).
