# Tests — Pipeline Psychologie

Commandes curl pour tester le pipeline complet sur le droplet.

> Remplacer `DROPLET_IP` par l'IP du serveur ou `localhost` si en local.

## 1. Génération du script

```bash
curl -X POST http://localhost:3000/ai/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "dark-psychology",
    "topic": "Les 5 techniques de manipulation que tout le monde devrait connaître",
    "provider": "bedrock",
    "project_id": "psy_test_001",
    "max_tokens": 4096,
    "temperature": 0.8
  }'
```

## 2. Génération de l'image (cover)

```bash
curl -X POST http://localhost:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "prompt": "Dark psychology concept art, shadow silhouette of a person being manipulated by invisible strings, deep blue and gold tones, cinematic lighting, minimalist composition",
    "output_name": "cover.png",
    "width": 1920,
    "height": 1080
  }'
```

## 3. Génération voiceover (ElevenLabs)

```bash
curl -X POST http://localhost:3000/ai/generate-speech \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "text": "Imaginez que quelqu'un puisse vous faire faire ce qu'il veut sans que vous ne vous en rendiez compte...",
    "output_name": "voiceover"
  }'
```

## 4. Génération sous-titres (Whisper)

```bash
curl -X POST http://localhost:3000/ai/generate-subtitles \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "psy_test_001",
    "audio_path": "assets/voiceover.mp3",
    "language": "fr",
    "output_name": "subtitles"
  }'
```

## 5. Rendu vidéo (FFmpeg)

```bash
curl -X POST http://localhost:3000/jobs/ffmpeg \
  -H "Content-Type: application/json" \
  -d '{
    "task": "render_long",
    "project_id": "psy_test_001",
    "schema": "psychologie",
    "cover_path": "assets/cover.png",
    "audio_path": "assets/voiceover.mp3",
    "output_path": "outputs/video_long.mp4"
  }'
```

## 6. Fact-check

```bash
curl -X POST http://localhost:3000/ai/fact-check \
  -H "Content-Type: application/json" \
  -d '{
    "claims": ["La technique du love bombing est reconnue en psychologie clinique"],
    "profil": "dark-psychology",
    "provider": "bedrock"
  }'
```

## 7. SEO

```bash
curl -X POST http://localhost:3000/ai/seo \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Les 5 techniques de manipulation",
    "platforms": ["youtube", "tiktok"],
    "profil": "dark-psychology",
    "language": "fr",
    "provider": "bedrock"
  }'
```

## 8. Publication (dry-run)

```bash
curl -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "project_id": "psy_test_001",
    "file_path": "outputs/video_long.mp4",
    "title": "5 techniques de manipulation que tout le monde devrait connaître",
    "description": "Découvrez les mécanismes cachés de la manipulation psychologique...",
    "tags": ["psychologie", "manipulation", "dark psychology"],
    "visibility": "private",
    "dry_run": true
  }'
```

## Pipeline complet en une commande

```bash
# Script → Image → Speech → Subtitles → Render → SEO → Publish (dry-run)
# Nécessite jq pour parser les réponses

PROJECT_ID="psy_test_001"
API="http://localhost:3000"

echo "=== 1. Script ==="
SCRIPT=$(curl -s -X POST $API/ai/generate-script -H "Content-Type: application/json" \
  -d "{\"profil\":\"dark-psychology\",\"topic\":\"Les 5 techniques de manipulation\",\"provider\":\"bedrock\",\"project_id\":\"$PROJECT_ID\",\"max_tokens\":4096}")
echo "$SCRIPT" | jq '.status, .project_id'

echo "=== 2. Image ==="
curl -s -X POST $API/ai/generate-image -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"prompt\":\"Dark psychology, shadow manipulation, deep blue and gold\",\"width\":1920,\"height\":1080}" | jq '.status, .path'

echo "=== 3. Speech ==="
curl -s -X POST $API/ai/generate-speech -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"text\":\"Test voiceover for psychologie pipeline\",\"output_name\":\"voiceover\"}" | jq '.status, .path'

echo "=== 4. Subtitles ==="
curl -s -X POST $API/ai/generate-subtitles -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"audio_path\":\"assets/voiceover.mp3\",\"language\":\"fr\"}" | jq '.status, .path'

echo "=== 5. Render ==="
curl -s -X POST $API/jobs/ffmpeg -H "Content-Type: application/json" \
  -d "{\"task\":\"render_long\",\"project_id\":\"$PROJECT_ID\",\"schema\":\"psychologie\",\"cover_path\":\"assets/cover.png\",\"audio_path\":\"assets/voiceover.mp3\"}" | jq '.status, .jobId'

echo "=== 6. SEO ==="
curl -s -X POST $API/ai/seo -H "Content-Type: application/json" \
  -d "{\"topic\":\"Les 5 techniques de manipulation\",\"platforms\":[\"youtube\"],\"profil\":\"dark-psychology\",\"language\":\"fr\",\"provider\":\"bedrock\"}" | jq '.status'

echo "=== 7. Publish (dry-run) ==="
curl -s -X POST $API/publish -H "Content-Type: application/json" \
  -d "{\"platform\":\"youtube\",\"project_id\":\"$PROJECT_ID\",\"file_path\":\"outputs/video_long.mp4\",\"title\":\"5 techniques de manipulation\",\"dry_run\":true}" | jq '.status, .dry_run'
```
