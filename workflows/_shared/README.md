# _shared — Briques réutilisables

Ce dossier contient les **capacités transversales** : des sous-workflows n8n et conventions
réutilisés par TOUS les pipelines (music-ai, psychologie, perso...).

> **Principe** : une capacité = une brique = un seul endroit à maintenir.
> Si tu corriges un bug de publication YouTube ici, tous les pipelines en profitent.

## Briques prévues

| Brique (fichier n8n) | Rôle | Type |
|---|---|---|
| `tool-generate-concept` | Génère un concept music-ai via l'API `/ai/generate-concept` | LLM |
| `tool-generate-script` ✅ | Génère un script **multi-profil** via `/ai/generate-script` (prompts versionnés) | LLM |
| `tool-generate-image` ✅ | Génère une cover/miniature, **multi-fournisseur** (Leonardo / OpenAI) | Image |
| `tool-generate-speech` ✅ | Génère une voix off via **ElevenLabs** | Audio |
| `tool-generate-subtitles` ✅ | Génère des sous-titres `.srt` via **OpenAI Whisper** | Audio |
| `tool-render-video` ✅ | Met en file un job FFmpeg (long-form + shorts + sous-titres) | Queue |
| `tool-hitl-approval` ✅ | **Validation humaine** : envoie un draft sur WhatsApp et met en pause jusqu'à réponse | HITL |
| `tool-hitl-reply-router` ✅ | Retrouve la demande en attente et reprend l'exécution quand tu réponds | HITL |
| `tool-publish` ✅ | Publie sur YouTube/TikTok/Meta avec **dry_run par défaut** | Publication |
| `tool-analyze-trends` | Recherche de tendances (délègue à Hermes) | Agent |
| `tool-analyze-performance` | Analyse rétention/sentiment + propose des ajustements | Agent |
| `tool-fact-check` | Vérification croisée via LLM (`/ai/fact-check`) | QA |
| `tool-seo` | Titres/descriptions/tags par plateforme (`/ai/seo`) | SEO |
| `tool-quality-check` | Inspection `ffprobe` + conformité par profil (`/ai/quality-check`) | QA |

> Les fichiers `.json` sont des **exports n8n** versionnés. La source de vérité d'exécution
> reste la base Postgres de n8n. Voir `docs/CONVENTIONS.md`.

> ✅ = livré. Guide de câblage de la validation humaine : **[`HITL.md`](HITL.md)**.

## Contrat d'une brique

Chaque brique est un **sub-workflow n8n** appelable par un autre workflow :
- **Entrée** : un objet JSON documenté en tête du fichier.
- **Sortie** : un objet JSON documenté (statut + données).
- **Idempotence** : rejouable sans dupliquer (utiliser une clé de projet `project_id`).
- **Pas de secret en dur** : tout via variables d'environnement n8n / credentials.

## Publication multi-plateforme

`tool-publish` (workflow `tool-publish.json`) appelle l'API `POST http://api:3000/publish`.

- **Plateformes supportées** : `youtube`, `tiktok`, `meta` (Facebook/Instagram). Chacune a son
  provider dans le registre `publishProviders` côté API.
- **Activation / désactivation** : `PUBLISH_PLATFORMS_ENABLED=youtube,tiktok,meta` dans `.env`.
- **Sécurité** : `PUBLISH_DRY_RUN=true` par défaut — le endpoint ne publie pas réellement,
  il retourne seulement un aperçu de ce qui serait publié. Pour passer en vrai mode, envoie
  `dry_run: false` dans l'appel ET/OU mets `PUBLISH_DRY_RUN=false` dans `.env`.
- **YouTube** : nécessite `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
- **TikTok** : Content Posting API v2. Préfère `video_url` (Cloudinary/S3) ; upload direct chunké en fallback.
  Variables : `TIKTOK_CLIENT_KEY`, `TIKTOK_ACCESS_TOKEN`.
- **Meta / Instagram Reels** : Graph API v19, 2 étapes (container + publish). Nécessite `video_url` publique.
  Variables : `META_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID`.
- **Vérifier l'état** : `GET http://api:3000/publish/platforms` → `{ supported, enabled, dry_run_default }`.

## Génération de script multi-profil

`tool-generate-script` (workflow `tool-generate-script.json`) appelle `POST http://api:3000/ai/generate-script`.

- **Principe** : le prompt système n'est pas codé en dur. Il est lu dans
  `workflows/_shared/prompts/<profil>-redacteur.md`.
- **Profils livrés** : `actu-ia`, `dark-psychology`, `documentaire`, `sport`, `music-ai`, `default`.
- **Endpoint** : `POST /ai/generate-script` `{ profil, topic?, context?, provider?, model?, max_tokens?, temperature?, project_id? }`.
- **Sortie** : JSON structuré selon le profil + stockage dans `projects/<id>/metadata.json`.
- **Legacy** : `/ai/generate-concept` est refactoré pour utiliser le même moteur avec le profil `music-ai`.

Ajouter un profil = ajouter un fichier `<profil>-redacteur.md` + appeler l'endpoint avec `profil=<profil>`.

## Stock media (Pexels / Pixabay / Unsplash)

L'Agent Média peut privilégier le stock libre avant de générer une image IA.

- **Endpoint recherche** : `GET http://api:3000/media/stock?query=...&sources=pexels,pixabay&per_page=5`.
- **Activation** : `STOCK_PROVIDERS_ENABLED=pexels,pixabay,unsplash` dans `.env`.
- **Variables** : `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY`.
- **Intégration génération IA** : `POST /ai/generate-image` accepte `stock_first: true` et
  `cloudinary_upload: true` pour uploader automatiquement le résultat sur Cloudinary.

## Fact-checking

- **Endpoint** : `POST http://api:3000/ai/fact-check` `{ claims: [...], profil?, provider? }`.
- **Provider par défaut** : `FACT_CHECK_PROVIDER=anthropic`.
- **Sortie** : JSON `{ status, confidence, reasoning, sources_needed, block_publication }` par claim.
- **Règle documentaire** : `block_publication: true` si le statut n'est pas `confirmed` pour un profil `documentaire`.

## SEO

- **Endpoint** : `POST http://api:3000/ai/seo` `{ topic?, script?, platforms?, profil?, language?, provider? }`.
- **Provider par défaut** : `SEO_PROVIDER=openai`.
- **Sortie** : 3 variantes de titre + metadata par plateforme (YouTube, TikTok, Instagram) + top hashtags.

## Contrôle Qualité

- **Endpoint** : `POST http://api:3000/ai/quality-check` `{ project_id, file_path, profil? }`.
- **Outil** : `ffprobe` (inclus dans l'image Docker API via `apk add ffmpeg`).
- **Vérifications** : durée dans les bornes du profil, présence des flux audio/vidéo, bitrate, codecs.

## Worker Analytics

`queue:analytics` collecte automatiquement les métriques d'une vidéo YouTube ~48h après publication.

- **Endpoint de mise en file** : `POST http://api:3000/jobs/analytics` `{ project_id, video_id, profil? }`.
- **Sources** : YouTube Data API (views/likes/comments) + YouTube Analytics API (rétention).
- **Stockage** : `shared.video_analytics` (`services/postgres/init/05-shared-analytics.sql`).

## Génération audio & sous-titres

### Voix off — `tool-generate-speech`

- **Endpoint** : `POST http://api:3000/ai/generate-speech` `{ project_id, text, voice_id?, model_id?, output_name? }`.
- **Fournisseur** : ElevenLabs (`xi-api-key`).
- **Variables** : `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`.
- **Sortie** : `projects/<id>/assets/<output_name>.mp3` (défaut `voiceover.mp3`).

### Sous-titres — `tool-generate-subtitles`

- **Endpoint** : `POST http://api:3000/ai/generate-subtitles` `{ project_id, audio_path, language?, output_name? }`.
- **Fournisseur** : OpenAI Whisper.
- **Variable** : `WHISPER_MODEL` (défaut `whisper-1`).
- **Sortie** : `projects/<id>/assets/<output_name>.srt` (défaut `subtitles.srt`).

## Publication asynchrone

`tool-publish` supporte maintenant `async: true`. Dans ce cas, le job est poussé dans la file
Redis `queue:upload` et traité par le **worker upload** intégré à l'API. Cela évite de bloquer
n8n pendant un upload YouTube long.

- **Mode synchrone** : `dry_run: true/false` → réponse immédiate.
- **Mode asynchrone** : `async: true, dry_run: false` → réponse `{ status: 'queued', job_id }`.

## Génération d'images multi-fournisseur

`tool-generate-image` n'est pas verrouillé sur Leonardo. L'abstraction est côté API
(`services/api`, registre `imageProviders`, comme `aiProviders` pour le texte).

- **Endpoint** : `POST http://api:3000/ai/generate-image` `{ project_id, prompt, provider?, output_name?, width?, height? }`.
- **Choix du fournisseur** : param `provider` de l'appel > `IMAGE_PROVIDER` (.env) > premier activé.
- **Activer/désactiver** : `IMAGE_PROVIDERS_ENABLED=leonardo,openai` dans `.env` (aucune modif de code).
- **Fournisseurs supportés** : `leonardo`, `openai` (DALL·E). En ajouter un = une fonction dans
  `imageProviders` côté API.
- **Vérifier l'état** : `GET http://api:3000/ai/image-providers` → `{ supported, enabled, default }`.

> Le sous-workflow produit le fichier dans `projects/<id>/assets/<output_name>` (défaut `cover.png`)
> et met à jour `metadata.assets`. Idéal pour alimenter `cover_path` de `tool-render-video`.

## n8n — bonne pratique JSON (rappel critique)

Toujours **pré-stringifier** le JSON dans un nœud Code avant un HTTP Request node,
jamais d'expression inline avec des guillemets dynamiques. Voir
`workflows/content/music-ai/n8n/TROUBLESHOOTING.md`.
