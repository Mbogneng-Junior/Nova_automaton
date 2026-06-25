# exmeple5.json — Comedic Marketing Reel & Autopost

## Ce que fait ce workflow

Ce workflow **génère des vidéos marketing comiques avec Sora 2** et les publie automatiquement via **Blotato** (outil de social media management).

**Flux global :**
1. **Trigger** — `scheduleTrigger` tous les jours à 19h
2. **Agent** — `agent` LangChain avec mémoire génère un prompt vidéo marketing comique
3. **Log** — `dataTable` (`Insert row`) enregistre le prompt dans une table
4. **Génération vidéo** — `httpRequest` POST vers Sora 2 API
5. **Attente** — `wait` de 30 secondes
6. **Récupération** — `httpRequest` GET pour récupérer le résultat
7. **Condition** — `if` vérifie si `data.status === "completed"`
8. **Rebouclage** — Si non terminé : attend encore 30s et recommence
9. **Upload** — `blotato` (`Upload media`) upload la vidéo
10. **Caption** — `openAi` génère une légende/caption
11. **Publication** — `blotato` (`Create post`) publie sur les réseaux

**Nœuds clés :**
- `scheduleTrigger` — Publication quotidienne automatique
- `agent` (LangChain) — Génération créative avec mémoire (`memoryBufferWindow`)
- `lmChatOpenAi` — GPT-4o-mini pour l'agent
- `dataTable` — Stockage des prompts dans une data table n8n
- `httpRequest` — Appels Sora 2 API (création + statut)
- `wait` — Pause entre polls
- `if` — Condition de complétion
- `blotato` (custom node) — Upload média + création de post
- `openAi` (image) — Génération de caption

## Comment l'utiliser

1. **Configurer les credentials :**
   - OpenAI API key
   - Sora 2 / fal.ai API key
   - Blotato credentials

2. **Le workflow s'exécute automatiquement** tous les jours à 19h

3. **L'agent génère un concept** de vidéo marketing comique

4. **La vidéo est générée, téléchargée et publiée** automatiquement

## Principes de syntaxe illustrés

### 1. Agent avec mémoire
```json
"type": "@n8n/n8n-nodes-langchain.agent",
"type": "@n8n/n8n-nodes-langchain.memoryBufferWindow"
```
L'agent LangChain est connecté à une mémoire à fenêtre glissante, ce qui lui permet de garder le contexte des conversations/interactions précédentes.

### 2. Data Table
```json
"type": "n8n-nodes-base.dataTable"
```
Stocke des données structurées directement dans n8n (sans besoin de base de données externe).

### 3. Connexion AI memory
```json
"ai_memory": [[ { "node": "Video Prompt Agent", "type": "ai_memory" } ]]
```
Connecte le nœud de mémoire à l'agent LangChain.

### 4. Rebouclage conditionnel
```
GET Sora2 Result → If (completed?) → [non] → Wait Another 30 Secs → GET Sora2 Result → ...
```
Pattern de polling avec rebouclage explicite via le nœud `if`.

### 5. Nœud custom (Blotato)
```json
"type": "@blotato/n8n-nodes-blotato.blotato"
```
Exemple d'intégration d'un nœud custom/community pour un service spécifique (Blotato).

### 6. Expression conditionnelle dans If
```json
"leftValue": "={{ $json.data.status }}",
"value": "completed"
```
Accède à un champ imbriqué (`data.status`) pour la condition.
