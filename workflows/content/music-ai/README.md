# Workflow : Music AI

Production musicale automatisée avec IA.

## Pipeline

1. Idée depuis Google Sheet / Notion
2. Génération de concept (OpenAI GPT-4o)
3. Génération audio (Suno API)
4. Stockage (S3 / Cloudinary)
5. Génération cover (Leonardo AI)
6. Rendu vidéo longue (FFmpeg)
7. Découpage en Shorts (FFmpeg)
8. Sous-titres (Whisper)
9. Upload (YouTube, TikTok, Instagram)
10. Analytics Loop

## Structure

- `templates/song_metadata.json` : métadonnées d'une track
- `prompts/` : prompts de génération
- `n8n/` : workflows n8n exportés
- `examples/` : exemples de tracks générées

## Distributeurs musicaux

- DistroKid
- TuneCore

## Notes

- Vérifier les CGU commerciales de chaque outil IA.
- Prévoir un fallback si Suno n'est pas disponible.
