# Skill: generate-speech

## Description
Génère un voiceover (synthèse vocale) via ElevenLabs en appelant l'API Automaton `/ai/generate-speech`.

## Quand l'utiliser
Quand le script est validé et qu'on passe à la phase audio du pipeline.

## Paramètres
- `project_id` (requis) : identifiant du projet
- `text` (requis) : le texte à vocaliser (utiliser `version_tts` du script, PAS `version_montage`)
- `output_name` (optionnel, défaut: "voiceover") : nom du fichier audio de sortie
- `voice` (optionnel) : ID de voix ElevenLabs (défaut: selon config)
- `stability` (optionnel, défaut: "natural") : mode de stabilité ("creative", "natural", "robust")

## Appel API
```bash
curl -X POST http://api:3000/ai/generate-speech \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "text": "Tu as déjà dit oui... Sans savoir pourquoi...",
    "output_name": "voiceover"
  }'
```

## Format de réponse
```json
{
  "status": "ok",
  "project_id": "psy_test_001",
  "path": "projects/psy_test_001/assets/voiceover.mp3"
}
```

## Important
- Toujours utiliser la `version_tts` du script (sans annotations [NIVEAU], sans (PAUSE — longue))
- Pour dark-psychology : stability "natural" recommandé pour cohérence sur 10-15 min
- Les pauses longues sont gérées en montage CapCut, pas dans le TTS
