# Pipeline de production de contenu — Vision & état actuel

Ce document reprend la vision du pipeline de création de contenu automatisée (document processus de référence) et l'aligne avec l'implémentation **réellement déployée** dans Automaton aujourd'hui.

> **Principe directeur** : un même moteur (socle commun) + des fiches profils (configuration).  
> Chaque agent est une compétence générique réutilisable. Ce qui change d'une niche à l'autre, c'est le paramétrage (prompts, fournisseurs, voix, style visuel, plateformes, validation).

---

## 1. Les 13 agents du socle commun

| # | Agent | Rôle | État actuel | Fichiers / endpoints concernés |
|---|---|---|---|---|
| 1 | **Veille** | Collecter la matière première (RSS, APIs, sources curées) | 🟡 Partiel | Tables `shared.raw_items` et `shared.themes_traites` créées. Endpoints `/content/raw-items` et `/content/themes` disponibles. Workflows n8n de collecte à câbler. |
| 2 | **Analyse & Sélection** | Scorer et classer les sujets, déléguer l'arbitrage à Hermes | 🟡 Partiel | LLM disponibles via `/ai/generate` ; brique n8n `tool-analyze-trends` (Hermes) à créer. |
| 3 | **Rédacteur** | Produire le script final, porteur de l'identité éditoriale | 🟢 Implémenté | `/ai/generate-script` (multi-profil, charge le prompt depuis `_shared/prompts/<profil>-redacteur.md`). |
| 4 | **Fact-Checking** | Vérifier les affirmations avant publication | 🟢 Implémenté | `/ai/fact-check` — LLM (Anthropic par défaut), résultat JSON avec `block_publication`. |
| 5 | **SEO** | Titres, descriptions, tags par plateforme | 🟢 Implémenté | `/ai/seo` — GPT-4o-mini par défaut, 3 variantes de titre + metadata par plateforme. |
| 6 | **Média** | Visuels : stock libre + génération IA + Cloudinary | 🟢 Implémenté | `/ai/generate-image` (`stock_first`, `cloudinary_upload`). `/media/stock` (Pexels/Pixabay/Unsplash). |
| 7 | **Musique** | Générer le lit musical | 🟢 Implémenté | `/ai/generate-music` (Suno). |
| 8 | **Audio (voix)** | Transformer le script en voix off | 🟢 Implémenté | `/ai/generate-speech` (ElevenLabs). |
| 9 | **Sous-titres** | Générer `.srt` synchronisés | 🟢 Implémenté | `/ai/generate-subtitles` (OpenAI Whisper). |
| 10 | **Montage** | Assembler voix, musique, visuels, sous-titres | 🟢 Implémenté | `queue:ffmpeg` + `services/ffmpeg-worker` (`render_long`, `render_short`, `burn_subtitles`). |
| 11 | **Contrôle Qualité** | Checks automatiques avant HITL | 🟢 Implémenté | `/ai/quality-check` — `ffprobe` : durée, bitrate, codecs, conformité par profil. |
| 12 | **Publication** | Publier sur YouTube/TikTok/Meta | 🟢 Implémenté | `/publish` (YouTube OAuth, TikTok Content Posting API v2, Meta Reels Graph API). `video_url` requis pour TikTok/Meta. |
| 13 | **Analytics** | Boucler la boucle de performance | 🟢 Implémenté | `queue:analytics` + worker Node.js → YouTube Data API + YouTube Analytics API. Table `shared.video_analytics`. |

Légende : 🟢 Implémenté | 🟡 Partiel | 🔴 Non implémenté

---

## 2. Stack technique déjà en place

| Couche | Outils | Statut |
|---|---|---|
| Orchestration | n8n | ✅ |
| Agent cognitif | Hermes | ✅ |
| API métier | `services/api/src/index.js` | ✅ |
| Base de données | PostgreSQL (`shared.hitl_approvals`) | ✅ |
| Cache / files | Redis + BullMQ (`queue:ffmpeg`, `queue:upload`, `queue:analytics`) | ✅ |
| Containerisation | Docker Compose + nginx + DigitalOcean droplet | ✅ |
| LLM texte | OpenAI, Anthropic, DeepSeek, Mistral | ✅ |
| LLM image | Leonardo AI, OpenAI DALL·E | ✅ |
| Musique | Suno | ✅ |
| Voix | ElevenLabs | ✅ (récent) |
| Sous-titres | OpenAI Whisper | ✅ (récent) |
| Vidéo | FFmpeg worker | ✅ |
| Publication | YouTube Data API v3 | ✅ |
| HITL | WhatsApp (Green API) + PostgreSQL | ✅ |
| Stockage | S3, Cloudinary | ✅ (configuré) |

---

## 3. Écarts prioritaires à combler

Pour que la vision du pipeline soit pleinement réalisable, il reste à implémenter :

1. ~~**Schéma de veille** (`shared.raw_items`, `shared.themes_traites`)~~ ✅
2. ~~**Endpoint/brique Fact-Checking**~~ ✅ `/ai/fact-check`
3. ~~**Endpoint/brique SEO**~~ ✅ `/ai/seo`
4. ~~**Contrôle Qualité**~~ ✅ `/ai/quality-check` (ffprobe)
5. ~~**Worker Analytics**~~ ✅ `queue:analytics` + `shared.video_analytics`
6. ~~**Intégration Pexels/Pixabay/Unsplash**~~ ✅ `/media/stock` + `stock_first` dans `/ai/generate-image`
7. ~~**Publication TikTok / Meta**~~ ✅ TikTok Content Posting API v2 + Meta Reels Graph API
8. ~~**Générateur de script générique**~~ ✅ `/ai/generate-script` multi-profil
9. **Gabarits de montage par profil** dans le worker FFmpeg (ratio/rythme par config)
10. **Brique n8n `tool-analyze-trends`** — délégation à Hermes pour scoring/tendances

---

## 4. Fiches profils (cibles)

Ces fiches sont des **configurations**, pas du code. Chaque profil remplit la même fiche modèle.

| Profil | Fréquence | Format | LLM rédaction | Validation | Spécificité |
|---|---|---|---|---|---|
| **Actu IA/Tech** | Quotidien | Court 16:9 + 9:16 | GPT-4o-mini | `video` | Veille temps réel, multi-canal |
| **Dark Psychology** | Hebdomadaire | Long 15–20 min 16:9 | Claude | `script` puis `video` | Base curée, style visuel fixe |
| **Documentaire** | Mensuel | Long 25–40 min 16:9 | Claude | `script` + `video` | Fact-checking maximal, archives |
| **Sport** | Variable | Court 9:16 | GPT-4o-mini / Claude | `video` groupée | Données temps réel, vigilance droits |

> **Point de vigilance légal (Sport)** : les extraits de matchs sont protégés. Privilégier graphiques de stats, visuels sous licence explicite, ou illustration non figurative.

---

## 5. Files Redis / BullMQ

```text
queue:ffmpeg      → ffmpeg-worker      → montage / rendu vidéo
queue:upload       → worker upload      → envoi YouTube/TikTok/Meta
queue:analytics    → worker analytics   → collecte différée des métriques
```

- `queue:ffmpeg` : ✅ worker Python actif
- `queue:upload` : ✅ worker Node.js intégré à l'API
- `queue:analytics` : ✅ worker Node.js intégré à l'API → `shared.video_analytics`

---

## 6. Validation humaine (HITL)

Toute validation passe par la table `shared.hitl_approvals`.

| Champ | Usage |
|---|---|
| `workflow_run_id` | Identifiant de l'exécution n8n |
| `profil` | `actu-ia`, `dark-psychology`, `documentaire`, `sport` |
| `type` | `script`, `video`, `other` |
| `status` | `pending`, `approved`, `rejected` |
| `payload_url` | Lien vers le script ou la vidéo à valider |
| `feedback` | Commentaire de correction |

Doc détaillée : `workflows/_shared/HITL.md`.

---

## 7. Stratégie multi-fournisseurs LLM

Chaque agent appelle l'API maison qui route vers le fournisseur configuré. Les agents n'appellent jamais un fournisseur en dur.

| Tâche | Fournisseur recommandé | Justification |
|---|---|---|
| Veille / scoring | DeepSeek ou Mistral | Haut volume, faible enjeu créatif |
| Analyse & sélection | Mistral / GPT-4o-mini | Classement structuré, coût modéré |
| Rédaction | Claude | Qualité de prose, structures complexes |
| Fact-Checking | Claude / GPT-4o | Faible tolérance à l'erreur |
| SEO | GPT-4o-mini | Tâche courte, faible enjeu |

---

## 8. Référence rapide des endpoints API

| Endpoint | Description | Statut |
|---|---|---|
| `POST /ai/generate` | Texte via `aiProviders` | ✅ |
| `POST /ai/generate-script` | Script multi-profil (charge prompt depuis `_shared/prompts/`) | ✅ |
| `POST /ai/generate-image` | Image (Leonardo/OpenAI, `stock_first`, `cloudinary_upload`) | ✅ |
| `POST /ai/generate-music` | Audio via Suno | ✅ |
| `POST /ai/generate-speech` | Voix via ElevenLabs | ✅ |
| `POST /ai/generate-subtitles` | `.srt` via Whisper | ✅ |
| `POST /ai/fact-check` | Fact-checking LLM avec `block_publication` | ✅ |
| `POST /ai/seo` | Titres/descriptions/tags par plateforme | ✅ |
| `POST /ai/quality-check` | Inspection ffprobe + conformité par profil | ✅ |
| `GET /media/stock` | Recherche stock libre (Pexels/Pixabay/Unsplash) | ✅ |
| `POST /publish` | Publication YouTube/TikTok/Meta, sync ou async (`video_url`) | ✅ |
| `GET /publish/platforms` | Liste plateformes activées | ✅ |
| `POST /jobs/ffmpeg` | Mise en file FFmpeg | ✅ |
| `POST /jobs/analytics` | Mise en file analytics | ✅ |
| `POST /content/raw-items` | Insérer/mettre à jour un item de veille | ✅ |
| `GET /content/raw-items` | Lister les items de veille | ✅ |
| `PATCH /content/raw-items/:id` | Mettre à jour le statut d'un item | ✅ |
| `POST /content/themes` | Enregistrer un thème traité | ✅ |
| `GET /content/themes` | Lister les thèmes traités | ✅ |

Endpoints encore à créer :

- `POST /ai/analyze-trends` (délégation Hermes — scoring tendances)
- `POST /ai/analyze-performance` (délégation Hermes — boucle optimisation)

---

## 9. Architecture cible simplifiée

```text
Cron n8n / Webhook / Manuel
    │
    ▼
Agent Veille → PostgreSQL (raw_items)
    │
    ▼
Agent Analyse → Hermes (arbitrage)
    │
    ▼
Agent Rédacteur → script structuré
    │
    ▼
Agent Fact-Checking
    │
    ├── Agent SEO
    ├── Agent Média
    ├── Agent Musique
    ├── Agent Audio
    └── Agent Sous-titres
    │
    ▼
Agent Montage → queue:ffmpeg → ffmpeg-worker
    │
    ▼
Contrôle Qualité
    │
    ▼
HITL (WhatsApp/Green API)
    │
    ▼
Agent Publication → queue:upload → YouTube/TikTok/Meta
    │
    ▼
Agent Analytics → queue:analytics → Hermes
```

---

## 10. Conclusion

La vision du pipeline est **pleinement cohérente et désormais quasi-complète**. Les 13 agents du socle ont tous une implémentation active. Les deux seules briques encore ouvertes sont des optimisations :

- **Gabarits de montage par profil** dans le worker FFmpeg (ratio/rythme configurable)
- **Briques n8n `tool-analyze-trends` / `tool-analyze-performance`** (délégation à Hermes)

Chaque nouvelle niche s'ajoute en remplissant une fiche profil et en écrivant le prompt `_shared/prompts/<profil>-redacteur.md`, sans toucher au moteur.
