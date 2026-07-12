# Pipeline : Music AI

Production musicale automatisée avec IA (Suno, Leonardo, ElevenLabs, YouTube, TikTok).

## Pipeline

```text
Toi (Telegram) → Hermes
    │
    1. POST /ai/generate-script   (profil: music-ai, provider: bedrock)
    2. [HITL] Validation du script via Telegram
    3. Suno API                    (génération audio musical)
    4. POST /ai/generate-image     (cover via Leonardo/OpenAI)
    5. POST /jobs/ffmpeg           (render_long → vidéo 16:9)
    6. POST /jobs/ffmpeg           (render_short → Shorts 9:16)
    7. POST /ai/generate-subtitles (Whisper .srt)
    8. [HITL] Validation de la vidéo via Telegram
    9. POST /ai/seo                (titres, descriptions, tags)
    10. POST /publish              (youtube + tiktok, dry_run → validation → real)
```

> **Note** : Suno est en pause pour le moment. La chaîne psychologie est utilisée pour valider
> le pipeline complet en premier.

## Structure

- `templates/song_metadata.json` : métadonnées d'une track
- `prompts/` : prompts spécifiques music-ai (concept, cover)
- `n8n/` : workflows n8n exportés (legacy — Hermes créera les siens à terme)
- `examples/` : exemples de tracks générées

## Canaux

| Canal | Plateforme | Format | Statut |
|---|---|---|---|
| `music-ai-youtube-fr` | YouTube | 16:9, max 600s | active |
| `music-ai-tiktok-fr` | TikTok | 9:16, max 60s | active |

## Briques utilisées

Toutes les capacités sont dans `workflows/_shared/` — ce pipeline ne recode rien.

Voir `TESTING.md` pour les commandes curl de test.
