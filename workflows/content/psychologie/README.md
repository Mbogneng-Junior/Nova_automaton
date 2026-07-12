# Pipeline Psychologie

Chaîne de contenu **psychologie / dark psychology** : vidéos long-format sur les dynamiques de
pouvoir, la manipulation et la résilience mentale.

## Pipeline

```text
Toi (Telegram) → Hermes
    │
    1. POST /ai/generate-script   (profil: dark-psychology, provider: bedrock)
    2. [HITL] Validation du script via Telegram
    3. POST /ai/generate-image     (cover/miniature)
    4. POST /ai/generate-speech    (voiceover ElevenLabs)
    5. POST /ai/generate-subtitles (Whisper .srt)
    6. POST /jobs/ffmpeg           (render_long → vidéo 16:9)
    7. [HITL] Validation de la vidéo via Telegram
    8. POST /ai/seo                (titres, descriptions, tags)
    9. POST /publish               (youtube dry_run → validation → real)
```

## Profil de contenu

- **Prompt** : `workflows/_shared/prompts/dark-psychology-redacteur.md`
- **Ton** : grave, posé, pédagogique (niveau 1 = inquiétant → niveau 4 = rassurant/empowerant)
- **Durée cible** : 15-20 minutes (≈ 1800-2500 mots)
- **Structure** : hook → intro → 4 niveaux → pause → conclusion → citations

## Canaux

| Canal | Plateforme | Format | Statut |
|---|---|---|---|
| `psychologie-youtube-fr` | YouTube | 16:9, max 900s | planned |
| `psychologie-tiktok-fr` | TikTok | 9:16, max 60s | planned |

## Briques utilisées

Toutes les capacités sont dans `workflows/_shared/` — ce pipeline ne recode rien.

| Étape | Brique | Endpoint API |
|---|---|---|
| Script | `tool-generate-script` | `POST /ai/generate-script` |
| Image | `tool-generate-image` | `POST /ai/generate-image` |
| Voix | `tool-generate-speech` | `POST /ai/generate-speech` |
| Sous-titres | `tool-generate-subtitles` | `POST /ai/generate-subtitles` |
| Rendu | `tool-render-video` | `POST /jobs/ffmpeg` |
| Fact-check | `tool-fact-check` | `POST /ai/fact-check` |
| SEO | `tool-seo` | `POST /ai/seo` |
| Publication | `tool-publish` | `POST /publish` |

## Tests

Voir `TESTING.md` pour les commandes curl de test du pipeline complet.
