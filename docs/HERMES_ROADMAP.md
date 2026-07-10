# Roadmap Hermes — Auto-amélioration dans Automaton

> Ce document liste les prochains axes d'exploitation de l'agent **Hermes** (Nous Research)
> une fois l'infrastructure actuelle stabilisée et les tests du pipeline de contenu passés.
>
> Hermes n'est pas qu'un gateway LLM : c'est un agent avec **mémoire persistante**, **création
> automatique de skills**, **browser automation** et un mécanisme de **self-evolution** (DSPy + GEPA).
> Dans Automaton, ces capacités sont aujourd'hui sous-utilisées.

---

## 1. Contexte

Hermes est déjà déployé dans `docker-compose.yml` avec un volume persistant :

```yaml
@/home/mbogneng-junior/Documents/art/Creation_contenus/Automaton/docker-compose.yml:193-212
hermes:
  build: ./services/hermes
  container_name: automaton_hermes
  restart: unless-stopped
  volumes:
    - ./data/hermes-home:/home/hermes/.hermes
```

Sa mémoire et ses skills résident dans `data/hermes-home/`. Mais le pipeline actuel ne l'utilise
que comme gateway LLM (`http://hermes:8123/v1/chat/completions`) et potentiellement comme interface HCI.

---

## 2. Avantages clés d'Hermes (source : docs officielles + comparatifs)

| Avantage | Ce que ça donne concrètement | Pourquoi c'est puissant pour Automaton |
|---|---|---|
| **Mémoire persistante** | FTS5 session search, LLM summarization, `MEMORY.md` | Hermes se souvient de tes préférences, projets, erreurs passées. Plus besoin de tout réexpliquer à chaque prompt. |
| **Auto-création de skills** | Après une tâche complexe, Hermes écrit un skill réutilisable | Chaque publication, montage ou veille réussie devient un savoir capitalisé. |
| **Skills qui s'améliorent** | Les skills évoluent avec l'usage | Les préférences de montage s'affinent automatiquement au fil des feedbacks. |
| **Model-agnostic** | Nous Portal, OpenRouter, OpenAI, Anthropic, DeepSeek, local | Router les tâches simples sur un modèle cheap et les tâches critiques sur Claude. Gain de coût massif. |
| **Tool Gateway Nous** | Web search, image gen, TTS, browser sans comptes externes | Moins de clés API à gérer. Browser automation prêt à l'emploi. |
| **Browser automation** | Browser Use, Browserbase, CDP local | Hermes peut naviguer, scraper, remplir des formulaires, prendre des screenshots. Idéal pour la veille. |
| **Multi-agent / délégation** | `delegate_task`, sous-agents, kanban board | Un agent de veille peut déléguer à un agent de résumé, un de scoring, etc. |
| **Cron natif** | `cronjob` tool, scheduling intégré | Automatiser les veilles, les rapports analytics, les audits. |
| **Multi-platform messaging** | Telegram, Discord, Slack, WhatsApp, Signal, Email | Même canal de notification pour l'agent et pour le HITL WhatsApp déjà en place. |
| **Self-evolution (DSPy + GEPA)** | Repo `hermes-agent-self-evolution` optimise skills/prompts/code | Possibilité d'entraîner automatiquement les meilleurs skills pour chaque profil. |
| **Open-source & local possible** | MIT, s'exécute sur VPS, GPU, ou serverless | Pas de lock-in. Données et mémoire chez toi. |
| **~73 outils natifs** | Terminal, fichiers, web, browser, vision, TTS, image, cron, todo, etc. | Moins de code à écrire pour connecter des services externes. |

### Comparatif rapide

- **vs Claude Code** : Claude Code est un excellent agent de code interactif, mais il n'a pas de mémoire persistante native ni de cron. Hermes est asynchrone, autonome, long-running.
- **vs GPT-5.5 Operator** : Operator est plus mature UX mais propriétaire, $200/mo, et sans learning loop. Hermes est 60-90% moins cher, open-source, et s'améliore avec le temps.

---

## 3. Comment exploiter ces avantages à fond dans Automaton

### 3.1. Router les tâches par modèle (cost optimization)

Utiliser Hermes comme orchestrateur model-agnostic :
- **Veille / scoring** : DeepSeek V3 ou Mistral (cheap)
- **Rédaction script** : Claude Sonnet (qualité)
- **Fact-checking** : Claude Sonnet / GPT-4o (fiabilité)
- **SEO / metadata** : GPT-4o-mini (tâche courte)
- **Génération image** : Tool Gateway Nous (FLUX 2) ou FAL
- **Voix** : rester sur ElevenLabs pour la qualité

### 3.2. Remplacer certains appels API par des skills Hermes

| Actuellement | Avec Hermes |
|---|---|
| `/ai/generate` sur OpenAI | Appel `http://hermes:8123/v1/chat/completions` avec modèle choisi dynamiquement |
| `/media/stock` + `/ai/generate-image` | Skill `agent-media` qui décide seul : stock first, sinon génération, puis upload Cloudinary |
| Veille manuelle | Cron Hermes qui scrape + résume + insère dans `shared.raw_items` |
| Rapport analytics hebdo | Cron Hermes qui lit `shared.video_analytics` et envoie un résumé WhatsApp |

### 3.3. Utiliser le browser automation pour la veille active

Hermes peut :
- Naviguer sur Reddit/X/Google Trends
- Extraire les sujets chauds
- Scorer leur pertinence pour chaque profil
- Créer des skills `veille-<profil>` avec les sources fiables identifiées

### 3.4. Multi-agent pour le pipeline de contenu

Décomposer une production en sous-agents Hermes :
- `agent-veille` → collecte
- `agent-scoring` → classement
- `agent-redacteur` → script (peut déléguer à l'API `/ai/generate-script`)
- `agent-fact-check` → vérification
- `agent-seo` → métadonnées
- `agent-media` → visuels
- `agent-montage` → rendu FFmpeg
- `agent-publication` → upload multi-plateforme

Chacun communique via webhooks n8n ou directement via le réseau Docker.

### 3.5. Self-evolution des skills

Intégrer le repo `hermes-agent-self-evolution` pour :
- Lire les logs d'exécution (Postgres + metadata.json)
- Identifier les skills les moins performants
- Générer des variantes de prompts/skills
- Tester en dry-run
- Déployer les meilleures versions

### 3.6. HITL unifié via WhatsApp

Puisque Hermes supporte WhatsApp et qu'on a déjà Green API pour le HITL :
- Utiliser Hermes pour **envoyer des demandes de validation enrichies** (ex : résumé + lien vidéo + 3 options)
- Utiliser Hermes pour **interpréter les réponses humaines** au-delà de simples oui/non (ex : "rends le hook plus court" → feedback structuré)
- Stocker les réponses dans `shared.hitl_approvals` et `shared.feedback`

---

## 4. Axes d'exploitation prioritaires (mise à jour)

### Axe 1 — Apprentissage des préférences de montage

**Problème** : chaque vidéo est montée avec les mêmes paramètres, quels que soient les retours de l'utilisateur.

**Solution** : boucle de feedback → skill Hermes.

1. L'utilisateur critique un montage (ex : *"trop de cuts, plans de 3-4s minimum"*).
2. Le feedback est envoyé à Hermes via un workflow n8n.
3. Hermes synthétise une préférence et l'écrit sous forme de skill dans `data/hermes-home/skills/montage-<profil>.md`.
4. Avant le prochain montage du même profil, n8n lit ce skill et l'injecte dans le prompt de `tool-render-video` / `ffmpeg-worker`.

**Stockage double** :
- Skill Hermes (texte, mémoire agent)
- Table `shared.preferences` (mémoire structurée pour l'API)

---

### Axe 2 — Veille et scoring de tendances

**Problème** : la veille est manuelle ou basée sur des RSS bruts.

**Solution** : Hermes comme agent de veille actif.

1. Hermes navigue sur le web avec Browser Use (Reddit, X, Google News, sources curées).
2. Il collecte, résume et score les sujets selon la niche (actu IA, dark psychology, sport...).
3. Il crée un skill `veille-<profil>` contenant les sources fiables et les patterns de sujets à fort potentiel.
4. Les meilleurs sujets sont insérés dans `shared.raw_items` pour le pipeline.

**Rituel** : cron quotidien qui déclenche `tool-analyze-trends` (délégation Hermes).

---

### Axe 3 — Auto-skills de publication

**Problème** : chaque plateforme a ses règles (formats, hashtags, horaires) et on les recode à la main.

**Solution** : Hermes apprend à publier efficacement.

1. Quand on publie sur une nouvelle plateforme, Hermes observe le résultat (id, URL, erreurs, métriques).
2. Il crée/met à jour un skill `publish-<platform>` avec les bonnes pratiques.
3. Les prochaines publications utilisent ce skill pour ajuster les métadonnées, la description, les hashtags.

**Exemple** : skill TikTok qui se souvient que les vidéos postées à 19h performent mieux pour le profil dark-psychology.

---

### Axe 4 — Boucle d'optimisation analytics

**Problème** : les données analytics sont collectées mais pas exploitées pour améliorer le contenu.

**Solution** : Hermes lit `shared.video_analytics` et propose des ajustements.

1. Cron hebdomadaire : `tool-analyze-performance` lit les dernières vidéos d'un profil.
2. Hermes compare les performeurs et les under-performers.
3. Il crée un skill `analytics-<profil>` avec les patterns identifiés (hooks, durée optimale, type de miniature...).
4. Il génère un rapport WhatsApp avec 3 recommandations concrètes pour la semaine suivante.

---

## 5. Hermes comme interface humaine centrale (HITL 2.0)

> Hermes ne doit pas rester un simple moteur LLM caché. Il doit devenir **l'interface principale**
> entre toi et Automaton : tu lui parles, il orchestre le pipeline, il apprend de tes retours.

### 5.1. Canaux supportés

Hermes peut dialoguer via plusieurs canaux simultanément :

| Canal | Usage principal | Avantage |
|---|---|---|
| **Telegram** | Interface principale riche | Boutons, threads, médias, groupes, bots natifs |
| **WhatsApp** | HITL + notifications simples | Déjà en place via Green API, usage universel |
| **Discord** | Feedback détaillé / debug | Longs messages, channels thématiques |
| **Slack** | Collaboration équipe | Multi-utilisateurs, threads, intégrations |
| **Signal** | Confidentialité | Pour les échanges sensibles |
| **Email** | Récapitulifs / rapports | Weekly analytics, newsletters internes |
| **HCI web** | Dashboard / admin | Interface graphique pour configuration et monitoring |
| **CLI** | Développement / debug | Terminal direct sur le serveur |

### 5.2. Ce que tu peux demander à Hermes dans la conversation

- *"Génère-moi un script actu-ia sur GPT-5.5, angle débutant."*
- *"Montre-moi les 3 sujets les plus chauds de la semaine pour dark-psychology."*
- *"La vidéo test_music_001 a un hook trop long, raccourcis-le."* → feedback structuré
- *"Publie la dernière vidéo actu-ia sur TikTok en mode privé."*
- *"Quelles sont les performances de la chaîne cette semaine ?"* → rapport analytics
- *"Apprends que je préfère des transitions douces sur les vidéos documentaire."* → skill persistant

### 5.3. Hermes devient le cerveau conversationnel du pipeline

```text
Utilisateur (Telegram/WhatsApp/Discord/Slack/Email)
         │
         ▼
    Hermes Gateway
         │
         ├──► Comprend l'intention (LLM + mémoire + skills)
         │
         ├──► Si commande/action → appelle workflow n8n / API
         │
         ├──► Si question/feedback → répond + stocke dans shared.feedback
         │
         ├──► Si validation requise → HITL (WhatsApp/Telegram)
         │
         └──► Si veille/proposition → insère dans shared.raw_items
```

### 5.4. Différence avec le HITL WhatsApp actuel

| | HITL WhatsApp actuel | Hermes comme interface centrale |
|---|---|---|
| **Déclenchement** | Workflow n8n envoie une demande | Hermes peut proposer activement |
| **Format** | Oui/non/correction simple | Conversation naturelle, contexte, mémoire |
| **Canaux** | WhatsApp uniquement | Multi-canaux (Telegram, Discord, Slack, etc.) |
| **Apprentissage** | Réponse stockée | Réponse analysée → skill → réinjecté |
| **Initiative** | Réactif | Proactif : Hermes peut te proposer des sujets |

---

## 6. Architecture cible (Hermes au centre)

```text
                          ┌─────────────────┐
                          │  Utilisateur    │
                          │ (Telegram/WhatsApp/Discord/Slack/Email/HCI)
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Hermes Gateway │
                          │  (cerveau + UI) │
                          └────────┬────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
   │   Canaux      │      │   Apprentissage│      │   Action      │
   │ Telegram      │      │ skill creation │      │ workflow n8n  │
   │ WhatsApp      │      │ shared.feedback │     │ API Node      │
   │ Discord       │      │ shared.preferences│   │ queue BullMQ  │
   │ Email         │      │ data/hermes-home │    │ Postgres      │
   └───────────────┘      └───────────────┘      └───────────────┘
```

Hermes est le point d'entrée unique. Tout feedback passe par lui, est analysé, stocké, et réinjecté.

---

## 7. TODO / Étapes concrètes (après stabilisation)

### Phase A — Configuration et canaux (semaine 1)

- [ ] **Vérifier la configuration Hermes** sur le droplet (`hermes model`, `hermes doctor`, HCI accessible)
- [ ] **Configurer le Tool Gateway Nous** (web search, image gen, browser) pour réduire les clés API
- [ ] **Créer le bot Telegram** via @BotFather et le connecter à Hermes
- [ ] **Tester le dialogue** Telegram → Hermes → n8n → réponse
- [ ] **Documenter les commandes** utilisateur (générer, valider, critiquer, publier, analytics)

### Phase B — Stockage et feedback (semaine 2)

- [ ] **Créer le schéma `shared.feedback`** pour stocker les critiques et ratings
- [ ] **Créer le schéma `shared.preferences`** pour stocker les préférences apprises de manière structurée
- [ ] **Créer l'endpoint `POST /ai/feedback`** pour recevoir critiques et ratings
- [ ] **Créer la brique n8n `tool-learn-from-feedback`** : feedback → appel Hermes → skill + préférence
- [ ] **Modifier `tool-render-video`** pour injecter les préférences de montage du profil

### Phase C — Veille et analytics (semaine 3-4)

- [ ] **Créer la brique n8n `tool-analyze-trends`** : veille active via Browser Use
- [ ] **Créer la brique n8n `tool-analyze-performance`** : analyse de `shared.video_analytics`
- [ ] **Mettre en place un cron hebdo** d'apprentissage analytics
- [ ] **Créer un rapport WhatsApp/Telegram** hebdomadaire automatique

### Phase D — Self-evolution (semaine 5+)

- [ ] **Explorer `hermes-agent-self-evolution`** pour optimiser les skills de publication/montage
- [ ] **Mettre en place un rituel mensuel** de revue et validation des skills générés
- [ ] **Documenter les rituels** : feedback quotidien, revue analytics hebdo, mise à jour skills mensuelle

---

## 8. Métriques de succès

- Nombre de skills Hermes créés par profil
- Taux de réutilisation des préférences apprises dans les nouveaux montages
- Réduction du temps de veille manuelle (mesuré en minutes/semaine)
- Amélioration des métriques YouTube/TikTok/Meta entre les itérations
- Nombre de feedbacks traités automatiquement vs manuellement

---

## 9. Risques et vigilance

- **Skills qui dérivent** : un mauvais feedback peut créer une règle nocive. Prévoir un `confidence_score` et une validation humaine avant application.
- **Coût API** : la veille et la self-evolution consomment des tokens. Démarrer avec des cron espacés.
- **Sécurité** : les skills écrits par Hermes doivent être audités avant de toucher à la production (pas de auto-deploy).

---

> **Quand attaquer ?** Une fois que le pipeline de base (Phases 0-16 du `TESTING_GUIDE.md`) est stabilisé et que les premières publications réelles ont généré des données.
