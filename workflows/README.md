# Workflows

Ce dossier contient les workflows d'automatisation exécutés par la stack Automaton.

Chaque workflow est un cas d'usage métier indépendant. Il peut définir :
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

## Workflows actuels

- **`music-ai/`** : production musicale automatisée (Suno, Leonardo, YouTube, TikTok, etc.)
- **`workflow-template/`** : squelette pour créer un nouveau workflow

## Ajouter un workflow

1. Copier `workflow-template/` en `mon-workflow/`.
2. Éditer le `README.md` et les templates.
3. Ajouter les prompts dans `prompts/`.
4. Créer les workflows n8n dans l'interface et les exporter dans `n8n/`.
5. Si besoin de traitements spécifiques, ajouter un worker dans `workers/`.

## Bonnes pratiques

- Ne pas stocker de secrets dans ce dossier.
- Garder les templates versionnés et documentés.
- Tester les workflows en local/staging avant production.
- Utiliser `metadata.json` comme contrat commun entre n8n, l'API et les workers.
