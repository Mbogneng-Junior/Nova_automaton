# Skill: pipeline-orchestrator

## Description
Orchestre le pipeline complet de création de contenu : script → image → TTS → sous-titres → rendu → publication.

## Quand l'utiliser
Quand l'utilisateur demande de créer une vidéo complète de bout en bout.

## Étapes du pipeline

### 1. Génération du script
```
POST http://api:3000/ai/generate-script
{ profil, topic, provider: "bedrock", max_tokens: 8192 }
```
→ Présenter le script pour validation (HITL)

### 2. Génération de l'image (cover)
```
POST http://api:3000/ai/generate-image
{ project_id, prompt: "description visuelle basée sur le thème" }
```

### 3. Génération du voiceover (TTS)
```
POST http://api:3000/ai/generate-speech
{ project_id, text: script.version_tts, output_name: "voiceover" }
```
→ Présenter l'audio pour validation (HITL)

### 4. Génération des sous-titres
```
POST http://api:3000/ai/generate-subtitles
{ project_id, audio_name: "voiceover" }
```

### 5. Rendu vidéo (FFmpeg)
```
POST http://api:3000/jobs/ffmpeg
{ project_id, template: "dark-psychology", cover_path, audio_path, subtitles_path }
```
→ Attendre la completion du job (poll status)

### 6. Fact-check (optionnel)
```
POST http://api:3000/ai/fact-check
{ project_id, script: script.version_montage }
```

### 7. SEO
```
POST http://api:3000/ai/seo
{ project_id, platforms: ["youtube", "tiktok"] }
```

### 8. Publication (HITL obligatoire)
```
POST http://api:3000/publish
{ project_id, platforms, dry_run: true }
```
→ Validation utilisateur → dry_run: false

## Profils supportés
- `dark-psychology` : psychologie sombre (10-20 min, ElevenLabs v3, double version montage/TTS)
- `music-ai` : musique IA électronique
- `actu-ia` : actualité IA

## Règles
- Chaque étape sensible (script, audio, publication) nécessite une validation humaine
- Si l'utilisateur rejette une étape, régénérer avec le feedback intégré
- Créer un skill persistant après chaque pipeline réussi (capitaliser les préférences)
