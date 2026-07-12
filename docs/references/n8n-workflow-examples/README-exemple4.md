# exemple4.json — Suivi des Campagnes Email (10 Track)

## Ce que fait ce workflow

Ce workflow **surveille automatiquement les performances des campagnes email** et envoie des emails de réengagement quand les métriques indiquent une opportunité.

**Flux global :**
1. **Trigger** — `scheduleTrigger` tous les jours à 9h
2. **Input** — `set` configure l'URL de la campagne Mailchimp à surveiller
3. **Agent** — `agent` LangChain avec `mcpClientTool` (Bright Data MCP) scrape la page de rapport
4. **LLM** — `lmChatOpenAi` résume et formate les données (open_rate, ctr, etc.)
5. **Output Parser** — `outputParserAutofixing` + `outputParserStructured` structure les métriques
6. **Condition** — `if` vérifie si `open_rate >= 30%` ET `ctr < 10%`
7. **Action** — Si vrai : envoie un email Gmail de follow-up. Si faux : `noOp` (aucune action)

**Nœuds clés :**
- `scheduleTrigger` — Exécution quotidienne
- `set` — Définition des paramètres d'entrée
- `agent` (LangChain) — Agent IA avec tool
- `lmChatOpenAi` — Modèle GPT pour l'analyse
- `mcpClientTool` — Tool MCP (Bright Data) pour le scraping
- `outputParserAutofixing` — Parser qui corrige automatiquement les erreurs de format
- `outputParserStructured` — Parser à structure fixe
- `if` — Condition avec opérateurs numériques (`gte`, `lt`)
- `gmail` — Envoi d'email
- `noOp` — Nœud vide (aucune opération)

## Comment l'utiliser

1. **Configurer les credentials :**
   - Gmail OAuth
   - OpenAI API key
   - Bright Data MCP (si utilisé)

2. **Modifier l'URL** dans le nœud `Set Campaign Input Fields` pour pointer vers ton rapport Mailchimp

3. **Le workflow s'exécute automatiquement** chaque jour à 9h

4. **Vérifier les emails envoyés** dans la boîte d'envoi Gmail

## Principes de syntaxe illustrés

### 1. Opérateurs numériques dans If
```json
"leftValue": "={{ $json.open_rate }}",
"operator": { "type": "number", "operation": "gte" },
"rightValue": "30"
```
Compare un nombre avec `gte` (greater than or equal). Types possibles : `string`, `number`, `boolean`, `dateTime`.

### 2. MCP Tool (Model Context Protocol)
```json
"type": "n8n-nodes-mcp.mcpClientTool"
```
Connecte un agent LangChain à un serveur MCP externe (ici Bright Data pour le scraping).

### 3. Output Parser Autofixing
```json
"type": "@n8n/n8n-nodes-langchain.outputParserAutofixing"
```
Parser structuré qui, si l'IA retourne un JSON malformé, tente de le réparer automatiquement.

### 4. Référence croisée dans les connexions AI
```json
"ai_languageModel": [[ { "node": "Auto-fixing Output Parser", "type": "ai_languageModel" } ]]
```
Les connexions de type `ai_languageModel`, `ai_outputParser`, `ai_tool` sont spécifiques aux workflows LangChain dans n8n.

### 5. Nœud NoOp (aucune opération)
```json
"type": "n8n-nodes-base.noOp"
```
Utilisé comme branche "false" d'un If quand aucune action n'est requise. Le workflow continue sans rien faire.
