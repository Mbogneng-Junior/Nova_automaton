# Guide de tests — Automaton (A à Z)

Ce guide est chronologique. Chaque phase suppose que la précédente est passée.  
Tous les tests se font **sur le droplet** (SSH), sauf mention contraire.

---

## Pré-requis de lecture

- `API_URL` = `http://localhost:3000` (depuis l'intérieur des containers)
- `EXEC` = `curl -s -X`
- Un test réussi retourne un JSON sans champ `error` au premier niveau.
- Si un test échoue → consulter les logs : `docker logs --tail 50 automaton_api`

---

## Phase 0 — Déploiement du nouveau code

```bash
# 1. Récupérer le code
cd /home/automaton/automaton
git pull

# 2. Rebuild l'API (seul service modifié)
docker compose up -d --build api

# 3. Attendre ~10s que l'API démarre, vérifier
docker logs --tail 20 automaton_api
# Attendu en fin de log :
#   Automaton API running on port 3000
#   Upload worker started (queue:upload)
#   Analytics worker started (queue:analytics)

# 4. Appliquer le nouveau schéma PostgreSQL (table video_analytics)
docker exec -i automaton_postgres psql -U postgres -d automaton \
  < services/postgres/init/05-shared-analytics.sql
# Attendu : CREATE TABLE (ou "already exists" si réexécuté)
```

### Vérifier que toutes les tables existent

```bash
docker exec automaton_postgres psql -U postgres -d automaton -c "\dt shared.*"
```

Attendu — les 3 tables doivent apparaître :

```
 shared | hitl_approvals    | table | ...
 shared | raw_items         | table | ...
 shared | themes_traites    | table | ...
 shared | video_analytics   | table | ...
```

---

## Phase 1 — Santé de l'infrastructure

### 1.1 Tous les containers tournent

```bash
./scripts/check-system-status.sh
```

Attendu : `7/7 services actifs` (nginx, n8n, postgres, redis, api, ffmpeg-worker, hermes).

### 1.2 API répond

```bash
curl -s http://localhost:3000/health | jq .
```

Attendu :
```json
{ "status": "ok", "timestamp": "...", "database": { ... } }
```

### 1.3 Redis répond

```bash
docker exec automaton_redis redis-cli ping
```

Attendu : `PONG`

### 1.4 Les workers sont enregistrés dans Redis

```bash
docker exec automaton_redis redis-cli KEYS "bull:*" | sort
```

Attendu : des clés `bull:ffmpeg:*`, `bull:upload:*`, `bull:analytics:*` (au moins les méta de chaque queue).

---

## Phase 2 — Variables d'environnement critiques

Vérifier que les clés nécessaires sont bien définies dans le `.env` du droplet, **avant** de tester les endpoints qui en dépendent.

```bash
docker exec automaton_api env | grep -E "OPENAI|ANTHROPIC|DEEPSEEK|MISTRAL|SUNO|LEONARDO|ELEVENLABS|YOUTUBE|TIKTOK|META|PEXELS|PIXABAY|UNSPLASH|CLOUDINARY|S3" | sort
```

| Variable | Requise pour | Bloquante si absente ? |
|---|---|---|
| `OPENAI_API_KEY` | Génération texte/image/Whisper/SEO | Oui |
| `ANTHROPIC_API_KEY` | Fact-check, rédaction Dark Psychology/Documentaire | Oui |
| `DEEPSEEK_API_KEY` | Veille/scoring | Non (fallback openai) |
| `MISTRAL_API_KEY` | Analyse & sélection | Non (fallback openai) |
| `SUNO_API_KEY` | Génération musique | Oui (phase 7) |
| `LEONARDO_API_KEY` | Génération image | Oui si provider=leonardo |
| `ELEVENLABS_API_KEY` | Génération voix | Oui (phase 8) |
| `YOUTUBE_CLIENT_ID` + `SECRET` + `REFRESH_TOKEN` | Publication YouTube réelle | Oui (phase 12) |
| `TIKTOK_ACCESS_TOKEN` + `TIKTOK_CLIENT_KEY` | Publication TikTok | Oui (phase 12) |
| `META_ACCESS_TOKEN` + `INSTAGRAM_ACCOUNT_ID` | Publication Meta | Oui (phase 12) |
| `PEXELS_API_KEY` | Stock search | Non (autres sources en fallback) |
| `PIXABAY_API_KEY` | Stock search | Non |
| `UNSPLASH_ACCESS_KEY` | Stock search | Non |
| `CLOUDINARY_CLOUD_NAME/KEY/SECRET` | Upload Cloudinary | Non (si cloudinary_upload=false) |

---

## Phase 3 — Génération de texte (LLM)

### 3.1 OpenAI

```bash
curl -s -X POST http://localhost:3000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","prompt":"Réponds juste : ok","max_tokens":10}' | jq .
```

Attendu : `{ "text": "ok", ... }`

### 3.2 Anthropic

```bash
curl -s -X POST http://localhost:3000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","prompt":"Réponds juste : ok","max_tokens":10}' | jq .
```

### 3.3 DeepSeek (si clé définie)

```bash
curl -s -X POST http://localhost:3000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","prompt":"Réponds juste : ok","max_tokens":10}' | jq .
```

### 3.4 Mistral (si clé définie)

```bash
curl -s -X POST http://localhost:3000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"provider":"mistral","prompt":"Réponds juste : ok","max_tokens":10}' | jq .
```

---

## Phase 4 — Génération de script (Agent Rédacteur)

### 4.1 Script profil actu-ia

```bash
curl -s -X POST http://localhost:3000/ai/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "actu-ia",
    "topic": "GPT-5 vient de sortir",
    "provider": "openai"
  }' | jq '{project_id, status, profil, provider, parse_error: .script.parse_error}'
```

Attendu : `status: "script_generated"`, `parse_error` absent ou `false`.

### 4.2 Script profil dark-psychology (Claude)

```bash
curl -s -X POST http://localhost:3000/ai/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "dark-psychology",
    "topic": "La manipulation par le silence",
    "provider": "anthropic",
    "max_tokens": 2048
  }' | jq '{project_id, status, profil, provider}'
```

### 4.3 Vérifier le fichier metadata.json créé

```bash
# Récupérer le project_id du test 4.1, ex: dark-psychology_1234567890
docker exec automaton_api ls /app/projects/ | tail -5
# Lire le fichier
docker exec automaton_api cat /app/projects/<project_id>/metadata.json | jq '{profil, provider, script_keys: (.script | keys)}'
```

---

## Phase 5 — Fact-checking

### 5.1 Affirmation vraie

```bash
curl -s -X POST http://localhost:3000/ai/fact-check \
  -H "Content-Type: application/json" \
  -d '{
    "claims": ["ChatGPT a été lancé par OpenAI en novembre 2022"],
    "profil": "actu-ia",
    "provider": "anthropic"
  }' | jq '{block_publication, results: [.results[] | {status, confidence, block_publication}]}'
```

Attendu : `block_publication: false`, `status: "confirmed"` ou `"unconfirmed"`.

### 5.2 Affirmation fausse (doit bloquer)

```bash
curl -s -X POST http://localhost:3000/ai/fact-check \
  -H "Content-Type: application/json" \
  -d '{
    "claims": ["Elon Musk a fondé OpenAI et en reste PDG en 2025"],
    "profil": "documentaire",
    "provider": "anthropic"
  }' | jq '{block_publication, results: [.results[] | {status, confidence, block_publication}]}'
```

Attendu : `block_publication: true` (profil documentaire + statut non confirmé bloque).

---

## Phase 6 — SEO

```bash
curl -s -X POST http://localhost:3000/ai/seo \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Les 5 techniques de manipulation psychologique les plus utilisées",
    "profil": "dark-psychology",
    "platforms": ["youtube", "tiktok"],
    "language": "fr",
    "provider": "openai"
  }' | jq '{status, profil, seo: {titles: .seo.titles, hashtags: .seo.hashtags}}'
```

Attendu : `status: "ok"`, `titles` = tableau de 3 éléments, `hashtags` présents.

---

## Phase 7 — Génération musicale (Suno)

> Coûte des crédits Suno. Attendre ~2 minutes.

```bash
curl -s -X POST http://localhost:3000/ai/generate-music \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "prompt": "dark ambient orchestral, cinematic, no vocals, tension",
    "model_version": "V4"
  }' | jq '{status, path, task_id}'
```

Attendu : `status: "completed"`, `path: "assets/audio.mp3"`.

```bash
# Vérifier que le fichier existe
docker exec automaton_api ls -lh /app/projects/test_music_001/assets/
```

---

## Phase 8 — Génération voix (ElevenLabs)

```bash
curl -s -X POST http://localhost:3000/ai/generate-speech \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "text": "Bienvenue dans ce test de génération de voix automatisée.",
    "output_name": "voiceover_test"
  }' | jq '{status, path, voice_id, model_id}'
```

Attendu : `status: "completed"`, `path: "assets/voiceover_test.mp3"`.

---

## Phase 9 — Génération d'image

### 9.1 Leonardo AI

```bash
curl -s -X POST http://localhost:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "prompt": "dark psychology, chiaroscuro lighting, human silhouette, dramatic shadows",
    "provider": "leonardo",
    "width": 1024,
    "height": 1024,
    "output_name": "cover_leo.png"
  }' | jq '{status, provider, path, image_url}'
```

### 9.2 OpenAI DALL-E

```bash
curl -s -X POST http://localhost:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "prompt": "abstract AI music studio, neon lights",
    "provider": "openai",
    "output_name": "cover_dalle.png"
  }' | jq '{status, provider, path}'
```

### 9.3 Stock-first (Pexels/Pixabay/Unsplash en priorité)

```bash
curl -s -X POST http://localhost:3000/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "prompt": "dramatic shadows psychology",
    "stock_first": true,
    "output_name": "cover_stock.png"
  }' | jq '{status, provider, path}'
```

Attendu : `provider` = `"pexels"`, `"pixabay"` ou `"unsplash"` si une source est configurée, sinon fallback vers l'IA.

### 9.4 Recherche stock seule

```bash
curl -s \
  "http://localhost:3000/media/stock?query=dark+psychology+shadows&per_page=3" \
  | jq '{count, results: [.results[] | {source, id, photographer}]}'
```

Attendu : `count >= 1` si au moins une clé stock est définie.

---

## Phase 10 — Génération sous-titres (Whisper)

> Requiert un fichier audio dans le projet. On utilise celui créé en phase 8.

```bash
curl -s -X POST http://localhost:3000/ai/generate-subtitles \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "audio_path": "assets/voiceover_test.mp3",
    "language": "fr",
    "output_name": "subtitles_test"
  }' | jq '{status, path}'
```

Attendu : `status: "completed"`, `path: "assets/subtitles_test.srt"`.

```bash
# Vérifier le contenu du .srt
docker exec automaton_api cat /app/projects/test_music_001/assets/subtitles_test.srt | head -10
```

---

## Phase 11 — Montage vidéo (FFmpeg)

> Requiert audio + image dans le projet. Les phases 7 et 9 doivent être passées.

### 11.1 Rendu long (16:9)

```bash
curl -s -X POST http://localhost:3000/jobs/ffmpeg \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "task": "render_long",
    "cover_path": "assets/cover_leo.png",
    "audio_path": "assets/audio.mp3",
    "output_path": "outputs/video_long.mp4"
  }' | jq '{id, status}'
```

Attendu : `status: "queued"`, un `id` de job.

```bash
# Vérifier les logs du ffmpeg-worker (attendre ~30s)
docker logs --tail 20 automaton_ffmpeg_worker
```

```bash
# Vérifier que la vidéo existe
docker exec automaton_api ls -lh /app/projects/test_music_001/outputs/
```

### 11.2 Burn subtitles

```bash
curl -s -X POST http://localhost:3000/jobs/ffmpeg \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "task": "burn_subtitles",
    "video_path": "outputs/video_long.mp4",
    "subtitle_path": "assets/subtitles_test.srt",
    "output_path": "outputs/video_subtitled.mp4"
  }' | jq '{id, status}'
```

---

## Phase 12 — Contrôle Qualité (ffprobe)

```bash
curl -s -X POST http://localhost:3000/ai/quality-check \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_music_001",
    "file_path": "outputs/video_long.mp4",
    "profil": "actu-ia"
  }' | jq '{status, ok, duration_sec, bitrate_bps, issues, video: {codec: .video.codec, width: .video.width, height: .video.height}}'
```

Attendu : `ok: true`, `issues: []`, `codec: "h264"`, `width: 1920`, `height: 1080`.

Si `ok: false` → lire le tableau `issues` pour identifier le problème avant de passer à la publication.

---

## Phase 13 — HITL (validation humaine)

> Requiert que les workflows n8n `tool-hitl-approval` et `tool-hitl-reply-router` soient importés et activés (voir TODO.md Phase 3).

### 13.1 Vérifier que la table hitl_approvals est vide ou consultable

```bash
docker exec automaton_postgres psql -U postgres -d automaton \
  -c "SELECT id, theme, step, status, created_at FROM shared.hitl_approvals ORDER BY created_at DESC LIMIT 5;"
```

### 13.2 Test de flux complet (depuis n8n)

1. Ouvrir `https://n8n.automaton.neurenova.tech`
2. Déclencher manuellement un workflow qui contient un nœud `tool-hitl-approval`
3. Vérifier la réception du message WhatsApp sur le numéro autorisé
4. Répondre `oui` depuis WhatsApp
5. Vérifier que la ligne passe à `status = 'approved'` :

```bash
docker exec automaton_postgres psql -U postgres -d automaton \
  -c "SELECT id, step, status, decision, resolved_at FROM shared.hitl_approvals ORDER BY created_at DESC LIMIT 3;"
```

---

## Phase 14 — Publication

> **Toujours commencer en `dry_run: true`.** Ne passer à `dry_run: false` qu'après avoir vérifié chaque étape.

### 14.1 Lister les plateformes activées

```bash
curl -s http://localhost:3000/publish/platforms | jq .
```

Attendu :
```json
{
  "supported": ["youtube", "tiktok", "meta"],
  "enabled": ["youtube", "tiktok", "meta"],
  "dry_run_default": true
}
```

### 14.2 Dry-run YouTube

```bash
curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "project_id": "test_music_001",
    "file_path": "outputs/video_long.mp4",
    "title": "Test Automaton — Dark Psychology",
    "description": "Vidéo de test générée par Automaton.",
    "tags": ["test", "automaton"],
    "visibility": "private",
    "dry_run": true
  }' | jq .
```

Attendu : `status: "dry_run"`, `would_publish.title` = ton titre.

### 14.3 Dry-run TikTok

```bash
curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "tiktok",
    "project_id": "test_music_001",
    "video_url": "https://exemple.com/video.mp4",
    "title": "Test TikTok",
    "dry_run": true
  }' | jq .
```

### 14.4 Dry-run Meta

```bash
curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "meta",
    "project_id": "test_music_001",
    "video_url": "https://exemple.com/video.mp4",
    "title": "Test Instagram Reel",
    "dry_run": true
  }' | jq .
```

### 14.5 Publication YouTube réelle (async)

> Uniquement si `YOUTUBE_REFRESH_TOKEN` est configuré et `PUBLISH_DRY_RUN=false`.

```bash
# D'abord, désactiver le dry_run global
# Dans .env : PUBLISH_DRY_RUN=false  puis  docker compose restart api

curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "project_id": "test_music_001",
    "file_path": "outputs/video_long.mp4",
    "title": "Test Automaton [PRIVÉ]",
    "description": "Test de publication réelle.",
    "visibility": "private",
    "dry_run": false,
    "async": true
  }' | jq '{status, job_id}'
```

Attendu : `status: "queued"`, un `job_id`.

```bash
# Surveiller le worker upload
docker logs --tail 30 automaton_api | grep "upload worker"
```

### 14.6 Publication TikTok réelle

> Requiert `TIKTOK_ACCESS_TOKEN` (valide 24h) + une URL publique Cloudinary ou S3.

```bash
curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "tiktok",
    "video_url": "https://res.cloudinary.com/<ton-cloud>/video/upload/test.mp4",
    "title": "Test TikTok Automaton #test",
    "visibility": "self_only",
    "dry_run": false,
    "async": true
  }' | jq '{status, job_id}'
```

### 14.7 Publication Meta (Instagram Reels) réelle

> Requiert `META_ACCESS_TOKEN` + `INSTAGRAM_ACCOUNT_ID` + URL publique.

```bash
curl -s -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "meta",
    "video_url": "https://res.cloudinary.com/<ton-cloud>/video/upload/test.mp4",
    "title": "Test Reel Automaton",
    "description": "Test de publication Instagram via Automaton. #test",
    "dry_run": false,
    "async": true
  }' | jq '{status, job_id}'
```

---

## Phase 15 — Analytics

> À déclencher ~48h après une vraie publication YouTube. En test immédiat, utilise un `video_id` d'une vidéo existante sur ta chaîne.

### 15.1 Enqueue un job analytics

```bash
curl -s -X POST http://localhost:3000/jobs/analytics \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "TON_VIDEO_ID_YOUTUBE",
    "project_id": "test_music_001",
    "profil": "actu-ia"
  }' | jq '{id, status}'
```

### 15.2 Vérifier la collecte

```bash
# Attendre ~5s puis consulter la table
docker exec automaton_postgres psql -U postgres -d automaton \
  -c "SELECT video_id, views, likes, comments, collected_at FROM shared.video_analytics ORDER BY collected_at DESC LIMIT 5;"
```

```bash
# Vérifier que metadata.json a été mis à jour
docker exec automaton_api cat /app/projects/test_music_001/metadata.json | jq '.analytics'
```

---

## Phase 16 — Veille & tracking de contenu

### 16.1 Insérer un item de veille

```bash
curl -s -X POST http://localhost:3000/content/raw-items \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "actu-ia",
    "source": "rss",
    "source_url": "https://exemple.com/article-gpt5",
    "external_id": "gpt5-launch-2025",
    "title": "OpenAI lance GPT-5",
    "summary": "GPT-5 est disponible avec des capacités multimodales améliorées.",
    "language": "fr"
  }' | jq '{status, id}'
```

### 16.2 Lister les items en attente

```bash
curl -s \
  "http://localhost:3000/content/raw-items?profil=actu-ia&status=pending&limit=5" \
  | jq '{count, items: [.items[] | {id, title, source, status}]}'
```

### 16.3 Marquer un item comme sélectionné

```bash
# Remplacer <ID> par l'id retourné en 16.1
curl -s -X PATCH http://localhost:3000/content/raw-items/<ID> \
  -H "Content-Type: application/json" \
  -d '{"status": "selected", "project_id": "test_music_001"}' | jq .
```

### 16.4 Enregistrer un thème traité

```bash
curl -s -X POST http://localhost:3000/content/themes \
  -H "Content-Type: application/json" \
  -d '{
    "profil": "dark-psychology",
    "theme": "manipulation-silence",
    "label": "La manipulation par le silence",
    "project_id": "test_music_001"
  }' | jq '{status, id}'
```

### 16.5 Vérifier qu'un thème déjà traité remonte

```bash
curl -s \
  "http://localhost:3000/content/themes?profil=dark-psychology" \
  | jq '{count, items: [.items[] | {theme, label, use_count, last_used_at}]}'
```

---

## Phase 17 — Test du script de validation global (optionnel)

Le script existant n'est pas à jour avec tous les nouveaux endpoints.  
Après avoir validé toutes les phases manuellement, mettre à jour `scripts/test-api-endpoints.sh` :

```bash
# Vérifier la liste des endpoints reconnus
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3000/publish/platforms | jq .
curl -s "http://localhost:3000/media/stock?query=test" | jq '{count}'
curl -s "http://localhost:3000/content/raw-items?profil=actu-ia&limit=1" | jq '{count}'
```

---

## Récapitulatif des résultats attendus

| Phase | Ce qui est testé | Signe de succès |
|---|---|---|
| 0 | Déploiement + SQL | `4 tables` dans `shared.*`, log `Analytics worker started` |
| 1 | Infrastructure | `7/7` services actifs, `/health` → `ok` |
| 2 | Variables d'env | Clés visibles dans `env` |
| 3 | LLM texte | `text` présent dans la réponse pour chaque provider |
| 4 | Agent Rédacteur | `status: script_generated`, `metadata.json` créé |
| 5 | Fact-checking | `block_publication: false` sur vraie info, `true` sur fausse |
| 6 | SEO | `titles` (3 items), `hashtags` présents |
| 7 | Suno | `status: completed`, fichier `audio.mp3` sur disque |
| 8 | ElevenLabs | `status: completed`, fichier `.mp3` sur disque |
| 9 | Image (Leonardo/OpenAI/stock) | `status: completed`, fichier `.png` sur disque |
| 10 | Whisper | `status: completed`, fichier `.srt` lisible |
| 11 | FFmpeg | Fichier `video_long.mp4` sur disque, logs worker OK |
| 12 | Contrôle Qualité | `ok: true`, `issues: []`, codec h264, 1920x1080 |
| 13 | HITL | Ligne `approved` dans `shared.hitl_approvals` |
| 14 | Publication | Dry-run toutes plateformes OK ; YouTube réel visible dans Studio |
| 15 | Analytics | Ligne dans `shared.video_analytics`, `metadata.analytics` rempli |
| 16 | Veille | Items dans `shared.raw_items`, thème dans `shared.themes_traites` |

---

## En cas d'erreur

| Symptôme | Où chercher | Commande |
|---|---|---|
| API ne répond pas | Logs API | `docker logs --tail 50 automaton_api` |
| Worker analytics crashe | Logs API (les workers tournent dans le même process) | `docker logs --tail 50 automaton_api \| grep analytics` |
| FFmpeg échoue | Logs ffmpeg-worker | `docker logs --tail 50 automaton_ffmpeg_worker` |
| Erreur LLM 401 | Clé API manquante ou expirée | Vérifier `.env` + `docker compose restart api` |
| TikTok 401 | Token expiré (durée 24h) | Regénérer `TIKTOK_ACCESS_TOKEN` et `docker compose restart api` |
| Meta : container en erreur | Processing failed | Vérifier que `video_url` est accessible publiquement |
| Table inexistante | SQL non appliqué | Relancer la commande `psql` de la phase 0 |
| `/ai/quality-check` — ffprobe not found | ffprobe absent du container API | Le Dockerfile installe ffmpeg — vérifier `docker exec automaton_api ffprobe -version` |
