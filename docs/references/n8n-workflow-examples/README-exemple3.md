# exemple3.json — Planification de Posts Sociaux via Google Sheets

## Ce que fait ce workflow

Ce workflow est un **système de planification et publication de contenu social media** qui utilise **Google Sheets comme source de vérité**.

**Flux global — Partie 1 (Création) :**
1. **Trigger** — `googleSheetsTrigger` détecte une nouvelle ligne dans le sheet "Topics"
2. **Filtrage** — `Filter` vérifie que le topic n'est pas vide et que le statut est "Approved"
3. **Batch** — `splitInBatches` (Loop Over Items) traite ligne par ligne
4. **Récupération** — `googleSheets` lit le "Brand Guide" depuis une autre feuille
5. **Génération texte** — `chainLlm` (Basic LLM Chain) avec `lmChatOpenRouter` génère le post
6. **Génération image** — `openAi` (DALL-E) génère une image
7. **Upload image** — `httpRequest` upload l'image vers un service externe
8. **Publication** — `httpRequest` POST vers `api.upload-post.com` pour LinkedIn et autres plateformes
9. **Log** — `googleSheets` (Append or update row) écrit le résultat dans un sheet de log

**Flux global — Partie 2 (Publication planifiée) :**
1. **Schedule Trigger** — Tous les jours à une heure fixe
2. **Lecture** — Récupère les posts avec `Status = "Approved"` et `Date Scheduled = aujourd'hui`
3. **Condition** — `If` vérifie que la date et le statut correspondent
4. **Publication** — Même logique que Partie 1

**Nœuds clés :**
- `googleSheetsTrigger` — Trigger sur changement Google Sheets
- `googleSheets` — Lecture/écriture de feuilles
- `filter` / `if` — Filtrage conditionnel
- `splitInBatches` — Traitement ligne par ligne
- `chainLlm` — Chaîne LLM basique (pas un agent)
- `lmChatOpenRouter` — Modèle via OpenRouter (fallback inclus)
- `openAi` (image) — Génération DALL-E
- `httpRequest` — Upload image + publication API externe

## Comment l'utiliser

1. **Créer 3 feuilles Google Sheets :**
   - "Topics" (sujets à traiter)
   - "Brand Guide" (ton, règles de marque)
   - "Chat Logs" (historique des publications)

2. **Ajouter une ligne dans "Topics"** avec colonnes : Topic, Status, Date Scheduled, etc.

3. **Le workflow s'exécute automatiquement** quand une ligne est ajoutée/modifiée

4. **Pour la publication planifiée** : le Schedule Trigger vérifie chaque jour

## Principes de syntaxe illustrés

### 1. Google Sheets Trigger
```json
"type": "n8n-nodes-base.googleSheetsTrigger"
```
Déclenche le workflow automatiquement quand une ligne est ajoutée/modifiée.

### 2. Référence croisée explicite
```json
"value": "={{ $('GetTopic').item.json.Topic }}"
```
Accède au champ `Topic` du nœud nommé `GetTopic`.

### 3. Split In Batches (Loop Over Items)
```json
"type": "n8n-nodes-base.splitInBatches"
```
Transforme une liste en items individuels pour les traiter un par un.

### 4. Mapping de colonnes Google Sheets
```json
"columns": {
  "value": {
    "User": "={{ $('when message received').item.json.messages[0].from }}",
    "Message": "={{ ... }}",
    "Response": "={{ ... }}",
    "Timestamp": "={{ $json.currentDate }}"
  }
}
```
Mappe des données dynamiques vers des colonnes spécifiques.

### 5. Content-Type form-urlencoded
```json
"contentType": "form-urlencoded",
"bodyParameters": { "parameters": [...] }
```
Envoie des données en `application/x-www-form-urlencoded`.

### 6. Fallback LLM
```json
"type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter"
```
Utilise OpenRouter comme provider LLM avec un modèle fallback intégré.
