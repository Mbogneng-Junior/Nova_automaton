# Conventions

Règles partagées pour garder Automaton maintenable à long terme. À lire après `AGENTS.md`.

---

## 1. Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Pipeline (dossier) | `kebab-case`, par thématique | `content/music-ai`, `content/psychologie` |
| Brique réutilisable | préfixe `tool-` | `tool-publish-youtube` |
| Canal (registre) | `<theme>-<plateforme>-<langue>` | `music-ai-youtube-fr` |
| Schéma Postgres | `snake_case`, = thématique | `music_ai`, `psychologie` |
| Webhook n8n | `kebab-case`, descriptif | `music-ai-starter` |
| Variable `.env` | `MAJUSCULES_SNAKE` | `SUNO_API_KEY` |

---

## 2. Le `manifest.json` (contrat de chaque pipeline)

Chaque pipeline DOIT avoir un `manifest.json` à sa racine (modèle :
`workflows/_templates/pipeline-template/manifest.template.json`). Il décrit, pour qu'un agent comprenne le
pipeline sans lire tout le code :

- `triggers` — comment il démarre (webhook, cron, whatsapp).
- `uses_bricks` — quelles briques `_shared/` il consomme.
- `approval_gates` — les portes de validation humaine.
- `channels` — les canaux ciblés (ids du registre).
- `services` — endpoints API, queues Redis, schéma DB.
- `env_required` — variables `.env` nécessaires.

---

## 3. Les briques réutilisables (`_shared/`)

- Une capacité transverse (publier, valider, rendre une vidéo) vit **à un seul endroit**.
- Une brique = un **sub-workflow n8n** avec entrée/sortie JSON documentées en tête de fichier.
- **Idempotente** : rejouable sans dupliquer (clé `project_id`).
- **Jamais de secret en dur** : credentials n8n ou variables d'environnement.
- Un pipeline qui recode une capacité existante = à refuser en revue.

---

## 4. Master → Variantes (contenu vs diffusion)

- Le pipeline produit un **master** (script, audio, vidéo source, miniature, métadonnées).
- La **publication** lit `content/_channel-registry.json` pour savoir où publier et comment
  adapter (format, langue, ton, hashtags, durée) via le bloc `adapter` + `brand_kit`.
- **Ajouter une chaîne ne touche aucun pipeline** : on ajoute une entrée dans le registre.

---

## 5. n8n — règles techniques

- **Toujours pré-stringifier** le JSON dans un nœud Code avant un HTTP Request node.
  Jamais d'expression inline avec guillemets dynamiques. (Voir
  `workflows/content/music-ai/n8n/TROUBLESHOOTING.md`.)
- Référencer un autre nœud : `={{ $('Node Name').first().json.field }}`.
- Exporter les workflows dans `workflows/<...>/n8n/` après chaque modif stable (versioning).
- La **source de vérité d'exécution** reste la base Postgres de n8n ; les `.json` sont des
  exports de référence.

---

## 6. Validation humaine (HITL)

- Canal universel : **WhatsApp** (Green API).
- Toute action irréversible (publication, dépense API importante) passe par une porte.
- Mode `dry-run` recommandé pendant les tests : ne jamais publier en `public` par défaut
  (cf. `default_visibility: private/draft` dans le registre).

---

## 7. Base de données

- Une seule base `automaton`, **un schéma par thématique**.
- Tables d'analytics/logs isolées par schéma.
- Ajouter un schéma → script SQL dans `services/postgres/init/`.

---

## 8. Sécurité

- Secrets **uniquement** dans `.env` (jamais commité) ou credentials n8n.
- Aucun token/clé dans `workflows/` (versionné sur git).
- Le registre de canaux utilise des **clés logiques** (`account_ref`), pas des secrets.

---

## 9. Roadmap (ordre conseillé)

1. **Fondations + onboarding** (ce socle documentaire) — *fait*.
2. **Briques `_shared/`** : `tool-hitl-approval`, `tool-publish-youtube`, `tool-generate-image`,
   `tool-render-video`, `tool-analyze-trends`.
3. **Chaîne Psychologie** (valider le modèle Master→Variantes de bout en bout).
4. **Boucle d'optimisation analytics** (Hermes + n8n, cron hebdo, rapport WhatsApp).
5. **Multi-canal** : duplication + adaptation automatique via le registre.
