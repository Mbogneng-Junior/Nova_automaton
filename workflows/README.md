# Workflows

Ce dossier contient les workflows d'automatisation exécutés par la stack Automaton.

## Organisation de haut niveau

```
workflows/
├── _shared/         # Briques réutilisables par TOUS les pipelines (publication, validation, rendu...)
├── _templates/      # Template unique et officiel pour créer un pipeline
│   └── pipeline-template/  # Squelette + manifest.template.json + TESTING.md template
├── content/         # Création de contenu réseaux sociaux
│   ├── _channel-registry.json   # Registre des canaux (YT/TikTok/FB) + brand kit
│   ├── music-ai/
│   └── psychologie/
├── personal/        # Automatisations personnelles
│   └── chatbot/
└── domains/         # Autres domaines à venir
```

> **Références n8n** : les exemples de workflows n8n collectés comme documentation
> sont dans `docs/references/n8n-workflow-examples/`, pas dans `workflows/`.

> **Règle clé** : un pipeline n'a PAS le droit de recoder une capacité déjà dans `_shared/`.
> Voir `docs/CONVENTIONS.md` et `AGENTS.md` à la racine.

Chaque pipeline est un cas d'usage métier indépendant. Il peut définir :
- ses templates de données,
- ses prompts,
- ses règles métier,
- ses connecteurs n8n (exportables en JSON),
- ses workers spécifiques (si nécessaire).

## Structure d'un workflow

```
workflows/<workflow-name>/
├── README.md                 # Description du workflow
├── templates/                # Templates de métadonnées par contenu
├── prompts/                  # Prompts système et exemples
├── n8n/                      # Workflows n8n exportés (.json)
├── workers/                  # Workers spécifiques (optionnel)
└── examples/                 # Exemples de sortie générée
```

## Pipelines actuels

- **`content/music-ai/`** : production musicale automatisée (Suno, Leonardo, YouTube, TikTok, etc.)
- **`content/psychologie/`** : chaîne psychologie / dark psychology (script → image → TTS → FFmpeg → publish)
- **`personal/chatbot/`** : chatbot WhatsApp personnel (Bedrock Claude)
- **`_templates/pipeline-template/`** : squelette pour créer un nouveau pipeline

> **Note** : les workflows `.json` dans ce dossier sont des **exports legacy** conservés pour
> référence et réutilisation ponctuelle. À terme, Hermes crée et gère ses propres workflows n8n
> de manière autonome. n8n exécute réellement depuis sa base Postgres, pas depuis ces fichiers.

## Ajouter un pipeline

1. `cp -r workflows/_templates/pipeline-template workflows/content/mon-pipeline`.
2. Copier `manifest.template.json` en `manifest.json` et le remplir.
3. Éditer le `README.md`, les `prompts/` et les `templates/`.
4. Écrire les tests curl dans `TESTING.md`.
5. Construire les workflows dans n8n, puis les exporter dans `n8n/` (legacy).
6. Réutiliser les briques de `_shared/` (ne pas recoder).
7. Déclarer les canaux dans `content/_channel-registry.json`.

## Bonnes pratiques

- Ne pas stocker de secrets dans ce dossier.
- Garder les templates versionnés et documentés.
- Tester les workflows en local/staging avant production.
- Utiliser `metadata.json` comme contrat commun entre n8n, l'API et les workers.
