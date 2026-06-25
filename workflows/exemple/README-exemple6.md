# exemple6.json — Virtual Scrum Master (Slack + Asana)

## Ce que fait ce workflow

Ce workflow est un **Scrum Master virtuel** qui analyse l'activité d'une équipe sur **Slack** et **Asana** puis génère un résumé quotidien envoyé sur Slack.

**Flux global :**
1. **Trigger** — `manualTrigger` (clic sur "Test workflow")
2. **Config** — `set` définit le `slack_channel_id` et `asana_project_id`
3. **Données Asana** — Récupère les sections du projet, les tâches modifiées depuis hier, les détails des tâches
4. **Données Slack** — Récupère l'historique du canal, les utilisateurs, pose une question quotidienne à chaque membre
5. **Merge** — Fusionne les données utilisateurs avec leurs réponses
6. **Filtrage** — `set` extrait uniquement les champs pertinents
7. **HTML** — `html` génère des rapports visuels (sections Asana, tâches, réponses utilisateurs, historique)
8. **Agent** — `agent` LangChain (Virtual Scrum Master) analyse toutes les données
9. **LLM** — `lmChatOpenAi` (o4-mini) génère le résumé
10. **Envoi** — `slack` envoie le résumé dans le canal

**Nœuds clés :**
- `manualTrigger` — Déclenchement manuel
- `set` — Configuration des IDs de projet/canal
- `slack` (x4) — Canal, historique, utilisateurs, envoi message
- `asana` (x2) — Tâches, détails
- `httpRequest` — Sections Asana (via API REST)
- `splitInBatches` — Boucle sur les utilisateurs
- `merge` — Jointure utilisateurs × réponses
- `html` — Génération de rapports HTML
- `agent` (LangChain) — Agent Scrum Master avec tool
- `lmChatOpenAi` — Modèle o4-mini

## Comment l'utiliser

1. **Configurer les credentials :**
   - Slack OAuth
   - Asana OAuth
   - OpenAI API key

2. **Modifier le nœud `Asana Project and Slack Channel`** avec tes vrais IDs :
   ```
   slack_channel_id = "C1234567890"
   asana_project_id = "1234567890"
   ```

3. **Cliquer "Test workflow"** pour exécuter manuellement

4. **Le résumé est envoyé** dans le canal Slack configuré

5. **(Optionnel)** Remplacer le `manualTrigger` par un `scheduleTrigger` pour exécution quotidienne

## Principes de syntaxe illustrés

### 1. Accès aux propriétés imbriquées
```json
"value": "={{ $json.assignee.name }}"
"value": "={{ $json.user }}"
"value": "={{ $json.text }}"
```
Accède à des champs profondément imbriqués dans le JSON (ex: `assignee.name`).

### 2. Conversion JSON en string
```json
"value": "={{ $json.data.toJsonString() }}"
```
Convertit un objet JSON en chaîne de caractères (utile pour le stockage dans Google Sheets ou data tables).

### 3. Split In Batches pour itérer
```json
"type": "n8n-nodes-base.splitInBatches"
```
Transforme une liste d'utilisateurs en items individuels pour envoyer une question à chacun.

### 4. Merge (jointure)
```json
"type": "n8n-nodes-base.merge"
```
Joint deux flux de données (ex: liste des utilisateurs + leurs réponses) par une clé commune.

### 5. Nœud HTML
```json
"type": "n8n-nodes-base.html"
```
Génère du HTML à partir de données structurées pour créer des rapports formatés avant envoi à l'agent IA.

### 6. Connexion multiple à un agent
```json
"ai_tool": [[ { "node": "Virtual Scrum Master", "type": "ai_tool" } ]]
```
Un tool MCP peut être connecté comme outil d'un agent LangChain.
