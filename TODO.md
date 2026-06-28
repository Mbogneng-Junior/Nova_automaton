# TODO — Actions à faire (suivi)

Suivi des actions manuelles (souvent sur le droplet) et des prochaines briques.
Coche `[x]` une fois fait.

---

## Activer la brique HITL (validation WhatsApp)

Guide complet : `workflows/_shared/HITL.md`.

- [ ] **1. Appliquer le schéma SQL sur la prod** (les scripts `init/` ne tournent que sur base vierge) :
  ```bash
  docker exec -i automaton_postgres psql -U postgres -d automaton \
    < services/postgres/init/03-shared-hitl.sql
  ```
- [ ] **2. Importer les 2 workflows dans n8n** :
  - `workflows/_shared/n8n/tool-hitl-approval.json`
  - `workflows/_shared/n8n/tool-hitl-reply-router.json`
- [ ] **3. Sélectionner le credential Postgres** dans chaque nœud Postgres (remplace `REPLACE_POSTGRES_CRED_ID`).
- [ ] **4. Câbler le router** dans le webhook de l'agent music-ai (appel en tête + court-circuit si `matched`).

---

## Prochaines briques `_shared`

- [x] `tool-render-video` — mise en file FFmpeg (API + worker existants). ✅ créé, à importer dans n8n.
- [x] `tool-publish` — multi-plateforme (YouTube/TikTok/Meta) avec **dry_run par défaut**. ✅ créé.
  - [ ] Rebuild/redeploy l'API pour activer `/publish` : `docker compose up -d --build api`
  - [ ] Ajouter dans le `.env` du droplet les variables OAuth YouTube : `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
  - [ ] (optionnel) ajuster `PUBLISH_PLATFORMS_ENABLED` et `PUBLISH_DRY_RUN` dans `.env`
  - [ ] Importer `workflows/_shared/n8n/tool-publish.json` dans n8n
- [x] `tool-generate-image` — cover/miniature **multi-fournisseur** (Leonardo/OpenAI). ✅ créé.
  - [ ] Rebuild/redeploy l'API pour activer `/ai/generate-image` : `docker compose up -d --build api`
  - [ ] (optionnel) régler `IMAGE_PROVIDER` / `IMAGE_PROVIDERS_ENABLED` dans `.env`
  - [ ] Importer `workflows/_shared/n8n/tool-generate-image.json` dans n8n
- [ ] `tool-analyze-trends` — délégation à Hermes.
- [ ] `tool-analyze-performance` — boucle d'optimisation (rétention/sentiment).

---

## Installation de nouvelle dépendance (API)

- [ ] Installer `googleapis` dans `services/api` :
  ```bash
  cd services/api && npm install
  # ou directement sur le droplet après git pull:
  docker compose up -d --build api
  ```
- [x] Refactorer le provider YouTube (`publishYouTube`) pour utiliser `googleapis` (OAuth2 refresh + `youtube.videos.insert` avec stream). ✅ fait.

## Déploiement d'une modif sur le droplet

```bash
cd /home/automaton/automaton && git pull && docker compose up -d --build
```
