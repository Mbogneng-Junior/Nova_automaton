# Skill: generate-image

## Description
Génère une image (cover/thumbnail) en appelant l'API Automaton `/ai/generate-image`.

## Quand l'utiliser
Quand l'utilisateur demande une image pour un projet (cover YouTube, thumbnail TikTok, etc.)

## Paramètres
- `project_id` (requis) : identifiant du projet
- `prompt` (requis) : description de l'image à générer
- `provider` (optionnel) : "leonardo" ou "openai" (défaut: selon config .env)
- `output_name` (optionnel, défaut: "cover") : nom du fichier de sortie
- `width` (optionnel, défaut: 1920) : largeur en pixels
- `height` (optionnel, défaut: 1080) : hauteur en pixels

## Appel API
```bash
curl -X POST http://api:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "prompt": "Dark psychology, shadow manipulation, deep blue and gold, cinematic",
    "width": 1920,
    "height": 1080
  }'
```

## Format de réponse
```json
{
  "status": "ok",
  "project_id": "psy_test_001",
  "path": "projects/psy_test_001/assets/cover.png",
  "provider": "leonardo"
}
```

## Après génération
L'image est stockée dans `projects/<project_id>/assets/<output_name>.png`.
Elle peut être utilisée par le job FFmpeg pour le rendu vidéo.
