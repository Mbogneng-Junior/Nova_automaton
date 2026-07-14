# Skill: generate-script

## Description
Génère un script vidéo en appelant l'API Automaton `/ai/generate-script`.

## Quand l'utiliser
Quand l'utilisateur demande de générer un script pour un profil donné (dark-psychology, music-ai, actu-ia, etc.)

## Paramètres
- `profil` (requis) : le profil de rédaction (ex: "dark-psychology", "music-ai", "actu-ia")
- `topic` (requis) : le sujet/titre de la vidéo
- `provider` (optionnel, défaut: "bedrock") : provider LLM (bedrock, openai, anthropic, mistral)
- `project_id` (optionnel) : identifiant de projet (généré automatiquement si absent)
- `max_tokens` (optionnel, défaut: 8192) : limite de tokens
- `temperature` (optionnel, défaut: 0.8) : créativité

## Appel API
```bash
curl -X POST http://api:3000/ai/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "dark-psychology",
    "topic": "Les 5 techniques de manipulation",
    "provider": "bedrock",
    "max_tokens": 8192,
    "temperature": 0.8
  }'
```

## Format de réponse
```json
{
  "project_id": "psy_test_001",
  "status": "script_generated",
  "provider": "bedrock",
  "profil": "dark-psychology",
  "script": {
    "titre": "...",
    "emotion_cible": "...",
    "duree_estimee": "12-15 min",
    "version_montage": "Script avec annotations [NIVEAU], (PAUSE)...",
    "version_tts": "Script nettoyé pour ElevenLabs...",
    "reperes_montage": [...],
    "citations_utilisees": [...],
    "seo": {
      "youtube_title": "...",
      "youtube_description": "...",
      "tags": [...],
      "tiktok_hook": "..."
    }
  }
}
```

## Après génération
1. Présenter le script à l'utilisateur pour validation (HITL)
2. Si validé, proposer les étapes suivantes : image → TTS → rendu → publication
3. Si feedback (ex: "hook trop long"), régénérer avec le feedback en contexte

## Profils disponibles
- `dark-psychology` : psychologie sombre, stoïcisme, manipulation (prompt détaillé 14 sections)
- `music-ai` : musique IA électronique
- `actu-ia` : actualité IA
- `default` : fallback générique
