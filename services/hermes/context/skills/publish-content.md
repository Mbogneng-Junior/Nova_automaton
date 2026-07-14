# Skill: publish-content

## Description
Publie une vidéo sur une ou plusieurs plateformes (YouTube, TikTok, Meta) via l'API Automaton `/publish`.

## Quand l'utiliser
Quand la vidéo est rendue et validée par l'utilisateur (HITL obligatoire avant publication).

## Paramètres
- `project_id` (requis) : identifiant du projet
- `platforms` (requis) : liste des plateformes cibles (ex: ["youtube", "tiktok"])
- `dry_run` (optionnel, défaut: true) : mode test (ne publie pas réellement)
- `privacy_status` (optionnel, défaut: "private") : "private", "unlisted", ou "public"

## Appel API
```bash
curl -X POST http://api:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "platforms": ["youtube", "tiktok"],
    "dry_run": true,
    "privacy_status": "private"
  }'
```

## Règles critiques
1. **TOUJOURS** demander la validation de l'utilisateur avant de publier (HITL)
2. **TOUJOURS** démarrer en `dry_run: true` pour vérifier
3. **JAMAIS** publier en "public" sans accord explicite
4. Vérifier que le projet a bien un fichier vidéo rendu avant de publier

## Flow de validation
1. Présenter le projet à publier (titre, plateforme, format)
2. Demander confirmation via Telegram
3. Si oui → publier avec `dry_run: true` d'abord
4. Si dry_run OK → demander confirmation pour publication réelle
5. Si oui → publier avec `dry_run: false`
