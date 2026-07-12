# Tests — [Nom du pipeline]

Commandes curl pour tester le pipeline complet sur le droplet.

> Remplacer `localhost` par l'IP du serveur si test à distance.

## 1. Génération du script

```bash
curl -X POST http://localhost:3000/ai/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "<profil>",
    "topic": "<sujet>",
    "provider": "bedrock",
    "project_id": "<project_id>",
    "max_tokens": 4096
  }'
```

## 2. Génération de l'image

```bash
curl -X POST http://localhost:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "prompt": "<prompt image>",
    "width": 1920,
    "height": 1080
  }'
```

## 3. Génération voiceover

```bash
curl -X POST http://localhost:3000/ai/generate-speech \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "text": "<texte>",
    "output_name": "voiceover"
  }'
```

## 4. Sous-titres

```bash
curl -X POST http://localhost:3000/ai/generate-subtitles \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "audio_path": "assets/voiceover.mp3",
    "language": "fr"
  }'
```

## 5. Rendu vidéo

```bash
curl -X POST http://localhost:3000/jobs/ffmpeg \
  -H "Content-Type: application/json" \
  -d '{
    "task": "render_long",
    "project_id": "<project_id>",
    "schema": "<schema>",
    "cover_path": "assets/cover.png",
    "audio_path": "assets/voiceover.mp3"
  }'
```

## 6. Fact-check

```bash
curl -X POST http://localhost:3000/ai/fact-check \
  -H "Content-Type: application/json" \
  -d '{
    "claims": ["<claim>"],
    "profil": "<profil>",
    "provider": "bedrock"
  }'
```

## 7. SEO

```bash
curl -X POST http://localhost:3000/ai/seo \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "<sujet>",
    "platforms": ["youtube", "tiktok"],
    "profil": "<profil>",
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
    "project_id": "<project_id>",
    "file_path": "outputs/video_long.mp4",
    "title": "<titre>",
    "dry_run": true
  }'
```
