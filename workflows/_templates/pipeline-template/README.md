# Pipeline Template

Squelette standard pour créer un nouveau pipeline (thématique de contenu ou automatisation perso).

## Comment l'utiliser

```bash
# Exemple : créer la thématique "psychologie"
cp -r workflows/_templates/pipeline-template workflows/content/psychologie
```

Puis :
1. Renseigner `manifest.json` (copié depuis `workflows/_templates/manifest.template.json`).
2. Décrire le cas d'usage dans ce `README.md`.
3. Ajouter les prompts dans `prompts/`.
4. Ajouter les templates de métadonnées dans `templates/`.
5. Construire les workflows dans n8n, puis les exporter dans `n8n/`.
6. Réutiliser les briques de `workflows/_shared/` au lieu de recoder la logique.
7. Déclarer les canaux ciblés dans `workflows/content/_channel-registry.json`.

## Structure attendue

```
mon-pipeline/
├── manifest.json        # contrat: triggers, briques, gates, env, canaux
├── README.md            # ce que fait le pipeline (humain)
├── prompts/             # prompts système / exemples
├── templates/           # templates de métadonnées (contrat n8n <-> API)
├── n8n/                 # workflows n8n exportés (.json)
└── TESTING.md           # commandes curl de test
```

## Règle d'or

- **Ne recode jamais** une capacité déjà présente dans `_shared/` (publication, validation, rendu...).
- **Toute publication passe par une porte de validation** (voir `approval_gates` du manifest).
- **Aucun secret** dans ce dossier : tout va dans `.env`.
