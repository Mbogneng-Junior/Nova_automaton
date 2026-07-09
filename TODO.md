# TODO — Actions à faire (suivi)

Suivi des actions manuelles (souvent sur le droplet) et des prochaines briques.
Coche `[x]` une fois fait.

---

## 📚 Ressources de déploiement créées

- ✅ **DEPLOYMENT_GUIDE.md** : Guide complet de déploiement en 5 phases
- ✅ **scripts/check-system-status.sh** : Vérification de l'état du système
- ✅ **scripts/test-api-endpoints.sh** : Tests automatisés des endpoints API
- ✅ **scripts/get-youtube-token.js** : Obtention du refresh_token YouTube OAuth

---

## 🚀 Phase 1: Rebuild & Déploiement de l'API

- [ ] **1.1** Rebuild l'API sur le droplet :
  ```bash
  cd /home/automaton/automaton
  docker compose up -d --build api
  ```
- [ ] **1.2** Vérifier que l'API démarre correctement :
  ```bash
  docker logs --tail 50 automaton_api
  docker ps | grep automaton_api
  ```
- [ ] **1.3** Tester les nouveaux endpoints :
  ```bash
  ./scripts/test-api-endpoints.sh droplet
  ```

---

## 🔐 Phase 2: Configuration OAuth YouTube

- [ ] **2.1** Créer/vérifier le projet Google Cloud Console
- [ ] **2.2** Activer l'API YouTube Data v3
- [ ] **2.3** Créer les credentials OAuth 2.0 (Desktop app)
- [ ] **2.4** Obtenir le refresh_token :
  ```bash
  # Sur ta machine locale
  cd /home/mbogneng-junior/Documents/art/Creation_contenus/Automaton
  npm install googleapis
  node scripts/get-youtube-token.js
  ```
- [ ] **2.5** Ajouter les variables dans le .env du droplet :
  ```bash
  nano /home/automaton/automaton/.env
  # Ajouter:
  # YOUTUBE_CLIENT_ID=...
  # YOUTUBE_CLIENT_SECRET=...
  # YOUTUBE_REFRESH_TOKEN=...
  # PUBLISH_DRY_RUN=true
  # IMAGE_PROVIDER=leonardo
  ```
- [ ] **2.6** Redémarrer l'API :
  ```bash
  docker compose restart api
  ```

---

## 📥 Phase 3: Import des workflows n8n

Accéder à https://n8n.automaton.neurenova.tech et importer :

- [ ] **3.1** `workflows/_shared/n8n/tool-publish.json`
- [ ] **3.2** `workflows/_shared/n8n/tool-generate-script.json`
- [ ] **3.3** `workflows/_shared/n8n/tool-generate-image.json`
- [ ] **3.4** `workflows/_shared/n8n/tool-generate-speech.json`
- [ ] **3.5** `workflows/_shared/n8n/tool-generate-subtitles.json`
- [ ] **3.6** `workflows/_shared/n8n/tool-render-video.json`
- [ ] **3.7** `workflows/_shared/n8n/tool-hitl-approval.json`
- [ ] **3.8** `workflows/_shared/n8n/tool-hitl-reply-router.json`
- [ ] **3.9** Activer tous les workflows importés

---

## 🗄️ Phase 4: Schémas SQL partagés (HITL + Content tracking)

- [ ] **4.1** Appliquer le schéma HITL sur la prod :
  ```bash
  cd /home/automaton/automaton
  docker exec -i automaton_postgres psql -U postgres -d automaton \
    < services/postgres/init/03-shared-hitl.sql
  ```
- [ ] **4.2** Appliquer le schéma de content tracking sur la prod :
  ```bash
  cd /home/automaton/automaton
  docker exec -i automaton_postgres psql -U postgres -d automaton \
    < services/postgres/init/04-shared-content-tracking.sql
  ```
- [ ] **4.3** Vérifier que les tables ont été créées :
  ```bash
  docker exec -it automaton_postgres psql -U postgres -d automaton \
    -c "\dt shared.*"
  ```

## 🤖 Phase 5: Configuration HITL (Human-in-the-loop)

- [ ] **5.1** Vérifier que les tables HITL ont été créées :
  ```bash
  docker exec -it automaton_postgres psql -U postgres -d automaton \
    -c "\dt shared.*"
  ```
- [ ] **5.2** Configurer les credentials Postgres dans n8n :
  - Ouvrir `tool-hitl-approval` dans n8n
  - Créer credential Postgres : host=`postgres`, db=`automaton`, user=`postgres`
  - Appliquer le même credential à `tool-hitl-reply-router`
- [ ] **5.3** Câbler le reply-router dans le webhook music-ai :
  - Ajouter nœud "Execute Workflow" → `tool-hitl-reply-router`
  - Ajouter nœud "IF" : si `matched === true` → stop, sinon → continuer

---

## 🧪 Phase 6: Tests de validation

- [ ] **6.1** Vérifier l'état complet du système :
  ```bash
  ./scripts/check-system-status.sh
  ```
- [ ] **6.2** Tester GET /publish/platforms
- [ ] **6.3** Tester POST /publish en dry_run
- [ ] **6.4** Tester POST /ai/generate-script (Actu IA, Dark Psychology, Documentaire, Sport)
- [ ] **6.5** Tester POST /ai/generate-image (Leonardo)
- [ ] **6.6** Tester POST /ai/generate-image (OpenAI)
- [ ] **6.7** Tester POST /ffmpeg/render
- [ ] **6.8** Tester POST /ai/generate-speech (ElevenLabs)
- [ ] **6.9** Tester POST /ai/generate-subtitles (Whisper)
- [ ] **6.10** Tester POST /publish avec `async: true` (queue upload)
- [ ] **6.11** Tester POST /content/raw-items et GET /content/raw-items
- [ ] **6.12** Tester POST /content/themes et GET /content/themes
- [ ] **6.13** Tester le flux HITL complet via WhatsApp :
  - Envoyer un message à l'agent music-ai
  - Vérifier qu'il demande validation
  - Répondre "oui" ou "non"
  - Vérifier dans les logs que le router a intercepté

---

## 🔮 Prochaines briques `_shared` (après déploiement)

- [x] Worker `queue:upload` — publication asynchrone (YouTube/TikTok/Meta) via BullMQ. ✅ fait.
- [x] Endpoint `/ai/generate-speech` — voix via ElevenLabs. ✅ fait.
- [x] Endpoint `/ai/generate-subtitles` — sous-titres via OpenAI Whisper. ✅ fait.
- [x] Document `docs/CONTENT_PIPELINE.md` — vision pipeline + état réel. ✅ fait.
- [x] Tables `shared.raw_items` et `shared.themes_traites` + endpoints. ✅ fait.
- [x] `tool-generate-script` — générateur de script multi-profil avec prompts versionnés. ✅ fait.
- [x] Endpoint `/ai/fact-check` — fact-checking LLM (`block_publication`). ✅ fait.
- [x] Endpoint `/ai/seo` — titres/descriptions/tags par plateforme. ✅ fait.
- [x] Endpoint `/ai/quality-check` — inspection ffprobe, conformité par profil. ✅ fait.
- [x] Endpoint `GET /media/stock` — Pexels/Pixabay/Unsplash. ✅ fait.
- [x] Publication TikTok (Content Posting API v2) + Meta (Reels Graph API). ✅ fait.
- [x] Worker `queue:analytics` + table `shared.video_analytics`. ✅ fait.
- [x] `stock_first` + `cloudinary_upload` dans `/ai/generate-image`. ✅ fait.
- [ ] **Déploiement sur le droplet** : `docker compose up -d --build api` + appliquer `05-shared-analytics.sql` + renseigner les nouvelles clés `.env` (TIKTOK_ACCESS_TOKEN, META_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID, PEXELS_API_KEY, PIXABAY_API_KEY, UNSPLASH_ACCESS_KEY)
- [ ] `tool-analyze-trends` — brique n8n Hermes pour scoring/tendances
- [ ] `tool-analyze-performance` — boucle d'optimisation analytics
- [ ] `tool-generate-audio` — brique n8n unifiée Suno/ElevenLabs
- [ ] Gabarits de montage par profil dans le worker FFmpeg

---

## 📝 Notes de déploiement

### Commandes rapides

```bash
# Sur le droplet
cd /home/automaton/automaton

# Pull + rebuild complet
git pull && docker compose up -d --build

# Rebuild uniquement l'API
docker compose up -d --build api

# Vérifier l'état
./scripts/check-system-status.sh

# Tester les endpoints
./scripts/test-api-endpoints.sh droplet

# Voir les logs
docker logs --tail 100 automaton_api
docker logs --tail 100 automaton_n8n
docker logs --tail 100 automaton_hermes
```

### Variables d'environnement critiques

Vérifier dans `/home/automaton/automaton/.env` :

```bash
# YouTube OAuth (obligatoire pour publication)
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...

# Publication (sécurité)
PUBLISH_PLATFORMS_ENABLED=youtube,tiktok,meta
PUBLISH_DRY_RUN=true

# Génération d'images
IMAGE_PROVIDER=leonardo
IMAGE_PROVIDERS_ENABLED=leonardo,openai
LEONARDO_API_KEY=...
OPENAI_API_KEY=...

# Hermes
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

---

## 🐛 Troubleshooting

### L'API ne démarre pas

```bash
docker logs automaton_api
docker compose down api
docker compose up -d --build api
```

### Les workflows n8n ont des erreurs

- Vérifier les credentials Postgres
- Vérifier les variables d'environnement dans le .env
- Redémarrer n8n : `docker compose restart n8n`

### Le HITL ne répond pas

```bash
# Vérifier les tables
docker exec -it automaton_postgres psql -U postgres -d automaton \
  -c "SELECT * FROM shared_hitl.approval_states ORDER BY created_at DESC LIMIT 5;"

# Vérifier les logs n8n
docker logs --tail 100 automaton_n8n | grep -i "hitl"
```

### YouTube OAuth ne fonctionne pas

- Vérifier que l'API YouTube Data v3 est activée dans Google Cloud
- Vérifier que le refresh_token est valide (ne pas confondre avec access_token)
- Tester avec `PUBLISH_DRY_RUN=true` d'abord

---

## 📚 Documentation

- **Guide de déploiement complet** : `DEPLOYMENT_GUIDE.md`
- **Architecture** : `docs/ARCHITECTURE.md`
- **Conventions** : `docs/CONVENTIONS.md`
- **Intégration Hermes** : `docs/HERMES_INTEGRATION.md`
- **Guide HITL** : `workflows/_shared/HITL.md`
- **Runbook opérationnel** : `RUNBOOK.md`
